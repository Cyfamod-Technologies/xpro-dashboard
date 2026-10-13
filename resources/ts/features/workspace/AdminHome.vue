<script setup lang="ts">
const areas = [
  { title: 'Request intake', icon: 'tabler-clipboard-list', description: 'Review customer briefs and identify the next action.', to: '/admin/requests', action: 'Open requests' },
  { title: 'Provider review', icon: 'tabler-shield-check', description: 'Review profiles and verification documents before dispatch.', to: '/admin/providers', action: 'Open providers' },
  { title: 'Dispatch', icon: 'tabler-route', description: 'Coordinate assignments, provider responses and schedules.', to: '/admin/dispatch', action: 'Open dispatch' },
]
</script>

<template>
  <div>
    <div class="d-flex justify-space-between align-start flex-wrap gap-4 mb-6">
      <div>
        <div class="text-overline text-primary mb-2">
          ADMIN / DISPATCH
        </div><h1 class="text-h3 mb-2">
          Your operations workspace.
        </h1><p class="text-body-1 text-medium-emphasis mb-0">
          Coordinate requests, verified providers and the work ahead.
        </p>
      </div>
      <VBtn
        to="/admin/requests"
        prepend-icon="tabler-arrow-right"
      >
        Open intake queue
      </VBtn>
    </div>
    <VRow class="mb-6">
      <VCol
        v-for="area in areas"
        :key="area.title"
        cols="12"
        md="4"
      >
        <VCard class="h-100">
          <VCardText class="pa-6">
            <VAvatar
              color="primary"
              variant="tonal"
              class="mb-4"
            >
              <VIcon :icon="area.icon" />
            </VAvatar><h2 class="text-h5 mb-3">
              {{ area.title }}
            </h2><p class="text-body-1 text-medium-emphasis mb-5">
              {{ area.description }}
            </p><VBtn
              :to="area.to"
              variant="outlined"
              block
            >
              {{ area.action }}
            </VBtn>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
    <VCard
      color="secondary"
      variant="tonal"
      class="mb-6"
    >
      <VCardText class="pa-6 pa-sm-8">
        <div class="d-flex align-center gap-3 mb-4">
          <VIcon icon="tabler-list-check" /><h2 class="text-h5">
            Keep every handoff connected.
          </h2>
        </div><p class="text-body-1 mb-0">
          Intake, review, provider selection, quotes, scheduling and completion share one request history.
        </p>
      </VCardText>
    </VCard>
    <VCard>
      <VCardText class="pa-6 pa-sm-8">
        <div class="d-flex justify-space-between align-center flex-wrap gap-3 mb-6">
          <h2 class="text-h5">
            Recent activity
          </h2><VBtn
            to="/admin/audit"
            variant="text"
          >
            View history
          </VBtn>
        </div><div class="text-center py-6">
          <VIcon
            icon="tabler-history"
            color="secondary"
            size="40"
            class="mb-4"
          /><h3 class="text-h6 mb-2">
            No activity yet
          </h3><p class="text-body-1 text-medium-emphasis mb-0">
            Request reviews, quote decisions and dispatch actions will appear here.
          </p>
        </div>
      </VCardText>
    </VCard>
  </div>
</template>
