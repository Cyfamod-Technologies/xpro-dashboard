import { ofetch } from "ofetch"

const baseURL = import.meta.env.VITE_API_BASE_URL || ""

export class ApiError extends Error {
  readonly code?: string
  readonly details?: unknown
  readonly status?: number

  constructor(message: string, options: { code?: string; details?: unknown; status?: number } = {}) {
    super(message)
    this.name = "ApiError"
    this.code = options.code
    this.details = options.details
    this.status = options.status
  }
}

export function toApiError(value: unknown): ApiError {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  const response = source.response && typeof source.response === "object" ? (source.response as Record<string, unknown>) : {}
  const payload = source.data && typeof source.data === "object" ? (source.data as Record<string, unknown>) : response._data && typeof response._data === "object" ? (response._data as Record<string, unknown>) : {}
  const error = payload.error && typeof payload.error === "object" ? (payload.error as Record<string, unknown>) : payload

  return new ApiError(typeof error.message === "string" ? error.message : typeof source.message === "string" ? source.message : "The request could not be completed.", {
    code: typeof error.code === "string" ? error.code : undefined,
    details: error.details,
    status: typeof response.status === "number" ? response.status : typeof source.status === "number" ? source.status : undefined,
  })
}

export const $api = ofetch.create({
  baseURL,
  async onRequest({ options }) {
    const accessToken = useCookie("accessToken").value
    options.headers.set("X-XPro-Client", "web")
    if (accessToken && !options.headers.has("Authorization"))
      options.headers.set("Authorization", `Bearer ${accessToken}`)
  },
})
