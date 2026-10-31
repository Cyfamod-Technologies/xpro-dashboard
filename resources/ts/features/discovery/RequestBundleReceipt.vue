<script setup lang="ts">
/** What the customer sees after a multi-service submission: every reference, and any warnings from the server. */
defineProps<{
  /** The project reference (`XPG-nnnnn`), when the server created a group. */
  projectRef?: string
  requestIds: string[]
  warnings: string[]
}>()
</script>

<template>
  <VCard color="success" variant="tonal">
    <VCardText class="pa-6">
      <h2 class="text-h5 mb-2">Your requests are on their way.</h2>
      <p>
        <template v-if="projectRef">{{ projectRef }}: </template>{{ requestIds.length }} requests have been sent to XPro
        for review.
      </p>
      <ul class="mb-4 ps-5" aria-label="Your request references">
        <li v-for="id in requestIds" :key="id">{{ id }}</li>
      </ul>
      <VAlert v-for="message in warnings" :key="message" type="warning" variant="tonal" class="mb-4">
        {{ message }}
      </VAlert>
      <VBtn to="/requests"> View my requests </VBtn>
    </VCardText>
  </VCard>
</template>
