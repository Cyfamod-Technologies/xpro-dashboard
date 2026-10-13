<script setup lang="ts">
import type { TrackedProject } from '@/types/domain'

withDefaults(defineProps<{
  projects: TrackedProject[]
  viewer?: boolean
}>(), {
  viewer: false,
})

const formatMoney = (amount: number, currency: string) => new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency,
  notation: 'compact',
  maximumFractionDigits: 1,
}).format(amount)
</script>

<template>
  <VTable class="text-no-wrap">
    <thead>
      <tr>
        <th>Project</th>
        <th>Location</th>
        <th>Allocation</th>
        <th>Tracking status</th>
        <th v-if="!viewer">
          Approval
        </th>
        <th aria-label="Open project" />
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="project in projects"
        :key="project.id"
      >
        <td style="min-inline-size: 18rem;">
          <div class="font-weight-semibold text-high-emphasis">
            {{ project.title }}
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ project.programName }} · {{ project.fiscalYear }}
          </div>
        </td>
        <td>
          {{ project.state }}, {{ project.lga }}
        </td>
        <td class="font-weight-semibold">
          {{ formatMoney(project.allocation, project.currency) }}
        </td>
        <td>
          <ProjectStatusChip :status="project.trackingStatus" />
        </td>
        <td v-if="!viewer">
          <ProjectStatusChip :status="project.approvalStatus" />
        </td>
        <td>
          <VBtn
            :to="viewer ? `/explore/projects/${project.publicId}` : `/projects/${project.id}`"
            icon="tabler-arrow-up-right"
            size="small"
            variant="text"
            aria-label="Open project"
          />
        </td>
      </tr>
    </tbody>
  </VTable>
</template>
