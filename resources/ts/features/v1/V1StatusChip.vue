<script setup lang="ts">
import { statusColors, statusLabels } from "@/features/v1/helpers"
import type { V1Status } from "@/features/v1/types"

defineProps<{ status: V1Status; size?: "x-small" | "small" | "default" }>()
</script>

<template>
  <VChip :color="statusColors[status]" :size="size ?? 'small'" variant="tonal" label>
    {{ statusLabels[status] }}
  </VChip>
</template>
