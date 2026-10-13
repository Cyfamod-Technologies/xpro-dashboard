<script setup lang="ts">
import { useOperationsStore } from '@/stores/operations'
import type { ServiceRequest } from '@/features/operations/types'
import { statusLabels, when } from '@/features/operations/types'
import { visibleUpdates } from '@/features/operations/workflow'
import { prepareFiles } from '@/features/operations/files'
import Attachments from '@/features/operations/Attachments.vue'

const props = defineProps<{ request: ServiceRequest }>()
const ops = useOperationsStore()
const note = ref('')
const status = ref<'in_progress' | 'blocked' | 'completion_pending'>('in_progress')
const files = ref<File[]>([])
const rejectingId = ref('')
const rejectNote = ref('')
const updates = computed(() => ops.actor ? visibleUpdates(props.request, ops.actor) : [])
const hasPending = computed(() => ops.actor?.role === 'provider' && props.request.updates.some(update => update.authorId === ops.actor?.id && update.review.state === 'pending'))
const reviewLabels = { pending: 'Pending review', approved: 'Approved', rejected: 'Not approved' } as const
const reviewColors = { pending: 'warning', approved: 'success', rejected: 'error' } as const

const decide = async (updateId: string, approve: boolean) => {
  if (await ops.run({ type: 'progress.review', requestId: props.request.id, updateId, approve, note: approve ? '' : rejectNote.value })) {
    rejectingId.value = ''
    rejectNote.value = ''
  }
}

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
      </h3><VAlert
        v-if="hasPending"
        variant="tonal"
        color="info"
        class="mb-4"
      >
        Waiting for XPro to review your previous update.
      </VAlert><VSelect
        v-model="status"
        :disabled="hasPending"
        label="Update type"
        :items="[{ title: 'Start / continue work', value: 'in_progress' }, { title: 'Report a blocker', value: 'blocked' }, { title: 'Report completion', value: 'completion_pending' }]"
      /><VTextarea
        v-model="note"
        :disabled="hasPending"
        label="Work completed / next steps / blocker"
      /><VFileInput
        v-model="files"
        :disabled="hasPending"
        multiple
        label="Work evidence"
        accept=".pdf,.png,.jpg,.jpeg,.webp,.mp4"
      /><VBtn
        :loading="ops.busy"
        :disabled="hasPending"
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
      </p><template v-if="ops.can('issue.resolve') && issue.status === 'open'">
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
      v-if="ops.can('request.close')"
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
        v-for="update in updates"
        :key="update.id"
        class="mb-6"
      >
        <div class="d-flex flex-wrap gap-2 mb-2">
          <VChip
            size="small"
            color="primary"
            variant="tonal"
          >
            {{ statusLabels[update.status] }}
          </VChip><VChip
            v-if="ops.actor?.role !== 'customer'"
            size="small"
            :color="reviewColors[update.review.state]"
            variant="tonal"
          >
            {{ reviewLabels[update.review.state] }}
          </VChip>
        </div><p class="mb-2">
          {{ update.note }}
        </p><p
          v-if="update.review.state === 'rejected' && ops.actor?.role !== 'customer'"
          class="text-body-2 text-error mb-2"
        >
          XPro: {{ update.review.note }}
        </p><small class="text-medium-emphasis">{{ update.author }} · {{ when(update.createdAt) }}</small><Attachments :files="update.attachments" />
        <template v-if="ops.actor?.role === 'admin' && update.review.state === 'pending' && ops.can('progress.review')">
          <VTextarea
            v-if="rejectingId === update.id"
            v-model="rejectNote"
            class="mt-3"
            label="Reason for not approving (shared with the provider)"
            rows="2"
          />
          <div class="d-flex flex-wrap gap-2 mt-3">
            <template v-if="rejectingId !== update.id">
              <VBtn
                size="small"
                :disabled="ops.busy"
                @click="decide(update.id, true)"
              >
                Approve
              </VBtn><VBtn
                size="small"
                variant="outlined"
                color="warning"
                :disabled="ops.busy"
                @click="rejectingId = update.id; rejectNote = ''"
              >
                Reject
              </VBtn>
            </template>
            <template v-else>
              <VBtn
                size="small"
                color="warning"
                :disabled="ops.busy"
                @click="decide(update.id, false)"
              >
                Confirm rejection
              </VBtn><VBtn
                size="small"
                variant="text"
                @click="rejectingId = ''"
              >
                Cancel
              </VBtn>
            </template>
          </div>
        </template><VDivider class="mt-4" />
      </div><p
        v-if="!updates.length"
        class="text-medium-emphasis mb-0"
      >
        Work updates and evidence will appear here after the schedule is confirmed.
      </p>
    </VCardText>
  </VCard>
</template>
