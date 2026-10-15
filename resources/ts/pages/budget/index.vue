<script setup lang="ts">
import { dashboardApi } from "@/services/xpro-api"
import { useViewerLocationStore } from "@/stores/viewer-location"
import type { DashboardResponse } from "@/types/domain"
import { useRemoteData } from "@/composables/useRemoteData"

definePage({ meta: { roles: ["budget_viewer"] } })

const location = useViewerLocationStore()
const empty: DashboardResponse = { metrics: [], projects: [], programs: [], submissions: [], notifications: [] }
const { data, loading, error, load } = useRemoteData(
  () => dashboardApi.get(location.selectedState, location.selectedCountry),
  empty,
)

watch(() => location.selectedState, load)

const sectors = computed(() => {
  const totals = new Map<string, number>()

  data.value.projects.forEach(project =>
    totals.set(project.sector, (totals.get(project.sector) ?? 0) + project.allocation),
  )

  const maximum = Math.max(...totals.values(), 1)

  return [...totals.entries()].map(([name, amount]) => ({ name, amount, percentage: (amount / maximum) * 100 }))
})

const money = (amount: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount)
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Approved public data"
      title="Budget overview"
      :description="`Explore approved project allocations and verified implementation updates for ${location.selectedState}, Nigeria.`"
    >
      <template #actions>
        <VBtn variant="outlined" prepend-icon="tabler-download"> Export view </VBtn
        ><VBtn prepend-icon="tabler-search" to="/explore"> Explore projects </VBtn>
      </template>
    </PageHeader>
    <VAlert color="info" variant="tonal" class="mb-6" closable>
      Prototype data is shown for interface development and does not represent an official publication.
    </VAlert>
    <VAlert v-if="error" color="error" variant="tonal" class="mb-6">
      {{ error }} <VBtn variant="text" @click="load"> Retry </VBtn>
    </VAlert>
    <DashboardSkeleton v-if="loading" />
    <template v-else>
      <VRow class="mb-2">
        <VCol v-for="metric in data.metrics" :key="metric.label" cols="12" sm="6" lg="3">
          <MetricCard :metric="metric" />
        </VCol>
      </VRow>
      <VRow>
        <VCol cols="12" lg="4">
          <VCard class="h-100">
            <VCardItem
              ><VCardTitle>Allocation by sector</VCardTitle
              ><VCardSubtitle>Approved projects in the current view</VCardSubtitle></VCardItem
            >
            <VCardText>
              <VAlert v-if="!sectors.length" color="info" variant="tonal">
                No published allocation data is available for {{ location.selectedState }} yet.
              </VAlert>
              <div v-for="sector in sectors" :key="sector.name" class="mb-6">
                <div class="d-flex justify-space-between mb-2">
                  <span class="font-weight-semibold">{{ sector.name }}</span
                  ><span>{{ money(sector.amount) }}</span>
                </div>
                <VProgressLinear :model-value="sector.percentage" color="secondary" height="9" rounded />
              </div>
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="12" lg="8">
          <VCard>
            <VCardItem>
              <VCardTitle>Recently verified projects</VCardTitle
              ><VCardSubtitle>Approved allocation and tracking information</VCardSubtitle
              ><template #append>
                <VBtn variant="text" to="/explore"> View all </VBtn>
              </template>
            </VCardItem>
            <ProjectTable v-if="data.projects.length" :projects="data.projects" viewer />
            <VCardText v-else class="text-center py-12">
              <VIcon icon="tabler-map-search" size="44" />
              <h3 class="text-h5 mt-4">No published projects in this state</h3>
              <p class="text-body-2 text-medium-emphasis mt-2 mb-0">
                Choose another state from the sidebar to continue exploring.
              </p>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>
    </template>
  </div>
</template>
