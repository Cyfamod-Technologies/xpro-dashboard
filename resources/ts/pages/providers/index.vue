<script setup lang="ts">
import FeaturedProviders from "@/features/discovery/FeaturedProviders.vue"
import { isDemoMode } from "@/utils/demo-mode"

definePage({ meta: { public: true, publicSite: true } })

const router = useRouter()
if (isDemoMode) router.replace("/services")
</script>

<template>
  <FeaturedProviders v-if="!isDemoMode" />
</template>
