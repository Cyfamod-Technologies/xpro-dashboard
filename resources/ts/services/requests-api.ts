import { $api, ApiError, toApiError } from "@/utils/api"
import type { ApiEnvelope } from "@/types/domain"
import type {
  ApprovalQueueView,
  ContributionView,
  EarningsView,
  LocationView,
  NotificationInboxView,
  PaginatedResult,
  PaymentView,
  PayoutView,
  ProgressUpdateView,
  QuoteItemView,
  QuoteView,
  RankingRunView,
  RefundView,
  RequestActivityView,
  RequestMessageView,
  RequestPaymentsView,
  RequestSummary,
  RequestView,
  ServiceView,
  SettingView,
  UploadView,
} from "@/features/requests/api-types"

type HttpMethod = "POST" | "PUT" | "PATCH" | "DELETE"

export class RequestsApiError extends ApiError {
  constructor(message: string, options: { code?: string; details?: unknown; status?: number } = {}) {
    super(message, options)
    this.name = "RequestsApiError"
  }
}

const randomKey = () => globalThis.crypto.randomUUID()
const pathId = (value: string) => encodeURIComponent(value)

const unwrap = async <T>(request: Promise<ApiEnvelope<T>>): Promise<T> => {
  try {
    return (await request).data
  } catch (error: unknown) {
    const normalized = toApiError(error)
    throw new RequestsApiError(normalized.message, {
      code: normalized.code,
      details: normalized.details,
      status: normalized.status,
    })
  }
}

const command = <T>(path: string, method: HttpMethod, body?: unknown, version?: number, idempotencyKey = randomKey()) => {
  const headers = new Headers()
  if (version !== undefined) headers.set("If-Match", `W/\"${version}\"`)
  headers.set("Idempotency-Key", idempotencyKey)

  return unwrap($api<ApiEnvelope<T>>(path, { method, body: body as Record<string, unknown> | undefined, headers }))
}

export interface RequestListParams {
  status?: string
  stage?: string
  service?: string
  q?: string
  owner?: "all" | "mine" | "unclaimed" | string
  nextActor?: "me"
  page?: number
  itemsPerPage?: number
  sort?: string
}

export const requestsApi = {
  list: (params: RequestListParams = {}) =>
    unwrap($api<ApiEnvelope<PaginatedResult<RequestSummary>>>("/requests", { query: params })),
  get: (id: string) => unwrap($api<ApiEnvelope<RequestView>>(`/requests/${pathId(id)}`)),
  create: (body: { title: string; service: string; cityId: string; districtId: string; address: string; phone: string; contactMethod?: string; description: string; budget?: number | null; startDate?: string | null; details: Record<string, unknown>; attachments: Array<{ id: string }> }, idempotencyKey = randomKey()) =>
    unwrap($api<ApiEnvelope<RequestView & { warning?: string }>>("/requests", { method: "POST", body, headers: { "Idempotency-Key": idempotencyKey } })),
  update: (id: string, body: Record<string, unknown> & { note?: string }, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}`, "PUT", body, version),
  clarify: (id: string, question: string, version: number) => command<RequestView>(`/requests/${pathId(id)}/clarify`, "POST", { question }, version),
  reviewIntake: (id: string, body: { offerBrief: string; shareOnConfirm?: { description: boolean; attachmentIds: string[] }; contactCheck?: boolean }, version: number) => command<RequestView>(`/requests/${pathId(id)}/review`, "POST", body, version),
  rejectIntake: (id: string, reason: string, version: number) => command<RequestView>(`/requests/${pathId(id)}/reject`, "POST", { reason }, version),
  cancel: (id: string, body: { note: string; reasonCode?: string }, version: number) => command<RequestView>(`/requests/${pathId(id)}/cancel`, "POST", body, version),
  withdrawCancellation: (id: string, note: string | undefined, version: number) => command<RequestView>(`/requests/${pathId(id)}/cancellation/withdraw`, "POST", { note }, version),
  decideCancellation: (id: string, body: { approve: boolean; note: string }, version: number) => command<RequestView>(`/requests/${pathId(id)}/cancellation/decide`, "POST", body, version),
  claim: (id: string, version: number) => command<RequestView>(`/requests/${pathId(id)}/claim`, "POST", {}, version),
  releaseOwnership: (id: string, body: { note: string; expectedOwnerId: string }, version: number) => command<RequestView>(`/requests/${pathId(id)}/release`, "POST", body, version),
  handoff: (id: string, body: { toStaffId: string; note: string }, version: number) => command<RequestView>(`/requests/${pathId(id)}/handoff`, "POST", body, version),
  reassign: (id: string, body: { staffId: string; note: string; expectedOwnerId: string }, version: number) => command<RequestView>(`/requests/${pathId(id)}/reassign`, "POST", body, version),
  activity: (id: string, page = 1) => unwrap($api<ApiEnvelope<PaginatedResult<RequestActivityView>>>(`/requests/${pathId(id)}/activity`, { query: { page } })),
  proposeSchedule: (id: string, body: { startAt: string; endAt: string; note?: string }, version: number) => command<RequestView>(`/requests/${pathId(id)}/schedules`, "POST", body, version),
  respondSchedule: (id: string, scheduleId: string, body: { accept: boolean; note?: string }, version: number) => command<RequestView>(`/requests/${pathId(id)}/schedules/${pathId(scheduleId)}/respond`, "POST", body, version),
  requestScheduleChange: (id: string, scheduleId: string, note: string, version: number) => command<RequestView>(`/requests/${pathId(id)}/schedules/${pathId(scheduleId)}/change-requests`, "POST", { note }, version),
  updates: (id: string) => unwrap($api<ApiEnvelope<ProgressUpdateView[]>>(`/requests/${pathId(id)}/updates`)),
  addProgress: (id: string, body: { status: string; note: string; attachments: Array<{ id: string }>; issueId?: string }, version: number, idempotencyKey = randomKey()) => command<RequestView>(`/requests/${pathId(id)}/updates`, "POST", body, version, idempotencyKey),
  reviewProgress: (id: string, updateId: string, body: { approve: boolean; note?: string }, version: number) => command<RequestView>(`/requests/${pathId(id)}/updates/${pathId(updateId)}/review`, "POST", body, version),
  addProgressOnBehalf: (id: string, body: { status: string; note: string; reportedVia: string; attachments: Array<{ id: string }> }, version: number) => command<RequestView>(`/requests/${pathId(id)}/updates/on-behalf`, "POST", body, version),
  hold: (id: string, body: { reason: string; kind: string; customerNote?: string }, version: number) => command<RequestView>(`/requests/${pathId(id)}/hold`, "POST", body, version),
  releaseHold: (id: string, note: string, version: number) => command<RequestView>(`/requests/${pathId(id)}/hold/release`, "POST", { note }, version),
  recordNoShow: (id: string, body: { scheduleId: string; note: string; evidenceIds?: string[] }, version: number) => command<RequestView>(`/requests/${pathId(id)}/noshow`, "POST", body, version),
  decideNoShow: (id: string, noShowId: string, body: { outcome: "confirm" | "dismiss"; note: string; version: number }, version: number) => command<RequestView>(`/requests/${pathId(id)}/noshow/${pathId(noShowId)}/decision`, "POST", body, version),
  correctNoShow: (id: string, noShowId: string, body: { note: string; version: number }, version: number) => command<RequestView>(`/requests/${pathId(id)}/noshow/${pathId(noShowId)}/correction`, "POST", body, version),
  respondCompletion: (id: string, body: { acknowledge: boolean; note?: string; attachments?: Array<{ id: string }> }, version: number) => command<RequestView>(`/requests/${pathId(id)}/completion/respond`, "POST", body, version),
  confirmCompletionOnBehalf: (id: string, note: string, version: number) => command<RequestView>(`/requests/${pathId(id)}/completion/confirm-on-behalf`, "POST", { note }, version),
  createIssue: (id: string, body: { note: string; attachments?: Array<{ id: string }> }, version: number) => command<RequestView>(`/requests/${pathId(id)}/issues`, "POST", body, version),
  acceptIssue: (id: string, issueId: string, note: string | undefined, version: number) => command<RequestView>(`/requests/${pathId(id)}/issues/${pathId(issueId)}/accept`, "POST", { note }, version),
  resolveIssue: (id: string, issueId: string, body: { outcome: "no_rework" | "dispute_decision"; note: string; requireRework?: boolean }, version: number) => command<RequestView>(`/requests/${pathId(id)}/issues/${pathId(issueId)}/resolve`, "POST", body, version),
  escalateIssue: (id: string, issueId: string, note: string, version: number) => command<RequestView>(`/requests/${pathId(id)}/issues/${pathId(issueId)}/escalate`, "POST", { note }, version),
  close: (id: string, note: string | undefined, version: number) => command<RequestView>(`/requests/${pathId(id)}/close`, "POST", { note }, version),
  messages: (id: string, params: { channel?: string; providerId?: string } = {}) => unwrap($api<ApiEnvelope<RequestMessageView[]>>(`/requests/${pathId(id)}/messages`, { query: params })),
  sendMessage: (id: string, body: { channel: "customer" | "provider" | "internal"; text: string; attachments: Array<{ id: string }>; providerId?: string }, version: number) => command<RequestMessageView>(`/requests/${pathId(id)}/messages`, "POST", body, version),
  requestEscalations: (id: string) => unwrap($api<ApiEnvelope<Array<{ id: string; status: string; note: string; createdAt: string }>>>(`/requests/${pathId(id)}/escalations`)),
  escalateRequest: (id: string, body: { to: string; note: string }, version: number) => command<RequestView>(`/requests/${pathId(id)}/escalations`, "POST", body, version),
  resolveEscalation: (id: string, escalationId: string, note: string, version: number) => command<RequestView>(`/requests/${pathId(id)}/escalations/${pathId(escalationId)}/resolve`, "POST", { note }, version),
  services: () => unwrap($api<ApiEnvelope<ServiceView[]>>("/services")),
  locations: (parentId?: string) => unwrap($api<ApiEnvelope<LocationView[]>>("/locations", { query: { parentId } })),
  adminLocations: () => unwrap($api<ApiEnvelope<LocationView[]>>("/admin/locations")),
  createLocation: (body: { kind: "city" | "district"; name: string; parentId?: string; aliases: string[]; active: boolean; sort: number }) => command<LocationView>("/admin/locations", "POST", body),
  updateLocation: (id: string, body: { kind: "city" | "district"; name: string; parentId?: string; aliases: string[]; active: boolean; sort: number }) => command<LocationView>(`/admin/locations/${pathId(id)}`, "PUT", body),
  createUpload: (body: { name: string; size: number; type: string; purpose: string }) => unwrap($api<ApiEnvelope<UploadView>>("/uploads", { method: "POST", body })),
  completeUpload: (id: string) => unwrap($api<ApiEnvelope<{ id: string; name: string; size: number; type: string; status: string }>>(`/uploads/${pathId(id)}/complete`, { method: "POST" })),
  deleteUpload: (id: string) => unwrap($api<ApiEnvelope<{ deleted: boolean }>>(`/uploads/${pathId(id)}`, { method: "DELETE" })),
  fileLink: (id: string) => unwrap($api<ApiEnvelope<{ url: string; expiresInSeconds: number }>>(`/files/${pathId(id)}`)),
  notifications: (params: { unread?: boolean; page?: number; itemsPerPage?: number } = {}) => unwrap($api<ApiEnvelope<NotificationInboxView>>("/notifications", { query: params })),
  markNotificationsRead: (notificationId?: string) => command<{ updated: number }>("/notifications/read", "POST", { notificationId }),
  approvals: (params: { filter?: "can_act" | "mine" | "all" | "overdue"; kind?: string; page?: number } = {}) => unwrap($api<ApiEnvelope<ApprovalQueueView>>("/admin/approvals", { query: params })),
  approvalCounts: () => unwrap($api<ApiEnvelope<Record<string, number>>>("/admin/approvals/counts")),
  settings: () => unwrap($api<ApiEnvelope<SettingView[]>>("/admin/settings")),
  saveSettings: (body: { changes: Array<{ key: string; value: unknown; expectedVersion: number }>; reason: string }) => command<SettingView[]>("/admin/settings", "PATCH", body),
  settingsHistory: (params: { key?: string; page?: number } = {}) => unwrap($api<ApiEnvelope<PaginatedResult<Record<string, unknown>>>>("/admin/settings/history", { query: params })),
  fireDevTimer: (body: { requestRef: string; kind: string }) => command<{ fired: boolean }>("/admin/dev/timers/fire", "POST", body),
  setDispatchMode: (id: string, mode: "auto" | "manual", note: string, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/dispatch/mode`, "PUT", { mode, note }, version),
  rankingRun: (id: string) => command<RankingRunView>(`/requests/${pathId(id)}/dispatch/runs`, "POST"),
  autoAssign: (id: string, body: { resetAttempts?: boolean; note?: string }, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/dispatch/auto`, "POST", body, version),
  offer: (id: string, body: { providerId: string; rankingRunId: string; note?: string; overrideRules?: string[]; overrideNote?: string }, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/assignments`, "POST", body, version),
  respondAssignment: (id: string, assignmentId: string, body: { accept: boolean; note?: string; crewSize?: number }, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/assignments/${pathId(assignmentId)}/respond`, "POST", body, version),
  reviewAssignment: (
    id: string,
    assignmentId: string,
    body: { approve: boolean; note?: string; share?: { description: string; attachmentIds: string[] }; overrideNote?: string },
    version: number,
  ) => command<RequestView>(`/requests/${pathId(id)}/assignments/${pathId(assignmentId)}/review`, "POST", body, version),
  withdrawAssignment: (id: string, assignmentId: string, note: string, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/assignments/${pathId(assignmentId)}/withdraw`, "POST", { note }, version),
  replaceAssignment: (id: string, assignmentId: string, body: { note: string; workStarted?: boolean }, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/assignments/${pathId(assignmentId)}/replace`, "POST", body, version),
  shareDetails: (id: string, body: { attachmentIds?: string[]; fields?: string[]; note?: string }, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/share`, "POST", body, version),
  contributions: (id: string) => unwrap($api<ApiEnvelope<ContributionView[]>>(`/requests/${pathId(id)}/contributions`)),
  contribute: (id: string, body: { items: QuoteItemView[]; note?: string }, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/contributions`, "POST", body, version),
  quotes: (id: string) => unwrap($api<ApiEnvelope<QuoteView[]>>(`/requests/${pathId(id)}/quotes`)),
  createQuote: (id: string, body: { items: QuoteItemView[]; note?: string }, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/quotes`, "POST", body, version),
  updateQuote: (id: string, quoteId: string, body: { revision: number; items: QuoteItemView[]; note?: string }, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/quotes/${pathId(quoteId)}`, "PUT", body, version),
  publishQuote: (
    id: string,
    quoteId: string,
    body: { revision: number; pricingOverrideNote?: string; customerNote?: string },
    version: number,
  ) => command<RequestView>(`/requests/${pathId(id)}/quotes/${pathId(quoteId)}/publish`, "POST", body, version),
  approveQuote: (id: string, quoteId: string, body: { revision: number; selfApprovalReason?: string }, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/quotes/${pathId(quoteId)}/approve`, "POST", body, version),
  returnQuote: (id: string, quoteId: string, body: { revision: number; note: string }, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/quotes/${pathId(quoteId)}/return`, "POST", body, version),
  respondQuote: (
    id: string,
    quoteId: string,
    body: { decision: "accepted" | "revision_requested" | "declined"; note?: string },
    version: number,
  ) => command<RequestView>(`/requests/${pathId(id)}/quotes/${pathId(quoteId)}/respond`, "POST", body, version),
  setQuotePayout: (id: string, quoteId: string, payoutAmount: number, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/quotes/${pathId(quoteId)}/payout`, "PUT", { payoutAmount }, version),
  payments: (id: string) => unwrap($api<ApiEnvelope<RequestPaymentsView>>(`/requests/${pathId(id)}/payments`)),
  initiatePayment: (id: string, idemKey = randomKey()) =>
    unwrap($api<ApiEnvelope<{ paymentId: string; authorizationUrl: string; reference: string }>>(
      `/requests/${pathId(id)}/payments`,
      { method: "POST", body: { method: "paystack" }, headers: { "Idempotency-Key": idemKey } },
    )),
  recordOfflinePayment: (id: string, body: { amount: number; channel: string; reference: string; paidAt: string; proofFileId: string; note?: string }) =>
    command<PaymentView>(`/admin/requests/${pathId(id)}/payments/offline`, "POST", body),
  reconcilePayment: (id: string, note: string) => command<PaymentView>(`/admin/payments/${pathId(id)}/reconcile`, "POST", { note }),
  rejectPayment: (id: string, reason: string) => command<PaymentView>(`/admin/payments/${pathId(id)}/reject`, "POST", { reason }),
  refunds: (params: { status?: string; page?: number } = {}) => unwrap($api<ApiEnvelope<PaginatedResult<RefundView>>>("/admin/refunds", { query: params })),
  payouts: (params: { status?: string; page?: number } = {}) => unwrap($api<ApiEnvelope<PaginatedResult<PayoutView>>>("/admin/payouts", { query: params })),
  decideRefund: (id: string, body: { approve: boolean; amount?: number; reason: string }) => command<RefundView>(`/admin/refunds/${pathId(id)}/decide`, "POST", body),
  secondApproveRefund: (id: string, body: { approve: boolean; reason: string }) => command<RefundView>(`/admin/refunds/${pathId(id)}/second-approve`, "POST", body),
  transferRefund: (id: string, body: { reference: string; proofFileId: string; note?: string }) => command<RefundView>(`/admin/refunds/${pathId(id)}/transfer`, "POST", body),
  reconcileRefund: (id: string, note: string) => command<RefundView>(`/admin/refunds/${pathId(id)}/reconcile`, "POST", { note }),
  approvePayout: (id: string, note?: string) => command<PayoutView>(`/admin/payouts/${pathId(id)}/approve`, "POST", { note }),
  secondApprovePayout: (id: string, body: { approve: boolean; note: string }) => command<PayoutView>(`/admin/payouts/${pathId(id)}/second-approve`, "POST", body),
  holdPayout: (id: string, reason: string) => command<PayoutView>(`/admin/payouts/${pathId(id)}/hold`, "POST", { reason }),
  releasePayout: (id: string, reason: string) => command<PayoutView>(`/admin/payouts/${pathId(id)}/release`, "POST", { reason }),
  transferPayout: (id: string, body: { method: "paystack" } | { method: "offline"; reference: string; proofFileId: string }) =>
    command<PayoutView>(`/admin/payouts/${pathId(id)}/transfer`, "POST", body),
  reconcilePayout: (id: string, note: string) => command<PayoutView>(`/admin/payouts/${pathId(id)}/reconcile`, "POST", { note }),
  earnings: () => unwrap($api<ApiEnvelope<EarningsView>>("/providers/me/earnings")),
}
