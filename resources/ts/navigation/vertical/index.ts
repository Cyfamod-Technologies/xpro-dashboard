import type { UserRole } from '@/types/domain'
import { isWorkspaceRole, workspaceSections } from '@/features/workspace/config'
import type { VerticalNavItems } from '@layouts/types'

export const getVerticalNavItems = (role?: UserRole): VerticalNavItems => {
  if (!isWorkspaceRole(role))
    return []

  return [
    { title: 'Overview', to: '/', icon: { icon: 'tabler-layout-dashboard' } },
    ...workspaceSections[role].map(item => ({
      title: item.title,
      to: `/workspace/${item.id}`,
      icon: { icon: item.icon },
    })),
  ]
}
