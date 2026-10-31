import type { AssignmentMode, AssignmentWeights } from "@/features/operations/types"
import type { ExclusionRule } from "@/features/operations/workflow"

/** Presentation helpers for the dispatch, settings and offer screens. No business rules live here. */
export const factorLabels: Record<keyof AssignmentWeights, string> = {
  skill: "Skill match",
  area: "Area",
  capacity: "Spare capacity",
  fairness: "Fairness",
  experience: "Experience",
}
export const factorHints: Record<keyof AssignmentWeights, string> = {
  skill: "Has the exact skill the request needs",
  area: "Names the request’s district, not just the city",
  capacity: "Fewer active jobs than their limit",
  fairness: "Longest since XPro last offered them work",
  experience: "Years of experience, capped at 20",
}
export const factorKeys = Object.keys(factorLabels) as (keyof AssignmentWeights)[]
export const modeLabels: Record<AssignmentMode, string> = { auto: "Auto", manual: "Manual" }

export const exclusionLabels: Record<ExclusionRule, string> = {
  verification: "Not verified",
  service: "Other service",
  available: "Paused",
  area: "Area",
  day: "Day off",
  skill: "Skill",
  capacity: "At capacity",
  overlap: "Booked",
  previous: "Already offered",
  bank: "Bank not verified",
}

/** Rules that hide a provider by default: they say nothing useful to a dispatcher. */
export const quietRules: ExclusionRule[] = ["verification", "service"]

/** A manual offer needs an approved, available provider for the service, so these exclusions cannot be overridden. */
export const unofferableRules: ExclusionRule[] = ["verification", "service", "available"]

export const exclusionWarning: Record<ExclusionRule, string> = {
  verification: "This provider is not verified.",
  service: "This provider does not offer this service.",
  available: "This provider has paused new jobs.",
  area: "They do not normally cover this area.",
  day: "They are not working on the requested start day.",
  skill: "They have not listed the skill this request needs.",
  capacity: "This would take them over their job capacity.",
  overlap: "They are booked around the requested start time.",
  previous: "They already declined, or let an offer lapse, for this request.",
  bank: "XPro cannot pay them until Finance verifies their bank details.",
}

/** The time left on an offer, e.g. `23 h 10 min`. `expired` is true once `expiresAt` has passed. */
export const offerExpiry = (expiresAt: string, nowMs: number): { expired: boolean; left: string } => {
  const ms = Date.parse(expiresAt) - nowMs

  if (!expiresAt || Number.isNaN(ms)) return { expired: false, left: "" }
  if (ms <= 0) return { expired: true, left: "" }

  const minutes = Math.ceil(ms / 60000)

  if (minutes < 60) return { expired: false, left: `${minutes} min` }

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  if (hours >= 48) return { expired: false, left: `${Math.floor(hours / 24)} days` }

  return { expired: false, left: rest ? `${hours} h ${rest} min` : `${hours} h` }
}

/** Tidy score for display: one decimal, no trailing zero. */
export const scoreText = (total: number) => String(Number(total.toFixed(1)))
