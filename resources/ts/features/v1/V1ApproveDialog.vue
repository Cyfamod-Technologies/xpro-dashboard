<script setup lang="ts">
import { isVersionConflict } from "@/features/v1/helpers"
import type { V1Request } from "@/features/v1/types"
import { v1Api } from "@/services/v1-api"
import { getErrorMessage } from "@/utils/errors"

const props = defineProps<{ modelValue: boolean; request: V1Request }>()
const emit = defineEmits<{
  "update:modelValue": [value: boolean]
  approved: [request: V1Request]
  refresh: []
}>()

const busy = ref(false)
const error = ref("")
const conflict = ref(false)
const close = () => emit("update:modelValue", false)

watch(
  () => props.modelValue,
  open => {
    if (!open) return
    error.value = ""
    conflict.value = false
  },
)

const approve = async () => {
  busy.value = true
  error.value = ""
  try {
    emit("approved", await v1Api.approve(props.request.id, props.request.version))
    close()
  } catch (cause) {
    if (isVersionConflict(cause)) conflict.value = true
    else error.value = getErrorMessage(cause, "The request could not be approved.")
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
  <VDialog :model-value="modelValue" max-width="480" persistent @update:model-value="emit('update:modelValue', $event)">
    <VCard>
      <VCardTitle class="pt-5 px-6">Approve request</VCardTitle>
      <VCardText class="px-6">
        <p class="text-body-2 text-medium-emphasis">
          Approve {{ request.id }} · {{ request.title }}? Approval closes Xpro’s intake decision. Provider assignment
          happens afterward.
        </p>
        <VAlert v-if="conflict" type="warning" variant="tonal" density="compact" class="mb-4">
          This request changed since you opened it.
          <template #append><VBtn size="small" variant="text" @click="refresh">Refresh request</VBtn></template>
        </VAlert>
        <VAlert v-if="error" type="error" variant="tonal" density="compact">{{ error }}</VAlert>
      </VCardText>
      <VCardActions class="px-6 pb-5">
        <VSpacer />
        <VBtn variant="text" :disabled="busy" @click="close">Cancel</VBtn>
        <VBtn color="primary" :loading="busy" :disabled="conflict" @click="approve">Approve request</VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
