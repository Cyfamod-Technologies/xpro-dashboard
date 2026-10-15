<script setup lang="ts">
import { useAuthStore } from "@/stores/auth"
import { dashboardApi } from "@/services/xpro-api"
import type { ApprovalStatus, DashboardResponse, TrackedProject } from "@/types/domain"
import { useRemoteData } from "@/composables/useRemoteData"

definePage({ meta: { roles: ["manager"] } })

type WorkQueue = "attention" | "drafts" | "submitted" | "all"

const auth = useAuthStore()
const empty: DashboardResponse = { metrics: [], projects: [], programs: [], submissions: [], notifications: [] }
const { data, loading, error, load } = useRemoteData(dashboardApi.get, empty)
const selectedQueue = ref<WorkQueue>("attention")
const search = ref("")

const assignedProjects = computed(() => data.value.projects.filter(project => project.managerId === auth.user?.id))

const changesRequestedIds = computed(
  () =>
    new Set(
      data.value.submissions
        .filter(submission => submission.status === "changes_requested")
        .map(submission => submission.projectId),
    ),
)

const queueCounts = computed(() => ({
  attention: assignedProjects.value.filter(
    project => project.actionRequired || changesRequestedIds.value.has(project.id),
  ).length,
  drafts: assignedProjects.value.filter(project => project.approvalStatus === "draft").length,
  submitted: assignedProjects.value.filter(project => project.approvalStatus === "submitted").length,
  all: assignedProjects.value.length,
}))

const matchesQueue = (project: TrackedProject) => {
  if (selectedQueue.value === "attention") return project.actionRequired || changesRequestedIds.value.has(project.id)
  if (selectedQueue.value === "drafts") return project.approvalStatus === "draft"
  if (selectedQueue.value === "submitted") return project.approvalStatus === "submitted"

  return true
}

const filteredProjects = computed(() => {
  const term = search.value.trim().toLowerCase()

  return assignedProjects.value.filter(project => {
    const searchable = `${project.title} ${project.programName} ${project.state} ${project.lga}`.toLowerCase()

    return matchesQueue(project) && (!term || searchable.includes(term))
  })
})

const statusLabel: Record<ApprovalStatus, string> = {
  draft: "Continue draft",
  submitted: "Track review",
  changes_requested: "Resolve feedback",
  rejected: "Review decision",
  published: "Open project",
}

const nextAction = (project: TrackedProject) => {
  if (changesRequestedIds.value.has(project.id)) return "Resolve feedback"
  if (project.actionRequired) return "Record action update"

  return statusLabel[project.approvalStatus]
}
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Manager workspace"
      title="My work"
      description="Focus on assigned records that need your input, then track drafts and submissions through review."
    >
      <template #actions>
        <VBtn variant="outlined" prepend-icon="tabler-folder" to="/projects"> Open project registry </VBtn>
        <VBtn prepend-icon="tabler-plus" to="/projects/new"> New project </VBtn>
      </template>
    </PageHeader>

    <VAlert v-if="error" color="error" variant="tonal" class="mb-6">
      {{ error }} <VBtn variant="text" size="small" @click="load"> Try again </VBtn>
    </VAlert>

    <VCard>
      <VCardText class="pb-0">
        <VTabs v-model="selectedQueue" class="work-tabs">
          <VTab value="attention">
            Needs attention
            <VChip size="x-small" color="warning" class="ms-2">
              {{ queueCounts.attention }}
            </VChip>
          </VTab>
          <VTab value="drafts">
            Drafts
            <VChip size="x-small" class="ms-2">
              {{ queueCounts.drafts }}
            </VChip>
          </VTab>
          <VTab value="submitted">
            Submitted
            <VChip size="x-small" class="ms-2">
              {{ queueCounts.submitted }}
            </VChip>
          </VTab>
          <VTab value="all">
            All assigned
            <VChip size="x-small" class="ms-2">
              {{ queueCounts.all }}
            </VChip>
          </VTab>
        </VTabs>
      </VCardText>

      <VDivider />

      <VCardText>
        <AppTextField
          v-model="search"
          label="Search my work"
          placeholder="Search by project, program, or location"
          prepend-inner-icon="tabler-search"
          clearable
        />
      </VCardText>

      <VSkeletonLoader v-if="loading" type="list-item-avatar-three-line@4" />

      <VList v-else-if="filteredProjects.length" lines="three" class="py-0">
        <template v-for="(project, index) in filteredProjects" :key="project.id">
          <VDivider v-if="index" />
          <VListItem :to="`/projects/${project.id}`" class="py-5 px-6">
            <template #prepend>
              <VAvatar
                :color="project.actionRequired || changesRequestedIds.has(project.id) ? 'warning' : 'primary'"
                variant="tonal"
                rounded="lg"
                size="46"
              >
                <VIcon
                  :icon="
                    project.actionRequired || changesRequestedIds.has(project.id)
                      ? 'tabler-alert-triangle'
                      : 'tabler-file-pencil'
                  "
                />
              </VAvatar>
            </template>

            <VListItemTitle class="font-weight-semibold mb-1">
              {{ project.title }}
            </VListItemTitle>
            <VListItemSubtitle>
              {{ project.programName }} · {{ project.state }}, {{ project.lga }} · {{ project.fiscalYear }}
            </VListItemSubtitle>
            <VListItemSubtitle class="mt-2">
              <ProjectStatusChip :status="project.approvalStatus" />
              <span class="ms-3">{{ project.evidenceCount }} evidence items</span>
            </VListItemSubtitle>

            <template #append>
              <span class="d-none d-sm-flex align-center text-primary font-weight-semibold">
                {{ nextAction(project) }} <VIcon icon="tabler-arrow-right" size="18" class="ms-2" />
              </span>
            </template>
          </VListItem>
        </template>
      </VList>

      <VCardText v-else class="text-center py-12">
        <VAvatar color="success" variant="tonal" size="56" class="mb-4">
          <VIcon icon="tabler-circle-check" size="30" />
        </VAvatar>
        <h2 class="text-h5 mb-2">Nothing in this queue</h2>
        <p class="text-medium-emphasis mb-0">Choose another work state or clear your search.</p>
      </VCardText>
    </VCard>
  </div>
</template>

<style scoped>
.work-tabs {
  margin-inline: -0.5rem;
  overflow-x: auto;
}
</style>
