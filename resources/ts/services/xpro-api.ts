import { $api } from "@/utils/api"
import type { ApiEnvelope, LoginPayload, LoginResponse, User } from "@/types/domain"

export const authApi = {
  login: (payload: LoginPayload) => $api<ApiEnvelope<LoginResponse>>("/auth/login", { method: "POST", body: payload }),
  verifyMfa: (code: string, challengeToken: string) =>
    $api<ApiEnvelope<LoginResponse>>("/auth/mfa/challenge", {
      method: "POST",
      body: { code },
      headers: { Authorization: `Bearer ${challengeToken}` },
    }),
  registerAccount: (payload: {
    firstName: string
    lastName: string
    email: string
    password: string
    role: "customer" | "provider"
  }) =>
    $api<ApiEnvelope<{ email: string; status: string }>>("/auth/register", {
      method: "POST",
      body: payload,
    }),
  verifyEmail: (token: string, email: string) =>
    $api<ApiEnvelope<{ verified: boolean }>>("/auth/email/verify", { method: "POST", body: { token, email } }),
  forgotPassword: (email: string) =>
    $api<ApiEnvelope<{ sent: boolean }>>("/auth/password/forgot", { method: "POST", body: { email } }),
  resetPassword: (payload: { token: string; password: string; email: string }) =>
    $api<ApiEnvelope<{ reset: boolean }>>("/auth/password/reset", { method: "POST", body: payload }),
  resendVerification: (email: string) =>
    $api<ApiEnvelope<{ sent: boolean }>>("/auth/email/resend", { method: "POST", body: { email } }),
  acceptInvite: (payload: { token: string; firstName: string; lastName: string; password: string }) =>
    $api<ApiEnvelope<{ token: string; secret: string; otpauthUrl: string; email: string }>>("/auth/invite/accept", {
      method: "POST",
      body: payload,
    }),
  enrollMfa: (code: string, enrollmentToken: string) =>
    $api<ApiEnvelope<LoginResponse>>("/auth/mfa/enroll", {
      method: "POST",
      body: { code },
      headers: { Authorization: `Bearer ${enrollmentToken}` },
    }),
  me: () => $api<ApiEnvelope<User>>("/me"),
}
