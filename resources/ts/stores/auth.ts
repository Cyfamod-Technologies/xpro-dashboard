import { defineStore } from "pinia"

import { homePathFor, isWorkspaceRole } from "@/features/workspace/config"
import { authApi } from "@/services/xpro-api"
import type { LoginPayload, User, UserRole } from "@/types/domain"

export const useAuthStore = defineStore("auth", () => {
  const token = useCookie<string | null>("accessToken")
  const user = ref<User | null>(null)
  const initialized = ref(false)
  const pendingMfa = ref<{ token: string; user: User } | null>(null)

  const isAuthenticated = computed(() => Boolean(token.value && user.value))

  const homePath = computed(() => {
    const role = user.value?.role

    return isAuthenticated.value && isWorkspaceRole(role) ? homePathFor(role) : "/login"
  })

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
    if (!pendingMfa.value) throw new Error("Your sign-in session has expired. Please sign in again.")

    const response = await authApi.verifyMfa(code, pendingMfa.value.token)
    token.value = response.data.token
    user.value = response.data.user
    pendingMfa.value = null
  }

  async function hydrate() {
    if (initialized.value) return

    try {
      if (token.value) {
        const response = await authApi.me()

        user.value = response.data
      }
    } catch {
      token.value = null
      user.value = null
    } finally {
      initialized.value = true
    }
  }

  async function refreshUser() {
    const response = await authApi.me()

    user.value = response.data
  }

  // Customer and provider roles held; the demo fixtures carry only `role`.
  const workspaceRoles = computed<("customer" | "provider")[]>(() => {
    const current = user.value
    if (!current || current.role === "admin") return []

    return current.workspaceRoles ?? [current.role]
  })

  const otherWorkspaceRole = computed(() => workspaceRoles.value.find(item => item !== user.value?.role) ?? null)

  function holdsRole(role: "customer" | "provider") {
    return workspaceRoles.value.includes(role)
  }

  async function addRole(role: "customer" | "provider", acceptedTerms?: { providerAgreementVersion?: string }) {
    const response = await authApi.addRole(role, acceptedTerms)

    user.value = response.data
  }

  async function switchRole(role: "customer" | "provider") {
    if (user.value?.role === role) return

    const response = await authApi.setActiveRole(role)

    user.value = response.data
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
    workspaceRoles,
    otherWorkspaceRole,
    holdsRole,
    addRole,
    switchRole,
    login,
    completeMfa,
    hydrate,
    refreshUser,
    logout,
    cancelMfa,
    hasRole,
  }
})
