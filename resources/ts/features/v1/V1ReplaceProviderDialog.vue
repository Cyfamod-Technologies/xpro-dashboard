<script setup lang="ts">
import {
  denialMinLength,
  eligibleCandidates,
  isVersionConflict,
  koboToNairaInput,
  nairaToKobo,
  todayIso,
} from "@/features/v1/helpers"
import type { ProviderCandidate, V1Request } from "@/features/v1/types"
import { v1Api } from "@/services/v1-api"
import { getErrorMessage } from "@/utils/errors"

const props = defineProps<{ modelValue: boolean; request: V1Request }>()
const emit = defineEmits<{
  "update:modelValue": [value: boolean]
  replaced: [request: V1Request]
  refresh: []
}>()

const candidates = ref<ProviderCandidate[]>([])
const providerId = ref<string | null>(null)
const reason = ref("")
const price = ref("")
const date = ref("")
const loading = ref(false)
const busy = ref(false)
const submitted = ref(false)
const error = ref("")
const conflict = ref(false)

const items = computed(() =>
  eligibleCandidates(candidates.value).filter(item => item.id !== props.request.provider?.providerId),
)
const reasonProblem = computed(() =>
  reason.value.trim().length < denialMinLength ? `Give a reason of at least ${denialMinLength} characters.` : "",
)
const hasProvider = computed(() => Boolean(props.request.provider?.providerId))
const priceKobo = computed(() => nairaToKobo(price.value))

watch(
  () => props.modelValue,
  async open => {
    if (!open) return
    providerId.value = null
    reason.value = ""
    price.value = koboToNairaInput(props.request.decision.terms?.priceKobo ?? props.request.budgetKobo)
    date.value = props.request.decision.terms?.date ?? props.request.preferredDate
    submitted.value = false
    error.value = ""
    conflict.value = false
    loading.value = true
    try {
      candidates.value = await v1Api.providerCandidates(props.request.id)
      providerId.value = items.value[0]?.id ?? null
    } catch (cause) {
      error.value = getErrorMessage(cause, "The provider list could not be loaded.")
    } finally {
      loading.value = false
    }
  },
)

const close = () => emit("update:modelValue", false)

const replace = async () => {
  submitted.value = true
  if (
    !providerId.value ||
    (hasProvider.value && reasonProblem.value) ||
    (!hasProvider.value && (!priceKobo.value || !date.value))
  )
    return

  busy.value = true
  error.value = ""
  try {
    emit(
      "replaced",
      await v1Api.replaceProvider(
        props.request.id,
        {
          providerId: providerId.value,
          ...(hasProvider.value
            ? { reason: reason.value.trim() }
            : { priceKobo: priceKobo.value ?? undefined, date: date.value }),
        },
        props.request.version,
      ),
    )
    close()
  } catch (cause) {
    if (isVersionConflict(cause)) conflict.value = true
    else error.value = getErrorMessage(cause, "The provider could not be replaced.")
  } finally {
    busy.value = false
  }
}

const refresh = () => {
  emit("refresh")
  close()
}
</script>

<template>
  <VDialog :model-value="modelValue" max-width="520" persistent @update:model-value="emit('update:modelValue', $event)">
    <VCard>
      <VCardTitle class="pt-5 px-6">{{ hasProvider ? "Replace provider" : "Assign provider" }}</VCardTitle>
      <VCardText class="px-6">
        <p class="text-body-2 text-medium-emphasis">
          <template v-if="hasProvider"
            >{{ request.provider?.providerName }} loses access to this job. The request stays approved and the change is
            recorded.</template
          >
          <template v-else
            >Choose a verified, available provider and confirm the agreed price and start date. The request is already
            approved.</template
          >
        </p>
        <VAlert v-if="conflict" type="warning" variant="tonal" density="compact" class="mb-4">
          This request changed since you opened it.
          <template #append>
            <VBtn size="small" variant="text" @click="refresh">Refresh request</VBtn>
          </template>
        </VAlert>
        <VAlert v-if="error" type="error" variant="tonal" density="compact" class="mb-4">{{ error }}</VAlert>
        <VSelect
          v-model="providerId"
          :items="items"
          item-title="name"
          item-value="id"
          label="New provider"
          :loading="loading"
          :error-messages="submitted && !providerId ? 'Choose a provider.' : undefined"
          :hint="items.length ? '' : 'No other verified, available provider is on file.'"
          persistent-hint
        />
        <template v-if="!hasProvider">
          <VTextField
            v-model="price"
            class="mt-3"
            label="Agreed price"
            prefix="₦"
            inputmode="decimal"
            :error-messages="submitted && !priceKobo ? 'Enter an amount greater than ₦0.' : undefined"
          />
          <VTextField
            v-model="date"
            class="mt-3"
            label="Start date"
            type="date"
            :min="todayIso()"
            :error-messages="submitted && !date ? 'Choose a start date.' : undefined"
          />
        </template>
        <VTextarea
          v-if="hasProvider"
          v-model="reason"
          class="mt-3"
          label="Reason"
          rows="2"
          auto-grow
          :error-messages="submitted ? reasonProblem : undefined"
        />
      </VCardText>
      <VCardActions class="px-6 pb-5">
        <VSpacer />
        <VBtn variant="text" :disabled="busy" @click="close">Cancel</VBtn>
        <VBtn color="primary" :loading="busy" :disabled="conflict" @click="replace">{{
          hasProvider ? "Replace provider" : "Assign provider"
        }}</VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
