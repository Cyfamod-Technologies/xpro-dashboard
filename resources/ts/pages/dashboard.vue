<script setup lang="ts">
import { dashboardApi } from "@/services/xpro-api"
import type { DashboardResponse } from "@/types/domain"
import { useAuthStore } from "@/stores/auth"
import { useRemoteData } from "@/composables/useRemoteData"

definePage({ meta: { roles: ["manager"] } })

const auth = useAuthStore()
const empty: DashboardResponse = { metrics: [], projects: [], programs: [], submissions: [], notifications: [] }
const { data, loading, error, load } = useRemoteData(dashboardApi.get, empty)
const attentionProjects = computed(() =>
  data.value.projects.filter(project => project.actionRequired || project.approvalStatus === "changes_requested"),
)
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Operations overview"
      :title="`Good morning, ${auth.user?.name.split(' ')[0] ?? 'Manager'}`"
      description="Keep projects moving from reliable source data through review, publication and verified outcomes."
    >
      <template #actions>
        <VBtn variant="outlined" prepend-icon="tabler-file-import" to="/imports"> Import data </VBtn>
        <VBtn prepend-icon="tabler-plus" to="/projects/new"> New project </VBtn>
      </template>
    </PageHeader>

    <VAlert v-if="error" color="error" variant="tonal" class="mb-6">
      {{ error }} <VBtn variant="text" size="small" @click="load"> Try again </VBtn>
    </VAlert>
    <DashboardSkeleton v-if="loading" />

    <template v-else>
      <VRow class="mb-2">
        <VCol v-for="metric in data.metrics" :key="metric.label" cols="12" sm="6" lg="3">
          <MetricCard :metric="metric" />
        </VCol>
      </VRow>

      <VRow>
        <VCol cols="12" lg="8">
          <VCard>
            <VCardItem>
              <VCardTitle>My project portfolio</VCardTitle>
              <VCardSubtitle>Current work across your assigned programs</VCardSubtitle>
              <template #append>
                <VBtn variant="text" to="/my-work" append-icon="tabler-arrow-right"> View my work </VBtn>
              </template>
            </VCardItem>
            <ProjectTable :projects="data.projects.slice(0, 5)" />
          </VCard>
        </VCol>
        <VCol cols="12" lg="4">
          <VCard class="mb-6">
            <VCardItem
              ><VCardTitle>Needs your attention</VCardTitle
              ><VCardSubtitle>Resolve these before the next review</VCardSubtitle></VCardItem
            >
            <VList lines="two">
              <VListItem v-for="project in attentionProjects" :key="project.id" :to="`/projects/${project.id}`">
                <template #prepend>
                  <VAvatar color="warning" variant="tonal" rounded>
                    <VIcon icon="tabler-alert-triangle" />
                  </VAvatar>
                </template>
                <VListItemTitle>{{ project.title }}</VListItemTitle>
                <VListItemSubtitle
                  >{{ project.state }} · {{ project.trackingStatus.replaceAll("_", " ") }}</VListItemSubtitle
                >
              </VListItem>
            </VList>
          </VCard>
          <VCard>
            <VCardItem
              ><VCardTitle>Program coverage</VCardTitle
              ><VCardSubtitle>Allocation represented in this prototype</VCardSubtitle></VCardItem
            >
            <VCardText>
              <div v-for="program in data.programs" :key="program.id" class="mb-5">
                <div class="d-flex justify-space-between mb-2">
                  <span class="font-weight-semibold">{{ program.name }}</span
                  ><span class="text-caption">{{ program.projectCount }} projects</span>
                </div>
                <VProgressLinear
                  :model-value="Math.min(100, program.projectCount * 12)"
                  color="secondary"
                  rounded
                  height="8"
                />
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>
    </template>
  </div>
</template>
