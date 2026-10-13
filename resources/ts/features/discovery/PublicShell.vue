<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <div class="public-site">
    <header class="public-header">
      <div class="public-container d-flex align-center justify-space-between flex-wrap gap-3 py-4">
        <RouterLink
          to="/"
          class="text-primary text-h4 font-weight-bold text-decoration-none"
        >
          XPro<span class="text-body-2 text-medium-emphasis ms-2">Build. Connect.</span>
        </RouterLink>
        <nav
          aria-label="Public navigation"
          class="d-flex align-center flex-wrap gap-1"
        >
          <VBtn
            to="/services"
            variant="text"
          >
            Services
          </VBtn><VBtn
            to="/providers"
            variant="text"
          >
            Providers
          </VBtn>
          <VBtn
            :to="auth.isAuthenticated ? auth.homePath : '/login'"
            variant="outlined"
          >
            {{ auth.isAuthenticated ? 'My dashboard' : 'Sign in' }}
          </VBtn>
          <VBtn to="/request">
            Request a service
          </VBtn>
        </nav>
      </div>
    </header>
    <main
      id="main-content"
      class="public-container py-8 py-md-12"
    >
      <slot />
    </main>
    <footer class="public-container py-6 text-body-2 text-medium-emphasis">
      XPro connects you with expertise across six service lines. This preview uses sample providers, ratings and locally saved activity.
    </footer>
  </div>
</template>

<style scoped>
.public-site { min-block-size: 100vh; background: rgb(var(--v-theme-background)); }
.public-container { inline-size: min(100% - 2rem, 1180px); margin-inline: auto; }
.public-header { background: rgb(var(--v-theme-surface)); border-block-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); }
</style>
