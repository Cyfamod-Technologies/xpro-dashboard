<script setup lang="ts">
import { useOperationsStore } from '@/stores/operations'
import type { ServiceRequest } from '@/features/operations/types'
import { when } from '@/features/operations/types'
import { currentSchedule, publicQuote } from '@/features/operations/workflow'

const props = defineProps<{ request: ServiceRequest }>()
const ops = useOperationsStore()
const startAt = ref('')
const note = ref('')
const latest = computed(() => currentSchedule(props.request))
const responseRole = computed(() => ops.actor?.role === 'provider' ? 'provider' : 'customer')
const canPropose = computed(() => ops.actor?.role === 'admin' && ops.can('schedule.manage') && publicQuote(props.request)?.status === 'accepted' && !['in_progress', 'blocked', 'completion_pending', 'acknowledged', 'closed', 'cancelled'].includes(props.request.status))
</script>

<template>
  <VAlert
    variant="tonal"
    color="info"
    class="mb-5"
  >
    Appointments use West Africa Time (WAT). A schedule is confirmed when both customer and provider accept. A new proposal requires fresh confirmation.
  </VAlert>
  <VCard
    v-if="canPropose"
    class="mb-5"
  >
    <VCardText>
      <h3 class="text-h5 mb-4">
        {{ latest ? 'Propose a new date' : 'Propose a schedule' }}
      </h3><VTextField
        v-model="startAt"
        type="datetime-local"
        label="Start date and time (WAT)"
      /><VTextarea
        v-model="note"
        label="Site visit / delivery instructions"
        rows="2"
      /><VBtn
        :loading="ops.busy"
        @click="ops.run({ type: 'schedule.propose', requestId: request.id, startAt: startAt ? new Date(`${startAt}:00+01:00`).toISOString() : '', note })"
      >
        Send schedule proposal
      </VBtn>
    </VCardText>
  </VCard>
  <VCard
    v-for="schedule in [...request.schedules].reverse()"
    :key="schedule.id"
    class="mb-5"
  >
    <VCardText>
      <div class="d-flex justify-space-between flex-wrap gap-2 mb-3">
        <h3 class="text-h5">
          {{ when(schedule.startAt) }} WAT
        </h3><VChip
          color="primary"
          variant="tonal"
        >
          {{ schedule.status.replaceAll('_', ' ') }}
        </VChip>
      </div><p>{{ schedule.note }}</p><p class="text-body-2">
        Customer: {{ schedule.customer.replaceAll('_', ' ') }} · Provider: {{ schedule.provider.replaceAll('_', ' ') }}
      </p><p
        v-for="response in schedule.responses"
        :key="response"
        class="text-body-2"
      >
        {{ response }}
      </p>
      <template v-if="ops.actor?.role !== 'admin' && latest?.id === schedule.id && schedule.status === 'proposed' && schedule[responseRole] === 'pending'">
        <VTextarea
          v-model="note"
          label="Note / reason for a date change"
          rows="2"
        /><div class="d-flex flex-wrap gap-3">
          <VBtn
            :disabled="ops.busy"
            @click="ops.run({ type: 'schedule.respond', requestId: request.id, scheduleId: schedule.id, accept: true, note })"
          >
            Confirm schedule
          </VBtn><VBtn
            variant="outlined"
            :disabled="ops.busy"
            @click="ops.run({ type: 'schedule.respond', requestId: request.id, scheduleId: schedule.id, accept: false, note })"
          >
            Request date change
          </VBtn>
        </div>
      </template>
    </VCardText>
  </VCard>
  <p
    v-if="!request.schedules.length"
    class="text-medium-emphasis"
  >
    No schedule yet. XPro proposes a date after you accept a quote.
  </p>
</template>
