export type UserRole = "admin" | "customer" | "provider"
export type AccountStatus = "active" | "invited" | "unverified" | "suspended"

export interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  emailVerified?: boolean
  phone?: string | null
  phoneVerified?: boolean
  phoneVerifiedAt?: string | null
  /** The workspace in use: `admin` for staff, otherwise the active of the roles below (ROLE-1). */
  role: UserRole
  /** Customer and provider roles the account holds; several means it can switch workspace. */
  workspaceRoles?: ("customer" | "provider")[]
  status: AccountStatus
  title: string
  initials: string
  scopes: string[]
  mfaRequired: boolean
}

export interface ApiEnvelope<T> {
  data: T
  meta?: Record<string, unknown>
}

export interface LoginPayload {
  email: string
  password: string
  remember: boolean
  mfaCode?: string
}

export interface LoginResponse {
  token: string
  user: User
  requiresMfa: boolean
}

export const roleLabels: Record<UserRole, string> = {
  admin: "Admin / Dispatch",
  customer: "Customer",
  provider: "Provider",
}
