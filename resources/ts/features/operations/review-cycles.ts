export interface HistoryEntry {
  kind?: string
  status: string
  note: string
  fields?: string[]
  createdAt: string
}

export type CycleColor = "primary" | "warning" | "success" | "error" | "secondary"

export interface CycleStep {
  label: string
  at: string
  note: string
}

export interface ReviewCycle {
  id: string
  group: "profile" | "bank"
  title: string
  icon: string
  chip: string
  color: CycleColor
  open: boolean
  fields: string[]
  steps: CycleStep[]
  /** What happens next, for a review that is still open. */
  waiting: string
  lastAt: string
}

interface Options {
  /** Changed field labels of the change now pending, for held changes saved before field names were recorded. */
  pendingFields?: string[]
  /** A bank change waiting for review, which has no entry in the history until XPro decides. */
  pendingBank?: { label: string; submittedAt: string } | null
}

const titles: Record<string, string> = {
  profile: "Profile review",
  held_change: "Profile changes",
  bank: "Bank details",
  standing: "Account standing",
  reliability: "Reliability review",
}
const icons: Record<string, string> = {
  profile: "tabler-user-check",
  held_change: "tabler-pencil",
  bank: "tabler-building-bank",
  standing: "tabler-shield",
  reliability: "tabler-alert-circle",
}
// Reviews that open when the provider submits and close when XPro approves or rejects.
const paired = ["profile", "held_change", "bank"]

const decisionLabel = (decision: string, resubmitted: boolean) =>
  decision === "submitted" && resubmitted
    ? "Resubmitted"
    : decision === "changes_requested"
      ? "Changes requested"
      : `${decision.charAt(0).toUpperCase()}${decision.slice(1).replaceAll("_", " ")}`

const chipFor = (kind: string, decision: string): { chip: string; color: CycleColor } => {
  if (decision === "approved" || decision === "reinstated" || decision === "cleared")
    return { chip: decisionLabel(decision, false), color: "success" }
  if (decision === "rejected" || decision === "delisted" || decision === "restricted")
    return { chip: decisionLabel(decision, false), color: "error" }
  if (decision === "changes_requested") return { chip: "Changes requested", color: "warning" }
  if (decision === "submitted") return { chip: "In review", color: "primary" }

  return { chip: decisionLabel(decision, false), color: kind === "reliability" ? "warning" : "secondary" }
}

const waitingFor = (kind: string, decision: string) =>
  decision === "changes_requested"
    ? "Update your profile and resubmit."
    : kind === "held_change"
      ? "Waiting for XPro. Your current details stay live meanwhile."
      : "Waiting for XPro."

/** Groups the flat review log into one card per review: a submission and the decisions made on it. */
export function buildReviewCycles(history: HistoryEntry[], options: Options = {}): ReviewCycle[] {
  const cycles: ReviewCycle[] = []
  const open = new Map<string, ReviewCycle>()
  const ordered = history
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => a.entry.createdAt.localeCompare(b.entry.createdAt) || b.index - a.index)

  const start = (kind: string, id: string, fields: string[]) => {
    const cycle: ReviewCycle = {
      id,
      group: kind === "bank" ? "bank" : "profile",
      title: titles[kind] ?? "Review",
      icon: icons[kind] ?? "tabler-history",
      chip: "",
      color: "secondary",
      open: false,
      fields,
      steps: [],
      waiting: "",
      lastAt: "",
    }

    cycles.push(cycle)

    return cycle
  }
  const apply = (cycle: ReviewCycle, kind: string, entry: HistoryEntry, isOpen: boolean) => {
    const resubmitted = entry.status === "submitted" && cycle.steps.length > 0

    cycle.steps.push({ label: decisionLabel(entry.status, resubmitted), at: entry.createdAt, note: entry.note })
    cycle.lastAt = entry.createdAt
    cycle.open = isOpen
    Object.assign(cycle, chipFor(kind, entry.status))
    cycle.waiting = isOpen ? waitingFor(kind, entry.status) : ""
  }

  ordered.forEach(({ entry }, position) => {
    const kind = entry.kind ?? "profile"

    if (!paired.includes(kind)) {
      apply(start(kind, `${kind}-${position}`, []), kind, entry, false)

      return
    }
    let cycle = open.get(kind)

    if (!cycle)
      cycle = start(kind, `${kind}-${position}`, entry.status === "submitted" ? [...(entry.fields ?? [])] : [])
    if (entry.status === "submitted" && entry.fields?.length) cycle.fields = [...entry.fields]
    const closes = entry.status === "approved" || entry.status === "rejected"

    apply(cycle, kind, entry, !closes)
    if (closes) open.delete(kind)
    else open.set(kind, cycle)
  })

  for (const [kind, cycle] of open) {
    if (kind === "held_change" && !cycle.fields.length && options.pendingFields?.length)
      cycle.fields = [...options.pendingFields]
  }
  if (options.pendingBank && !open.has("bank")) {
    const cycle = start("bank", "bank-pending", [options.pendingBank.label])

    apply(cycle, "bank", { status: "submitted", note: "", createdAt: options.pendingBank.submittedAt }, true)
  }

  return cycles.sort((a, b) => b.lastAt.localeCompare(a.lastAt))
}
