<script setup lang="ts">
import { providerCoverAlt, providerCoverImage } from '@/features/discovery/images'
import { experienceLabel, requestLocation } from '@/features/discovery/provider-utils'
import type { PublicProvider } from '@/features/discovery/provider-utils'

defineProps<{ provider: PublicProvider; selectedServices?: string[] }>()
</script>

<template>
  <VCard class="result">
    <div class="result__main">
      <img
        :src="providerCoverImage(provider)"
        :alt="providerCoverAlt(provider)"
        class="result__cover"
        loading="lazy"
        width="148"
        height="111"
      >
      <div class="d-flex flex-column gap-2 min-w-0">
        <div class="d-flex flex-wrap align-center gap-2">
          <RouterLink
            :to="`/providers/${provider.id}`"
            class="text-h6 text-high-emphasis text-decoration-none"
          >
            {{ provider.name }}
          </RouterLink>
          <VChip
            color="success"
            size="small"
            variant="tonal"
            prepend-icon="tabler-shield-check"
          >
            Verified
          </VChip>
          <VChip
            size="small"
            variant="tonal"
            :color="provider.available ? 'primary' : 'secondary'"
          >
            {{ provider.available ? 'Available' : 'Unavailable' }}
          </VChip>
        </div>
        <div class="text-body-2 text-medium-emphasis">
          {{ provider.trade }} · {{ provider.city }} · {{ experienceLabel(provider.experience) }} experience
        </div>
        <div class="text-body-2">
          {{ provider.bio }}
        </div>
        <div class="d-flex flex-wrap gap-2 pt-1">
          <VChip
            v-for="service in provider.services"
            :key="service"
            size="small"
            color="primary"
            variant="tonal"
          >
            {{ service }}
          </VChip>
        </div>
      </div>
    </div>
    <div class="result__aside">
      <span class="text-body-2 text-medium-emphasis">Quote</span>
      <strong class="text-h6">Free · via XPro</strong>
      <VBtn
        :to="requestLocation(provider, selectedServices)"
        block
      >
        Request
      </VBtn>
      <RouterLink
        :to="`/providers/${provider.id}`"
        class="text-center text-body-2 font-weight-medium"
      >
        View profile
      </RouterLink>
    </div>
  </VCard>
</template>

<style lang="scss" scoped>
.result {
  display: flex;
  flex-wrap: wrap;
  overflow: hidden;

  &__main {
    display: flex;
    flex: 999 1 380px;
    gap: 16px;
    min-inline-size: 0;
    padding: 20px;
  }

  &__cover {
    aspect-ratio: 4 / 3;
    block-size: auto;
    border-radius: 6px;
    flex: 0 0 148px;
    inline-size: 148px;
    object-fit: cover;
    align-self: flex-start;
  }

  &__aside {
    background: rgb(var(--v-theme-background));
    border-inline-start: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    display: flex;
    flex: 1 1 200px;
    flex-direction: column;
    gap: 10px;
    justify-content: center;
    padding: 20px;

    :deep(.v-btn) { flex: 0 0 auto; }
  }
}

@media (max-width: 700px) {
  .result__main { flex-direction: column; }

  .result__cover {
    aspect-ratio: 16 / 9;
    flex-basis: auto;
    inline-size: 100%;
  }

  .result__aside {
    border-block-start: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-inline-start: 0;
  }
}
</style>
