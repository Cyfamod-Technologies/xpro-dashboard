<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <VCard class="mb-5">
    <VCardItem class="pa-5 pb-4">
      <VCardTitle class="text-h5">
        {{ title }}
      </VCardTitle>
      <VCardSubtitle v-if="subtitle" class="text-wrap">
        {{ subtitle }}
      </VCardSubtitle>
    </VCardItem>
    <VDivider />
    <VCardText class="pa-5">
      <slot />
    </VCardText>
  </VCard>
</template>
