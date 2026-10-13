<script setup lang="ts">
import { useOperationsStore } from '@/stores/operations'
import type { ServiceRequest } from '@/features/operations/types'
import { money, statusLabels, when } from '@/features/operations/types'
import { currentAssignment } from '@/features/operations/workflow'
import Attachments from '@/features/operations/Attachments.vue'
import QuotePanel from '@/features/operations/QuotePanel.vue'
import SchedulePanel from '@/features/operations/SchedulePanel.vue'
import ProgressPanel from '@/features/operations/ProgressPanel.vue'
import ThreadPanel from '@/features/operations/ThreadPanel.vue'

const props = defineProps<{ request: ServiceRequest; initialPanel?: string }>()
const ops = useOperationsStore()
const panel = ref(props.initialPanel ?? 'overview')
const note = ref('')
const providerId = ref('')
const cancelDialog = ref(false)
const assignment = computed(() => currentAssignment(props.request))
const eligible = computed(() => ops.state.providers.filter(item => item.verification === 'approved' && item.available && item.services.includes(props.request.service)))
const providerName = (id: string) => ops.state.providers.find(item => item.id === id)?.name ?? 'Provider'
const active = computed(() => !['cancelled', 'closed', 'acknowledged'].includes(props.request.status))

const cancel = async () => {
  if (await ops.run({ type: 'request.cancel', requestId: props.request.id, note: note.value }))
    cancelDialog.value = false
}
</script>

<template>
  <VCard class="mb-5">
    <VCardText>
      <div class="d-flex justify-space-between align-start flex-wrap gap-3">
        <div>
          <div class="text-body-2 text-medium-emphasis mb-2">
            {{ request.id }} · {{ request.service }}
          </div><h2 class="text-h4 mb-2">
            {{ request.title }}
          </h2><p class="text-medium-emphasis mb-0">
            {{ request.city }} · Submitted {{ when(request.createdAt) }}
          </p>
        </div><VChip
          color="primary"
          variant="tonal"
        >
          {{ statusLabels[request.status] }}
        </VChip>
      </div>
    </VCardText>
  </VCard>
  <VTabs
    v-model="panel"
    show-arrows
    class="mb-5"
  >
    <VTab value="overview">
      Brief & dispatch
    </VTab><VTab value="quotes">
      Quotes
    </VTab><VTab value="schedule">
      Schedule
    </VTab><VTab value="progress">
      Progress & completion
    </VTab><VTab value="messages">
      Messages
    </VTab>
  </VTabs>
  <div v-if="panel === 'overview'">
    <VRow>
      <VCol
        cols="12"
        md="7"
      >
        <VCard>
          <VCardText>
            <h3 class="text-h5 mb-4">
              Request brief
            </h3><p class="text-body-1 brief-copy">
              {{ request.description }}
            </p><dl class="details">
              <dt>Site address</dt><dd>{{ request.address }}</dd><dt>Contact</dt><dd>{{ request.customer }} · {{ request.phone }}</dd><dt>Indicative budget</dt><dd>{{ request.budget ? money(request.budget) : 'To be confirmed' }}</dd><dt>Preferred start</dt><dd>{{ request.startDate || 'Flexible' }}</dd><template
                v-for="(value, key) in request.details"
                :key="key"
              >
                <dt>{{ key === 'preferredProviderId' ? 'Preferred provider' : String(key).replace(/([A-Z])/g, ' $1') }}</dt><dd>{{ key === 'preferredProviderId' ? providerName(value) : value }}</dd>
              </template>
            </dl><Attachments :files="request.attachments" />
          </VCardText>
        </VCard>
      </VCol><VCol
        cols="12"
        md="5"
      >
        <VCard class="mb-5">
          <VCardText>
            <h3 class="text-h5 mb-4">
              Provider assignment
            </h3><template v-if="assignment">
              <p>{{ providerName(assignment.providerId) }} · {{ assignment.status }}</p><p class="text-body-2">
                {{ assignment.note }}
              </p>
            </template><p
              v-else
              class="text-medium-emphasis"
            >
              XPro is reviewing the brief and coordinating a provider.
            </p>
            <template v-if="ops.actor?.role === 'admin' && active">
              <VSelect
                v-if="!assignment"
                v-model="providerId"
                :items="eligible.map(item => ({ title: `${item.name} · ${item.city}`, value: item.id }))"
                label="Approved, available provider"
              /><VTextarea
                v-model="note"
                label="Dispatch / review note"
                rows="2"
              /><VBtn
                v-if="!assignment"
                :disabled="!providerId || ops.busy"
                @click="ops.run({ type: 'assignment.offer', requestId: request.id, providerId, note })"
              >
                Send assignment offer
              </VBtn><VBtn
                v-else
                variant="outlined"
                color="warning"
                :disabled="ops.busy"
                @click="ops.run({ type: 'assignment.withdraw', requestId: request.id, assignmentId: assignment.id, note })"
              >
                Withdraw assignment
              </VBtn>
              <div
                v-if="['submitted', 'under_review'].includes(request.status)"
                class="d-flex flex-wrap gap-2 mt-4"
              >
                <VBtn
                  variant="outlined"
                  :disabled="ops.busy"
                  @click="ops.run({ type: 'request.review', requestId: request.id, clarify: false, note })"
                >
                  Review intake
                </VBtn><VBtn
                  variant="text"
                  :disabled="ops.busy"
                  @click="ops.run({ type: 'request.review', requestId: request.id, clarify: true, note })"
                >
                  Ask for clarification
                </VBtn>
              </div>
              <div class="mt-4">
                <VBtn
                  size="small"
                  variant="text"
                  color="warning"
                  @click="ops.run({ type: 'request.flag', requestId: request.id, note })"
                >
                  Flag for attention
                </VBtn><VBtn
                  v-if="request.flag"
                  size="small"
                  variant="text"
                  @click="ops.run({ type: 'request.flag', requestId: request.id, note: '' })"
                >
                  Clear flag
                </VBtn><p
                  v-if="request.flag"
                  class="text-body-2 mt-2"
                >
                  {{ request.flag }}
                </p>
              </div>
            </template>
            <template v-if="ops.actor?.role === 'provider' && assignment?.status === 'offered'">
              <VTextarea
                v-model="note"
                label="Response / reason for declining"
                rows="2"
              /><div class="d-flex flex-wrap gap-2">
                <VBtn
                  :disabled="ops.busy"
                  @click="ops.run({ type: 'assignment.respond', requestId: request.id, assignmentId: assignment.id, accept: true, note })"
                >
                  Accept job
                </VBtn><VBtn
                  variant="outlined"
                  color="warning"
                  :disabled="ops.busy"
                  @click="ops.run({ type: 'assignment.respond', requestId: request.id, assignmentId: assignment.id, accept: false, note })"
                >
                  Decline job
                </VBtn>
              </div>
            </template>
          </VCardText>
        </VCard>
        <VCard v-if="request.assignments.length && ops.actor?.role !== 'customer'">
          <VCardText>
            <h3 class="text-h6 mb-3">
              Assignment history
            </h3><p
              v-for="item in request.assignments"
              :key="item.id"
              class="text-body-2"
            >
              {{ providerName(item.providerId) }} · {{ item.status }}<br>{{ item.response || item.note }}
            </p>
          </VCardText>
        </VCard>
        <VBtn
          v-if="active && ops.actor?.role !== 'provider'"
          variant="text"
          color="error"
          class="mt-5"
          @click="note = ''; cancelDialog = true"
        >
          Cancel request
        </VBtn>
      </VCol>
    </VRow>
  </div>
  <QuotePanel
    v-else-if="panel === 'quotes'"
    :request="request"
  />
  <SchedulePanel
    v-else-if="panel === 'schedule'"
    :request="request"
  />
  <ProgressPanel
    v-else-if="panel === 'progress'"
    :request="request"
  />
  <ThreadPanel
    v-else-if="panel === 'messages'"
    :request="request"
  />
  <VDialog
    v-model="cancelDialog"
    max-width="480"
  >
    <VCard>
      <VCardText>
        <h3 class="text-h5 mb-3">
          Cancel this request?
        </h3><p>This will withdraw the current assignment and cancel its schedules.</p><VTextarea
          v-model="note"
          label="Reason for cancellation"
        /><VAlert
          v-if="ops.error"
          variant="tonal"
          color="error"
          class="mb-4"
        >
          {{ ops.error }}
        </VAlert><div class="d-flex justify-end gap-2">
          <VBtn
            variant="text"
            @click="cancelDialog = false"
          >
            Keep request
          </VBtn><VBtn
            color="error"
            :loading="ops.busy"
            @click="cancel"
          >
            Confirm cancellation
          </VBtn>
        </div>
      </VCardText>
    </VCard>
  </VDialog>
</template>

<style scoped>
.brief-copy { white-space: pre-wrap; overflow-wrap: anywhere; }
.details dt { font-size: 0.8rem; opacity: 0.7; text-transform: capitalize; margin-block-start: 1rem; }
.details dd { margin-block-start: 0.25rem; overflow-wrap: anywhere; }
</style>
