import type { StaffPermission } from '@/features/operations/types'
import type { UserRole } from '@/types/domain'
import {
  isWorkspaceRole,
  sectionPath,
  workspaceSections,
} from '@/features/workspace/config'
import type { VerticalNavItems } from '@layouts/types'

export const getVerticalNavItems = (role?: UserRole, can: (permission: StaffPermission) => boolean = () => true): VerticalNavItems => {
  if (!isWorkspaceRole(role))
    return []

  return [
    ...(role === 'customer'
      ? [{ title: 'Browse services', to: '/', icon: { icon: 'tabler-world' } }]
      : [{ title: 'Public site', to: '/', icon: { icon: 'tabler-world' } }]),
    ...workspaceSections[role].filter(item => !item.permission || can(item.permission)).map(item => ({
      title: item.title,
      to: sectionPath(role, item.id),
      icon: { icon: item.icon },
    })),
  ]
}
