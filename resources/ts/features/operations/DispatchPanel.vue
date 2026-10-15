<script setup lang="ts">
import { useOperationsStore } from "@/stores/operations"
import type { ServiceRequest } from "@/features/operations/types"
import { when } from "@/features/operations/types"
import type { ExcludedProvider, RankedProvider } from "@/features/operations/workflow"
import { activeJobs, currentAssignment, rankProviders } from "@/features/operations/workflow"
import {
  exclusionLabels,
  exclusionWarning,
  factorHints,
  factorKeys,
  factorLabels,
  modeLabels,
  offerExpiry,
  quietRules,
  scoreText,
  unofferableRules,
} from "@/features/operations/dispatch"

const props = defineProps<{ request: ServiceRequest }>()
const ops = useOperationsStore()
const now = useNow({ interval: 30000 })
const acted = ref(false)
const offerNote = ref("")
const expanded = ref<string[]>([])
const showExcluded = ref(false)
const showAll = ref(false)
const withdrawing = ref(false)
const withdrawNote = ref("")
const overrideNote = ref("")
const overrideDialog = ref(false)
const target = ref<{ providerId: string; name: string; excluded?: ExcludedProvider } | null>(null)

const settings = computed(() => ops.state.settings.assignment)
const dispatch = computed(() => props.request.dispatch)
const canManage = computed(() => ops.can("dispatch.manage"))
const assignment = computed(() => currentAssignment(props.request))
const blocked = computed(() =>
  ["in_progress", "completion_pending", "blocked", "scheduled"].includes(props.request.status),
)
const canChoose = computed(() => !assignment.value && !blocked.value)
const ranking = computed(() => rankProviders(ops.state, props.request))
const top = computed(() => ranking.value.eligible[0])
const canAuto = computed(
  () => canManage.value && canChoose.value && dispatch.value.attempts < settings.value.maxAutoAttempts,
)
const weightTotal = computed(() => factorKeys.reduce((sum, key) => sum + settings.value.weights[key], 0))
const shownExcluded = computed(() =>
  ranking.value.excluded.filter(item => showAll.value || !quietRules.includes(item.rule)),
)
const providerName = (id: string) => ops.state.providers.find(item => item.id === id)?.name ?? "Provider"
const expiry = computed(() =>
  assignment.value?.status === "offered" ? offerExpiry(assignment.value.expiresAt, now.value.getTime()) : null,
)
const attemptsText = computed(() =>
  dispatch.value.mode === "auto"
    ? `Offer ${dispatch.value.attempts} of ${settings.value.maxAutoAttempts}`
    : `${dispatch.value.attempts} ${dispatch.value.attempts === 1 ? "offer" : "offers"} sent`,
)
const statusText = (status: string) => status.replaceAll("_", " ")
const sourceText = (source: "auto" | "manual") => modeLabels[source]
const isOpen = (id: string) => expanded.value.includes(id)

const toggle = (id: string) => {
  expanded.value = isOpen(id) ? expanded.value.filter(item => item !== id) : [...expanded.value, id]
}

const jobs = (providerId: string) => activeJobs(ops.state, providerId, props.request.id)

/** Points a factor adds to the 0 to 100 score, and the most it could add under the current weights. */
const points = (key: (typeof factorKeys)[number], factor: number) =>
  weightTotal.value > 0 ? (settings.value.weights[key] / weightTotal.value) * 100 * factor : 0
const maxPoints = (key: (typeof factorKeys)[number]) =>
  weightTotal.value > 0 ? (settings.value.weights[key] / weightTotal.value) * 100 : 0
const pointText = (value: number) => String(Number(value.toFixed(1)))

const run = async (command: Parameters<typeof ops.run>[0]) => {
  acted.value = true

  return ops.run(command)
}

const autoAssign = () => run({ type: "assignment.auto", requestId: props.request.id })
const simulateExpiry = () =>
  assignment.value && run({ type: "assignment.expire", requestId: props.request.id, assignmentId: assignment.value.id })

const withdraw = async () => {
  if (
    assignment.value &&
    (await run({
      type: "assignment.withdraw",
      requestId: props.request.id,
      assignmentId: assignment.value.id,
      note: withdrawNote.value,
    }))
  ) {
    withdrawing.value = false
    withdrawNote.value = ""
  }
}

const send = async (providerId: string, override = "") => {
  if (
    await run({
      type: "assignment.offer",
      requestId: props.request.id,
      providerId,
      note: offerNote.value,
      ...(override.trim() ? { overrideNote: override.trim() } : {}),
    })
  ) {
    overrideDialog.value = false
    overrideNote.value = ""
    offerNote.value = ""
    target.value = null
  }
}

const offerRanked = (item: RankedProvider, index: number) => {
  if (index === 0) return send(item.provider.id)
  overrideNote.value = ""
  target.value = { providerId: item.provider.id, name: item.provider.name }
  overrideDialog.value = true
}

const offerExcluded = (item: ExcludedProvider) => {
  overrideNote.value = ""
  target.value = { providerId: item.provider.id, name: item.provider.name, excluded: item }
  overrideDialog.value = true
}
</script>

<template>
  <VCard>
    <VCardText>
      <div class="d-flex align-center flex-wrap gap-2 mb-2">
        <h3 class="text-h5 me-2">Dispatch</h3>
        <VChip
          size="small"
          variant="tonal"
          :color="dispatch.mode === 'auto' ? 'primary' : 'secondary'"
          :prepend-icon="dispatch.mode === 'auto' ? 'tabler-bolt' : 'tabler-hand-click'"
        >
          {{ modeLabels[dispatch.mode] }}
        </VChip>
        <VChip size="small" variant="tonal">
          {{ attemptsText }}
        </VChip>
        <VChip v-if="dispatch.needsManual" size="small" color="warning" variant="flat"> Needs manual assignment </VChip>
      </div>
      <p class="text-body-2 text-medium-emphasis mb-4">
        {{
          dispatch.mode === "auto"
            ? `${request.service} requests are assigned automatically. XPro offers the best-ranked provider and moves to the next one if the offer is declined or expires.`
            : `${request.service} requests are assigned by staff. Pick a provider from the ranked list.`
        }}
      </p>
      <VAlert v-if="dispatch.needsManual && !assignment" variant="tonal" color="warning" class="mb-4">
        {{
          dispatch.attempts >= settings.maxAutoAttempts
            ? `Automatic assignment has used its ${settings.maxAutoAttempts} offers.`
            : "No eligible provider was found automatically."
        }}
        Choose a provider below.
      </VAlert>
      <VAlert v-if="acted && ops.error" variant="tonal" color="error" class="mb-4">
        {{ ops.error }}
      </VAlert>

      <div v-if="assignment" class="offer-card mb-4">
        <div class="d-flex justify-space-between align-start flex-wrap gap-2 mb-2">
          <div>
            <div class="text-body-2 text-medium-emphasis">Current offer</div>
            <div class="text-h6">
              {{ providerName(assignment.providerId) }}
            </div>
          </div>
          <VChip size="small" variant="tonal" :color="assignment.status === 'accepted' ? 'success' : 'primary'">
            {{ statusText(assignment.status) }}
          </VChip>
        </div>
        <div class="d-flex flex-wrap gap-2 mb-2">
          <VChip size="small" variant="outlined">
            {{ sourceText(assignment.source) }}
          </VChip>
          <VChip size="small" variant="outlined"> Attempt {{ assignment.attempt }} </VChip>
          <VChip v-if="assignment.score" size="small" variant="outlined">
            Score {{ scoreText(assignment.score.total) }}
          </VChip>
        </div>
        <p
          v-if="assignment.status === 'offered' && expiry"
          class="text-body-2 mb-2"
          :class="expiry.expired ? 'text-error' : ''"
        >
          <template v-if="expiry.expired">
            Offer expired {{ when(assignment.expiresAt) }} WAT. Simulate the expiry to move on.
          </template>
          <template v-else> Expires in {{ expiry.left }} · {{ when(assignment.expiresAt) }} WAT </template>
        </p>
        <p v-if="assignment.note" class="text-body-2 text-medium-emphasis mb-2">
          {{ assignment.note }}
        </p>
        <div v-if="canManage" class="d-flex flex-wrap gap-2">
          <VBtn
            v-if="assignment.status === 'offered'"
            size="small"
            variant="outlined"
            color="warning"
            :disabled="ops.busy"
            @click="simulateExpiry"
          >
            Simulate offer expiry
            <VChip size="x-small" class="ms-2" variant="flat" color="warning"> Demo </VChip>
          </VBtn>
          <VBtn
            v-if="!withdrawing"
            size="small"
            variant="text"
            color="warning"
            :disabled="ops.busy"
            @click="
              withdrawing = true
              withdrawNote = ''
            "
          >
            Withdraw assignment
          </VBtn>
        </div>
        <div v-if="withdrawing" class="mt-3">
          <VTextarea v-model="withdrawNote" label="Reason for withdrawing (shared with the provider)" rows="2" />
          <div class="d-flex gap-2">
            <VBtn size="small" color="warning" :disabled="ops.busy || !withdrawNote.trim()" @click="withdraw">
              Confirm withdrawal
            </VBtn>
            <VBtn size="small" variant="text" @click="withdrawing = false"> Cancel </VBtn>
          </div>
        </div>
      </div>

      <template v-if="canChoose">
        <div class="d-flex align-center justify-space-between flex-wrap gap-2 mb-3">
          <h4 class="text-h6">Ranked providers · {{ ranking.eligible.length }}</h4>
          <VBtn v-if="canAuto" size="small" prepend-icon="tabler-bolt" :disabled="ops.busy" @click="autoAssign">
            Auto-assign now
          </VBtn>
        </div>
        <VTextField
          v-if="canManage && ranking.eligible.length"
          v-model="offerNote"
          label="Note to the provider (optional)"
          density="compact"
          class="mb-3"
        />
        <p v-if="!ranking.eligible.length" class="text-body-2 text-medium-emphasis mb-4">
          No provider is eligible right now. See why below, or offer to an excluded provider with a note.
        </p>
        <div v-for="(item, index) in ranking.eligible" :key="item.provider.id" class="rank-row">
          <div class="d-flex align-start flex-wrap gap-3">
            <div class="rank-no">#{{ index + 1 }}</div>
            <div class="rank-main">
              <div class="d-flex align-center flex-wrap gap-2">
                <strong>{{ item.provider.name }}</strong>
                <VChip v-if="index === 0" size="x-small" color="success" variant="flat"> Top suggestion </VChip>
              </div>
              <div class="text-body-2 text-medium-emphasis">
                {{ item.provider.trade }}
              </div>
              <div class="text-body-2">
                {{ item.provider.serviceAreas.join(", ") }}
              </div>
              <div class="text-body-2 text-medium-emphasis">
                {{ jobs(item.provider.id) }} of {{ item.provider.capacity }} jobs active
              </div>
            </div>
            <div class="text-end rank-score">
              <div class="text-h4">
                {{ scoreText(item.score.total) }}
              </div>
              <div class="text-caption text-medium-emphasis">of 100</div>
            </div>
          </div>
          <div class="d-flex flex-wrap align-center gap-2 mt-2">
            <VBtn
              size="small"
              variant="text"
              :append-icon="isOpen(item.provider.id) ? 'tabler-chevron-up' : 'tabler-chevron-down'"
              :aria-expanded="isOpen(item.provider.id)"
              @click="toggle(item.provider.id)"
            >
              Score breakdown
            </VBtn>
            <VBtn
              v-if="canManage"
              size="small"
              :variant="index === 0 ? 'flat' : 'outlined'"
              :disabled="ops.busy"
              @click="offerRanked(item, index)"
            >
              Offer
            </VBtn>
          </div>
          <div v-if="isOpen(item.provider.id)" class="breakdown mt-3">
            <div v-for="key in factorKeys" :key="key" class="factor">
              <div class="d-flex justify-space-between text-body-2">
                <span :title="factorHints[key]">{{ factorLabels[key] }}</span>
                <span class="text-medium-emphasis"
                  >{{ pointText(points(key, item.score.factors[key] ?? 0)) }} of {{ pointText(maxPoints(key)) }}</span
                >
              </div>
              <VProgressLinear
                :model-value="(item.score.factors[key] ?? 0) * 100"
                color="primary"
                height="6"
                rounded
                :aria-label="`${factorLabels[key]} ${Math.round((item.score.factors[key] ?? 0) * 100)} percent`"
              />
            </div>
          </div>
        </div>

        <div v-if="ranking.excluded.length" class="mt-4">
          <VBtn
            variant="text"
            size="small"
            :prepend-icon="showExcluded ? 'tabler-chevron-up' : 'tabler-chevron-down'"
            :aria-expanded="showExcluded"
            @click="showExcluded = !showExcluded"
          >
            Excluded providers · {{ shownExcluded.length }}
          </VBtn>
          <template v-if="showExcluded">
            <VSwitch
              v-model="showAll"
              label="Show all, including unverified providers and other services"
              density="compact"
              hide-details
              class="mb-2"
            />
            <p v-if="!shownExcluded.length" class="text-body-2 text-medium-emphasis">
              Nobody else is excluded for a reason you can act on.
            </p>
            <div v-for="item in shownExcluded" :key="item.provider.id" class="excluded-row">
              <div class="rank-main">
                <strong>{{ item.provider.name }}</strong>
                <div class="text-body-2 text-medium-emphasis">{{ item.provider.trade }} · {{ item.reason }}</div>
              </div>
              <VChip size="small" variant="tonal" color="warning">
                {{ exclusionLabels[item.rule] }}
              </VChip>
              <VBtn
                v-if="canManage && !unofferableRules.includes(item.rule)"
                size="small"
                variant="outlined"
                :disabled="ops.busy"
                @click="offerExcluded(item)"
              >
                Offer anyway
              </VBtn>
            </div>
          </template>
        </div>
      </template>
      <p v-else-if="!assignment" class="text-body-2 text-medium-emphasis mb-0">
        Resolve the current job or schedule before choosing a different provider.
      </p>
    </VCardText>
  </VCard>

  <VDialog v-model="overrideDialog" max-width="520">
    <VCard v-if="target">
      <VCardText>
        <h3 class="text-h5 mb-3">Offer this job to {{ target.name }}?</h3>
        <VAlert v-if="target.excluded" variant="tonal" color="warning" class="mb-4">
          {{ target.name }} is excluded: {{ target.excluded.reason }}. {{ exclusionWarning[target.excluded.rule] }} You
          can still offer the job, but it is recorded as an override.
        </VAlert>
        <VAlert v-else variant="tonal" color="info" class="mb-4">
          {{ target.name }} is not the top suggestion{{ top ? ` (${top.provider.name} is)` : "" }}. Say why you are
          choosing them. The note is saved in the audit log.
        </VAlert>
        <VTextarea
          v-model="overrideNote"
          :label="
            target.excluded
              ? `Why are you offering this to ${target.name}? (required)`
              : 'Why not the top suggestion? (required)'
          "
          rows="3"
        />
        <VAlert v-if="ops.error && acted" variant="tonal" color="error" class="mb-4">
          {{ ops.error }}
        </VAlert>
        <div class="d-flex justify-end gap-2">
          <VBtn variant="text" @click="overrideDialog = false"> Cancel </VBtn>
          <VBtn :loading="ops.busy" :disabled="!overrideNote.trim()" @click="send(target.providerId, overrideNote)">
            Send offer
          </VBtn>
        </div>
      </VCardText>
    </VCard>
  </VDialog>
</template>

<style scoped>
.offer-card {
  border: 1px solid rgb(var(--v-theme-primary));
  border-radius: 8px;
  background: rgba(var(--v-theme-primary), 0.06);
  padding: 1rem;
}
.rank-row {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  padding: 1rem;
  margin-block-end: 0.75rem;
}
.rank-no {
  font-size: 1.25rem;
  font-weight: 600;
  min-inline-size: 2.5rem;
  color: rgb(var(--v-theme-primary));
}
.rank-main {
  flex: 1 1 12rem;
  min-inline-size: 0;
  overflow-wrap: anywhere;
}
.rank-score {
  min-inline-size: 4rem;
}
.breakdown {
  display: grid;
  gap: 0.75rem;
}
.factor {
  display: grid;
  gap: 0.25rem;
}
.excluded-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding-block: 0.5rem;
  border-block-start: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
