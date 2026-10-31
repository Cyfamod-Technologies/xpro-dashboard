<script setup lang="ts">
import { isVersionConflict } from "@/features/v1/helpers"
import type { V1Request } from "@/features/v1/types"
import { v1Api } from "@/services/v1-api"
import { getErrorMessage } from "@/utils/errors"

const props = defineProps<{ modelValue: boolean; request: V1Request }>()
const emit = defineEmits<{
  "update:modelValue": [value: boolean]
  cancelled: [request: V1Request]
  refresh: []
}>()

const busy = ref(false)
const error = ref("")
const conflict = ref(false)

watch(
  () => props.modelValue,
  open => {
    if (open) {
      error.value = ""
      conflict.value = false
    }
  },
)

const cancel = async () => {
  busy.value = true
  error.value = ""
  try {
    const request = await v1Api.cancel(props.request.id, props.request.version)

    emit("cancelled", request)
    emit("update:modelValue", false)
  } catch (cause) {
    if (isVersionConflict(cause)) conflict.value = true
    else error.value = getErrorMessage(cause, "The request could not be cancelled.")
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <VDialog
    :model-value="modelValue"
    max-width="460"
    aria-labelledby="cancel-request-title"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <VCard>
      <VCardTitle id="cancel-request-title">Cancel this request?</VCardTitle>
      <VCardText>
        <p class="mb-3">
          {{ request.id }} · {{ request.title }}. It will stay in your request history, but XPro will stop reviewing it.
        </p>
        <p class="text-body-2 text-medium-emphasis mb-0">This will free a spot under your open request limit.</p>
        <VAlert v-if="conflict" type="warning" variant="tonal" density="compact" class="mt-3">
          This request changed since you opened it.
          <template #append><VBtn size="small" variant="text" @click="emit('refresh')">Refresh</VBtn></template>
        </VAlert>
        <VAlert v-if="error" type="error" variant="tonal" density="compact" class="mt-3">{{ error }}</VAlert>
      </VCardText>
      <VCardActions class="px-6 pb-5">
        <VSpacer />
        <VBtn variant="text" :disabled="busy" @click="emit('update:modelValue', false)">Keep request</VBtn>
        <VBtn color="error" :loading="busy" :disabled="conflict" @click="cancel">Cancel request</VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
