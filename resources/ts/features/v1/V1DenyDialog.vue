<script setup lang="ts">
import { denialMaxLength, denialNotice, isVersionConflict, validateDenial } from "@/features/v1/helpers"
import type { V1Request } from "@/features/v1/types"
import { v1Api } from "@/services/v1-api"
import { getErrorMessage } from "@/utils/errors"

const props = defineProps<{ modelValue: boolean; request: V1Request }>()
const emit = defineEmits<{
  "update:modelValue": [value: boolean]
  denied: [request: V1Request]
  refresh: []
}>()

const reason = ref("")
const submitted = ref(false)
const busy = ref(false)
const error = ref("")
const conflict = ref(false)

const check = computed(() => validateDenial(reason.value))

watch(
  () => props.modelValue,
  open => {
    if (!open) return
    reason.value = ""
    submitted.value = false
    error.value = ""
    conflict.value = false
  },
)

const close = () => emit("update:modelValue", false)

const deny = async () => {
  submitted.value = true
  if (!check.value.valid) return

  busy.value = true
  error.value = ""
  try {
    emit("denied", await v1Api.deny(props.request.id, { reason: reason.value.trim() }, props.request.version))
    close()
  } catch (cause) {
    if (isVersionConflict(cause)) conflict.value = true
    else error.value = getErrorMessage(cause, "The request could not be denied.")
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
  <VDialog
    :model-value="modelValue"
    max-width="520"
    persistent
    aria-labelledby="deny-request-title"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <VCard>
      <VCardTitle id="deny-request-title" class="pt-5 px-6">Deny request</VCardTitle>
      <VCardText class="px-6">
        <p class="text-body-2 text-medium-emphasis">
          {{ request.id }} · {{ request.title }}. The customer reads this reason, so keep it specific and helpful. A
          denied request can't be reopened; the customer starts a new one.
        </p>
        <VAlert v-if="conflict" type="warning" variant="tonal" density="compact" class="mb-4">
          This request changed since you opened it.
          <template #append>
            <VBtn size="small" variant="text" @click="refresh">Refresh request</VBtn>
          </template>
        </VAlert>
        <VAlert v-if="error" type="error" variant="tonal" density="compact" class="mb-4">{{ error }}</VAlert>
        <VTextarea
          v-model="reason"
          label="Reason for the customer"
          rows="3"
          auto-grow
          autofocus
          :counter="denialMaxLength"
          :error-messages="submitted ? check.errors.reason : undefined"
          hint="At least 10 characters."
          persistent-hint
          @blur="submitted = true"
        />
        <div class="text-caption text-medium-emphasis mt-4 mb-1">What the customer will see</div>
        <VAlert type="error" variant="tonal" density="compact" icon="tabler-circle-x" class="preview">
          <div class="font-weight-medium">Request denied</div>
          <div class="preview-text">{{ reason.trim() ? denialNotice(reason) : "Your reason appears here." }}</div>
        </VAlert>
      </VCardText>
      <VCardActions class="px-6 pb-5">
        <VSpacer />
        <VBtn variant="text" :disabled="busy" @click="close">Cancel</VBtn>
        <VBtn color="error" :loading="busy" :disabled="conflict" @click="deny">Deny request</VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.preview-text {
  white-space: pre-line;
}
</style>
