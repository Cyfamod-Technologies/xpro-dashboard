<script setup lang="ts">
import { clearDraftsForOwner } from "@/features/drafts/clear-drafts"
import { staffRoleLabels } from "@/features/operations/staff"
import { roleLabels } from "@/types/domain"
import { v1Actor, v1RoleLabel, v1RouteAllowed } from "@/features/v1/access"
import { isWorkspaceRole, sectionEnabled, sectionPath } from "@/features/workspace/config"
import { useAuthStore } from "@/stores/auth"
import { useOperationsStore } from "@/stores/operations"
import { getErrorMessage } from "@/utils/errors"

const auth = useAuthStore()
const ops = useOperationsStore()

const actor = computed(() => v1Actor(auth.user))
const roleLabel = computed(() => {
  if (!auth.user) return ""
  // V1 shows the plain actor: Customer, Admin, Staff or Provider.
  if (actor.value) return v1RoleLabel(actor.value)

  const roles = auth.user.role === "admin" ? ops.staffMember?.roles : undefined

  return roles?.length ? `Staff · ${roles.map(r => staffRoleLabels[r]).join(", ")}` : roleLabels[auth.user.role]
})

const router = useRouter()
const pathFor = (id: string) => (isWorkspaceRole(auth.user?.role) ? sectionPath(auth.user.role, id) : "/")
const profilePath = computed(() =>
  auth.user?.role === "admin"
    ? { path: "/admin/settings", query: { tab: "profile" } }
    : actor.value === "provider"
      ? { path: "/settings", query: { tab: "profile" } }
      : pathFor("settings"),
)
// Staff reach their account from Profile and have no Settings link.
const showSettings = computed(
  () =>
    isWorkspaceRole(auth.user?.role) &&
    sectionEnabled(auth.user.role, "settings") &&
    actor.value !== "staff" &&
    v1RouteAllowed(actor.value, "settings"),
)

const switching = ref(false)
const switchError = ref("")

// Pages load their data when they open, so a full load of the new home leaves nothing from the other role on screen.
const switchWorkspace = async () => {
  const role = auth.otherWorkspaceRole
  if (!role || switching.value) return

  switching.value = true
  switchError.value = ""
  try {
    await auth.switchRole(role)
    window.location.assign(auth.homePath)
  } catch (error) {
    switchError.value = getErrorMessage(error, "We couldn't switch workspace. Try again.")
    switching.value = false
  }
}

const handleLogout = async () => {
  const userId = auth.user?.id

  auth.logout()
  // Signing out on purpose also removes the user's saved form drafts from this device.
  if (userId) await clearDraftsForOwner(userId)
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
              {{ auth.user ? `${auth.user.firstName} ${auth.user.lastName}`.trim() : "Xpro user" }}
            </VListItemTitle>
            <VListItemSubtitle>{{ roleLabel }}</VListItemSubtitle>
          </VListItem>

          <VDivider class="my-2" />

          <!-- 👉 Profile -->
          <VListItem v-if="actor === 'staff' || actor === 'admin'" :to="profilePath">
            <template #prepend>
              <VIcon class="me-2" icon="tabler-user" size="22" />
            </template>

            <VListItemTitle>Profile</VListItemTitle>
          </VListItem>

          <!-- 👉 Settings -->
          <VListItem v-if="showSettings" :to="pathFor('settings')">
            <template #prepend>
              <VIcon class="me-2" icon="tabler-settings" size="22" />
            </template>

            <VListItemTitle>Settings</VListItemTitle>
          </VListItem>

          <!-- 👉 Workspace switcher, for an account holding both customer and provider -->
          <VListItem
            v-if="auth.otherWorkspaceRole"
            role="button"
            tabindex="0"
            :disabled="switching"
            @click="switchWorkspace"
            @keydown.enter="switchWorkspace"
            @keydown.space.prevent="switchWorkspace"
          >
            <template #prepend>
              <VIcon class="me-2" icon="tabler-switch-horizontal" size="22" />
            </template>

            <VListItemTitle>Switch to {{ auth.otherWorkspaceRole }} workspace</VListItemTitle>
            <VListItemSubtitle v-if="switchError" class="text-error">{{ switchError }}</VListItemSubtitle>
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
