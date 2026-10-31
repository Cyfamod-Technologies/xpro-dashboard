<script setup lang="ts">
import AccountWorkspaces from "@/features/account/AccountWorkspaces.vue"
import PhoneVerificationField from "@/features/phone/PhoneVerificationField.vue"
import { accountApi } from "@/services/account-api"
import { useAuthStore } from "@/stores/auth"
import { getErrorMessage } from "@/utils/errors"

const auth = useAuthStore()
const firstName = ref(auth.user?.firstName ?? "")
const lastName = ref(auth.user?.lastName ?? "")
const phone = ref(auth.user?.phone ?? "")
const saving = ref(false)
const error = ref("")
const notice = ref("")
const initials = computed(() => `${firstName.value.trim()[0] ?? ""}${lastName.value.trim()[0] ?? ""}`.toUpperCase())
const canSave = computed(
  () =>
    Boolean(firstName.value.trim() && lastName.value.trim()) &&
    !saving.value &&
    (firstName.value.trim() !== auth.user?.firstName || lastName.value.trim() !== auth.user?.lastName),
)

watch(
  () => auth.user?.phone,
  value => {
    if (value) phone.value = value
  },
)

async function save() {
  if (!canSave.value) return

  saving.value = true
  error.value = ""
  notice.value = ""
  try {
    const result = await accountApi.updatePersonalDetails({
      firstName: firstName.value.trim(),
      lastName: lastName.value.trim(),
    })
    if (auth.user) {
      Object.assign(auth.user, result.data, { initials: initials.value })
    }
    notice.value = "Your profile details have been saved."
  } catch (cause) {
    error.value = getErrorMessage(cause, "Your profile details could not be saved.")
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <VTabs model-value="account" class="mb-5" aria-label="Customer settings">
      <VTab value="account">Account</VTab>
    </VTabs>
    <VWindow model-value="account">
      <VWindowItem value="account">
        <VCard class="mb-6">
          <VCardText>
            <h2 class="text-h5 mb-1">Profile information</h2>
            <p class="text-body-2 text-medium-emphasis mb-5">Update the details Xpro uses to contact you.</p>
            <VAlert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</VAlert>
            <VAlert v-if="notice" type="success" variant="tonal" class="mb-4">{{ notice }}</VAlert>
            <VForm @submit.prevent="save">
              <VRow>
                <VCol cols="12" sm="6">
                  <VTextField v-model="firstName" label="First name" autocomplete="given-name" required />
                </VCol>
                <VCol cols="12" sm="6">
                  <VTextField v-model="lastName" label="Last name" autocomplete="family-name" required />
                </VCol>
                <VCol cols="12">
                  <VTextField
                    :model-value="auth.user?.email ?? ''"
                    label="Email address"
                    type="email"
                    autocomplete="email"
                    readonly
                    hint="Contact Xpro support if you need to change your email address."
                    persistent-hint
                  />
                </VCol>
                <VCol cols="12">
                  <PhoneVerificationField v-model="phone" />
                </VCol>
              </VRow>
              <div class="d-flex justify-end mt-2">
                <VBtn type="submit" :disabled="!canSave" :loading="saving">Save profile</VBtn>
              </div>
            </VForm>
          </VCardText>
        </VCard>
        <AccountWorkspaces />
      </VWindowItem>
    </VWindow>
  </div>
</template>
