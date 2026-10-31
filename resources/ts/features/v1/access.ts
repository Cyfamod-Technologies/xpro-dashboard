import type { V1Actor } from "@/features/v1/types"

// Pure V1 access rules. No Vue or Vuetify imports, so tests/v1-access.mts can run it.

/** The scope that makes an admin-role account the V1 admin; every other admin-role account is V1 staff. */
export const adminScope = "staff.manage"

interface ActorSource {
  role: string
  scopes: readonly string[]
}

/** The V1 actor behind a signed-in account, or null for an unknown role. */
export const v1Actor = (user: ActorSource | null | undefined): V1Actor | null => {
  if (!user) return null
  if (user.role === "customer" || user.role === "provider") return user.role
  if (user.role === "admin") return user.scopes.includes(adminScope) ? "admin" : "staff"

  return null
}

/** Sidebar sections each actor sees, in menu order. Ids match `workspaceSections` in `workspace/config.ts`. */
export const v1Sections: Record<V1Actor, readonly string[]> = {
  customer: ["overview", "requests", "messages", "settings"],
  admin: ["overview", "requests", "messages", "providers", "finance", "services", "staff", "settings"],
  // Staff "Account" is the admin profile page, which lives under the `settings` section id.
  staff: ["requests", "settings"],
  provider: ["overview", "availability", "jobs", "settings"],
}

/** Section ids that are ordinary route pages for the actor (the router and the nav both ask this). */
export const v1RouteAllowed = (actor: V1Actor | null, sectionId: string): boolean =>
  actor !== null && v1Sections[actor].includes(sectionId)

const staffTitles: Record<string, string> = { requests: "My assigned requests", settings: "Account" }

/** Menu and page title: staff see "My assigned requests" and "Account" where the admin sees "Requests" and "Settings". */
export const v1SectionTitle = (actor: V1Actor | null, sectionId: string, fallback: string): string =>
  actor === "staff" ? (staffTitles[sectionId] ?? fallback) : fallback

const staffDescriptions: Record<string, string> = {
  requests: "Requests assigned to you. Chat with the customer and send quotes; an admin makes the decision.",
  settings: "Your name, email and sign-in security.",
}
const providerDescriptions: Record<string, string> = {
  settings: "Manage your account, provider profile and verification details.",
}
const customerDescriptions: Record<string, string> = {
  settings: "Manage your personal details and account settings.",
}

export const v1SectionDescription = (actor: V1Actor | null, sectionId: string, fallback: string): string =>
  actor === "staff"
    ? (staffDescriptions[sectionId] ?? fallback)
    : actor === "provider"
      ? (providerDescriptions[sectionId] ?? fallback)
      : actor === "customer"
        ? (customerDescriptions[sectionId] ?? fallback)
        : fallback

const actorLabels: Record<V1Actor, string> = {
  customer: "Customer",
  admin: "Admin",
  staff: "Staff",
  provider: "Provider",
}

/** The role chip in the header and account menu. */
export const v1RoleLabel = (actor: V1Actor | null): string => (actor ? actorLabels[actor] : "")

/** The first page a signed-in actor opens. Staff have no overview. */
export const v1HomePath = (actor: V1Actor | null): string =>
  actor === "admin" ? "/admin" : actor === "staff" ? "/admin/requests" : "/overview"

export interface V1Capabilities {
  /** Approve a Submitted request (admins and its assigned staff member). */
  canDecide: boolean
  /** Deny a Submitted request (admins only). */
  canDeny: boolean
  /** Assign or reassign the responsible staff member (assumption A5: at any status). */
  canAssignStaff: boolean
  /** Start a counter card with "Send quote". */
  canSendQuote: boolean
  /** Replace the provider on an approved request. */
  canReplaceProvider: boolean
  /** Write in the customer conversation. */
  canChat: boolean
}

export const v1Capabilities = (actor: V1Actor | null): V1Capabilities => ({
  canDecide: actor === "admin" || actor === "staff",
  canDeny: actor === "admin",
  canAssignStaff: actor === "admin",
  canSendQuote: actor === "admin" || actor === "staff",
  canReplaceProvider: actor === "admin" || actor === "staff",
  canChat: actor === "admin" || actor === "staff" || actor === "customer",
})

/** The V1 screen that replaces the generic section content, or null when an existing component renders it. */
export type V1View = "overview" | "requests" | "messages" | "jobs"

export const v1ViewFor = (actor: V1Actor | null, sectionId: string): V1View | null => {
  if (!actor || !v1RouteAllowed(actor, sectionId)) return null
  if (sectionId === "overview") return "overview"
  if (sectionId === "requests") return "requests"
  if (sectionId === "messages") return actor === "customer" || actor === "admin" ? "messages" : null
  if (sectionId === "jobs") return actor === "provider" ? "jobs" : null

  return null
}

/** The sections a nav menu shows for the actor, in order, from the sections the workspace defines. */
export const v1Nav = <T extends { id: string }>(actor: V1Actor | null, sections: readonly T[]): T[] =>
  actor
    ? v1Sections[actor].flatMap(id => {
        const found = sections.find(item => item.id === id)

        return found ? [found] : []
      })
    : []
