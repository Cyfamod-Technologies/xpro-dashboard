import type { UserRole } from "@/types/domain"

import type { StaffPermission } from "@/features/operations/types"

export type WorkspaceRole = "customer" | "provider" | "admin"

export interface WorkspaceSection {
  id: string
  title: string
  icon: string
  description: string
  emptyMessage: string
  permission?: StaffPermission
  /** Shown when the staff member holds at least one of these. */
  anyPermission?: StaffPermission[]
}

export const isWorkspaceRole = (role?: UserRole): role is WorkspaceRole =>
  role === "customer" || role === "provider" || role === "admin"

// Keep the section definitions and feature components in place for later releases.
// V1 exposes only the smaller workspace through navigation and route checks. Who sees which section, per V1 actor
// (customer, admin, staff, provider), is `v1Sections` in `features/v1/access.ts`; these lists switch whole sections off.
// V1 keeps admin Finance (`finance`) implemented but hidden; refund/payout operations are Phase 2.
export const v1Workspace = {
  disabledSections: {
    customer: ["quotes", "schedule", "notifications"],
    provider: ["quotes", "schedule", "messages", "notifications"],
    admin: ["approvals", "dispatch", "quotes", "schedule", "audit", "notifications"],
  },
  admin: {
    leaveAndCover: false,
    advancedSettings: false,
    changeReason: false,
    settingsHistory: false,
    emailPreferences: false,
    customerMessagesOnly: true,
    // Payouts require verified destinations, so keep bank review in the V1 admin workflow.
    bankReview: true,
  },
} as const

export const sectionEnabled = (role: WorkspaceRole, id: string): boolean =>
  !(v1Workspace.disabledSections[role] as readonly string[]).includes(id)

const section = (
  id: string,
  title: string,
  icon: string,
  description: string,
  emptyMessage: string,
  permission?: StaffPermission,
): WorkspaceSection => ({ id, title, icon, description, emptyMessage, ...(permission ? { permission } : {}) })

const account = section(
  "account",
  "Account",
  "tabler-user",
  "Your personal details and account preferences.",
  "Your account details are shown below.",
)

const settings = section(
  "settings",
  "Settings",
  "tabler-settings",
  "Manage your account, profile and verification details.",
  "Your settings will appear here.",
)

const adminSettings: WorkspaceSection = {
  ...settings,
  description: "Manage your profile, platform rules and customer service locations.",
}

const messages = section(
  "messages",
  "Messages",
  "tabler-message-circle",
  "Stay connected with the XPro team about your work.",
  "Your conversations with XPro will appear here.",
)

// The V1 admin inbox is limited to the customer channel.
const adminMessages: WorkspaceSection = {
  ...messages,
  description: "Customer conversations about requests in one place.",
  emptyMessage: "No customer conversations yet.",
  anyPermission: ["message.customer"],
}

/** True when the viewer may see a sidebar item or open its page. */
export const sectionAllowed = (
  role: WorkspaceRole,
  item: WorkspaceSection,
  can: (permission: StaffPermission) => boolean,
): boolean =>
  sectionEnabled(role, item.id) &&
  (!item.permission || can(item.permission)) &&
  (!item.anyPermission || item.anyPermission.some(can))

const quotes = section(
  "quotes",
  "Quotes",
  "tabler-file-invoice",
  "Keep scope, pricing and quote decisions in one place.",
  "Quotes will appear here when a request is ready for pricing.",
)

const schedule = section(
  "schedule",
  "Schedule",
  "tabler-calendar",
  "Coordinate dates and keep track of confirmed appointments.",
  "Your upcoming appointments will appear here.",
)

export const workspaceSections: Record<WorkspaceRole, WorkspaceSection[]> = {
  customer: [
    section(
      "overview",
      "Overview",
      "tabler-layout-dashboard",
      "Your requests and the next steps awaiting your attention.",
      "Your activity will appear here.",
    ),
    section(
      "requests",
      "My requests",
      "tabler-clipboard-list",
      "Follow your request and Xpro's decision in one place.",
      "Your service requests will appear here.",
    ),
    quotes,
    section(
      "payments",
      "Payments",
      "tabler-credit-card",
      "Review amounts due, payment status and receipts for your requests.",
      "Payment details will appear here when a quote is accepted.",
    ),
    schedule,
    messages,
    section(
      "notifications",
      "Notifications",
      "tabler-bell",
      "Updates about your requests and assignments.",
      "You are all caught up.",
    ),
    settings,
    account,
  ],
  provider: [
    section(
      "overview",
      "Overview",
      "tabler-layout-dashboard",
      "Requests assigned to you for review and customer coordination.",
      "Your activity will appear here.",
    ),
    section(
      "verification",
      "Profile & verification",
      "tabler-shield-check",
      "Introduce your services and submit your verification documents.",
      "Your provider profile and verification documents will appear here.",
    ),
    section(
      "jobs",
      "My jobs",
      "tabler-briefcase",
      "Review assigned requests and coordinate with the customer.",
      "New assignments and accepted jobs will appear here.",
    ),
    section(
      "quotes",
      "Costings",
      "tabler-file-invoice",
      "Submit provider costings and follow quote decisions.",
      "Costing requests will appear here when assigned work needs pricing.",
    ),
    section(
      "availability",
      "Availability",
      "tabler-clock",
      "Set your availability for new assignments.",
      "Your availability preferences will appear here.",
    ),
    section(
      "payouts",
      "Earnings",
      "tabler-wallet",
      "Review your payout history and payment status.",
      "Your earnings will appear here when a payout is created.",
    ),
    schedule,
    messages,
    section(
      "notifications",
      "Notifications",
      "tabler-bell",
      "Updates about your requests and assignments.",
      "You are all caught up.",
    ),
    settings,
    account,
  ],
  admin: [
    section(
      "overview",
      "Overview",
      "tabler-layout-dashboard",
      "Everything awaiting XPro action across the platform.",
      "Platform activity will appear here.",
    ),
    section(
      "approvals",
      "Approvals",
      "tabler-checklist",
      "Everything waiting for an XPro decision.",
      "Nothing is waiting for approval.",
    ),
    section(
      "requests",
      "Requests",
      "tabler-clipboard-list",
      "Review incoming briefs and coordinate the next action.",
      "Customer requests awaiting review will appear here.",
    ),
    section(
      "providers",
      "Providers",
      "tabler-users",
      "Review profiles, verification documents and service areas.",
      "Provider submissions and approved profiles will appear here.",
    ),
    section(
      "dispatch",
      "Dispatch",
      "tabler-route",
      "Match verified providers to requests and follow their responses.",
      "Xpro staff coordinate provider assignments for each request.",
    ),
    quotes,
    section(
      "finance",
      "Payments",
      "tabler-credit-card",
      "Reconcile payments and review refunds and payouts.",
      "There are no finance items waiting for review.",
      "payment.record",
    ),
    schedule,
    adminMessages,
    section(
      "audit",
      "Activity history",
      "tabler-history",
      "Follow the decisions made across requests, quotes and jobs.",
      "Operational actions and their history will appear here.",
    ),
    section(
      "services",
      "Service catalog",
      "tabler-category",
      "Create and organise the services customers can request, and the questions they answer.",
      "Services will appear here.",
      "catalog.manage",
    ),
    section(
      "staff",
      "Staff",
      "tabler-user-shield",
      "Invite staff, manage roles and suspend access.",
      "Staff accounts will appear here.",
      "staff.manage",
    ),
    section(
      "notifications",
      "Notifications",
      "tabler-bell",
      "Updates about your requests and assignments.",
      "You are all caught up.",
    ),
    adminSettings,
  ],
}

export const sectionPath = (role: WorkspaceRole, id: string): string =>
  role === "admin" ? (id === "overview" ? "/admin" : `/admin/${id}`) : `/${id}`

export const homePathFor = (role: WorkspaceRole): string => (role === "admin" ? "/admin" : "/overview")

export const serviceLines = [
  { name: "Design", description: "Architectural, structural and interior plans." },
  { name: "Construction", description: "Construction, finishes and renovation." },
  { name: "Hire", description: "Professionals, trades and heavy equipment." },
  { name: "Procurement", description: "Materials and fittings for your site." },
  { name: "Facility management", description: "Maintenance and property support." },
  { name: "Waste management", description: "Waste collection and site clearance." },
]
