<script setup lang="ts">
import { experienceLabel, initials, requestLocation } from '@/features/discovery/provider-utils'
import Attachments from '@/features/operations/Attachments.vue'
import { useOperationsStore } from '@/stores/operations'

definePage({ meta: { public: true, publicSite: true } })

const route = useRoute()
const ops = useOperationsStore()
const provider = computed(() => ops.publicProviders.find(item => item.id === ('id' in route.params ? route.params.id : undefined)))
</script>

<template>
  <div class="xp-container py-8">
    <VBtn
      to="/providers"
      variant="text"
      prepend-icon="tabler-arrow-left"
      class="mb-5"
    >
      All providers
    </VBtn>
    <div
      v-if="provider"
      class="profile-layout"
    >
      <div class="d-flex flex-column gap-6 min-w-0">
        <VCard>
          <VCardText class="d-flex flex-wrap gap-5 pa-6">
            <VAvatar
              color="primary"
              variant="tonal"
              size="96"
              rounded="lg"
            >
              <span class="text-h3">{{ initials(provider.name) }}</span>
            </VAvatar>
            <div class="min-w-0">
              <div class="d-flex flex-wrap align-center gap-2 mb-2">
                <h1 class="text-h4">
                  {{ provider.name }}
                </h1>
                <VChip
                  color="success"
                  variant="tonal"
                  prepend-icon="tabler-shield-check"
                >
                  Verified
                </VChip>
              </div>
              <p class="text-body-1 text-medium-emphasis mb-3">
                {{ provider.trade }} · {{ provider.city }} · {{ experienceLabel(provider.experience) }} experience
              </p>
              <div class="d-flex flex-wrap align-center gap-3">
                <VChip
                  variant="tonal"
                  :color="provider.available ? 'primary' : 'secondary'"
                >
                  {{ provider.available ? 'Available for requests' : 'Currently unavailable' }}
                </VChip>
                <span class="d-flex align-center gap-1 text-body-2">
                  <VIcon
                    icon="tabler-star-filled"
                    color="warning"
                    size="18"
                  />
                  <strong>{{ provider.reviewCount ? provider.rating.toFixed(1) : 'New provider' }}</strong>
                  <span class="text-medium-emphasis">{{ provider.reviewCount }} sample reviews</span>
                </span>
              </div>
            </div>
          </VCardText>
        </VCard>

        <VCard>
          <VCardText class="pa-6">
            <h2 class="text-h5 mb-3">
              About
            </h2>
            <p class="text-body-1 mb-0">
              {{ provider.bio }}
            </p>
          </VCardText>
        </VCard>

        <VCard>
          <VCardText class="pa-6">
            <h2 class="text-h5 mb-4">
              Services offered
            </h2>
            <div class="d-flex flex-column gap-3">
              <div
                v-for="service in provider.services"
                :key="service"
                class="service-row"
              >
                <span class="d-flex align-center gap-2">
                  <VIcon
                    icon="tabler-circle-check"
                    color="primary"
                    size="20"
                  />
                  <VChip
                    color="primary"
                    variant="tonal"
                  >{{ service }}</VChip>
                </span>
                <VBtn
                  :to="{ path: '/request', query: { service, provider: provider.id } }"
                  variant="outlined"
                  size="small"
                  :aria-label="`Request ${service} from ${provider.name}`"
                >
                  Request
                </VBtn>
              </div>
            </div>
          </VCardText>
        </VCard>

        <VCard>
          <VCardText class="pa-6">
            <h2 class="text-h5 mb-4">
              Public portfolio
            </h2>
            <Attachments :files="provider.portfolio" />
            <p
              v-if="!provider.portfolio.length"
              class="text-medium-emphasis mb-0"
            >
              This provider has not added portfolio samples yet.
            </p>
          </VCardText>
        </VCard>
      </div>

      <aside
        aria-label="Request this provider"
        class="profile-aside"
      >
        <VCard>
          <VCardText class="pa-6">
            <h2 class="text-h5 mb-4">
              Request {{ provider.name }}
            </h2>
            <dl class="summary mb-5">
              <dt>Trade</dt>
              <dd>{{ provider.trade }}</dd>
              <dt>Area</dt>
              <dd>{{ provider.city }}</dd>
              <dt>Experience</dt>
              <dd>{{ experienceLabel(provider.experience) }}</dd>
              <dt>Quote</dt>
              <dd>Free · via XPro</dd>
            </dl>
            <VBtn
              :to="requestLocation(provider)"
              block
              size="large"
            >
              Request a service
            </VBtn>
            <p class="text-body-2 text-medium-emphasis mt-3 mb-0">
              Your brief includes this provider as a preference. XPro confirms availability and assigns the right provider.
            </p>
          </VCardText>
        </VCard>
      </aside>
    </div>
    <VAlert
      v-else
      color="info"
      variant="tonal"
    >
      This public provider profile is unavailable. Browse the directory for other providers.
    </VAlert>
  </div>
</template>

<style lang="scss" scoped>
.profile-layout {
  align-items: start;
  display: grid;
  gap: 24px;
  grid-template-columns: minmax(0, 1fr) 340px;
}

.profile-aside {
  inset-block-start: 24px;
  position: sticky;
}

.service-row {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: space-between;
}

.summary {
  display: grid;
  font-size: 0.875rem;
  gap: 10px 16px;
  grid-template-columns: auto 1fr;

  dt { color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity)); }
  dd { font-weight: 500; margin: 0; text-align: end; }
}

@media (max-width: 960px) {
  .profile-layout { grid-template-columns: minmax(0, 1fr); }
  .profile-aside { position: static; }
}
</style>
