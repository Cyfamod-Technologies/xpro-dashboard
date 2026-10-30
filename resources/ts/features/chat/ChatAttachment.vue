<script setup lang="ts">
import { requestsApi } from "@/services/requests-api"
import { formatFileSize } from "@/features/operations/file-rules"
import type { ChatAttachmentView } from "@/features/chat/chat-types"

const props = defineProps<{ file: ChatAttachmentView }>()

const isImage = computed(() => props.file.type.startsWith("image/"))
const thumbnail = ref("")
const opening = ref(false)
const failed = ref(false)

const fileIcon = computed(() => {
  if (props.file.type.startsWith("video/")) return "tabler-video"
  if (props.file.type === "application/pdf") return "tabler-file-type-pdf"
  if (props.file.type.includes("sheet") || props.file.type.includes("excel")) return "tabler-file-spreadsheet"

  return "tabler-file-text"
})

// The link comes from the permission-checked download endpoint, which re-checks access on every call.
async function link() {
  return (await requestsApi.fileLink(props.file.id)).url
}

async function open() {
  if (props.file.local || opening.value) return
  opening.value = true
  failed.value = false
  try {
    const url = await link()

    if (!window.open(url, "_blank", "noopener")) window.location.assign(url)
  } catch {
    failed.value = true
  } finally {
    opening.value = false
  }
}

onMounted(async () => {
  if (!isImage.value || props.file.local) return
  try {
    thumbnail.value = await link()
  } catch {
    /* No preview; the chip below still opens the file. */
  }
})
</script>

<template>
  <button
    type="button"
    class="chat-attachment"
    :class="{ 'chat-attachment--thumb': thumbnail }"
    :disabled="file.local"
    :aria-label="`${failed ? 'Could not open' : 'Open'} ${file.name}`"
    @click="open"
  >
    <img v-if="thumbnail" :src="thumbnail" :alt="file.name" class="chat-attachment__image" loading="lazy" />
    <span v-else class="chat-attachment__chip">
      <VIcon :icon="isImage ? 'tabler-photo' : fileIcon" size="20" />
      <span class="chat-attachment__text">
        <span class="chat-attachment__name">{{ file.name }}</span>
        <span class="chat-attachment__meta">
          {{ failed ? "Could not open. Try again." : file.local ? "Waiting to send" : formatFileSize(file.size) }}
        </span>
      </span>
    </span>
  </button>
</template>

<style scoped lang="scss">
.chat-attachment {
  display: block;
  min-inline-size: 0;
  max-inline-size: 100%;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: start;

  &:disabled {
    cursor: default;
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--v-theme-primary));
    outline-offset: 2px;
  }
}

.chat-attachment__image {
  display: block;
  inline-size: 100%;
  block-size: 100%;
  min-block-size: 80px;
  max-block-size: 160px;
  border-radius: 6px;
  object-fit: cover;
}

.chat-attachment__chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(var(--v-theme-on-surface), 0.06);
}

.chat-attachment__text {
  display: flex;
  flex-direction: column;
  min-inline-size: 0;
}

.chat-attachment__name {
  overflow: hidden;
  font-size: 0.8125rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-attachment__meta {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.75rem;
}
</style>
