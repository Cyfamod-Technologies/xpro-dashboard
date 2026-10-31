<script setup lang="ts">
import V1StatusChip from "@/features/v1/V1StatusChip.vue"
import { formatDay } from "@/features/v1/helpers"
import type { V1Actor, V1Counts, V1Request } from "@/features/v1/types"
import { v1Api } from "@/services/v1-api"
import { useAuthStore } from "@/stores/auth"
import { useOperationsStore } from "@/stores/operations"
import { isDemoMode } from "@/utils/demo-mode"
import { store } from "@/mocks/v1/handlers"
import { getErrorMessage } from "@/utils/errors"

// The Overview for customers, admins and providers. Counts come from the V1 API. Staff have no Overview.
const props = defineProps<{ viewer: Extract<V1Actor, "customer" | "admin" | "provider"> }>()
const auth = useAuthStore()
const ops = useOperationsStore()

const counts = ref<V1Counts | null>(null)
const recent = ref<V1Request[]>([])
const jobCount = ref<number | null>(null)
const loading = ref(true)
const error = ref("")

const isCustomer = computed(() => props.viewer === "customer")
const isAdmin = computed(() => props.viewer === "admin")
const requestsPath = computed(() => (isAdmin.value ? "/admin/requests" : "/requests"))
const demoProvider = ref<ReturnType<typeof store.providerForActor> | null>(null)

const cards = computed(() => {
  const data = counts.value
  if (!data) return []

  return isAdmin.value
    ? [
        { label: "Pending decision", value: data.submitted, query: { status: "submitted" } },
        { label: "Unassigned", value: data.unassigned ?? 0, query: { status: "submitted", assignee: "unassigned" } },
        { label: "Assigned to staff", value: data.assigned ?? 0, query: { status: "submitted", assignee: "assigned" } },
      ]
    : [
        { label: "Submitted", value: data.submitted, query: { status: "submitted" } },
        { label: "Approved", value: data.approved, query: { status: "approved" } },
        { label: "Denied", value: data.denied, query: { status: "denied" } },
        { label: "Cancelled", value: data.cancelled ?? 0, query: { status: "cancelled" } },
      ]
})

const profile = computed(() =>
  isDemoMode && demoProvider.value
    ? {
        verification: demoProvider.value.verified ? "approved" : "pending",
        reviewNote: "",
        available: demoProvider.value.available,
      }
    : ops.profile,
)
onMounted(async () => {
  try {
    if (props.viewer === "provider") {
      if (isDemoMode)
        demoProvider.value = store.providerForActor({
          id: auth.user?.id ?? "",
          role: "provider",
          name: `${auth.user?.firstName ?? ""} ${auth.user?.lastName ?? ""}`.trim(),
          email: auth.user?.email ?? "",
        })
      else await ops.refreshProviderProfile().catch(() => undefined)
      jobCount.value = (await v1Api.providerJobs()).length

      return
    }

    const [summary, page] = await Promise.all([v1Api.counts(), v1Api.listRequests({ itemsPerPage: 5 })])

    counts.value = summary
    recent.value = page.items
  } catch (cause) {
    error.value = getErrorMessage(cause, "Your overview could not be loaded.")
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <div class="d-flex justify-space-between align-start flex-wrap gap-4 mb-6">
      <div>
        <div class="text-overline text-primary">{{ viewer }} WORKSPACE</div>
        <h1 class="text-h3 mb-2">Welcome, {{ auth.user?.firstName ?? "there" }}.</h1>
        <p class="text-medium-emphasis mb-0">
          {{
            isCustomer
              ? "Your requests and Xpro's decisions in one place."
              : isAdmin
                ? "Requests waiting for a decision, and who is handling them."
                : "Your profile, availability and the jobs Xpro has assigned to you."
          }}
        </p>
      </div>
      <VBtn v-if="isCustomer" to="/request" prepend-icon="tabler-plus">Request a service</VBtn>
      <VBtn v-else-if="isAdmin" to="/admin/requests" prepend-icon="tabler-clipboard-list">Open the Requests queue</VBtn>
    </div>

    <VAlert v-if="error" type="error" variant="tonal" class="mb-6">{{ error }}</VAlert>
    <VProgressLinear v-if="loading" indeterminate class="mb-6" />

    <!-- Provider -->
    <template v-if="viewer === 'provider'">
      <VRow class="mb-6">
        <VCol cols="12" md="4">
          <VCard :to="{ path: '/settings', query: { tab: 'profile' } }" class="h-100">
            <VCardText>
              <div class="text-caption text-medium-emphasis mb-1">Profile verification</div>
              <div class="text-h5 mb-2 text-capitalize">
                {{ profile?.verification.replaceAll("_", " ") ?? "Not submitted" }}
              </div>
              <p v-if="profile?.reviewNote" class="text-body-2 mb-0">{{ profile.reviewNote }}</p>
              <p v-else class="text-body-2 text-medium-emphasis mb-0">
                Manage your provider profile and verification details.
              </p>
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="12" md="4">
          <VCard to="/availability" class="h-100">
            <VCardText>
              <div class="text-caption text-medium-emphasis mb-1">Availability</div>
              <div class="text-h5 mb-2">{{ profile?.available ? "Available for assignment" : "Not available" }}</div>
              <p class="text-body-2 text-medium-emphasis mb-0">Switch, weekly hours and time off.</p>
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="12" md="4">
          <VCard to="/jobs" class="h-100">
            <VCardText>
              <div class="text-caption text-medium-emphasis mb-1">My jobs</div>
              <div class="text-h3 text-primary mb-2">{{ jobCount ?? "–" }}</div>
              <p class="text-body-2 text-medium-emphasis mb-0">Jobs Xpro staff assigned to you.</p>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>
    </template>

    <!-- Customer and admin -->
    <template v-else>
      <VRow class="mb-6">
        <VCol v-for="card in cards" :key="card.label" cols="12" sm="4">
          <VCard :to="{ path: requestsPath, query: card.query }">
            <VCardText>
              <div class="text-h3 text-primary mb-2">{{ card.value }}</div>
              <div class="text-body-2">{{ card.label }}</div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <VCard>
        <VCardText>
          <div class="d-flex justify-space-between flex-wrap gap-3 mb-4">
            <h2 class="text-h5">Recent requests</h2>
            <VBtn :to="requestsPath" variant="text">View all</VBtn>
          </div>
          <VList v-if="recent.length" lines="two" class="pa-0">
            <VListItem
              v-for="request in recent"
              :key="request.id"
              :to="{ path: requestsPath, query: { request: request.id } }"
              :title="request.title"
              :subtitle="`${request.id} · ${request.service} · ${formatDay(request.createdAt)}`"
            >
              <template #append>
                <V1StatusChip :status="request.status" />
              </template>
            </VListItem>
          </VList>
          <p v-else-if="!loading" class="text-medium-emphasis py-6 mb-0">
            {{ isCustomer ? "No requests yet. Your submitted requests will appear here." : "No requests yet." }}
          </p>
        </VCardText>
      </VCard>
    </template>
  </div>
</template>
