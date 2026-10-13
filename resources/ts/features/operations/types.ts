import type { WorkspaceRole } from '@/features/workspace/config'

export type ServiceLine = 'Design' | 'Construction' | 'Hire' | 'Procurement' | 'Facility management' | 'Waste management'
export type RequestStatus = 'submitted' | 'under_review' | 'matched' | 'quoted' | 'scheduled' | 'in_progress' | 'blocked' | 'completion_pending' | 'acknowledged' | 'closed' | 'cancelled'
export type VerificationStatus = 'draft' | 'pending' | 'changes_requested' | 'approved' | 'rejected'
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'revision_requested' | 'superseded'
export type Channel = 'customer' | 'provider' | 'internal'

export interface Actor { id: string; name: string; email: string; role: WorkspaceRole }
export interface Attachment { id: string; name: string; size: number; type: string; dataUrl?: string }
export interface QuoteItem { description: string; quantity: number; rate: number }
export interface Quote { id: string; version: number; status: QuoteStatus; items: QuoteItem[]; total: number; note: string; createdAt: string; responseNote: string }
export interface Contribution { id: string; providerId: string; items: QuoteItem[]; total: number; note: string; createdAt: string }
export interface Assignment { id: string; providerId: string; status: 'offered' | 'accepted' | 'declined' | 'withdrawn'; note: string; response: string; createdAt: string }
export interface Schedule { id: string; startAt: string; note: string; quoteId: string; status: 'proposed' | 'confirmed' | 'changes_requested' | 'cancelled'; customer: 'pending' | 'accepted' | 'changes_requested'; provider: 'pending' | 'accepted' | 'changes_requested'; responses: string[] }
export interface ProgressUpdate { id: string; authorId: string; author: string; status: RequestStatus; note: string; attachments: Attachment[]; createdAt: string }
export interface Message { id: string; authorId: string; author: string; channel: Channel; providerId?: string; text: string; attachments: Attachment[]; createdAt: string }
export interface Issue { id: string; note: string; status: 'open' | 'resolved'; resolution: string; createdAt: string }
export interface ServiceRequest {
  id: string
  ownerId: string
  customer: string
  title: string
  service: ServiceLine
  city: string
  address: string
  phone: string
  description: string
  budget: number
  startDate: string
  details: Record<string, string>
  attachments: Attachment[]
  status: RequestStatus
  createdAt: string
  flag: string
  assignments: Assignment[]
  contributions: Contribution[]
  quotes: Quote[]
  schedules: Schedule[]
  updates: ProgressUpdate[]
  messages: Message[]
  issues: Issue[]
}
export interface ProviderProfile {
  id: string
  name: string
  email: string
  phone: string
  trade: string
  city: string
  services: ServiceLine[]
  experience: number
  bio: string
  rating: number
  reviewCount: number
  portfolio: Attachment[]
  available: boolean
  verification: VerificationStatus
  documents: Attachment[]
  reviewNote: string
  history: { status: VerificationStatus; note: string; createdAt: string }[]
}
export interface Preferences { name: string; phone: string; email: boolean; push: boolean; inApp: boolean; timezone: string }
export interface Notification { id: string; recipientId: string; title: string; message: string; requestId?: string; createdAt: string; read: boolean; channels: string[] }
export interface AuditEntry { id: string; actor: string; action: string; resource: string; requestId?: string; createdAt: string }
export interface OperationsState { schema: 1; nextRequest: number; requests: ServiceRequest[]; providers: ProviderProfile[]; notifications: Notification[]; audit: AuditEntry[]; preferences: Record<string, Preferences> }
export interface RequestInput { title: string; service: ServiceLine; city: string; address: string; phone: string; description: string; budget: number; startDate: string; details: Record<string, string>; attachments: Attachment[] }
export interface ProviderInput { phone: string; trade: string; city: string; services: ServiceLine[]; experience: number; bio: string; documents: Attachment[]; portfolio: Attachment[] }

export type Command =
  | { type: 'request.create'; input: RequestInput }
  | { type: 'request.review'; requestId: string; clarify: boolean; note: string }
  | { type: 'request.cancel'; requestId: string; note: string }
  | { type: 'request.flag'; requestId: string; note: string }
  | { type: 'provider.submit'; input: ProviderInput }
  | { type: 'provider.review'; providerId: string; decision: 'approved' | 'changes_requested' | 'rejected'; note: string }
  | { type: 'provider.availability'; available: boolean }
  | { type: 'assignment.offer'; requestId: string; providerId: string; note: string }
  | { type: 'assignment.respond'; requestId: string; assignmentId: string; accept: boolean; note: string }
  | { type: 'assignment.withdraw'; requestId: string; assignmentId: string; note: string }
  | { type: 'quote.contribute'; requestId: string; items: QuoteItem[]; note: string }
  | { type: 'quote.save'; requestId: string; quoteId?: string; items: QuoteItem[]; note: string }
  | { type: 'quote.publish'; requestId: string; quoteId: string }
  | { type: 'quote.respond'; requestId: string; quoteId: string; decision: 'accepted' | 'declined' | 'revision_requested'; note: string }
  | { type: 'schedule.propose'; requestId: string; startAt: string; note: string }
  | { type: 'schedule.respond'; requestId: string; scheduleId: string; accept: boolean; note: string }
  | { type: 'progress.add'; requestId: string; status: 'in_progress' | 'blocked' | 'completion_pending'; note: string; attachments: Attachment[] }
  | { type: 'completion.respond'; requestId: string; acknowledge: boolean; note: string }
  | { type: 'issue.resolve'; requestId: string; issueId: string; note: string }
  | { type: 'request.close'; requestId: string }
  | { type: 'message.send'; requestId: string; channel: Channel; text: string; attachments: Attachment[] }
  | { type: 'notification.read'; notificationId?: string }
  | { type: 'preferences.save'; input: Preferences }

export interface IntakeField { key: string; label: string; required?: boolean; type?: 'number' | 'date'; options?: string[] }
export const intakeFields: Record<ServiceLine, IntakeField[]> = {
  'Design': [{ key: 'designType', label: 'Design service', required: true, options: ['Architectural plan', 'Structural plan', 'Interior design'] }, { key: 'delivery', label: 'Project delivery', required: true, options: ['Design only', 'Design and build with XPro'] }],
  'Construction': [{ key: 'workType', label: 'Work required', required: true, options: ['Floor finishing', 'Wall finishing', 'Roof and ceiling', 'Final finishing', 'Renovation'] }, { key: 'area', label: 'Approximate area (sqm)', type: 'number' }],
  'Hire': [{ key: 'hireType', label: 'Hire category', required: true, options: ['Professional', 'Vocational worker', 'Heavy equipment'] }, { key: 'trade', label: 'Trade or equipment required', required: true }, { key: 'quantity', label: 'Quantity', required: true, type: 'number' }, { key: 'endDate', label: 'Hire end date', required: true, type: 'date' }, { key: 'operator', label: 'Operator required?', options: ['Yes', 'No', 'Not applicable'] }],
  'Procurement': [{ key: 'materials', label: 'Materials and quantities required', required: true }, { key: 'brands', label: 'Preferred brands' }, { key: 'deliveryDate', label: 'Required delivery date', required: true, type: 'date' }],
  'Facility management': [{ key: 'propertyType', label: 'Property type', required: true, options: ['Residential', 'Commercial', 'Industrial'] }, { key: 'serviceNeeds', label: 'Facility services required', required: true }, { key: 'visitDate', label: 'Preferred visit date', type: 'date' }],
  'Waste management': [{ key: 'wasteType', label: 'Waste type', required: true, options: ['Residential', 'Commercial', 'Construction debris'] }, { key: 'quantity', label: 'Estimated quantity and unit', required: true }, { key: 'access', label: 'Pickup access instructions', required: true }, { key: 'pickupDate', label: 'Preferred pickup date', required: true, type: 'date' }],
}

export const statusLabels: Record<RequestStatus, string> = { submitted: 'Request sent', under_review: 'Under review', matched: 'Provider matched', quoted: 'Quote ready', scheduled: 'Scheduled', in_progress: 'In progress', blocked: 'Needs attention', completion_pending: 'Review completion', acknowledged: 'Awaiting XPro closure', closed: 'Completed', cancelled: 'Cancelled' }
export const money = (minorUnits: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(minorUnits / 100)
export const when = (value: string) => new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' }).format(new Date(value))
