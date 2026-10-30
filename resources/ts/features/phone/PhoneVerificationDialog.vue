<script setup lang="ts">
import { useNow } from "@vueuse/core"
import type { PhoneVerificationChallenge } from "@/services/xpro-api"

const props = defineProps<{
  challenge: PhoneVerificationChallenge
  sending: boolean
  confirming: boolean
  error: string
  codeError: string
}>()
const emit = defineEmits<{
  confirm: [code: string]
  resend: []
  close: []
}>()
const code = ref("")
const sixDigitCode = (value: unknown) => /^\d{6}$/.test(String(value)) || "Enter the six-digit code."
const now = useNow({ interval: 1000 })
const busy = computed(() => props.sending || props.confirming)
const resendSeconds = computed(() =>
  Math.max(0, Math.ceil((Date.parse(props.challenge.resendAfter) - now.value.getTime()) / 1000)),
)
const expired = computed(() => Date.parse(props.challenge.expiresAt) <= now.value.getTime())

watch(
  () => props.challenge.verificationId,
  () => {
    code.value = ""
  },
)
const submit = () => {
  if (/^\d{6}$/.test(code.value) && !busy.value && !expired.value) emit("confirm", code.value)
}
</script>

<template>
  <VDialog
    model-value
    max-width="480"
    :persistent="busy"
    aria-labelledby="phone-verification-title"
    @update:model-value="!$event && emit('close')"
  >
    <VCard>
      <VCardText>
        <div class="d-flex align-center justify-space-between gap-3 mb-3">
          <h2 id="phone-verification-title" class="text-h5">Verify your phone number</h2>
          <VBtn
            icon="tabler-x"
            variant="text"
            size="small"
            aria-label="Close phone verification"
            :disabled="busy"
            @click="emit('close')"
          />
        </div>
        <p class="text-body-2 text-medium-emphasis">Enter the six-digit SMS code sent to {{ challenge.phone }}.</p>
        <VAlert v-if="error" color="error" variant="tonal" class="mb-4" role="alert">{{ error }}</VAlert>
        <VAlert v-if="expired" color="warning" variant="tonal" class="mb-4"
          >Your code has expired. Request a new code below.</VAlert
        >
        <VForm @submit.prevent="submit">
          <AppTextField
            v-model="code"
            label="Verification code"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            autofocus
            :disabled="busy || expired"
            :error-messages="codeError"
            :rules="[sixDigitCode]"
            class="mb-4"
          />
          <VBtn block type="submit" :loading="confirming" :disabled="sending || expired || !/^\d{6}$/.test(code)"
            >Verify number</VBtn
          >
        </VForm>
        <div class="d-flex justify-space-between flex-wrap gap-2 mt-4">
          <VBtn
            variant="text"
            size="small"
            :disabled="busy || resendSeconds > 0"
            :loading="sending"
            @click="emit('resend')"
            >{{ resendSeconds ? `Resend in ${resendSeconds}s` : "Resend code" }}</VBtn
          >
          <VBtn variant="text" size="small" color="secondary" :disabled="busy" @click="emit('close')"
            >Change number</VBtn
          >
        </div>
      </VCardText>
    </VCard>
  </VDialog>
</template>
