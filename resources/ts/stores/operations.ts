import { defineStore } from "pinia"
import { computed, ref, toRaw } from "vue"
import { useAuthStore } from "@/stores/auth"
import { isWorkspaceRole } from "@/features/workspace/config"
import { createOperationsState } from "@/features/operations/fixtures"
import {
  applyCommand,
  defaultPreferences,
  inbox,
  publicProvider,
  visibleRequests,
} from "@/features/operations/workflow"
import { staffCan } from "@/features/operations/staff"
import type { Actor, Command, OperationsState, StaffPermission } from "@/features/operations/types"

const storageKey = "xpro-ui-workspace-v1"

const readState = (): OperationsState => {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null") as OperationsState | null
    if (
      saved?.schema === 6 &&
      Array.isArray(saved.staff) &&
      saved.settings &&
      Array.isArray(saved.requests) &&
      Array.isArray(saved.providers) &&
      Array.isArray(saved.audit) &&
      Array.isArray(saved.notifications) &&
      saved.preferences
    )
      return saved
  } catch {
    /* A new local preview can recover from an old or damaged snapshot. */
  }

  return createOperationsState()
}

export const useOperationsStore = defineStore("operations", () => {
  const auth = useAuthStore()
  const state = ref(readState())
  const busy = ref(false)
  const error = ref("")
  const notice = ref("")
  const failNext = ref(false)

  const actor = computed<Actor | undefined>(() => {
    const user = auth.user
    if (!user || !isWorkspaceRole(user.role)) return undefined

    return {
      id: user.id,
      name: state.value.preferences[user.id]?.name ?? user.name,
      email: user.email,
      role: user.role,
    }
  })

  const staffMember = computed(() =>
    actor.value?.role === "admin" ? state.value.staff.find(item => item.id === actor.value?.id) : undefined,
  )
  const can = (permission: StaffPermission) => actor.value?.role === "admin" && staffCan(staffMember.value, permission)
  const staffById = (staffId: string) => state.value.staff.find(item => item.id === staffId)
  const requests = computed(() => (actor.value ? visibleRequests(state.value, actor.value) : []))
  const profile = computed(() => state.value.providers.find(item => item.id === actor.value?.id))
  const preferences = computed(() =>
    actor.value ? (state.value.preferences[actor.value.id] ?? defaultPreferences(actor.value)) : undefined,
  )
  const notifications = computed(() => (actor.value ? inbox(state.value, actor.value.id) : []))
  const publicProviders = computed(() =>
    state.value.providers.filter(item => item.verification === "approved").map(publicProvider),
  )

  async function run(command: Command) {
    if (busy.value) return false
    error.value = ""
    notice.value = ""
    busy.value = true
    try {
      const initiator = actor.value
      const payload = JSON.parse(JSON.stringify(command)) as Command

      await new Promise(resolve => setTimeout(resolve, 180))
      if (failNext.value) {
        failNext.value = false
        throw new Error("The simulated save failed. Your changes have not been applied. Please retry.")
      }
      if (!initiator || actor.value?.id !== initiator.id)
        throw new Error("Your account changed. Sign in and retry this action.")
      const updated = applyCommand(toRaw(state.value), initiator, payload)

      localStorage.setItem(storageKey, JSON.stringify(updated))
      state.value = updated
      notice.value = "Changes saved in this prototype."

      return true
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : "Unable to save. Please retry."

      return false
    } finally {
      busy.value = false
    }
  }

  function reset() {
    if (!can("settings.manage")) return
    try {
      const next = createOperationsState()

      localStorage.setItem(storageKey, JSON.stringify(next))
      state.value = next
      notice.value = "Sample records restored."
      error.value = ""
    } catch {
      error.value = "Browser storage is full or unavailable. Clear preview storage and retry."
    }
  }
  window.addEventListener("storage", event => {
    if (event.key === storageKey) state.value = readState()
  })

  return {
    state,
    actor,
    requests,
    profile,
    preferences,
    publicProviders,
    notifications,
    busy,
    error,
    notice,
    failNext,
    staffMember,
    can,
    staffById,
    run,
    reset,
  }
})
