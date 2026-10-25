<script setup lang="ts">
import type { EarningsItemView } from "@/features/requests/api-types"
import { RequestsApiError, requestsApi } from "@/services/requests-api"

const payouts = ref<EarningsItemView[]>([])
const loading = ref(true)
const error = ref("")
const money = (amount?: number) =>
  amount == null ? "—" : new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(amount / 100)

onMounted(async () => {
  try {
    payouts.value = (await requestsApi.earnings()).payouts
  } catch (cause) {
    error.value = cause instanceof RequestsApiError ? cause.message : "Earnings could not be loaded."
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <VCard
    ><VCardText>
      <div class="d-flex align-center justify-space-between mb-4">
        <h2 class="text-h5 mb-0">Payout history</h2>
        <VProgressCircular v-if="loading" indeterminate size="20" />
      </div>
      <VAlert v-if="error" type="error" variant="tonal">{{ error }}</VAlert>
      <VTable v-else-if="payouts.length"
        ><thead>
          <tr>
            <th>Request</th>
            <th>Bank</th>
            <th>Status</th>
            <th class="text-end">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="payout in payouts" :key="payout.id">
            <td>{{ payout.requestId || payout.id }}</td>
            <td>{{ payout.maskedBankAccount || "—" }}</td>
            <td>
              {{ payout.status.replaceAll("_", " ") }}
              <div v-if="payout.holdReason" class="text-caption text-medium-emphasis">{{ payout.holdReason }}</div>
            </td>
            <td class="text-end">{{ money(payout.amount) }}</td>
          </tr>
        </tbody></VTable
      >
      <p v-else-if="!loading" class="text-medium-emphasis mb-0">
        Your earnings will appear here when a payout is created.
      </p>
    </VCardText></VCard
  >
</template>
