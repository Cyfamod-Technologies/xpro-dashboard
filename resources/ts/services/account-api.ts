import { $api } from "@/utils/api"
import type { ApiEnvelope } from "@/types/domain"
import type { StaffMemberView } from "@/services/staff-api"

export interface SessionView {
  sessionId: string
  current: boolean
  createdAt: string
  expiresAt: string
}

export interface SignInEvent {
  ipAddress: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

/** The signed-in person's own security and leave settings. */
export const accountApi = {
  /** Changing the password signs the person out everywhere, this device included. */
  changePassword: (currentPassword: string, password: string) =>
    $api<ApiEnvelope<{ message?: string }>>("/auth/change-password", {
      method: "POST",
      body: { currentPassword, password },
    }),
  sessions: () => $api<ApiEnvelope<SessionView[]>>("/auth/me/sessions"),
  revokeSession: (sessionId: string) =>
    $api<ApiEnvelope<{ message: string }>>(`/auth/me/sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
    }),
  signIns: () => $api<ApiEnvelope<SignInEvent[]>>("/auth/me/login-history"),
  setLeave: (body: { from: string; to: string; delegateId?: string; note?: string }) =>
    $api<ApiEnvelope<StaffMemberView>>("/admin/me/leave", { method: "PUT", body }),
  clearLeave: () => $api<ApiEnvelope<StaffMemberView>>("/admin/me/leave", { method: "DELETE" }),
}
