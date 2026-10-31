<script lang="ts" setup>
import { getVerticalNavItems } from "@/navigation/vertical"
import { v1Actor, v1RoleLabel } from "@/features/v1/access"
import { useAuthStore } from "@/stores/auth"
import { useOperationsStore } from "@/stores/operations"
import { staffRoleLabels } from "@/features/operations/staff"
import { roleLabels } from "@/types/domain"
import { themeConfig } from "@themeConfig"

// Components
import Footer from "@/layouts/components/Footer.vue"
import UserProfile from "@/layouts/components/UserProfile.vue"
import NavBarI18n from "@core/components/I18n.vue"

// @layouts plugin
import { VerticalNavLayout } from "@layouts"

const auth = useAuthStore()
const ops = useOperationsStore()
const navItems = computed(() => getVerticalNavItems(auth.user?.role, ops.can, v1Actor(auth.user)))

const roleChipLabel = computed(() => {
  if (!auth.user) return "XPro workspace"
  if (v1Actor(auth.user)) return v1RoleLabel(v1Actor(auth.user))

  const roles = auth.user.role === "admin" ? ops.staffMember?.roles : undefined

  return roles?.length ? `Staff · ${roles.map(r => staffRoleLabels[r]).join(", ")}` : roleLabels[auth.user.role]
})
</script>

<template>
  <VerticalNavLayout :nav-items="navItems">
    <!-- 👉 navbar -->
    <template #navbar="{ toggleVerticalOverlayNavActive }">
      <div class="d-flex h-100 align-center">
        <IconBtn id="vertical-nav-toggle-btn" class="ms-n3 d-lg-none" @click="toggleVerticalOverlayNavActive(true)">
          <VIcon size="26" icon="tabler-menu-2" />
        </IconBtn>

        <VChip class="d-none d-sm-flex" color="secondary" size="small" variant="tonal">
          {{ roleChipLabel }}
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
