import { $api } from "@/utils/api"
import type { StaffRole } from "@/features/operations/types"
import type { ApiEnvelope } from "@/types/domain"

export type StaffStatus = "invited" | "active" | "suspended" | "deactivated" | "revoked"
export type StaffGroup = "current" | "former"
export type IdentityCheck = "in_person" | "video_call" | "phone_callback"

export interface NamedRef {
  id: string
  name: string
}

export interface StaffInviteView {
  state: "pending" | "expired"
  sentAt: string
  expiresAt: string
  invitedBy: NamedRef | null
  resendsToday: number
}

export interface StaffMemberView {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  roles: StaffRole[]
  status: StaffStatus
  permissions: string[]
  canOwnRequests: boolean
  permVersion: number
  /** Sent back as `If-Match` on commands. */
  rowVersion: number
  employmentPeriod: number
  lastSignInAt: string | null
  acceptedAt: string | null
  mfaEnrolledAt: string | null
  invitedAt: string | null
  invitedBy: NamedRef | null
  invite: StaffInviteView | null
  suspension: { at: string; by: NamedRef | null; reason: string | null; securityIncident: boolean } | null
  deactivation: { at: string; by: NamedRef | null; reason: string | null } | null
  leave: { from: string; to: string; delegate: NamedRef | null; note: string | null; active: boolean } | null
  workload: { openOwned: number; overdueOwned: number }
  conflictDeclaration: {
    declaredAt?: string
    hasLinkedCustomerAccount?: boolean
    linkedCustomerEmail?: string | null
    statement?: string
  } | null
  policyAcceptance: { version: string; acceptedAt: string } | null
}

export interface StaffPage<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export interface StaffSummary {
  active: number
  invited: number
  invitedExpired: number
  suspended: number
  former: number
  activeSuperAdmins: number
}

export interface StaffOwner {
  id: string
  name: string
  roles: StaffRole[]
  onLeave: boolean
  leaveTo: string | null
  workload: { openOwned: number; overdueOwned: number }
}

export interface StaffHistoryEntry {
  id: string
  action: string
  createdAt: string
  actor: NamedRef | null
  metadata: Record<string, unknown> | null
}

export interface MovedRequest {
  requestId: string
  code: string
  title: string
  to: string | null
  toName: string | null
}

export interface Offboarding {
  sessionsRevoked?: boolean
  ownedRequests: MovedRequest[]
  pendingInvitesSent?: number
}

export interface StaffOffboardingResult {
  member: StaffMemberView
  offboarding: Offboarding
}

/** Where a member's open requests go: one destination for all, or one per request. `"queue"` = unclaimed. */
export interface OwnedRequestsInput {
  all?: string
  items?: Array<{ requestId: string; to: string }>
}

export interface StaffListParams {
  q?: string
  status?: StaffStatus
  group?: StaffGroup
  role?: StaffRole
  page?: number
  limit?: number
}

export interface CommandOptions {
  version?: number
  reauthToken?: string
}

const headersFor = ({ version, reauthToken }: CommandOptions = {}) => {
  const headers: Record<string, string> = {}
  if (version !== undefined) headers["If-Match"] = `"${version}"`
  if (reauthToken) headers["X-Reauth-Token"] = reauthToken

  return headers
}

const base = "/admin/staff"
const path = (id: string, suffix = "") => `${base}/${encodeURIComponent(id)}${suffix}`

export const staffApi = {
  list: (params: StaffListParams = {}) => $api<ApiEnvelope<StaffPage<StaffMemberView>>>(base, { query: params }),
  summary: () => $api<ApiEnvelope<StaffSummary>>(`${base}/summary`),
  get: (id: string) => $api<ApiEnvelope<StaffMemberView>>(path(id)),
  history: (id: string, page = 1) =>
    $api<ApiEnvelope<StaffPage<StaffHistoryEntry>>>(path(id, "/history"), { query: { page, limit: 25 } }),
  owners: (exclude?: string) => $api<ApiEnvelope<StaffOwner[]>>(`${base}/owners`, { query: { exclude } }),

  invite: (
    body: { firstName: string; lastName: string; email: string; roles: StaffRole[] },
    options?: CommandOptions,
  ) => $api<ApiEnvelope<StaffMemberView>>(base, { method: "POST", body, headers: headersFor(options) }),
  resend: (id: string) => $api<ApiEnvelope<StaffMemberView>>(path(id, "/invite/resend"), { method: "POST" }),
  revoke: (id: string, reason: string) =>
    $api<ApiEnvelope<StaffMemberView>>(path(id, "/invite/revoke"), { method: "POST", body: { reason } }),

  changeRoles: (
    id: string,
    body: { roles: StaffRole[]; reason: string; ownedRequests?: OwnedRequestsInput },
    options: CommandOptions,
  ) =>
    $api<ApiEnvelope<StaffOffboardingResult>>(path(id, "/roles"), {
      method: "PUT",
      body,
      headers: headersFor(options),
    }),
  rename: (id: string, body: { firstName: string; lastName: string; reason: string }, options: CommandOptions) =>
    $api<ApiEnvelope<StaffMemberView>>(path(id, "/name"), { method: "PUT", body, headers: headersFor(options) }),
  suspend: (
    id: string,
    body: { reason: string; securityIncident: boolean; ownedRequests?: OwnedRequestsInput },
    options: CommandOptions,
  ) =>
    $api<ApiEnvelope<StaffOffboardingResult>>(path(id, "/suspend"), {
      method: "POST",
      body,
      headers: headersFor(options),
    }),
  reactivate: (id: string, body: { roles: StaffRole[]; reason: string; resetMfa: boolean }, options: CommandOptions) =>
    $api<ApiEnvelope<StaffMemberView>>(path(id, "/reactivate"), {
      method: "POST",
      body,
      headers: headersFor(options),
    }),
  deactivate: (id: string, body: { reason: string; ownedRequests?: OwnedRequestsInput }, options: CommandOptions) =>
    $api<ApiEnvelope<StaffOffboardingResult>>(path(id, "/deactivate"), {
      method: "POST",
      body,
      headers: headersFor(options),
    }),
  resetMfa: (id: string, body: { reason: string; identityCheck: IdentityCheck }, options: CommandOptions) =>
    $api<ApiEnvelope<StaffMemberView>>(path(id, "/mfa/reset"), {
      method: "POST",
      body,
      headers: headersFor(options),
    }),
  setLeave: (
    id: string,
    body: { from: string; to: string; delegateId?: string; note?: string },
    options?: CommandOptions,
  ) => $api<ApiEnvelope<StaffMemberView>>(path(id, "/leave"), { method: "PUT", body, headers: headersFor(options) }),
  clearLeave: (id: string, options?: CommandOptions) =>
    $api<ApiEnvelope<StaffMemberView>>(path(id, "/leave"), { method: "DELETE", headers: headersFor(options) }),
}
