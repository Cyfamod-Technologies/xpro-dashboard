import {
  counterNoteMaxLength,
  denialMinLength,
  latestCounter,
  validateApproval,
  validateCounter,
} from "@/features/v1/helpers"
import type {
  ProviderCandidate,
  V1Actor,
  V1Conversation,
  V1Counts,
  V1CreateRequestBody,
  V1FormOptions,
  V1Job,
  V1Message,
  V1MessageBody,
  V1Request,
  V1RequestFilters,
  V1RequestPage,
  V1Staff,
} from "@/features/v1/types"
import { createSeed, mockLocations, mockSchema, mockServices } from "@/mocks/v1/seed"
import type { MockProvider, V1MockData } from "@/mocks/v1/seed"

// The V1 mock backend: every rule the real server will enforce, as plain functions over an in-memory store. The MSW
// handlers in `handlers.ts` only translate HTTP to these calls, so tests/v1-mock-store.mts exercises the rules
// without a service worker. Pure: no Vue or MSW imports.

export const storageKey = "xpro:v1-mock"

export interface MockActor {
  id: string
  role: V1Actor
  name: string
  email: string
  phone?: string
}

export class V1MockError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = "V1MockError"
    this.status = status
    this.code = code
    this.details = details
  }
}

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const browserStorage = (): StorageLike | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage
  } catch {
    return null
  }
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const forbidden = (message = "You can't do that on this request.") => new V1MockError(403, "FORBIDDEN", message)
const notFound = () => new V1MockError(404, "NOT_FOUND", "We couldn't find that request.")
const invalid = (message: string, details?: unknown) => new V1MockError(422, "VALIDATION_ERROR", message, details)

const isXpro = (actor: MockActor) => actor.role === "admin" || actor.role === "staff"
const phonePattern = /^(?:\+234|234|0)?[789][01]\d{8}$/

export interface V1Store {
  formOptions(): V1FormOptions
  counts(actor: MockActor): V1Counts
  listRequests(actor: MockActor, filters?: V1RequestFilters): V1RequestPage
  getRequest(actor: MockActor, id: string): V1Request
  createRequest(actor: MockActor, body: V1CreateRequestBody): V1Request
  assignStaff(
    actor: MockActor,
    id: string,
    body: { staffId: string; expectedOwnerId: string | null; note?: string },
    version?: number,
  ): V1Request
  approve(
    actor: MockActor,
    id: string,
    body: { providerId: string; priceKobo: number; date: string },
    version?: number,
  ): V1Request
  deny(actor: MockActor, id: string, body: { reason: string }, version?: number): V1Request
  cancelRequest(actor: MockActor, id: string, version?: number): V1Request
  listStaff(actor: MockActor): V1Staff[]
  listProviders(actor: MockActor): MockProvider[]
  publicProviders(): MockProvider[]
  reviewProvider(actor: MockActor, providerId: string, verified: boolean): MockProvider
  providerForActor(actor: MockActor): MockProvider
  setProviderAvailability(actor: MockActor, available: boolean): MockProvider
  providerCandidates(actor: MockActor, id: string): ProviderCandidate[]
  replaceProvider(
    actor: MockActor,
    id: string,
    body: { providerId: string; reason: string },
    version?: number,
  ): V1Request
  messages(actor: MockActor, id: string): V1Message[]
  sendMessage(actor: MockActor, id: string, body: V1MessageBody): V1Message
  adminConversations(actor: MockActor, params?: { q?: string }): V1Conversation[]
  customerConversations(actor: MockActor): V1Conversation[]
  providerJobs(actor: MockActor): V1Job[]
  providerJob(actor: MockActor, id: string): V1Job
  /** Back to the seed. */
  reset(now?: Date): void
}

/** A job as the provider sees it. V1-ASSUMPTION A3: no customer price, only the brief, place, date and contact. */
const toJob = (request: V1Request): V1Job => ({
  id: request.id,
  title: request.title,
  service: request.service,
  description: request.description,
  location: request.location,
  address: request.address,
  date: request.decision.terms?.date ?? "",
  assignedAt: request.provider?.assignedAt ?? "",
  customer: { name: request.customer.name, phone: request.customer.phone, contactMethod: request.contactMethod },
  attachments: clone(request.attachments),
})

/** `storage: null` keeps everything in memory (tests); omit it to use `localStorage` when the browser has one. */
export const createV1Store = (options: { storage?: StorageLike | null; now?: () => Date } = {}): V1Store => {
  const storage = options.storage === undefined ? browserStorage() : options.storage
  const now = options.now ?? (() => new Date())

  const load = (): V1MockData => {
    try {
      const saved = JSON.parse(storage?.getItem(storageKey) ?? "null") as V1MockData | null

      if (saved?.schema === mockSchema && Array.isArray(saved.requests) && Array.isArray(saved.messages)) return saved
    } catch {
      // A damaged copy falls back to the seed.
    }

    return createSeed(now())
  }

  let data = load()

  const save = () => {
    try {
      storage?.setItem(storageKey, JSON.stringify(data))
    } catch {
      // Private windows and full storage: the demo keeps working in memory.
    }
  }

  const stamp = () => now().toISOString()
  const refresh = () => {
    if (storage) data = load()
  }

  const findRequest = (id: string): V1Request => {
    const found = data.requests.find(item => item.id === id)

    if (!found) throw notFound()

    return found
  }

  /** True when the actor may read this request. */
  const canSee = (actor: MockActor, request: V1Request): boolean => {
    if (actor.role === "admin") return true
    if (actor.role === "customer") return request.customer.id === actor.id
    if (actor.role === "staff") return request.assignee?.id === actor.id

    return false
  }

  /** Readable request, else 404 (so another customer's id does not leak). Providers have no request access. */
  const readable = (actor: MockActor, id: string): V1Request => {
    const request = findRequest(id)

    if (actor.role === "provider") throw forbidden("Providers open their jobs from My jobs.")
    if (!canSee(actor, request)) throw notFound()

    return request
  }

  const project = (actor: MockActor, request: V1Request): V1Request => {
    const copy = clone(request)

    // Customers never see who is handling the request internally, nor the audit trail.
    if (actor.role === "customer") {
      copy.assignee = null
      copy.activity = []
    }

    return copy
  }

  const checkVersion = (request: V1Request, version: number | undefined) => {
    if (version !== undefined && version !== request.version)
      throw new V1MockError(409, "VERSION_CONFLICT", "This request changed since you opened it.", {
        current: clone(request),
      })
  }

  const bump = (request: V1Request) => {
    request.version += 1
  }

  const log = (request: V1Request, entry: Omit<V1Request["activity"][number], "id" | "at">) => {
    request.activity.push({ id: `act-${data.nextActivity++}`, at: stamp(), ...entry })
  }

  const candidatesFor = (request: V1Request): ProviderCandidate[] =>
    data.providers
      .filter(provider => provider.verified && provider.available)
      .filter(provider => provider.services.includes(request.service))
      .map((provider): ProviderCandidate => {
        const offersService = provider.services.includes(request.service)
        const servesArea = provider.areas.includes(request.location)

        return {
          id: provider.id,
          name: provider.name,
          trade: provider.trade,
          services: provider.services,
          areas: provider.areas,
          verified: provider.verified,
          available: provider.available,
          score: (offersService ? 10 : 0) + (servesArea ? 5 : 0) + provider.rating / 10,
          reasons: [
            ...(offersService ? [`Offers ${request.service}`] : []),
            ...(servesArea
              ? [`Serves ${request.location.replace(", Lagos", "")}`]
              : [`Area not confirmed for ${request.location.replace(", Lagos", "")}`]),
          ],
        }
      })
      .sort((a, b) => b.score - a.score)

  const providerById = (id: string): MockProvider | undefined => data.providers.find(item => item.id === id)

  const threadMessages = (id: string) => data.messages.filter(item => item.requestId === id)

  const conversationFor = (request: V1Request): V1Conversation | null => {
    const thread = threadMessages(request.id)
    const last = thread[thread.length - 1]

    if (!last) return null

    const lastXpro = [...thread].reverse().find(item => item.authorRole === "admin" || item.authorRole === "staff")
    const after = lastXpro ? thread.slice(thread.indexOf(lastXpro) + 1) : thread

    return {
      requestId: request.id,
      title: request.title,
      status: request.status,
      customer: { id: request.customer.id, name: request.customer.name },
      assignee: request.assignee,
      lastMessage: {
        kind: last.kind,
        authorRole: last.authorRole,
        authorLabel: last.authorLabel,
        text:
          last.kind === "counter" && last.counter
            ? `Counter offer: ₦${(last.counter.amountKobo / 100).toLocaleString("en-US")}`
            : last.text,
        at: last.createdAt,
      },
      waitingForXpro: after.filter(item => item.authorRole === "customer").length,
    }
  }

  const matchesSearch = (request: V1Request, q: string) =>
    [request.id, request.title, request.customer.name, request.service].some(value => value.toLowerCase().includes(q))

  const api: V1Store = {
    formOptions: () => ({
      services: mockServices.map(name => ({ id: name, name })),
      locations: mockLocations.map(name => ({ id: name, name })),
    }),

    counts: actor => {
      if (actor.role === "provider") throw forbidden()

      const visible = data.requests.filter(item => canSee(actor, item))
      const submitted = visible.filter(item => item.status === "submitted")

      const result: V1Counts = {
        submitted: submitted.length,
        approved: visible.filter(item => item.status === "approved").length,
        denied: visible.filter(item => item.status === "denied").length,
        cancelled: visible.filter(item => item.status === "cancelled").length,
      }
      if (actor.role === "admin") {
        result.unassigned = submitted.filter(item => !item.assignee).length
        result.assigned = submitted.filter(item => item.assignee).length
      }

      return result
    },

    listRequests: (actor, filters = {}) => {
      if (actor.role === "provider") throw forbidden("Providers open their jobs from My jobs.")

      const q = (filters.q ?? "").trim().toLowerCase()
      const matching = data.requests
        .filter(item => canSee(actor, item))
        .filter(item => !filters.status || item.status === filters.status)
        .filter(item => !filters.service || item.service === filters.service)
        .filter(item => {
          if (!filters.assignee || actor.role !== "admin") return true

          if (filters.assignee === "unassigned") return !item.assignee
          if (filters.assignee === "assigned") return Boolean(item.assignee)

          return item.assignee?.id === filters.assignee
        })
        .filter(item => !q || matchesSearch(item, q))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      const itemsPerPage = Math.min(Math.max(filters.itemsPerPage ?? 10, 1), 50)
      const page = Math.max(filters.page ?? 1, 1)

      return {
        items: matching.slice((page - 1) * itemsPerPage, page * itemsPerPage).map(item => project(actor, item)),
        total: matching.length,
        page,
        itemsPerPage,
      }
    },

    getRequest: (actor, id) => project(actor, readable(actor, id)),

    createRequest: (actor, body) => {
      if (actor.role !== "customer") throw forbidden("Only customers can submit requests.")

      const title = body.title?.trim() ?? ""
      const description = body.description?.trim() ?? ""
      const problems: string[] = []

      if (!(mockServices as readonly string[]).includes(body.service)) problems.push("Choose a service.")
      if (title.length < 3 || title.length > 120) problems.push("Use 3 to 120 characters for the title.")
      if (description.length < 20) problems.push("Describe the job in at least 20 characters.")
      if (!(mockLocations as readonly string[]).includes(body.location)) problems.push("Choose a location Xpro serves.")
      if (!(body.address ?? "").trim()) problems.push("Enter the site address.")
      if (!phonePattern.test(String(body.phone ?? "").replace(/[\s()-]/g, "")))
        problems.push("Enter a valid Nigerian phone number.")
      if (!["phone", "whatsapp", "email"].includes(body.contactMethod))
        problems.push("Choose how we should contact you.")
      if (!Number.isFinite(body.budgetKobo) || body.budgetKobo < 0) problems.push("The budget can't be negative.")
      if (problems.length) throw invalid(problems[0], problems)

      const at = stamp()
      const request: V1Request = {
        id: `XPR-${String(data.nextRequest++).padStart(5, "0")}`,
        version: 1,
        service: body.service,
        title,
        description,
        location: body.location,
        address: body.address.trim(),
        phone: body.phone.trim(),
        contactMethod: body.contactMethod,
        budgetKobo: Math.round(body.budgetKobo),
        preferredDate: body.preferredDate ?? "",
        attachments: clone(body.attachments ?? []),
        status: "submitted",
        customer: { id: actor.id, name: actor.name, email: actor.email, phone: body.phone.trim() },
        assignee: null,
        createdAt: at,
        decision: { status: "submitted" },
        provider: null,
        activity: [],
      }

      log(request, { kind: "submitted", text: `${actor.name} submitted the request`, by: actor.name })
      data.requests.push(request)
      save()

      return project(actor, request)
    },

    assignStaff: (actor, id, body, version) => {
      if (actor.role !== "admin") throw forbidden("Only an admin can assign staff.")

      const request = findRequest(id)

      checkVersion(request, version)

      const member = data.staff.find(item => item.id === body.staffId)

      if (!member) throw invalid("Choose an active staff member.")
      // The caller names who it thinks currently owns the request, so two admins can't overwrite each other.
      if ((body.expectedOwnerId ?? null) !== (request.assignee?.id ?? null))
        throw new V1MockError(409, "OWNER_CHANGED", "Someone else changed the assignee. Refresh and try again.", {
          current: clone(request),
        })
      if (request.assignee?.id === member.id) throw invalid(`${member.name} is already assigned.`)

      // V1-ASSUMPTION A5: the admin can (re)assign staff at any status, which fixes a stuck handoff after approval.
      const first = !request.assignee

      request.assignee = { id: member.id, name: member.name }
      bump(request)
      log(request, {
        kind: first ? "assigned" : "reassigned",
        text: `${actor.name} ${first ? "assigned" : "reassigned the request to"} ${member.name}`,
        by: actor.name,
        ...(body.note?.trim() ? { note: body.note.trim() } : {}),
      })
      save()

      return project(actor, request)
    },

    approve: (actor, id, body, version) => {
      if (actor.role !== "admin" && actor.role !== "staff")
        throw forbidden("Only XPro staff can approve a request.")

      const request = findRequest(id)

      if (actor.role === "staff" && request.assignee?.id !== actor.id)
        throw forbidden("Only the assigned staff member can approve this request.")

      checkVersion(request, version)
      if (request.status !== "submitted")
        throw new V1MockError(409, "ALREADY_DECIDED", "This request has already been decided.", {
          current: clone(request),
        })

      const check = validateApproval({
        assigneeId: request.assignee?.id,
        providerId: body.providerId,
        priceKobo: body.priceKobo,
        date: body.date,
      })

      if (check.errors.assignee) throw new V1MockError(422, "ASSIGNEE_REQUIRED", check.errors.assignee)
      if (!check.valid) throw invalid(Object.values(check.errors)[0] ?? "Check the approval terms.", check.errors)

      const provider = providerById(body.providerId)

      if (!provider || !provider.verified || !provider.available)
        throw invalid("Choose a verified, available provider.")
      if (!provider.services.includes(request.service))
        throw invalid(`Choose a provider that offers ${request.service}.`)
      if (body.date < stamp().slice(0, 10)) throw invalid("Choose today or a future date.")

      const at = stamp()

      request.status = "approved"
      request.decision = {
        status: "approved",
        by: { id: actor.id, name: actor.name },
        at,
        terms: {
          providerId: provider.id,
          providerName: provider.name,
          priceKobo: Math.round(body.priceKobo),
          date: body.date,
        },
      }
      request.provider = {
        providerId: provider.id,
        providerName: provider.name,
        assignedBy: actor.name,
        assignedAt: at,
      }
      bump(request)
      log(request, {
        kind: "approved",
        text: `${actor.name} approved: ${provider.name}, ₦${(body.priceKobo / 100).toLocaleString("en-US")}`,
        by: actor.name,
      })
      save()

      return project(actor, request)
    },

    deny: (actor, id, body, version) => {
      if (actor.role !== "admin") throw forbidden("Only an admin can deny a request.")

      const request = findRequest(id)

      checkVersion(request, version)
      if (request.status !== "submitted")
        throw new V1MockError(409, "ALREADY_DECIDED", "This request has already been decided.", {
          current: clone(request),
        })

      const reason = (body.reason ?? "").trim()

      if (reason.length < denialMinLength)
        throw invalid(`Give the customer a reason of at least ${denialMinLength} characters.`)

      request.status = "denied"
      request.decision = { status: "denied", reason, by: { id: actor.id, name: actor.name }, at: stamp() }
      bump(request)
      log(request, { kind: "denied", text: `${actor.name} denied the request`, by: actor.name, note: reason })
      save()

      return project(actor, request)
    },

    cancelRequest: (actor, id, version) => {
      if (actor.role !== "customer") throw forbidden("Only the customer can cancel this request.")

      const request = readable(actor, id)

      checkVersion(request, version)
      if (request.status !== "submitted")
        throw new V1MockError(409, "CANCELLATION_CLOSED", "Only a submitted request can be cancelled.")

      request.status = "cancelled"
      request.cancelledAt = stamp()
      request.cancelledBy = { id: actor.id, name: actor.name }
      bump(request)
      log(request, { kind: "cancelled", text: `${actor.name} cancelled the request`, by: actor.name })
      save()

      return project(actor, request)
    },

    listStaff: actor => {
      if (actor.role !== "admin") throw forbidden()

      return data.staff.map(member => ({
        id: member.id,
        name: member.name,
        email: member.email,
        openRequests: data.requests.filter(item => item.status === "submitted" && item.assignee?.id === member.id)
          .length,
      }))
    },

    listProviders: actor => {
      if (actor.role !== "admin") throw forbidden()

      return clone(data.providers)
    },

    publicProviders: () => clone(data.providers.filter(provider => provider.verified)),

    reviewProvider: (actor, providerId, verified) => {
      if (actor.role !== "admin") throw forbidden()
      const provider = providerById(providerId)
      if (!provider) throw new V1MockError(404, "NOT_FOUND", "We couldn't find that provider.")
      provider.verified = verified
      save()

      return clone(provider)
    },

    providerForActor: actor => {
      if (actor.role !== "provider") throw forbidden()
      const provider = providerById(actor.id)
      if (!provider) throw notFound()

      return clone(provider)
    },

    setProviderAvailability: (actor, available) => {
      if (actor.role !== "provider") throw forbidden()
      const provider = providerById(actor.id)
      if (!provider) throw notFound()
      provider.available = available
      save()

      return clone(provider)
    },

    providerCandidates: (actor, id) => {
      if (!isXpro(actor)) throw forbidden()

      return candidatesFor(readable(actor, id))
    },

    replaceProvider: (actor, id, body, version) => {
      if (!isXpro(actor)) throw forbidden("Only Xpro staff can replace a provider.")

      const request = readable(actor, id)

      checkVersion(request, version)
      if (request.status !== "approved" || !request.provider)
        throw new V1MockError(409, "NOT_APPROVED", "A provider can only be replaced on an approved request.")

      const reason = (body.reason ?? "").trim()

      if (reason.length < denialMinLength) throw invalid(`Give a reason of at least ${denialMinLength} characters.`)
      if (body.providerId === request.provider.providerId) throw invalid("Choose a different provider.")

      const provider = providerById(body.providerId)

      if (!provider || !provider.verified || !provider.available)
        throw invalid("Choose a verified, available provider.")
      if (!provider.services.includes(request.service))
        throw invalid(`Choose a provider that offers ${request.service}.`)

      const previous = request.provider.providerName

      request.provider = {
        providerId: provider.id,
        providerName: provider.name,
        assignedBy: actor.name,
        assignedAt: stamp(),
      }
      if (request.decision.terms) {
        request.decision.terms.providerId = provider.id
        request.decision.terms.providerName = provider.name
      }
      bump(request)
      log(request, {
        kind: "provider_replaced",
        text: `${actor.name} replaced ${previous} with ${provider.name}`,
        by: actor.name,
        note: reason,
      })
      save()

      return project(actor, request)
    },

    messages: (actor, id) => {
      readable(actor, id)

      return clone(threadMessages(id))
    },

    sendMessage: (actor, id, body) => {
      const request = readable(actor, id)

      if (actor.role === "provider") throw forbidden()
      if (body.kind !== "text" && body.kind !== "counter") throw invalid("Choose a valid message type.")

      const text = (body.text ?? "").trim()
      const attachments = clone(body.attachments ?? [])

      if (text.length > 2000) throw invalid("Keep the message under 2000 characters.")

      const thread = threadMessages(id)
      const message: V1Message = {
        id: `msg-${data.nextMessage++}`,
        requestId: id,
        kind: body.kind,
        authorId: actor.id,
        authorRole: actor.role,
        authorLabel: actor.name,
        text,
        attachments,
        createdAt: stamp(),
      }

      if (body.kind === "counter") {
        if (!body.counter) throw invalid("Enter the offer.")
        if (request.status !== "submitted")
          throw new V1MockError(409, "COUNTER_CLOSED", "Offers are closed once a request is decided.")

        const check = validateCounter(body.counter)

        if (!check.valid) throw invalid(Object.values(check.errors)[0] ?? "Check the offer.", check.errors)

        const latest = latestCounter(thread)

        // A customer can only answer an offer; Xpro can open the negotiation with a quote.
        if (!latest || (actor.role === "customer") === (latest.authorRole === "customer"))
          throw new V1MockError(409, "NO_OFFER_TO_COUNTER", "There is no offer from Xpro to counter.")

        const counterId = `ctr-${data.nextMessage}`

        message.counter = {
          id: counterId,
          amountKobo: Math.round(body.counter.amountKobo),
          date: body.counter.date || null,
          note: (body.counter.note ?? "").trim().slice(0, counterNoteMaxLength),
          supersededBy: null,
        }
        if (latest?.counter) latest.counter.supersededBy = counterId
        message.text = ""
      } else if (!text && !attachments.length) {
        throw invalid("Write a message or attach a file.")
      }

      // A message never changes the request, its version or its decision.
      data.messages.push(message)
      save()

      return clone(message)
    },

    adminConversations: (actor, params = {}) => {
      // The shared inbox is admin-only; assigned staff communicate from their request details.
      if (actor.role !== "admin") throw forbidden()

      const q = (params.q ?? "").trim().toLowerCase()

      return data.requests
        .filter(item => !q || matchesSearch(item, q))
        .flatMap(item => {
          const row = conversationFor(item)

          return row ? [row] : []
        })
        .sort((a, b) => (b.lastMessage?.at ?? "").localeCompare(a.lastMessage?.at ?? ""))
    },

    customerConversations: actor => {
      if (actor.role !== "customer") throw forbidden()

      return data.requests
        .filter(item => item.customer.id === actor.id)
        .flatMap(item => {
          const row = conversationFor(item)

          return row ? [{ ...row, assignee: null }] : []
        })
        .sort((a, b) => (b.lastMessage?.at ?? "").localeCompare(a.lastMessage?.at ?? ""))
    },

    providerJobs: actor => {
      if (actor.role !== "provider") throw forbidden()

      return data.requests
        .filter(item => item.status === "approved" && item.provider?.providerId === actor.id)
        .sort((a, b) => (b.provider?.assignedAt ?? "").localeCompare(a.provider?.assignedAt ?? ""))
        .map(toJob)
    },

    providerJob: (actor, id) => {
      if (actor.role !== "provider") throw forbidden()

      const request = data.requests.find(item => item.id === id)

      // Another provider's job is a 404, like any unknown id.
      if (!request || request.status !== "approved" || request.provider?.providerId !== actor.id) throw notFound()

      return toJob(request)
    },

    reset: at => {
      data = createSeed(at ?? now())
      save()
    },
  }

  return new Proxy(api, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver) as unknown
      if (typeof value !== "function") return value

      return (...args: unknown[]) => {
        refresh()

        return (value as (...parameters: unknown[]) => unknown).apply(target, args)
      }
    },
  })
}
