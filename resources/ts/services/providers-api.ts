import { $api } from "@/utils/api"
import type { Attachment, TimeOff, WorkingHours } from "@/features/operations/types"
import type { ProviderProfile } from "@/features/operations/types"
import type { ApiEnvelope } from "@/types/domain"

export type ProviderUploadPurpose = "provider_document" | "provider_photo" | "provider_portfolio"

export interface ProviderProfileResponse {
  id: string
  userId: string
  firstName?: string | null
  lastName?: string | null
  email?: string
  phone: string
  trade: string
  city: string
  services: string[]
  serviceAreas: string[]
  skills: Record<string, string[]>
  capacity: number
  workingHours: WorkingHours
  timeOff: TimeOff[]
  experience: number
  bio: string
  documents: Attachment[]
  photo: Attachment | null
  portfolio: Attachment[]
  verification: string
  available: boolean
  reviewNote?: string
  pendingChanges?: ProviderProfile["pendingChanges"]
  changesReview?: ProviderProfile["changesReview"]
  version: number
  payout: {
    current: (BankAccountResponse & { state: "verified" }) | null
    pending: (BankAccountResponse & { state: "pending" }) | null
  }
  history: { kind: string; decision: string; note?: string; createdAt: string }[]
}

interface BankAccountResponse {
  bankCode: string
  bankName: string
  accountNumber: string
  accountName: string
  submittedAt: string
}

export const providersApi = {
  me: () => $api<ApiEnvelope<{ verification: "draft"; profile: null } | ProviderProfileResponse>>("/providers/me"),
  banks: () => $api<ApiEnvelope<{ code: string; name: string }[]>>("/providers/banks"),
  resolveBank: (bankCode: string, accountNumber: string) =>
    $api<ApiEnvelope<{ bankName: string; accountName: string; last4: string }>>("/providers/banks/resolve", {
      method: "POST",
      body: { bankCode, accountNumber },
    }),
  upload: async (file: File, purpose: ProviderUploadPurpose): Promise<Attachment> => {
    const upload = await $api<ApiEnvelope<{ id: string; uploadUrl: string; method: "PUT"; headers: Record<string, string> }>>(
      "/providers/me/uploads",
      { method: "POST", body: { name: file.name, type: file.type, size: file.size, purpose } },
    )
    const response = await fetch(upload.data.uploadUrl, {
      method: upload.data.method,
      headers: upload.data.headers,
      body: file,
    })
    if (!response.ok) throw new Error("The file could not be uploaded. Try again.")
    const completed = await $api<ApiEnvelope<{ id: string; name: string; size: number; type: string }>>(
      `/providers/me/uploads/${upload.data.id}/complete`,
      { method: "POST" },
    )

    return { id: completed.data.id, name: completed.data.name, size: completed.data.size, type: completed.data.type }
  },
  deleteUpload: (id: string) => $api<ApiEnvelope<{ deleted: boolean }>>(`/providers/me/uploads/${id}`, { method: "DELETE" }),
  fileUrl: (id: string, providerId?: string) =>
    $api<ApiEnvelope<{ url: string; expiresInSeconds: number }>>(
      providerId ? `/admin/providers/${providerId}/files/${id}` : `/providers/me/files/${id}`,
    ),
  submit: (payload: {
    phone: string
    trade: string
    city: string
    services: string[]
    serviceAreas: string[]
    skills: Record<string, string[]>
    capacity: number
    workingHours: WorkingHours
    experience: number
    bio: string
    documents: Attachment[]
    photo: Attachment
    portfolio: Attachment[]
    bankCode: string
    accountNumber: string
  }) => $api<ApiEnvelope<ProviderProfileResponse>>("/providers/me/submissions", { method: "POST", body: payload }),
  updateBank: (bankCode: string, accountNumber: string) =>
    $api<ApiEnvelope<ProviderProfileResponse>>("/providers/me/bank", { method: "POST", body: { bankCode, accountNumber } }),
  setAvailability: (available: boolean) =>
    $api<ApiEnvelope<ProviderProfileResponse>>("/providers/me/availability", { method: "PUT", body: { available } }),
  setCalendar: (workingHours: WorkingHours, timeOff: TimeOff[]) =>
    $api<ApiEnvelope<ProviderProfileResponse>>("/providers/me/calendar", { method: "PUT", body: { workingHours, timeOff } }),
  listForReview: (verification?: string) =>
    $api<ApiEnvelope<ProviderProfileResponse[]>>("/admin/providers", { query: verification ? { verification } : undefined }),
  review: (providerId: string, decision: "approved" | "changes_requested" | "rejected", note: string, expectedVersion: number) =>
    $api<ApiEnvelope<ProviderProfileResponse>>(`/admin/providers/${providerId}/reviews`, {
      method: "POST",
      body: { decision, note, expectedVersion },
    }),
  reviewBank: (providerId: string, approve: boolean, note: string, expectedVersion: number) =>
    $api<ApiEnvelope<ProviderProfileResponse>>(`/admin/providers/${providerId}/bank/review`, {
      method: "POST",
      body: { approve, note, expectedVersion },
    }),
  reviewChanges: (providerId: string, approve: boolean, note: string, expectedVersion: number) =>
    $api<ApiEnvelope<ProviderProfileResponse>>(`/admin/providers/${providerId}/changes/review`, {
      method: "POST",
      body: { approve, note, expectedVersion },
    }),
}
