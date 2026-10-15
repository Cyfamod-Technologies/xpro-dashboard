<script setup lang="ts">
import { projectApi } from "@/services/xpro-api"
import type { TrackedProject } from "@/types/domain"
import { useRemoteData } from "@/composables/useRemoteData"

definePage({ meta: { roles: ["super_admin", "manager"] } })

const { data: projects, loading, error, load } = useRemoteData(projectApi.list, [] as TrackedProject[])
const search = ref("")
const status = ref("all")
const statusOptions = [
  { title: "All approval states", value: "all" },
  { title: "Draft", value: "draft" },
  { title: "Submitted", value: "submitted" },
  { title: "Published", value: "published" },
]

const filtered = computed(() =>
  projects.value.filter(project => {
    const matchesSearch = `${project.title} ${project.state} ${project.programName}`
      .toLowerCase()
      .includes(search.value.toLowerCase())

    return matchesSearch && (status.value === "all" || project.approvalStatus === status.value)
  }),
)
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Operational records"
      title="Tracked projects"
      description="Create, verify and submit project information without changing the currently published version."
    >
      <template #actions>
        <VBtn variant="outlined" prepend-icon="tabler-file-import" to="/imports"> Import CSV </VBtn
        ><VBtn prepend-icon="tabler-plus" to="/projects/new"> New project </VBtn>
      </template>
    </PageHeader>
    <VCard>
      <VCardText>
        <VRow>
          <VCol cols="12" md="8">
            <AppTextField
              v-model="search"
              label="Search projects"
              placeholder="Search by project, program or location"
              prepend-inner-icon="tabler-search"
              clearable
            /> </VCol
          ><VCol cols="12" md="4">
            <AppSelect v-model="status" label="Approval state" :items="statusOptions" />
          </VCol>
        </VRow>
      </VCardText>
      <VDivider />
      <VAlert v-if="error" color="error" variant="tonal" class="ma-5">
        {{ error }} <VBtn variant="text" @click="load"> Retry </VBtn>
      </VAlert>
      <VSkeletonLoader v-if="loading" type="table-heading, table-thead, table-tbody" />
      <ProjectTable v-else-if="filtered.length" :projects="filtered" />
      <VCardText v-else class="text-center py-12">
        <VIcon icon="tabler-search-off" size="44" color="secondary" />
        <h3 class="text-h5 mt-4">No projects match</h3>
        <p class="text-medium-emphasis">Change the search or approval filter.</p>
      </VCardText>
    </VCard>
  </div>
</template>
