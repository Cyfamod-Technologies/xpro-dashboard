<script setup lang="ts">
import CustomerHome from '@/features/workspace/CustomerHome.vue'
import ProviderHome from '@/features/workspace/ProviderHome.vue'
import AdminHome from '@/features/workspace/AdminHome.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <CustomerHome v-if="auth.user?.role === 'customer'" />
  <ProviderHome v-else-if="auth.user?.role === 'provider'" />
  <AdminHome v-else-if="auth.user?.role === 'admin'" />
</template>
