import { $api } from "@/utils/api"
import type { ApiEnvelope, LoginPayload, LoginResponse, User } from "@/types/domain"

interface ServerAuthUser {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  role: "user" | "admin" | "super_admin"
  platformRoles: ("customer" | "provider" | "staff")[]
  staffStatus: string | null
  emailVerified: boolean
  onboardingCompleted: boolean
  mfaEnabled: boolean
}

interface ServerLoginResponse {
  accessToken: string
  tokenType: string
  sessionId: string
  expiresAt: string
  expiresIn: number
  user: ServerAuthUser
}

const mapUser = (source: ServerAuthUser): User => {
  const staff = source.staffStatus === "active" || source.role === "admin" || source.role === "super_admin"
  const role = staff ? "admin" : source.platformRoles.includes("provider") ? "provider" : "customer"
  const firstName = source.firstName ?? ""
  const lastName = source.lastName ?? ""

  return {
    id: source.id,
    firstName,
    lastName,
    email: source.email,
    role,
    status: "active",
    title: staff ? "XPro Staff" : role === "provider" ? "XPro Service Provider" : "XPro Customer",
    initials: `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase(),
    scopes: [],
    mfaRequired: source.mfaEnabled,
  }
}

export const authApi = {
  login: async (payload: LoginPayload): Promise<ApiEnvelope<LoginResponse>> => {
    const response = await $api<ApiEnvelope<ServerLoginResponse>>("/auth/login", {
      method: "POST",
      body: { email: payload.email, password: payload.password, ...(payload.mfaCode ? { mfaCode: payload.mfaCode } : {}) },
    })

    return { ...response, data: { token: response.data.accessToken, user: mapUser(response.data.user), requiresMfa: false } }
  },
  verifyMfa: (code: string, challengeToken: string) =>
    $api<ApiEnvelope<LoginResponse>>("/auth/mfa/challenge", {
      method: "POST",
      body: { code },
      headers: { Authorization: `Bearer ${challengeToken}` },
    }),
  legalDocuments: (role: "customer" | "provider") =>
    $api<ApiEnvelope<{ kind: "terms" | "privacy" | "provider_agreement"; version: string; url: string }[]>>(
      "/auth/legal-documents",
      { query: { role } },
    ),
  registerAccount: (payload: {
    firstName: string
    lastName: string
    email: string
    password: string
    role: "customer" | "provider"
    acceptedTerms: { termsVersion: string; privacyVersion: string; providerAgreementVersion?: string }
  }) =>
    $api<ApiEnvelope<{ email: string; status: string }>>("/auth/register", {
      method: "POST",
      body: payload,
    }),
  verifyEmail: (token: string) =>
    $api<ApiEnvelope<{ verified: boolean; email: string; returnTo?: string }>>("/auth/email/verify", { method: "POST", body: { token } }),
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
  me: async (): Promise<ApiEnvelope<User>> => {
    const response = await $api<ApiEnvelope<ServerAuthUser>>("/auth/me")

    return { ...response, data: mapUser(response.data) }
  },
}
