<script setup lang="ts">
import { staffRoleLabels } from "@/features/operations/staff"
import { roleLabels } from "@/types/domain"
import { isWorkspaceRole, sectionPath } from "@/features/workspace/config"
import { useAuthStore } from "@/stores/auth"
import { useOperationsStore } from "@/stores/operations"

const auth = useAuthStore()
const ops = useOperationsStore()

const roleLabel = computed(() => {
  if (!auth.user) return ""

  const roles = auth.user.role === "admin" ? ops.staffMember?.roles : undefined

  return roles?.length ? `Staff · ${roles.map(r => staffRoleLabels[r]).join(", ")}` : roleLabels[auth.user.role]
})

const router = useRouter()
const pathFor = (id: string) => (isWorkspaceRole(auth.user?.role) ? sectionPath(auth.user.role, id) : "/")

const handleLogout = async () => {
  auth.logout()
  await router.push("/login")
}
</script>

<template>
  <VBadge dot location="bottom right" offset-x="3" offset-y="3" bordered color="success">
    <VAvatar
      class="cursor-pointer"
      role="button"
      tabindex="0"
      aria-label="Open account menu"
      color="primary"
      variant="tonal"
    >
      <span class="text-sm font-weight-semibold">{{ auth.user?.initials ?? "BD" }}</span>

      <!-- SECTION Menu -->
      <VMenu activator="parent" width="230" location="bottom end" offset="14px">
        <VList>
          <!-- 👉 User Avatar & Name -->
          <VListItem>
            <template #prepend>
              <VListItemAction start>
                <VBadge dot location="bottom right" offset-x="3" offset-y="3" color="success">
                  <VAvatar color="primary" variant="tonal">
                    <span class="text-sm font-weight-semibold">{{ auth.user?.initials ?? "BD" }}</span>
                  </VAvatar>
                </VBadge>
              </VListItemAction>
            </template>

            <VListItemTitle class="font-weight-semibold">
              {{ auth.user?.name ?? "Xpro user" }}
            </VListItemTitle>
            <VListItemSubtitle>{{ roleLabel }}</VListItemSubtitle>
          </VListItem>

          <VDivider class="my-2" />

          <!-- 👉 Profile -->
          <VListItem :to="pathFor('account')">
            <template #prepend>
              <VIcon class="me-2" icon="tabler-user" size="22" />
            </template>

            <VListItemTitle>Profile</VListItemTitle>
          </VListItem>

          <!-- 👉 Settings -->
          <VListItem :to="pathFor('settings')">
            <template #prepend>
              <VIcon class="me-2" icon="tabler-settings" size="22" />
            </template>

            <VListItemTitle>Settings</VListItemTitle>
          </VListItem>

          <!-- Divider -->
          <VDivider class="my-2" />

          <!-- 👉 Logout -->
          <VListItem
            role="button"
            tabindex="0"
            @click="handleLogout"
            @keydown.enter="handleLogout"
            @keydown.space.prevent="handleLogout"
          >
            <template #prepend>
              <VIcon class="me-2" icon="tabler-logout" size="22" />
            </template>

            <VListItemTitle>Logout</VListItemTitle>
          </VListItem>
        </VList>
      </VMenu>
      <!-- !SECTION -->
    </VAvatar>
  </VBadge>
</template>
