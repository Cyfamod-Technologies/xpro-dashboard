<script lang="ts" setup>
import { getHorizontalNavItems } from "@/navigation/horizontal"
import { v1Actor } from "@/features/v1/access"
import { useAuthStore } from "@/stores/auth"
import { useOperationsStore } from "@/stores/operations"

import { themeConfig } from "@themeConfig"

// Components
import Footer from "@/layouts/components/Footer.vue"
import UserProfile from "@/layouts/components/UserProfile.vue"
import NavBarI18n from "@core/components/I18n.vue"
import { HorizontalNavLayout } from "@layouts"
import { VNodeRenderer } from "@layouts/components/VNodeRenderer"

const auth = useAuthStore()
const ops = useOperationsStore()
const navItems = computed(() => getHorizontalNavItems(auth.user?.role, ops.can, v1Actor(auth.user)))
</script>

<template>
  <HorizontalNavLayout :nav-items="navItems">
    <!-- 👉 navbar -->
    <template #navbar>
      <RouterLink to="/" class="app-logo d-flex align-center gap-x-3">
        <VNodeRenderer :nodes="themeConfig.app.logo" />

        <h1 class="app-title font-weight-bold leading-normal text-xl text-capitalize">
          {{ themeConfig.app.title }}
        </h1>
      </RouterLink>
      <VSpacer />

      <NavBarI18n
        v-if="themeConfig.app.i18n.enable && themeConfig.app.i18n.langConfig?.length"
        :languages="themeConfig.app.i18n.langConfig"
      />

      <UserProfile />
    </template>

    <!-- 👉 Pages -->
    <slot />

    <!-- 👉 Footer -->
    <template #footer>
      <Footer />
    </template>

    <!-- 👉 Customizer -->
    <!-- <TheCustomizer /> -->
  </HorizontalNavLayout>
</template>
