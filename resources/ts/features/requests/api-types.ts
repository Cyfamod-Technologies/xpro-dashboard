export type RequestAction =
  | "dispatch.setMode"
  | "dispatch.runs"
  | "dispatch.cascade"
  | "assignment.auto"
  | "assignment.offer"
  | "assignment.respond"
  | "assignment.review"
  | "assignment.withdraw"
  | "assignment.replace"
  | "request.shareDetails"
  | "quote.contribute"
  | "quote.save"
  | "quote.publish"
  | "quote.approve"
  | "quote.return"
  | "quote.respond"
  | "quote.setPayout"
  | "payment.initiate"
  | "payment.recordOffline"
  | "payment.reconcile"
  | "payment.rejectOffline"
  | "refund.decide"
  | "refund.secondApprove"
  | "refund.recordTransfer"
  | "refund.reconcile"
  | "payout.approve"
  | "payout.secondApprove"
  | "payout.hold"
  | "payout.release"
  | "payout.transfer"
  | "payout.reconcile"
  | "schedule.propose"
  | "schedule.respond"
  | "schedule.requestChange"
  | "progress.add"
  | "progress.review"
  | "progress.addOnBehalf"
  | "request.hold"
  | "request.releaseHold"
  | "noshow.record"
  | "noshow.confirm"
  | "noshow.dismiss"
  | "noshow.correct"
  | "completion.respond"
  | "completion.confirmOnBehalf"
  | "issue.raise"
  | "issue.accept"
  | "issue.resolve"
  | "issue.escalate"
  | "request.close"
  | "cancellation.request"
  | "cancellation.withdraw"
  | "cancellation.decide"
  | "request.cancel"
  | "message.send"
  | "notification.read"
  | "settings.save"
  | "request.escalate"
  | "request.escalation.resolve"
  | "request.update"
  | "request.clarify"
  | "request.review"
  | "request.reject"
  | "request.claim"
  | "request.release"
  | "request.handoff"
  | "request.reassign"
  | string

export const REQUEST_STAGES = [
  "intake_review",
  "awaiting_clarification",
  "dispatching",
  "offer_out",
  "acceptance_review",
  "replacing_provider",
  "pricing",
  "quote_approval",
  "quote_revision",
  "quote_expired",
  "payment_lapsed",
  "quote_with_customer",
  "awaiting_payment",
  "set_payout",
  "scheduling",
  "schedule_proposed",
  "schedule_changes",
  "scheduled",
  "reschedule",
  "in_progress",
  "rework",
  "blocked_provider",
  "on_hold",
  "issue_open",
  "dispute",
  "awaiting_customer_confirmation",
  "defects_window",
  "ready_to_close",
  "closed",
  "refund_pending",
  "cancelled",
  "rejected",
] as const

export type RequestStage = (typeof REQUEST_STAGES)[number] | string

/** Raw for staff (`staff:<permission>`, `system`); `customer`, `provider`, `xpro` or `none` for everyone else. */
export type NextActor = "customer" | "provider" | "xpro" | "none" | "system" | `staff:${string}` | string

/** A step on the path a customer picked, top-level service first. `null` on requests made before the catalog. */
export interface ServicePathItem {
  id: string
  name: string
}

/** A snapshot of one question and the customer's answer, as they were when the request was made. */
export interface RequestAnswerView {
  questionId: string
  serviceId: string
  serviceName: string
  key: string
  label: string
  type: string
  value: string | number | string[]
  display: string
  sensitive: boolean
  dateRole: "start" | "end" | null
}

export interface RequestSummary {
  id: string
  version: number
  status: string
  stage: RequestStage
  statusLabel: string | null
  nextActor: NextActor
  allowedActions: RequestAction[]
  title?: string
  service?: string
  servicePath?: ServicePathItem[] | null
  cityName?: string | null
  districtName?: string | null
  createdAt?: string
  updatedAt?: string
  /** Staff only. */
  dispatch?: DispatchView
  quote?: QuoteView | null
  assignment?: AssignmentView | AssignmentView[] | null
}

export interface RequestView extends RequestSummary {
  overlays?: { cancellation: string | null; flag: string | null; suspendedParties: string[] }
  description?: string
  address?: string
  phone?: string
  contactMethod?: string
  contactInBrief?: boolean
  /** Kobo. `null` for staff without `view.pricing`. */
  budget?: number | null
  startDate?: string | null
  effectiveStartDate?: string | null
  effectiveEndDate?: string | null
  details?: Record<string, unknown>

  /** May be empty for legacy requests; then `details` is all there is. */
  answers?: RequestAnswerView[]
  customerName?: string
  ownerId?: string
  staffOwnerId?: string | null
  intake?: { state: string; clarificationCount: number }
  attachments?: RequestAttachmentView[]
  provider?: { businessName: string; trade: string; verified: boolean } | null
  /** Staff and the assigned provider only; see `ContributionView` for the per-role fields. */
  contributions?: ContributionView[]
  schedules?: ScheduleView[]
  schedule?: ScheduleView | null
  issues?: RequestIssueView[]
  cancellations?: CancellationView[]
  /** Staff only. */
  noShows?: NoShowView[]
  completion?: CompletionView | null
  createdAt?: string
  updatedAt?: string
}

export interface ScheduleView {
  id?: string
  startAt: string
  endAt: string
  status: "proposed" | "confirmed" | "changes_requested" | "cancelled" | "superseded" | string
  note?: string | null
  customer?: "pending" | "accepted" | "changes_requested"
  provider?: "pending" | "accepted" | "changes_requested"
  confirmedAt?: string | null
}

/** A file attached to a progress update or a message (`GET /updates`, `GET /messages`). */
export interface FileRefView {
  id: string
  name: string
  type: string
  size: number
}

/** `GET /requests/:id/updates`. `kind` is the update type; `target` is the status it asks for. */
export interface ProgressUpdateView {
  id: string
  kind: string
  target: "in_progress" | "blocked" | "completion_pending" | string
  note: string
  state: "pending" | "approved" | "rejected"
  /** Hidden from customers and providers while the update is pending. */
  reviewNote: string | null
  attachments: FileRefView[]
  createdAt: string
}

export interface RequestIssueView {
  id: string
  status: string
  note: string
  outcome?: string | null
  createdAt: string
}

export interface CancellationView {
  id: string
  status: string
  reasonCode?: string | null
  note?: string | null
  /** The server does not populate this yet; it is always `null`. */
  refundStatus?: string | null
  createdAt: string
}

export interface NoShowView {
  id: string
  /** Row version the decision and correction bodies require. The server projection does not send it yet. */
  version?: number
  scheduleId: string
  status: "open" | "confirmed" | "dismissed" | "voided" | string
  note: string
  createdAt: string
}

export interface CompletionView {
  reportedAt?: string | null
  confirmationDueAt?: string | null
  acknowledgedAt?: string | null
  defectsWindowEndsAt?: string | null
}

export interface RequestMessageView {
  id: string
  channel: "customer" | "provider" | "internal"
  providerId?: string | null
  text: string
  createdAt: string
  /** `label` is already rendered for the viewer (for example "XPro" or "Customer"). */
  author: { role: string; label: string }
  attachments: FileRefView[]
}

/** `GET /requests/:id/activity` (staff only). */
export interface RequestActivityView {
  id: string
  action: string
  actorType: string
  actorId: string | null
  at: string
  metadata?: Record<string, unknown>
}

/** `GET /requests/:id/escalations` (staff with `request.escalation.resolve`). */
export interface EscalationView {
  id: string
  target: "operations" | "super_admin"
  source: string
  note: string
  raisedBy: string | null
  raisedAt: string
  resolvedBy: string | null
  resolvedAt: string | null
  resolution: string | null
}

export interface UploadView {
  id: string
  uploadUrl: string
  method: "PUT"
  headers: Record<string, string>
  expiresAt: string
}

export interface NotificationView {
  id: string
  title: string
  message: string
  requestId?: string | null
  readAt?: string | null
  createdAt: string
}

export interface ApprovalView {
  id: string
  kind: string
  itemId: string
  requestId?: string | null
  openedAt: string
  dueAt?: string | null
  overdue: boolean
  canDecide: boolean
  blockedReason?: string | null
}

export interface NotificationInboxView {
  items: NotificationView[]
  meta: { unread: number; total: number; page: number }
}

export interface ApprovalQueueView {
  data: ApprovalView[]
  page: number
  pageSize: number
  total: number
  counts: { open: number; overdue: number }
}

export interface LocationView {
  id: string
  kind: "city" | "district"
  name: string
  aliases?: string[]
  parentId?: string | null
  active: boolean
}

export interface PendingRequestView {
  hasPending: boolean
  requestId?: string
}

export interface SettingView {
  key: string
  value: unknown
  version: number
  riskClass: "high" | "operational" | string
  updatedBy?: string | null
  updatedAt: string | null
}

/** `PATCH /admin/settings`. High-risk keys also need the `X-Reauth-Token` header. */
export interface SaveSettingsResult {
  changeSetId: string
  changes: Array<{ key: string; before: unknown; after: unknown; version: number; riskClass: string }>
}

export interface RequestAttachmentView {
  id: string
  name: string
  size: number
  type: string
  uploadedAt: string
  sharedWithProvider: boolean
}

export interface DispatchView {
  mode: "auto" | "manual"
  autoAttempts?: number
  needsAssignmentReason?: string | null
  runs?: Array<{ id: string; trigger: string; at: string; outcome: string | null }>
}

export interface AssignmentView {
  id?: string
  providerId?: string
  providerUserId?: string
  providerName?: string
  businessName?: string
  trade?: string
  status: string
  source?: "auto" | "manual"
  attempt?: number | null
  score?: { total: number; factors: Record<string, number> } | null
  note?: string | null
  /** The offer text a provider sees. */
  offerBrief?: string | null
  response?: string | null
  crewConfirmed?: number | null
  offeredAt?: string
  expiresAt?: string
  respondedAt?: string | null
  reviewNote?: string | null
}

export interface RankingRunView {
  runId: string
  at: string
  eligible: Array<{
    providerId: string
    providerName: string
    total: number
    factors: Record<string, number>
  }>
  excluded: Array<{ providerId: string; providerName: string; rule: string; reason: string }>
}

/** A quote line as the client writes it (kobo). */
export interface QuoteItemView {
  description: string
  quantity: number
  unitPrice: number
}

/** A line as the server returns it. `unitPrice` is missing for staff without `view.pricing`. */
export interface QuoteLineView {
  description: string
  quantity: number
  unitPrice?: number
}

/**
 * Staff and the assigned provider see different fields: staff get `total`/`payoutAmount` as `null` plus
 * `amountsHidden` without `view.pricing`; the provider's own costing is `{ items, note, total }`.
 */
export interface ContributionView {
  id?: string
  assignmentId?: string
  providerId?: string
  items: QuoteLineView[]
  total?: number | null
  note?: string | null
  amountsHidden?: boolean
  createdAt?: string
}

/**
 * One shape for the three per-role quote DTOs (`quote.projection.ts`).
 * - customer: `id, version, status, items, total, note, validUntil, publishedAt, acceptedAt, paymentDueAt` (no `revision`).
 * - provider: `id, version, status, scope, payoutAmount?` (no prices).
 * - staff: everything stored; `total`/`payoutAmount` are `null` with `amountsHidden` without `view.pricing`.
 */
export interface QuoteView {
  id: string
  version: number
  /** Staff only. The edit, publish, approve and return bodies need it. */
  revision?: number
  status: "draft" | "sent" | "accepted" | "declined" | "revision_requested" | "superseded" | "expired" | string
  items?: QuoteLineView[]
  /** Provider only: the scope lines, without prices. */
  scope?: Array<{ description: string; quantity: number }>
  total?: number | null
  payoutAmount?: number | null
  amountsHidden?: boolean
  /** Staff with `view.pricing`. */
  payoutSuggestion?: number | null
  payoutAssignmentId?: string | null
  pricingOverrideNote?: string | null
  note?: string | null
  /** Staff: set when the signed-in approver edited the quote last. */
  blockedReason?: string | null
  validUntil?: string | null
  publishedAt?: string | null
  acceptedAt?: string | null
  respondedAt?: string | null
  responseNote?: string | null
  returnedNote?: string | null
  approvalRequestedBy?: string | null
  approvalRequestedAt?: string | null
  approvedBy?: string | null
  selfApproved?: boolean
  paymentDueAt?: string | null
}

export interface PaymentView {
  id: string
  amount: number | null
  method: "paystack" | "offline" | string
  status: "pending" | "recorded" | "paid" | "failed" | "partially_refunded" | "refunded" | "reversed" | string
  reference?: string | null
  channel?: string | null
  paidAt?: string | null
  createdAt: string
}

export type RefundStatus =
  | "pending_approval"
  | "awaiting_second_approval"
  | "approved"
  | "processing"
  | "completed"
  | "rejected"
  | "waived"
  | "failed"

/** Finance refund queue row (`GET /admin/refunds`) and the `refunds` list of `GET /requests/:id/payments`. */
export interface RefundView {
  id: string
  /** Kobo. `null` for staff without `view.pricing`. */
  amount: number | null
  status: RefundStatus | string
  reason?: string | null
  requestId?: string
  paymentId?: string
  cancellationId?: string | null
  method?: "paystack" | "offline" | string | null
  createdAt?: string
  completedAt?: string | null
}

export type PayoutStatus =
  | "pending_approval"
  | "awaiting_second_approval"
  | "approved"
  | "processing"
  | "paid"
  | "failed"
  | "on_hold"
  | "cancelled"
  | "reversed"

/** Statuses a payout can be put on hold from. */
export const HOLDABLE_PAYOUT_STATUSES: readonly string[] = [
  "pending_approval",
  "awaiting_second_approval",
  "approved",
  "failed",
]

/** Finance payout queue row (`GET /admin/payouts`) and the result of each payout command. */
export interface PayoutView {
  id: string
  requestId: string
  assignmentId: string
  providerId: string
  providerName: string | null
  kind: string
  status: PayoutStatus | string
  /** Kobo. `null` for staff without `view.pricing`. */
  amount: number | null
  holdReason: string | null
  holdSource: string | null
  /** A transfer already `processing` when a hold arrived. */
  urgentReview: boolean
  approvalDueAt: string | null
  maskedBankAccount: string | null
  method: "paystack" | "offline"
  transferReference: string | null
  paidAt: string | null
  createdAt: string
}

/** One line of `GET /providers/me/earnings`: the provider's own amount and a provider-safe hold reason. */
export interface EarningsItemView {
  id: string
  requestId: string
  kind: string
  amount: number
  status: PayoutStatus | string
  holdReason: string | null
  maskedBankAccount: string | null
  method: "paystack" | "offline"
  paidAt: string | null
  createdAt: string
}

export interface RequestPaymentsView {
  /** Kobo. `null` for staff without `view.pricing`, and when there is no accepted quote. */
  amountDue: number | null
  dueAt?: string | null
  offlineInstructions?: string | null
  payments: PaymentView[]
  refunds: RefundView[]
}

export interface EarningsView extends PaginationFields {
  payouts: EarningsItemView[]
  totalPaid: number
  totalPending: number
}

export interface PaginationFields {
  total: number
  page: number
  limit: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export interface PaginatedResult<T> extends PaginationFields {
  items: T[]
}

/** The server error envelope. A 409 `VERSION_CONFLICT` carries the fresh request view in `details.current`. */
export interface ApiErrorBody {
  error: {
    code:
      | "VALIDATION_ERROR"
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "STATE_CONFLICT"
      | "VERSION_CONFLICT"
      | "IDEMPOTENCY_KEY_REUSED"
      | "RATE_LIMITED"
      | "PAYMENT_IN_PROGRESS"
      | string
    message: string
    details?: { current?: RequestView } & Record<string, unknown>
  }
}
