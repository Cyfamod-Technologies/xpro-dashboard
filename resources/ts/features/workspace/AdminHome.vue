<script setup lang="ts">
const areas = [
  {
    title: "Request intake",
    icon: "tabler-clipboard-list",
    description: "Review customer briefs and identify the next action.",
    to: "/admin/requests",
    action: "Open requests",
  },
  {
    title: "Provider review",
    icon: "tabler-shield-check",
    description: "Review profiles and verification documents before assigning providers.",
    to: "/admin/providers",
    action: "Open providers",
  },
]
</script>

<template>
  <div>
    <div class="d-flex justify-space-between align-start flex-wrap gap-4 mb-6">
      <div>
        <div class="text-overline text-primary mb-2">ADMIN</div>
        <h1 class="text-h3 mb-2">Your operations workspace.</h1>
        <p class="text-body-1 text-medium-emphasis mb-0">Coordinate requests, verified providers and the work ahead.</p>
      </div>
      <VBtn to="/admin/requests" prepend-icon="tabler-arrow-right"> Open intake queue </VBtn>
    </div>
    <VRow class="mb-6">
      <VCol v-for="area in areas" :key="area.title" cols="12" md="4">
        <VCard class="h-100">
          <VCardText class="pa-6">
            <VAvatar color="primary" variant="tonal" class="mb-4">
              <VIcon :icon="area.icon" />
            </VAvatar>
            <h2 class="text-h5 mb-3">
              {{ area.title }}
            </h2>
            <p class="text-body-1 text-medium-emphasis mb-5">
              {{ area.description }}
            </p>
            <VBtn :to="area.to" variant="outlined" block>
              {{ area.action }}
            </VBtn>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
    <VCard color="secondary" variant="tonal" class="mb-6">
      <VCardText class="pa-6 pa-sm-8">
        <div class="d-flex align-center gap-3 mb-4">
          <VIcon icon="tabler-list-check" />
          <h2 class="text-h5">Keep every handoff connected.</h2>
        </div>
        <p class="text-body-1 mb-0">
          Request intake, provider assignment and customer conversations share one request record.
        </p>
      </VCardText>
    </VCard>
  </div>
</template>
