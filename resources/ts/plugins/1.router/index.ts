import { setupLayouts } from 'virtual:meta-layouts'
import type { App } from 'vue'

import type { RouteRecordRaw } from 'vue-router/auto'

import { createRouter, createWebHistory } from 'vue-router/auto'
import { store } from '@/plugins/2.pinia'
import { useAuthStore } from '@/stores/auth'
import { useOperationsStore } from '@/stores/operations'
import { isWorkspaceRole, sectionPath, workspaceSections } from '@/features/workspace/config'

function recursiveLayouts(route: RouteRecordRaw): RouteRecordRaw {
  if (route.children) {
    for (let i = 0; i < route.children.length; i++)
      route.children[i] = recursiveLayouts(route.children[i])

    return route
  }

  return setupLayouts([route])[0]
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to) {
    if (to.hash)
      return { el: to.hash, behavior: 'smooth', top: 60 }

    return { top: 0 }
  },
  extendRoutes: pages => [
    ...[...pages].map(route => recursiveLayouts(route)),
  ],
})

router.beforeEach(async to => {
  const auth = useAuthStore(store)

  await auth.hydrate()

  // The MFA page is only valid after the mock API has accepted staff credentials.
  // Guard it before rendering so a direct visit never flashes the challenge UI.
  if (to.path === '/auth/mfa' && !auth.pendingMfa)
    return '/login'

  if (auth.user && !isWorkspaceRole(auth.user.role)) {
    auth.logout()

    return '/login'
  }

  // Suspended or unknown staff accounts cannot keep a session.
  if (auth.user?.role === 'admin' && to.path !== '/login') {
    const ops = useOperationsStore(store)

    if (ops.staffMember?.status !== 'active') {
      auth.logout()

      return { path: '/login', query: { reason: 'staff-inactive' } }
    }
  }

  // Old `/workspace/:section` bookmarks move to the role-specific URL.
  if (to.path.startsWith('/workspace/')) {
    const segment = to.path.slice('/workspace/'.length).split('/')[0]
    const role = auth.user?.role

    if (auth.isAuthenticated && isWorkspaceRole(role) && segment) {
      return {
        path: sectionPath(role, segment),
        query: to.query,
      }
    }

    return {
      path: '/login',
      query: segment ? { redirect: `/${segment}` } : {},
    }
  }

  if (to.meta.public) {
    if (to.meta.unauthenticatedOnly && auth.isAuthenticated)
      return auth.homePath

    return true
  }

  if (!auth.isAuthenticated) {
    return {
      path: '/login',
      query: { redirect: to.fullPath },
    }
  }

  const role = auth.user?.role

  if (to.path === '/admin' || to.path.startsWith('/admin/')) {
    const section = to.path === '/admin' ? 'overview' : String(to.params && 'section' in to.params ? to.params.section : '')

    const adminSection = workspaceSections.admin.find(item => item.id === section)

    if (role !== 'admin' || !adminSection)
      return '/access-denied'

    if (adminSection.permission && !useOperationsStore(store).can(adminSection.permission))
      return '/access-denied'
  }
  else if (typeof to.meta.section === 'string') {
    const section = to.meta.section

    if (role === 'admin' && workspaceSections.admin.some(item => item.id === section)) {
      return {
        path: sectionPath('admin', section),
        query: to.query,
      }
    }

    if (!isWorkspaceRole(role) || role === 'admin' || !workspaceSections[role].some(item => item.id === section))
      return '/access-denied'
  }
  else if (to.path !== '/access-denied') {
    return '/access-denied'
  }

  if (to.meta.roles && !auth.hasRole(to.meta.roles))
    return '/access-denied'

  return true
})

export { router }

export default function (app: App) {
  app.use(router)
}
