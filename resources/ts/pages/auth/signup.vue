<script setup lang="ts">
import { VForm } from "vuetify/components/VForm"

import AuthShell from "@/features/auth/AuthShell.vue"
import { emailRules, matches, passwordRules, required } from "@/features/auth/validation"
import { authApi } from "@/services/xpro-api"
import { getErrorMessage } from "@/utils/errors"

definePage({ meta: { layout: "blank", public: true, unauthenticatedOnly: true } })

const router = useRouter()
const route = useRoute()
const formRef = ref<VForm>()
const form = reactive({ firstName: "", lastName: "", email: "", password: "", confirmPassword: "", accepted: false })
const accountRole = ref<"customer" | "provider">(route.query.role === "provider" ? "provider" : "customer")
const accountTypes = [
  { title: "Customer", value: "customer" },
  { title: "Provider", value: "provider" },
]
const visible = ref(false)
const loading = ref(false)
const errorMessage = ref("")

const submit = async () => {
  errorMessage.value = ""

  const validation = await formRef.value?.validate()
  if (!validation?.valid) return

  loading.value = true
  try {
    await authApi.registerAccount({
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      password: form.password,
      role: accountRole.value,
    })
    await router.push({ path: "/auth/verify-email", query: { email: form.email } })
  } catch (error) {
    errorMessage.value = getErrorMessage(error)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell
    eyebrow="Join XPro"
    title="Create your XPro account"
    subtitle="Request a service as a customer, or join XPro as a service provider. Staff accounts are managed internally."
  >
    <VAlert v-if="errorMessage" class="mb-5" color="error" variant="tonal">
      {{ errorMessage }}
    </VAlert>
    <VForm ref="formRef" @submit.prevent="submit">
      <VRow>
        <VCol cols="12">
          <AppSelect v-model="accountRole" label="Account type" :items="accountTypes" />
          <p v-if="accountRole === 'provider'" class="text-body-2 text-medium-emphasis mt-2 mb-0">
            After you verify your email, complete your provider profile — documents, a face photo and bank details — for
            XPro to review.
          </p>
        </VCol>
        <VCol cols="12" sm="6">
          <AppTextField
            v-model="form.firstName"
            label="First name"
            placeholder="First name"
            autocomplete="given-name"
            :rules="[required('First name')]"
          />
        </VCol>
        <VCol cols="12" sm="6">
          <AppTextField
            v-model="form.lastName"
            label="Last name"
            placeholder="Last name"
            autocomplete="family-name"
            :rules="[required('Last name')]"
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
        <VCol cols="12" sm="6">
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
        <VCol cols="12" sm="6">
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
          <VBtn block size="large" type="submit" :loading="loading"> Create account </VBtn>
        </VCol>
      </VRow>
    </VForm>
    <p class="text-center mt-6 mb-0">
      Already registered?
      <RouterLink to="/login" class="text-primary font-weight-semibold text-decoration-none"> Sign in </RouterLink>
    </p>
  </AuthShell>
</template>
