<script setup lang="ts">
import { useDebounceFn } from "@vueuse/core"
import type { ProviderReviewResponse, ProviderSignupResponse } from "@/services/providers-api"
import { providersApi } from "@/services/providers-api"

const props = withDefaults(defineProps<{ hidePayout?: boolean }>(), { hidePayout: false })
const router = useRouter()
const rows = ref<ProviderReviewResponse[]>([])
const search = ref("")
const verification = ref("")
const bankReview = ref("")
const page = ref(1)
const itemsPerPage = ref(25)
const total = ref(0)
const loading = ref(false)
const error = ref("")

const headers = [
  { title: "Provider", key: "provider", sortable: false },
  { title: "Trade", key: "trade", sortable: false },
  { title: "Area", key: "city", sortable: false },
  { title: "Profile", key: "verification", sortable: false },
  { title: "Payout", key: "payout", sortable: false },
  { title: "Availability", key: "available", sortable: false },
  { title: "Action", key: "actions", sortable: false, align: "end" as const },
]
const visibleHeaders = computed(() => (props.hidePayout ? headers.filter(item => item.key !== "payout") : headers))

const fullName = (provider: ProviderReviewResponse) =>
  [provider.firstName, provider.lastName].filter(Boolean).join(" ") || provider.email || "Provider"
const isSignup = (provider: ProviderReviewResponse): provider is ProviderSignupResponse =>
  "profileStarted" in provider && !provider.profileStarted
const profileStarted = (provider: ProviderReviewResponse) => isSignup(provider)
const profileStatus = (provider: ProviderReviewResponse) =>
  isSignup(provider) ? "Profile not started" : provider.verification.replaceAll("_", " ")
const bankStatus = (provider: ProviderReviewResponse) => {
  if (isSignup(provider)) return "—"
  const status = provider.bankReviewState
  if (status === "pending") return "Pending review"
  if (status === "verified") return "Verified"
  if (status === "rejected") return "Rejected"

  return "Not set"
}

const load = async () => {
  loading.value = true
  error.value = ""
  try {
    const response = await providersApi.listForReview({
      q: search.value.trim() || undefined,
      verification: verification.value || undefined,
      bankReview: bankReview.value ? (bankReview.value as "pending" | "verified" | "rejected" | "none") : undefined,
      page: page.value,
      limit: itemsPerPage.value,
    })
    rows.value = response.data.items
    total.value = response.data.total
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Providers could not be loaded."
  } finally {
    loading.value = false
  }
}

const searchLater = useDebounceFn(() => {
  page.value = 1
  load()
}, 300)

watch([verification, bankReview], () => {
  page.value = 1
  load()
})
watch(search, searchLater)
watch([page, itemsPerPage], () => load())
onMounted(load)

const openProvider = (provider: ProviderReviewResponse) => {
  if (isSignup(provider)) return
  router.push(`/admin/providers/${encodeURIComponent(provider.id)}`)
}
</script>

<template>
  <VCard class="mb-5">
    <VCardText>
      <VRow>
        <VCol cols="12" md="6">
          <VTextField
            v-model="search"
            label="Search name, email, trade or area"
            prepend-inner-icon="tabler-search"
            hide-details
            clearable
          />
        </VCol>
        <VCol v-if="!props.hidePayout" cols="12" sm="6" md="3">
          <VSelect
            v-model="verification"
            label="Profile status"
            :items="[
              { title: 'All statuses', value: '' },
              { title: 'Profile not started', value: 'draft' },
              { title: 'Pending review', value: 'pending' },
              { title: 'Approved', value: 'approved' },
              { title: 'Changes requested', value: 'changes_requested' },
              { title: 'Rejected', value: 'rejected' },
              { title: 'Delisted', value: 'delisted' },
            ]"
            hide-details
          />
        </VCol>
        <VCol cols="12" sm="6" md="3">
          <VSelect
            v-model="bankReview"
            label="Payout status"
            :items="[
              { title: 'All payout statuses', value: '' },
              { title: 'Pending review', value: 'pending' },
              { title: 'Verified', value: 'verified' },
              { title: 'Rejected', value: 'rejected' },
              { title: 'No bank details', value: 'none' },
            ]"
            hide-details
          />
        </VCol>
      </VRow>
    </VCardText>
  </VCard>

  <VAlert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</VAlert>

  <VCard>
    <VDataTableServer
      v-model:page="page"
      v-model:items-per-page="itemsPerPage"
      :headers="visibleHeaders"
      :items="rows"
      :items-length="total"
      :loading="loading"
      :items-per-page-options="[10, 25, 50]"
      no-data-text="No providers match these filters."
    >
      <template #item.provider="{ item }">
        <div class="py-2">
          <strong>{{ fullName(item) }}</strong>
          <div class="text-body-2 text-medium-emphasis">{{ item.email }}</div>
        </div>
      </template>
      <template #item.trade="{ item }">
        {{ "profileStarted" in item ? "—" : item.trade }}
      </template>
      <template #item.city="{ item }">
        {{ "profileStarted" in item ? "—" : item.city }}
      </template>
      <template #item.verification="{ item }">
        <VChip size="small" color="primary" variant="tonal">{{ profileStatus(item) }}</VChip>
      </template>
      <template #item.payout="{ item }">
        <VChip
          v-if="bankStatus(item) !== '—'"
          size="small"
          :color="
            bankStatus(item) === 'Verified'
              ? 'success'
              : bankStatus(item) === 'Pending review'
                ? 'warning'
                : 'secondary'
          "
          variant="tonal"
        >
          {{ bankStatus(item) }}
        </VChip>
        <span v-else>—</span>
      </template>
      <template #item.available="{ item }">
        {{ "profileStarted" in item ? "—" : item.available ? "Accepting work" : "Paused" }}
      </template>
      <template #item.actions="{ item }">
        <VBtn size="small" variant="text" :disabled="profileStarted(item)" @click="openProvider(item)">
          {{ profileStarted(item) ? "Awaiting profile" : "Open details" }}
        </VBtn>
      </template>
    </VDataTableServer>
  </VCard>
</template>
