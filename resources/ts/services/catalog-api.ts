import { $api, ApiError, toApiError } from "@/utils/api"
import type { ApiEnvelope } from "@/types/domain"
import type {
  AdminCatalog,
  AdminQuestion,
  AdminServiceNode,
  PublicServiceNode,
  QuestionInput,
  QuestionPatch,
  ServiceInput,
  ServicePatch,
} from "@/features/catalog/types"

export class CatalogApiError extends ApiError {
  constructor(message: string, options: { code?: string; details?: unknown; status?: number } = {}) {
    super(message, options)
    this.name = "CatalogApiError"
  }
}

const pathId = (value: string) => encodeURIComponent(value)

const unwrap = async <T>(request: Promise<ApiEnvelope<T>>): Promise<T> => {
  try {
    return (await request).data
  } catch (error: unknown) {
    const normalized = toApiError(error)

    throw new CatalogApiError(normalized.message, {
      code: normalized.code,
      details: normalized.details,
      status: normalized.status,
    })
  }
}

const send = <T>(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown) =>
  unwrap($api<ApiEnvelope<T>>(path, { method, body: body as Record<string, unknown> | undefined }))

export const catalogApi = {
  /** Public, active services with their questions, as the request form and provider profile see them. */
  publicTree: () => unwrap($api<ApiEnvelope<PublicServiceNode[]>>("/services")),

  /** Staff with `catalog.manage`. Includes inactive nodes and usage counts. */
  adminTree: () => unwrap($api<ApiEnvelope<AdminCatalog>>("/admin/catalog")),
  createService: (body: ServiceInput) => send<AdminServiceNode>("/admin/catalog/services", "POST", body),
  updateService: (id: string, body: ServicePatch) =>
    send<AdminServiceNode>(`/admin/catalog/services/${pathId(id)}`, "PATCH", body),
  deleteService: (id: string) => send<unknown>(`/admin/catalog/services/${pathId(id)}`, "DELETE"),
  reorderServices: (parentId: string | null, ids: string[]) =>
    send<unknown>("/admin/catalog/services/reorder", "PUT", { parentId, ids }),
  createQuestion: (serviceId: string, body: QuestionInput) =>
    send<AdminQuestion>(`/admin/catalog/services/${pathId(serviceId)}/questions`, "POST", body),
  updateQuestion: (id: string, body: QuestionPatch) =>
    send<AdminQuestion>(`/admin/catalog/questions/${pathId(id)}`, "PATCH", body),
  deleteQuestion: (id: string) => send<unknown>(`/admin/catalog/questions/${pathId(id)}`, "DELETE"),
  reorderQuestions: (serviceId: string, ids: string[]) =>
    send<unknown>(`/admin/catalog/services/${pathId(serviceId)}/questions/reorder`, "PUT", { ids }),
  saveSettings: (body: { maxDepth: number }) => send<{ maxDepth: number }>("/admin/catalog/settings", "PUT", body),
}
