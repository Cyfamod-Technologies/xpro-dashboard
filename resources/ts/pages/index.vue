<script setup lang="ts">
import PublicHome from '@/features/discovery/PublicHome.vue'
import WorkspaceOverview from '@/features/operations/WorkspaceOverview.vue'
import { useAuthStore } from '@/stores/auth'

definePage({ meta: { public: true, publicSite: true } })

const auth = useAuthStore()
</script>

<template>
  <WorkspaceOverview v-if="auth.isAuthenticated && auth.user?.role !== 'customer'" />
  <PublicHome v-else />
</template>
