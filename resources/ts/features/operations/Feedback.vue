<script setup lang="ts">
import { useOperationsStore } from '@/stores/operations'

const ops = useOperationsStore()
</script>

<template>
  <VAlert
    v-if="ops.error"
    color="error"
    variant="tonal"
    class="mb-4"
    closable
    @click:close="ops.error = ''"
  >
    {{ ops.error }}
  </VAlert>
  <VAlert
    v-if="ops.notice"
    color="success"
    variant="tonal"
    class="mb-4"
    closable
    @click:close="ops.notice = ''"
  >
    {{ ops.notice }}
  </VAlert>
</template>
