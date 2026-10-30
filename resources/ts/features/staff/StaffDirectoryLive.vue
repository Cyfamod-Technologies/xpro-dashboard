<script setup lang="ts">
import { useDebounceFn, useIntervalFn } from "@vueuse/core"
import { useDisplay } from "vuetify"
import type { StaffRole } from "@/features/operations/types"
import { staffRoleLabels } from "@/features/operations/staff"
import StaffActionDialogs from "@/features/staff/StaffActionDialogs.vue"
import StaffRowMenu from "@/features/staff/StaffRowMenu.vue"
import type { StaffAction } from "@/features/staff/StaffActionDialogs.vue"
import {
  formatDateTime,
  fullName,
  initials,
  isFormer,
  staffStatusColors,
  staffStatusLabels,
  statusNote,
} from "@/features/staff/staff-helpers"
import type { StaffActionKey } from "@/features/staff/staff-helpers"
import type { StaffMemberView, StaffSummary } from "@/services/staff-api"
import { staffApi } from "@/services/staff-api"
import { useOperationsStore } from "@/stores/operations"

type Filter = "current" | "active" | "invited" | "suspended" | "former"

const { smAndDown } = useDisplay()
const route = useRoute()
const router = useRouter()
const ops = useOperationsStore()

const filterOf = (value: unknown): Filter =>
  ["active", "invited", "suspended", "former"].includes(String(value)) ? (String(value) as Filter) : "current"

const filter = ref<Filter>(filterOf(route.query.status))
const search = ref(typeof route.query.q === "string" ? route.query.q : "")
const role = ref<StaffRole | "">(typeof route.query.role === "string" ? (route.query.role as StaffRole) : "")
const page = ref(Number(route.query.page) > 0 ? Number(route.query.page) : 1)
const itemsPerPage = ref(25)

const rows = ref<StaffMemberView[]>([])
const total = ref(0)
const summary = ref<StaffSummary | null>(null)
const loading = ref(false)
const error = ref("")
const notice = ref("")

const action = ref<StaffAction | null>(null)
const target = ref<StaffMemberView | null>(null)
const prefill = ref<{ firstName: string; lastName: string; email: string } | null>(null)

const selfId = computed(() => ops.actor?.id)
const actionContext = computed(() => ({
  selfId: selfId.value,
  canResetMfa: ops.can("staff.mfa.reset"),
  activeSuperAdmins: summary.value?.activeSuperAdmins ?? 2,
}))

const headers = [
  { title: "Name", key: "name", sortable: false },
  { title: "Roles", key: "roles", sortable: false },
  { title: "Status", key: "status", sortable: false },
  { title: "Open requests", key: "open", sortable: false },
  { title: "Last sign-in", key: "lastSignInAt", sortable: false },
  { title: "", key: "actions", sortable: false, align: "end" as const },
]

const pills = computed<Array<{ value: Filter; label: string; count?: number; hint?: string }>>(() => [
  { value: "current", label: "All current" },
  { value: "active", label: "Active", count: summary.value?.active },
  {
    value: "invited",
    label: "Invited",
    count: summary.value?.invited,
    hint: summary.value?.invitedExpired ? `${summary.value.invitedExpired} expired` : undefined,
  },
  { value: "suspended", label: "Suspended", count: summary.value?.suspended },
  { value: "former", label: "Former", count: summary.value?.former },
])

const syncUrl = () => {
  const query: Record<string, string> = {}
  if (filter.value !== "current") query.status = filter.value
  if (role.value) query.role = role.value
  if (search.value.trim()) query.q = search.value.trim()
  if (page.value > 1) query.page = String(page.value)
  router.replace({ query })
}

const load = async (quiet = false) => {
  if (!quiet) loading.value = true
  error.value = ""
  try {
    const status = ["active", "invited", "suspended"].includes(filter.value)
      ? (filter.value as StaffMemberView["status"])
      : undefined
    const [list, counts] = await Promise.all([
      staffApi.list({
        q: search.value.trim() || undefined,
        status,
        group: status ? undefined : filter.value === "former" ? "former" : "current",
        role: role.value || undefined,
        page: page.value,
        limit: itemsPerPage.value,
      }),
      staffApi.summary(),
    ])
    rows.value = list.data.items
    total.value = list.data.total
    summary.value = counts.data
  } catch (cause) {
    if (!quiet) error.value = cause instanceof Error ? cause.message : "Staff could not be loaded."
  } finally {
    loading.value = false
  }
}

const pick = (value: Filter) => {
  filter.value = value
  page.value = 1
}
const searchLater = useDebounceFn(() => {
  page.value = 1
}, 300)

watch(search, searchLater)
watch([filter, role, page, itemsPerPage], () => {
  syncUrl()
  load()
})
onMounted(() => load())

// Keeps the list fresh while the tab is visible and nothing is being edited.
useIntervalFn(() => {
  if (document.visibilityState === "visible" && !action.value) load(true)
}, 30000)

const open = (member: StaffMemberView) => router.push(`/admin/staff/${encodeURIComponent(member.id)}`)

const start = (member: StaffMemberView | null, key: StaffActionKey | "invite") => {
  target.value = member
  prefill.value = null
  if (key === "invite" || key === "inviteAgain") {
    action.value = "invite"
    if (member)
      prefill.value = { firstName: member.firstName ?? "", lastName: member.lastName ?? "", email: member.email }

    return
  }
  action.value = key as StaffAction
}

const changed = async (member: StaffMemberView) => {
  notice.value = `${fullName(member)} was updated.`
  await load(true)
}

const onlyYou = computed(
  () =>
    filter.value === "current" &&
    !search.value &&
    !role.value &&
    rows.value.length === 1 &&
    rows.value[0].id === selfId.value,
)
const emptyText = computed(() => (filter.value === "former" ? "No former staff." : "No staff match these filters."))
</script>

<template>
  <div class="d-flex justify-end mb-4">
    <VBtn prepend-icon="tabler-user-plus" @click="start(null, 'invite')">Invite staff</VBtn>
  </div>

  <VAlert
    v-if="summary && summary.activeSuperAdmins < 2"
    type="warning"
    variant="tonal"
    class="mb-4"
    title="Only one active super admin"
  >
    If that account is locked out, access can only be recovered through the break-glass procedure. Invite a second super
    admin.
  </VAlert>
  <VAlert v-if="notice" type="success" variant="tonal" closable class="mb-4" @click:close="notice = ''">
    {{ notice }}
  </VAlert>

  <div class="d-flex flex-wrap gap-2 mb-4" role="group" aria-label="Filter staff by status">
    <VChip
      v-for="pill in pills"
      :key="pill.value"
      link
      :variant="filter === pill.value ? 'flat' : 'tonal'"
      :color="filter === pill.value ? 'primary' : undefined"
      :aria-pressed="filter === pill.value"
      @click="pick(pill.value)"
    >
      {{ pill.label }}
      <span v-if="pill.count !== undefined" class="ms-1 font-weight-bold">{{ pill.count }}</span>
      <span v-if="pill.hint" class="ms-1">· {{ pill.hint }}</span>
    </VChip>
  </div>

  <VCard class="mb-4">
    <VCardText>
      <VRow>
        <VCol cols="12" md="8">
          <VTextField
            v-model="search"
            label="Search name or email"
            prepend-inner-icon="tabler-search"
            hide-details
            clearable
          />
        </VCol>
        <VCol cols="12" md="4">
          <VSelect
            v-model="role"
            label="Role"
            :items="[
              { title: 'All roles', value: '' },
              ...Object.entries(staffRoleLabels).map(([value, title]) => ({ title, value })),
            ]"
            hide-details
          />
        </VCol>
      </VRow>
    </VCardText>
  </VCard>

  <VAlert v-if="error" type="error" variant="tonal" class="mb-4">
    {{ error }}
    <template #append><VBtn size="small" variant="text" @click="load">Retry</VBtn></template>
  </VAlert>

  <VAlert v-if="onlyYou" type="info" variant="tonal" class="mb-4">
    You're the only staff member. Invite your team to share the work.
  </VAlert>

  <VCard v-if="!smAndDown">
    <VDataTableServer
      v-model:page="page"
      v-model:items-per-page="itemsPerPage"
      :headers="headers"
      :items="rows"
      :items-length="total"
      :loading="loading"
      :items-per-page-options="[10, 25, 50]"
      :no-data-text="emptyText"
      hover
      @click:row="(_: Event, { item }: { item: StaffMemberView }) => open(item)"
    >
      <template #item.name="{ item }">
        <div class="d-flex align-center gap-3 py-2">
          <VAvatar size="36" color="primary" variant="tonal">{{ initials(item) }}</VAvatar>
          <div>
            <strong>{{ fullName(item) }}</strong>
            <span v-if="item.id === selfId" class="text-caption text-medium-emphasis"> (you)</span>
            <div class="text-body-2 text-medium-emphasis">{{ item.email }}</div>
          </div>
        </div>
      </template>
      <template #item.roles="{ item }">
        <div class="d-flex flex-wrap gap-1">
          <VChip v-for="r in item.roles" :key="r" size="small" variant="tonal" color="primary">
            {{ staffRoleLabels[r] }}
          </VChip>
        </div>
      </template>
      <template #item.status="{ item }">
        <VChip size="small" variant="tonal" :color="staffStatusColors[item.status]">
          {{ staffStatusLabels[item.status] }}
        </VChip>
        <div
          v-if="statusNote(item)"
          class="text-caption mt-1"
          :class="statusNote(item)!.tone === 'error' ? 'text-error' : 'text-medium-emphasis'"
        >
          {{ statusNote(item)!.text }}
        </div>
      </template>
      <template #item.open="{ item }">
        <template v-if="isFormer(item.status) || item.status === 'invited'">—</template>
        <template v-else>
          {{ item.workload.openOwned }}
          <VChip v-if="item.workload.overdueOwned" size="x-small" color="error" variant="tonal" class="ms-1">
            {{ item.workload.overdueOwned }} overdue
          </VChip>
        </template>
      </template>
      <template #item.lastSignInAt="{ item }">{{ formatDateTime(item.lastSignInAt) }}</template>
      <template #item.actions="{ item }">
        <StaffRowMenu :member="item" :context="actionContext" @open="open(item)" @action="start(item, $event)" />
      </template>
    </VDataTableServer>
  </VCard>

  <div v-else aria-live="polite">
    <div v-if="loading" class="d-flex justify-center py-6">
      <VProgressCircular indeterminate color="primary" aria-label="Loading staff" />
    </div>
    <p v-else-if="!rows.length" class="text-body-2 text-medium-emphasis text-center py-6">{{ emptyText }}</p>
    <VCard v-for="item in rows" :key="item.id" class="mb-3" link @click="open(item)">
      <VCardText class="d-flex align-start gap-3">
        <VAvatar size="40" color="primary" variant="tonal">{{ initials(item) }}</VAvatar>
        <div class="flex-grow-1" style="min-inline-size: 0">
          <strong>{{ fullName(item) }}</strong>
          <span v-if="item.id === selfId" class="text-caption text-medium-emphasis"> (you)</span>
          <div class="text-body-2 text-medium-emphasis text-truncate">{{ item.email }}</div>
          <div class="d-flex flex-wrap gap-1 mt-2">
            <VChip size="small" variant="tonal" :color="staffStatusColors[item.status]">
              {{ staffStatusLabels[item.status] }}
            </VChip>
            <VChip v-for="r in item.roles" :key="r" size="small" variant="tonal" color="primary">
              {{ staffRoleLabels[r] }}
            </VChip>
          </div>
          <div
            v-if="statusNote(item)"
            class="text-caption mt-1"
            :class="statusNote(item)!.tone === 'error' ? 'text-error' : 'text-medium-emphasis'"
          >
            {{ statusNote(item)!.text }}
          </div>
          <div v-if="!isFormer(item.status) && item.status !== 'invited'" class="text-caption mt-1">
            {{ item.workload.openOwned }} open request{{ item.workload.openOwned === 1 ? "" : "s" }}
            <span v-if="item.workload.overdueOwned" class="text-error">
              · {{ item.workload.overdueOwned }} overdue</span
            >
          </div>
        </div>
        <StaffRowMenu :member="item" :context="actionContext" @open="open(item)" @action="start(item, $event)" />
      </VCardText>
    </VCard>
    <VPagination v-if="total > itemsPerPage" v-model="page" :length="Math.ceil(total / itemsPerPage)" class="mt-2" />
  </div>

  <StaffActionDialogs
    :action="action"
    :member="target"
    :prefill="prefill"
    @close="action = null"
    @changed="changed"
    @stale="load"
  />
</template>
