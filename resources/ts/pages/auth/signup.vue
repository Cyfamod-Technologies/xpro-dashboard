<script setup lang="ts">
import { VForm } from 'vuetify/components/VForm'

import AuthShell from '@/features/auth/AuthShell.vue'
import { emailRules, fullName, matches, passwordRules, required } from '@/features/auth/validation'
import { authApi } from '@/services/xpro-api'
import { getErrorMessage } from '@/utils/errors'

definePage({ meta: { layout: 'blank', public: true, unauthenticatedOnly: true } })

const router = useRouter()
const formRef = ref<VForm>()
const form = reactive({ name: '', email: '', password: '', confirmPassword: '', accepted: false })
const visible = ref(false)
const loading = ref(false)
const errorMessage = ref('')

const submit = async () => {
  errorMessage.value = ''

  const validation = await formRef.value?.validate()
  if (!validation?.valid)
    return

  loading.value = true
  try {
    await authApi.registerViewer({ name: form.name, email: form.email, password: form.password })
    await router.push({ path: '/auth/verify-email', query: { email: form.email } })
  }
  catch (error) { errorMessage.value = getErrorMessage(error) }
  finally { loading.value = false }
}
</script>

<template>
  <AuthShell
    eyebrow="Read-only public data"
    title="Create a Budget Viewer account"
    subtitle="Register to explore approved project and allocation information. Manager accounts are invitation-only."
  >
    <VAlert
      v-if="errorMessage"
      class="mb-5"
      color="error"
      variant="tonal"
    >
      {{ errorMessage }}
    </VAlert>
    <VForm
      ref="formRef"
      @submit.prevent="submit"
    >
      <VRow>
        <VCol cols="12">
          <AppTextField
            v-model="form.name"
            label="Full name"
            placeholder="Enter your full name"
            autocomplete="name"
            :rules="[required('Full name'), fullName]"
          />
        </VCol>
        <VCol cols="12">
          <AppTextField
            v-model="form.email"
            label="Email address"
            type="email"
            placeholder="you@example.com"
            autocomplete="email"
            :rules="emailRules"
          />
        </VCol>
        <VCol
          cols="12"
          sm="6"
        >
          <AppTextField
            v-model="form.password"
            label="Password"
            autocomplete="new-password"
            :rules="passwordRules"
            :type="visible ? 'text' : 'password'"
            :append-inner-icon="visible ? 'tabler-eye-off' : 'tabler-eye'"
            @click:append-inner="visible = !visible"
          />
        </VCol>
        <VCol
          cols="12"
          sm="6"
        >
          <AppTextField
            v-model="form.confirmPassword"
            label="Confirm password"
            autocomplete="new-password"
            :rules="[required('Password confirmation'), matches(() => form.password, 'Password confirmation')]"
            :type="visible ? 'text' : 'password'"
          />
        </VCol>
        <VCol cols="12">
          <VCheckbox
            v-model="form.accepted"
            label="I accept the privacy and acceptable-use terms."
            :rules="[required('Acceptance of the terms')]"
          />
        </VCol>
        <VCol cols="12">
          <VBtn
            block
            size="large"
            type="submit"
            :loading="loading"
          >
            Create viewer account
          </VBtn>
        </VCol>
      </VRow>
    </VForm>
    <p class="text-center mt-6 mb-0">
      Already registered? <RouterLink
        to="/login"
        class="text-primary font-weight-semibold text-decoration-none"
      >
        Sign in
      </RouterLink>
    </p>
  </AuthShell>
</template>
