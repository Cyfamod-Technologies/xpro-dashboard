<script setup lang="ts">
import AuthShell from "@/features/auth/AuthShell.vue"
import { authApi } from "@/services/xpro-api"
import { getErrorMessage } from "@/utils/errors"
import { isDemoMode } from "@/utils/demo-mode"

definePage({ meta: { layout: "blank", public: true } })

const route = useRoute()
const verified = ref(false)
const loading = ref(false)
const errorMessage = ref("")
const resent = ref(false)
const email = computed(() => (typeof route.query.email === "string" ? route.query.email : "your email address"))
const token = computed(() => (typeof route.query.token === "string" ? route.query.token : ""))

const verify = async () => {
  loading.value = true
  errorMessage.value = ""
  try {
    if (isDemoMode) await authApi.verifyEmail(token.value || "prototype-verification-token")
    else if (!token.value) throw new Error("Open the verification link from your email to verify this account.")
    else await authApi.verifyEmail(token.value)
    verified.value = true
  } catch (error) {
    errorMessage.value = getErrorMessage(error)
  } finally {
    loading.value = false
  }
}

const resend = async () => {
  errorMessage.value = ""
  try {
    await authApi.resendVerification(email.value)
    resent.value = true
  } catch (error) {
    errorMessage.value = getErrorMessage(error)
  }
}

if (token.value) verify()
</script>

<template>
  <AuthShell
    eyebrow="Email verification"
    :title="verified ? 'Email verified' : 'Check your inbox'"
    :subtitle="
      verified
        ? 'Your XPro account is ready. Sign in to open your workspace.'
        : `We sent a verification link to ${email}.`
    "
  >
    <VAlert v-if="errorMessage" color="error" variant="tonal" class="mb-5">
      {{ errorMessage }}
    </VAlert>
    <VAlert v-if="!verified && isDemoMode" color="info" variant="tonal" class="mb-6">
      For this frontend prototype, use the button below to simulate opening the email link.
    </VAlert>
    <VBtn v-if="!verified && isDemoMode" block size="large" :loading="loading" @click="verify">
      Verify prototype email
    </VBtn>
    <VBtn v-if="verified" block size="large" to="/login"> Continue to sign in </VBtn>
    <div v-if="!verified" class="text-center mt-5">
      <VBtn variant="text" size="small" @click="resend">
        {{ resent ? "Verification email sent" : "Resend verification email" }}
      </VBtn>
    </div>
  </AuthShell>
</template>
