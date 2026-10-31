<script setup lang="ts">
import type { RequestSummary } from "@/features/requests/api-types"
import {
  CANCEL_NOTE_MAX,
  cancelNoteError,
  cancelOutcome,
  cancellableSiblings,
  runSequentially,
  stageText,
} from "@/features/requests/request-groups"
import { requestsApi } from "@/services/requests-api"

/**
 * "Cancel all in this project" (Spec 04 §6.21, MS-5): one required note, then `POST /requests/:id/cancel` once per open
 * request in form order, each with its own idempotency key. Every request follows the cancellation rules on its own, so
 * the result is one outcome per request.
 */
const props = defineProps<{ modelValue: boolean; groupId: string; title: string }>()
const emit = defineEmits<{ "update:modelValue": [boolean]; finished: [] }>()

interface Outcome {
  id: string
  title: string
  state: "cancelled" | "requested" | "failed"
  message?: string
}

const siblings = ref<RequestSummary[]>([])
const note = ref("")
const touched = ref(false)
const loading = ref(false)
const busy = ref(false)
const loadError = ref("")
const outcomes = ref<Outcome[]>([])

const noteMessage = computed(() => cancelNoteError(note.value))
const finished = computed(() => outcomes.value.length > 0)
const outcomeLabel = (outcome: Outcome) =>
  outcome.state === "cancelled"
    ? "Cancelled"
    : outcome.state === "requested"
      ? "Cancellation requested"
      : `Failed: ${outcome.message}`

// Read the whole group fresh: the list page may be filtered, and the versions must be current.
async function load() {
  loading.value = true
  loadError.value = ""
  try {
    const result = await requestsApi.list({ group: props.groupId, itemsPerPage: 50 })

    siblings.value = cancellableSiblings(result.items)
  } catch (cause) {
    siblings.value = []
    loadError.value = cause instanceof Error ? cause.message : "The requests could not be loaded."
  } finally {
    loading.value = false
  }
}

watch(
  () => props.modelValue,
  open => {
    if (!open) return
    note.value = ""
    touched.value = false
    outcomes.value = []
    siblings.value = []
    load()
  },
  { immediate: true },
)

async function submit() {
  touched.value = true
  if (noteMessage.value || busy.value || !siblings.value.length) return
  busy.value = true
  try {
    const results = await runSequentially(
      siblings.value,
      item => requestsApi.cancel(item.id, note.value.trim(), item.version),
      "This request could not be cancelled.",
    )

    outcomes.value = results.map(result => ({
      id: result.item.id,
      title: result.item.title || "Service request",
      state: result.ok ? cancelOutcome(result.value!) : "failed",
      message: result.message,
    }))
    emit("finished")
  } finally {
    busy.value = false
  }
}

const close = () => emit("update:modelValue", false)
</script>

<template>
  <VDialog
    :model-value="modelValue"
    max-width="560"
    scrollable
    persistent
    @update:model-value="!busy && emit('update:modelValue', $event)"
  >
    <VCard>
      <VCardTitle class="pt-5 px-6 text-h5 text-wrap">Cancel all in {{ title }}</VCardTitle>
      <VCardText class="px-6">
        <VProgressLinear v-if="loading" indeterminate class="mb-4" />
        <VAlert v-if="loadError" type="error" variant="tonal" class="mb-4" role="alert">{{ loadError }}</VAlert>

        <template v-if="finished">
          <p class="text-body-2 mb-2">Here is what happened to each request.</p>
          <VList lines="two" aria-label="Cancellation results" role="status">
            <VListItem
              v-for="outcome in outcomes"
              :key="outcome.id"
              :title="outcome.title"
              :subtitle="`${outcome.id} · ${outcomeLabel(outcome)}`"
              :class="outcome.state === 'failed' ? 'text-error' : undefined"
            />
          </VList>
        </template>

        <template v-else-if="!loading && !loadError">
          <template v-if="siblings.length">
            <p class="text-body-2 mb-2">
              These requests will be cancelled one by one. A request that already has an offer or payment sends a
              cancellation request to XPro instead.
            </p>
            <ul class="text-body-2 mb-4 ps-5">
              <li v-for="item in siblings" :key="item.id">
                {{ item.title || "Service request" }} ({{ item.id }}, {{ item.statusLabel ?? stageText(item.stage) }})
              </li>
            </ul>
            <VTextarea
              v-model="note"
              label="Reason *"
              rows="3"
              :maxlength="CANCEL_NOTE_MAX"
              :counter="CANCEL_NOTE_MAX"
              :error-messages="touched ? noteMessage : ''"
            />
          </template>
          <p v-else class="text-body-2 mb-0">None of the requests in this project can be cancelled right now.</p>
        </template>
      </VCardText>
      <VCardActions class="px-6 pb-5">
        <VSpacer />
        <template v-if="finished">
          <VBtn color="primary" @click="close">Done</VBtn>
        </template>
        <template v-else>
          <VBtn variant="text" :disabled="busy" @click="close">Keep requests</VBtn>
          <VBtn color="error" :loading="busy" :disabled="loading || !siblings.length" @click="submit"
            >Cancel all requests</VBtn
          >
        </template>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
