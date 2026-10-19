<script setup lang="ts">
import { VForm } from "vuetify/components/VForm"

import AuthShell from "@/features/auth/AuthShell.vue"
import { matches, passwordRules, required } from "@/features/auth/validation"
import { authApi } from "@/services/xpro-api"
import { getErrorMessage } from "@/utils/errors"

definePage({ meta: { layout: "blank", public: true, unauthenticatedOnly: true } })

const completed = ref(false)
const loading = ref(false)
const errorMessage = ref("")
const enrollment = ref<{ token: string; secret: string; otpauthUrl: string } | null>(null)
const mfaCode = ref("")
const route = useRoute()
const isPrototype = import.meta.env.VITE_ENABLE_MOCKS !== "false"
const formRef = ref<VForm>()
const form = reactive({
  firstName: "",
  lastName: "",
  password: "",
  confirmation: "",
  accepted: false,
})

const submit = async () => {
  const validation = await formRef.value?.validate()
  if (!validation?.valid) return
  errorMessage.value = ""
  if (isPrototype) {
    completed.value = true

    return
  }

  const token = typeof route.query.token === "string" ? route.query.token : ""
  if (!token) {
    errorMessage.value = "This invitation link is invalid or has expired."

    return
  }

  loading.value = true
  try {
    const response = await authApi.acceptInvite({
      token,
      firstName: form.firstName,
      lastName: form.lastName,
      password: form.password,
    })
    enrollment.value = response.data
  } catch (error) {
    errorMessage.value = getErrorMessage(error)
  } finally {
    loading.value = false
  }
}

const completeEnrollment = async () => {
  if (!enrollment.value) return
  loading.value = true
  errorMessage.value = ""
  try {
    await authApi.enrollMfa(mfaCode.value, enrollment.value.token)
    completed.value = true
  } catch (error) {
    errorMessage.value = getErrorMessage(error)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell
    eyebrow="Staff invitation"
    title="Join the Xpro operations workspace"
    subtitle="Confirm your profile, create a password and continue to your workspace."
  >
    <VAlert v-if="errorMessage" color="error" variant="tonal" class="mb-6">
      {{ errorMessage }}
    </VAlert>
    <VAlert v-if="completed" color="success" variant="tonal" class="mb-6">
      Invitation accepted. Your staff account is ready to sign in.
    </VAlert>
    <VForm v-if="!completed && !enrollment" ref="formRef" @submit.prevent="submit">
      <VRow>
        <VCol cols="12" sm="6">
          <AppTextField
            v-model="form.firstName"
            label="First name"
            autocomplete="given-name"
            :rules="[required('First name')]"
          />
        </VCol>
        <VCol cols="12" sm="6">
          <AppTextField
            v-model="form.lastName"
            label="Last name"
            autocomplete="family-name"
            :rules="[required('Last name')]"
          />
        </VCol>
      </VRow>
      <VRow>
        <VCol cols="12" sm="6">
          <AppTextField
            v-model="form.password"
            label="Password"
            type="password"
            autocomplete="new-password"
            :rules="passwordRules"
          />
        </VCol>
        <VCol cols="12" sm="6">
          <AppTextField
            v-model="form.confirmation"
            label="Confirm password"
            type="password"
            autocomplete="new-password"
            :rules="[required('Password confirmation'), matches(() => form.password, 'Password confirmation')]"
          />
        </VCol>
      </VRow>
      <VCheckbox
        v-model="form.accepted"
        label="I accept the privacy and acceptable-use terms."
        :rules="[required('Acceptance of the terms')]"
        class="my-4"
      />
      <VBtn block size="large" type="submit" :loading="loading"> Accept invitation </VBtn>
    </VForm>
    <div v-if="enrollment && !completed">
      <p class="mb-4">Add this account to your authenticator app, then enter its six-digit code.</p>
      <code class="d-block mb-5">{{ enrollment.secret }}</code>
      <AppTextField v-model="mfaCode" label="Authenticator code" inputmode="numeric" maxlength="6" class="mb-5" />
      <VBtn block size="large" :loading="loading" @click="completeEnrollment"> Activate staff account </VBtn>
    </div>
    <VBtn v-if="completed" block size="large" to="/login"> Continue to sign in </VBtn>
  </AuthShell>
</template>
