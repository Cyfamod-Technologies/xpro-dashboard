import { setupLayouts } from 'virtual:meta-layouts'
import type { App } from 'vue'

import type { RouteRecordRaw } from 'vue-router/auto'

import { createRouter, createWebHistory } from 'vue-router/auto'
import { store } from '@/plugins/2.pinia'
import { useAuthStore } from '@/stores/auth'

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

  if (to.path === '/')
    return auth.isAuthenticated ? auth.homePath : '/login'

  // The MFA page is only valid after the mock API has accepted staff credentials.
  // Guard it before rendering so a direct visit never flashes the challenge UI.
  if (to.path === '/auth/mfa' && !auth.pendingMfa)
    return '/login'

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

  if (to.meta.roles && !auth.hasRole(to.meta.roles))
    return '/access-denied'

  return true
})

export { router }

export default function (app: App) {
  app.use(router)
}
