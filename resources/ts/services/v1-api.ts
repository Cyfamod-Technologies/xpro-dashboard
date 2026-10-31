import { $api, ApiError, toApiError } from "@/utils/api"
import type { ApiEnvelope } from "@/types/domain"
import type {
  ProviderCandidate,
  V1Conversation,
  V1Counts,
  V1CreateRequestBody,
  V1FormOptions,
  V1Job,
  V1Message,
  V1MessageBody,
  V1Request,
  V1RequestFilters,
  V1RequestPage,
  V1Staff,
} from "@/features/v1/types"

// The V1 request-flow client uses the shared contract in `v1/README.md` and the dashboard implementation plan.
// With `VITE_ENABLE_MOCKS=true` MSW answers it from `mocks/v1`; otherwise it calls the V1 server routes.

type HttpMethod = "POST" | "PUT"

export class V1ApiError extends ApiError {
  constructor(message: string, options: { code?: string; details?: unknown; status?: number } = {}) {
    super(message, options)
    this.name = "V1ApiError"
  }
}

const randomKey = () => globalThis.crypto.randomUUID()
const pathId = (value: string) => encodeURIComponent(value)
const pendingKeys = new Map<string, string>()

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`
  }

  return JSON.stringify(value) ?? "null"
}

const commandFingerprint = async (path: string, method: HttpMethod, body: unknown) => {
  const payload = new TextEncoder().encode(`${method}\n${path}\n${canonical(body)}`)
  const digest = await globalThis.crypto.subtle.digest("SHA-256", payload)

  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("")
}

const commandKeyFor = async (fingerprint: string) => {
  const cached = pendingKeys.get(fingerprint)
  if (cached) return cached

  const storageKey = `xpro:v1:pending-command:${fingerprint}`
  try {
    const saved = globalThis.sessionStorage.getItem(storageKey)
    if (saved) {
      pendingKeys.set(fingerprint, saved)

      return saved
    }
  } catch {
    // Storage may be unavailable in restricted browser contexts; keep retries stable in memory.
  }

  const key = randomKey()
  pendingKeys.set(fingerprint, key)
  try {
    globalThis.sessionStorage.setItem(storageKey, key)
  } catch {
    // The in-memory copy still covers retries in the current page.
  }

  return key
}

const clearCommandKey = (fingerprint: string) => {
  pendingKeys.delete(fingerprint)
  try {
    globalThis.sessionStorage.removeItem(`xpro:v1:pending-command:${fingerprint}`)
  } catch {
    // No cleanup is needed when browser storage is unavailable.
  }
}

const unwrap = async <T>(request: Promise<ApiEnvelope<T>>): Promise<T> => {
  try {
    return (await request).data
  } catch (error: unknown) {
    const normalized = toApiError(error)

    throw new V1ApiError(normalized.message, {
      code: normalized.code,
      details: normalized.details,
      status: normalized.status,
    })
  }
}

// Commands send `If-Match` (the request version the page loaded) and an idempotency key. A stale version is a 409.
const command = <T>(path: string, method: HttpMethod, body: unknown, version?: number) => {
  return (async () => {
    const fingerprint = await commandFingerprint(path, method, body)
    const headers = new Headers()

    if (version !== undefined) headers.set("If-Match", `W/"${version}"`)
    headers.set("Idempotency-Key", await commandKeyFor(fingerprint))

    const result = await unwrap($api<ApiEnvelope<T>>(path, { method, body: body as Record<string, unknown>, headers }))
    clearCommandKey(fingerprint)

    return result
  })()
}

const query = (filters: V1RequestFilters) => ({
  status: filters.status || undefined,
  assignee: filters.assignee || undefined,
  service: filters.service || undefined,
  q: filters.q?.trim() || undefined,
  page: filters.page,
  itemsPerPage: filters.itemsPerPage,
})

export const v1Api = {
  /** Services and serviceable locations for the request form. */
  formOptions: () => unwrap($api<ApiEnvelope<V1FormOptions>>("/request-options")),
  /** Role-scoped: customers count their own requests, admins all, staff their assigned ones. */
  counts: () => unwrap($api<ApiEnvelope<V1Counts>>("/request-summary")),
  listRequests: (filters: V1RequestFilters = {}) =>
    unwrap($api<ApiEnvelope<V1RequestPage>>("/requests", { query: query(filters) })),
  getRequest: (id: string) => unwrap($api<ApiEnvelope<V1Request>>(`/requests/${pathId(id)}`)),
  createRequest: (body: V1CreateRequestBody) => command<V1Request>("/requests", "POST", body),
  /** First assignment passes `expectedOwnerId: null`. Admin only. */
  assignStaff: (
    id: string,
    body: { staffId: string; expectedOwnerId: string | null; note?: string },
    version: number,
  ) => command<V1Request>(`/requests/${pathId(id)}/reassign`, "POST", body, version),
  /** The assigned staff member or an admin closes the intake decision. */
  approve: (id: string, version: number) => command<V1Request>(`/requests/${pathId(id)}/approve`, "POST", {}, version),
  /** Admin only. The reason is shown to the customer. */
  deny: (id: string, body: { reason: string }, version: number) =>
    command<V1Request>(`/requests/${pathId(id)}/deny`, "POST", body, version),
  cancel: (id: string, version: number) => command<V1Request>(`/requests/${pathId(id)}/cancel`, "POST", {}, version),
  listStaff: () => unwrap($api<ApiEnvelope<V1Staff[]>>("/admin/staff/owners")),
  providerCandidates: (id: string) =>
    unwrap($api<ApiEnvelope<ProviderCandidate[]>>(`/requests/${pathId(id)}/provider-candidates`)),
  /** Admin and assigned staff assign a provider after approval, or replace one later. */
  replaceProvider: (
    id: string,
    body: { providerId: string; reason?: string; priceKobo?: number; date?: string },
    version: number,
  ) => command<V1Request>(`/requests/${pathId(id)}/provider-assignment`, "PUT", body, version),
  messages: (id: string) =>
    unwrap($api<ApiEnvelope<V1Message[]>>(`/requests/${pathId(id)}/messages`, { query: { channel: "customer" } })),
  /** A text message or a counter card. Counter cards come only from the owner, an admin and the assigned staff. */
  sendMessage: (id: string, body: V1MessageBody) =>
    command<V1Message>(`/requests/${pathId(id)}/messages`, "POST", { channel: "customer", ...body }),
  adminConversations: (params: { q?: string } = {}) =>
    unwrap(
      $api<ApiEnvelope<V1Conversation[]>>("/admin/conversations", {
        query: { channel: "customer", q: params.q?.trim() || undefined },
      }),
    ),
  customerConversations: () => unwrap($api<ApiEnvelope<V1Conversation[]>>("/me/conversations")),
  providerJobs: () => unwrap($api<ApiEnvelope<V1Job[]>>("/providers/me/jobs")),
  providerJob: (id: string) => unwrap($api<ApiEnvelope<V1Job>>(`/providers/me/jobs/${pathId(id)}`)),
}
