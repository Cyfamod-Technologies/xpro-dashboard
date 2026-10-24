import { HttpResponse, delay, http } from "msw"

import { demoCredentials, users } from "@/mocks/fixtures"
import type { User } from "@/types/domain"

const api = "*"
const accountPasswords = new Map<string, string>(demoCredentials.map(item => [item.email, item.password]))

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

    return envelope({
      token: `${user.mfaRequired ? "mock-challenge" : "mock-token"}-${user.id}`,
      user,
      requiresMfa: user.mfaRequired,
    })
  }),

  http.post(`${api}/auth/mfa/challenge`, async ({ request }) => {
    await delay(350)

    const payload = (await request.json()) as { code?: string }
    const challenge = request.headers.get("authorization")?.replace("Bearer ", "")
    const user = users.find(item => challenge === `mock-challenge-${item.id}`)
    if (!user || payload.code !== "123456") return validationError("The authentication code is invalid or has expired.")

    return envelope({ token: `mock-token-${user.id}`, user, requiresMfa: false })
  }),

  http.post(`${api}/auth/register`, async ({ request }) => {
    await delay(600)

    const payload = (await request.json()) as {
      firstName?: string
      lastName?: string
      email?: string
      password?: string
      role?: string
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

    users.push({
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
    })
    accountPasswords.set(email, String(payload.password))

    return envelope({ email, firstName, lastName, status: "unverified" })
  }),

  http.post(`${api}/auth/email/verify`, async ({ request }) => {
    await delay(450)

    const payload = (await request.json()) as { token?: string; email?: string }
    const user = users.find(
      item =>
        item.email ===
        String(payload.email ?? "")
          .trim()
          .toLowerCase(),
    )

    if (payload.token !== "prototype-verification-token" || !user || user.status !== "unverified")
      return validationError("This verification link is invalid or has already been used.")

    user.status = "active"

    return envelope({ verified: true })
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

    return envelope({ reset: true })
  }),

  http.get(`${api}/me`, ({ request }) => {
    const current = requireUser(request)
    if (current instanceof Response) return current

    return envelope(current)
  }),
]
