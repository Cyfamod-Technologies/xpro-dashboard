import type { UserRole } from '@/types/domain'
import type { VerticalNavItems } from '@layouts/types'

const sharedStaffItems: VerticalNavItems = [
  { heading: 'Operations' },
  { title: 'Programs', to: '/programs', icon: { icon: 'tabler-stack-2' } },
  { title: 'Projects', to: '/projects', icon: { icon: 'tabler-building-community' } },
  { title: 'Allocations', to: '/allocations', icon: { icon: 'tabler-cash-banknote' } },
  { title: 'Imports', to: '/imports', icon: { icon: 'tabler-file-import' } },
  { title: 'Notifications', to: '/notifications', icon: { icon: 'tabler-bell' } },
]

export const getVerticalNavItems = (role?: UserRole): VerticalNavItems => {
  if (role === 'super_admin') {
    return [
      { title: 'Admin overview', to: '/admin/dashboard', icon: { icon: 'tabler-layout-dashboard' } },
      { title: 'Approval queue', to: '/approvals', icon: { icon: 'tabler-clipboard-check' }, badgeContent: '2', badgeClass: 'bg-warning' },
      ...sharedStaffItems,
      { heading: 'Administration' },
      { title: 'Users & access', to: '/admin/users', icon: { icon: 'tabler-users' } },
      { title: 'Audit log', to: '/admin/audit-log', icon: { icon: 'tabler-history' } },
      { title: 'Settings', to: '/admin/settings', icon: { icon: 'tabler-settings' } },
    ]
  }

  if (role === 'manager') {
    return [
      { title: 'Operations overview', to: '/dashboard', icon: { icon: 'tabler-layout-dashboard' } },
      { title: 'My work', to: '/my-work', icon: { icon: 'tabler-checklist' } },
      ...sharedStaffItems,
    ]
  }

  return [
    { title: 'Budget overview', to: '/budget', icon: { icon: 'tabler-layout-dashboard' } },
    { title: 'Explore projects', to: '/explore', icon: { icon: 'tabler-search' } },
    { title: 'Programs', to: '/programs', icon: { icon: 'tabler-stack-2' } },

    // { title: 'Projects requiring action', to: '/explore?status=action_required', icon: { icon: 'tabler-speakerphone' } },
  ]
}
