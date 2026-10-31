<script setup lang="ts">
import { useOperationsStore } from "@/stores/operations"
import { useAuthStore } from "@/stores/auth"
import { isWorkspaceRole, sectionEnabled, sectionPath } from "@/features/workspace/config"
import { isFinished, statusLabelFor, when } from "@/features/operations/types"
import { isUnclaimedOverdue } from "@/features/operations/staff"
import { isDemoMode } from "@/utils/demo-mode"
import ProviderOnboardingDialog from "@/features/operations/ProviderOnboardingDialog.vue"
import type { V1Counts, V1Request } from "@/features/v1/types"
import { v1Api } from "@/services/v1-api"
import V1StatusChip from "@/features/v1/V1StatusChip.vue"
import { formatDay } from "@/features/v1/helpers"
import { getErrorMessage } from "@/utils/errors"

const props = defineProps<{ v1Mode?: boolean }>()

const ops = useOperationsStore()
const auth = useAuthStore()
const role = computed(() => ops.actor?.role)
const profileLoaded = ref(isDemoMode)
const v1Counts = ref<V1Counts>()
const v1Recent = ref<V1Request[]>([])
const v1Loading = ref(false)
const v1Error = ref("")

onMounted(async () => {
  if (props.v1Mode) {
    v1Loading.value = true
    try {
      const [counts, page] = await Promise.all([v1Api.counts(), v1Api.listRequests({ itemsPerPage: 5 })])
      v1Counts.value = counts
      v1Recent.value = page.items
    } catch (cause) {
      v1Error.value = getErrorMessage(cause, "Your overview could not be loaded.")
    } finally {
      v1Loading.value = false
    }

    return
  }
  if (isDemoMode || role.value !== "provider") return
  try {
    await ops.refreshProviderProfile()
    profileLoaded.value = true
  } catch (cause) {
    ops.error = cause instanceof Error ? cause.message : "Unable to load your provider profile."
  }
})

const adminCounters = computed<{ label: string; value: number; to?: string }[]>(() => [
  {
    label: "Unclaimed requests",
    value: ops.requests.filter(item => !item.staffOwnerId && !isFinished(item.status)).length,
  },
  { label: "Unclaimed over 2 hours", value: ops.requests.filter(item => isUnclaimedOverdue(item)).length },
  {
    label: "My open requests",
    value: ops.requests.filter(item => item.staffOwnerId === ops.actor?.id && !isFinished(item.status)).length,
  },
])

const counters = computed<{ label: string; value: number; to?: string }[]>(() => [
  {
    label: role.value === "provider" ? "Assigned jobs" : "Active requests",
    value: ops.requests.filter(item => !isFinished(item.status)).length,
  },
  ...(role.value === "admin"
    ? [
        {
          label: "Providers pending review",
          value: ops.state.providers.filter(item => item.verification === "pending").length,
        },
      ]
    : []),
  ...(role.value === "admin" ? adminCounters.value : []),
])

const payoutAlert = computed(() => {
  const payout = ops.profile?.payout

  if (!payout?.current)
    return payout?.review?.state === "pending"
      ? "Payouts are paused until XPro verifies your bank details."
      : payout?.review?.state === "rejected"
        ? `Your bank details were not approved${payout.review.note ? `: ${payout.review.note}` : "."}`
        : "Add your bank details so XPro can pay you."
  if (payout.review?.state === "pending")
    return "Your bank change is awaiting XPro review. Payouts are paused until XPro verifies your new bank details."
  if (payout.review?.state === "rejected")
    return `Your last bank change was not approved${payout.review.note ? `: ${payout.review.note}` : "."}`

  return ""
})

const pathFor = (id: string) => (isWorkspaceRole(role.value) ? sectionPath(role.value, id) : "/")
const requestPath = computed(() => pathFor(role.value === "provider" ? "jobs" : "requests"))
const v1AdminCounters = computed(() => [
  { label: "Pending decision", value: v1Counts.value?.submitted ?? 0, query: { status: "submitted" } },
  {
    label: "Unassigned",
    value: v1Counts.value?.unassigned ?? 0,
    query: { status: "submitted", assignee: "unassigned" },
  },
  {
    label: "Assigned to staff",
    value: v1Counts.value?.assigned ?? 0,
    query: { status: "submitted", assignee: "assigned" },
  },
])
</script>

<template>
  <ProviderOnboardingDialog v-if="role === 'provider'" :ready="profileLoaded" />
  <div class="d-flex justify-space-between align-start flex-wrap gap-4 mb-6">
    <div>
      <div class="text-overline text-primary">{{ role }} WORKSPACE</div>
      <h1 class="text-h3 mb-2">Welcome, {{ auth.user?.firstName ?? "there" }}.</h1>
      <p class="text-medium-emphasis mb-0">
        {{
          role === "customer"
            ? "Your requests, decisions and project updates in one place."
            : v1Mode
              ? "Requests waiting for an Xpro decision, and the staff members handling them."
              : "Keep every handoff moving, from intake to completion."
        }}
      </p>
    </div>
    <VBtn v-if="role === 'customer'" to="/request" prepend-icon="tabler-plus"> Request a service </VBtn>
  </div>
  <VRow class="mb-6">
    <template v-if="v1Mode">
      <VCol v-for="counter in v1AdminCounters" :key="counter.label" cols="12" sm="4">
        <VCard :to="{ path: requestPath, query: counter.query }">
          <VCardText>
            <div class="text-h3 text-primary mb-2">{{ counter.value }}</div>
            <div class="text-body-2">{{ counter.label }}</div>
          </VCardText>
        </VCard>
      </VCol>
    </template>
    <template v-if="!v1Mode">
      <VCol v-for="counter in counters" :key="counter.label" cols="6" md="3">
        <VCard :to="counter.to">
          <VCardText>
            <div class="text-h3 text-primary mb-2">
              {{ counter.value }}
            </div>
            <div class="text-body-2">
              {{ counter.label }}
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </template>
  </VRow>
  <VAlert v-if="v1Mode && v1Error" class="mb-6" type="error" variant="tonal">{{ v1Error }}</VAlert>
  <VProgressLinear v-if="v1Mode && v1Loading" indeterminate class="mb-6" />
  <VAlert
    v-if="role === 'provider'"
    class="mb-6"
    :color="ops.profile?.verification === 'approved' ? 'success' : 'warning'"
    variant="tonal"
  >
    Profile: {{ ops.profile?.verification.replaceAll("_", " ") ?? "not submitted" }}. {{ ops.profile?.reviewNote }}
    <VBtn to="/verification" size="small" variant="text"> Manage profile </VBtn>
  </VAlert>
  <VAlert
    v-if="role === 'provider' && sectionEnabled('provider', 'payouts') && payoutAlert"
    class="mb-6"
    color="warning"
    variant="tonal"
  >
    {{ payoutAlert }} <VBtn to="/payouts" size="small" variant="text"> Payout details </VBtn>
  </VAlert>
  <div v-if="role === 'admin'" class="d-flex flex-wrap gap-3 mb-6">
    <VBtn to="/admin/requests"> Review requests </VBtn
    ><VBtn to="/admin/providers" variant="outlined"> Review providers </VBtn
    ><VBtn to="/admin/messages" variant="text"> Messages </VBtn>
  </div>
  <VCard>
    <VCardText>
      <div class="d-flex justify-space-between flex-wrap gap-3 mb-4">
        <h2 class="text-h5">
          {{ role === "provider" ? "Your job queue" : "Recent requests" }}
        </h2>
        <VBtn :to="requestPath" variant="text"> View all </VBtn>
      </div>
      <VList v-if="v1Mode && v1Recent.length" lines="two" class="pa-0">
        <VListItem
          v-for="request in v1Recent"
          :key="request.id"
          :to="{ path: requestPath, query: { request: request.id } }"
          :title="request.title"
          :subtitle="`${request.id} · ${request.service} · ${formatDay(request.createdAt)}`"
        >
          <template #append>
            <V1StatusChip :status="request.status" />
          </template>
        </VListItem>
      </VList>
      <VList v-else-if="!v1Mode && ops.requests.length">
        <VListItem
          v-for="request in ops.requests.slice(0, 5)"
          :key="request.id"
          :to="{ path: requestPath, query: { request: request.id } }"
          :title="request.title"
          :subtitle="`${request.id} · ${request.service} · ${request.city}`"
          class="py-3"
        >
          <template #append>
            <VChip size="small" variant="tonal" color="primary">
              {{ statusLabelFor(request.status, role ?? "customer") }}
            </VChip>
          </template>
        </VListItem>
      </VList>
      <p v-else-if="!v1Mode || !v1Loading" class="text-medium-emphasis py-6">
        {{
          role === "provider"
            ? "Assignment offers will appear here once XPro matches a job to your profile."
            : "No requests yet. Your submitted briefs will appear here."
        }}
      </p>
    </VCardText>
  </VCard>
  <VCard v-if="!v1Mode && role === 'admin' && sectionEnabled('admin', 'audit')" class="mt-6">
    <VCardText>
      <h2 class="text-h5 mb-4">Recent activity</h2>
      <div v-for="entry in ops.state.audit.slice(0, 4)" :key="entry.id" class="mb-4">
        <strong>{{ entry.action }}</strong>
        <div class="text-body-2 text-medium-emphasis">
          {{ entry.actor }} · {{ entry.resource }} · {{ when(entry.createdAt) }}
        </div>
      </div>
    </VCardText>
  </VCard>
</template>
