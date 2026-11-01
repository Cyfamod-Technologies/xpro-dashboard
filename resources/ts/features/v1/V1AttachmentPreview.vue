<script setup lang="ts">
import type { V1Attachment } from "@/features/v1/types"
import { formatFileSize } from "@/features/operations/file-rules"
import { requestsApi } from "@/services/requests-api"
import { getErrorMessage } from "@/utils/errors"

const props = defineProps<{ file: V1Attachment }>()

const open = ref(false)
const loading = ref(false)
const url = ref("")
const error = ref("")

const isImage = computed(() => props.file.type.toLowerCase().startsWith("image/"))
const isPdf = computed(
  () => props.file.type.toLowerCase() === "application/pdf" || props.file.name.toLowerCase().endsWith(".pdf"),
)

const preview = async () => {
  error.value = ""
  url.value = ""
  const pdfTab = isPdf.value ? window.open("about:blank", "_blank") : null

  if (pdfTab) pdfTab.opener = null
  open.value = !pdfTab

  loading.value = true
  try {
    const fileUrl = (await requestsApi.fileLink(props.file.id, { inline: isImage.value || isPdf.value })).url

    if (pdfTab) {
      pdfTab.location.replace(fileUrl)

      return
    }
    url.value = fileUrl
  } catch (cause) {
    pdfTab?.close()
    open.value = true
    error.value = getErrorMessage(cause, "This file could not be opened.")
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <VBtn variant="text" size="small" class="file-preview-link" @click="preview">
    <VIcon icon="tabler-paperclip" size="18" class="me-1" />
    {{ file.name }} · {{ formatFileSize(file.size) }}
  </VBtn>

  <VDialog v-model="open" max-width="960" scrollable>
    <VCard>
      <VCardTitle class="d-flex align-center justify-space-between gap-3">
        <span class="text-truncate">{{ file.name }}</span>
        <VBtn icon="tabler-x" variant="text" aria-label="Close preview" @click="open = false" />
      </VCardTitle>
      <VDivider />
      <VCardText class="preview-body">
        <div v-if="loading" class="d-flex justify-center pa-10">
          <VProgressCircular indeterminate color="primary" />
        </div>
        <VAlert v-else-if="error" type="error" variant="tonal">{{ error }}</VAlert>
        <VImg v-else-if="isImage && url" :src="url" :alt="file.name" max-height="72vh" contain />
        <div v-else-if="isPdf && url" class="text-center pa-8">
          <p class="mb-4">Open this PDF in your browser's built-in viewer.</p>
          <VBtn :href="url" target="_blank" rel="noopener noreferrer" prepend-icon="tabler-file-type-pdf">
            Open PDF
          </VBtn>
        </div>
        <div v-else-if="url" class="text-center pa-8">
          <p class="mb-4">Preview is not available for this file type.</p>
          <VBtn :href="url" target="_blank" rel="noopener noreferrer" prepend-icon="tabler-download">
            Open or download file
          </VBtn>
        </div>
      </VCardText>
    </VCard>
  </VDialog>
</template>

<style scoped>
.file-preview-link {
  max-width: 100%;
  justify-content: flex-start;
  text-transform: none;
  letter-spacing: normal;
}

.preview-body {
  min-height: 220px;
}
</style>
