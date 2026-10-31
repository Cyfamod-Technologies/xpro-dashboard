import type { ProviderCandidate, V1Actor, V1ContactMethod, V1Message, V1Request, V1Status } from "@/features/v1/types"

// Pure V1 helpers. No Vue or Vuetify imports, so tests/v1-helpers.mts can run it.

export const statusLabels: Record<V1Status, string> = {
  submitted: "Submitted",
  approved: "Approved",
  denied: "Denied",
  cancelled: "Cancelled",
}

/** Vuetify theme colour names. */
export const statusColors: Record<V1Status, "warning" | "success" | "error" | "secondary"> = {
  submitted: "warning",
  approved: "success",
  denied: "error",
  cancelled: "secondary",
}

export const statusOptions: Array<{ title: string; value: V1Status }> = [
  { title: "Submitted", value: "submitted" },
  { title: "Approved", value: "approved" },
  { title: "Denied", value: "denied" },
  { title: "Cancelled", value: "cancelled" },
]

export const contactMethodLabels: Record<V1ContactMethod, string> = {
  phone: "Phone call",
  whatsapp: "WhatsApp",
  email: "Email",
}

export const denialMinLength = 10
export const denialMaxLength = 1000

/** "₦150,000" for whole naira, "₦150,000.50" otherwise. Money is kobo in data and naira on screen. */
export const formatNaira = (kobo: number): string => {
  const naira = kobo / 100

  return `₦${naira.toLocaleString("en-US", { minimumFractionDigits: kobo % 100 ? 2 : 0, maximumFractionDigits: 2 })}`
}

/** Turns what the user typed in a ₦ field ("150,000", "150000.5") into kobo; null when it is not a positive amount. */
export const nairaToKobo = (input: string | number | null | undefined): number | null => {
  const text = String(input ?? "")
    .replace(/[₦,\s]/g, "")
    .trim()

  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null

  const kobo = Math.round(Number(text) * 100)

  return kobo > 0 ? kobo : null
}

/** Kobo as the plain number a ₦ field shows, e.g. 15000000 -> "150000". */
export const koboToNairaInput = (kobo: number | null | undefined): string =>
  kobo ? String(kobo % 100 ? (kobo / 100).toFixed(2) : kobo / 100) : ""

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "3 Nov 2026" for a `YYYY-MM-DD` date or an ISO timestamp; an empty string when it cannot be read. */
export const formatDay = (value: string | null | undefined): string => {
  if (!value) return ""

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const date = dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) : new Date(value)

  if (Number.isNaN(date.getTime())) return ""

  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
}

/** "3 Nov 2026, 2:05 pm" for an ISO timestamp. */
export const formatDateTime = (value: string | null | undefined): string => {
  const day = formatDay(value)

  if (!day) return ""

  const time = new Date(value as string).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })

  return `${day}, ${time.toLowerCase()}`
}

/** Today as `YYYY-MM-DD` in local time. */
export const todayIso = (now = new Date()): string =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`

/** The newest counter card in a conversation, or null. */
export const latestCounter = (messages: readonly V1Message[]): V1Message | null => {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]

    if (message.kind === "counter" && message.counter) return message
  }

  return null
}

/** True when the card is not the newest one. */
export const isSuperseded = (message: V1Message, messages: readonly V1Message[]): boolean =>
  message.kind === "counter" && latestCounter(messages)?.id !== message.id

/**
 * The Counter button shows on the newest card, to anyone who did not write it. The thread is closed once the request
 * is decided, so the caller also passes `open`.
 */
export const canCounter = (viewerId: string, latest: V1Message | null, open = true, viewerRole?: V1Actor): boolean =>
  open &&
  latest !== null &&
  latest.kind === "counter" &&
  latest.authorId !== viewerId &&
  (viewerRole === undefined || (viewerRole === "customer") !== (latest.authorRole === "customer"))

export type PrefillSource = "latest counter offer" | "request form" | "best match" | ""

export interface ApprovalPrefill {
  providerId: string | null
  priceKobo: number | null
  date: string | null
  sources: { provider: PrefillSource; price: PrefillSource; date: PrefillSource }
}

/** Candidates the admin may pick: verified and available, best fit first. */
export const eligibleCandidates = (candidates: readonly ProviderCandidate[]): ProviderCandidate[] =>
  candidates.filter(item => item.verified && item.available).sort((a, b) => b.score - a.score)

/**
 * What the Approve dialog starts with. Price and date come from the newest counter card, else from the request form
 * (budget and preferred date); the provider is the best verified, available match. All stay editable.
 */
export const approvalPrefill = (
  request: Pick<V1Request, "budgetKobo" | "preferredDate">,
  messages: readonly V1Message[],
  candidates: readonly ProviderCandidate[],
): ApprovalPrefill => {
  const counter = latestCounter(messages)?.counter
  const best = eligibleCandidates(candidates)[0]

  const price: Pick<ApprovalPrefill, "priceKobo"> & { source: PrefillSource } = counter
    ? { priceKobo: counter.amountKobo, source: "latest counter offer" }
    : request.budgetKobo > 0
      ? { priceKobo: request.budgetKobo, source: "request form" }
      : { priceKobo: null, source: "" }
  const date: { value: string | null; source: PrefillSource } = counter?.date
    ? { value: counter.date, source: "latest counter offer" }
    : request.preferredDate
      ? { value: request.preferredDate, source: "request form" }
      : { value: null, source: "" }

  return {
    providerId: best?.id ?? null,
    priceKobo: price.priceKobo,
    date: date.value,
    sources: { provider: best ? "best match" : "", price: price.source, date: date.source },
  }
}

export interface ApprovalInput {
  assigneeId: string | null | undefined
  providerId: string | null | undefined
  priceKobo: number | null | undefined
  date: string | null | undefined
}

export interface ValidationResult<K extends string> {
  valid: boolean
  errors: Partial<Record<K, string>>
}

/** Approve needs an assignee, a provider, a price above zero and a date. */
export const validateApproval = (
  input: ApprovalInput,
): ValidationResult<"assignee" | "provider" | "price" | "date"> => {
  const errors: Partial<Record<"assignee" | "provider" | "price" | "date", string>> = {}

  if (!input.assigneeId) errors.assignee = "Assign a staff member before approving."
  if (!input.providerId) errors.provider = "Choose a provider."
  if (!input.priceKobo || input.priceKobo <= 0) errors.price = "Enter a price above ₦0."
  if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) errors.date = "Choose a date."
  else if (input.date < todayIso()) errors.date = "Choose today or a future date."

  return { valid: Object.keys(errors).length === 0, errors }
}

/** A denial needs a reason of at least 10 characters; the customer reads it. */
export const validateDenial = (reason: string | null | undefined): ValidationResult<"reason"> => {
  const text = (reason ?? "").trim()
  const errors: Partial<Record<"reason", string>> = {}

  if (text.length < denialMinLength)
    errors.reason = `Give the customer a reason of at least ${denialMinLength} characters.`
  else if (text.length > denialMaxLength) errors.reason = `Keep the reason under ${denialMaxLength} characters.`

  return { valid: Object.keys(errors).length === 0, errors }
}

export interface CounterInput {
  amountKobo: number | null | undefined
  date?: string | null
  note?: string | null
}

export const counterNoteMaxLength = 500

export const validateCounter = (input: CounterInput): ValidationResult<"amount" | "date" | "note"> => {
  const errors: Partial<Record<"amount" | "date" | "note", string>> = {}

  if (!input.amountKobo || input.amountKobo <= 0) errors.amount = "Enter an amount above ₦0."
  if (input.date && !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) errors.date = "Choose a valid date."
  if ((input.note ?? "").length > counterNoteMaxLength)
    errors.note = `Keep the note under ${counterNoteMaxLength} characters.`

  return { valid: Object.keys(errors).length === 0, errors }
}

/** What the customer reads on a denied request. */
export const denialNotice = (reason: string | undefined): string =>
  (reason ?? "").trim() || "Xpro could not accept this request."

/** One line for a list row. */
export const preview = (text: string, max = 90): string => {
  const line = text.replace(/\s+/g, " ").trim()

  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line
}

/** A 409 from a command: the request changed since the page loaded. */
export const isVersionConflict = (error: unknown): boolean => {
  const status = (error as { status?: unknown } | null)?.status

  return status === 409
}

/** The label on a chat bubble: customers see one shared XPro Team identity for every staff member. */
export const authorLabelFor = (viewer: V1Actor, message: Pick<V1Message, "authorRole" | "authorLabel">): string =>
  viewer === "customer" && (message.authorRole === "admin" || message.authorRole === "staff")
    ? "XPro Team"
    : message.authorLabel

/**
 * Counter offers are negotiated before the decision. Text messages stay open after it (a message never changes the
 * decision), but no new quote or counter card can start once the request is approved or denied.
 */
export const counterOpen = (status: V1Status): boolean => status === "submitted"

/** Denied requests can seed a new one: the fields that carry over. */
export const prefillFromRequest = (request: V1Request) => ({
  service: request.service,
  title: request.title,
  description: request.description,
  location: request.location,
  address: request.address,
  phone: request.phone,
  contactMethod: request.contactMethod,
  budgetKobo: request.budgetKobo,
})
