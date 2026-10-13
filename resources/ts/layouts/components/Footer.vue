<script setup lang="ts">
import { XPRO_BRAND } from '@/utils/branding'
</script>

<template>
  <div class="h-100 d-flex flex-wrap gap-2 align-center justify-md-space-between justify-center text-medium-emphasis">
    <span>&copy; {{ new Date().getFullYear() }} {{ XPRO_BRAND.name }}</span>
    <a
      :href="`mailto:${XPRO_BRAND.email}`"
      class="text-medium-emphasis"
    >{{ XPRO_BRAND.email }}</a>
    <span class="d-none d-md-inline">{{ XPRO_BRAND.location }}</span>
  </div>
</template>
