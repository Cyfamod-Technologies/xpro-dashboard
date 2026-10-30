// The 15 request statuses (server `REQUEST_STATUSES`, spec 04 §5.1) in lifecycle order, with short staff wording and a
// tonal chip colour. A conversation row's `statusLabel` is the *stage* label (several stages share one status), so the
// status pills and chips use this map instead. Pure module: no Vue imports.

export const requestStatuses = [
  "submitted",
  "under_review",
  "matched",
  "quoted",
  "awaiting_payment",
  "ready_to_schedule",
  "scheduled",
  "in_progress",
  "blocked",
  "completion_pending",
  "acknowledged",
  "cancelling",
  "closed",
  "cancelled",
  "rejected",
] as const

export type RequestStatusKey = (typeof requestStatuses)[number]

/** Vuetify theme colour names. */
export type StatusColor = "primary" | "info" | "success" | "warning" | "error" | "secondary"

export interface StatusStyle {
  label: string
  color: StatusColor
}

export const statusStyles: Record<RequestStatusKey, StatusStyle> = {
  // Intake not yet approved, including clarification.
  submitted: { label: "New", color: "warning" },
  // Intake approved, no confirmed provider yet (dispatch).
  under_review: { label: "Finding provider", color: "warning" },
  matched: { label: "Provider matched", color: "info" },
  quoted: { label: "Quote sent", color: "info" },
  awaiting_payment: { label: "Awaiting payment", color: "warning" },
  ready_to_schedule: { label: "Ready to schedule", color: "primary" },
  scheduled: { label: "Scheduled", color: "primary" },
  in_progress: { label: "In progress", color: "primary" },
  // Provider blocker, staff hold, open issue or dispute.
  blocked: { label: "Blocked", color: "error" },
  completion_pending: { label: "Awaiting sign-off", color: "warning" },
  // Customer confirmed; the defects window is running.
  acknowledged: { label: "Work accepted", color: "success" },
  cancelling: { label: "Cancelling", color: "warning" },
  closed: { label: "Closed", color: "secondary" },
  cancelled: { label: "Cancelled", color: "secondary" },
  rejected: { label: "Rejected", color: "error" },
}

const isKnown = (status: string): status is RequestStatusKey => status in statusStyles

/** Statuses that make a conversation read-only (server `TERMINAL`). */
export const finishedStatuses: ReadonlySet<string> = new Set(["closed", "cancelled", "rejected"])

export const isFinishedStatus = (status: string) => finishedStatuses.has(status)

/** "In progress"; an unknown status falls back to its raw words so a new server status still shows something. */
export const statusLabel = (status: string) =>
  isKnown(status) ? statusStyles[status].label : status.replaceAll("_", " ").replace(/^./, c => c.toUpperCase())

export const statusColor = (status: string): StatusColor => (isKnown(status) ? statusStyles[status].color : "secondary")

/** Position in the lifecycle; unknown statuses sort last. */
export const statusOrder = (status: string) => {
  const index = (requestStatuses as readonly string[]).indexOf(status)

  return index === -1 ? requestStatuses.length : index
}
