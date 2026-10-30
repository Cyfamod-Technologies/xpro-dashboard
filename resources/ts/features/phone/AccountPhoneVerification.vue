<script setup lang="ts">
import PhoneVerificationField from "@/features/phone/PhoneVerificationField.vue"
import { useAuthStore } from "@/stores/auth"

const auth = useAuthStore()
const phone = ref(auth.user?.phone ?? "")
</script>

<template>
  <VCard>
    <VCardText>
      <h2 class="text-h5 mb-2">Phone verification</h2>
      <p class="text-body-2 text-medium-emphasis mb-5">
        Verify your account phone number by SMS. A new number needs to be verified again.
      </p>
      <VRow
        ><VCol cols="12" md="6"><PhoneVerificationField v-model="phone" /></VCol
      ></VRow>
    </VCardText>
  </VCard>
</template>
