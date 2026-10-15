export type UserRole = "admin" | "customer" | "provider" | "super_admin" | "manager" | "budget_viewer"
export type AccountStatus = "active" | "invited" | "unverified" | "suspended"
export type ApprovalStatus = "draft" | "submitted" | "changes_requested" | "rejected" | "published"
export type TrackingStatus =
  "not_started" | "in_progress" | "stalled" | "action_required" | "action_in_progress" | "completed"

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  status: AccountStatus
  title: string
  initials: string
  scopes: string[]
  mfaRequired: boolean
}

export interface Program {
  id: string
  name: string
  code: string
  description: string
  countries: string[]
  managers: string[]
  status: "active" | "draft" | "archived"
  projectCount: number
  allocationTotal: number
  currency: string
}

export interface Allocation {
  id: string
  projectId: string
  fiscalYear: string
  amount: number
  currency: string
  source: string
  classification: string
  agency: string
  approvalStatus: ApprovalStatus
}

export interface TrackedProject {
  id: string
  publicId: string
  title: string
  description: string
  programId: string
  programName: string
  country: string
  state: string
  lga: string
  sector: string
  agency: string
  fiscalYear: string
  allocation: number
  currency: string
  trackingStatus: TrackingStatus
  approvalStatus: ApprovalStatus
  managerId: string
  managerName: string
  lastVerifiedAt: string | null
  actionRequired: boolean
  evidenceCount: number
  version: number
}

export interface Submission {
  id: string
  projectId: string
  projectTitle: string
  managerName: string
  submittedAt: string
  type: "new_project" | "project_revision" | "allocation_revision" | "outcome"
  status: "pending" | "changes_requested" | "approved" | "rejected"
  risk: "normal" | "attention"
  changedFields: number
}

export interface NotificationItem {
  id: string
  title: string
  message: string
  createdAt: string
  read: boolean
  tone: "info" | "success" | "warning"
}

export interface AuditEvent {
  id: string
  actor: string
  action: string
  resource: string
  createdAt: string
  tone: "info" | "success" | "warning"
}

export interface DashboardMetric {
  label: string
  value: string
  helper: string
  icon: string
  color: "primary" | "success" | "warning" | "info" | "error"
}

export interface DashboardResponse {
  metrics: DashboardMetric[]
  projects: TrackedProject[]
  programs: Program[]
  submissions: Submission[]
  notifications: NotificationItem[]
}

export interface ApiEnvelope<T> {
  data: T
  meta?: Record<string, unknown>
}

export interface LoginPayload {
  email: string
  password: string
  remember: boolean
}

export interface LoginResponse {
  token: string
  user: User
  requiresMfa: boolean
}

export interface CreateProjectPayload {
  title: string
  program: string
  country: string
  state: string
  lga: string
  fiscalYear: string
  sector: string
  agency: string
  amount: number
  source: string
  description: string
  actionRequired: boolean
}

export interface SubmitProjectPayload {
  note: string
}

export interface AddEvidencePayload {
  title: string
  source: string
}

export type ReviewDecision = "approved" | "changes_requested" | "rejected"

export interface ReviewDecisionPayload {
  decision: ReviewDecision
  note: string
}

export const roleLabels: Record<UserRole, string> = {
  admin: "Admin / Dispatch",
  customer: "Customer",
  provider: "Provider",
  super_admin: "Super Admin",
  manager: "Manager",
  budget_viewer: "Budget Viewer",
}
