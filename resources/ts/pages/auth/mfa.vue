<script setup lang="ts">
import { VForm } from "vuetify/components/VForm"

import AuthShell from "@/features/auth/AuthShell.vue"
import { sixDigitCode } from "@/features/auth/validation"
import { useAuthStore } from "@/stores/auth"
import { getErrorMessage } from "@/utils/errors"

definePage({ meta: { layout: "blank", public: true, unauthenticatedOnly: true } })

const auth = useAuthStore()
const router = useRouter()
const formRef = ref<VForm>()
const code = ref("")
const loading = ref(false)
const errorMessage = ref("")
const isPrototype = import.meta.env.VITE_ENABLE_MOCKS !== "false"

watch(code, value => {
  const digits = value.replace(/\D/g, "").slice(0, 6)
  if (digits !== value) code.value = digits
})

const submit = async () => {
  errorMessage.value = ""

  const validation = await formRef.value?.validate()
  if (!validation?.valid) return

  loading.value = true
  try {
    await auth.completeMfa(code.value)
    await router.push(auth.homePath)
  } catch (error) {
    errorMessage.value = getErrorMessage(error)
  } finally {
    loading.value = false
  }
}

const cancel = async () => {
  auth.cancelMfa()
  await router.push("/login")
}
</script>

<template>
  <AuthShell
    eyebrow="Protected staff access"
    title="Confirm it’s you"
    subtitle="Enter the six-digit code from your authenticator app."
  >
    <VAlert v-if="errorMessage" color="error" variant="tonal" class="mb-5">
      {{ errorMessage }}
    </VAlert>
    <VAlert v-if="isPrototype" color="info" variant="tonal" class="mb-6">
      Use <strong>123456</strong> for the frontend prototype.
    </VAlert>
    <VForm ref="formRef" @submit.prevent="submit">
      <AppTextField
        v-model="code"
        label="Authentication code"
        inputmode="numeric"
        autocomplete="one-time-code"
        maxlength="6"
        :rules="[sixDigitCode]"
        class="mb-6"
      />
      <VBtn block size="large" type="submit" :loading="loading"> Verify and continue </VBtn>
    </VForm>
    <div class="d-flex justify-center mt-5">
      <VBtn variant="text" size="small" @click="cancel"> Cancel </VBtn>
    </div>
  </AuthShell>
</template>
