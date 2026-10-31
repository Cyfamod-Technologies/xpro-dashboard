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

// The V1 request-flow client. Its contract is the one `xpro-server` will implement in the server phase
// (v1/README.md §6, adjusted by plans/v1-ui-implementation.md). With `VITE_ENABLE_MOCKS=true` MSW answers it from
// `mocks/v1`; otherwise it calls the real server, which does not support V1 yet.

type HttpMethod = "POST" | "PUT"

export class V1ApiError extends ApiError {
  constructor(message: string, options: { code?: string; details?: unknown; status?: number } = {}) {
    super(message, options)
    this.name = "V1ApiError"
  }
}

const randomKey = () => globalThis.crypto.randomUUID()
const pathId = (value: string) => encodeURIComponent(value)

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
  const headers = new Headers()

  if (version !== undefined) headers.set("If-Match", `W/"${version}"`)
  headers.set("Idempotency-Key", randomKey())

  return unwrap($api<ApiEnvelope<T>>(path, { method, body: body as Record<string, unknown>, headers }))
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
