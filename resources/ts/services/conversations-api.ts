import { $api, toApiError } from "@/utils/api"
import { RequestsApiError } from "@/services/requests-api"
import { buildListQuery } from "@/features/messages/messages-helpers"
import type { ConversationListParams, ConversationListResult } from "@/features/messages/types"

// `GET /admin/conversations` answers `{ data, meta }`. The shared `unwrap` in requests-api.ts keeps only `.data`, so
// this one keeps `meta` too and maps errors the same way (`RequestsApiError`).
export const conversationsApi = {
  async list(params: ConversationListParams = {}): Promise<ConversationListResult> {
    try {
      // ofetch repeats array values (`status=a&status=b`), which is how the server reads several statuses.
      const body = await $api<Partial<ConversationListResult>>("/admin/conversations", {
        query: buildListQuery(params),
      })

      return {
        data: body.data ?? [],
        meta: { nextCursor: body.meta?.nextCursor ?? null, statusCounts: body.meta?.statusCounts ?? {} },
      }
    } catch (error: unknown) {
      const normalized = toApiError(error)

      throw new RequestsApiError(normalized.message, {
        code: normalized.code,
        details: normalized.details,
        status: normalized.status,
      })
    }
  },
}
