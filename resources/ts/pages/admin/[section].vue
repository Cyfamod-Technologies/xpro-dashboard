<script setup lang="ts">
import SectionView from "@/features/workspace/SectionView.vue"

definePage({ meta: { adminSection: true } })

const route = useRoute("admin-section")
</script>

<template>
  <SectionView :key="String(route.params.section)" :section-id="String(route.params.section)" />
</template>
