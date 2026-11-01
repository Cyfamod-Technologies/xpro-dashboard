<script setup lang="ts">
import { VForm } from "vuetify/components/VForm"

import AuthShell from "@/features/auth/AuthShell.vue"
import { matches, passwordRules, required } from "@/features/auth/validation"
import { staffRoleLabels } from "@/features/operations/staff"
import type { StaffInvitePreview } from "@/services/xpro-api"
import { staffInviteApi } from "@/services/xpro-api"
import { getErrorMessage } from "@/utils/errors"
import { isDemoMode } from "@/utils/demo-mode"

definePage({ meta: { layout: "blank", public: true, unauthenticatedOnly: true } })

const route = useRoute()
const token = computed(() => (typeof route.query.token === "string" ? route.query.token : ""))

const preview = ref<StaffInvitePreview | null>(null)
const loadingPreview = ref(!isDemoMode)
const previewError = ref("")

const completed = ref(false)
const loading = ref(false)
const errorMessage = ref("")
const enrollment = ref<{ token: string; secret: string; otpauthUrl: string } | null>(null)
const mfaCode = ref("")
const passwordVisible = ref(false)
const confirmationVisible = ref(false)
const formRef = ref<VForm>()
const form = reactive({
  password: "",
  confirmation: "",
  hasLinkedAccount: "no" as "no" | "yes",
  linkedEmail: "",
})

const minTwelve = (value: unknown) => String(value ?? "").length >= 12 || "Use at least 12 characters."

const loadPreview = async () => {
  if (isDemoMode) return
  if (!token.value) {
    previewError.value = "This invitation link is invalid or has expired."
    loadingPreview.value = false

    return
  }
  try {
    preview.value = (await staffInviteApi.preview(token.value)).data
  } catch (error) {
    previewError.value = getErrorMessage(error)
  } finally {
    loadingPreview.value = false
  }
}

const roleText = computed(() => {
  const labels = (preview.value?.roles ?? []).map(role => staffRoleLabels[role])

  return labels.length ? new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(labels) : ""
})

// The name was set by the super admin who sent the invitation, so it is greeted here and never asked for again.
const subtitle = computed(() => {
  if (previewError.value) return "We could not open your invitation."
  const first = preview.value?.firstName?.trim()
  if (!first) return "Create a password to activate your staff account and continue to your workspace."

  return `Welcome to Xpro, ${first}. ${
    roleText.value ? `You've been invited to join the team as ${roleText.value}. ` : ""
  }Create a password to activate your account.`
})

const submit = async () => {
  const validation = await formRef.value?.validate()
  if (!validation?.valid) return
  errorMessage.value = ""
  if (isDemoMode) {
    completed.value = true

    return
  }
  loading.value = true
  try {
    const linked = form.hasLinkedAccount === "yes"
    const linkedEmail = form.linkedEmail.trim()
    const response = await staffInviteApi.accept({
      token: token.value,
      password: form.password,
      conflictDeclaration: {
        hasLinkedCustomerAccount: linked,
        ...(linked && linkedEmail ? { linkedCustomerEmail: linkedEmail } : {}),
        statement: linked
          ? `I have a separate customer account with XPro${linkedEmail ? ` (${linkedEmail})` : ""}.`
          : "I have no separate customer account with XPro.",
      },
    })
    if (response.data.result === "mfa_enrollment_required") {
      enrollment.value = {
        token: response.data.enrollmentToken,
        secret: response.data.secret,
        otpauthUrl: response.data.otpauthUrl,
      }
    } else {
      completed.value = true
    }
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
    await staffInviteApi.verifyEnrollment(enrollment.value.token, mfaCode.value.trim())
    completed.value = true
  } catch (error) {
    errorMessage.value = getErrorMessage(error)
  } finally {
    loading.value = false
  }
}

onMounted(loadPreview)
</script>

<template>
  <AuthShell eyebrow="Staff invitation" title="Join the Xpro operations workspace" :subtitle="subtitle">
    <div v-if="loadingPreview" class="d-flex justify-center py-8">
      <VProgressCircular indeterminate color="primary" aria-label="Loading your invitation" />
    </div>
    <VAlert v-else-if="previewError" color="error" variant="tonal" class="mb-6">
      {{ previewError }}
    </VAlert>
    <template v-else>
      <VAlert v-if="errorMessage" color="error" variant="tonal" class="mb-6">
        {{ errorMessage }}
      </VAlert>
      <VAlert v-if="completed" color="success" variant="tonal" class="mb-6">
        Invitation accepted. Your staff account is ready to sign in.
      </VAlert>
      <VForm v-if="!completed && !enrollment" ref="formRef" @submit.prevent="submit">
        <p v-if="preview" class="text-body-2 text-medium-emphasis mb-4">
          Your account email is <strong>{{ preview.email }}</strong
          >.
        </p>
        <VRow>
          <VCol cols="12" sm="6">
            <AppTextField
              v-model="form.password"
              label="Password"
              autocomplete="new-password"
              :rules="[...passwordRules, minTwelve]"
              :type="passwordVisible ? 'text' : 'password'"
              :append-inner-icon="passwordVisible ? 'tabler-eye-off' : 'tabler-eye'"
              @click:append-inner="passwordVisible = !passwordVisible"
            />
          </VCol>
          <VCol cols="12" sm="6">
            <AppTextField
              v-model="form.confirmation"
              label="Confirm password"
              autocomplete="new-password"
              :rules="[required('Password confirmation'), matches(() => form.password, 'Password confirmation')]"
              :type="confirmationVisible ? 'text' : 'password'"
              :append-inner-icon="confirmationVisible ? 'tabler-eye-off' : 'tabler-eye'"
              @click:append-inner="confirmationVisible = !confirmationVisible"
            />
          </VCol>
        </VRow>
        <div id="linked-account-label" class="text-body-2 mt-2">
          Do you have a separate Xpro customer account under a different email?
        </div>
        <VRadioGroup v-model="form.hasLinkedAccount" inline hide-details aria-labelledby="linked-account-label">
          <VRadio label="No" value="no" />
          <VRadio label="Yes" value="yes" />
        </VRadioGroup>
        <AppTextField
          v-if="form.hasLinkedAccount === 'yes'"
          v-model="form.linkedEmail"
          label="Customer account email"
          type="email"
          autocomplete="off"
          class="mt-3"
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
    </template>
  </AuthShell>
</template>
