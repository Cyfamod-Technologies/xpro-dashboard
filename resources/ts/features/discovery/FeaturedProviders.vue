<script setup lang="ts">
import { initialsOf, requestLocation } from "@/features/discovery/featured-providers"
import type { FeaturedProviderCard } from "@/features/discovery/featured-providers"
import { featuredProvidersApi } from "@/services/featured-providers-api"

const providers = ref<FeaturedProviderCard[]>([])
const loading = ref(true)
const error = ref("")

const load = async () => {
  loading.value = true
  error.value = ""
  try {
    providers.value = await featuredProvidersApi.list()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Featured providers could not be loaded."
  } finally {
    loading.value = false
  }
}

onMounted(load)

const maxAreas = 3
const maxServices = 3
const areaLine = (provider: FeaturedProviderCard) => {
  const shown = provider.areas.slice(0, maxAreas)
  const more = provider.areas.length - shown.length

  return [provider.city, ...shown].filter(Boolean).join(" · ") + (more > 0 ? ` · +${more} more` : "")
}
const metaLine = (provider: FeaturedProviderCard) => {
  const parts: string[] = []
  if (provider.completedJobs > 0)
    parts.push(`${provider.completedJobs} completed ${provider.completedJobs === 1 ? "job" : "jobs"}`)
  if (provider.experienceYears >= 1) parts.push(`${provider.experienceYears} yrs experience`)

  return parts.join(" · ")
}
</script>

<template>
  <section class="xp-container pt-8">
    <h1 class="text-h4 mb-1">Featured providers</h1>
    <p class="text-body-1 text-medium-emphasis mb-6 intro">
      Verified professionals across Nigeria who deliver XPro jobs. Tell us what you need and XPro assigns the right
      verified provider — you don't need to contact anyone directly.
    </p>
  </section>

  <section class="xp-container pb-4" aria-label="Featured providers" :aria-busy="loading">
    <VRow v-if="loading">
      <VCol v-for="n in 6" :key="n" cols="12" sm="6" lg="4">
        <VCard variant="outlined" class="h-100">
          <VCardText class="d-flex flex-column gap-3">
            <div class="d-flex align-center gap-4">
              <VSkeletonLoader type="avatar" class="skeleton-avatar" />
              <VSkeletonLoader type="heading" class="flex-grow-1" />
            </div>
            <VSkeletonLoader type="text, text, text" />
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <VAlert v-else-if="error" type="error" variant="tonal">
      <div class="d-flex flex-wrap align-center justify-space-between gap-3">
        <span>{{ error }}</span>
        <VBtn variant="outlined" color="error" @click="load"> Retry </VBtn>
      </div>
    </VAlert>

    <VCard v-else-if="!providers.length" variant="outlined">
      <VCardText class="d-flex flex-column align-center text-center gap-3 py-10">
        <VAvatar color="primary" variant="tonal" size="56">
          <VIcon icon="tabler-users" />
        </VAvatar>
        <h2 class="text-h5">Featured providers will appear here soon</h2>
        <p class="text-medium-emphasis mb-0">In the meantime, tell us what you need and XPro will assign a provider.</p>
        <VBtn to="/request" size="large"> Request a service </VBtn>
      </VCardText>
    </VCard>

    <VRow v-else>
      <VCol v-for="provider in providers" :key="provider.id" cols="12" sm="6" lg="4">
        <VCard variant="outlined" class="provider-card h-100">
          <VCardText class="d-flex flex-column gap-3 flex-grow-1">
            <div class="d-flex align-center gap-4">
              <VAvatar color="primary" variant="tonal" size="72" class="flex-shrink-0">
                <VImg
                  v-if="provider.photoUrl"
                  :src="provider.photoUrl"
                  :alt="`Photo of ${provider.displayName}`"
                  cover
                />
                <span v-else class="text-h5" aria-hidden="true">{{ initialsOf(provider.displayName) }}</span>
              </VAvatar>
              <div class="min-w-0">
                <h2 class="text-h6 provider-card__name">
                  {{ provider.displayName }}
                </h2>
                <div class="text-body-2 text-medium-emphasis">
                  {{ provider.trade }}
                </div>
                <VChip
                  size="small"
                  color="success"
                  variant="tonal"
                  prepend-icon="tabler-rosette-discount-check"
                  class="mt-1"
                >
                  Verified by XPro
                </VChip>
              </div>
            </div>
            <div class="text-body-2 text-medium-emphasis d-flex align-start gap-1">
              <VIcon icon="tabler-map-pin" size="16" class="mt-1 flex-shrink-0" />
              <span>{{ areaLine(provider) }}</span>
            </div>
            <p v-if="provider.bio" class="text-body-2 mb-0 provider-card__bio">
              {{ provider.bio }}
            </p>
            <div v-if="metaLine(provider)" class="text-body-2 font-weight-medium">
              {{ metaLine(provider) }}
            </div>
            <div v-if="provider.services.length" class="d-flex flex-wrap gap-1">
              <VChip
                v-for="service in provider.services.slice(0, maxServices)"
                :key="service"
                size="small"
                variant="outlined"
              >
                {{ service }}
              </VChip>
              <VChip v-if="provider.services.length > maxServices" size="small" variant="outlined">
                +{{ provider.services.length - maxServices }}
              </VChip>
            </div>
          </VCardText>
          <VCardActions class="px-4 pb-4 pt-0">
            <VBtn :to="requestLocation(provider)" variant="flat" block> Request a service </VBtn>
          </VCardActions>
        </VCard>
      </VCol>
    </VRow>
  </section>

  <section class="xp-container pt-8 pb-12">
    <VCard color="primary" variant="tonal">
      <VCardText class="on-tonal d-flex flex-wrap justify-space-between align-center gap-3">
        <span class="cta-copy"
          >Need something done? Request a service and XPro will match you with a verified provider.</span
        >
        <VBtn to="/request" size="large"> Request a service </VBtn>
      </VCardText>
    </VCard>
  </section>
</template>

<style lang="scss" scoped>
.intro {
  max-inline-size: 720px;
}

.provider-card {
  display: flex;
  flex-direction: column;

  &__name {
    overflow-wrap: anywhere;
  }

  &__bio {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 4;
    overflow: hidden;
  }
}

.skeleton-avatar {
  flex: 0 0 auto;
}

.min-w-0 {
  min-inline-size: 0;
}

.on-tonal {
  color: rgb(var(--v-theme-on-surface)) !important;
}

.cta-copy {
  max-inline-size: 620px;
}
</style>
