<script setup lang="ts">
import { projectApi } from '@/services/xpro-api'
import { useViewerLocationStore } from '@/stores/viewer-location'
import type { TrackedProject } from '@/types/domain'
import { useRemoteData } from '@/composables/useRemoteData'

definePage({ meta: { roles: ['budget_viewer'] } })

const route = useRoute()
const location = useViewerLocationStore()
const { data: projects, loading, error, load } = useRemoteData(() => projectApi.list(location.selectedState, location.selectedCountry), [] as TrackedProject[])
const search = ref('')
const lga = ref('All LGAs')
const sector = ref('All sectors')

onMounted(() => {
  if (route.query.status === 'action_required')
    sector.value = 'Action required'
})
watch(() => location.selectedState, () => {
  lga.value = 'All LGAs'
  load()
})

const lgaItems = computed(() => ['All LGAs', ...new Set(projects.value.map(item => item.lga))])
const sectorItems = computed(() => ['All sectors', 'Action required', ...new Set(projects.value.map(item => item.sector))])

const filtered = computed(() => projects.value.filter(project => {
  const term = `${project.title} ${project.agency} ${project.programName} ${project.state} ${project.lga}`.toLowerCase()
  const matchesSector = sector.value === 'All sectors' || (sector.value === 'Action required' ? project.actionRequired : project.sector === sector.value)

  return term.includes(search.value.toLowerCase()) && (lga.value === 'All LGAs' || project.lga === lga.value) && matchesSector
}))
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Approved project information"
      title="Explore tracked projects"
      :description="`Search approved projects for ${location.selectedState}, Nigeria, and open the current public version.`"
    >
      <template #actions>
        <VBtn
          variant="outlined"
          prepend-icon="tabler-download"
        >
          Export results
        </VBtn>
      </template>
    </PageHeader>
    <VCard>
      <VCardText>
        <VRow>
          <VCol
            cols="12"
            md="6"
          >
            <AppTextField
              v-model="search"
              label="Search"
              prepend-inner-icon="tabler-search"
              placeholder="Project, agency, program or location"
              clearable
            />
          </VCol><VCol
            cols="12"
            sm="6"
            md="3"
          >
            <AppSelect
              v-model="lga"
              label="LGA"
              :items="lgaItems"
            />
          </VCol><VCol
            cols="12"
            sm="6"
            md="3"
          >
            <AppSelect
              v-model="sector"
              label="Sector or action"
              :items="sectorItems"
            />
          </VCol>
        </VRow><div class="text-caption text-medium-emphasis">
          {{ filtered.length }} approved projects match the current view
        </div>
      </VCardText><VDivider /><VAlert
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
      /><ProjectTable
        v-else-if="filtered.length"
        :projects="filtered"
        viewer
      /><VCardText
        v-else
        class="text-center py-12"
      >
        <VIcon
          icon="tabler-search-off"
          size="44"
        /><h3 class="text-h5 mt-4">
          No approved projects match
        </h3>
      </VCardText>
    </VCard>
  </div>
</template>
