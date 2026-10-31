<script setup lang="ts">
import type { CustomerRequestLimitView } from "@/features/requests/api-types"
import { SET_LIMIT_PERMISSION, limitBody, limitError, limitLabel, noteError } from "@/features/requests/customer-limit"
import { requestsApi } from "@/services/requests-api"
import { useAuthStore } from "@/stores/auth"

/**
 * Staff request screen: the request owner's open-request limit (MS-7). Anyone who sees the request sees the value;
 * staff holding `account.limit` can change it.
 */
const props = defineProps<{ limit: CustomerRequestLimitView }>()
const emit = defineEmits<{ change: [CustomerRequestLimitView] }>()
const auth = useAuthStore()
const dialog = ref(false)
const useDefault = ref(false)
const value = ref("")
const note = ref("")
const busy = ref(false)
const error = ref("")
const touched = ref(false)

const canChange = computed(() => auth.user?.scopes.includes(SET_LIMIT_PERMISSION) ?? false)
const valueError = computed(() => limitError(value.value, useDefault.value))
const missingNote = computed(() => noteError(note.value))

function openDialog() {
  useDefault.value = props.limit.override === null
  value.value = String(props.limit.override ?? props.limit.effective)
  note.value = ""
  error.value = ""
  touched.value = false
  dialog.value = true
}

async function save() {
  touched.value = true

  const body = limitBody(value.value, useDefault.value, note.value)

  if (!body || busy.value) return
  busy.value = true
  error.value = ""
  try {
    emit("change", await requestsApi.setCustomerRequestLimit(props.limit.userId, body))
    dialog.value = false
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "The limit could not be changed."
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <VCard class="mb-5">
    <VCardText class="d-flex flex-wrap align-center justify-space-between ga-3">
      <div>
        <h3 class="text-subtitle-1 mb-1">Customer's open-request limit</h3>
        <p class="text-body-2 text-medium-emphasis mb-0">
          <strong class="text-high-emphasis">{{ limitLabel(limit) }}</strong>
          · {{ limit.open }} open now
        </p>
      </div>
      <VBtn v-if="canChange" size="small" variant="outlined" @click="openDialog">Change limit</VBtn>
    </VCardText>
  </VCard>

  <VDialog v-model="dialog" max-width="480" :persistent="busy">
    <VCard>
      <VCardTitle class="pt-5 px-6">Change the customer's open-request limit</VCardTitle>
      <VCardText class="d-flex flex-column gap-3 px-6">
        <p class="text-body-2 text-medium-emphasis mb-0">
          This customer has {{ limit.open }} open now. Their limit applies to new requests only.
        </p>
        <VSwitch v-model="useDefault" label="Use platform default" color="primary" hide-details />
        <VTextField
          v-model="value"
          label="Open requests allowed"
          type="number"
          min="1"
          max="50"
          step="1"
          :disabled="useDefault"
          :error-messages="touched ? valueError : ''"
        />
        <VTextarea v-model="note" label="Note *" rows="3" counter="500" :error-messages="touched ? missingNote : ''" />
        <VAlert v-if="error" type="error" variant="tonal">{{ error }}</VAlert>
      </VCardText>
      <VCardActions class="px-6 pb-5">
        <VSpacer />
        <VBtn variant="text" :disabled="busy" @click="dialog = false">Cancel</VBtn>
        <VBtn :loading="busy" @click="save">Save limit</VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
