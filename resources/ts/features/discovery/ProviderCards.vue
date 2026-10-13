<script setup lang="ts">
import type { useOperationsStore } from '@/stores/operations'

defineProps<{ providers: ReturnType<typeof useOperationsStore>['publicProviders'] }>()
</script>

<template>
  <VRow>
    <VCol
      v-for="provider in providers"
      :key="provider.id"
      cols="12"
      sm="6"
      lg="4"
    >
      <VCard class="h-100">
        <VCardText class="pa-6">
          <div class="d-flex justify-space-between align-center mb-4">
            <VAvatar
              color="primary"
              variant="tonal"
              size="52"
            >
              {{ provider.name.split(' ').map(part => part[0]).slice(0, 2).join('') }}
            </VAvatar><VChip
              color="success"
              size="small"
              prepend-icon="tabler-shield-check"
            >
              Verified
            </VChip>
          </div>
          <h3 class="text-h5 mb-1">
            {{ provider.name }}
          </h3><p class="text-medium-emphasis mb-3">
            {{ provider.trade }} · {{ provider.city }}
          </p>
          <div class="d-flex align-center gap-2 mb-3">
            <VIcon
              icon="tabler-star-filled"
              color="warning"
              size="18"
            /><strong>{{ provider.reviewCount ? provider.rating.toFixed(1) : 'New' }}</strong><span class="text-body-2 text-medium-emphasis">{{ provider.reviewCount }} sample reviews</span>
          </div>
          <p class="text-body-2 mb-3">
            {{ provider.experience }} years of experience · {{ provider.available ? 'Available for requests' : 'Currently unavailable' }}
          </p>
          <div class="d-flex flex-wrap gap-2 mb-5">
            <VChip
              v-for="service in provider.services"
              :key="service"
              size="small"
              variant="tonal"
            >
              {{ service }}
            </VChip>
          </div>
          <VBtn
            :to="`/providers/${provider.id}`"
            variant="outlined"
            block
          >
            View profile
          </VBtn>
        </VCardText>
      </VCard>
    </VCol>
  </VRow>
  <VAlert
    v-if="!providers.length"
    variant="tonal"
    color="info"
  >
    No providers match these filters. Try another service or location. You can still submit a brief for XPro to review.
  </VAlert>
</template>
