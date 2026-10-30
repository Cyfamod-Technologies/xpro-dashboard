<script setup lang="ts">
import { authApi } from "@/services/xpro-api"
import { ApiError } from "@/utils/api"

export interface CommandContext {
  reason: string
  reauthToken?: string
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title: string
    confirmLabel: string
    confirmColor?: string
    /** Ask for a reason of 5 to 500 characters. */
    reason?: boolean
    reasonLabel?: string
    /** Ask for the password (and authenticator code) before running. */
    stepUp?: boolean
    /** The caller's own validity check; the button stays off until it is true. */
    valid?: boolean
    maxWidth?: number
    run: (context: CommandContext) => Promise<unknown>
  }>(),
  { confirmColor: "primary", reason: false, reasonLabel: "Reason", stepUp: false, valid: true, maxWidth: 520 },
)

const emit = defineEmits<{ "update:modelValue": [boolean]; done: []; stale: [] }>()

const reasonText = ref("")
const password = ref("")
const mfaCode = ref("")
const busy = ref(false)
const error = ref("")

watch(
  () => props.modelValue,
  open => {
    if (!open) return
    reasonText.value = ""
    password.value = ""
    mfaCode.value = ""
    error.value = ""
  },
)

const reasonOk = computed(
  () => !props.reason || (reasonText.value.trim().length >= 5 && reasonText.value.length <= 500),
)
const canSubmit = computed(() => props.valid && reasonOk.value && (!props.stepUp || password.value.length > 0))

const close = () => emit("update:modelValue", false)

const reload = () => {
  close()
  emit("stale")
}

const submit = async () => {
  if (!canSubmit.value || busy.value) return
  busy.value = true
  error.value = ""
  try {
    const reauthToken = props.stepUp
      ? (await authApi.reauthenticate(password.value, mfaCode.value.trim() || undefined)).data.reauthToken
      : undefined
    await props.run({ reason: reasonText.value.trim(), reauthToken })
    close()
    emit("done")
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "The action could not be completed."
    if (cause instanceof ApiError && cause.code === "VERSION_CONFLICT") emit("stale")
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <VDialog
    :model-value="modelValue"
    :max-width="maxWidth"
    scrollable
    persistent
    @update:model-value="!busy && emit('update:modelValue', $event)"
  >
    <VCard>
      <VCardTitle class="pt-5 px-6 text-h5">{{ title }}</VCardTitle>
      <VCardText class="px-6">
        <slot />
        <VTextarea
          v-if="reason"
          v-model="reasonText"
          :label="reasonLabel"
          rows="3"
          :maxlength="500"
          counter
          class="mt-2"
          hint="At least 5 characters. It is kept in the activity history."
          persistent-hint
        />
        <template v-if="stepUp">
          <p class="text-body-2 text-medium-emphasis mt-4 mb-2">Confirm it is you to continue.</p>
          <VTextField v-model="password" label="Your password" type="password" autocomplete="current-password" />
          <VTextField
            v-model="mfaCode"
            label="Authenticator code"
            inputmode="numeric"
            autocomplete="one-time-code"
            hint="Needed when sign-in verification is on for your account."
            persistent-hint
          />
        </template>
        <VAlert v-if="error" type="error" variant="tonal" class="mt-4" role="alert">
          {{ error }}
          <template v-if="error.includes('Reload')" #append>
            <VBtn size="small" variant="text" @click="reload">Reload</VBtn>
          </template>
        </VAlert>
      </VCardText>
      <VCardActions class="px-6 pb-5">
        <VSpacer />
        <VBtn variant="text" :disabled="busy" @click="close">Cancel</VBtn>
        <VBtn :color="confirmColor" :loading="busy" :disabled="!canSubmit" @click="submit">{{ confirmLabel }}</VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
