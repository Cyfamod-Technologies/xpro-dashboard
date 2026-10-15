<script setup lang="ts">
import { jobCoverAlt, jobCoverImage } from "@/features/discovery/images"
import type { PopularJob } from "@/features/discovery/popular-jobs"
import type { ServiceLine } from "@/features/operations/types"

const props = defineProps<{ service: ServiceLine; job: PopularJob }>()

const location = computed(() => ({
  path: "/request",
  query: { service: props.service, title: props.job.name, ...props.job.details },
}))
</script>

<template>
  <VCard :to="location" class="job-card">
    <div class="job-card__media">
      <VChip class="job-card__group" size="small" color="surface" variant="flat">
        {{ job.group }}
      </VChip>
      <img
        :src="jobCoverImage(service, job.name)"
        :alt="jobCoverAlt(service, job.name)"
        class="job-card__img"
        loading="lazy"
        width="400"
        height="160"
      />
      <VAvatar class="job-card__badge" color="surface" size="40">
        <VIcon :icon="job.icon" color="primary-darken-1" />
      </VAvatar>
    </div>
    <VCardText class="d-flex flex-column gap-1">
      <strong class="text-h6">{{ job.name }}</strong>
      <span class="text-body-2 text-medium-emphasis">{{ job.body }}</span>
      <span class="d-flex justify-space-between align-center pt-2 text-body-2">
        <span class="text-medium-emphasis">Free quote</span>
        <span class="font-weight-medium text-primary-darken-1">Request →</span>
      </span>
    </VCardText>
  </VCard>
</template>

<style lang="scss" scoped>
.job-card {
  display: flex;
  flex-direction: column;

  &__media {
    background: rgba(var(--v-theme-primary), 0.14);
    block-size: 160px;
    position: relative;
  }

  &__img {
    block-size: 100%;
    display: block;
    inline-size: 100%;
    object-fit: cover;
  }

  &__badge {
    inset-block-end: 12px;
    inset-inline-start: 12px;
    position: absolute;
  }

  &__group {
    inset-block-start: 12px;
    inset-inline-start: 12px;
    position: absolute;
  }
}
</style>
