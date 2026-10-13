<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <VCard
    class="mx-auto my-16 pa-8 text-center"
    max-width="640"
  >
    <VAvatar
      color="warning"
      variant="tonal"
      size="72"
      class="mb-6"
    >
      <VIcon
        icon="tabler-lock"
        size="36"
      />
    </VAvatar>
    <h1 class="text-h3 mb-3">
      Access restricted
    </h1>
    <p class="text-body-1 text-medium-emphasis mb-7">
      Your current role does not have permission to open this area.
    </p>
    <VBtn
      :to="auth.homePath"
      prepend-icon="tabler-arrow-left"
    >
      Return to your dashboard
    </VBtn>
  </VCard>
</template>
