<script setup lang="ts">
import { authApi } from "@/services/xpro-api"
import { useAuthStore } from "@/stores/auth"
import { getErrorMessage } from "@/utils/errors"

// One account can hold the customer and provider roles together (01 §6.16, Q11). Staff never see this card.
const auth = useAuthStore()
const busy = ref(false)
const errorMessage = ref("")
const accepted = ref(false)
const agreement = ref<{ version: string; url: string } | null>(null)

const missingRole = computed(() =>
  auth.holdsRole("customer") ? (auth.holdsRole("provider") ? null : "provider") : "customer",
)

// A customer becoming a provider accepts the current provider agreement; terms and privacy were accepted at signup.
watch(
  missingRole,
  async role => {
    agreement.value = null
    if (role !== "provider") return
    try {
      const documents = await authApi.legalDocuments("provider")
      const document = documents.data.find(item => item.kind === "provider_agreement")

      agreement.value = document ? { version: document.version, url: document.url } : null
    } catch {
      // The server still checks the agreement version on submit.
    }
  },
  { immediate: true },
)

const addRole = async () => {
  const role = missingRole.value
  if (!role || busy.value) return
  if (role === "provider" && agreement.value && !accepted.value) {
    errorMessage.value = "Accept the provider agreement to continue."

    return
  }

  busy.value = true
  errorMessage.value = ""
  try {
    await auth.addRole(
      role,
      role === "provider" && agreement.value ? { providerAgreementVersion: agreement.value.version } : undefined,
    )
    // The new role is now the active workspace; a full load opens its home with fresh data.
    window.location.assign(role === "provider" ? "/verification" : auth.homePath)
  } catch (error) {
    errorMessage.value = getErrorMessage(error, "We couldn't add this role. Try again.")
    busy.value = false
  }
}
</script>

<template>
  <VCard>
    <VCardText>
      <h2 class="text-h5 mb-2">Workspaces</h2>
      <template v-if="missingRole === 'customer'">
        <p class="text-body-2 text-medium-emphasis mb-5">
          Request services for yourself from this same account. You'll switch between your provider and customer
          workspaces from the account menu.
        </p>
        <VAlert v-if="errorMessage" class="mb-4" color="error" variant="tonal">{{ errorMessage }}</VAlert>
        <VBtn :loading="busy" prepend-icon="tabler-plus" @click="addRole"> Add customer role </VBtn>
      </template>
      <template v-else-if="missingRole === 'provider'">
        <p class="text-body-2 text-medium-emphasis mb-5">
          Offer your services on XPro from this same account. After you add the provider role, complete your provider
          profile — documents, a face photo and bank details — for XPro to review.
        </p>
        <VCheckbox v-if="agreement" v-model="accepted" class="mb-2">
          <template #label>
            <span>
              I accept the
              <a :href="agreement.url" target="_blank" rel="noopener noreferrer" @click.stop>provider agreement</a>
            </span>
          </template>
        </VCheckbox>
        <VAlert v-if="errorMessage" class="mb-4" color="error" variant="tonal">{{ errorMessage }}</VAlert>
        <VBtn :loading="busy" prepend-icon="tabler-briefcase" @click="addRole"> Offer your services on XPro </VBtn>
      </template>
      <p v-else class="text-body-2 text-medium-emphasis mb-0">
        This account has customer and provider workspaces. Switch between them from the account menu.
      </p>
    </VCardText>
  </VCard>
</template>
