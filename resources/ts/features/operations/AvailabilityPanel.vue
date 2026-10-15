<script setup lang="ts">
import { useOperationsStore } from "@/stores/operations"
import type { TimeOff, WorkingHours } from "@/features/operations/types"
import { defaultWorkingHours, timeOffProblem, workingHoursProblem } from "@/features/operations/hours"
import WorkingHoursEditor from "@/features/operations/WorkingHoursEditor.vue"

const ops = useOperationsStore()
const profile = ops.profile
const hours = ref<WorkingHours>(structuredClone(toRaw(profile?.workingHours ?? defaultWorkingHours())))
const timeOff = ref<TimeOff[]>(structuredClone(toRaw(profile?.timeOff ?? [])))
const draft = reactive({ from: "", to: "", note: "" })
const draftError = ref("")
const saved = ref(false)
const attempted = ref(false)
const hoursProblem = computed(() => workingHoursProblem(hours.value))
const approved = computed(() => ops.profile?.verification === "approved")

const dirty = computed(
  () =>
    JSON.stringify(hours.value) !== JSON.stringify(ops.profile?.workingHours) ||
    JSON.stringify(timeOff.value.map(({ from, to, note }) => ({ from, to, note }))) !==
      JSON.stringify((ops.profile?.timeOff ?? []).map(({ from, to, note }) => ({ from, to, note }))),
)

const dateText = (value: string) =>
  new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`))

const addTimeOff = () => {
  const entry = { id: crypto.randomUUID(), from: draft.from, to: draft.to || draft.from, note: draft.note.trim() }
  const problem = !draft.from ? "Choose the first day off." : timeOffProblem([entry])

  draftError.value = problem ?? ""
  if (problem) return
  timeOff.value = [...timeOff.value, entry].sort((a, b) => a.from.localeCompare(b.from))
  Object.assign(draft, { from: "", to: "", note: "" })
  saved.value = false
}

const removeTimeOff = (id: string) => {
  timeOff.value = timeOff.value.filter(item => item.id !== id)
  saved.value = false
}

const save = async () => {
  saved.value = false
  attempted.value = true
  if (await ops.run({ type: "provider.hours", workingHours: hours.value, timeOff: timeOff.value })) saved.value = true
}
</script>

<template>
  <VCard class="mb-5">
    <VCardText>
      <h2 class="text-h5 mb-2">Accepting new jobs</h2>
      <p class="text-medium-emphasis">
        XPro only offers work to approved providers who are accepting new jobs. Turning this off does not cancel your
        current jobs.
      </p>
      <VSwitch
        :model-value="ops.profile?.available ?? false"
        :disabled="!approved || ops.busy"
        label="Accepting new jobs"
        hide-details
        @update:model-value="ops.run({ type: 'provider.availability', available: Boolean($event) })"
      />
      <p v-if="!approved" class="text-body-2 text-medium-emphasis mt-2 mb-0">
        You can switch this on once XPro has approved your profile.
      </p>
    </VCardText>
  </VCard>
  <VCard>
    <VCardText>
      <h2 class="text-h5 mb-2">Working hours and time off</h2>
      <p class="text-medium-emphasis">
        XPro only offers you a job that starts on a day you work and outside your time off. Takes effect immediately,
        with no review by XPro.
      </p>
      <VAlert v-if="!ops.profile" variant="tonal" color="info" class="mb-4">
        Submit your provider profile first, then set your hours here.
      </VAlert>
      <h3 class="text-h6 mb-2">Weekly working hours</h3>
      <WorkingHoursEditor v-model="hours" />
      <h3 class="text-h6 mt-6 mb-2">Time off</h3>
      <p v-if="!timeOff.length" class="text-body-2 text-medium-emphasis">No time off booked.</p>
      <div v-for="item in timeOff" :key="item.id" class="d-flex align-center justify-space-between gap-3 time-off-row">
        <div>
          <strong>{{
            item.from === item.to ? dateText(item.from) : `${dateText(item.from)} to ${dateText(item.to)}`
          }}</strong>
          <div v-if="item.note" class="text-body-2 text-medium-emphasis">
            {{ item.note }}
          </div>
        </div>
        <VBtn
          icon="tabler-trash"
          size="small"
          variant="text"
          color="error"
          :aria-label="`Remove time off from ${item.from}`"
          @click="removeTimeOff(item.id)"
        />
      </div>
      <VRow class="mt-2">
        <VCol cols="12" sm="4">
          <VTextField v-model="draft.from" type="date" label="From" density="compact" hide-details /> </VCol
        ><VCol cols="12" sm="4">
          <VTextField v-model="draft.to" type="date" label="To (optional)" density="compact" hide-details /> </VCol
        ><VCol cols="12" sm="4">
          <VTextField v-model="draft.note" label="Note (optional)" density="compact" hide-details />
        </VCol>
      </VRow>
      <p v-if="draftError" class="text-body-2 text-error mt-2 mb-0" role="alert">
        {{ draftError }}
      </p>
      <VBtn variant="outlined" size="small" class="mt-3" prepend-icon="tabler-plus" @click="addTimeOff">
        Add time off
      </VBtn>
      <VAlert v-if="attempted && ops.error" variant="tonal" color="error" class="mt-5">
        {{ ops.error }}
      </VAlert>
      <div class="d-flex align-center flex-wrap gap-3 mt-5">
        <VBtn :loading="ops.busy" :disabled="!ops.profile || Boolean(hoursProblem) || !dirty" @click="save">
          Save hours and time off </VBtn
        ><span v-if="saved && !dirty" class="text-body-2 text-success">Saved. Your new hours apply now.</span>
      </div>
    </VCardText>
  </VCard>
</template>

<style scoped>
.time-off-row {
  padding-block: 0.5rem;
  border-block-start: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
