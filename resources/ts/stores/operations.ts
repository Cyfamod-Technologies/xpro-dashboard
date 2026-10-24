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
import { providersApi, type ProviderProfileResponse } from "@/services/providers-api"
import type { ProviderProfile } from "@/features/operations/types"

const storageKey = "xpro-demo-workspace-v1"
const usePrototype = import.meta.env.VITE_ENABLE_MOCKS !== "false"

const readState = (): OperationsState => {
  if (!usePrototype) return createOperationsState()
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null") as OperationsState | null
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
    /* A new demo session can recover from an old or damaged snapshot. */
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
      name: state.value.preferences[user.id]?.name ?? `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      role: user.role,
    }
  })

  const staffMember = computed(() =>
    actor.value?.role === "admin" ? state.value.staff.find(item => item.id === actor.value?.id) : undefined,
  )
  const can = (permission: StaffPermission) =>
    actor.value?.role === "admin" &&
    (usePrototype ? staffCan(staffMember.value, permission) : auth.user?.scopes.includes(permission) === true)
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

  const mapProvider = (result: ProviderProfileResponse): ProviderProfile => {
    const bank = (account: NonNullable<ProviderProfileResponse["payout"]["current"] | ProviderProfileResponse["payout"]["pending"]>) => ({
      bankCode: account.bankCode,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      submittedAt: account.submittedAt,
    })
    const current = result.payout.current ? bank(result.payout.current) : null
    const pending = result.payout.pending ? bank(result.payout.pending) : null

    return {
      id: result.userId,
      serverId: result.id,
      version: result.version,
      name: `${result.firstName ?? auth.user?.firstName ?? ""} ${result.lastName ?? auth.user?.lastName ?? ""}`.trim(),
      email: result.email ?? auth.user?.email ?? "",
      phone: result.phone,
      trade: result.trade,
      city: result.city,
      services: result.services as ProviderProfile["services"],
      serviceAreas: result.serviceAreas,
      skills: result.skills as ProviderProfile["skills"],
      capacity: result.capacity,
      lastOfferedAt: "",
      workingHours: result.workingHours,
      timeOff: result.timeOff,
      experience: result.experience,
      bio: result.bio,
      rating: 0,
      reviewCount: 0,
      portfolio: result.portfolio,
      available: result.available,
      verification: result.verification as ProviderProfile["verification"],
      documents: result.documents,
      reviewNote: result.reviewNote ?? "",
      history: result.history.map(item => ({
        status: item.decision as ProviderProfile["verification"],
        note: item.note ?? "",
        createdAt: item.createdAt,
      })),
      photo: result.photo,
      pendingChanges: result.pendingChanges ?? null,
      changesReview: result.changesReview as ProviderProfile["changesReview"],
      payout: {
        current,
        pending,
        review: pending ? { state: "pending", by: "XPro Finance", note: "", at: pending.submittedAt } : null,
        history: [],
      },
    }
  }

  const addFileLinks = async (profile: ProviderProfile, asReviewer = false) => {
    const addLink = async (file: ProviderProfile["documents"][number]) => {
      try {
        const response = await providersApi.fileUrl(file.id, asReviewer ? profile.serverId : undefined)
        return { ...file, downloadUrl: response.data.url }
      } catch {
        return file
      }
    }
    profile.documents = await Promise.all(profile.documents.map(addLink))
    profile.portfolio = await Promise.all(profile.portfolio.map(addLink))
    if (profile.photo) profile.photo = await addLink(profile.photo)
    if (profile.pendingChanges) {
      profile.pendingChanges.documents = await Promise.all(profile.pendingChanges.documents.map(addLink))
      if (profile.pendingChanges.photo) profile.pendingChanges.photo = await addLink(profile.pendingChanges.photo)
    }
    return profile
  }

  async function refreshProviderProfile() {
    const response = await providersApi.me()
    const result = response.data
    const profileResult = "profile" in result ? null : result
    if (!profileResult) {
      state.value.providers = state.value.providers.filter(item => item.id !== auth.user?.id)
      return
    }
    const mapped = await addFileLinks(mapProvider(profileResult))
    state.value.providers = [...state.value.providers.filter(item => item.id !== mapped.id), mapped]
  }

  async function loadProvidersForReview() {
    if (usePrototype) return
    const response = await providersApi.listForReview()
    state.value.providers = await Promise.all(response.data.map(item => addFileLinks(mapProvider(item), true)))
  }

  async function runServerProviderCommand(command: Command) {
    if (usePrototype) return false
    switch (command.type) {
      case "provider.submit": {
        const { bank, ...input } = command.input
        await providersApi.submit({ ...input, photo: input.photo!, bankCode: bank.bankCode, accountNumber: bank.accountNumber })
        await refreshProviderProfile()
        return true
      }
      case "provider.availability":
        await providersApi.setAvailability(command.available)
        await refreshProviderProfile()
        return true
      case "provider.hours":
        if (!profile.value) throw new Error("Submit your provider profile before setting working hours.")
        await providersApi.setCalendar(command.workingHours, command.timeOff.map(item => ({ ...item, id: item.id ?? crypto.randomUUID() })))
        await refreshProviderProfile()
        return true
      case "payout.update":
        await providersApi.updateBank(command.bank.bankCode, command.bank.accountNumber)
        await refreshProviderProfile()
        return true
      case "provider.review": {
        const target = state.value.providers.find(item => item.id === command.providerId)
        if (!target?.serverId || target.version === undefined) throw new Error("Refresh the provider review queue and try again.")
        await providersApi.review(target.serverId, command.decision, command.note, target.version)
        await loadProvidersForReview()
        return true
      }
      case "payout.review": {
        const target = state.value.providers.find(item => item.id === command.providerId)
        if (!target?.serverId || target.version === undefined) throw new Error("Refresh the provider review queue and try again.")
        await providersApi.reviewBank(target.serverId, command.approve, command.note, target.version)
        await loadProvidersForReview()
        return true
      }
      case "provider.changes.review": {
        const target = state.value.providers.find(item => item.id === command.providerId)
        if (!target?.serverId || target.version === undefined) throw new Error("Refresh the provider review queue and try again.")
        await providersApi.reviewChanges(target.serverId, command.approve, command.note, target.version)
        await loadProvidersForReview()
        return true
      }
      default:
        return false
    }
  }

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
      const serverHandled = await runServerProviderCommand(payload)
      if (serverHandled) {
        notice.value = "Changes saved."
        return true
      }
      const updated = applyCommand(toRaw(state.value), initiator, payload)

      sessionStorage.setItem(storageKey, JSON.stringify(updated))
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

      sessionStorage.setItem(storageKey, JSON.stringify(next))
      state.value = next
      notice.value = "Sample records restored."
      error.value = ""
    } catch {
      error.value = "Browser storage is full or unavailable. Clear preview storage and retry."
    }
  }
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
    refreshProviderProfile,
    loadProvidersForReview,
    staffMember,
    can,
    staffById,
    run,
    reset,
  }
})
