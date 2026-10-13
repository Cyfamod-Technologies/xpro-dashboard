<script setup lang="ts">
import { useOperationsStore } from '@/stores/operations'
import type { ServiceRequest } from '@/features/operations/types'
import { statusLabels, when } from '@/features/operations/types'
import { prepareFiles } from '@/features/operations/files'
import Attachments from '@/features/operations/Attachments.vue'

const props = defineProps<{ request: ServiceRequest }>()
const ops = useOperationsStore()
const note = ref('')
const status = ref<'in_progress' | 'blocked' | 'completion_pending'>('in_progress')
const files = ref<File[]>([])

const addProgress = async () => {
  try {
    const attachments = await prepareFiles(files.value)
    if (await ops.run({ type: 'progress.add', requestId: props.request.id, status: status.value, note: note.value, attachments })) {
      files.value = []
      note.value = ''
    }
  }
  catch (cause) { ops.error = cause instanceof Error ? cause.message : 'Unable to read files.' }
}
</script>

<template>
  <VCard
    v-if="ops.actor?.role === 'provider' && ['scheduled', 'in_progress', 'blocked'].includes(request.status)"
    class="mb-5"
  >
    <VCardText>
      <h3 class="text-h5 mb-4">
        Update the job
      </h3><VSelect
        v-model="status"
        label="Update type"
        :items="[{ title: 'Start / continue work', value: 'in_progress' }, { title: 'Report a blocker', value: 'blocked' }, { title: 'Report completion', value: 'completion_pending' }]"
      /><VTextarea
        v-model="note"
        label="Work completed / next steps / blocker"
      /><VFileInput
        v-model="files"
        multiple
        label="Work evidence"
        accept=".pdf,.png,.jpg,.jpeg,.webp,.mp4"
      /><VBtn
        :loading="ops.busy"
        @click="addProgress"
      >
        Save progress update
      </VBtn>
    </VCardText>
  </VCard>
  <VCard
    v-if="ops.actor?.role === 'customer' && request.status === 'completion_pending'"
    class="mb-5"
    color="primary"
    variant="tonal"
  >
    <VCardText>
      <h3 class="text-h5 mb-3">
        Review the completed work
      </h3><p>Check the evidence and acknowledge completion, or tell XPro what needs resolving.</p><VTextarea
        v-model="note"
        label="Feedback / unresolved issue"
        rows="2"
      /><div class="d-flex flex-wrap gap-3">
        <VBtn
          :disabled="ops.busy"
          @click="ops.run({ type: 'completion.respond', requestId: request.id, acknowledge: true, note })"
        >
          Acknowledge completion
        </VBtn><VBtn
          variant="outlined"
          :disabled="ops.busy"
          @click="ops.run({ type: 'completion.respond', requestId: request.id, acknowledge: false, note })"
        >
          Report an issue
        </VBtn>
      </div>
    </VCardText>
  </VCard>
  <VCard
    v-for="issue in request.issues"
    :key="issue.id"
    class="mb-5"
  >
    <VCardText>
      <VChip
        color="warning"
        variant="tonal"
        class="mb-3"
      >
        Issue {{ issue.status }}
      </VChip><p>{{ issue.note }}</p><p v-if="issue.resolution">
        Resolution: {{ issue.resolution }}
      </p><template v-if="ops.actor?.role === 'admin' && issue.status === 'open'">
        <VTextarea
          v-model="note"
          label="Resolution agreed"
          rows="2"
        /><VBtn
          :loading="ops.busy"
          @click="ops.run({ type: 'issue.resolve', requestId: request.id, issueId: issue.id, note })"
        >
          Resolve issue
        </VBtn>
      </template>
    </VCardText>
  </VCard>
  <VAlert
    v-if="request.status === 'acknowledged'"
    color="success"
    variant="tonal"
    class="mb-5"
  >
    Customer has acknowledged the work. XPro can now close this request. <VBtn
      v-if="ops.actor?.role === 'admin'"
      :loading="ops.busy"
      class="ms-2"
      @click="ops.run({ type: 'request.close', requestId: request.id })"
    >
      Close request
    </VBtn>
  </VAlert>
  <VAlert
    v-if="request.status === 'closed'"
    color="success"
    variant="tonal"
    class="mb-5"
  >
    This request is completed and closed.
  </VAlert>
  <VCard>
    <VCardText>
      <h3 class="text-h5 mb-4">
        Progress history
      </h3><div
        v-for="update in request.updates"
        :key="update.id"
        class="mb-6"
      >
        <VChip
          size="small"
          color="primary"
          variant="tonal"
          class="mb-2"
        >
          {{ statusLabels[update.status] }}
        </VChip><p class="mb-2">
          {{ update.note }}
        </p><small class="text-medium-emphasis">{{ update.author }} · {{ when(update.createdAt) }}</small><Attachments :files="update.attachments" /><VDivider class="mt-4" />
      </div><p
        v-if="!request.updates.length"
        class="text-medium-emphasis mb-0"
      >
        Work updates and evidence will appear here after the schedule is confirmed.
      </p>
    </VCardText>
  </VCard>
</template>
