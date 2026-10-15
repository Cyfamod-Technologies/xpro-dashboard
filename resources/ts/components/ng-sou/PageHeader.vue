<script setup lang="ts">
defineProps<{
  title: string
  description: string
  eyebrow?: string
}>()
</script>

<template>
  <div class="d-flex flex-wrap align-start justify-space-between gap-4 mb-6">
    <div>
      <div v-if="eyebrow" class="text-overline text-primary font-weight-bold mb-1">
        {{ eyebrow }}
      </div>
      <h1 class="text-h3 mb-2">
        {{ title }}
      </h1>
      <p class="text-body-1 text-medium-emphasis mb-0 page-description">
        {{ description }}
      </p>
    </div>
    <div class="d-flex flex-wrap gap-3">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.page-description {
  max-inline-size: 48rem;
}
</style>
