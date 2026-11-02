// Pure view types for the V1 request flow. No Vue or Vuetify imports, so the tsx tests can load them.

export type V1Status = "submitted" | "approved" | "denied" | "cancelled"

/** Who is looking at the data. Staff are admin-role users without the `staff.manage` scope (see `access.ts`). */
export type V1Actor = "customer" | "admin" | "staff" | "provider"

export type V1ContactMethod = "phone" | "whatsapp" | "email"

export interface V1Person {
  id: string
  name: string
}

export interface V1Attachment {
  id: string
  name: string
  size: number
  type: string
}

/** The terms the admin agrees in the Approve dialog. Money is kobo. */
export interface ApprovalTerms {
  providerId: string
  providerName: string
  priceKobo: number
  /** Agreed start date, `YYYY-MM-DD`. Informational only. */
  date: string
}

export interface V1Decision {
  status: V1Status
  /** Denial reason; shown to the customer. */
  reason?: string
  by?: V1Person
  at?: string
  terms?: ApprovalTerms
}

/** The provider currently on an approved request. */
export interface V1ProviderAssignment {
  providerId: string
  providerName: string
  assignedBy: string
  assignedAt: string
}

export type V1ActivityKind =
  "submitted" | "assigned" | "reassigned" | "approved" | "denied" | "cancelled" | "provider_replaced"

export interface V1ActivityEntry {
  id: string
  kind: V1ActivityKind
  /** Display text, e.g. "Amara Okafor assigned Kemi Adebayo". */
  text: string
  by: string
  at: string
  note?: string
}

export interface V1Request {
  /** Public request id, e.g. `XPR-00101`. */
  id: string
  /** Bumped by every command. Sent back as `If-Match`; a stale value is a 409. */
  version: number
  service: string
  title: string
  description: string
  location: string
  address: string
  phone: string
  contactMethod: V1ContactMethod
  /** The customer's stated budget; 0 when none was given. */
  budgetKobo: number
  /** `YYYY-MM-DD`, or an empty string. */
  preferredDate: string
  attachments: V1Attachment[]
  status: V1Status
  customer: V1Person & { email: string; phone: string }
  assignee: V1Person | null
  createdAt: string
  decision: V1Decision
  cancelledAt?: string
  cancelledBy?: V1Person
  provider: V1ProviderAssignment | null
  /** Staff and admin only; empty for customers. */
  activity: V1ActivityEntry[]
}

export interface V1Counter {
  id: string
  amountKobo: number
  /** Proposed start date, `YYYY-MM-DD`. */
  date?: string | null
  note: string
  /** Id of the counter card that replaced this one. */
  supersededBy?: string | null
  acceptedAt?: string | null
}

export type V1MessageKind = "text" | "counter"

export interface V1Message {
  id: string
  requestId: string
  kind: V1MessageKind
  authorId: string
  authorRole: V1Actor
  authorLabel: string
  text: string
  attachments: V1Attachment[]
  createdAt: string
  counter?: V1Counter
}

export interface V1Staff {
  id: string
  name: string
  email: string
  openRequests: number
  roles?: string[]
}

export interface ProviderCandidate {
  id: string
  name: string
  trade: string
  services: string[]
  areas: string[]
  verified: boolean
  available: boolean
  /** Higher is a better fit for the request's service and area. */
  score: number
  /** Why it fits, e.g. "Serves Ikeja". */
  reasons: string[]
}

/** A row of the admin or customer Messages inbox: one customer conversation per request. */
export interface V1Conversation {
  requestId: string
  title: string
  status: V1Status
  customer: V1Person
  assignee: V1Person | null
  lastMessage: {
    kind: V1MessageKind
    authorRole: V1Actor
    authorLabel: string
    text: string
    at: string
  } | null
  /** Customer messages after the latest Xpro message. */
  waitingForXpro: number
}

/** What a provider sees under My jobs. There is deliberately no price here (assumption A3). */
export interface V1Job {
  id: string
  title: string
  service: string
  description: string
  location: string
  address: string
  /** `YYYY-MM-DD`; the agreed date, informational. */
  date: string
  assignedAt: string
  customer: { name: string; phone: string; contactMethod: V1ContactMethod }
  attachments: V1Attachment[]
}

export interface V1FormOptions {
  services: Array<{ id: string; name: string }>
  locations: Array<{ id: string; name: string }>
}

export interface V1RequestPage {
  items: V1Request[]
  total: number
  page: number
  itemsPerPage: number
}

export interface V1RequestFilters {
  status?: V1Status | ""
  /** Staff id, `unassigned`, or `assigned`. Admin only. */
  assignee?: string
  service?: string
  q?: string
  page?: number
  itemsPerPage?: number
}

export interface V1CreateRequestBody {
  service: string
  title: string
  description: string
  location: string
  address: string
  phone: string
  contactMethod: V1ContactMethod
  budgetKobo: number
  preferredDate: string
  attachments: V1Attachment[]
}

export interface V1MessageBody {
  kind: V1MessageKind
  text: string
  attachments: V1Attachment[]
  counter?: { amountKobo: number; date?: string | null; note: string }
}

export interface V1Counts {
  submitted: number
  approved: number
  denied: number
  cancelled?: number
  /** Admin: submitted and not yet assigned. */
  unassigned?: number
  /** Admin: submitted and assigned to staff. */
  assigned?: number
}
