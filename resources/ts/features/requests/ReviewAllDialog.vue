<script setup lang="ts">
import type { RequestSummary } from "@/features/requests/api-types"
import {
  BRIEF_MAX,
  briefError,
  contactCheckMessage,
  planReviewAll,
  runSequentially,
} from "@/features/requests/request-groups"
import { requestsApi } from "@/services/requests-api"

/**
 * Staff "Review all" (Spec 04 §6.4, MS-4): the offer brief is per provider skill, so every request in intake review gets
 * its own brief, then `POST /requests/:id/review` runs once per request in form order. Whether the brief may hold contact
 * details (`contactInBrief`) is only on the request detail, so each request is read before the form is shown.
 * Whether to share the description with the provider stays at the server default (no `shareOnConfirm`).
 */
const props = defineProps<{ modelValue: boolean; groupId: string; title: string }>()
const emit = defineEmits<{ "update:modelValue": [boolean]; finished: [] }>()

interface Row {
  id: string
  title: string
  version: number
  contactInBrief: boolean
  brief: string
  contactCheck: boolean
}

interface Outcome {
  id: string
  title: string
  ok: boolean
  message?: string
}

const rows = ref<Row[]>([])
const skipped = ref<Array<{ id: string; title: string; message: string }>>([])
const touched = ref(false)
const loading = ref(false)
const busy = ref(false)
const loadError = ref("")
const outcomes = ref<Outcome[]>([])

const finished = computed(() => outcomes.value.length > 0)
const rowBriefError = (row: Row) => briefError(row.brief)
const rowContactError = (row: Row) => (row.contactInBrief && !row.contactCheck ? contactCheckMessage : "")
const valid = computed(() => rows.value.every(row => !rowBriefError(row) && !rowContactError(row)))

async function load() {
  loading.value = true
  loadError.value = ""
  try {
    const result = await requestsApi.list({ group: props.groupId, itemsPerPage: 50 })
    const planned = planReviewAll(result.items)
    const details = await Promise.allSettled(planned.map((item: RequestSummary) => requestsApi.get(item.id)))
    const ready: Row[] = []

    details.forEach((detail, index) => {
      const item = planned[index]
      const title = item.title || "Service request"

      if (detail.status === "rejected") {
        skipped.value.push({
          id: item.id,
          title,
          message: detail.reason instanceof Error ? detail.reason.message : "This request could not be loaded.",
        })

        return
      }
      if (!planReviewAll([detail.value]).length) {
        skipped.value.push({ id: item.id, title, message: "This request is no longer waiting for intake review." })

        return
      }
      ready.push({
        id: detail.value.id,
        title,
        version: detail.value.version,
        contactInBrief: detail.value.contactInBrief ?? false,
        brief: "",
        contactCheck: false,
      })
    })
    rows.value = ready
  } catch (cause) {
    rows.value = []
    loadError.value = cause instanceof Error ? cause.message : "The requests could not be loaded."
  } finally {
    loading.value = false
  }
}

watch(
  () => props.modelValue,
  open => {
    if (!open) return
    rows.value = []
    skipped.value = []
    outcomes.value = []
    touched.value = false
    load()
  },
  { immediate: true },
)

async function submit() {
  touched.value = true
  if (!valid.value || busy.value || !rows.value.length) return
  busy.value = true
  try {
    const results = await runSequentially(
      rows.value,
      row =>
        requestsApi.reviewIntake(
          row.id,
          { offerBrief: row.brief.trim(), ...(row.contactInBrief ? { contactCheck: true } : {}) },
          row.version,
        ),
      "This request could not be approved.",
    )

    outcomes.value = results.map(result => ({
      id: result.item.id,
      title: result.item.title,
      ok: result.ok,
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
    max-width="680"
    scrollable
    persistent
    @update:model-value="!busy && emit('update:modelValue', $event)"
  >
    <VCard>
      <VCardTitle class="pt-5 px-6 text-h5 text-wrap">Review all in {{ title }}</VCardTitle>
      <VCardText class="px-6">
        <VProgressLinear v-if="loading" indeterminate class="mb-4" />
        <VAlert v-if="loadError" type="error" variant="tonal" class="mb-4" role="alert">{{ loadError }}</VAlert>

        <template v-if="finished">
          <p class="text-body-2 mb-2">Here is what happened to each request.</p>
          <VList lines="two" aria-label="Review results" role="status">
            <VListItem
              v-for="outcome in outcomes"
              :key="outcome.id"
              :title="outcome.title"
              :subtitle="`${outcome.id} · ${outcome.ok ? 'Approved for dispatch' : `Failed: ${outcome.message}`}`"
              :class="outcome.ok ? undefined : 'text-error'"
            />
          </VList>
        </template>

        <template v-else-if="!loading && !loadError">
          <VAlert v-for="item in skipped" :key="item.id" type="warning" variant="tonal" class="mb-4">
            {{ item.title }} ({{ item.id }}): {{ item.message }}
          </VAlert>
          <template v-if="rows.length">
            <p class="text-body-2 mb-4">
              Write the brief providers will see for each request. Each request is approved on its own.
            </p>
            <fieldset v-for="row in rows" :key="row.id" class="review-row mb-4">
              <legend class="text-subtitle-1">{{ row.title }} ({{ row.id }})</legend>
              <VTextarea
                v-model="row.brief"
                label="Offer brief *"
                rows="3"
                :maxlength="BRIEF_MAX"
                :counter="BRIEF_MAX"
                :error-messages="touched ? rowBriefError(row) : ''"
              />
              <VCheckbox
                v-if="row.contactInBrief"
                v-model="row.contactCheck"
                label="I confirmed the brief contains no phone numbers, email addresses or site access details"
                :error-messages="touched ? rowContactError(row) : ''"
              />
            </fieldset>
          </template>
          <p v-else-if="!skipped.length" class="text-body-2 mb-0">
            None of the requests in this project are waiting for intake review.
          </p>
        </template>
      </VCardText>
      <VCardActions class="px-6 pb-5">
        <VSpacer />
        <template v-if="finished">
          <VBtn color="primary" @click="close">Done</VBtn>
        </template>
        <template v-else>
          <VBtn variant="text" :disabled="busy" @click="close">Close</VBtn>
          <VBtn color="primary" :loading="busy" :disabled="loading || !rows.length" @click="submit">Approve all</VBtn>
        </template>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.review-row {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
  margin-inline: 0;
  min-inline-size: 0;
  padding: 12px 16px 0;
}
</style>
