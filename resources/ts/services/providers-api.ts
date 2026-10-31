import { $api } from "@/utils/api"
import type { Attachment, ProviderProfile, TimeOff, WorkingHours } from "@/features/operations/types"
import type { ApiEnvelope } from "@/types/domain"

export type ProviderUploadPurpose = "provider_document" | "provider_photo" | "provider_portfolio" | "payment_proof"

export interface ProviderProfileResponse {
  id: string
  userId: string
  businessName?: string | null
  firstName?: string | null
  lastName?: string | null
  email?: string
  phone: string
  trade: string
  city: string
  state?: string | null
  services: string[]
  serviceIds: string[]
  serviceAreas: string[]
  skills: Record<string, string[]>
  skillIds: Record<string, string[]>
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
  bankReviewState?: "pending" | "verified" | "rejected" | "none"
  history: { kind: string; decision: string; note?: string; fields?: string[]; createdAt: string }[]
}

export interface ProviderSignupResponse {
  userId: string
  firstName?: string | null
  lastName?: string | null
  email: string
  profileStarted: false
  accountStatus: string
  registeredAt: string
}

export type ProviderReviewResponse = ProviderProfileResponse | ProviderSignupResponse

export interface ProviderPage<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export type ProviderAdminDetail = Omit<ProviderProfileResponse, "history" | "payout"> & {
  accountStatus: string
  firstName?: string | null
  lastName?: string | null
  email: string
  registeredAt: string
  reliabilityStatus: string
  lastOfferedAt: string | null
  activeJobs: number
  phoneVerifiedAt: string | null
  evidenceSummary: { documentCount: number; hasPhoto: boolean; pendingDocumentCount: number; hasPendingPhoto: boolean }
  payout: ProviderProfileResponse["payout"] & {
    review?: { state: string; note?: string }
    history: Array<{ action: string; note?: string; by: string; createdAt: string }>
  }
  reliabilityEvents: Array<{
    id: string
    kind: string
    requestId: string | null
    occurredAt: string
    note: string | null
  }>
  history: Array<{ kind: string; decision: string; note?: string; actorId: string; createdAt: string; version: number }>
}

export interface ProviderListQuery {
  verification?: string
  bankReview?: "pending" | "verified" | "rejected" | "none"
  q?: string
  page?: number
  limit?: number
}

interface BankAccountResponse {
  bankCode: string
  bankName: string
  accountNumber: string
  accountName: string
  submittedAt: string
}

export const providersApi = {
  onboardingPolicy: () =>
    $api<ApiEnvelope<{ phoneVerificationRequired: boolean; emailVerificationRequired: boolean }>>(
      "/providers/me/onboarding-policy",
    ),
  me: () => $api<ApiEnvelope<{ verification: "draft"; profile: null } | ProviderProfileResponse>>("/providers/me"),
  banks: () => $api<ApiEnvelope<{ code: string; name: string }[]>>("/providers/banks"),
  resolveBank: (bankCode: string, accountNumber: string) =>
    $api<ApiEnvelope<{ bankName: string; accountName: string; last4: string }>>("/providers/banks/resolve", {
      method: "POST",
      body: { bankCode, accountNumber },
    }),
  // Provider onboarding files use the provider upload routes (their purposes are not in the `/uploads` enum);
  // `payment_proof` is a request-flow purpose and stays on `/uploads`.
  upload: async (file: File, purpose: ProviderUploadPurpose): Promise<Attachment> => {
    const base = purpose === "payment_proof" ? "/uploads" : "/providers/me/uploads"
    const upload = await $api<
      ApiEnvelope<{ id: string; uploadUrl: string; method: "PUT"; headers: Record<string, string> }>
    >(base, { method: "POST", body: { name: file.name, type: file.type, size: file.size, purpose } })
    const response = await fetch(upload.data.uploadUrl, {
      method: upload.data.method,
      headers: upload.data.headers,
      body: file,
    })
    if (!response.ok) throw new Error("The file could not be uploaded. Try again.")
    const completed = await $api<ApiEnvelope<{ id: string; name: string; size: number; type: string }>>(
      `${base}/${upload.data.id}/complete`,
      { method: "POST" },
    )

    return { id: completed.data.id, name: completed.data.name, size: completed.data.size, type: completed.data.type }
  },
  deleteUpload: (id: string) =>
    $api<ApiEnvelope<{ deleted: boolean }>>(`/providers/me/uploads/${id}`, { method: "DELETE" }),
  fileUrl: (id: string, providerId?: string) =>
    $api<ApiEnvelope<{ url: string; expiresInSeconds: number }>>(
      providerId ? `/admin/providers/${providerId}/files/${id}` : `/providers/me/files/${id}`,
    ),
  submit: (payload: {
    phone: string
    trade: string
    city: string
    state?: string
    serviceIds: string[]
    serviceAreas: string[]
    skillIds: Record<string, string[]>
    capacity: number
    workingHours: WorkingHours
    experience: number
    bio: string
    documents: Attachment[]
    photo: Attachment
    portfolio: Attachment[]
    bankCode?: string
    accountNumber?: string
  }) => $api<ApiEnvelope<ProviderProfileResponse>>("/providers/me/submissions", { method: "POST", body: payload }),
  updateBank: (bankCode: string, accountNumber: string) =>
    $api<ApiEnvelope<ProviderProfileResponse>>("/providers/me/bank", {
      method: "POST",
      body: { bankCode, accountNumber },
    }),
  setAvailability: (available: boolean) =>
    $api<ApiEnvelope<ProviderProfileResponse>>("/providers/me/availability", { method: "PUT", body: { available } }),
  setCalendar: (workingHours: WorkingHours, timeOff: TimeOff[]) =>
    $api<ApiEnvelope<ProviderProfileResponse>>("/providers/me/calendar", {
      method: "PUT",
      body: { workingHours, timeOff },
    }),
  listForReview: (params: ProviderListQuery = {}) =>
    $api<ApiEnvelope<ProviderPage<ProviderReviewResponse>>>("/admin/providers", {
      query: params,
    }),
  detailForReview: (providerId: string) =>
    $api<ApiEnvelope<ProviderAdminDetail>>(`/admin/providers/${encodeURIComponent(providerId)}`),
  review: (
    providerId: string,
    decision: "approved" | "changes_requested" | "rejected",
    note: string,
    expectedVersion: number,
  ) =>
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
  reviewReliability: (providerId: string, decision: "clear" | "restrict", note: string) =>
    $api<ApiEnvelope<ProviderAdminDetail>>(`/admin/providers/${encodeURIComponent(providerId)}/reliability/review`, {
      method: "POST",
      body: { decision, note },
    }),
  delist: (providerId: string, reason: string, expectedVersion: number, reauthToken: string) =>
    $api<ApiEnvelope<ProviderAdminDetail>>(`/admin/providers/${encodeURIComponent(providerId)}/delist`, {
      method: "POST",
      body: { reason, expectedVersion },
      headers: { "X-Reauth-Token": reauthToken },
    }),
  reinstate: (providerId: string, reason: string, expectedVersion: number) =>
    $api<ApiEnvelope<ProviderAdminDetail>>(`/admin/providers/${encodeURIComponent(providerId)}/reinstate`, {
      method: "POST",
      body: { reason, expectedVersion },
    }),
  revealIdentity: (providerId: string, reason: string) =>
    $api<
      ApiEnvelope<
        Array<{
          id: string
          name: string
          size: number
          type: string
          purpose: string
          url: string
          expiresInSeconds: number
        }>
      >
    >(`/admin/providers/${encodeURIComponent(providerId)}/identity/reveal`, { method: "POST", body: { reason } }),
  revealBankDetails: (providerId: string, reason: string) =>
    $api<
      ApiEnvelope<
        Array<{
          id: string
          bankName: string
          accountName: string
          accountNumber: string
          state: string
          submittedAt: string
        }>
      >
    >(`/admin/providers/${encodeURIComponent(providerId)}/bank/reveal`, { method: "POST", body: { reason } }),
}
