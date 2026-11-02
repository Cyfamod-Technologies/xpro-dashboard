<script setup lang="ts">
import type { PlatformTransactionView } from "@/features/requests/api-types"
import { RequestsApiError, requestsApi } from "@/services/requests-api"
import { isDemoMode } from "@/utils/demo-mode"

const router = useRouter()
const items = ref<PlatformTransactionView[]>([])
const page = ref(1)
const limit = 25
const total = ref(0)
const search = ref("")
const appliedSearch = ref("")
const status = ref("")
const method = ref("")
const loading = ref(false)
const error = ref("")

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / limit)))
const money = (amount: number | null) =>
  amount == null
    ? "Restricted"
    : new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 }).format(
        amount / 100,
      )
const dateTime = (value: string | null) => (value ? new Date(value).toLocaleString() : "—")
const label = (value: string) => value.replaceAll("_", " ")

const load = async () => {
  if (isDemoMode) return
  loading.value = true
  error.value = ""
  try {
    const result = await requestsApi.platformTransactions({
      page: page.value,
      limit,
      status: status.value || undefined,
      method: method.value || undefined,
      q: appliedSearch.value || undefined,
    })
    items.value = result.items
    total.value = result.total
  } catch (cause) {
    error.value = cause instanceof RequestsApiError ? cause.message : "Transactions could not be loaded."
  } finally {
    loading.value = false
  }
}

const applyFilters = () => {
  page.value = 1
  appliedSearch.value = search.value.trim()
  load()
}

watch([page, status, method], () => load())
onMounted(() => load())
</script>

<template>
  <VCard>
    <VCardText>
      <div class="d-flex align-center justify-space-between flex-wrap ga-3 mb-4">
        <div>
          <h2 class="text-h5 mb-1">Platform transactions</h2>
          <p class="text-body-2 text-medium-emphasis mb-0">Read-only record of customer payments across XPro.</p>
        </div>
        <VBtn variant="tonal" prepend-icon="tabler-refresh" :loading="loading" @click="load">Refresh</VBtn>
      </div>

      <VAlert v-if="isDemoMode" type="info" variant="tonal">
        Live transaction records appear here in the connected workspace. The local demo does not simulate payments.
      </VAlert>
      <template v-else>
        <div class="d-flex flex-wrap ga-3 mb-4">
          <VTextField
            v-model="search"
            label="Search"
            placeholder="Reference, request or customer"
            prepend-inner-icon="tabler-search"
            clearable
            hide-details
            class="flex-grow-1"
            style="min-width: 240px"
            @keydown.enter="applyFilters"
            @click:clear="applyFilters"
          />
          <VSelect
            v-model="status"
            label="Status"
            :items="[
              { title: 'Any status', value: '' },
              { title: 'Pending', value: 'pending' },
              { title: 'Recorded', value: 'recorded' },
              { title: 'Paid', value: 'paid' },
              { title: 'Failed', value: 'failed' },
              { title: 'Partially refunded', value: 'partially_refunded' },
              { title: 'Refunded', value: 'refunded' },
              { title: 'Reversed', value: 'reversed' },
            ]"
            hide-details
            style="min-width: 180px"
          />
          <VSelect
            v-model="method"
            label="Method"
            :items="[
              { title: 'Any method', value: '' },
              { title: 'Paystack', value: 'paystack' },
              { title: 'Offline', value: 'offline' },
            ]"
            hide-details
            style="min-width: 160px"
          />
          <VBtn prepend-icon="tabler-filter" @click="applyFilters">Apply</VBtn>
        </div>

        <VAlert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</VAlert>
        <div v-if="loading && !items.length" class="d-flex justify-center pa-8">
          <VProgressCircular indeterminate />
        </div>
        <VTable v-else-if="items.length" hover>
          <thead>
            <tr>
              <th>Transaction</th>
              <th>Request</th>
              <th>Customer</th>
              <th>Method</th>
              <th>Status</th>
              <th>Date</th>
              <th class="text-end">Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id">
              <td>
                <div>{{ item.reference || "—" }}</div>
                <div class="text-caption text-medium-emphasis">{{ item.channel || "" }}</div>
              </td>
              <td>
                <div>{{ item.requestId }}</div>
                <div class="text-caption text-medium-emphasis text-truncate" style="max-width: 220px">
                  {{ item.requestTitle }}
                </div>
              </td>
              <td>
                <div>{{ item.customerName }}</div>
                <div class="text-caption text-medium-emphasis">{{ item.customerEmail || "—" }}</div>
              </td>
              <td class="text-capitalize">{{ label(item.method) }}</td>
              <td>
                <VChip size="small" variant="tonal" :color="item.status === 'paid' ? 'success' : 'default'">{{
                  label(item.status)
                }}</VChip>
              </td>
              <td>{{ dateTime(item.paidAt || item.createdAt) }}</td>
              <td class="text-end text-no-wrap">{{ money(item.amount) }}</td>
              <td class="text-end">
                <VBtn
                  icon="tabler-arrow-up-right"
                  size="small"
                  variant="text"
                  aria-label="View request"
                  @click="router.push({ path: '/admin/requests', query: { request: item.requestRecordId } })"
                />
              </td>
            </tr>
          </tbody>
        </VTable>
        <div v-else class="text-medium-emphasis py-8 text-center">No transactions match these filters.</div>

        <div v-if="total" class="d-flex align-center justify-space-between mt-4">
          <span class="text-body-2 text-medium-emphasis">{{ total }} transaction{{ total === 1 ? "" : "s" }}</span>
          <VPagination v-model="page" :length="pageCount" :total-visible="5" density="comfortable" />
        </div>
      </template>
    </VCardText>
  </VCard>
</template>
