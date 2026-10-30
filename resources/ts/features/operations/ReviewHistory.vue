<script setup lang="ts">
import { when } from "@/features/operations/types"
import { buildReviewCycles } from "@/features/operations/review-cycles"
import type { HistoryEntry } from "@/features/operations/review-cycles"

const props = defineProps<{
  history: HistoryEntry[]
  pendingFields?: string[]
  pendingBank?: { label: string; submittedAt: string } | null
}>()

const filter = ref<"all" | "profile" | "bank">("all")
const cycles = computed(() =>
  buildReviewCycles(props.history, { pendingFields: props.pendingFields, pendingBank: props.pendingBank }),
)
const showFilter = computed(
  () => cycles.value.some(cycle => cycle.group === "bank") && cycles.value.some(cycle => cycle.group === "profile"),
)
const visible = computed(() => cycles.value.filter(cycle => filter.value === "all" || cycle.group === filter.value))
const filters = [
  { value: "all", title: "All" },
  { value: "profile", title: "Profile" },
  { value: "bank", title: "Bank" },
] as const
</script>

<template>
  <VCard v-if="cycles.length">
    <VCardText>
      <h2 class="text-h5 mb-1">Review history</h2>
      <p class="text-body-2 text-medium-emphasis mb-4">Each submission and XPro's decision on it, newest first.</p>
      <div v-if="showFilter" class="d-flex flex-wrap gap-2 mb-4" role="group" aria-label="Filter review history">
        <VChip
          v-for="item in filters"
          :key="item.value"
          size="small"
          :variant="filter === item.value ? 'flat' : 'outlined'"
          :color="filter === item.value ? 'primary' : undefined"
          :aria-pressed="filter === item.value"
          @click="filter = item.value"
          >{{ item.title }}</VChip
        >
      </div>

      <div
        v-for="cycle in visible"
        :key="cycle.id"
        class="review-cycle pa-4 mb-3"
        :class="{ 'review-cycle--open': cycle.open && cycle.color === 'primary' }"
      >
        <div class="d-flex align-center flex-wrap justify-space-between ga-2">
          <span class="d-flex align-center ga-2 text-body-1 font-weight-medium">
            <VIcon :icon="cycle.icon" size="20" class="text-medium-emphasis" />{{ cycle.title }}
          </span>
          <VChip size="small" variant="tonal" :color="cycle.color">{{ cycle.chip }}</VChip>
        </div>

        <div v-if="cycle.fields.length" class="d-flex flex-wrap ga-2 mt-3">
          <VChip v-for="field in cycle.fields" :key="field" size="x-small" variant="tonal" label>{{ field }}</VChip>
        </div>

        <div class="mt-3 d-flex flex-column ga-1 text-body-2 text-medium-emphasis">
          <div v-for="(step, index) in cycle.steps" :key="index" class="d-flex align-baseline ga-2">
            <VIcon icon="tabler-circle-check" size="14" />
            <span>{{ step.label }} {{ when(step.at) }}</span>
          </div>
          <div v-if="cycle.waiting" class="d-flex align-baseline ga-2">
            <VIcon icon="tabler-circle" size="14" />
            <span>{{ cycle.waiting }}</span>
          </div>
        </div>

        <template v-for="(step, index) in cycle.steps" :key="`note-${index}`">
          <p v-if="step.note" class="review-note text-body-2 mt-3 mb-0 pa-3">{{ step.note }}</p>
        </template>
      </div>
    </VCardText>
  </VCard>
</template>

<style scoped>
.review-cycle {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
}

.review-cycle--open {
  border: 2px solid rgb(var(--v-theme-primary));
}

.review-note {
  background: rgba(var(--v-theme-on-surface), 0.04);
  border-radius: 8px;
}
</style>
