<script setup lang="ts">
import { VForm } from "vuetify/components/VForm"

import AuthShell from "@/features/auth/AuthShell.vue"
import { emailRules } from "@/features/auth/validation"
import { authApi } from "@/services/xpro-api"
import { getErrorMessage } from "@/utils/errors"
import { isDemoMode } from "@/utils/demo-mode"

definePage({ meta: { layout: "blank", public: true, unauthenticatedOnly: true } })

const email = ref("")
const formRef = ref<VForm>()
const sent = ref(false)
const loading = ref(false)
const errorMessage = ref("")

const submit = async () => {
  errorMessage.value = ""

  const validation = await formRef.value?.validate()
  if (!validation?.valid) return

  loading.value = true
  try {
    await authApi.forgotPassword(email.value)
    sent.value = true
  } catch (error) {
    errorMessage.value = getErrorMessage(error)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell
    title="Reset your password"
    subtitle="Enter your account email. If it is eligible, we will send a time-limited reset link."
  >
    <VAlert v-if="sent" color="success" variant="tonal" class="mb-6">
      If an eligible account exists, a reset link has been sent.
      <span v-if="isDemoMode"> In this prototype, continue to the reset screen.</span>
    </VAlert>
    <VAlert v-if="errorMessage" color="error" variant="tonal" class="mb-5">
      {{ errorMessage }}
    </VAlert>
    <VForm v-if="!sent" ref="formRef" @submit.prevent="submit">
      <AppTextField
        v-model="email"
        label="Email address"
        type="email"
        placeholder="you@example.com"
        autocomplete="email"
        :rules="emailRules"
        class="mb-5"
      />
      <VBtn block size="large" type="submit" :loading="loading"> Send reset link </VBtn>
    </VForm>
    <VBtn
      v-else-if="isDemoMode"
      block
      size="large"
      :to="{ path: '/auth/reset-password', query: { token: 'prototype-token', email } }"
    >
      Open prototype reset link
    </VBtn>
    <div class="text-center mt-6">
      <RouterLink to="/login" class="text-primary text-decoration-none"> Back to sign in </RouterLink>
    </div>
  </AuthShell>
</template>
