import { $api, toApiError } from "@/utils/api"
import type { ApiEnvelope } from "@/types/domain"
import type { AdminFeaturedState, FeaturedProviderCard } from "@/features/discovery/featured-providers"

export class FeaturedProvidersApiError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = "FeaturedProvidersApiError"
    this.status = status
  }
}

const unwrap = async <T>(request: Promise<ApiEnvelope<T>>): Promise<T> => {
  try {
    return (await request).data
  } catch (error: unknown) {
    const normalized = toApiError(error)

    throw new FeaturedProvidersApiError(normalized.message, normalized.status)
  }
}

export const featuredProvidersApi = {
  list: async (): Promise<FeaturedProviderCard[]> =>
    (await unwrap($api<ApiEnvelope<{ providers: FeaturedProviderCard[] }>>("/featured-providers"))).providers,
  adminState: () => unwrap($api<ApiEnvelope<AdminFeaturedState>>("/admin/providers/featured")),
  save: (body: { revision: string; pinned: string[]; hidden: string[] }) =>
    unwrap($api<ApiEnvelope<AdminFeaturedState>>("/admin/providers/featured", { method: "PUT", body })),
}
