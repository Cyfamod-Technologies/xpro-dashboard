<script setup lang="ts">
import { providerCoverAlt, providerCoverImage } from '@/features/discovery/images'
import { experienceLabel } from '@/features/discovery/provider-utils'
import type { PublicProvider } from '@/features/discovery/provider-utils'

defineProps<{ providers: PublicProvider[] }>()
</script>

<template>
  <div class="provider-grid">
    <VCard
      v-for="provider in providers"
      :key="provider.id"
    >
      <VCardText class="d-flex align-center gap-4">
        <img
          :src="providerCoverImage(provider)"
          :alt="providerCoverAlt(provider)"
          class="provider-thumb"
          loading="lazy"
          width="96"
          height="96"
        >
        <div class="flex-grow-1 min-w-0">
          <div class="d-flex flex-wrap align-center gap-2 mb-1">
            <strong class="text-body-1">{{ provider.name }}</strong>
            <VChip
              color="success"
              size="x-small"
              variant="tonal"
            >
              Verified
            </VChip>
          </div>
          <div class="text-body-2 text-medium-emphasis">
            {{ provider.trade }} · {{ provider.city }} · {{ experienceLabel(provider.experience) }}
          </div>
          <div class="text-body-2 text-medium-emphasis">
            {{ provider.services.join(' · ') }}
          </div>
        </div>
        <VBtn
          :to="`/providers/${provider.id}`"
          variant="outlined"
          size="small"
          :aria-label="`View ${provider.name}`"
        >
          View
        </VBtn>
      </VCardText>
    </VCard>
  </div>
</template>

<style lang="scss" scoped>
.provider-grid {
  display: grid;
  gap: 24px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
}
.provider-thumb {
  aspect-ratio: 1;
  block-size: 88px;
  border-radius: 6px;
  flex: 0 0 88px;
  inline-size: 88px;
  object-fit: cover;
}
</style>
