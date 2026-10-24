<script setup lang="ts">
import type { Attachment } from "@/features/operations/types"

defineProps<{ files: Attachment[] }>()
</script>

<template>
  <div v-for="file in files" :key="file.id" class="my-3">
    <VImg v-if="file.dataUrl" :src="file.dataUrl" :alt="file.name" max-height="180" rounded class="mb-2" />
    <div class="d-flex align-center gap-2 text-body-2">
      <VIcon icon="tabler-paperclip" size="18" />{{ file.name }} · {{ Math.ceil(file.size / 1024) }} KB
      <VBtn v-if="file.downloadUrl" :href="file.downloadUrl" target="_blank" rel="noopener noreferrer" size="small" variant="text">
        View file
      </VBtn>
    </div>
    <small v-if="!file.dataUrl" class="text-medium-emphasis">File details saved for this preview.</small>
  </div>
</template>
