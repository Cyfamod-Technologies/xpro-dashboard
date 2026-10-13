import type { UserRole } from '@/types/domain'

import type { StaffPermission } from '@/features/operations/types'

export type WorkspaceRole = 'customer' | 'provider' | 'admin'

export interface WorkspaceSection {
  id: string
  title: string
  icon: string
  description: string
  emptyMessage: string
  permission?: StaffPermission
}

export const isWorkspaceRole = (role?: UserRole): role is WorkspaceRole =>
  role === 'customer' || role === 'provider' || role === 'admin'

const section = (
  id: string,
  title: string,
  icon: string,
  description: string,
  emptyMessage: string,
  permission?: StaffPermission,
): WorkspaceSection => ({ id, title, icon, description, emptyMessage, ...(permission ? { permission } : {}) })

const account = section(
  'account',
  'Account',
  'tabler-user',
  'Your personal details and account preferences.',
  'Your account details are shown below.',
)
const settings = section(
  'settings',
  'Settings',
  'tabler-settings',
  'Manage your account and workspace preferences.',
  'Your preferences will appear here.',
)
const messages = section(
  'messages',
  'Messages',
  'tabler-message-circle',
  'Stay connected with the XPro team about your work.',
  'Your conversations with XPro will appear here.',
)
const quotes = section(
  'quotes',
  'Quotes',
  'tabler-file-invoice',
  'Keep scope, pricing and quote decisions in one place.',
  'Quotes will appear here when a request is ready for pricing.',
)
const schedule = section(
  'schedule',
  'Schedule',
  'tabler-calendar',
  'Coordinate dates and keep track of confirmed appointments.',
  'Your upcoming appointments will appear here.',
)

export const workspaceSections: Record<WorkspaceRole, WorkspaceSection[]> = {
  customer: [
    section(
      'overview',
      'Overview',
      'tabler-layout-dashboard',
      'Your requests and the next steps awaiting your attention.',
      'Your activity will appear here.',
    ),
    section(
      'requests',
      'My requests',
      'tabler-clipboard-list',
      'Follow your requests from the initial brief to completion.',
      'Your service requests will appear here.',
    ),
    quotes,
    schedule,
    messages,
    section(
      'notifications',
      'Notifications',
      'tabler-bell',
      'Updates about your requests and assignments.',
      'You are all caught up.',
    ),
    settings,
    account,
  ],
  provider: [
    section(
      'overview',
      'Overview',
      'tabler-layout-dashboard',
      'Your offers and jobs that need attention.',
      'Your activity will appear here.',
    ),
    section(
      'jobs',
      'My jobs',
      'tabler-briefcase',
      'Review offers and keep your assigned jobs moving.',
      'New assignments and accepted jobs will appear here.',
    ),
    section(
      'verification',
      'Profile & verification',
      'tabler-shield-check',
      'Introduce your services and submit your verification documents.',
      'Your provider profile and verification documents will appear here.',
    ),
    section(
      'availability',
      'Availability',
      'tabler-clock',
      'Let dispatch know when you are ready to take on work.',
      'Your availability preferences will appear here.',
    ),
    section(
      'payouts',
      'Payout details',
      'tabler-building-bank',
      'The bank account XPro pays you into.',
      'Add your bank details to receive payouts.',
    ),
    schedule,
    messages,
    section(
      'notifications',
      'Notifications',
      'tabler-bell',
      'Updates about your requests and assignments.',
      'You are all caught up.',
    ),
    settings,
    account,
  ],
  admin: [
    section(
      'overview',
      'Overview',
      'tabler-layout-dashboard',
      'Everything awaiting XPro action across the platform.',
      'Platform activity will appear here.',
    ),
    section(
      'approvals',
      'Approvals',
      'tabler-checklist',
      'Everything waiting for an XPro decision.',
      'Nothing is waiting for approval.',
    ),
    section(
      'requests',
      'Requests',
      'tabler-clipboard-list',
      'Review incoming briefs and coordinate the next action.',
      'Customer requests awaiting review will appear here.',
    ),
    section(
      'providers',
      'Providers',
      'tabler-users',
      'Review profiles, verification documents and service areas.',
      'Provider submissions and approved profiles will appear here.',
    ),
    section(
      'dispatch',
      'Dispatch',
      'tabler-route',
      'Match verified providers to requests and follow their responses.',
      'Assignment offers and dispatch decisions will appear here.',
    ),
    quotes,
    schedule,
    messages,
    section(
      'audit',
      'Activity history',
      'tabler-history',
      'Follow the decisions made across requests, quotes and jobs.',
      'Operational actions and their history will appear here.',
    ),
    section(
      'staff',
      'Staff',
      'tabler-user-shield',
      'Invite staff, manage roles and suspend access.',
      'Staff accounts will appear here.',
      'staff.manage',
    ),
    section(
      'notifications',
      'Notifications',
      'tabler-bell',
      'Updates about your requests and assignments.',
      'You are all caught up.',
    ),
    settings,
    account,
  ],
}

export const sectionPath = (role: WorkspaceRole, id: string): string =>
  role === 'admin' ? (id === 'overview' ? '/admin' : `/admin/${id}`) : `/${id}`

export const homePathFor = (role: WorkspaceRole): string => (role === 'admin' ? '/admin' : '/overview')

export const serviceLines = [
  { name: 'Design', icon: 'tabler-ruler-2', description: 'Architectural, structural and interior plans.' },
  { name: 'Construction', icon: 'tabler-building', description: 'Construction, finishes and renovation.' },
  { name: 'Hire', icon: 'tabler-tools', description: 'Professionals, trades and heavy equipment.' },
  { name: 'Procurement', icon: 'tabler-package', description: 'Materials and fittings for your site.' },
  { name: 'Facility management', icon: 'tabler-home-cog', description: 'Maintenance and property support.' },
  { name: 'Waste management', icon: 'tabler-recycle', description: 'Waste collection and site clearance.' },
]
