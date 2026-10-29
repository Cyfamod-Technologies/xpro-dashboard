<script setup lang="ts">
import type { Attachment } from "@/features/operations/types"
import type { FilePurpose } from "@/features/operations/file-rules"
import {
  checkFiles,
  fileAccept,
  fileHint,
  formatFileSize,
} from "@/features/operations/file-rules"
import Attachments from "@/features/operations/Attachments.vue"

const props = defineProps<{
  purpose: Exclude<FilePurpose, "provider_photo">
  label: string
  /** Files already stored for the provider. */
  saved: Attachment[]
  /** Files chosen in this session that upload on submit. */
  queued: File[]
}>()
const emit = defineEmits<{ "update:saved": [value: Attachment[]]; "update:queued": [value: File[]] }>()
const pickerKey = ref(0)
const problems = ref<string[]>([])

const add = (value: File | File[] | null) => {
  const picked = Array.isArray(value) ? value : value ? [value] : []

  if (!picked.length) return

  const result = checkFiles(props.purpose, picked, props.queued, props.saved.length)

  problems.value = result.problems
  if (result.accepted.length) emit("update:queued", [...props.queued, ...result.accepted])
  // Reset the input so the same file can be picked again after removing it.
  pickerKey.value += 1
}
const removeSaved = (id: string) =>
  emit(
    "update:saved",
    props.saved.filter(file => file.id !== id),
  )
const removeQueued = (index: number) =>
  emit(
    "update:queued",
    props.queued.filter((_, position) => position !== index),
  )
</script>

<template>
  <div>
    <div v-for="file in saved" :key="file.id" class="d-flex align-center gap-2">
      <Attachments :files="[file]" class="flex-grow-1" />
      <VBtn
        icon="tabler-x"
        variant="text"
        size="small"
        :aria-label="`Remove ${file.name}`"
        @click="removeSaved(file.id)"
      />
    </div>
    <div
      v-for="(file, index) in queued"
      :key="`${file.name}-${file.size}-${file.lastModified}`"
      class="d-flex align-center gap-2 my-3 text-body-2"
    >
      <VIcon icon="tabler-file-upload" size="18" />
      <span class="flex-grow-1">{{ file.name }} · {{ formatFileSize(file.size) }}</span>
      <VBtn
        icon="tabler-x"
        variant="text"
        size="small"
        :aria-label="`Remove ${file.name}`"
        @click="removeQueued(index)"
      />
    </div>
    <VFileInput
      :key="pickerKey"
      multiple
      :label="label"
      :accept="fileAccept(purpose)"
      :hint="fileHint(purpose)"
      persistent-hint
      :error-messages="problems"
      :max-errors="problems.length || 1"
      class="mt-2"
      @update:model-value="add"
    />
  </div>
</template>
