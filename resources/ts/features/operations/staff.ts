import type { Message, OperationsState, ServiceRequest, StaffMember, StaffPermission, StaffRole } from '@/features/operations/types'
import type { WorkspaceRole } from '@/features/workspace/config'

export const staffRolePermissions: Record<StaffRole, StaffPermission[] | '*'> = {
  super_admin: '*',
  operations: ['request.claim', 'request.review', 'request.cancel', 'request.flag', 'provider.review', 'dispatch.manage', 'progress.review', 'schedule.manage', 'issue.resolve', 'request.close', 'message.customer', 'message.provider', 'message.internal'],
  pricing: ['quote.manage', 'message.provider', 'message.internal'],
  client_relations: ['request.claim', 'request.review', 'request.cancel', 'request.flag', 'issue.resolve', 'message.customer', 'message.provider', 'message.internal'],
}

export const staffRoleLabels: Record<StaffRole, string> = {
  super_admin: 'Super admin',
  operations: 'Operations',
  pricing: 'Pricing',
  client_relations: 'Client relations',
}

export const staffCan = (member: StaffMember | undefined, permission: StaffPermission) => Boolean(member && member.status === 'active' && member.roles.some(role => {
  const permissions = staffRolePermissions[role]

  return permissions === '*' || permissions.includes(permission)
}))

export const activeStaffWith = (state: OperationsState, permission: StaffPermission) => state.staff.filter(member => staffCan(member, permission))

export const activeStaffInRole = (state: OperationsState, role: StaffRole) => state.staff.filter(member => member.status === 'active' && member.roles.includes(role))

export const UNCLAIMED_ALERT_MS = 2 * 60 * 60 * 1000

export const isUnclaimedOverdue = (request: ServiceRequest, nowMs = Date.now()) => !request.staffOwnerId && !['closed', 'cancelled'].includes(request.status) && nowMs - Date.parse(request.createdAt) > UNCLAIMED_ALERT_MS

export const messageAuthorLabel = (message: Message, viewer: WorkspaceRole) => message.authorRole === 'admin' && viewer !== 'admin' ? (message.channel === 'provider' ? 'XPro Dispatch' : 'XPro Team') : message.author
