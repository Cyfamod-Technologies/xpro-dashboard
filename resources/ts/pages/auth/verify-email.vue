<script setup lang="ts">
import { VForm } from "vuetify/components/VForm"

import AuthShell from "@/features/auth/AuthShell.vue"
import { emailRules } from "@/features/auth/validation"
import { draftStorageKey } from "@/features/drafts/draft-envelope"
import { authApi } from "@/services/xpro-api"
import { getErrorMessage } from "@/utils/errors"
import { isDemoMode } from "@/utils/demo-mode"
import { safeRedirectPath } from "@/utils/safe-redirect"

definePage({ meta: { layout: "blank", public: true } })

const route = useRoute()
const router = useRouter()
const verified = ref(false)
const loading = ref(false)
const errorMessage = ref("")
const resent = ref(false)
const resending = ref(false)
const resendForm = ref<VForm>()
const verifiedEmail = ref("")
const returnTo = ref<string | null>(null)

// Read once: the link carries only the token (spec 01 §6.3), which is removed from the address bar straight away.
const token = typeof route.query.token === "string" ? route.query.token : ""
const queryEmail = typeof route.query.email === "string" ? route.query.email : ""
const queryRole = typeof route.query.role === "string" ? route.query.role : ""
const queryRedirect = safeRedirectPath(route.query.redirect)
const resendEmail = ref(queryEmail)

if (token) window.history.replaceState(window.history.state, "", window.location.pathname)

const subtitle = computed(() => {
  if (verified.value) return "Your XPro account is ready. Sign in to continue."
  if (queryEmail)
    return `If ${queryEmail} can be used for a new account, we've sent a verification link. It expires in 24 hours.`

  return "Open the verification link we emailed you. It expires in 24 hours."
})

const hasGuestRequestDraft = () => {
  try {
    return window.localStorage.getItem(draftStorageKey("request", "guest")) !== null
  } catch {
    return false
  }
}

const resumesRequest = computed(() => returnTo.value === "/request")
const draftHere = computed(() => resumesRequest.value && hasGuestRequestDraft())

const signInTarget = computed(() => ({
  path: "/login",
  query: {
    ...(verifiedEmail.value ? { email: verifiedEmail.value } : {}),
    ...(returnTo.value ? { redirect: returnTo.value } : {}),
  },
}))

const verify = async () => {
  loading.value = true
  errorMessage.value = ""
  try {
    if (!isDemoMode && !token) throw new Error("Open the verification link from your email to verify this account.")

    const response = await authApi.verifyEmail(token || "prototype-verification-token")

    verifiedEmail.value = response.data.email ?? ""
    returnTo.value = safeRedirectPath(response.data.returnTo)
    verified.value = true
  } catch (error) {
    errorMessage.value = getErrorMessage(error)
  } finally {
    loading.value = false
  }
}

const resend = async () => {
  errorMessage.value = ""

  const validation = await resendForm.value?.validate()
  if (!validation?.valid) return

  resending.value = true
  try {
    await authApi.resendVerification(resendEmail.value)
    resent.value = true
  } catch (error) {
    errorMessage.value = getErrorMessage(error)
  } finally {
    resending.value = false
  }
}

const changeEmail = () =>
  router.push({
    path: "/auth/signup",
    query: {
      ...(queryEmail ? { email: queryEmail } : {}),
      ...(queryRole ? { role: queryRole } : {}),
      ...(queryRedirect ? { redirect: queryRedirect } : {}),
    },
  })

if (token) verify()
</script>

<template>
  <AuthShell
    eyebrow="Email verification"
    :title="verified ? 'Email verified' : 'Check your inbox'"
    :subtitle="subtitle"
  >
    <VAlert v-if="errorMessage" color="error" variant="tonal" class="mb-5">
      {{ errorMessage }}
    </VAlert>

    <template v-if="verified">
      <VAlert v-if="resumesRequest && !draftHere" color="info" variant="tonal" class="mb-5">
        If you started a request on another device or browser, sign in there to keep your draft.
      </VAlert>
      <VBtn block size="large" :to="signInTarget">
        {{ draftHere ? "Sign in to submit your request" : "Continue to sign in" }}
      </VBtn>
    </template>

    <template v-else>
      <VAlert v-if="isDemoMode" color="info" variant="tonal" class="mb-6">
        For this frontend prototype, use the button below to simulate opening the email link.
      </VAlert>
      <VBtn v-if="isDemoMode" block size="large" :loading="loading" @click="verify"> Verify prototype email </VBtn>

      <VForm ref="resendForm" class="mt-5" @submit.prevent="resend">
        <AppTextField
          v-if="!queryEmail || errorMessage"
          v-model="resendEmail"
          class="mb-3"
          label="Email address"
          type="email"
          placeholder="you@example.com"
          autocomplete="email"
          :rules="emailRules"
        />
        <p v-if="resent" class="text-body-2 text-center mb-0">If that email needs verifying, we've sent a new link.</p>
        <div v-else class="text-center">
          <VBtn variant="text" size="small" type="submit" :loading="resending"> Resend verification email </VBtn>
        </div>
      </VForm>

      <div class="d-flex flex-wrap justify-center gap-2 mt-3">
        <VBtn v-if="errorMessage" variant="text" size="small" to="/login"> Sign in </VBtn>
        <VBtn variant="text" size="small" prepend-icon="tabler-arrow-left" @click="changeEmail">
          Change email address
        </VBtn>
      </div>
    </template>
  </AuthShell>
</template>
