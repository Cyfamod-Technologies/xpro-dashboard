import { $api, ApiError, toApiError } from "@/utils/api"
import type { ApiEnvelope } from "@/types/domain"
import type {
  ApprovalQueueView,
  ContributionView,
  CreateRequestBody,
  CreateRequestGroupBody,
  CreateRequestGroupResult,
  CustomerRequestLimitView,
  EarningsView,
  EscalationView,
  LocationKind,
  LocationView,
  NotificationInboxView,
  PaginatedResult,
  PaymentView,
  PayoutView,
  PendingRequestView,
  ProgressUpdateView,
  PublicRequestConfigView,
  QuoteItemView,
  QuoteView,
  RankingRunView,
  RefundView,
  RequestActivityView,
  RequestMessageView,
  RequestPaymentsView,
  RequestStage,
  RequestSummary,
  RequestView,
  SaveSettingsResult,
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

// `POST /updates` and `/updates/on-behalf` still take `attachments: string[]` (ids), while Spec 04 §11.6 says
// `[{ id }]`. Callers pass `[{ id }]`; drop this mapping when the server DTO moves to the spec shape (FX-3.9).
const attachmentIds = (attachments: Array<{ id: string }>) => attachments.map(item => item.id)

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

// `If-Match` is optional on every command except `PUT /requests/:id`; the money commands (payments, refunds,
// payouts) take no version at all. `Idempotency-Key` is required on the routes that say so and ignored elsewhere,
// so every command sends one. A 409 `VERSION_CONFLICT` carries the fresh view in `details.current`.
const command = <T>(
  path: string,
  method: HttpMethod,
  body?: unknown,
  version?: number,
  idempotencyKey: string = randomKey(),
  extraHeaders: Record<string, string> = {},
) => {
  const headers = new Headers(extraHeaders)
  if (version !== undefined) headers.set("If-Match", `W/\"${version}\"`)
  headers.set("Idempotency-Key", idempotencyKey)

  return unwrap($api<ApiEnvelope<T>>(path, { method, body: body as Record<string, unknown> | undefined, headers }))
}

export interface RequestListParams {
  status?: string

  /** A group id or `XPG-nnnnn`: only that bundle's requests. */
  group?: string
  stage?: RequestStage
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
  publicConfig: () => unwrap($api<ApiEnvelope<PublicRequestConfigView>>("/request-config")),
  pending: () => unwrap($api<ApiEnvelope<PendingRequestView>>("/requests/pending")),
  get: (id: string) => unwrap($api<ApiEnvelope<RequestView>>(`/requests/${pathId(id)}`)),
  create: (body: CreateRequestBody, idempotencyKey = randomKey()) =>
    unwrap(
      $api<ApiEnvelope<RequestView & { warning?: string }>>("/requests", {
        method: "POST",
        body,
        headers: { "Idempotency-Key": idempotencyKey },
      }),
    ),
  // Several services in one submission (Spec 04 §6.2, §11.2). One key covers the whole submission; all or nothing.
  createGroup: (body: CreateRequestGroupBody, idempotencyKey = randomKey()) =>
    unwrap(
      $api<ApiEnvelope<CreateRequestGroupResult>>("/request-groups", {
        method: "POST",
        body,
        headers: { "Idempotency-Key": idempotencyKey },
      }),
    ),
  update: (id: string, body: Record<string, unknown> & { note?: string }, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}`, "PUT", body, version),
  clarify: (id: string, question: string, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/clarify`, "POST", { question }, version),
  reviewIntake: (
    id: string,
    body: {
      offerBrief: string
      shareOnConfirm?: { description: boolean; attachmentIds: string[] }
      contactCheck?: boolean
    },
    version: number,
  ) => command<RequestView>(`/requests/${pathId(id)}/review`, "POST", body, version),
  rejectIntake: (id: string, reason: string, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/reject`, "POST", { reason }, version),
  // `POST /requests/:id/cancel` is one route that picks by actor and state (Spec 04 §11.2): a customer's free cancel
  // while in intake review, otherwise a pending cancellation request for staff to decide; staff cancel directly.
  cancel: (id: string, note: string, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/cancel`, "POST", { note }, version),
  // Stale: the server has no `/cancellations` route (a customer cancellation request goes through `cancel` above).
  requestCancellation: (id: string, body: { reasonCode: string; note: string }, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/cancellations`, "POST", body, version),
  withdrawCancellation: (id: string, cancellationId: string, note: string | undefined, version: number) =>
    command<RequestView>(
      `/requests/${pathId(id)}/cancellations/${pathId(cancellationId)}/withdraw`,
      "POST",
      { note },
      version,
    ),
  decideCancellation: (id: string, body: { approve: boolean; note?: string }, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/cancellation/decide`, "POST", body, version),
  claim: (id: string, version: number) => command<RequestView>(`/requests/${pathId(id)}/claim`, "POST", {}, version),
  releaseOwnership: (id: string, body: { note: string; expectedOwnerId: string }, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/release`, "POST", body, version),
  handoff: (id: string, body: { toStaffId: string; note: string }, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/handoff`, "POST", body, version),
  reassign: (id: string, body: { staffId: string; note: string; expectedOwnerId: string }, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/reassign`, "POST", body, version),
  activity: (id: string, page = 1) =>
    unwrap(
      $api<ApiEnvelope<PaginatedResult<RequestActivityView>>>(`/requests/${pathId(id)}/activity`, { query: { page } }),
    ),
  proposeSchedule: (id: string, body: { startAt: string; endAt: string; note?: string }, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/schedules`, "POST", body, version),
  respondSchedule: (id: string, scheduleId: string, body: { accept: boolean; note?: string }, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/schedules/${pathId(scheduleId)}/respond`, "POST", body, version),
  requestScheduleChange: (id: string, scheduleId: string, note: string, version: number) =>
    command<RequestView>(
      `/requests/${pathId(id)}/schedules/${pathId(scheduleId)}/change-requests`,
      "POST",
      { note },
      version,
    ),
  updates: (id: string) => unwrap($api<ApiEnvelope<ProgressUpdateView[]>>(`/requests/${pathId(id)}/updates`)),
  addProgress: (
    id: string,
    body: {
      status: "in_progress" | "blocked" | "completion_pending"
      note: string
      attachments: Array<{ id: string }>
      issueId?: string
    },
    version: number,
    idempotencyKey = randomKey(),
  ) =>
    command<RequestView>(
      `/requests/${pathId(id)}/updates`,
      "POST",
      { ...body, attachments: attachmentIds(body.attachments) },
      version,
      idempotencyKey,
    ),
  reviewProgress: (id: string, updateId: string, body: { approve: boolean; note?: string }, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/updates/${pathId(updateId)}/review`, "POST", body, version),
  addProgressOnBehalf: (
    id: string,
    body: {
      status: "in_progress" | "blocked" | "completion_pending"
      note: string
      reportedVia: string
      attachments: Array<{ id: string }>
      issueId?: string
    },
    version: number,
  ) =>
    command<RequestView>(
      `/requests/${pathId(id)}/updates/on-behalf`,
      "POST",
      { ...body, attachments: attachmentIds(body.attachments) },
      version,
    ),
  hold: (id: string, body: { reason: string; kind: string; customerNote?: string }, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/hold`, "POST", body, version),
  releaseHold: (id: string, note: string, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/hold/release`, "POST", { note }, version),
  recordNoShow: (id: string, body: { scheduleId: string; note: string }, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/noshow`, "POST", body, version),
  decideNoShow: (
    id: string,
    noShowId: string,
    body: { outcome: "confirm" | "dismiss"; note: string; version: number },
    version: number,
  ) => command<RequestView>(`/requests/${pathId(id)}/noshow/${pathId(noShowId)}/decision`, "POST", body, version),
  correctNoShow: (id: string, noShowId: string, body: { note: string; version: number }, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/noshow/${pathId(noShowId)}/correction`, "POST", body, version),
  respondCompletion: (id: string, body: { acknowledge: boolean; note?: string }, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/completion/respond`, "POST", body, version),
  confirmCompletionOnBehalf: (id: string, note: string, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/completion/confirm-on-behalf`, "POST", { note }, version),
  createIssue: (id: string, body: { note: string }, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/issues`, "POST", body, version),
  acceptIssue: (id: string, issueId: string, note: string | undefined, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/issues/${pathId(issueId)}/accept`, "POST", { note }, version),
  resolveIssue: (
    id: string,
    issueId: string,
    body: { outcome: "no_rework" | "dispute_decision"; note: string; requireRework?: boolean },
    version: number,
  ) => command<RequestView>(`/requests/${pathId(id)}/issues/${pathId(issueId)}/resolve`, "POST", body, version),
  escalateIssue: (id: string, issueId: string, note: string, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/issues/${pathId(issueId)}/escalate`, "POST", { note }, version),
  close: (id: string, note: string | undefined, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/close`, "POST", { note }, version),
  messages: (id: string, params: { channel?: string; providerId?: string } = {}) =>
    unwrap($api<ApiEnvelope<RequestMessageView[]>>(`/requests/${pathId(id)}/messages`, { query: params })),
  sendMessage: (
    id: string,
    body: {
      channel: "customer" | "provider" | "internal"
      text: string
      attachments: Array<{ id: string }>
      providerId?: string
    },
    version?: number,
    idempotencyKey?: string,
  ) => command<RequestView>(`/requests/${pathId(id)}/messages`, "POST", body, version, idempotencyKey),
  requestEscalations: (id: string) =>
    unwrap($api<ApiEnvelope<EscalationView[]>>(`/requests/${pathId(id)}/escalations`)),
  // Spec 04 §11 and plan §E name the body field `to`; the server DTO (`RaiseEscalationDto`) takes `target`.
  escalateRequest: (id: string, body: { target: "operations" | "super_admin"; note: string }, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/escalations`, "POST", body, version),
  resolveEscalation: (id: string, escalationId: string, note: string, version: number) =>
    command<RequestView>(
      `/requests/${pathId(id)}/escalations/${pathId(escalationId)}/resolve`,
      "POST",
      { note },
      version,
    ),
  // States when `parentId` is omitted. `serviceable` limits the list to places XPro serves.
  locations: (parentId?: string, opts?: { serviceable?: boolean }) =>
    unwrap(
      $api<ApiEnvelope<LocationView[]>>("/locations", {
        query: { parentId, serviceable: opts?.serviceable ? "true" : undefined },
      }),
    ),
  adminLocations: (parentId?: string) =>
    unwrap($api<ApiEnvelope<LocationView[]>>("/admin/locations", { query: { parentId } })),
  createLocation: (body: {
    kind: LocationKind
    name: string
    parentId?: string
    aliases: string[]
    active: boolean
    serviceable: boolean
    sort: number
  }) => command<LocationView>("/admin/locations", "POST", body),
  updateLocation: (
    id: string,
    body: {
      kind: LocationKind
      name: string
      parentId?: string
      aliases: string[]
      active: boolean
      serviceable: boolean
      sort: number
    },
  ) => command<LocationView>(`/admin/locations/${pathId(id)}`, "PUT", body),
  createUpload: (body: { name: string; size: number; type: string; purpose: string }) =>
    unwrap($api<ApiEnvelope<UploadView>>("/uploads", { method: "POST", body })),
  completeUpload: (id: string) =>
    unwrap(
      $api<ApiEnvelope<{ id: string; name: string; size: number; type: string; status: string }>>(
        `/uploads/${pathId(id)}/complete`,
        { method: "POST" },
      ),
    ),
  deleteUpload: (id: string) =>
    unwrap($api<ApiEnvelope<{ deleted: boolean }>>(`/uploads/${pathId(id)}`, { method: "DELETE" })),
  fileLink: (id: string) =>
    unwrap($api<ApiEnvelope<{ url: string; expiresInSeconds: number }>>(`/files/${pathId(id)}`)),
  notifications: (params: { unread?: boolean; page?: number; itemsPerPage?: number } = {}) =>
    unwrap($api<ApiEnvelope<NotificationInboxView>>("/notifications", { query: params })),
  markNotificationsRead: (notificationId?: string) =>
    command<{ updated: number }>("/notifications/read", "POST", { notificationId }),
  approvals: (params: { filter?: "can_act" | "mine" | "all" | "overdue"; kind?: string; page?: number } = {}) =>
    unwrap($api<ApiEnvelope<ApprovalQueueView>>("/admin/approvals", { query: params })),
  approvalCounts: () => unwrap($api<ApiEnvelope<{ open: number; overdue: number }>>("/admin/approvals/counts")),
  // Staff with `account.limit` (Spec 04 §11.2, MS-7). `limit: null` returns the customer to the platform default.
  setCustomerRequestLimit: (userId: string, body: { limit: number | null; note: string }) =>
    command<CustomerRequestLimitView>(`/admin/customers/${pathId(userId)}/request-limit`, "PUT", body),
  settings: () => unwrap($api<ApiEnvelope<SettingView[]>>("/admin/settings")),
  // High-risk keys need `reauthToken` (from `POST /auth/reauthenticate`), sent as `X-Reauth-Token`.
  saveSettings: (
    body: { changes: Array<{ key: string; value: unknown; expectedVersion: number }>; reason: string },
    reauthToken?: string,
  ) =>
    command<SaveSettingsResult>(
      "/admin/settings",
      "PATCH",
      body,
      undefined,
      randomKey(),
      reauthToken ? { "X-Reauth-Token": reauthToken } : {},
    ),
  settingsHistory: (params: { key?: string; page?: number } = {}) =>
    unwrap($api<ApiEnvelope<PaginatedResult<Record<string, unknown>>>>("/admin/settings/history", { query: params })),
  fireDevTimer: (body: { requestRef: string; kind: string }) =>
    command<{ fired: number }>("/admin/dev/timers/fire", "POST", body),
  setDispatchMode: (id: string, mode: "auto" | "manual", note: string, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/dispatch/mode`, "PUT", { mode, note }, version),
  rankingRun: (id: string) => command<RankingRunView>(`/requests/${pathId(id)}/dispatch/runs`, "POST"),
  autoAssign: (id: string, body: { resetAttempts?: boolean; note?: string }, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/dispatch/auto`, "POST", body, version),
  offer: (
    id: string,
    body: { providerId: string; rankingRunId: string; note?: string; overrideNote?: string },
    version: number,
  ) => command<RequestView>(`/requests/${pathId(id)}/assignments`, "POST", body, version),
  respondAssignment: (
    id: string,
    assignmentId: string,
    body: { accept: boolean; note?: string; crewSize?: number },
    version: number,
  ) =>
    command<RequestView>(`/requests/${pathId(id)}/assignments/${pathId(assignmentId)}/respond`, "POST", body, version),
  reviewAssignment: (
    id: string,
    assignmentId: string,
    body: {
      approve: boolean
      note?: string
      share?: { description: boolean; attachmentIds: string[] }
      overrideNote?: string
    },
    version: number,
  ) =>
    command<RequestView>(`/requests/${pathId(id)}/assignments/${pathId(assignmentId)}/review`, "POST", body, version),
  withdrawAssignment: (id: string, assignmentId: string, note: string, version: number) =>
    command<RequestView>(
      `/requests/${pathId(id)}/assignments/${pathId(assignmentId)}/withdraw`,
      "POST",
      { note },
      version,
    ),
  replaceAssignment: (
    id: string,
    assignmentId: string,
    body: { note: string; workStarted?: boolean },
    version: number,
  ) =>
    command<RequestView>(`/requests/${pathId(id)}/assignments/${pathId(assignmentId)}/replace`, "POST", body, version),
  shareDetails: (id: string, body: { attachmentIds?: string[]; fields?: string[]; note?: string }, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/share`, "POST", body, version),
  contributions: (id: string) => unwrap($api<ApiEnvelope<ContributionView[]>>(`/requests/${pathId(id)}/contributions`)),
  contribute: (id: string, body: { items: QuoteItemView[]; note?: string }, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/contributions`, "POST", body, version),
  quotes: (id: string) => unwrap($api<ApiEnvelope<QuoteView[]>>(`/requests/${pathId(id)}/quotes`)),
  createQuote: (id: string, body: { items: QuoteItemView[]; note?: string }, version: number) =>
    command<RequestView>(`/requests/${pathId(id)}/quotes`, "POST", body, version),
  updateQuote: (
    id: string,
    quoteId: string,
    body: { revision: number; items: QuoteItemView[]; note?: string },
    version: number,
  ) => command<RequestView>(`/requests/${pathId(id)}/quotes/${pathId(quoteId)}`, "PUT", body, version),
  publishQuote: (
    id: string,
    quoteId: string,
    body: { revision: number; pricingOverrideNote?: string; customerNote?: string },
    version: number,
  ) => command<RequestView>(`/requests/${pathId(id)}/quotes/${pathId(quoteId)}/publish`, "POST", body, version),
  approveQuote: (
    id: string,
    quoteId: string,
    body: { revision: number; selfApprovalReason?: string },
    version: number,
  ) => command<RequestView>(`/requests/${pathId(id)}/quotes/${pathId(quoteId)}/approve`, "POST", body, version),
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
    unwrap(
      $api<ApiEnvelope<{ paymentId: string; authorizationUrl: string; reference: string }>>(
        `/requests/${pathId(id)}/payments`,
        { method: "POST", body: { method: "paystack" }, headers: { "Idempotency-Key": idemKey } },
      ),
    ),
  recordOfflinePayment: (
    id: string,
    body: { amount: number; channel: string; reference: string; paidAt: string; proofFileId: string; note?: string },
  ) => command<PaymentView>(`/admin/requests/${pathId(id)}/payments/offline`, "POST", body),
  reconcilePayment: (id: string, note: string) =>
    command<PaymentView>(`/admin/payments/${pathId(id)}/reconcile`, "POST", { note }),
  rejectPayment: (id: string, reason: string) =>
    command<PaymentView>(`/admin/payments/${pathId(id)}/reject`, "POST", { reason }),
  refunds: (params: { status?: string; page?: number } = {}) =>
    unwrap($api<ApiEnvelope<PaginatedResult<RefundView>>>("/admin/refunds", { query: params })),
  payouts: (params: { status?: string; page?: number } = {}) =>
    unwrap($api<ApiEnvelope<PaginatedResult<PayoutView>>>("/admin/payouts", { query: params })),
  decideRefund: (id: string, body: { approve: boolean; amount?: number; reason: string }) =>
    command<RefundView>(`/admin/refunds/${pathId(id)}/decide`, "POST", body),
  secondApproveRefund: (id: string, body: { approve: boolean; reason: string }) =>
    command<RefundView>(`/admin/refunds/${pathId(id)}/second-approve`, "POST", body),
  transferRefund: (id: string, body: { reference: string; proofFileId: string; note?: string }) =>
    command<RefundView>(`/admin/refunds/${pathId(id)}/transfer`, "POST", body),
  reconcileRefund: (id: string, note: string) =>
    command<RefundView>(`/admin/refunds/${pathId(id)}/reconcile`, "POST", { note }),
  retryRefund: (id: string) => command<RefundView>(`/admin/refunds/${pathId(id)}/retry`, "POST"),
  // Finance asks for a refund of a settled payment; leaving `amount` out asks for the whole refundable balance (kobo).
  requestRefund: (paymentId: string, body: { amount?: number; reason: string }) =>
    command<RefundView>(`/admin/payments/${pathId(paymentId)}/refunds`, "POST", body),
  approvePayout: (id: string, note?: string) =>
    command<PayoutView>(`/admin/payouts/${pathId(id)}/approve`, "POST", { note }),
  secondApprovePayout: (id: string, body: { approve: boolean; note: string }) =>
    command<PayoutView>(`/admin/payouts/${pathId(id)}/second-approve`, "POST", body),
  holdPayout: (id: string, reason: string) =>
    command<PayoutView>(`/admin/payouts/${pathId(id)}/hold`, "POST", { reason }),
  releasePayout: (id: string, reason: string) =>
    command<PayoutView>(`/admin/payouts/${pathId(id)}/release`, "POST", { reason }),
  // `Idempotency-Key` is required on transfer and retry; pass the same key when repeating one attempt.
  transferPayout: (
    id: string,
    body: { method: "paystack" } | { method: "offline"; reference: string; proofFileId: string },
    idempotencyKey = randomKey(),
  ) => command<PayoutView>(`/admin/payouts/${pathId(id)}/transfer`, "POST", body, undefined, idempotencyKey),
  retryPayout: (id: string, idempotencyKey = randomKey()) =>
    command<PayoutView>(`/admin/payouts/${pathId(id)}/retry`, "POST", undefined, undefined, idempotencyKey),
  reconcilePayout: (id: string, note: string) =>
    command<PayoutView>(`/admin/payouts/${pathId(id)}/reconcile`, "POST", { note }),
  earnings: (page = 1) => unwrap($api<ApiEnvelope<EarningsView>>("/providers/me/earnings", { query: { page } })),
}
