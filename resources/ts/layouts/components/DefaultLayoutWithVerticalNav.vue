<script lang="ts" setup>
import { getVerticalNavItems } from '@/navigation/vertical'
import { useAuthStore } from '@/stores/auth'
import { themeConfig } from '@themeConfig'

// Components
import Footer from '@/layouts/components/Footer.vue'
import UserProfile from '@/layouts/components/UserProfile.vue'
import ViewerStateSwitcher from '@/layouts/components/ViewerStateSwitcher.vue'
import NavBarI18n from '@core/components/I18n.vue'

// @layouts plugin
import { VerticalNavLayout } from '@layouts'

const auth = useAuthStore()
const navItems = computed(() => getVerticalNavItems(auth.user?.role))
</script>

<template>
  <VerticalNavLayout :nav-items="navItems">
    <template #before-vertical-nav-items>
      <ViewerStateSwitcher v-if="auth.user?.role === 'budget_viewer'" />
    </template>

    <!-- 👉 navbar -->
    <template #navbar="{ toggleVerticalOverlayNavActive }">
      <div class="d-flex h-100 align-center">
        <IconBtn
          id="vertical-nav-toggle-btn"
          class="ms-n3 d-lg-none"
          @click="toggleVerticalOverlayNavActive(true)"
        >
          <VIcon
            size="26"
            icon="tabler-menu-2"
          />
        </IconBtn>

        <VChip
          class="d-none d-sm-flex"
          color="secondary"
          size="small"
          variant="tonal"
        >
          Prototype data
        </VChip>

        <VSpacer />

        <NavBarI18n
          v-if="themeConfig.app.i18n.enable && themeConfig.app.i18n.langConfig?.length"
          :languages="themeConfig.app.i18n.langConfig"
        />
        <UserProfile />
      </div>
    </template>

    <!-- 👉 Pages -->
    <slot />

    <!-- 👉 Footer -->
    <template #footer>
      <Footer />
    </template>

    <!-- 👉 Customizer -->
    <!-- <TheCustomizer /> -->
  </VerticalNavLayout>
</template>
