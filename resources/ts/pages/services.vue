<script setup lang="ts">
import Discovery from '@/features/discovery/Discovery.vue'

definePage({ meta: { public: true, publicSite: true } })
</script>

<template>
  <Discovery services />
</template>
