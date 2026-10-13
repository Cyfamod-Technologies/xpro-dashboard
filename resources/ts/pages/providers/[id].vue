<script setup lang="ts">
import { useOperationsStore } from '@/stores/operations'
import Attachments from '@/features/operations/Attachments.vue'

definePage({ meta: { public: true, publicSite: true } })

const route = useRoute()
const ops = useOperationsStore()
const provider = computed(() => ops.publicProviders.find(item => item.id === ('id' in route.params ? route.params.id : undefined)))
</script>

<template>
  <VBtn
    to="/providers"
    variant="text"
    prepend-icon="tabler-arrow-left"
    class="mb-5"
  >
    All providers
  </VBtn>
  <template v-if="provider">
    <VCard class="pa-6 pa-md-8 mb-6">
      <VChip
        color="success"
        prepend-icon="tabler-shield-check"
        class="mb-4"
      >
        Verified provider
      </VChip><h1 class="text-h3 mb-3">
        {{ provider.name }}
      </h1><p class="text-h6 text-medium-emphasis mb-4">
        {{ provider.trade }} · {{ provider.city }}
      </p><div class="d-flex align-center flex-wrap gap-3 mb-5">
        <VIcon
          icon="tabler-star-filled"
          color="warning"
        /><strong>{{ provider.reviewCount ? provider.rating.toFixed(1) : 'New provider' }}</strong><span>{{ provider.reviewCount }} sample reviews</span><span>· {{ provider.experience }} years of experience</span><VChip
          variant="tonal"
          :color="provider.available ? 'success' : 'secondary'"
        >
          {{ provider.available ? 'Available for requests' : 'Currently unavailable' }}
        </VChip>
      </div><p class="text-body-1 mb-0">
        {{ provider.bio }}
      </p>
    </VCard>
    <VRow>
      <VCol
        cols="12"
        md="8"
      >
        <VCard class="mb-6">
          <VCardText>
            <h2 class="text-h5 mb-4">
              Services offered
            </h2><VList>
              <VListItem
                v-for="service in provider.services"
                :key="service"
                :title="service"
                prepend-icon="tabler-check"
              >
                <template #append>
                  <VBtn
                    :to="{ path: '/request', query: { service, provider: provider.id } }"
                    variant="text"
                    size="small"
                  >
                    Request service
                  </VBtn>
                </template>
              </VListItem>
            </VList>
          </VCardText>
        </VCard><VCard>
          <VCardText>
            <h2 class="text-h5 mb-4">
              Public portfolio
            </h2><Attachments :files="provider.portfolio" /><p
              v-if="!provider.portfolio.length"
              class="text-medium-emphasis mb-0"
            >
              This provider has not added portfolio samples yet.
            </p>
          </VCardText>
        </VCard>
      </VCol><VCol
        cols="12"
        md="4"
      >
        <VCard
          color="primary"
          variant="tonal"
        >
          <VCardText>
            <h2 class="text-h5 mb-3">
              Have a project in mind?
            </h2><p class="mb-5">
              Share your brief and include this provider as a preference. XPro confirms availability and assigns the right provider.
            </p><VBtn
              :to="{ path: '/request', query: { provider: provider.id, service: provider.services[0] } }"
              block
            >
              Request a service
            </VBtn>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </template>
  <VAlert
    v-else
    color="info"
    variant="tonal"
  >
    This public provider profile is unavailable. Browse the directory for other providers.
  </VAlert>
</template>
