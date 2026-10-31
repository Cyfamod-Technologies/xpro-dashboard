<script setup lang="ts">
import type { FormDraft } from "@/features/drafts/use-form-draft"

const props = defineProps<{ draft: FormDraft }>()
const { status, savedAt, restoredAt, filesLost, conflict } = props.draft
const savedAgo = useTimeAgo(computed(() => savedAt.value ?? Date.now()))
const restoredAgo = useTimeAgo(computed(() => restoredAt.value ?? Date.now()))
const noticeDismissed = ref(false)
const confirmReset = ref(false)

const statusText = computed(() => {
  if (status.value === "saving") return "Saving draft…"
  if (status.value === "saved") return `Draft saved · ${savedAgo.value}`
  if (status.value === "unavailable") return "Draft could not be saved on this device."

  return ""
})

const startOver = async () => {
  confirmReset.value = false
  noticeDismissed.value = false
  await props.draft.discard()
}
</script>

<template>
  <div>
    <VAlert v-if="conflict" variant="tonal" color="warning" class="mb-4">
      <div class="mb-2">
        <strong>Your saved details changed after you started this draft.</strong> Restoring it may overwrite the newer
        details.
      </div>
      <div class="d-flex flex-wrap gap-2">
        <VBtn size="small" @click="draft.resolveConflict(true)"> Restore draft anyway </VBtn>
        <VBtn size="small" variant="outlined" @click="draft.resolveConflict(false)"> Discard draft </VBtn>
      </div>
    </VAlert>
    <VAlert v-else-if="restoredAt && !noticeDismissed" variant="tonal" color="info" class="mb-4">
      <div class="d-flex align-center flex-wrap gap-2">
        <span class="flex-grow-1">We restored your draft from {{ restoredAgo }}.</span>
        <VBtn size="small" variant="text" @click="confirmReset = true"> Start over </VBtn>
        <VBtn size="small" variant="text" aria-label="Dismiss" @click="noticeDismissed = true"> Dismiss </VBtn>
      </div>
    </VAlert>
    <VAlert v-if="filesLost" variant="tonal" color="warning" class="mb-4">
      Your attached files could not be saved on this device. If you leave this page, add them again before submitting.
    </VAlert>
    <p
      v-if="statusText"
      class="text-body-2 mb-4"
      :class="status === 'unavailable' ? 'text-warning' : 'text-medium-emphasis'"
      aria-live="polite"
    >
      {{ statusText }}
    </p>
    <VDialog v-model="confirmReset" max-width="420">
      <VCard>
        <VCardTitle class="pt-5 px-5"> Start over? </VCardTitle>
        <VCardText class="px-5">
          This clears everything you have entered in this form, including attached files, and removes the saved draft.
        </VCardText>
        <VCardActions class="px-5 pb-4 justify-end">
          <VBtn variant="text" @click="confirmReset = false"> Keep draft </VBtn>
          <VBtn color="error" @click="startOver"> Start over </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>
