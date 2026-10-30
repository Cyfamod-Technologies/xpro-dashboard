<script setup lang="ts">
import PhoneVerificationDialog from "@/features/phone/PhoneVerificationDialog.vue"
import { normalizePhone } from "@/features/phone/phone"
import { usePhoneVerification } from "@/features/phone/use-phone-verification"

const props = withDefaults(defineProps<{ required?: boolean; showValidation?: boolean }>(), {
  required: false,
  showValidation: false,
})
const emit = defineEmits<{ "update:verified": [verified: boolean] }>()
const phone = defineModel<string>({ required: true })
const {
  loading,
  loadError,
  sending,
  confirming,
  error,
  codeError,
  challenge,
  verified,
  refresh,
  send,
  confirm,
  close,
} = usePhoneVerification(phone)
const phoneProblem = computed(() => {
  if (phone.value.trim() && !normalizePhone(phone.value)) return "Enter a valid Nigerian phone number."
  if (props.showValidation && props.required && !verified.value)
    return "Verify your phone number before submitting your profile."

  return ""
})

watch(verified, value => emit("update:verified", value), { immediate: true })
</script>

<template>
  <div>
    <VTextField
      v-model="phone"
      label="Private contact phone"
      type="tel"
      autocomplete="tel"
      placeholder="0803 123 4567"
      :disabled="loading || sending || confirming"
      :loading="loading"
      :error-messages="phoneProblem"
      hint="Use a Nigerian number that can receive SMS."
      persistent-hint
    />
    <div class="d-flex align-center flex-wrap gap-2 mt-2">
      <VChip
        size="small"
        variant="tonal"
        :color="verified ? 'success' : props.required ? 'warning' : 'secondary'"
        :prepend-icon="verified ? 'tabler-circle-check' : undefined"
        aria-live="polite"
        >{{
          loading
            ? "Checking verification"
            : verified
              ? "Phone verified"
              : props.required
                ? "Not verified"
                : "Verification optional"
        }}</VChip
      >
      <VBtn
        v-if="!verified"
        variant="outlined"
        size="small"
        :disabled="loading || !!loadError || !normalizePhone(phone)"
        :loading="sending"
        @click="send"
        >Verify number</VBtn
      >
      <VBtn v-else variant="text" size="small" @click="phone = ''">Change number</VBtn>
    </div>
    <VAlert v-if="loadError" color="error" variant="tonal" class="mt-3" role="alert">
      {{ loadError }}
      <VBtn variant="text" size="small" @click="refresh">Retry</VBtn>
    </VAlert>
    <VAlert v-else-if="error && !challenge" color="error" variant="tonal" class="mt-3" role="alert">{{ error }}</VAlert>
    <PhoneVerificationDialog
      v-if="challenge"
      :challenge="challenge"
      :sending="sending"
      :confirming="confirming"
      :error="error"
      :code-error="codeError"
      @confirm="confirm"
      @resend="send"
      @close="close"
    />
  </div>
</template>
