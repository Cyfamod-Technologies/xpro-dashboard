<script setup lang="ts">
import { allocationApi, projectApi } from '@/services/xpro-api'
import type { Allocation, TrackedProject } from '@/types/domain'
import { useAuthStore } from '@/stores/auth'
import { useRemoteData } from '@/composables/useRemoteData'

definePage({ meta: { roles: ['super_admin', 'manager', 'budget_viewer'] } })

const auth = useAuthStore()

const {
  data: allocations,
  loading,
  error,
  load,
} = useRemoteData(allocationApi.list, [] as Allocation[])

const projects = ref<TrackedProject[]>([])

onMounted(async () => {
  projects.value = (await projectApi.list()).data
})

const projectName = (id: string) =>
  projects.value.find(project => project.id === id)?.title
  ?? 'Tracked project'

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(
    amount,
  )
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Budget data"
      title="Allocations"
      description="Approved Nigerian state project allocations, kept separate from internal operational finance."
    >
      <template #actions>
        <VBtn
          v-if="auth.user?.role !== 'budget_viewer'"
          prepend-icon="tabler-plus"
        >
          Add allocation
        </VBtn><VBtn
          v-else
          variant="outlined"
          prepend-icon="tabler-download"
        >
          Export
        </VBtn>
      </template>
    </PageHeader>
    <VCard>
      <VAlert
        v-if="error"
        color="error"
        variant="tonal"
        class="ma-5"
      >
        {{ error }} <VBtn
          variant="text"
          @click="load"
        >
          Retry
        </VBtn>
      </VAlert><VSkeletonLoader
        v-if="loading"
        type="table-heading, table-thead, table-tbody"
      /><VTable v-else>
        <thead>
          <tr>
            <th>Project</th>
            <th>Fiscal year</th>
            <th>Agency</th>
            <th>Source</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="allocation in allocations"
            :key="allocation.id"
          >
            <td class="font-weight-semibold">
              {{ projectName(allocation.projectId) }}
            </td>
            <td>{{ allocation.fiscalYear }}</td>
            <td>{{ allocation.agency }}</td>
            <td>{{ allocation.source }}</td>
            <td class="font-weight-bold">
              {{ money(allocation.amount, allocation.currency) }}
            </td>
            <td><ProjectStatusChip :status="allocation.approvalStatus" /></td>
          </tr>
        </tbody>
      </VTable>
    </VCard>
  </div>
</template>
