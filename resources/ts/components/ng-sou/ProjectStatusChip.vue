<script setup lang="ts">
import type { ApprovalStatus, TrackingStatus } from '@/types/domain'

const props = defineProps<{
  status: ApprovalStatus | TrackingStatus
}>()

const statusMap: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'secondary' },
  submitted: { label: 'Submitted', color: 'info' },
  changes_requested: { label: 'Changes requested', color: 'warning' },
  rejected: { label: 'Rejected', color: 'error' },
  published: { label: 'Published', color: 'success' },
  not_started: { label: 'Not started', color: 'secondary' },
  in_progress: { label: 'In progress', color: 'info' },
  stalled: { label: 'Stalled', color: 'error' },
  action_required: { label: 'Action required', color: 'warning' },
  action_in_progress: { label: 'Action in progress', color: 'primary' },
  completed: { label: 'Completed', color: 'success' },
}

const presentation = computed(() => statusMap[props.status] ?? { label: props.status, color: 'secondary' })
</script>

<template>
  <VChip
    :color="presentation.color"
    size="small"
    variant="tonal"
  >
    {{ presentation.label }}
  </VChip>
</template>
