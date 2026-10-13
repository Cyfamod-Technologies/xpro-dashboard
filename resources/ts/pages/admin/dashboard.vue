<script setup lang="ts">
import { dashboardApi } from '@/services/xpro-api'
import type { DashboardResponse } from '@/types/domain'
import { useRemoteData } from '@/composables/useRemoteData'

definePage({ meta: { roles: ['super_admin'] } })

const empty: DashboardResponse = { metrics: [], projects: [], programs: [], submissions: [], notifications: [] }
const { data, loading, error, load } = useRemoteData(dashboardApi.get, empty)
const typeLabel = (value: string) => value.replaceAll('_', ' ').replace(/^./, char => char.toUpperCase())
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Administration"
      title="Publication control centre"
      description="Review operational submissions, protect the public data boundary and keep access accountable."
    >
      <template #actions>
        <VBtn
          variant="outlined"
          prepend-icon="tabler-user-plus"
          to="/admin/users"
        >
          Invite manager
        </VBtn><VBtn
          prepend-icon="tabler-clipboard-check"
          to="/approvals"
        >
          Open approval queue
        </VBtn>
      </template>
    </PageHeader>
    <VAlert
      v-if="error"
      color="error"
      variant="tonal"
      class="mb-6"
    >
      {{ error }} <VBtn
        variant="text"
        @click="load"
      >
        Retry
      </VBtn>
    </VAlert>
    <DashboardSkeleton v-if="loading" />
    <template v-else>
      <VRow class="mb-2">
        <VCol
          v-for="metric in data.metrics"
          :key="metric.label"
          cols="12"
          sm="6"
          lg="3"
        >
          <MetricCard :metric="metric" />
        </VCol>
      </VRow>
      <VRow>
        <VCol
          cols="12"
          lg="7"
        >
          <VCard>
            <VCardItem>
              <VCardTitle>Approval queue</VCardTitle><VCardSubtitle>Oldest and highest-attention submissions first</VCardSubtitle><template #append>
                <VBtn
                  to="/approvals"
                  variant="text"
                >
                  View all
                </VBtn>
              </template>
            </VCardItem>
            <VTable>
              <thead><tr><th>Submission</th><th>Manager</th><th>Changes</th><th>Status</th><th /></tr></thead>
              <tbody>
                <tr
                  v-for="submission in data.submissions"
                  :key="submission.id"
                >
                  <td>
                    <div class="font-weight-semibold">
                      {{ submission.projectTitle }}
                    </div><div class="text-caption">
                      {{ typeLabel(submission.type) }}
                    </div>
                  </td>
                  <td>{{ submission.managerName }}</td>
                  <td>{{ submission.changedFields }} fields</td>
                  <td>
                    <VChip
                      :color="submission.risk === 'attention' ? 'warning' : 'info'"
                      size="small"
                      variant="tonal"
                    >
                      {{ typeLabel(submission.status) }}
                    </VChip>
                  </td>
                  <td>
                    <VBtn
                      :to="`/approvals?submission=${submission.id}`"
                      icon="tabler-arrow-right"
                      size="small"
                      variant="text"
                    />
                  </td>
                </tr>
              </tbody>
            </VTable>
          </VCard>
        </VCol>
        <VCol
          cols="12"
          lg="5"
        >
          <VCard class="mb-6 xpro-soft-surface">
            <VCardText class="pa-6">
              <div class="xpro-kicker mb-2">
                Publication rule
              </div>
              <h3 class="text-h5 mb-3">
                Drafts never replace public data
              </h3>
              <p class="text-body-2 mb-5">
                Every approved update creates a traceable version while the last approved record remains available to viewers.
              </p>
              <VBtn
                color="primary"
                variant="outlined"
                to="/approvals"
              >
                Review submissions
              </VBtn>
            </VCardText>
          </VCard>
          <VCard>
            <VCardItem><VCardTitle>Recent system notices</VCardTitle></VCardItem>
            <VList lines="two">
              <VListItem
                v-for="note in data.notifications"
                :key="note.id"
                :title="note.title"
                :subtitle="note.message"
              >
                <template #prepend>
                  <VIcon
                    :color="note.tone"
                    icon="tabler-bell"
                  />
                </template>
              </VListItem>
            </VList>
          </VCard>
        </VCol>
      </VRow>
    </template>
  </div>
</template>
