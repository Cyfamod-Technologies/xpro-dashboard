<script setup lang="ts">
import { useOperationsStore } from "@/stores/operations"
import { isWorkspaceRole, sectionPath } from "@/features/workspace/config"
import { isFinished, statusLabelFor, when } from "@/features/operations/types"
import { isUnclaimedOverdue } from "@/features/operations/staff"
import { pendingApprovals } from "@/features/operations/workflow"

const ops = useOperationsStore()
const role = computed(() => ops.actor?.role)

const adminCounters = computed<{ label: string; value: number; to?: string }[]>(() => [
  { label: "Awaiting approval", value: pendingApprovals(ops.state).length, to: "/admin/approvals" },
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
  {
    label: "Quotes awaiting response",
    value: ops.requests.filter(item => item.quotes.some(quote => quote.status === "sent")).length,
  },
  {
    label: "Confirmed schedules",
    value: ops.requests.filter(item => item.schedules.at(-1)?.status === "confirmed" && !isFinished(item.status))
      .length,
  },
  {
    label: role.value === "admin" ? "Providers pending review" : "Unread updates",
    value:
      role.value === "admin"
        ? ops.state.providers.filter(item => item.verification === "pending").length
        : ops.notifications.filter(item => !item.read).length,
  },
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
</script>

<template>
  <div class="d-flex justify-space-between align-start flex-wrap gap-4 mb-6">
    <div>
      <div class="text-overline text-primary">{{ role }} WORKSPACE</div>
      <h1 class="text-h3 mb-2">Welcome, {{ ops.actor?.name.split(" ")[0] }}.</h1>
      <p class="text-medium-emphasis mb-0">
        {{
          role === "customer"
            ? "Your requests, decisions and project updates in one place."
            : "Keep every handoff moving, from intake to completion."
        }}
      </p>
    </div>
    <VBtn v-if="role === 'customer'" to="/request" prepend-icon="tabler-plus"> Request a service </VBtn>
  </div>
  <VRow class="mb-6">
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
  </VRow>
  <VAlert
    v-if="role === 'provider'"
    class="mb-6"
    :color="ops.profile?.verification === 'approved' ? 'success' : 'warning'"
    variant="tonal"
  >
    Profile: {{ ops.profile?.verification.replaceAll("_", " ") ?? "not submitted" }}. {{ ops.profile?.reviewNote }}
    <VBtn to="/verification" size="small" variant="text"> Manage profile </VBtn>
  </VAlert>
  <VAlert v-if="role === 'provider' && payoutAlert" class="mb-6" color="warning" variant="tonal">
    {{ payoutAlert }} <VBtn to="/payouts" size="small" variant="text"> Payout details </VBtn>
  </VAlert>
  <div v-if="role === 'admin'" class="d-flex flex-wrap gap-3 mb-6">
    <VBtn to="/admin/requests"> Review requests </VBtn
    ><VBtn to="/admin/providers" variant="outlined"> Review providers </VBtn
    ><VBtn to="/admin/dispatch" variant="outlined"> Open dispatch </VBtn
    ><VBtn to="/admin/audit" variant="text"> Activity history </VBtn>
  </div>
  <VCard>
    <VCardText>
      <div class="d-flex justify-space-between flex-wrap gap-3 mb-4">
        <h2 class="text-h5">
          {{ role === "provider" ? "Your job queue" : "Recent requests" }}
        </h2>
        <VBtn :to="requestPath" variant="text"> View all </VBtn>
      </div>
      <VList v-if="ops.requests.length">
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
      <p v-else class="text-medium-emphasis py-6">
        {{
          role === "provider"
            ? "Assignment offers will appear here once XPro matches a job to your profile."
            : "No requests yet. Your submitted briefs will appear here."
        }}
      </p>
    </VCardText>
  </VCard>
  <VCard v-if="role === 'admin'" class="mt-6">
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
