import { HttpResponse, delay, http } from "msw"

import { demoCredentials, users } from "@/mocks/fixtures"
import { mockApiBase } from "@/mocks/api-base"
import { v1Handlers } from "@/mocks/v1/handlers"
import { workspaceHandlers } from "@/mocks/v1/workspace-handlers"
import type { User } from "@/types/domain"
import { normalizePhone } from "@/features/phone/phone"

const api = mockApiBase
const demoMfaEnabled = false
const accountStorageKey = "xpro:demo-accounts"
const demoUserStateStorageKey = "xpro:demo-user-state"
interface PersistedAccount {
  user: User
  password: string
  verificationToken: string
  returnTo?: string
}
interface PersistedDemoUserState {
  firstName?: string
  lastName?: string
  role?: User["role"]
  workspaceRoles?: User["workspaceRoles"]
  phone?: User["phone"]
  phoneVerified?: User["phoneVerified"]
  phoneVerifiedAt?: User["phoneVerifiedAt"]
}
const loadAccounts = (): PersistedAccount[] => {
  try {
    const saved = JSON.parse(localStorage.getItem(accountStorageKey) ?? "[]") as PersistedAccount[]

    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}
const savedAccounts = loadAccounts()
for (const account of savedAccounts) if (!users.some(user => user.id === account.user.id)) users.push(account.user)
const loadDemoUserStates = (): Record<string, PersistedDemoUserState> => {
  try {
    return JSON.parse(localStorage.getItem(demoUserStateStorageKey) ?? "{}") as Record<string, PersistedDemoUserState>
  } catch {
    return {}
  }
}
const demoUserStates = loadDemoUserStates()
for (const user of users) Object.assign(user, demoUserStates[user.id] ?? {})
const accountPasswords = new Map<string, string>([
  ...demoCredentials.map(item => [item.email, item.password] as const),
  ...savedAccounts.map(item => [item.user.email, item.password] as const),
])
const saveAccounts = () => {
  try {
    localStorage.setItem(
      accountStorageKey,
      JSON.stringify(
        users
          .filter(user => !demoCredentials.some(item => item.email === user.email))
          .map(user => ({
            user,
            password: accountPasswords.get(user.email) ?? "",
            verificationToken: `verify-${user.id}`,
          })),
      ),
    )
  } catch {
    // Private windows and full storage: this session remains usable until reload.
  }
}
const saveDemoUserState = (user: User) => {
  try {
    demoUserStates[user.id] = {
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      workspaceRoles: user.workspaceRoles,
      phone: user.phone,
      phoneVerified: user.phoneVerified,
      phoneVerifiedAt: user.phoneVerifiedAt,
    }
    localStorage.setItem(demoUserStateStorageKey, JSON.stringify(demoUserStates))
  } catch {
    // Keep the current session usable if browser storage is unavailable.
  }
}
const phoneChallenges = new Map<string, { userId: string; phone: string }>()

const envelope = <T>(data: T, meta?: Record<string, unknown>) => HttpResponse.json({ data, meta })

const validationError = (message: string) =>
  HttpResponse.json({ error: { code: "VALIDATION_ERROR", message } }, { status: 422 })

const isEmail = (value: unknown) => /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(String(value ?? "").trim())
const isStrongPassword = (value: unknown) =>
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(String(value ?? ""))
const bearerUser = (request: Request): User | undefined => {
  const token = request.headers.get("authorization")?.replace("Bearer ", "")

  return users.find(user => token === `mock-token-${user.id}`)
}

const requireUser = (request: Request): User | Response =>
  bearerUser(request) ??
  HttpResponse.json({ error: { code: "UNAUTHENTICATED", message: "Your session has expired." } }, { status: 401 })

function toServerUser(user: User) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role:
      user.id === "usr-admin"
        ? ("super_admin" as const)
        : user.role === "admin"
          ? ("admin" as const)
          : ("user" as const),
    platformRoles:
      user.role === "admin" ? (["staff"] as const) : user.workspaceRoles?.length ? user.workspaceRoles : [user.role],
    activeRole: user.role === "customer" || user.role === "provider" ? user.role : null,
    staffStatus: user.role === "admin" ? "active" : null,
    emailVerified: user.status === "active",
    phone: user.phone ?? null,
    phoneVerified: user.phoneVerified ?? false,
    phoneVerifiedAt: user.phoneVerifiedAt ?? null,
    onboardingCompleted: true,
    mfaEnabled: demoMfaEnabled && user.mfaRequired,
  }
}

export const handlers = [
  http.post(`${api}/auth/login`, async ({ request }) => {
    await delay(500)

    const payload = (await request.json()) as { email?: string; password?: string }
    if (!isEmail(payload.email) || !payload.password)
      return validationError("Enter a valid email address and password.")

    const normalizedEmail = String(payload.email).trim().toLowerCase()

    const user =
      accountPasswords.get(normalizedEmail) === payload.password
        ? users.find(item => item.email === normalizedEmail)
        : undefined

    if (!user)
      return HttpResponse.json(
        { error: { code: "INVALID_CREDENTIALS", message: "The email or password is incorrect." } },
        { status: 422 },
      )

    if (user.status === "unverified") return validationError("Verify your email before signing in.")
    if (user.status !== "active") return validationError("This account is not currently active.")

    const mfaCode = (payload as { mfaCode?: string }).mfaCode
    const requiresMfa = demoMfaEnabled && user.mfaRequired
    if (requiresMfa && !mfaCode)
      return HttpResponse.json({ error: { code: "MFA_REQUIRED", message: "MFA code required." } }, { status: 422 })
    if (requiresMfa && mfaCode !== "123456")
      return validationError("The authentication code is invalid or has expired.")

    const serverUser = toServerUser(user)

    return envelope({
      accessToken: `mock-token-${user.id}`,
      tokenType: "Bearer",
      sessionId: `mock-session-${user.id}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      expiresIn: 86400,
      user: serverUser,
    })
  }),

  http.post(`${api}/auth/mfa/challenge`, async ({ request }) => {
    await delay(350)

    const payload = (await request.json()) as { code?: string }
    const challenge = request.headers.get("authorization")?.replace("Bearer ", "")
    const user = users.find(item => challenge === `mock-challenge-${item.id}`)
    if (!user || payload.code !== "123456") return validationError("The authentication code is invalid or has expired.")

    return envelope({ token: `mock-token-${user.id}`, user: toServerUser(user), requiresMfa: false })
  }),

  http.get(`${api}/auth/legal-documents`, ({ request }) => {
    const role = new URL(request.url).searchParams.get("role")

    return envelope(
      role === "provider" ? [{ kind: "provider_agreement", version: "v1", url: "/legal/provider-agreement" }] : [],
    )
  }),

  http.post(`${api}/auth/register`, async ({ request }) => {
    await delay(600)

    const payload = (await request.json()) as {
      firstName?: string
      lastName?: string
      email?: string
      password?: string
      role?: string
      returnTo?: string
    }
    const firstName = String(payload.firstName ?? "").trim()
    const lastName = String(payload.lastName ?? "").trim()
    const email = String(payload.email ?? "")
      .trim()
      .toLowerCase()

    if (!firstName) return validationError("Enter your first name.")
    if (!lastName) return validationError("Enter your last name.")
    if (!isEmail(email)) return validationError("Enter a valid email address.")
    if (!isStrongPassword(payload.password)) return validationError("Use a stronger password to create your account.")
    if (users.some(user => user.email === email))
      return validationError("An account already exists for this email address.")

    if (payload.role !== "customer" && payload.role !== "provider")
      return validationError("Choose a customer or provider account.")

    const registered: User = {
      id: `usr-${crypto.randomUUID()}`,
      firstName,
      lastName,
      email,
      role: payload.role,
      status: "unverified",
      title: payload.role === "customer" ? "XPro Customer" : "XPro Service Provider",
      initials: `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase(),
      scopes: [],
      mfaRequired: false,
    }
    users.push(registered)
    accountPasswords.set(email, String(payload.password))
    const token = `verify-${registered.id}`
    const returnTo = typeof payload.returnTo === "string" ? payload.returnTo : undefined
    try {
      const records = loadAccounts().filter(item => item.user.id !== registered.id)
      records.push({
        user: registered,
        password: String(payload.password),
        verificationToken: token,
        ...(returnTo ? { returnTo } : {}),
      })
      localStorage.setItem(accountStorageKey, JSON.stringify(records))
    } catch {
      // Keep the account in memory for this session.
    }

    return envelope({ email, firstName, lastName, status: "unverified", verificationToken: token })
  }),

  http.post(`${api}/auth/email/verify`, async ({ request }) => {
    await delay(450)

    const payload = (await request.json()) as { token?: string; email?: string }
    const verificationRecords = loadAccounts()
    const queryEmail = String(payload.email ?? "")
      .trim()
      .toLowerCase()
    const account =
      verificationRecords.find(item => item.verificationToken === payload.token) ??
      (payload.token === "prototype-verification-token"
        ? verificationRecords.find(item => item.user.email === queryEmail)
        : undefined)
    const user = account?.user ?? users.find(item => item.email === queryEmail)

    if ((!account && payload.token !== "prototype-verification-token") || !user || user.status !== "unverified")
      return validationError("This verification link is invalid or has already been used.")

    user.status = "active"
    saveAccounts()

    return envelope({ verified: true, email: user.email, returnTo: account?.returnTo })
  }),

  http.post(`${api}/auth/password/forgot`, async ({ request }) => {
    await delay(450)

    const payload = (await request.json()) as { email?: string }
    if (!isEmail(payload.email)) return validationError("Enter a valid email address.")

    return envelope({ sent: true })
  }),

  http.post(`${api}/auth/password/reset`, async ({ request }) => {
    await delay(450)

    const payload = (await request.json()) as { token?: string; password?: string; email?: string }
    if (payload.token !== "prototype-token")
      return validationError("This password reset link is invalid or has expired.")
    if (!isStrongPassword(payload.password)) return validationError("Use a stronger password to protect your account.")

    const email = String(payload.email ?? "")
      .trim()
      .toLowerCase()

    if (!accountPasswords.has(email)) return validationError("This password reset link is invalid or has expired.")

    accountPasswords.set(email, String(payload.password))
    saveAccounts()

    return envelope({ reset: true })
  }),

  http.get(`${api}/me`, ({ request }) => {
    const current = requireUser(request)
    if (current instanceof Response) return current

    return envelope(current)
  }),

  http.get(`${api}/auth/me`, ({ request }) => {
    const current = requireUser(request)
    if (current instanceof Response) return current

    return envelope(toServerUser(current))
  }),

  http.patch(`${api}/auth/me`, async ({ request }) => {
    const current = requireUser(request)
    if (current instanceof Response) return current
    const payload = (await request.json()) as { firstName?: string; lastName?: string }
    const firstName = String(payload.firstName ?? "").trim()
    const lastName = String(payload.lastName ?? "").trim()
    if (!firstName || firstName.length > 80) return validationError("Enter a first name up to 80 characters.")
    if (!lastName || lastName.length > 80) return validationError("Enter a last name up to 80 characters.")

    current.firstName = firstName
    current.lastName = lastName
    saveDemoUserState(current)

    return envelope({ firstName, lastName })
  }),

  http.post(`${api}/me/roles`, async ({ request }) => {
    const current = requireUser(request)
    if (current instanceof Response) return current
    const payload = (await request.json()) as { role?: "customer" | "provider" }
    if (current.role === "admin" || (payload.role !== "customer" && payload.role !== "provider"))
      return validationError("Choose a supported workspace.")
    const roles = new Set(current.workspaceRoles?.length ? current.workspaceRoles : [current.role])
    roles.add(payload.role)
    current.workspaceRoles = [...roles]
    current.role = payload.role
    saveDemoUserState(current)

    return envelope(toServerUser(current))
  }),
  http.put(`${api}/me/active-role`, async ({ request }) => {
    const current = requireUser(request)
    if (current instanceof Response) return current
    const payload = (await request.json()) as { role?: "customer" | "provider" }
    const roles = current.workspaceRoles?.length ? current.workspaceRoles : [current.role]
    if (
      current.role === "admin" ||
      (payload.role !== "customer" && payload.role !== "provider") ||
      !roles.includes(payload.role)
    )
      return validationError("That workspace is not available on this account.")
    current.role = payload.role
    saveDemoUserState(current)

    return envelope(toServerUser(current))
  }),
  http.post(`${api}/me/phone/verify/start`, async ({ request }) => {
    const current = requireUser(request)
    if (current instanceof Response) return current
    const payload = (await request.json()) as { phone?: string }
    const phone = normalizePhone(String(payload.phone ?? ""))
    if (!phone) return validationError("Enter a valid Nigerian phone number.")
    const verificationId = `demo-phone-${current.id}-${Date.now()}`
    phoneChallenges.set(verificationId, { userId: current.id, phone })
    current.phone = phone
    current.phoneVerified = false
    current.phoneVerifiedAt = null
    saveDemoUserState(current)

    return envelope({
      verificationId,
      phone,
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      resendAfter: new Date(Date.now() + 30_000).toISOString(),
    })
  }),
  http.post(`${api}/me/phone/verify/confirm`, async ({ request }) => {
    const current = requireUser(request)
    if (current instanceof Response) return current
    const payload = (await request.json()) as { verificationId?: string; code?: string }
    const challenge = phoneChallenges.get(String(payload.verificationId ?? ""))
    if (!challenge || challenge.userId !== current.id || payload.code !== "123456")
      return validationError("The verification code is invalid or has expired.")
    phoneChallenges.delete(String(payload.verificationId))
    current.phone = challenge.phone
    current.phoneVerified = true
    current.phoneVerifiedAt = new Date().toISOString()
    saveDemoUserState(current)

    return envelope({ phone: current.phone, phoneVerified: true, phoneVerifiedAt: current.phoneVerifiedAt })
  }),

  http.get(`${api}/admin/staff/permissions`, ({ request }) => {
    const current = requireUser(request)
    if (current instanceof Response) return current
    if (current.role !== "admin")
      return HttpResponse.json({ error: { code: "FORBIDDEN", message: "Forbidden." } }, { status: 403 })

    return envelope({ permissions: current.scopes, canOwnRequests: true, permVersion: 1 })
  }),

  http.post(`${api}/auth/email/resend`, async ({ request }) => {
    const payload = (await request.json()) as { email?: string }
    if (!isEmail(payload.email)) return validationError("Enter a valid email address.")

    return envelope({ sent: true })
  }),

  http.post(`${api}/auth/logout`, () => envelope({ loggedOut: true })),

  // The V1 request flow: requests, chat and counter offers, staff and provider handoff (see `mocks/v1`).
  ...v1Handlers,
  ...workspaceHandlers,
]
