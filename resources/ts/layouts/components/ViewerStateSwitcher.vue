<script setup lang="ts">
import { storeToRefs } from 'pinia'

import { useViewerLocationStore } from '@/stores/viewer-location'
import { NIGERIAN_STATES } from '@/utils/constants'

const location = useViewerLocationStore()
const { selectedCountry, selectedState } = storeToRefs(location)
</script>

<template>
  <div class="viewer-state-switcher px-4 pb-4">
    <div class="d-flex align-center justify-space-between mb-2">
      <span class="text-caption font-weight-semibold text-medium-emphasis">Budget location</span>
      <VChip
        color="primary"
        size="x-small"
        variant="tonal"
      >
        {{ selectedCountry }}
      </VChip>
    </div>
    <AppSelect
      v-model="selectedState"
      aria-label="Select budget state"
      density="compact"
      hide-details
      :items="NIGERIAN_STATES"
      label="State"
      prepend-inner-icon="tabler-map-pin"
    />
  </div>
</template>

<style scoped>
.viewer-state-switcher {
  border-block-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

:global(.layout-vertical-nav-collapsed .layout-vertical-nav:not(.hovered)) .viewer-state-switcher {
  display: none;
}
</style>
