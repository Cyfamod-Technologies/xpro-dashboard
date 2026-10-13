<script setup lang="ts">
import { VForm } from 'vuetify/components/VForm'

import AuthShell from '@/features/auth/AuthShell.vue'
import { emailRules, required } from '@/features/auth/validation'
import { demoCredentials } from '@/mocks/fixtures'
import { useAuthStore } from '@/stores/auth'
import { getErrorMessage } from '@/utils/errors'

definePage({ meta: { layout: 'blank', public: true, unauthenticatedOnly: true } })

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const formRef = ref<VForm>()
const form = reactive({ email: '', password: '', remember: false })
const isPasswordVisible = ref(false)
const loading = ref(false)
const errorMessage = ref('')

const useDemoAccount = (email: string, password: string) => {
  form.email = email
  form.password = password
}

const submit = async () => {
  errorMessage.value = ''

  const validation = await formRef.value?.validate()
  if (!validation?.valid)
    return

  loading.value = true
  try {
    const result = await auth.login(form)
    if (result.requiresMfa) {
      await router.push('/auth/mfa')

      return
    }

    const redirect = typeof route.query.redirect === 'string' && (route.query.redirect === '/' || route.query.redirect.startsWith('/workspace/'))
      ? route.query.redirect
      : auth.homePath

    await router.push(redirect)
  }
  catch (error) {
    errorMessage.value = getErrorMessage(error, 'We could not sign you in. Check your details and try again.')
  }
  finally { loading.value = false }
}
</script>

<template>
  <AuthShell
    title="Welcome back"
    subtitle="Sign in to request services, manage assignments or coordinate XPro operations."
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
            v-model="form.email"
            autofocus
            label="Email address"
            type="email"
            placeholder="you@example.com"
            autocomplete="email"
            :rules="emailRules"
          />
        </VCol>
        <VCol cols="12">
          <AppTextField
            v-model="form.password"
            label="Password"
            placeholder="Enter your password"
            :type="isPasswordVisible ? 'text' : 'password'"
            autocomplete="current-password"
            :rules="[required('Password')]"
            :append-inner-icon="isPasswordVisible ? 'tabler-eye-off' : 'tabler-eye'"
            @click:append-inner="isPasswordVisible = !isPasswordVisible"
          />
        </VCol>
        <VCol cols="12">
          <div class="d-flex align-center justify-space-between flex-wrap gap-2">
            <VCheckbox
              v-model="form.remember"
              label="Remember this device"
              hide-details
            />
            <RouterLink
              to="/auth/forgot-password"
              class="text-primary text-decoration-none"
            >
              Forgot password?
            </RouterLink>
          </div>
        </VCol>
        <VCol cols="12">
          <VBtn
            block
            size="large"
            type="submit"
            :loading="loading"
          >
            Sign in
          </VBtn>
        </VCol>
      </VRow>
    </VForm>

    <p class="text-center text-body-2 mt-6 mb-6">
      New to XPro?
      <RouterLink
        to="/auth/signup"
        class="text-primary font-weight-semibold text-decoration-none"
      >
        Create a customer or provider account
      </RouterLink>
    </p>

    <VCard
      variant="tonal"
      color="secondary"
    >
      <VCardText>
        <div class="text-subtitle-2 font-weight-bold mb-3">
          Prototype accounts
        </div>
        <button
          v-for="credential in demoCredentials"
          :key="credential.email"
          type="button"
          class="demo-account d-flex align-center justify-space-between w-100 text-start"
          @click="useDemoAccount(credential.email, credential.password)"
        >
          <span><strong>{{ credential.role }}</strong><small class="d-block text-medium-emphasis">{{ credential.email }}</small></span>
          <VIcon icon="tabler-arrow-up-right" />
        </button>
      </VCardText>
    </VCard>
  </AuthShell>
</template>

<style scoped>
.demo-account {
  border: 0;
  border-block-start: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding-block: 0.75rem;
}
.demo-account:first-of-type { border-block-start: 0; }
</style>
