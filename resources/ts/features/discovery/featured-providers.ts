import { intakeFields } from "@/features/operations/types"

export interface FeaturedProviderCard {
  id: string
  displayName: string
  trade: string
  services: string[]
  city: string
  areas: string[]
  photoUrl: string | null
  bio: string
  completedJobs: number
  experienceYears: number
}

export type FeaturedIneligibleReason =
  | "not_approved"
  | "inactive_account"
  | "reliability_review"
  | "recent_no_show"
  | "incomplete_profile"

export interface AdminFeaturedRow {
  providerId: string
  name: string
  businessName: string | null
  trade: string
  city: string
  completedJobs: number
  eligible: boolean
  ineligibleReasons: string[]
}

export interface AdminFeaturedPreviewItem extends FeaturedProviderCard {
  source: "pinned" | "default"
}

export interface AdminFeaturedState {
  revision: string
  limit: number
  pinned: AdminFeaturedRow[]
  hidden: AdminFeaturedRow[]
  preview: AdminFeaturedPreviewItem[]
  candidates: AdminFeaturedRow[]
}

export const ineligibleReasonLabels: Record<string, string> = {
  not_approved: "Not approved",
  inactive_account: "Account not active",
  reliability_review: "Reliability review open",
  recent_no_show: "Recent confirmed no-show",
  incomplete_profile: "Profile incomplete",
}

// A pin overrides every reason except these two, so the provider stays off the public page.
const blockingReasons = ["not_approved", "inactive_account"]

export const reasonLabel = (reason: string) => ineligibleReasonLabels[reason] ?? reason.replaceAll("_", " ")
export const isBlockingReason = (reason: string) => blockingReasons.includes(reason)

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? "")
    .join("") || "XP"

// The same validity check RequestForm uses for `?service=`: the key must be a known request service.
export const requestLocation = (provider: Pick<FeaturedProviderCard, "services" | "trade">) => {
  const service = [...provider.services, provider.trade].find(item => item in intakeFields)

  return service ? { path: "/request", query: { service } } : { path: "/request" }
}
