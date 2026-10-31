import type { PublicQuestion, PublicServiceNode } from "@/features/catalog/types"
import { isLeaf, questionsAlongPath } from "@/features/catalog/types"
import type { CreateRequestBody, CreateRequestGroupBody } from "@/features/requests/api-types"
import type { RequestInput } from "@/features/operations/types"
import { firstDetailMessage } from "@/utils/errors"

/**
 * Pure logic behind the live request form's "several services in one submission" mode (Spec 04 §6.2, MS-1..MS-5).
 * No Vue or browser imports, so `tests/request-bundle.mts` can run it directly.
 */

/**
 * Default used while loading `GET /requests/config`; the server remains authoritative when a request is submitted.
 */
export const MAX_SERVICES_PER_SUBMISSION = 5
export const MAX_CONFIGURABLE_SERVICES = 10

export const DUPLICATE_SERVICE_MESSAGE = "Add each service once. Use the quantity field to ask for more than one."
export const serviceLimitHint = (max = MAX_SERVICES_PER_SUBMISSION) =>
  `You can request up to ${max} services at a time.`

export type AnswerValue = string | number | string[] | null | undefined
export type Answers = Record<string, AnswerValue>
export type BuiltAnswers = Record<string, string | number | string[]>

/** What one Service card holds. `key` only identifies the card in the page; it is never sent or saved. */
export interface ServiceCardState {
  key: string

  /** The ids picked at each level, top-level service first. */
  selectedIds: string[]
  answers: Answers
  description: string

  /** Naira, as typed. Converted to kobo when the body is built. */
  budget: number

  /** `YYYY-MM-DD` or empty. */
  startDate: string

  /** Files chosen for this service only; uploaded on submit. */
  files: File[]
}

export const newServiceCard = (key: string = globalThis.crypto.randomUUID()): ServiceCardState => ({
  key,
  selectedIds: [],
  answers: {},
  description: "",
  budget: 0,
  startDate: "",
  files: [],
})

export const contactMethods = [
  { title: "Phone", value: "phone" },
  { title: "Email", value: "email" },
  { title: "Phone and email", value: "both" },
]

export const canAddService = (count: number, max = MAX_SERVICES_PER_SUBMISSION) => count < max
export const canRemoveService = (count: number) => count > 1

// ---- Open-request allowance (Spec 04 §6.2, MS-6, MS-7) ----

/** What `GET /requests/pending` says about the signed-in customer. `null` means unknown; the server then decides. */
export interface Allowance {
  /** Open requests now. */
  open: number
  limit: number
  remaining: number
}

/** Reads the `GET /requests/pending` response, or null when it does not carry the allowance. */
export const allowanceFrom = (view: unknown): Allowance | null => {
  const source = typeof view === "object" && view !== null ? (view as Record<string, unknown>) : {}
  const { openCount, limit, remaining } = source

  if (![openCount, limit, remaining].every(value => typeof value === "number" && Number.isFinite(value))) return null

  return { open: openCount as number, limit: limit as number, remaining: Math.max(0, remaining as number) }
}

/** How many Service cards the customer may have: the per-submission maximum, or what is left of their allowance. */
export const serviceCap = (allowance: Allowance | null, max = MAX_SERVICES_PER_SUBMISSION) =>
  allowance ? Math.min(max, allowance.remaining) : max

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many)

/**
 * Why the submission cannot go, in the server's words, or an empty string when it can. `remaining = 0` is the
 * "wait or cancel" message; `0 < remaining < cards` (for example a restored draft) names how many to remove.
 */
export const allowanceBlockMessage = (allowance: Allowance | null, cardCount: number) => {
  if (!allowance) return ""
  if (allowance.remaining <= 0)
    return allowance.limit === 1
      ? "You already have an open request. Wait for it to finish, or cancel it, before sending another."
      : `You already have ${allowance.open} open requests, the most XPro allows at a time. Wait for one to finish, or cancel one, before sending another.`
  if (allowance.remaining < cardCount) {
    const extra = cardCount - allowance.remaining

    return `You can have ${allowance.limit} open ${plural(allowance.limit, "request", "requests")} at a time and you have ${allowance.open}. Remove ${extra} ${plural(extra, "service", "services")} from this submission, or finish an open request first.`
  }

  return ""
}

/** The hint under a disabled "Add another service": the per-submission maximum, or the allowance when that is lower. */
export const addServiceHint = (allowance: Allowance | null, max = MAX_SERVICES_PER_SUBMISSION) =>
  allowance && allowance.remaining < max
    ? `You can’t add another service because your limit allows ${allowance.limit} open ${plural(allowance.limit, "request", "requests")}, and this form already includes ${allowance.remaining} ${plural(allowance.remaining, "service", "services")} for your remaining allowance.`
    : serviceLimitHint(max)

/** A quiet note for customers whose allowance is below the per-submission maximum; empty when there is nothing to say. */
export const allowanceInfo = (allowance: Allowance | null, max = MAX_SERVICES_PER_SUBMISSION) =>
  allowance && allowance.remaining > 0 && allowance.remaining < max
    ? `You have ${allowance.open} of ${allowance.limit} open requests, so you can send ${allowance.remaining} more right now.`
    : ""

// ---- The picked path and its questions ----

/** The nodes along `ids`, top-level service first. Stops at the first id that is not in the tree. */
export const pathFor = (tree: PublicServiceNode[], ids: string[]) => {
  const nodes: PublicServiceNode[] = []
  let level = tree

  for (const id of ids) {
    const node = level.find(item => item.id === id)

    if (!node) break
    nodes.push(node)
    level = node.children
  }

  return nodes
}

/** The catalogue leaf the ids end on, or undefined while the customer is still choosing. */
export const leafFor = (tree: PublicServiceNode[], ids: string[]) => {
  const nodes = pathFor(tree, ids)
  const last = nodes[nodes.length - 1]

  return last && isLeaf(last) ? last : undefined
}

export const questionsFor = (nodes: PublicServiceNode[]): PublicQuestion[] =>
  questionsAlongPath<PublicQuestion, PublicServiceNode>(nodes).map(item => item.question)

export const hasAnswer = (value: AnswerValue) =>
  Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && String(value).trim() !== ""

/** Drops answers whose question is no longer on the picked path. */
export const pruneAnswers = (tree: PublicServiceNode[], ids: string[], answers: Answers): Answers => {
  const valid = new Set(questionsFor(pathFor(tree, ids)).map(question => question.id))

  return Object.fromEntries(Object.entries(answers).filter(([id]) => valid.has(id)))
}

/** The answers in the shape the API takes: numbers as numbers, text trimmed, empty answers left out. */
export const buildAnswers = (questions: PublicQuestion[], answers: Answers): BuiltAnswers => {
  const result: BuiltAnswers = {}

  for (const question of questions) {
    const value = answers[question.id]

    if (!hasAnswer(value) || value === null || value === undefined) continue
    if (question.type === "number") result[question.id] = Number(value)
    else if (Array.isArray(value)) result[question.id] = value
    else
      result[question.id] =
        question.type === "short_text" || question.type === "long_text" ? String(value).trim() : String(value)
  }

  return result
}

/** True when the card names a leaf, answers its required questions and has a brief of at least 20 characters. */
export const isCardComplete = (card: ServiceCardState, tree: PublicServiceNode[]) => {
  const nodes = pathFor(tree, card.selectedIds)
  const last = nodes[nodes.length - 1]

  return (
    Boolean(last && isLeaf(last)) &&
    questionsFor(nodes).every(question => !question.required || hasAnswer(card.answers[question.id])) &&
    card.description.trim().length >= 20
  )
}

// ---- Rules across cards ----

/**
 * Keys of the cards that pick a leaf an earlier card already picked. The first card with a leaf is fine; the
 * message belongs on the later ones (MS-2).
 */
export const duplicateCardKeys = (cards: ServiceCardState[], tree: PublicServiceNode[]) => {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const card of cards) {
    const leaf = leafFor(tree, card.selectedIds)

    if (!leaf) continue
    if (seen.has(leaf.id)) duplicates.add(card.key)
    else seen.add(leaf.id)
  }

  return duplicates
}

// ---- Building the request ----

/** Fields every service in the submission shares. `contactMethod` is optional in the API. */
export interface SharedFields {
  title: string

  /** The area when one is chosen, otherwise the LGA. */
  locationId: string
  address: string
  phone: string
  contactMethod?: string
}

/** One card, resolved against the catalogue and ready to send. */
export interface ResolvedService {
  serviceId: string
  answers: BuiltAnswers
  description: string

  /** Kobo. */
  budget: number
  startDate?: string
}

export const toKobo = (naira: number) => (naira ? Math.round(naira * 100) : 0)

/** Null while the card has no leaf, so the caller can ask for a service. */
export const resolveService = (card: ServiceCardState, tree: PublicServiceNode[]): ResolvedService | null => {
  const nodes = pathFor(tree, card.selectedIds)
  const leaf = nodes[nodes.length - 1]

  if (!leaf || !isLeaf(leaf)) return null

  return {
    serviceId: leaf.id,
    answers: buildAnswers(questionsFor(nodes), card.answers),
    description: card.description,
    budget: toKobo(card.budget),
    startDate: card.startDate || undefined,
  }
}

export interface ServiceUpload {
  service: ResolvedService

  /** Ids of the files uploaded for this card only. */
  attachments: Array<{ id: string }>
}

export type Submission = { kind: "single"; body: CreateRequestBody } | { kind: "group"; body: CreateRequestGroupBody }

/**
 * One service uses the unchanged single-request shape (`POST /requests`) with that card's files as its attachments.
 * More than one uses the bundle shape (`POST /request-groups`): each card's files sit on its own service and the
 * body has no top-level `attachments`, which the server refuses (MS-8).
 * An empty `startDate` is left out, never sent as an empty string.
 */
export const buildSubmission = (shared: SharedFields, uploads: ServiceUpload[]): Submission => {
  const first = uploads[0]

  if (uploads.length === 1 && first)
    return {
      kind: "single",
      body: {
        ...shared,
        serviceId: first.service.serviceId,
        description: first.service.description,
        budget: first.service.budget,
        ...(first.service.startDate ? { startDate: first.service.startDate } : {}),
        answers: first.service.answers,
        attachments: first.attachments,
      },
    }

  return {
    kind: "group",
    body: {
      ...shared,
      services: uploads.map(({ service, attachments }) => ({
        serviceId: service.serviceId,
        answers: service.answers,
        description: service.description,
        budget: service.budget,
        ...(service.startDate ? { startDate: service.startDate } : {}),
        ...(attachments.length ? { attachments } : {}),
      })),
    },
  }
}

// ---- Server errors ----

export interface ServiceErrors {
  /** Message by card position, for errors whose field path starts with `services[i]`. */
  byService: Record<number, string>

  /** Messages that belong to no card. */
  general: string[]
}

const servicePath = /^services(?:\[(\d+)\]|\.(\d+))/

/** Splits a 422 `details` list: `services[i]…` goes to card i; everything else stays general. */
export const splitServiceErrors = (details: unknown, count: number): ServiceErrors => {
  const result: ServiceErrors = { byService: {}, general: [] }

  if (!Array.isArray(details)) return result
  for (const detail of details) {
    const record = typeof detail === "object" && detail !== null ? (detail as Record<string, unknown>) : {}
    const path = [record.field, record.path, record.property].find(item => typeof item === "string") as
      string | undefined
    const message = firstDetailMessage([detail])

    if (!message) continue

    const match = path ? servicePath.exec(path) : null
    const index = match ? Number(match[1] ?? match[2]) : -1

    if (index >= 0 && index < count) result.byService[index] ??= message
    else result.general.push(message)
  }

  return result
}

// ---- Guest draft (form-draft-mode) ----

/** Bump when `RequestDraft` changes. v1 held one service; v2 holds `services[]`. */
export const REQUEST_DRAFT_VERSION = 2

/** What is saved for one Service card. Files are stored separately, in IndexedDB. */
export interface ServiceDraft {
  selectedIds: string[]
  answers: Answers
  description: string
  budget: number
  startDate: string
}

export interface RequestDraft {
  title: string
  address: string
  phone: string
  contactMethod: RequestInput["contactMethod"]
  /** Demo mode only (free-text city of the frozen reducer form). */
  city: string

  /** Live mode: the place picked at each level. `lgaId` and `areaId` are empty until chosen. */
  stateId: string
  lgaId: string
  areaId: string
  submitKey: string

  /** Live mode: one entry per Service card. */
  services: ServiceDraft[]

  /** Demo mode only (frozen reducer form); unused in live mode. */
  service: string
  details: RequestInput["details"]
  description: string
  budget: number
  startDate: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
const text = (value: unknown) => (typeof value === "string" ? value : "")
const amount = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0)
const stringList = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []

export const toServiceDraft = (card: ServiceCardState): ServiceDraft => ({
  selectedIds: [...card.selectedIds],
  answers: { ...card.answers },
  description: card.description,
  budget: card.budget,
  startDate: card.startDate,
})

const readServiceDraft = (value: unknown): ServiceDraft => {
  const source = isRecord(value) ? value : {}

  return {
    selectedIds: stringList(source.selectedIds),
    answers: isRecord(source.answers) ? (source.answers as Answers) : {},
    description: text(source.description),
    budget: amount(source.budget),
    startDate: text(source.startDate),
  }
}

/** Fills gaps in a saved draft so a half-written or edited one still restores. */
export const readRequestDraft = (data: unknown): RequestDraft | null => {
  if (!isRecord(data)) return null

  const services = (Array.isArray(data.services) ? data.services : [])
    .slice(0, MAX_CONFIGURABLE_SERVICES)
    .map(readServiceDraft)

  return {
    title: text(data.title),
    address: text(data.address),
    phone: text(data.phone),
    contactMethod: (text(data.contactMethod) || "phone") as RequestDraft["contactMethod"],
    city: text(data.city),
    // A draft saved before LOC-2 kept the FCT root (now the state) as `cityId`.
    stateId: text(data.stateId) || text(data.cityId),
    lgaId: text(data.lgaId),
    areaId: text(data.areaId),
    submitKey: text(data.submitKey),
    services: services.length ? services : [readServiceDraft(undefined)],
    service: text(data.service),
    details: isRecord(data.details) ? (data.details as RequestInput["details"]) : {},
    description: text(data.description),
    budget: amount(data.budget),
    startDate: text(data.startDate),
  }
}

/**
 * Turns a v1 draft (one service: top-level `selectedIds`, `answers`, `description`, `budget`, `startDate`) into a
 * v2 draft with a list of one service. Returns null for a version or shape it does not know.
 */
export const migrateRequestDraft = (data: unknown, fromVersion: number): RequestDraft | null => {
  if (!isRecord(data)) return null
  if (fromVersion === REQUEST_DRAFT_VERSION) return readRequestDraft(data)
  if (fromVersion !== 1) return null

  return readRequestDraft({ ...data, services: [readServiceDraft(data)] })
}

/**
 * Rebuilds the cards from a saved draft against the current catalogue: a path that no longer exists is cut at
 * the last id that does, and answers to questions off that path are dropped.
 */
export const cardsFromDraft = (
  services: ServiceDraft[],
  tree: PublicServiceNode[],
  makeKey: () => string = () => globalThis.crypto.randomUUID(),
): ServiceCardState[] => {
  const cards = services.slice(0, MAX_CONFIGURABLE_SERVICES).map(saved => {
    const selectedIds = pathFor(tree, saved.selectedIds).map(node => node.id)

    return {
      ...newServiceCard(makeKey()),
      selectedIds,
      answers: pruneAnswers(tree, selectedIds, saved.answers),
      description: saved.description,
      budget: saved.budget,
      startDate: saved.startDate,
    }
  })

  return cards.length ? cards : [newServiceCard(makeKey())]
}
