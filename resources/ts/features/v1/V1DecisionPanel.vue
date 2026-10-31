<script setup lang="ts">
import { formatDateTime, formatDay, formatNaira } from "@/features/v1/helpers"
import type { V1Actor, V1Request } from "@/features/v1/types"

const props = defineProps<{ request: V1Request; viewer: V1Actor }>()

const isCustomer = computed(() => props.viewer === "customer")
const terms = computed(() => props.request.decision.terms)
// V1-ASSUMPTION A2: the customer sees the agreed price, the date and the provider's display name once approved.
const providerName = computed(() => props.request.provider?.providerName ?? terms.value?.providerName ?? "")
</script>

<template>
  <VAlert v-if="request.status === 'submitted'" type="info" variant="tonal" icon="tabler-hourglass">
    <div class="text-subtitle-1 font-weight-medium">Awaiting Xpro's decision</div>
    <p class="mb-0">
      {{
        isCustomer
          ? "Xpro has your request. You can talk to the team here while we review it."
          : request.assignee
            ? `Assigned to ${request.assignee.name}. They or an admin can approve or deny the intake decision.`
            : "No staff member is assigned yet."
      }}
    </p>
  </VAlert>

  <VAlert v-else-if="request.status === 'approved'" type="success" variant="tonal" icon="tabler-circle-check">
    <div class="text-subtitle-1 font-weight-medium">Request approved</div>
    <p v-if="!terms" class="text-body-2 mb-0 mt-2">
      Xpro has approved the request. Provider assignment and agreed terms will appear here once confirmed.
    </p>
    <VRow v-if="terms" dense class="mt-1">
      <VCol cols="12" sm="4">
        <div class="text-caption">Agreed price</div>
        <div class="text-h6">{{ formatNaira(terms.priceKobo) }}</div>
      </VCol>
      <VCol cols="12" sm="4">
        <div class="text-caption">Date</div>
        <div class="text-h6">{{ formatDay(terms.date) }}</div>
      </VCol>
      <VCol cols="12" sm="4">
        <div class="text-caption">Provider</div>
        <div class="text-h6">{{ providerName }}</div>
      </VCol>
    </VRow>
    <p class="text-body-2 mb-0 mt-2">
      {{ isCustomer ? "Approved by Xpro" : `Approved by ${request.decision.by?.name ?? "an admin"}` }}
      · {{ formatDateTime(request.decision.at) }}
    </p>
  </VAlert>

  <VAlert v-else-if="request.status === 'cancelled'" type="info" variant="tonal" icon="tabler-circle-minus">
    <div class="text-subtitle-1 font-weight-medium">Request cancelled</div>
    <p class="mb-0">
      {{
        isCustomer ? "You cancelled this request. It remains in your history." : "The customer cancelled this request."
      }}
      <template v-if="request.cancelledAt"> · {{ formatDateTime(request.cancelledAt) }}</template>
    </p>
    <VBtn v-if="isCustomer" class="mt-4" color="primary" prepend-icon="tabler-plus" to="/request">
      Create a new request
    </VBtn>
  </VAlert>

  <VAlert v-else-if="request.status === 'denied'" type="error" variant="tonal" icon="tabler-circle-x">
    <div class="text-subtitle-1 font-weight-medium">Request denied</div>
    <p class="mb-2 denial-reason">{{ request.decision.reason }}</p>
    <p class="text-body-2 mb-0">
      {{ isCustomer ? "Denied by Xpro" : `Denied by ${request.decision.by?.name ?? "an admin"}` }}
      · {{ formatDateTime(request.decision.at) }}
    </p>
    <VBtn
      v-if="isCustomer"
      class="mt-4"
      color="primary"
      prepend-icon="tabler-plus"
      :to="{ path: '/request', query: { from: request.id } }"
    >
      Create a new request
    </VBtn>
  </VAlert>
</template>

<style scoped>
.denial-reason {
  white-space: pre-line;
}
</style>
