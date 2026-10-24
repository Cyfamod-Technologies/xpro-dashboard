export type UserRole = "admin" | "customer" | "provider"
export type AccountStatus = "active" | "invited" | "unverified" | "suspended"

export interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  role: UserRole
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
