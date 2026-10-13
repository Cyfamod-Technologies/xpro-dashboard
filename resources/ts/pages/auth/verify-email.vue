<script setup lang="ts">
import AuthShell from '@/features/auth/AuthShell.vue'
import { authApi } from '@/services/xpro-api'
import { getErrorMessage } from '@/utils/errors'

definePage({ meta: { layout: 'blank', public: true } })

const route = useRoute()
const verified = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const email = computed(() => typeof route.query.email === 'string' ? route.query.email : 'your email address')

const verify = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    await authApi.verifyEmail('prototype-verification-token')
    verified.value = true
  }
  catch (error) {
    errorMessage.value = getErrorMessage(error)
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell
    eyebrow="Email verification"
    :title="verified ? 'Email verified' : 'Check your inbox'"
    :subtitle="verified ? 'Your Budget Viewer account is ready.' : `We sent a verification link to ${email}.`"
  >
    <VAlert
      v-if="errorMessage"
      color="error"
      variant="tonal"
      class="mb-5"
    >
      {{ errorMessage }}
    </VAlert>
    <VAlert
      v-if="!verified"
      color="info"
      variant="tonal"
      class="mb-6"
    >
      For this frontend prototype, use the button below to simulate opening the email link.
    </VAlert>
    <VBtn
      v-if="!verified"
      block
      size="large"
      :loading="loading"
      @click="verify"
    >
      Verify prototype email
    </VBtn>
    <VBtn
      v-else
      block
      size="large"
      to="/login"
    >
      Continue to sign in
    </VBtn>
    <div
      v-if="!verified"
      class="text-center mt-5"
    >
      <VBtn
        variant="text"
        size="small"
      >
        Resend verification email
      </VBtn>
    </div>
  </AuthShell>
</template>
