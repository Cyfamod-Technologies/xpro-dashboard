<script setup lang="ts">
import { VForm } from "vuetify/components/VForm"

import AuthShell from "@/features/auth/AuthShell.vue"
import { emailRules, fullName, matches, passwordRules, required } from "@/features/auth/validation"

definePage({ meta: { layout: "blank", public: true, unauthenticatedOnly: true } })

const completed = ref(false)
const formRef = ref<VForm>()
const form = reactive({
  name: "Amina Musa",
  email: "manager@xpro.test",
  password: "",
  confirmation: "",
  accepted: false,
})

const submit = async () => {
  const validation = await formRef.value?.validate()
  if (validation?.valid) completed.value = true
}
</script>

<template>
  <AuthShell
    eyebrow="Manager invitation"
    title="Join the Xpro operations workspace"
    subtitle="Confirm your profile, create a password and continue to your workspace."
  >
    <VAlert v-if="completed" color="success" variant="tonal" class="mb-6">
      Invitation accepted. If MFA is enabled for your account, you will be asked to verify it when you sign in.
    </VAlert>
    <VForm v-if="!completed" ref="formRef" @submit.prevent="submit">
      <AppTextField
        v-model="form.name"
        label="Full name"
        autocomplete="name"
        :rules="[required('Full name'), fullName]"
        class="mb-5"
      />
      <AppTextField v-model="form.email" label="Invited email" disabled :rules="emailRules" class="mb-5" />
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
      <VBtn block size="large" type="submit"> Accept invitation </VBtn>
    </VForm>
    <VBtn v-else block size="large" to="/login"> Continue to sign in </VBtn>
  </AuthShell>
</template>
