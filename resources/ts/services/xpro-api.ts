import { $api } from "@/utils/api"
import type { StaffRole } from "@/features/operations/types"
import type { ApiEnvelope, LoginPayload, LoginResponse, User } from "@/types/domain"

interface ServerAuthUser {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  role: "user" | "admin" | "super_admin"
  platformRoles: ("customer" | "provider" | "staff")[]
  activeRole?: "customer" | "provider" | null
  staffStatus: string | null
  emailVerified: boolean
  phone: string | null
  phoneVerified: boolean
  phoneVerifiedAt: string | null
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
  const workspaceRoles = source.platformRoles.filter(
    (item): item is "customer" | "provider" => item === "customer" || item === "provider",
  )
  const role = staff
    ? "admin"
    : (source.activeRole ?? (source.platformRoles.includes("provider") ? "provider" : "customer"))
  const firstName = source.firstName ?? ""
  const lastName = source.lastName ?? ""

  return {
    id: source.id,
    firstName,
    lastName,
    email: source.email,
    emailVerified: source.emailVerified ?? false,
    phone: source.phone ?? null,
    phoneVerified: source.phoneVerified ?? false,
    phoneVerifiedAt: source.phoneVerifiedAt ?? null,
    role,
    workspaceRoles: staff ? [] : workspaceRoles,
    status: "active",
    title: staff ? "XPro Staff" : role === "provider" ? "XPro Service Provider" : "XPro Customer",
    initials: `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase(),
    scopes: [],
    mfaRequired: source.mfaEnabled,
  }
}

const mapStaffPermissions = async (user: User, accessToken?: string): Promise<User> => {
  if (user.role !== "admin") return user
  try {
    const result = await $api<ApiEnvelope<{ permissions: string[]; canOwnRequests: boolean; permVersion: number }>>(
      "/admin/staff/permissions",
      { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined },
    )

    return { ...user, scopes: result.data.permissions }
  } catch {
    // A staff permission lookup must not block authentication; server commands remain authoritative.
    return user
  }
}

export interface StaffInvitePreview {
  firstName: string | null
  lastName: string | null
  email: string
  roles: StaffRole[]
  expiresAt: string
  /** The published staff policy, when this workspace flow requires acceptance. */
  policy: { version: string; url: string } | null
}

export type StaffInviteAccepted =
  | { result: "accepted" }
  | { result: "mfa_enrollment_required"; enrollmentToken: string; secret: string; otpauthUrl: string }

export const staffInviteApi = {
  preview: (token: string) => $api<ApiEnvelope<StaffInvitePreview>>(`/auth/staff-invite/${encodeURIComponent(token)}`),
  accept: (payload: {
    token: string
    password: string
    policyVersion?: string
    conflictDeclaration: { hasLinkedCustomerAccount: boolean; linkedCustomerEmail?: string; statement: string }
  }) => $api<ApiEnvelope<StaffInviteAccepted>>("/auth/staff-invite/accept", { method: "POST", body: payload }),
  verifyEnrollment: (enrollmentToken: string, code: string) =>
    $api<ApiEnvelope<{ result: "authenticated" }>>("/auth/mfa/verify-enrollment", {
      method: "POST",
      body: { enrollmentToken, code },
    }),
}

export const authApi = {
  logout: (accessToken?: string) =>
    $api<ApiEnvelope<{ loggedOut: boolean }>>("/auth/logout", {
      method: "POST",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    }),
  reauthenticate: (password: string, code?: string) =>
    $api<ApiEnvelope<{ reauthToken: string; expiresInSeconds: number }>>("/auth/reauthenticate", {
      method: "POST",
      body: { password, ...(code ? { code } : {}) },
    }),
  startPhoneVerification: (phone: string) =>
    $api<ApiEnvelope<PhoneVerificationChallenge>>("/me/phone/verify/start", { method: "POST", body: { phone } }),
  confirmPhoneVerification: (verificationId: string, code: string) =>
    $api<ApiEnvelope<VerifiedPhone>>("/me/phone/verify/confirm", {
      method: "POST",
      body: { verificationId, code },
    }),
  login: async (payload: LoginPayload): Promise<ApiEnvelope<LoginResponse>> => {
    const response = await $api<ApiEnvelope<ServerLoginResponse>>("/auth/login", {
      method: "POST",
      body: {
        email: payload.email,
        password: payload.password,
        ...(payload.mfaCode ? { mfaCode: payload.mfaCode } : {}),
      },
    })

    return {
      ...response,
      data: {
        token: response.data.accessToken,
        user: await mapStaffPermissions(mapUser(response.data.user), response.data.accessToken),
        requiresMfa: false,
      },
    }
  },
  verifyMfa: async (code: string, challengeToken: string): Promise<ApiEnvelope<LoginResponse>> => {
    const response = await $api<ApiEnvelope<LoginResponse>>("/auth/mfa/challenge", {
      method: "POST",
      body: { code },
      headers: { Authorization: `Bearer ${challengeToken}` },
    })

    return {
      ...response,
      data: { ...response.data, user: await mapStaffPermissions(response.data.user, response.data.token) },
    }
  },
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
    acceptedTerms?: { termsVersion?: string; privacyVersion?: string; providerAgreementVersion?: string }
    /** Where to resume after verification and sign-in, e.g. `/request` for a guest draft. */
    returnTo?: string
  }) =>
    $api<ApiEnvelope<{ email: string; status: string; verificationToken?: string }>>("/auth/register", {
      method: "POST",
      body: payload,
    }),
  verifyEmail: (token: string) =>
    $api<ApiEnvelope<{ verified: boolean; email: string; returnTo?: string }>>("/auth/email/verify", {
      method: "POST",
      body: { token },
    }),
  forgotPassword: (email: string) =>
    $api<ApiEnvelope<{ sent: boolean }>>("/auth/password/forgot", { method: "POST", body: { email } }),
  resetPassword: (payload: { token: string; password: string; email: string }) =>
    $api<ApiEnvelope<{ reset: boolean }>>("/auth/password/reset", { method: "POST", body: payload }),
  resendVerification: (email: string) =>
    $api<ApiEnvelope<{ sent: boolean }>>("/auth/email/resend", { method: "POST", body: { email } }),
  /** Adds the customer or provider role to this account and makes it the active workspace (01 §6.16). */
  addRole: async (
    role: "customer" | "provider",
    acceptedTerms?: { providerAgreementVersion?: string },
  ): Promise<ApiEnvelope<User>> => {
    const response = await $api<ApiEnvelope<ServerAuthUser>>("/me/roles", {
      method: "POST",
      body: { role, ...(acceptedTerms ? { acceptedTerms } : {}) },
    })

    return { ...response, data: mapUser(response.data) }
  },
  setActiveRole: async (role: "customer" | "provider"): Promise<ApiEnvelope<User>> => {
    const response = await $api<ApiEnvelope<ServerAuthUser>>("/me/active-role", { method: "PUT", body: { role } })

    return { ...response, data: mapUser(response.data) }
  },
  me: async (): Promise<ApiEnvelope<User>> => {
    const response = await $api<ApiEnvelope<ServerAuthUser>>("/auth/me")

    return { ...response, data: await mapStaffPermissions(mapUser(response.data)) }
  },
}

export interface PhoneVerificationChallenge {
  verificationId: string
  phone: string
  expiresAt: string
  resendAfter: string
}

export interface VerifiedPhone {
  phone: string
  phoneVerified: boolean
  phoneVerifiedAt: string
}
