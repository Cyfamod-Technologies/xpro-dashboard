<script setup lang="ts">
import { contactMethodLabels, formatDateTime, formatDay, formatNaira } from "@/features/v1/helpers"
import { formatFileSize } from "@/features/operations/file-rules"
import type { V1Request } from "@/features/v1/types"

const props = defineProps<{
  request: V1Request
  /** Xpro views show the customer's name and email. */
  showCustomer?: boolean
}>()

const rows = computed(() => [
  ...(props.showCustomer
    ? [{ label: "Customer", value: `${props.request.customer.name} · ${props.request.customer.email}` }]
    : []),
  { label: "Service", value: props.request.service },
  { label: "Location", value: props.request.location },
  { label: "Site address", value: props.request.address },
  {
    label: "Contact",
    value: `${props.request.phone} · ${contactMethodLabels[props.request.contactMethod]}`,
  },
  { label: "Preferred start", value: formatDay(props.request.preferredDate) || "Not specified" },
  { label: "Budget", value: props.request.budgetKobo > 0 ? formatNaira(props.request.budgetKobo) : "Not specified" },
  { label: "Submitted", value: formatDateTime(props.request.createdAt) },
])
</script>

<template>
  <VCard variant="outlined">
    <VCardText>
      <h3 class="text-h6 mb-4">Request details</h3>
      <VRow dense>
        <VCol v-for="row in rows" :key="row.label" cols="12" sm="6">
          <div class="text-caption text-medium-emphasis">{{ row.label }}</div>
          <div class="text-body-1">{{ row.value }}</div>
        </VCol>
      </VRow>
      <VDivider class="my-4" />
      <div class="text-caption text-medium-emphasis">Description</div>
      <p class="text-body-1 mb-0 summary-description">{{ request.description }}</p>
      <template v-if="request.attachments.length">
        <VDivider class="my-4" />
        <div class="text-caption text-medium-emphasis mb-2">Files</div>
        <div v-for="file in request.attachments" :key="file.id" class="d-flex align-center gap-2 text-body-2 mb-1">
          <VIcon icon="tabler-paperclip" size="18" />
          {{ file.name }} · {{ formatFileSize(file.size) }}
        </div>
      </template>
    </VCardText>
  </VCard>
</template>

<style scoped>
.summary-description {
  white-space: pre-line;
}
</style>
