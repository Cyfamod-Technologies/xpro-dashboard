import type { WorkspaceRole } from "@/features/workspace/config"

export type ServiceLine =
  "Design" | "Construction" | "Hire" | "Procurement" | "Facility management" | "Waste management"
export type RequestStatus =
  | "submitted"
  | "under_review"
  | "matched"
  | "quoted"
  | "scheduled"
  | "in_progress"
  | "blocked"
  | "completion_pending"
  | "acknowledged"
  | "closed"
  | "cancelled"
  | "rejected"
export type VerificationStatus = "draft" | "pending" | "changes_requested" | "approved" | "rejected"
export type QuoteStatus = "draft" | "sent" | "accepted" | "declined" | "revision_requested" | "superseded"
export type ContactMethod = "email" | "phone" | "both"
export type Channel = "customer" | "provider" | "internal"
export type StaffRole = "super_admin" | "operations" | "pricing" | "client_relations" | "finance"
export type StaffPermission =
  | "request.claim"
  | "request.review"
  | "request.cancel"
  | "request.flag"
  | "request.reassign"
  | "provider.review"
  | "view.provider_identity"
  | "view.bank_full"
  | "dispatch.manage"
  | "quote.manage"
  | "quote.approve"
  | "schedule.manage"
  | "issue.resolve"
  | "request.close"
  | "message.customer"
  | "message.provider"
  | "message.internal"
  | "progress.review"
  | "staff.manage"
  | "staff.mfa.reset"
  | "settings.manage"
  | "catalog.manage"
  | "bank.review"
  | "payment.record"
  | "payout.approve"
  | "refund.manage"
  | "view.pricing"

export type ReviewState = "pending" | "approved" | "rejected"
export interface Review {
  state: ReviewState
  by: string
  note: string
  at: string
}
export interface CancellationRequest {
  note: string
  requestedAt: string
  review: Review
}
export interface Actor {
  id: string
  name: string
  email: string
  role: WorkspaceRole
}
export interface BankAccount {
  bankCode: string
  bankName: string
  accountNumber: string
  accountName: string
  submittedAt: string
}
export interface BankInput {
  bankCode: string
  accountNumber: string
  accountName: string
}
export interface Attachment {
  id: string
  name: string
  size: number
  type: string
  dataUrl?: string
  downloadUrl?: string
}

/** `rate` is the unit price in kobo (a positive safe integer). */
export interface QuoteItem {
  description: string
  quantity: number
  rate: number
}
export interface Quote {
  id: string
  version: number
  status: QuoteStatus
  items: QuoteItem[]
  total: number
  note: string
  createdAt: string
  responseNote: string
  approvalRequestedBy: string
  publishedBy: string
}
export interface Contribution {
  id: string
  providerId: string
  items: QuoteItem[]
  total: number
  note: string
  createdAt: string
}
export type AssignmentMode = "auto" | "manual"
export interface AssignmentScore {
  total: number
  factors: Record<string, number>
}
export interface Assignment {
  id: string
  providerId: string
  status: "offered" | "pending_approval" | "accepted" | "declined" | "withdrawn" | "expired"
  note: string
  response: string
  createdAt: string
  source: AssignmentMode
  attempt: number
  score: AssignmentScore | null
  expiresAt: string
}
export interface Dispatch {
  mode: AssignmentMode
  attempts: number
  needsManual: boolean
}
export interface Schedule {
  id: string
  startAt: string
  note: string
  quoteId: string
  status: "proposed" | "confirmed" | "changes_requested" | "cancelled"
  customer: "pending" | "accepted" | "changes_requested"
  provider: "pending" | "accepted" | "changes_requested"
  responses: string[]
}
export interface ProgressUpdate {
  id: string
  authorId: string
  author: string
  status: RequestStatus
  note: string
  attachments: Attachment[]
  createdAt: string
  review: Review
}
export interface Message {
  id: string
  authorId: string
  author: string
  authorRole: WorkspaceRole
  channel: Channel
  providerId?: string
  text: string
  attachments: Attachment[]
  createdAt: string
}
export interface Issue {
  id: string
  note: string
  status: "open" | "resolved"
  resolution: string
  createdAt: string
}
export interface ServiceRequest {
  id: string
  ownerId: string
  customer: string
  title: string
  service: ServiceLine
  city: string
  address: string
  phone: string
  contactMethod?: ContactMethod
  description: string
  budget: number
  startDate: string
  details: Record<string, string>
  attachments: Attachment[]
  status: RequestStatus
  createdAt: string
  staffOwnerId: string
  claimedAt: string
  flag: string
  assignments: Assignment[]
  contributions: Contribution[]
  quotes: Quote[]
  schedules: Schedule[]
  updates: ProgressUpdate[]
  messages: Message[]
  issues: Issue[]
  dispatch: Dispatch
  cancellationRequest: CancellationRequest | null
}
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"

/** 'HH:MM' in WAT (Africa/Lagos). */
export interface DayHours {
  start: string
  end: string
}
export type WorkingHours = Record<Weekday, DayHours | null>
export interface TimeOff {
  id: string
  from: string
  to: string
  note: string
}
export type ProviderSkills = Partial<Record<ServiceLine, string[]>>
export interface PendingProfileChanges {
  trade: string
  services: ServiceLine[]
  serviceAreas: string[]
  skills: ProviderSkills

  /** Catalog ids behind `services` and `skills`. Live mode only; the names above are what gets shown. */
  serviceIds?: string[]
  skillIds?: Record<string, string[]>
  capacity: number
  documents: Attachment[]
  photo: Attachment | null
  submittedAt: string
}
export interface ProviderProfile {
  id: string
  serverId?: string
  version?: number
  registrationOnly?: boolean
  accountStatus?: string
  registeredAt?: string
  name: string
  email: string
  phone: string
  trade: string
  city: string
  state?: string | null
  services: ServiceLine[]
  serviceAreas: string[]
  skills: ProviderSkills
  serviceIds?: string[]
  skillIds?: Record<string, string[]>

  /** Maximum number of active jobs, 1 to 20. */
  capacity: number

  /** When XPro last offered this provider a job. Empty when never. Used for fairness. */
  lastOfferedAt: string
  workingHours: WorkingHours
  timeOff: TimeOff[]
  experience: number
  bio: string
  rating: number
  reviewCount: number
  portfolio: Attachment[]
  available: boolean
  verification: VerificationStatus
  documents: Attachment[]
  reviewNote: string
  history: { kind?: string; status: VerificationStatus; note: string; fields?: string[]; createdAt: string }[]
  photo: Attachment | null
  pendingChanges: PendingProfileChanges | null
  changesReview: Review | null
  payout: {
    current: BankAccount | null
    pending: BankAccount | null
    review: Review | null
    history: { action: string; by: string; byId: string; note: string; createdAt: string }[]
  }
}
export interface Preferences {
  name: string
  phone: string
  email: boolean
  push: boolean
  inApp: boolean
  timezone: string
}
export interface Notification {
  id: string
  recipientId: string
  title: string
  message: string
  requestId?: string
  createdAt: string
  read: boolean
  channels: string[]
}
export interface AuditEntry {
  id: string
  actor: string
  actorId: string
  action: string
  resource: string
  note: string
  requestId?: string
  createdAt: string
}
export interface StaffMember {
  id: string
  name: string
  email: string
  roles: StaffRole[]
  status: "active" | "invited" | "suspended"
  invitedAt: string
  history: { action: string; by: string; byId: string; createdAt: string }[]
}
export interface AssignmentWeights {
  skill: number
  area: number
  capacity: number
  fairness: number
  experience: number
}
export interface AssignmentSettings {
  modeByService: Record<ServiceLine, AssignmentMode>
  offerExpiryHours: number
  maxAutoAttempts: number
  weights: AssignmentWeights
  requireVerifiedBank: boolean
}
export interface OperationsSettings {
  quoteApprovalThreshold: number | null
  assignment: AssignmentSettings
}
export interface OperationsState {
  schema: 6
  nextRequest: number
  requests: ServiceRequest[]
  providers: ProviderProfile[]
  notifications: Notification[]
  audit: AuditEntry[]
  preferences: Record<string, Preferences>
  staff: StaffMember[]
  settings: OperationsSettings
}
export interface RequestInput {
  title: string
  service: ServiceLine
  city: string
  address: string
  phone: string
  contactMethod?: ContactMethod
  description: string
  budget: number
  startDate: string
  details: Record<string, string>
  attachments: Attachment[]
}
export interface ProviderInput {
  phone: string
  trade: string
  city: string
  /** Chosen with `city` from the built-in Nigeria list; sent for live profiles. */
  state?: string
  services: ServiceLine[]
  serviceAreas: string[]
  skills: ProviderSkills
  serviceIds?: string[]
  skillIds?: Record<string, string[]>
  capacity: number
  workingHours: WorkingHours
  experience: number
  bio: string
  documents: Attachment[]
  portfolio: Attachment[]
  photo: Attachment | null
  bank: BankInput
}

export type Command =
  | { type: "request.create"; input: RequestInput }
  | { type: "request.review"; requestId: string; clarify: boolean; note: string }
  | { type: "request.cancel"; requestId: string; note: string }
  | { type: "request.reject"; requestId: string; note: string }
  | { type: "request.claim"; requestId: string }
  | { type: "request.reassign"; requestId: string; staffId: string; note: string }
  | { type: "request.flag"; requestId: string; note: string }
  | { type: "provider.submit"; input: ProviderInput }
  | {
      type: "provider.review"
      providerId: string
      decision: "approved" | "changes_requested" | "rejected"
      note: string
    }
  | { type: "provider.changes.review"; providerId: string; approve: boolean; note: string }
  | { type: "provider.availability"; available: boolean }
  | { type: "provider.hours"; workingHours: WorkingHours; timeOff: (Omit<TimeOff, "id"> & { id?: string })[] }
  | { type: "payout.update"; bank: BankInput }
  | { type: "payout.review"; providerId: string; approve: boolean; note: string }
  | { type: "assignment.offer"; requestId: string; providerId: string; note: string; overrideNote?: string }
  | { type: "assignment.auto"; requestId: string }
  | { type: "assignment.expire"; requestId: string; assignmentId: string }
  | { type: "assignment.respond"; requestId: string; assignmentId: string; accept: boolean; note: string }
  | { type: "assignment.review"; requestId: string; assignmentId: string; approve: boolean; note: string }
  | { type: "assignment.withdraw"; requestId: string; assignmentId: string; note: string }
  | { type: "quote.contribute"; requestId: string; items: QuoteItem[]; note: string }
  | { type: "quote.save"; requestId: string; quoteId?: string; items: QuoteItem[]; note: string }
  | { type: "quote.publish"; requestId: string; quoteId: string }
  | {
      type: "quote.respond"
      requestId: string
      quoteId: string
      decision: "accepted" | "declined" | "revision_requested"
      note: string
    }
  | { type: "schedule.propose"; requestId: string; startAt: string; note: string }
  | { type: "schedule.respond"; requestId: string; scheduleId: string; accept: boolean; note: string }
  | {
      type: "progress.add"
      requestId: string
      status: "in_progress" | "blocked" | "completion_pending"
      note: string
      attachments: Attachment[]
    }
  | { type: "progress.review"; requestId: string; updateId: string; approve: boolean; note: string }
  | { type: "cancellation.review"; requestId: string; approve: boolean; note: string }
  | { type: "completion.respond"; requestId: string; acknowledge: boolean; note: string }
  | { type: "issue.resolve"; requestId: string; issueId: string; note: string }
  | { type: "request.close"; requestId: string }
  | { type: "message.send"; requestId: string; channel: Channel; text: string; attachments: Attachment[] }
  | { type: "notification.read"; notificationId?: string }
  | { type: "preferences.save"; input: Preferences }
  | { type: "staff.invite"; firstName: string; lastName: string; email: string; roles: StaffRole[] }
  | { type: "staff.roles"; staffId: string; roles: StaffRole[] }
  | { type: "staff.status"; staffId: string; status: "active" | "suspended"; reassignTo: string }
  | { type: "settings.save"; quoteApprovalThreshold: number | null; assignment?: AssignmentSettings }

export interface IntakeField {
  key: string
  label: string
  required?: boolean
  type?: "number" | "date"
  options?: string[]
}

const designTypes = ["Architectural plan", "Structural plan", "Interior design"]
const workTypes = ["Floor finishing", "Wall finishing", "Roof and ceiling", "Final finishing", "Renovation"]
const wasteTypes = ["Residential", "Commercial", "Construction debris"]

/** The skills a provider can list for each service. These are also the options a customer picks from on the request form. */
export const serviceSkills: Record<ServiceLine, string[]> = {
  Design: designTypes,
  Construction: workTypes,
  Hire: [
    "Architect",
    "Civil/structural engineer",
    "Quantity surveyor",
    "Land surveyor",
    "Builder",
    "Site engineer",
    "Interior designer",
    "Mason",
    "Tiler",
    "Plumber",
    "Electrician",
    "Carpenter",
    "Painter",
    "Welder",
    "Heavy equipment operator",
    "Excavator",
    "Crane",
    "Pay loader",
    "Bulldozer",
    "Backhoe",
    "Tipper truck",
    "Concrete mixer",
  ],
  Procurement: [
    "Cement and blocks",
    "Iron rods and steel",
    "Sand and granite",
    "Tiles and flooring",
    "Paint and finishes",
    "Plumbing and electrical fittings",
    "Roofing materials",
    "Wood and boards",
  ],
  "Facility management": [
    "Routine maintenance",
    "Cleaning and janitorial",
    "Repairs",
    "Generator and HVAC servicing",
    "Pest control",
  ],
  "Waste management": wasteTypes,
}

export const intakeFields: Record<ServiceLine, IntakeField[]> = {
  Design: [
    { key: "designType", label: "Design service", required: true, options: serviceSkills.Design },
    {
      key: "delivery",
      label: "Project delivery",
      required: true,
      options: ["Design only", "Design and build with XPro"],
    },
  ],
  Construction: [
    { key: "workType", label: "Work required", required: true, options: serviceSkills.Construction },
    { key: "area", label: "Approximate area (sqm)", type: "number" },
  ],
  Hire: [
    {
      key: "hireType",
      label: "Hire category",
      required: true,
      options: ["Professional", "Vocational worker", "Heavy equipment"],
    },
    { key: "trade", label: "Trade or equipment required", required: true, options: serviceSkills.Hire },
    { key: "quantity", label: "Quantity", required: true, type: "number" },
    { key: "endDate", label: "Hire end date", required: true, type: "date" },
    { key: "operator", label: "Operator required?", options: ["Yes", "No", "Not applicable"] },
  ],
  Procurement: [
    { key: "materials", label: "Materials and quantities required", required: true },
    { key: "category", label: "Material category", options: serviceSkills.Procurement },
    { key: "brands", label: "Preferred brands" },
    { key: "deliveryDate", label: "Required delivery date", required: true, type: "date" },
  ],
  "Facility management": [
    {
      key: "propertyType",
      label: "Property type",
      required: true,
      options: ["Residential", "Commercial", "Industrial"],
    },
    {
      key: "serviceNeeds",
      label: "Facility services required",
      required: true,
      options: serviceSkills["Facility management"],
    },
    { key: "visitDate", label: "Preferred visit date", type: "date" },
  ],
  "Waste management": [
    { key: "wasteType", label: "Waste type", required: true, options: serviceSkills["Waste management"] },
    { key: "quantity", label: "Estimated quantity and unit", required: true },
    { key: "access", label: "Pickup access instructions", required: true },
    { key: "pickupDate", label: "Preferred pickup date", required: true, type: "date" },
  ],
}

/** The intake field whose value names the skill a request needs. */
export const skillFieldKey: Record<ServiceLine, string> = {
  Design: "designType",
  Construction: "workType",
  Hire: "trade",
  Procurement: "category",
  "Facility management": "serviceNeeds",
  "Waste management": "wasteType",
}

/** The skill a request needs from its provider, or null when the intake names none (or names one outside the catalogue). */
export const requiredSkill = (request: Pick<ServiceRequest, "service" | "details">): string | null => {
  const value = request.details[skillFieldKey[request.service]]?.trim() ?? ""

  return value && serviceSkills[request.service].includes(value) ? value : null
}

export const weekdays: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
export const weekdayLabels: Record<Weekday, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
}

export const defaultAssignmentSettings = (): AssignmentSettings => ({
  modeByService: {
    Design: "auto",
    Construction: "auto",
    Hire: "auto",
    Procurement: "auto",
    "Facility management": "auto",
    "Waste management": "auto",
  },
  offerExpiryHours: 24,
  maxAutoAttempts: 3,
  weights: { skill: 35, area: 25, capacity: 20, fairness: 15, experience: 5 },
  requireVerifiedBank: true,
})

/** Customer wording, kept as the default label map. */
export const statusLabels: Record<RequestStatus, string> = {
  submitted: "Request sent",
  under_review: "XPro is reviewing",
  matched: "Provider matched",
  quoted: "Quote ready — review it",
  scheduled: "Date confirmed",
  in_progress: "Work in progress",
  blocked: "Needs attention",
  completion_pending: "Confirm completion",
  acknowledged: "Awaiting XPro closure",
  closed: "Completed",
  cancelled: "Cancelled",
  rejected: "Not accepted",
}

const providerStatusLabels: Record<RequestStatus, string> = {
  submitted: "Awaiting XPro review",
  under_review: "Offer received",
  matched: "Job accepted — submit pricing",
  quoted: "Awaiting customer decision",
  scheduled: "Date confirmed",
  in_progress: "In progress",
  blocked: "Blocked",
  completion_pending: "Awaiting customer confirmation",
  acknowledged: "Customer confirmed",
  closed: "Completed",
  cancelled: "Cancelled / withdrawn",
  rejected: "Not accepted",
}
const adminStatusLabels: Record<RequestStatus, string> = {
  submitted: "New — needs review",
  under_review: "Under review / dispatching",
  matched: "Matched — build quote",
  quoted: "Quote sent",
  scheduled: "Scheduled",
  in_progress: "In progress",
  blocked: "Blocked / open issue",
  completion_pending: "Completion under review",
  acknowledged: "Ready to close",
  closed: "Closed",
  cancelled: "Cancelled",
  rejected: "Rejected",
}

export const statusLabelsByRole: Record<WorkspaceRole, Record<RequestStatus, string>> = {
  customer: statusLabels,
  provider: providerStatusLabels,
  admin: adminStatusLabels,
}
export const statusLabelFor = (status: RequestStatus, role: WorkspaceRole) => statusLabelsByRole[role][status]
export const requestStatuses = Object.keys(statusLabels) as RequestStatus[]

/** A request that can no longer change: completed, cancelled or rejected. */
export const isFinished = (status: RequestStatus) =>
  status === "closed" || status === "cancelled" || status === "rejected"
export const money = (minorUnits: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(
    minorUnits / 100,
  )

/** Total in kobo for one line: quantity x rate, rounded to a whole kobo. */
export const lineTotal = (item: QuoteItem) => Math.round(item.quantity * item.rate)
export const when = (value: string) =>
  new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(
    new Date(value),
  )
