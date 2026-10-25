<script setup lang="ts">
import { VForm } from "vuetify/components/VForm"

import AuthShell from "@/features/auth/AuthShell.vue"
import { matches, passwordRules, required } from "@/features/auth/validation"
import { authApi } from "@/services/xpro-api"
import { getErrorMessage } from "@/utils/errors"
import { isDemoMode } from "@/utils/demo-mode"

definePage({ meta: { layout: "blank", public: true, unauthenticatedOnly: true } })

const route = useRoute()
const formRef = ref<VForm>()
const form = reactive({ password: "", confirmation: "" })
const loading = ref(false)
const reset = ref(false)
const errorMessage = ref("")

const submit = async () => {
  errorMessage.value = ""

  const validation = await formRef.value?.validate()
  if (!validation?.valid) return
  if (!route.query.token) {
    errorMessage.value = "This password reset link is invalid or has expired."

    return
  }

  loading.value = true
  try {
    await authApi.resetPassword({
      token: String(route.query.token ?? ""),
      password: form.password,
      email: String(route.query.email ?? ""),
    })
    reset.value = true
  } catch (error) {
    errorMessage.value = getErrorMessage(error)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell title="Choose a new password" subtitle="Use a strong password that you do not reuse on another service.">
    <VAlert v-if="errorMessage" color="error" variant="tonal" class="mb-5">
      {{ errorMessage }}
    </VAlert>
    <VAlert v-if="reset" color="success" variant="tonal" class="mb-6">
      {{
        isDemoMode
          ? "Your password has been updated for this preview. You can sign in with the new password until the preview is reloaded."
          : "Your password has been updated. You can sign in with your new password."
      }}
    </VAlert>
    <VForm v-if="!reset" ref="formRef" @submit.prevent="submit">
      <AppTextField
        v-model="form.password"
        label="New password"
        type="password"
        autocomplete="new-password"
        :rules="passwordRules"
        class="mb-5"
      />
      <AppTextField
        v-model="form.confirmation"
        label="Confirm new password"
        type="password"
        autocomplete="new-password"
        :rules="[required('Password confirmation'), matches(() => form.password, 'Password confirmation')]"
        class="mb-6"
      />
      <VBtn block size="large" type="submit" :loading="loading"> Reset password </VBtn>
    </VForm>
    <VBtn v-else block size="large" to="/login"> Return to sign in </VBtn>
  </AuthShell>
</template>
