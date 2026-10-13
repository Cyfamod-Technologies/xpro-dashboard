<script setup lang="ts">
import { serviceLines } from '@/features/workspace/config'
import ProviderCards from '@/features/discovery/ProviderCards.vue'
import { useOperationsStore } from '@/stores/operations'

const ops = useOperationsStore()
</script>

<template>
  <VCard
    color="primary"
    variant="tonal"
    class="pa-6 pa-md-12 mb-10"
  >
    <div class="text-overline mb-3">
      YOUR NEXT PROJECT STARTS HERE
    </div>
    <h1 class="text-h2 mb-5 public-title">
      Find the expertise.<br>Bring your project to life.
    </h1>
    <p class="text-body-1 mb-6 public-copy">
      Explore services and meet XPro providers. From a design brief to site maintenance, share what you need and let XPro coordinate the next step.
    </p>
    <div class="d-flex gap-3 flex-wrap">
      <VBtn
        to="/request"
        size="large"
        prepend-icon="tabler-plus"
      >
        Request a service
      </VBtn><VBtn
        to="/providers"
        size="large"
        variant="outlined"
      >
        Explore providers
      </VBtn>
    </div>
  </VCard>
  <div class="d-flex justify-space-between align-center flex-wrap gap-3 mb-5">
    <h2 class="text-h4">
      One place for your project needs
    </h2><VBtn
      to="/services"
      variant="text"
    >
      All services
    </VBtn>
  </div>
  <VRow class="mb-10">
    <VCol
      v-for="service in serviceLines"
      :key="service.name"
      cols="12"
      sm="6"
      md="4"
    >
      <VCard
        :to="{ path: '/services', query: { service: service.name } }"
        class="h-100"
      >
        <VCardText class="pa-6">
          <VAvatar
            color="primary"
            variant="tonal"
            class="mb-4"
          >
            <VIcon :icon="service.icon" />
          </VAvatar><h3 class="text-h5 mb-2">
            {{ service.name }}
          </h3><p class="text-body-1 text-medium-emphasis">
            {{ service.description }}
          </p><span class="text-primary">Explore service <VIcon
            icon="tabler-arrow-right"
            size="18"
          /></span>
        </VCardText>
      </VCard>
    </VCol>
  </VRow>
  <div class="d-flex justify-space-between align-center flex-wrap gap-3 mb-5">
    <div>
      <h2 class="text-h4 mb-2">
        Meet our providers
      </h2><p class="text-medium-emphasis mb-0">
        Approved profiles, experience and services. Ratings are sample data in this preview.
      </p>
    </div><VBtn
      to="/providers"
      variant="text"
    >
      View all providers
    </VBtn>
  </div>
  <ProviderCards :providers="ops.publicProviders.slice(0, 3)" />
  <VCard
    variant="outlined"
    class="mt-10 pa-6"
  >
    <h2 class="text-h5 mb-4">
      From browsing to getting things done
    </h2><VRow>
      <VCol
        cols="12"
        md="4"
      >
        <strong>01 · Explore</strong><p class="mt-2 mb-0">
          Find a service and view provider profiles.
        </p>
      </VCol><VCol
        cols="12"
        md="4"
      >
        <strong>02 · Share your brief</strong><p class="mt-2 mb-0">
          Tell us about the job. Sign in when you are ready to submit.
        </p>
      </VCol><VCol
        cols="12"
        md="4"
      >
        <strong>03 · Follow your project</strong><p class="mt-2 mb-0">
          Review quotes, confirm dates and track updates in your dashboard.
        </p>
      </VCol>
    </VRow>
  </VCard>
</template>

<style scoped>
.public-copy { max-inline-size: 670px; }
@media (max-width: 600px) { .public-title { font-size: 2rem !important; line-height: 1.25; } }
</style>
