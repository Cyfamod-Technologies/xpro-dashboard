<script setup lang="ts">
import { useOperationsStore } from "@/stores/operations"
import type { AssignmentSettings, ServiceLine } from "@/features/operations/types"
import { serviceLines } from "@/features/workspace/config"
import { factorHints, factorKeys, factorLabels } from "@/features/operations/dispatch"

const ops = useOperationsStore()
const clone = () => structuredClone(toRaw(ops.state.settings.assignment))
const form = reactive<AssignmentSettings>(clone())
const attempted = ref(false)
const services = serviceLines.map(item => item.name as ServiceLine)
const weight = (key: (typeof factorKeys)[number]) => Number(form.weights[key])
const total = computed(() => factorKeys.reduce((sum, key) => sum + (Number.isFinite(weight(key)) ? weight(key) : 0), 0))
const share = (key: (typeof factorKeys)[number]) =>
  total.value > 0 && Number.isFinite(weight(key)) ? Math.round((weight(key) / total.value) * 100) : 0
const isWhole = (value: unknown, min: number, max: number) =>
  Number.isInteger(Number(value)) && value !== "" && Number(value) >= min && Number(value) <= max

const problem = computed(() => {
  if (!isWhole(form.offerExpiryHours, 1, 168)) return "Offers must expire after 1 to 168 hours."
  if (!isWhole(form.maxAutoAttempts, 1, 10)) return "Automatic assignment must try 1 to 10 providers."
  if (factorKeys.some(key => form.weights[key] === ("" as unknown) || !Number.isFinite(weight(key)) || weight(key) < 0))
    return "Weights must be zero or more."
  if (total.value <= 0) return "At least one weight must be above zero."

  return ""
})

watch(
  () => ops.state.settings.assignment,
  () => Object.assign(form, clone()),
  { deep: true },
)

const save = () => {
  attempted.value = true

  const stored = ops.state.settings.quoteApprovalThreshold

  return ops.run({
    type: "settings.save",
    quoteApprovalThreshold: stored === null ? null : stored / 100,
    assignment: {
      modeByService: { ...form.modeByService },
      offerExpiryHours: Number(form.offerExpiryHours),
      maxAutoAttempts: Number(form.maxAutoAttempts),
      weights: {
        skill: weight("skill"),
        area: weight("area"),
        capacity: weight("capacity"),
        fairness: weight("fairness"),
        experience: weight("experience"),
      },
      requireVerifiedBank: form.requireVerifiedBank,
    },
  })
}
</script>

<template>
  <VCard class="mb-5">
    <VCardText>
      <h2 class="text-h5 mb-3">Assignment</h2>
      <p class="text-body-2 text-medium-emphasis">
        Customers never choose a provider. XPro assigns one for every request, automatically or by hand.
      </p>
      <h3 class="text-h6 mt-4 mb-2">Mode by service</h3>
      <p class="text-body-2 text-medium-emphasis">
        Auto: approving a request’s intake sends the offer to the best-ranked provider. Manual: staff choose from the
        ranked list. Staff can always assign by hand.
      </p>
      <div v-for="service in services" :key="service" class="mode-row">
        <span>{{ service }}</span>
        <VSwitch
          :model-value="form.modeByService[service] === 'auto'"
          :label="form.modeByService[service] === 'auto' ? 'Auto' : 'Manual'"
          density="compact"
          hide-details
          :aria-label="`${service} automatic assignment`"
          @update:model-value="form.modeByService[service] = $event ? 'auto' : 'manual'"
        />
      </div>
      <VRow class="mt-4">
        <VCol cols="12" sm="6">
          <VTextField
            v-model.number="form.offerExpiryHours"
            label="Offer expiry (hours)"
            type="number"
            min="1"
            max="168"
            hint="How long a provider has to answer an offer."
            persistent-hint
          /> </VCol
        ><VCol cols="12" sm="6">
          <VTextField
            v-model.number="form.maxAutoAttempts"
            label="Max automatic offers"
            type="number"
            min="1"
            max="10"
            hint="After this many offers the request goes to staff."
            persistent-hint
          />
        </VCol>
      </VRow>
      <h3 class="text-h6 mt-6 mb-2">Ranking weights</h3>
      <p class="text-body-2 text-medium-emphasis">
        Weights are relative: only their proportions matter, so they do not need to add up to 100. Ratings are not used
        until real ratings exist.
      </p>
      <VRow>
        <VCol v-for="key in factorKeys" :key="key" cols="12" sm="6" md="4">
          <VTextField
            v-model.number="form.weights[key]"
            :label="factorLabels[key]"
            type="number"
            min="0"
            :hint="`${factorHints[key]}. ${share(key)}% of the score.`"
            persistent-hint
          />
        </VCol>
      </VRow>
      <p class="text-body-2 mt-3">
        <strong>Total: {{ total }}</strong>
      </p>
      <VSwitch
        v-model="form.requireVerifiedBank"
        label="Require verified bank details for auto-assign"
        hide-details
        class="mb-4"
      />
      <p class="text-body-2 text-medium-emphasis">
        Manual assignment can still offer to a provider whose bank details are not verified, with a note.
      </p>
      <p v-if="problem" class="text-body-2 text-error" role="alert">
        {{ problem }}
      </p>
      <VAlert v-if="attempted && ops.error" variant="tonal" color="error" class="mb-4">
        {{ ops.error }}
      </VAlert>
      <VBtn :loading="ops.busy" :disabled="Boolean(problem)" @click="save"> Save assignment settings </VBtn>
    </VCardText>
  </VCard>
</template>

<style scoped>
.mode-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-block: 0.25rem;
  border-block-start: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
