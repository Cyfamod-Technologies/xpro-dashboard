import type { FileRefView, RequestMessageView } from "@/features/requests/api-types"

// Pure view types and helpers for the platform chat. No Vue or Vuetify imports, so tests/chat-helpers.mts can run it.

export type ChatAudience = "customer" | "provider" | "internal"
export type ChatViewer = "staff" | "customer" | "provider"
export type ChatMessageState = "sent" | "sending" | "failed"

export interface ChatAttachmentView extends FileRefView {
  /** A file still on this device (message not delivered yet). It cannot be opened from the server. */
  local?: boolean
}

export interface ChatMessage {
  id: string
  /** Set on messages created in this browser before the server confirmed them. */
  localId?: string
  audience: ChatAudience
  providerId: string | null
  text: string
  createdAt: string
  author: { role: string; label: string }
  attachments: ChatAttachmentView[]
  /** True when the viewer's side wrote it, so the bubble sits on the right. */
  ownSide: boolean
  state: ChatMessageState
  /** Why a send failed, when known. */
  error?: string
}

export interface ChatAudienceOption {
  value: ChatAudience
  /** Shown instead of hiding the option, e.g. "No provider on this request yet." */
  disabledReason?: string
}

export interface ChatDayGroup {
  /** Local calendar day, `YYYY-MM-DD`. */
  key: string
  label: string
  messages: ChatMessage[]
}

export interface ChatSendInput {
  audience: ChatAudience
  text: string
  files: File[]
  replyToId?: string | null
}

export const audienceLabels: Record<ChatAudience, string> = {
  customer: "Customer",
  provider: "Provider",
  internal: "Staff note",
}

export const audienceLabel = (audience: ChatAudience) => audienceLabels[audience]

/** The small tag on a staff bubble in the staff view, e.g. "to Customer". Staff notes have their own card instead. */
export const audienceTag = (audience: ChatAudience) =>
  audience === "internal" ? "Staff note" : `to ${audienceLabels[audience]}`

export const audienceHelp: Record<ChatAudience, string> = {
  customer: "Customer sees this as XPro Team",
  provider: "Provider sees this as XPro Dispatch",
  internal: "Staff note, hidden from the customer and provider",
}

export const internalNoteLabel = "Staff note · hidden from customer and provider"

/** XPro is one side: for staff every staff-authored message sits on the right. Customers and providers see only their own on the right. */
export const isOwnSide = (viewer: ChatViewer, authorRole: string) => {
  if (viewer === "customer") return authorRole === "customer"
  if (viewer === "provider") return authorRole === "provider"

  return authorRole !== "customer" && authorRole !== "provider"
}

/** Maps server messages to view messages, oldest first. Equal times keep the server order. */
export const toChatMessages = (raw: RequestMessageView[], viewer: ChatViewer): ChatMessage[] =>
  raw
    .map((message, index) => ({ message, index }))
    .sort((a, b) => Date.parse(a.message.createdAt) - Date.parse(b.message.createdAt) || a.index - b.index)
    .map(({ message }) => ({
      id: message.id,
      audience: message.channel,
      providerId: message.providerId ?? null,
      text: message.text,
      createdAt: message.createdAt,
      author: { role: message.author.role, label: message.author.label },
      attachments: message.attachments.map(file => ({ ...file })),
      ownSide: isOwnSide(viewer, message.author.role),
      state: "sent" as const,
    }))

const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "Today", "Yesterday", otherwise e.g. "Mon 27 Oct" (local time). */
export const dayLabel = (date: Date, now = new Date()) => {
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  const key = dayKey(date)

  if (key === dayKey(now)) return "Today"
  if (key === dayKey(yesterday)) return "Yesterday"

  return `${weekdays[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`
}

/** Splits an ordered timeline into calendar days. */
export const groupByDay = (messages: ChatMessage[], now = new Date()): ChatDayGroup[] => {
  const groups: ChatDayGroup[] = []

  for (const message of messages) {
    const date = new Date(message.createdAt)
    const key = dayKey(date)
    const last = groups[groups.length - 1]

    if (last?.key === key) last.messages.push(message)
    else groups.push({ key, label: dayLabel(date, now), messages: [message] })
  }

  return groups
}

/** True for the first bubble of a run: a new sender, a new audience or a new day. */
export const startsRun = (previous: ChatMessage | undefined, current: ChatMessage) => {
  if (!previous) return true

  return (
    previous.author.role !== current.author.role ||
    previous.author.label !== current.author.label ||
    previous.audience !== current.audience ||
    dayKey(new Date(previous.createdAt)) !== dayKey(new Date(current.createdAt))
  )
}

// Vuetify theme colour names. Customer and provider keep fixed colours in the staff view; staff members share the rest.
const fixedColors: Record<string, string> = { customer: "success", provider: "info" }
const staffPalette = ["primary", "secondary", "warning", "error"]

const hash = (value: string) => {
  let result = 5381

  for (let index = 0; index < value.length; index++) result = ((result << 5) + result + value.charCodeAt(index)) | 0

  return Math.abs(result)
}

/** Key that identifies who wrote a message for colouring: "customer", "provider" or "staff:<label>". */
export const participantKey = (author: { role: string; label: string }) =>
  author.role === "customer" || author.role === "provider" ? author.role : `staff:${author.label}`

/** A stable theme colour name for a participant key. */
export const participantColor = (key: string) => fixedColors[key] ?? staffPalette[hash(key) % staffPalette.length]

export const formatMessageTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
