import type { StaffRole } from "@/features/operations/types"
import { staffRoleLabels } from "@/features/operations/staff"
import type { IdentityCheck, StaffHistoryEntry, StaffMemberView, StaffStatus } from "@/services/staff-api"

export const staffStatusLabels: Record<StaffStatus, string> = {
  invited: "Invited",
  active: "Active",
  suspended: "Suspended",
  deactivated: "Deactivated",
  revoked: "Revoked",
}

export const staffStatusColors: Record<StaffStatus, string> = {
  invited: "info",
  active: "success",
  suspended: "warning",
  deactivated: "secondary",
  revoked: "secondary",
}

export const identityCheckLabels: Record<IdentityCheck, string> = {
  in_person: "In person",
  video_call: "Video call",
  phone_callback: "Phone call-back",
}

export const roleDescriptions: Record<StaffRole, string> = {
  super_admin: "Everything, including staff, settings and money. Can own requests.",
  operations: "Runs requests and dispatch, verifies providers. Can own requests.",
  pricing: "Builds and publishes quotes. Cannot own requests.",
  client_relations: "Talks to customers and resolves issues. Cannot own requests.",
  finance: "Bank details, payments, payouts and refunds. Cannot own requests.",
}

export const roleItems = (Object.keys(staffRoleLabels) as StaffRole[]).map(value => ({
  value,
  title: staffRoleLabels[value],
  description: roleDescriptions[value],
}))

export const fullName = (member: Pick<StaffMemberView, "firstName" | "lastName" | "email">) =>
  [member.firstName, member.lastName].filter(Boolean).join(" ").trim() || member.email

export const initials = (member: Pick<StaffMemberView, "firstName" | "lastName" | "email">) =>
  (
    [member.firstName, member.lastName]
      .filter(Boolean)
      .map(part => part![0])
      .join("") || member.email[0]
  ).toUpperCase()

export const isFormer = (status: StaffStatus) => status === "deactivated" || status === "revoked"

const dateTime = (value: string) =>
  new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(
    new Date(value),
  )

const dateOnly = (value: string) =>
  new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`))

export const formatDateTime = (value: string | null | undefined) => (value ? dateTime(value) : "—")
export const formatDate = (value: string | null | undefined) => (value ? dateOnly(value.slice(0, 10)) : "—")

export const relativeFuture = (value: string, now = Date.now()) => {
  const minutes = Math.round((Date.parse(value) - now) / 60000)
  if (minutes <= 0) return "now"
  if (minutes < 60) return `${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} h`

  return `${Math.round(hours / 24)} days`
}

/** The second line under a member's status: invitation, leave, or nothing. */
export const statusNote = (
  member: StaffMemberView,
  now = Date.now(),
): { text: string; tone: "error" | "muted" } | null => {
  if (member.status === "invited" && member.invite)
    return member.invite.state === "expired"
      ? { text: "Invitation expired", tone: "error" }
      : { text: `Invitation expires in ${relativeFuture(member.invite.expiresAt, now)}`, tone: "muted" }
  if (member.status === "invited") return { text: "No invitation on file", tone: "error" }
  if (member.leave?.active) return { text: `On leave until ${formatDate(member.leave.to)}`, tone: "muted" }
  if (member.leave) return { text: `Leave from ${formatDate(member.leave.from)}`, tone: "muted" }
  if (member.status === "active" && !member.mfaEnrolledAt)
    return { text: "Sign-in verification to be set up", tone: "muted" }

  return null
}

export const permissionLabels: Record<string, string> = {
  "request.claim": "Own requests",
  "request.review": "Approve or reject requests at intake",
  "request.clarify": "Ask customers for clarification",
  "request.cancel": "Cancel requests before work starts",
  "request.cancel.active": "Cancel requests after work has started",
  "request.escalate": "Escalate a request",
  "request.escalation.resolve": "Resolve escalations",
  "request.reassign": "Move a request to another owner",
  "request.close": "Close requests",
  "provider.review": "Verify and review providers",
  "account.suspend": "Suspend customers and providers",
  "account.limit": "Set customers' open-request limit",
  "dispatch.manage": "Dispatch requests to providers",
  "schedule.manage": "Propose schedules",
  "progress.review": "Review provider progress",
  "issue.resolve": "Resolve completion issues",
  "quote.manage": "Build and publish quotes",
  "quote.approve": "Approve held quotes",
  "bank.review": "Verify provider bank details",
  "payment.record": "Record offline payments",
  "payout.approve": "Approve payouts",
  "refund.manage": "Request and decide refunds",
  "message.customer": "Message customers",
  "message.provider": "Message providers",
  "message.internal": "Write staff notes",
  "staff.manage": "Manage staff",
  "staff.mfa.reset": "Reset staff sign-in verification",
  "settings.manage": "Change platform settings",
  "catalog.manage": "Manage the service catalog",
  "audit.export": "Export activity history",
  "view.customer_contact": "See customer contact details",
  "view.provider_identity": "See provider ID documents",
  "view.bank_full": "See full bank details",
  "view.pricing": "See costings, payouts and margin",
  "view.audit_sensitive": "See activity about staff and settings",
  "view.audit_bank": "See activity about bank details",
}

const permissionGroupOf = (permission: string) => {
  if (
    permission.startsWith("request.") ||
    ["dispatch.manage", "schedule.manage", "progress.review", "issue.resolve"].includes(permission)
  )
    return "Requests and dispatch"
  if (["provider.review", "account.suspend", "account.limit", "bank.review"].includes(permission))
    return "Providers and accounts"
  if (permission.startsWith("quote.")) return "Quotes"
  if (["payment.record", "payout.approve", "refund.manage"].includes(permission)) return "Money"
  if (permission.startsWith("message.")) return "Messages"
  if (permission.startsWith("view.")) return "Sensitive data"

  return "Staff and platform"
}

export const permissionGroupOrder = [
  "Requests and dispatch",
  "Providers and accounts",
  "Quotes",
  "Money",
  "Messages",
  "Sensitive data",
  "Staff and platform",
]

export const groupPermissions = (permissions: string[]) => {
  const groups = new Map<string, string[]>()
  for (const permission of permissions) {
    const group = permissionGroupOf(permission)
    groups.set(group, [...(groups.get(group) ?? []), permission])
  }

  return permissionGroupOrder.filter(name => groups.has(name)).map(name => ({ name, items: groups.get(name)! }))
}

const roleList = (value: unknown) =>
  Array.isArray(value) ? value.map(role => staffRoleLabels[role as StaffRole] ?? String(role)).join(", ") : "—"

const note = (reason: unknown) => (typeof reason === "string" && reason ? ` Reason: ${reason}` : "")

/** One sentence for a history row, from the audit action and its metadata. */
export const describeHistory = (entry: StaffHistoryEntry): string => {
  const meta = entry.metadata ?? {}
  switch (entry.action) {
    case "staff.invited":
      return meta.rehire ? "Invited again as a new employment period." : `Invited as ${roleList(meta.roles)}.`
    case "staff.invite_resent":
      return "Invitation resent."
    case "staff.invite_revoked":
      return `Invitation revoked.${note(meta.reason)}`
    case "staff.invite_accepted":
      return "Accepted the invitation and set up sign-in verification."
    case "staff.roles_changed":
      return `Roles changed: ${roleList(meta.before)} → ${roleList(meta.after)}.${note(meta.reason)}`
    case "staff.renamed":
      return `Renamed to ${[meta.firstName, meta.lastName].filter(Boolean).join(" ")}.${note(meta.reason)}`
    case "staff.suspended":
      return `Suspended${meta.securityIncident ? " (security incident)" : ""}.${note(meta.reason)}`
    case "staff.reactivated":
      return `Reactivated as ${roleList(meta.roles)}${meta.resetMfa ? ", sign-in verification reset" : ""}.${note(meta.reason)}`
    case "staff.deactivated":
      return `Deactivated.${note(meta.reason)}`
    case "staff.mfa_reset":
      return `Sign-in verification reset (identity checked: ${
        identityCheckLabels[meta.identityCheck as IdentityCheck] ?? "recorded"
      }).${note(meta.reason)}`
    case "staff.leave_set":
      return `Leave set from ${formatDate(String(meta.from ?? ""))} to ${formatDate(String(meta.to ?? ""))}.`
    case "staff.leave_cleared":
      return "Leave cleared."
    default:
      return entry.action.replace("staff.", "").replaceAll("_", " ")
  }
}

/** Wat calendar date as `YYYY-MM-DD`, for date inputs. */
export const todayWat = (now = new Date()) => new Date(now.getTime() + 3600000).toISOString().slice(0, 10)

/** Mirrors the server's owner rule (02 §2.4): only Operations and Super admin can own requests. */
export const rolesCanOwn = (roles: readonly StaffRole[]) =>
  roles.includes("super_admin") || roles.includes("operations")

export type StaffActionKey =
  | "resend"
  | "revoke"
  | "roles"
  | "rename"
  | "suspend"
  | "reactivate"
  | "deactivate"
  | "mfa"
  | "leave"
  | "clearLeave"
  | "inviteAgain"

export interface StaffActionItem {
  key: StaffActionKey
  label: string
  icon: string
  color?: string
  /** Why the control is off. A disabled control explains itself instead of failing on click. */
  disabledReason?: string
  /** Shown as a primary button, not in the overflow menu. */
  primary?: boolean
}

export interface StaffActionContext {
  selfId: string | undefined
  canResetMfa: boolean
  activeSuperAdmins: number
}

const SELF_ROLES = "You can't change your own roles. Ask another super admin."
const SELF_STATUS = "You can't change your own account status."
const LAST_SUPER_ADMIN = "At least one active super admin is required."

/** The commands valid for this member's status, who is looking, and the platform's guard rules. */
export const staffActions = (member: StaffMemberView, ctx: StaffActionContext): StaffActionItem[] => {
  const self = member.id === ctx.selfId
  const lastSuper = member.status === "active" && member.roles.includes("super_admin") && ctx.activeSuperAdmins <= 1
  const items: StaffActionItem[] = []
  const add = (item: StaffActionItem) => items.push(item)

  if (member.status === "invited") {
    add({ key: "resend", label: "Resend invitation", icon: "tabler-mail-forward", primary: true })
    add({ key: "revoke", label: "Revoke invitation", icon: "tabler-mail-off", color: "error" })
    add({ key: "roles", label: "Edit roles", icon: "tabler-shield" })
  } else if (member.status === "active") {
    add({
      key: "roles",
      label: "Edit roles",
      icon: "tabler-shield",
      primary: true,
      ...(self ? { disabledReason: SELF_ROLES } : {}),
    })
    add({
      key: "suspend",
      label: "Suspend",
      icon: "tabler-user-pause",
      color: "warning",
      primary: true,
      ...(self ? { disabledReason: SELF_STATUS } : lastSuper ? { disabledReason: LAST_SUPER_ADMIN } : {}),
    })
    add({ key: "rename", label: "Rename", icon: "tabler-pencil" })
    if (member.leave) add({ key: "clearLeave", label: "Clear leave", icon: "tabler-calendar-off" })
    else add({ key: "leave", label: "Set leave", icon: "tabler-calendar-event" })
    if (ctx.canResetMfa)
      add({
        key: "mfa",
        label: "Reset sign-in verification",
        icon: "tabler-key",
        ...(self ? { disabledReason: "You can't reset your own sign-in verification. Ask another super admin." } : {}),
      })
    add({
      key: "deactivate",
      label: "Deactivate",
      icon: "tabler-user-off",
      color: "error",
      ...(self ? { disabledReason: SELF_STATUS } : lastSuper ? { disabledReason: LAST_SUPER_ADMIN } : {}),
    })
  } else if (member.status === "suspended") {
    add({
      key: "reactivate",
      label: "Reactivate",
      icon: "tabler-user-check",
      primary: true,
      ...(self ? { disabledReason: SELF_STATUS } : {}),
    })
    add({ key: "roles", label: "Edit roles", icon: "tabler-shield", ...(self ? { disabledReason: SELF_ROLES } : {}) })
    if (ctx.canResetMfa) add({ key: "mfa", label: "Reset sign-in verification", icon: "tabler-key" })
    add({ key: "deactivate", label: "Deactivate", icon: "tabler-user-off", color: "error" })
  } else {
    add({ key: "inviteAgain", label: "Invite again", icon: "tabler-user-plus", primary: true })
  }

  return items
}
