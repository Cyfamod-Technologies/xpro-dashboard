import { defineStore } from 'pinia'

import { authApi } from '@/services/xpro-api'
import type { LoginPayload, User, UserRole } from '@/types/domain'

export const useAuthStore = defineStore('auth', () => {
  const token = useCookie<string | null>('accessToken')
  const user = ref<User | null>(null)
  const initialized = ref(false)
  const pendingMfa = ref<{ token: string; user: User } | null>(null)

  const isAuthenticated = computed(() => Boolean(token.value && user.value))
  const homePath = computed(() => isAuthenticated.value ? '/' : '/login')

  async function login(payload: LoginPayload) {
    pendingMfa.value = null

    const response = await authApi.login(payload)

    if (response.data.requiresMfa) {
      pendingMfa.value = { token: response.data.token, user: response.data.user }

      return { requiresMfa: true }
    }

    token.value = response.data.token
    user.value = response.data.user

    return { requiresMfa: false }
  }

  async function completeMfa(code: string) {
    if (!pendingMfa.value)
      throw new Error('Your sign-in session has expired. Please sign in again.')

    await authApi.verifyMfa(code)
    token.value = pendingMfa.value.token
    user.value = pendingMfa.value.user
    pendingMfa.value = null
  }

  async function hydrate() {
    if (initialized.value)
      return

    try {
      if (token.value) {
        const response = await authApi.me()

        user.value = response.data
      }
    }
    catch {
      token.value = null
      user.value = null
    }
    finally {
      initialized.value = true
    }
  }

  function logout() {
    token.value = null
    user.value = null
    pendingMfa.value = null
  }

  function cancelMfa() {
    pendingMfa.value = null
  }

  function hasRole(roles: UserRole[]) {
    return Boolean(user.value && roles.includes(user.value.role))
  }

  return {
    token,
    user,
    initialized,
    pendingMfa,
    isAuthenticated,
    homePath,
    login,
    completeMfa,
    hydrate,
    logout,
    cancelMfa,
    hasRole,
  }
})
