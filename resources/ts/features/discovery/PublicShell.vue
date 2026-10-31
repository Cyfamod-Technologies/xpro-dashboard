<script setup lang="ts">
import { XPRO_PHONE } from "@/features/discovery/contact"
import { usePublicServices } from "@/features/discovery/public-services"
import { useAuthStore } from "@/stores/auth"
import { XPRO_BRAND } from "@/utils/branding"
import { isDemoMode } from "@/utils/demo-mode"

const { services } = usePublicServices()
const auth = useAuthStore()
const route = useRoute()
const year = new Date().getFullYear()

const nav = computed(() => [
  { label: "Home", to: "/", active: route.path === "/" && !route.hash },
  { label: "Services", to: "/services", active: route.path.startsWith("/services") },
  ...(!isDemoMode ? [{ label: "Providers", to: "/providers", active: route.path.startsWith("/providers") }] : []),
  { label: "How it works", to: "/#how-it-works", active: false },
])
</script>

<template>
  <div class="xp-site">
    <div class="xp-utility">
      <div class="xp-container d-flex flex-wrap justify-space-between gap-2 py-2 text-body-2">
        <span>Serving Nigeria</span>
        <span class="d-flex flex-wrap gap-x-5">
          <RouterLink v-if="!auth.isAuthenticated" to="/auth/signup?role=provider">Become a provider</RouterLink>
          <a :href="XPRO_PHONE.href">{{ XPRO_PHONE.label }}</a>
        </span>
      </div>
    </div>
    <header class="xp-header">
      <div class="xp-container d-flex flex-wrap align-center justify-space-between gap-3 py-3">
        <RouterLink to="/" aria-label="XPro home" class="d-flex">
          <img :src="XPRO_BRAND.logo" alt="XPro" class="xp-logo" />
        </RouterLink>
        <nav aria-label="Public navigation" class="xp-nav d-flex align-center">
          <RouterLink
            v-for="item in nav"
            :key="item.label"
            :to="item.to"
            class="xp-nav-link"
            :class="{ 'xp-nav-link--active': item.active }"
            :aria-current="item.active ? 'page' : undefined"
          >
            {{ item.label }}
          </RouterLink>
        </nav>
        <div class="d-flex gap-2">
          <VBtn :to="auth.isAuthenticated ? auth.homePath : '/login'" variant="outlined">
            {{ auth.isAuthenticated ? "My dashboard" : "Sign in" }}
          </VBtn>
          <VBtn to="/request"> Request a service </VBtn>
        </div>
      </div>
    </header>
    <main id="main-content" class="xp-main">
      <slot />
    </main>
    <footer class="xp-footer">
      <div class="xp-container d-flex flex-wrap justify-space-between gap-8 pt-10 pb-6">
        <div class="xp-footer-col xp-footer-col--wide d-flex flex-column gap-3">
          <img :src="XPRO_BRAND.logo" alt="XPro" class="xp-logo xp-logo--small" />
          <span class="text-body-2 text-medium-emphasis">
            Design, construction, hire, procurement and property services across Nigeria, coordinated by one accountable
            team.
          </span>
        </div>
        <nav aria-label="Services" class="xp-footer-col d-flex flex-column gap-2 text-body-2">
          <strong>Services</strong>
          <RouterLink
            v-for="item in services"
            :key="item.name"
            :to="{ path: '/services', query: { service: item.name } }"
          >
            {{ item.name }}
          </RouterLink>
        </nav>
        <nav aria-label="XPro" class="xp-footer-col d-flex flex-column gap-2 text-body-2">
          <strong>XPro</strong>
          <RouterLink to="/#how-it-works"> How it works </RouterLink>
          <RouterLink v-if="!auth.isAuthenticated" to="/auth/signup?role=provider"> Become a provider </RouterLink>
          <RouterLink :to="auth.isAuthenticated ? auth.homePath : '/login'">
            {{ auth.isAuthenticated ? "My dashboard" : "Sign in" }}
          </RouterLink>
        </nav>
        <div class="xp-footer-col xp-footer-col--contact d-flex flex-column gap-2 text-body-2">
          <strong>Contact</strong>
          <span v-for="address in XPRO_BRAND.addresses" :key="address" class="text-medium-emphasis">{{ address }}</span>
          <a :href="XPRO_PHONE.href">{{ XPRO_PHONE.label }}</a>
          <a :href="`mailto:${XPRO_BRAND.email}`">{{ XPRO_BRAND.email }}</a>
        </div>
      </div>
      <div class="xp-footer-bottom">
        <div class="xp-container d-flex flex-wrap justify-space-between gap-2 py-4 text-body-2 text-medium-emphasis">
          <span>© {{ year }} {{ XPRO_BRAND.fullName }}. All rights reserved.</span>
          <span v-if="isDemoMode">Demo data: requests and activity are samples.</span>
        </div>
      </div>
    </footer>
  </div>
</template>

<style lang="scss">
.xp-container {
  inline-size: min(100% - 2rem, 1180px);
  margin-inline: auto;
}

// Keep text links and tonal primary chips readable on light surfaces.
.xp-site main a:not(.v-btn, .v-card, .v-tab, .text-high-emphasis) {
  color: rgb(var(--v-theme-primary-darken-1));
}
.xp-site .v-chip.text-primary {
  color: color-mix(in srgb, rgb(var(--v-theme-primary-darken-1)), #000 25%) !important;
}
</style>

<style lang="scss" scoped>
.xp-site {
  display: flex;
  flex-direction: column;
  min-block-size: 100vh;
  min-block-size: 100dvh;
  background: rgb(var(--v-theme-background));
  color: rgb(var(--v-theme-on-background));
}

.xp-main {
  flex: 1 0 auto;
}

.xp-utility {
  background: rgb(var(--v-theme-brand-backdrop));
  color: #fff;

  // Override Vuexy's text-body-2 emphasis colour so every child stays white on the navy bar.
  :deep(*) {
    color: #fff;
  }
}

.xp-header {
  background: rgb(var(--v-theme-surface));
  border-block-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.xp-logo {
  block-size: 40px;
  inline-size: auto;

  &--small {
    align-self: flex-start;
    block-size: 36px;
  }
}

.xp-nav {
  flex-wrap: wrap;
  gap: 4px;
}

.xp-nav-link {
  border-block-end: 2px solid transparent;
  color: rgb(var(--v-theme-on-surface));
  font-weight: 500;
  padding: 9px 16px;
  text-decoration: none;

  &:hover {
    color: rgb(var(--v-theme-primary-darken-1));
  }

  &:focus-visible {
    border-radius: 4px;
    outline: 2px solid rgb(var(--v-theme-primary));
    outline-offset: 2px;
  }

  &--active {
    border-block-end-color: rgb(var(--v-theme-primary));
  }
}

.xp-footer {
  background: rgb(var(--v-theme-surface));
  border-block-start: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  margin-block-start: 24px;

  a {
    color: rgb(var(--v-theme-secondary));
    text-decoration: none;

    &:hover {
      color: rgb(var(--v-theme-primary-darken-1));
      text-decoration: underline;
    }
  }
}

.xp-footer-col {
  flex: 1 1 150px;

  &--wide {
    flex-basis: 260px;
  }
  &--contact {
    flex-basis: 240px;
  }
}

.xp-footer-bottom {
  border-block-start: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

@media (max-width: 760px) {
  .xp-nav {
    inline-size: 100%;
    order: 3;
    overflow-x: auto;
    flex-wrap: nowrap;
  }

  .xp-nav-link {
    padding-inline: 8px;
    white-space: nowrap;
  }
}
</style>
