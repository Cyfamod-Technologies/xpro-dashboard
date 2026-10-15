<script setup lang="ts">
import type { DashboardMetric } from "@/types/domain"

defineProps<{ metric: DashboardMetric }>()
</script>

<template>
  <VCard class="metric-card h-100">
    <VCardText class="d-flex align-start justify-space-between">
      <div>
        <p class="text-body-2 text-medium-emphasis mb-2">
          {{ metric.label }}
        </p>
        <div class="text-h3 font-weight-bold mb-1">
          {{ metric.value }}
        </div>
        <span class="text-caption text-medium-emphasis">{{ metric.helper }}</span>
      </div>
      <VAvatar :color="metric.color" rounded variant="tonal" size="46">
        <VIcon :icon="metric.icon" size="25" />
      </VAvatar>
    </VCardText>
  </VCard>
</template>

<style scoped>
.metric-card {
  border-block-start: 3px solid rgb(var(--v-theme-primary));
}
</style>
