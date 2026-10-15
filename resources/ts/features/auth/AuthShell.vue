<script setup lang="ts">
import { XPRO_BRAND } from "@/utils/branding"

defineProps<{
  title: string
  subtitle: string
  eyebrow?: string
}>()
</script>

<template>
  <VRow no-gutters class="auth-shell bg-surface">
    <VCol cols="12" md="6" lg="7" class="auth-story d-none d-md-flex">
      <div class="auth-story__content">
        <div class="d-flex align-center gap-3 mb-12">
          <div class="xpro-brand-mark xpro-brand-mark--large">
            <img :src="XPRO_BRAND.logo" alt="Xpro — Excellent Professionals and Procurement" />
          </div>
          <!--
            <div>
            <div class="text-caption text-white opacity-80">
            Operations dashboard
            </div>
            </div>
          -->
        </div>

        <div class="xpro-kicker text-white mb-4">
          {{ XPRO_BRAND.fullName }}
        </div>
        <h1 class="text-h2 text-white text-balance mb-5">Good work starts with the right connection.</h1>
        <p class="text-h6 text-white opacity-80 text-balance mb-10">
          Request a service, deliver your expertise or coordinate the work. Your XPro workspace brings it together.
        </p>

        <div class="d-flex flex-wrap gap-3">
          <VChip color="white" variant="outlined" prepend-icon="tabler-shield-check"> Operations workspace </VChip>
          <VChip color="white" variant="outlined" prepend-icon="tabler-map-pin">
            {{ XPRO_BRAND.location }}
          </VChip>
        </div>
      </div>
    </VCol>

    <VCol cols="12" md="6" lg="5" class="d-flex align-center justify-center">
      <div class="auth-panel pa-6 pa-sm-10">
        <RouterLink to="/login" class="d-flex d-md-none align-center gap-3 mb-10 text-decoration-none">
          <div class="xpro-brand-mark">
            <img :src="XPRO_BRAND.logo" alt="Xpro — Excellent Professionals and Procurement" />
          </div>
        </RouterLink>

        <div class="xpro-kicker mb-2">
          {{ eyebrow ?? "Xpro operations" }}
        </div>
        <h2 class="text-h3 text-balance mb-3">
          {{ title }}
        </h2>
        <p class="text-body-1 text-medium-emphasis mb-8">
          {{ subtitle }}
        </p>
        <slot />
      </div>
    </VCol>
  </VRow>
</template>

<style scoped>
.auth-shell {
  min-block-size: 100vh;
}
.auth-story {
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 15% 15%, rgba(var(--v-theme-primary), 0.62), transparent 30%),
    radial-gradient(circle at 80% 80%, rgba(var(--v-theme-secondary), 0.28), transparent 28%),
    rgb(var(--v-theme-brand-backdrop));
  min-block-size: 100vh;
  padding: 0;
}
.auth-story__content {
  inline-size: 100%;
  max-inline-size: 60rem;
  padding-block: clamp(3rem, 7vw, 7rem);
  padding-inline: clamp(3rem, 6vw, 7rem);
}
.auth-panel {
  inline-size: min(100%, 34rem);
}
.xpro-brand-mark {
  overflow: hidden;
  block-size: 74px;
  inline-size: 172px;
}
.xpro-brand-mark--large {
  block-size: 96px;
  inline-size: 224px;
}
.xpro-brand-mark img {
  display: block;
  block-size: 100%;
  inline-size: 100%;
  object-fit: contain;
}
.opacity-80 {
  opacity: 0.8;
}
</style>
