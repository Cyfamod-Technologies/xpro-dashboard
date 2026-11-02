<script setup lang="ts">
import { formatDateTime, formatDay, formatNaira } from "@/features/v1/helpers"
import type { V1Message } from "@/features/v1/types"

const props = defineProps<{
  message: V1Message
  /** The newest card in the thread is "Latest offer"; older ones are "Superseded". */
  superseded: boolean
  /** The Counter button shows only when the viewer did not write the latest card. */
  canCounter: boolean
  /** Shown instead of the author's name when the viewer wrote it. */
  authorLabel: string
  own: boolean
}>()
const emit = defineEmits<{ counter: [message: V1Message] }>()

const counter = computed(() => props.message.counter)
</script>

<template>
  <VCard
    v-if="counter"
    class="counter-card"
    :class="{ 'counter-card--superseded': superseded, 'counter-card--own': own }"
    variant="tonal"
    color="primary"
    border="primary md"
    :aria-label="`Counter offer of ${formatNaira(counter.amountKobo)} from ${authorLabel}`"
  >
    <VCardText class="pa-4">
      <div class="d-flex align-center justify-space-between gap-2 mb-2">
        <span class="text-overline">
          <VIcon icon="tabler-receipt-2" size="16" class="me-1" />
          Counter offer
        </span>
        <VChip :color="superseded ? 'secondary' : 'primary'" size="x-small" variant="flat" label>
          {{ superseded ? "Superseded" : counter.acceptedAt ? "Accepted" : "Latest offer" }}
        </VChip>
      </div>
      <div class="text-h4 font-weight-bold mb-1">{{ formatNaira(counter.amountKobo) }}</div>
      <div v-if="counter.date" class="text-body-2 mb-1">
        <VIcon icon="tabler-calendar" size="16" class="me-1" />
        Start {{ formatDay(counter.date) }}
      </div>
      <p v-if="counter.note" class="text-body-2 mb-2 counter-note">{{ counter.note }}</p>
      <div class="d-flex align-center justify-space-between flex-wrap gap-2">
        <span class="text-caption">{{ authorLabel }} · {{ formatDateTime(message.createdAt) }}</span>
        <VBtn
          v-if="canCounter && !counter.acceptedAt"
          size="small"
          color="primary"
          variant="flat"
          prepend-icon="tabler-arrows-exchange"
          @click="emit('counter', message)"
        >
          Counter
        </VBtn>
      </div>
    </VCardText>
  </VCard>
</template>

<style scoped>
.counter-card {
  max-inline-size: 360px;
}

.counter-card--superseded {
  opacity: 0.65;
}

.counter-note {
  white-space: pre-line;
}
</style>
