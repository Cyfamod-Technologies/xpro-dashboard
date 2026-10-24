export type RequestAction =
  | "dispatch.setMode"
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
  | (string & {})

export type RequestStage =
  | "intake"
  | "dispatch"
  | "pricing"
  | "payment"
  | "scheduling"
  | "execution"
  | "completion"
  | "cancellation"
  | "closed"
  | string

export interface RequestSummary {
  id: string
  version: number
  status: string
  stage: RequestStage
  statusLabel: string | null
  nextActor: string
  allowedActions: RequestAction[]
  title?: string
  service?: string
  cityName?: string | null
  districtName?: string | null
  createdAt?: string
  updatedAt?: string
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
  budget?: number | null
  startDate?: string | null
  effectiveStartDate?: string | null
  effectiveEndDate?: string | null
  details?: Record<string, unknown>
  customerName?: string
  ownerId?: string
  staffOwnerId?: string | null
  intake?: { state: string; clarificationCount: number }
  attachments?: RequestAttachmentView[]
  provider?: { businessName: string; trade: string; verified: boolean } | null
  contributions?: ContributionView[]
  schedules?: ScheduleView[]
  schedule?: ScheduleView | null
  updates?: ProgressUpdateView[]
  issues?: RequestIssueView[]
  cancellations?: CancellationView[]
  noShows?: NoShowView[]
  messages?: RequestMessageView[]
  completion?: CompletionView | null
  activity?: RequestActivityView[]
  hold?: { kind: string; reason: string; customerNote?: string | null; createdAt: string } | null
  createdAt?: string
  updatedAt?: string
}

export interface ScheduleView {
  id?: string
  startAt: string
  endAt: string
  status: string
  note?: string | null
  customer?: "pending" | "accepted" | "change_requested"
  provider?: "pending" | "accepted" | "change_requested"
  confirmedAt?: string | null
  changeRequests?: Array<{ id: string; actorRole: string; note: string; createdAt: string }>
}

export interface ProgressUpdateView {
  id: string
  status: string
  note: string
  reportedVia?: string | null
  issueId?: string | null
  review: { state: "pending" | "approved" | "rejected"; note?: string | null; reviewedAt?: string | null }
  attachments: RequestAttachmentView[]
  createdAt: string
}

export interface RequestIssueView {
  id: string
  status: string
  note: string
  outcome?: string | null
  defectsWindowEndsAt?: string | null
  createdAt: string
}

export interface CancellationView {
  id: string
  status: string
  reasonCode?: string | null
  note?: string | null
  refundStatus?: string | null
  createdAt: string
}

export interface NoShowView {
  id: string
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
  text: string
  createdAt: string
  author?: string
  attachments: RequestAttachmentView[]
}

export interface RequestActivityView {
  id: string
  action: string
  actorLabel?: string
  createdAt: string
  metadata?: Record<string, unknown>
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
  parentId?: string | null
  active: boolean
}

export interface ServiceView {
  id: string
  name: string
  intakeFields: Array<{ key: string; label: string; type: string; options?: string[]; required: boolean; sensitive?: boolean; isSkill?: boolean }>
}

export interface SettingView {
  key: string
  value: unknown
  version: number
  riskClass: string
  updatedBy?: string | null
  updatedAt: string
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
  attempts?: number
  needsManual?: boolean
  needsAssignmentReason?: string | null
  lastRunId?: string | null
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

export interface QuoteItemView {
  description: string
  quantity: number
  unitPrice: number
}

export interface ContributionView {
  id: string
  assignmentId: string
  providerId: string
  items: QuoteItemView[]
  total: number
  note?: string | null
  createdAt: string
}

export interface QuoteView {
  id: string
  version: number
  revision: number
  status: string
  items: QuoteItemView[]
  total: number
  note?: string | null
  validUntil?: string | null
  responseNote?: string | null
  approvalRequestedBy?: string | null
  blockedReason?: string | null
  paymentDueAt?: string | null
  payoutAmount?: number | null
  createdAt?: string
  updatedAt?: string
}

export interface PaymentView {
  id: string
  amount: number | null
  method: "paystack" | "offline" | string
  status: string
  reference?: string | null
  channel?: string | null
  paidAt?: string | null
  createdAt: string
}

export interface RefundView {
  id: string
  amount?: number
  status: string
  reason?: string
  method?: "paystack" | "offline" | string
  requestId?: string
  requestedAt?: string
}

export interface PayoutView {
  id: string
  amount?: number
  status: string
  method?: "paystack" | "offline" | string
  requestId?: string
  providerName?: string
  maskedBankAccount?: string
  providerUserId?: string
}

export interface RequestPaymentsView {
  amountDue: number
  dueAt?: string | null
  offlineInstructions?: string | null
  payments: PaymentView[]
  refunds: RefundView[]
}

export interface EarningsView {
  payouts: PayoutView[]
  totalPaid?: number
  totalPending?: number
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export interface ApiErrorBody {
  code?: string
  message?: string
  details?: unknown
}
