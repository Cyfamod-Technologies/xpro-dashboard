import type { ChatAudience } from "@/features/chat/chat-types"

/** One row of `GET /admin/conversations`: a request that has at least one message the viewer may read. */
export interface ConversationItem {
  /** Public request id, e.g. `XPR-00042`. */
  requestId: string
  title: string
  /** One of the 15 request statuses. Use `status-labels.ts` for wording; `statusLabel` is the stage label. */
  status: string
  /** The staff label for the request's stage (several stages share one status). */
  statusLabel: string
  closed: boolean
  owner: { id: string; name: string } | null
  customer: { name: string }
  provider: { name: string } | null
  lastMessage: {
    audience: ChatAudience
    authorRole: string
    authorLabel: string
    /** One line, cut to about 140 characters. Empty for an attachment-only message. */
    text: string
    at: string
  }
  /** Customer or provider messages after the latest staff message. */
  waitingForXpro: number
}

export interface ConversationListMeta {
  nextCursor: string | null
  /** Conversations per status, in lifecycle order. Statuses with none are left out. */
  statusCounts: Record<string, number>
}

export interface ConversationListResult {
  data: ConversationItem[]
  meta: ConversationListMeta
}

export interface ConversationListParams {
  /** Repeated in the query string: `?status=a&status=b`. */
  status?: string[]
  q?: string
  cursor?: string | null
  limit?: number
}
