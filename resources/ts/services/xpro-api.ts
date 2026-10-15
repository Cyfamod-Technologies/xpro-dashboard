import { $api } from "@/utils/api"
import type {
  AddEvidencePayload,
  Allocation,
  ApiEnvelope,
  AuditEvent,
  CreateProjectPayload,
  DashboardResponse,
  LoginPayload,
  LoginResponse,
  NotificationItem,
  Program,
  ReviewDecisionPayload,
  Submission,
  SubmitProjectPayload,
  TrackedProject,
  User,
} from "@/types/domain"

export const authApi = {
  login: (payload: LoginPayload) => $api<ApiEnvelope<LoginResponse>>("/auth/login", { method: "POST", body: payload }),
  verifyMfa: (code: string) =>
    $api<ApiEnvelope<{ verified: boolean }>>("/auth/mfa/challenge", { method: "POST", body: { code } }),
  registerAccount: (payload: { name: string; email: string; password: string; role: "customer" | "provider" }) =>
    $api<ApiEnvelope<{ email: string; name: string; status: string }>>("/auth/register", {
      method: "POST",
      body: payload,
    }),
  verifyEmail: (token: string, email: string) =>
    $api<ApiEnvelope<{ verified: boolean }>>("/auth/email/verify", { method: "POST", body: { token, email } }),
  forgotPassword: (email: string) =>
    $api<ApiEnvelope<{ sent: boolean }>>("/auth/password/forgot", { method: "POST", body: { email } }),
  resetPassword: (payload: { token: string; password: string; email: string }) =>
    $api<ApiEnvelope<{ reset: boolean }>>("/auth/password/reset", { method: "POST", body: payload }),
  me: () => $api<ApiEnvelope<User>>("/me"),
}

export const dashboardApi = {
  get: (state = "Niger", country = "Nigeria") =>
    $api<ApiEnvelope<DashboardResponse>>("/dashboard", { query: { country, state } }),
}

export const programApi = {
  list: () => $api<ApiEnvelope<Program[]>>("/programs"),
}

export const projectApi = {
  list: (state = "Niger", country = "Nigeria") =>
    $api<ApiEnvelope<TrackedProject[]>>("/projects", { query: { country, state } }),
  get: (id: string) => $api<ApiEnvelope<TrackedProject>>(`/projects/${id}`),
  create: (payload: CreateProjectPayload) =>
    $api<ApiEnvelope<TrackedProject>>("/projects", { method: "POST", body: payload }),
  addEvidence: (id: string, payload: AddEvidencePayload) =>
    $api<ApiEnvelope<TrackedProject>>(`/projects/${id}/evidence`, { method: "POST", body: payload }),
  submit: (id: string, payload: SubmitProjectPayload) =>
    $api<ApiEnvelope<{ project: TrackedProject; submission: Submission }>>(`/projects/${id}/submit`, {
      method: "POST",
      body: payload,
    }),
}

export const allocationApi = {
  list: () => $api<ApiEnvelope<Allocation[]>>("/allocations"),
}

export const submissionApi = {
  list: () => $api<ApiEnvelope<Submission[]>>("/submissions"),
  decide: (id: string, payload: ReviewDecisionPayload) =>
    $api<ApiEnvelope<{ submission: Submission; project: TrackedProject }>>(`/submissions/${id}/decision`, {
      method: "POST",
      body: payload,
    }),
}

export const adminApi = {
  users: () => $api<ApiEnvelope<User[]>>("/users"),
  auditEvents: () => $api<ApiEnvelope<AuditEvent[]>>("/audit-events"),
}

export const notificationApi = {
  list: () => $api<ApiEnvelope<NotificationItem[]>>("/notifications"),
}
