import { ofetch } from "ofetch"
import { isDemoMode } from "@/utils/demo-mode"
import { firstDetailMessage } from "@/utils/errors"

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

const NETWORK_ERROR_MESSAGE = "We could not reach XPro. Check your connection and try again."

export function toApiError(value: unknown): ApiError {
  if (value instanceof ApiError) return value

  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  const response =
    source.response && typeof source.response === "object" ? (source.response as Record<string, unknown>) : {}
  const payload =
    source.data && typeof source.data === "object"
      ? (source.data as Record<string, unknown>)
      : response._data && typeof response._data === "object"
        ? (response._data as Record<string, unknown>)
        : {}
  const error =
    payload.error && typeof payload.error === "object" ? (payload.error as Record<string, unknown>) : payload

  const unreachable = source.name === "FetchError" && !source.response

  return new ApiError(
    firstDetailMessage(error.details) ??
      (typeof error.message === "string"
        ? error.message
        : unreachable
          ? NETWORK_ERROR_MESSAGE
          : typeof source.message === "string"
            ? source.message
            : "The request could not be completed."),
    {
      code: typeof error.code === "string" ? error.code : undefined,
      details: error.details,
      status:
        typeof response.status === "number"
          ? response.status
          : typeof source.status === "number"
            ? source.status
            : undefined,
    },
  )
}

const baseURL = import.meta.env.VITE_API_BASE_URL?.trim()

const rawApi = ofetch.create({
  baseURL,
  async onRequest({ options }) {
    if (!baseURL && !isDemoMode)
      throw new Error("The API URL is missing from this dashboard build. Set VITE_API_BASE_URL during the build.")
    const accessToken = useCookie("accessToken").value
    options.headers.set("X-XPro-Client", "web")
    if (accessToken && !options.headers.has("Authorization"))
      options.headers.set("Authorization", `Bearer ${accessToken}`)
  },
})

/**
 * Every failed call rejects with an `ApiError` carrying the server's own message, code, details and status, not
 * ofetch's generic `[POST] "url": 400`. Retries still happen inside `rawApi`; only the final error is converted.
 */
export const $api = Object.assign(
  (request: Parameters<typeof rawApi>[0], options?: Parameters<typeof rawApi>[1]) =>
    rawApi(request, options).catch((error: unknown) => {
      throw toApiError(error)
    }),
  rawApi,
) as typeof rawApi
