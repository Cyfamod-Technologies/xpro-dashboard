<script setup lang="ts">
import type { DayHours, Weekday, WorkingHours } from "@/features/operations/types"
import { weekdayLabels, weekdays } from "@/features/operations/types"
import { workingHoursProblem } from "@/features/operations/hours"

const props = defineProps<{ modelValue: WorkingHours }>()
const emit = defineEmits<{ "update:modelValue": [value: WorkingHours] }>()
const fallback: DayHours = { start: "08:00", end: "17:00" }
const problem = computed(() => workingHoursProblem(props.modelValue))
const setDay = (day: Weekday, value: DayHours | null) =>
  emit("update:modelValue", { ...props.modelValue, [day]: value })
const toggle = (day: Weekday, working: boolean | null) => setDay(day, working ? { ...fallback } : null)
const setTime = (day: Weekday, field: keyof DayHours, value: string | null) =>
  setDay(day, { ...(props.modelValue[day] ?? fallback), [field]: value ?? "" })

const copyMonday = () => {
  const monday = props.modelValue.mon
  const next = { ...props.modelValue }

  for (const day of ["tue", "wed", "thu", "fri"] as const) next[day] = monday ? { ...monday } : null
  emit("update:modelValue", next)
}
</script>

<template>
  <div>
    <div class="d-flex align-center justify-space-between flex-wrap gap-2 mb-2">
      <p class="text-body-2 text-medium-emphasis mb-0">Times are in West Africa Time (WAT).</p>
      <VBtn size="small" variant="outlined" prepend-icon="tabler-copy" @click="copyMonday">
        Copy Monday to weekdays
      </VBtn>
    </div>
    <div v-for="day in weekdays" :key="day" class="hours-row">
      <div class="hours-day">
        {{ weekdayLabels[day] }}
      </div>
      <VSwitch
        :model-value="Boolean(modelValue[day])"
        label="Working"
        density="compact"
        hide-details
        class="hours-switch"
        :aria-label="`${weekdayLabels[day]} working`"
        @update:model-value="toggle(day, $event)"
      />
      <template v-if="modelValue[day]">
        <VTextField
          :model-value="modelValue[day]!.start"
          type="time"
          label="Start"
          density="compact"
          hide-details
          class="hours-time"
          :aria-label="`${weekdayLabels[day]} start time`"
          @update:model-value="setTime(day, 'start', $event)"
        />
        <VTextField
          :model-value="modelValue[day]!.end"
          type="time"
          label="End"
          density="compact"
          hide-details
          class="hours-time"
          :aria-label="`${weekdayLabels[day]} end time`"
          @update:model-value="setTime(day, 'end', $event)"
        />
      </template>
      <span v-else class="text-medium-emphasis hours-off">Day off</span>
    </div>
    <p v-if="problem" class="text-body-2 text-error mt-3 mb-0" role="alert">
      {{ problem }}
    </p>
  </div>
</template>

<style scoped>
.hours-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding-block: 0.5rem;
  border-block-start: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.hours-day {
  min-inline-size: 6.5rem;
  font-weight: 500;
}
.hours-switch {
  flex: 0 0 8rem;
}
.hours-time {
  flex: 0 1 9rem;
  min-inline-size: 7.5rem;
}
.hours-off {
  flex: 1 1 auto;
}
</style>
