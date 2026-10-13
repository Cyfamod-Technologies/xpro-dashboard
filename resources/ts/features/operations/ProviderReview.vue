<script setup lang="ts">
import { useOperationsStore } from '@/stores/operations'
import Attachments from '@/features/operations/Attachments.vue'

const ops = useOperationsStore()
const search = ref('')
const status = ref('')
const selectedId = ref('')
const note = ref('')
const providers = computed(() => ops.state.providers.filter(item => (!status.value || item.verification === status.value) && `${item.name} ${item.city} ${item.services.join(' ')} ${item.trade}`.toLowerCase().includes(search.value.toLowerCase())))
const selected = computed(() => ops.state.providers.find(item => item.id === selectedId.value))
</script>

<template>
  <VCard class="mb-5">
    <VCardText>
      <VRow>
        <VCol
          cols="12"
          sm="7"
        >
          <VTextField
            v-model="search"
            label="Search name, trade, service or location"
            hide-details
          />
        </VCol><VCol
          cols="12"
          sm="5"
        >
          <VSelect
            v-model="status"
            label="Verification status"
            :items="['pending', 'approved', 'changes_requested', 'rejected']"
            hide-details
            clearable
            @click:clear="status = ''"
          />
        </VCol>
      </VRow>
    </VCardText>
  </VCard>
  <VRow>
    <VCol
      v-for="provider in providers"
      :key="provider.id"
      cols="12"
      md="6"
    >
      <VCard>
        <VCardText>
          <h2 class="text-h5 mb-2">
            {{ provider.name }}
          </h2><p>{{ provider.trade }} · {{ provider.city }}</p><VChip
            color="primary"
            variant="tonal"
            class="mb-3"
          >
            {{ provider.verification.replaceAll('_', ' ') }}
          </VChip><p class="text-body-2">
            {{ provider.services.join(' · ') }}<br>{{ provider.available ? 'Available' : 'Unavailable' }}
          </p><VBtn
            variant="outlined"
            @click="selectedId = provider.id; note = ''"
          >
            Review profile
          </VBtn>
        </VCardText>
      </VCard>
    </VCol>
  </VRow><VAlert
    v-if="!providers.length"
    variant="tonal"
    color="info"
  >
    No providers match this search.
  </VAlert>
  <VDialog
    :model-value="Boolean(selected)"
    max-width="680"
    @update:model-value="!$event && (selectedId = '')"
  >
    <VCard v-if="selected">
      <VCardText>
        <div class="d-flex justify-space-between align-center mb-3">
          <h2 class="text-h5">
            {{ selected.name }}
          </h2><VBtn
            icon="tabler-x"
            variant="text"
            aria-label="Close profile review"
            @click="selectedId = ''"
          />
        </div><p>{{ selected.email }} · {{ selected.phone }}<br>{{ selected.trade }} · {{ selected.city }} · {{ selected.experience }} years</p><p>{{ selected.bio }}</p><p>{{ selected.services.join(' · ') }}</p><h3 class="text-h6 mb-3">
          Private verification documents
        </h3><Attachments :files="selected.documents" /><h3 class="text-h6 mt-5 mb-3">
          Public portfolio
        </h3><Attachments :files="selected.portfolio" /><p
          v-if="selected.reviewNote"
          class="mt-4"
        >
          Last review: {{ selected.reviewNote }}
        </p><template v-if="selected.verification === 'pending' && ops.can('provider.review')">
          <VTextarea
            v-model="note"
            label="Review note / changes required"
            class="mt-5"
          /><VAlert
            v-if="ops.error"
            color="error"
            variant="tonal"
            class="mb-4"
          >
            {{ ops.error }}
          </VAlert><div class="d-flex flex-wrap gap-2">
            <VBtn
              :disabled="ops.busy"
              @click="ops.run({ type: 'provider.review', providerId: selected.id, decision: 'approved', note })"
            >
              Approve provider
            </VBtn><VBtn
              variant="outlined"
              :disabled="ops.busy"
              @click="ops.run({ type: 'provider.review', providerId: selected.id, decision: 'changes_requested', note })"
            >
              Request changes
            </VBtn><VBtn
              variant="text"
              color="error"
              :disabled="ops.busy"
              @click="ops.run({ type: 'provider.review', providerId: selected.id, decision: 'rejected', note })"
            >
              Reject
            </VBtn>
          </div>
        </template>
      </VCardText>
    </VCard>
  </VDialog>
</template>
