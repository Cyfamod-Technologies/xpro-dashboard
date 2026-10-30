import type { ChatAudience, ChatAudienceOption } from "@/features/chat/chat-types"
import type { AssignmentView } from "@/features/requests/api-types"
import { requestStatuses, statusLabel, statusOrder } from "@/features/messages/status-labels"
import type { ConversationItem, ConversationListParams } from "@/features/messages/types"

// Pure helpers for the admin Messages inbox. No Vue or Vuetify imports, so tests/messages-helpers.mts can run it.

export const messagePermissions = ["message.customer", "message.provider", "message.internal"] as const

/** Longest search the server accepts. */
export const searchMaxLength = 100

/** The Messages item shows when the viewer may use at least one message channel. */
export const canUseMessages = (scopes: readonly string[] | undefined) =>
  !!scopes && messagePermissions.some(permission => scopes.includes(permission))

/**
 * Audiences the viewer may write to, in composer order. A provider with no current assignment is shown but disabled with
 * the reason, so staff see why instead of the option vanishing.
 */
export const audienceOptions = (scopes: readonly string[] | undefined, hasProvider: boolean): ChatAudienceOption[] => {
  const has = (permission: string) => !!scopes?.includes(permission)
  const options: ChatAudienceOption[] = []

  if (has("message.customer")) options.push({ value: "customer" })
  if (has("message.provider"))
    options.push(hasProvider ? { value: "provider" } : { value: "provider", disabledReason: "No provider on this request yet." })
  if (has("message.internal")) options.push({ value: "internal" })

  return options
}

/**
 * The composer's starting audience (design 01-messages §4.5): the audience of the message waiting for XPro, else
 * Customer, and never a staff note. If the viewer cannot write to that audience the first usable one is used.
 */
export const defaultAudience = (
  row: Pick<ConversationItem, "lastMessage" | "waitingForXpro"> | undefined,
  options: ChatAudienceOption[],
): ChatAudience | null => {
  const usable = options.filter(option => !option.disabledReason && option.value !== "internal").map(option => option.value)
  const waiting =
    row && row.waitingForXpro > 0 && (row.lastMessage.authorRole === "customer" || row.lastMessage.authorRole === "provider")
      ? row.lastMessage.audience
      : undefined
  const wanted: ChatAudience[] = [waiting, "customer"].filter((value): value is ChatAudience => !!value)

  return wanted.find(value => usable.includes(value)) ?? usable[0] ?? null
}

export const initials = (name: string | undefined | null) => {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean)

  if (!parts.length) return "?"

  return ((parts[0][0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "")).toUpperCase()
}

const firstWord = (label: string) => label.trim().split(/\s+/)[0] ?? ""

export interface PreviewParts {
  /** "Chika:", "You:" or "Note:". */
  prefix: string
  /** Internal staff note: the prefix is shown in italics. */
  note: boolean
  /** The message text, or "Attachment" when it has none. */
  text: string
  attachmentOnly: boolean
}

/** Line 2 of a row. `viewerName` is the signed-in staff member's full name, so their own messages read "You:". */
export const previewParts = (item: ConversationItem, viewerName?: string): PreviewParts => {
  const { audience, authorLabel, text } = item.lastMessage
  const body = text.trim()
  const attachmentOnly = body === ""
  const same = !!viewerName && authorLabel.trim().toLowerCase() === viewerName.trim().toLowerCase()
  const prefix = audience === "internal" ? "Note:" : same ? "You:" : `${firstWord(authorLabel) || "XPro"}:`

  return { prefix, note: audience === "internal", text: attachmentOnly ? "Attachment" : body, attachmentOnly }
}

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** Line 1, right side: the time today, "Yesterday", or the date (with the year when it is not this year). */
export const formatRowTime = (iso: string, now = new Date()) => {
  const date = new Date(iso)

  if (Number.isNaN(date.getTime())) return ""
  if (sameDay(date, now)) return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  if (sameDay(date, new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) return "Yesterday"

  const day = `${date.getDate()} ${months[date.getMonth()]}`

  return date.getFullYear() === now.getFullYear() ? day : `${day} ${date.getFullYear()}`
}

export interface StatusPill {
  status: string
  label: string
  count: number
}

/** One pill per status that has conversations, in lifecycle order. Unknown statuses go last. */
export const statusPills = (counts: Record<string, number> | undefined): StatusPill[] =>
  Object.entries(counts ?? {})
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({ status, label: statusLabel(status), count }))
    .sort((a, b) => statusOrder(a.status) - statusOrder(b.status))

/** Adds or removes a status from the selection, keeping lifecycle order so the query string is stable. */
export const toggleStatus = (selected: readonly string[], status: string) => {
  const next = selected.includes(status) ? selected.filter(item => item !== status) : [...selected, status]

  return next.sort((a, b) => statusOrder(a) - statusOrder(b))
}

export interface ConversationQuery {
  status?: string[]
  q?: string
  cursor?: string
  limit?: number
}

/** Query params for `GET /admin/conversations`: empty values are left out and `status` stays an array (repeated key). */
export const buildListQuery = (params: ConversationListParams): ConversationQuery => {
  const q = (params.q ?? "").trim().slice(0, searchMaxLength)
  const status = (params.status ?? []).filter(item => (requestStatuses as readonly string[]).includes(item))

  return {
    ...(status.length ? { status } : {}),
    ...(q ? { q } : {}),
    ...(params.cursor ? { cursor: params.cursor } : {}),
    ...(params.limit ? { limit: Math.min(Math.max(Math.trunc(params.limit), 1), 50) } : {}),
  }
}

/** The query string the server sees, for tests and debugging: `status=a&status=b&q=roof`. */
export const queryString = (query: ConversationQuery) => {
  const search = new URLSearchParams()

  for (const status of query.status ?? []) search.append("status", status)
  if (query.q) search.set("q", query.q)
  if (query.cursor) search.set("cursor", query.cursor)
  if (query.limit) search.set("limit", String(query.limit))

  return search.toString()
}

export interface TextSegment {
  text: string
  match: boolean
}

/** Splits text around case-insensitive matches of the search, so the matches can be highlighted. */
export const highlightSegments = (text: string, search: string): TextSegment[] => {
  const needle = search.trim().toLowerCase()

  if (!needle || !text) return [{ text, match: false }]

  const haystack = text.toLowerCase()
  const segments: TextSegment[] = []
  let from = 0

  while (from < text.length) {
    const at = haystack.indexOf(needle, from)

    if (at === -1) break
    if (at > from) segments.push({ text: text.slice(from, at), match: false })
    segments.push({ text: text.slice(at, at + needle.length), match: true })
    from = at + needle.length
  }
  if (from < text.length) segments.push({ text: text.slice(from), match: false })

  return segments.length ? segments : [{ text, match: false }]
}

/**
 * Merges a freshly fetched first page into the rows already loaded. Fresh rows come first, in the server's order, and
 * replace the old copy; rows that were loaded further down (later pages) keep their place after them.
 */
export const mergeFirstPage = (existing: ConversationItem[], fresh: ConversationItem[]) => {
  const freshIds = new Set(fresh.map(item => item.requestId))

  return [...fresh, ...existing.filter(item => !freshIds.has(item.requestId))]
}

/** Server `CURRENT_ASSIGNMENTS`: the provider is on the request while the latest assignment is in one of these. */
const currentAssignmentStatuses = new Set(["offered", "pending_approval", "accepted", "completed"])

/**
 * The provider currently on the request: the latest assignment, when its status is a current one. Staff views list
 * every assignment (without provider names), so this only decides whether a provider thread can be written to.
 */
export const currentAssignment = (
  assignment: AssignmentView | AssignmentView[] | null | undefined,
): AssignmentView | null => {
  const list = Array.isArray(assignment) ? assignment : assignment ? [assignment] : []
  const [latest] = list
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (Date.parse(b.item.offeredAt ?? "") || 0) - (Date.parse(a.item.offeredAt ?? "") || 0) || a.index - b.index)
    .map(({ item }) => item)

  return latest && currentAssignmentStatuses.has(latest.status) ? latest : null
}

/** "3 Nov 2026" for a date or timestamp; an empty string when it cannot be read. */
export const formatDate = (value: string | null | undefined) => {
  const date = value ? new Date(value) : null

  if (!date || Number.isNaN(date.getTime())) return ""

  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
}
