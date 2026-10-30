<script setup lang="ts">
import AdminSecurity from "@/features/account/AdminSecurity.vue"
import { formatDate, permissionLabels } from "@/features/staff/staff-helpers"
import { staffRoleLabels } from "@/features/operations/staff"
import { accountApi } from "@/services/account-api"
import { staffApi } from "@/services/staff-api"
import type { StaffMemberView, StaffOwner } from "@/services/staff-api"
import { useAuthStore } from "@/stores/auth"
import { getErrorMessage } from "@/utils/errors"

const auth = useAuthStore()
const member = ref<StaffMemberView | null>(null)
const owners = ref<StaffOwner[]>([])
const loading = ref(true)
const error = ref("")

const name = computed(() => `${auth.user?.firstName ?? ""} ${auth.user?.lastName ?? ""}`.trim() || "Staff member")
const initials = computed(() => auth.user?.initials || name.value.slice(0, 2).toUpperCase())
const permissions = computed(() => member.value?.permissions ?? auth.user?.scopes ?? [])
const roles = computed(() => member.value?.roles ?? [])

async function load() {
  loading.value = true
  try {
    const [self, others] = await Promise.all([
      staffApi.get(auth.user?.id ?? ""),
      staffApi.owners(auth.user?.id).catch(() => null),
    ])

    member.value = self.data
    owners.value = others?.data ?? []
  } catch {
    // Roles and leave are extras; the page still shows the name, email and permissions from the session.
    member.value = null
  } finally {
    loading.value = false
  }
}

const leaveFrom = ref("")
const leaveTo = ref("")
const leaveDelegate = ref<string | null>(null)
const leaveNote = ref("")
const leaveBusy = ref(false)
const leaveError = ref("")
const leaveProblem = computed(() =>
  !leaveFrom.value || !leaveTo.value
    ? "Choose the first and last day."
    : leaveTo.value < leaveFrom.value
      ? "The last day can't be before the first."
      : "",
)
const delegateItems = computed(() =>
  owners.value.map(owner => ({ title: owner.onLeave ? `${owner.name} (on leave)` : owner.name, value: owner.id })),
)

async function setLeave() {
  if (leaveProblem.value) return
  leaveBusy.value = true
  leaveError.value = ""
  try {
    member.value = (
      await accountApi.setLeave({
        from: leaveFrom.value,
        to: leaveTo.value,
        ...(leaveDelegate.value ? { delegateId: leaveDelegate.value } : {}),
        ...(leaveNote.value.trim() ? { note: leaveNote.value.trim() } : {}),
      })
    ).data
  } catch (cause) {
    leaveError.value = getErrorMessage(cause, "Your leave could not be saved.")
  } finally {
    leaveBusy.value = false
  }
}

async function clearLeave() {
  leaveBusy.value = true
  leaveError.value = ""
  try {
    member.value = (await accountApi.clearLeave()).data
  } catch (cause) {
    leaveError.value = getErrorMessage(cause, "Your leave could not be cleared.")
  } finally {
    leaveBusy.value = false
  }
}

// Preview only: email preferences have no server support yet, so these choices are not saved.
const emailPreferences = reactive([
  { key: "approvals", label: "Approvals I can decide", on: true },
  { key: "ownership", label: "Requests I own", on: true },
  { key: "conversations", label: "Customer conversations", on: false },
  { key: "escalations", label: "Escalations", on: true },
  { key: "digests", label: "Digests", on: false },
])

onMounted(load)
</script>

<template>
  <div class="d-flex flex-column ga-5">
    <VAlert v-if="error" type="error" variant="tonal">{{ error }}</VAlert>

    <VCard>
      <VCardText class="d-flex align-center flex-wrap ga-4">
        <VAvatar color="primary" variant="tonal" size="56">{{ initials }}</VAvatar>
        <div class="flex-grow-1">
          <div class="text-h6">{{ name }}</div>
          <div class="text-body-2 text-medium-emphasis">{{ auth.user?.email }}</div>
        </div>
        <div class="d-flex flex-wrap ga-2">
          <VChip v-for="role in roles" :key="role" size="small" variant="tonal" color="primary">{{
            staffRoleLabels[role] ?? role
          }}</VChip>
          <VChip v-if="!roles.length && !loading" size="small" variant="tonal" color="primary">XPro staff</VChip>
          <VChip size="small" variant="tonal" color="success">Active</VChip>
        </div>
        <p class="text-body-2 text-medium-emphasis w-100 mb-0">Ask a super admin to change your name or roles.</p>
      </VCardText>
    </VCard>

    <VCard>
      <VCardText>
        <h2 class="text-h5 mb-1">Your access</h2>
        <p class="text-body-2 text-medium-emphasis mb-4">What you can do on the platform. This list is read only.</p>
        <div v-if="permissions.length" class="d-flex flex-wrap ga-2">
          <VChip v-for="permission in permissions" :key="permission" size="small" variant="tonal" label>{{
            permissionLabels[permission] ?? permission
          }}</VChip>
        </div>
        <p v-else class="text-body-2 text-medium-emphasis mb-0">Your permissions will appear here once they load.</p>
      </VCardText>
    </VCard>

    <AdminSecurity />

    <VCard>
      <VCardText>
        <h2 class="text-h5 mb-1">Leave and cover</h2>
        <p class="text-body-2 text-medium-emphasis mb-4">Choose who covers your requests while you're away.</p>
        <VAlert v-if="leaveError" type="error" variant="tonal" class="mb-4">{{ leaveError }}</VAlert>
        <template v-if="member?.leave">
          <p class="mb-1">
            {{ formatDate(member.leave.from) }} to {{ formatDate(member.leave.to) }}
            <VChip v-if="member.leave.active" size="x-small" class="ms-1" color="info" variant="tonal">now</VChip>
          </p>
          <p class="text-body-2 text-medium-emphasis mb-1">Covered by {{ member.leave.delegate?.name ?? "nobody" }}</p>
          <p v-if="member.leave.note" class="text-body-2 mb-2">{{ member.leave.note }}</p>
          <VBtn variant="outlined" size="small" :loading="leaveBusy" @click="clearLeave">Clear leave</VBtn>
        </template>
        <VForm v-else-if="member" @submit.prevent="setLeave">
          <VRow>
            <VCol cols="12" sm="6"><AppTextField v-model="leaveFrom" label="First day away" type="date" /></VCol>
            <VCol cols="12" sm="6"><AppTextField v-model="leaveTo" label="Last day away" type="date" /></VCol>
            <VCol cols="12" sm="6">
              <AppSelect
                v-model="leaveDelegate"
                :items="delegateItems"
                label="Covered by"
                placeholder="Choose a colleague"
                clearable
              />
            </VCol>
            <VCol cols="12" sm="6"><AppTextField v-model="leaveNote" label="Note for your cover (optional)" /></VCol>
          </VRow>
          <p v-if="(leaveFrom || leaveTo) && leaveProblem" class="text-body-2 text-error">{{ leaveProblem }}</p>
          <VBtn type="submit" :loading="leaveBusy" :disabled="!!leaveProblem">Set leave</VBtn>
        </VForm>
        <p v-else class="text-body-2 text-medium-emphasis mb-0">Your leave settings could not be loaded.</p>
      </VCardText>
    </VCard>

    <VCard>
      <VCardText>
        <div class="d-flex align-center justify-space-between flex-wrap ga-2 mb-1">
          <h2 class="text-h5">Email notifications</h2>
          <VChip size="small" variant="tonal" color="secondary">Preview, not saved yet</VChip>
        </div>
        <p class="text-body-2 text-medium-emphasis mb-3">
          In-app alerts are always on. Choose which ones also reach your inbox.
        </p>
        <VSwitch
          v-for="item in emailPreferences"
          :key="item.key"
          v-model="item.on"
          :label="item.label"
          color="primary"
          hide-details
          density="compact"
        />
        <VSwitch label="Security notices" model-value color="primary" hide-details density="compact" disabled />
        <p class="text-body-2 text-medium-emphasis mt-2 mb-0">Security notices can't be turned off.</p>
      </VCardText>
    </VCard>
  </div>
</template>
