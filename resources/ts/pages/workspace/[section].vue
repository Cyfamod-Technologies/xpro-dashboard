<script setup lang="ts">
import { isWorkspaceRole, workspaceSections } from '@/features/workspace/config'
import { useAuthStore } from '@/stores/auth'
import { roleLabels } from '@/types/domain'

const auth = useAuthStore()
const route = useRoute('workspace-section')

const section = computed(() => {
  const role = auth.user?.role

  return isWorkspaceRole(role) ? workspaceSections[role].find(item => item.id === route.params.section) : undefined
})
</script>

<template>
  <div v-if="section">
    <div class="mb-6">
      <div class="text-overline text-primary mb-2">
        {{ auth.user ? roleLabels[auth.user.role] : 'XPro' }}
      </div><h1 class="text-h3 mb-2">
        {{ section.title }}
      </h1><p class="text-body-1 text-medium-emphasis mb-0">
        {{ section.description }}
      </p>
    </div>
    <VCard v-if="section.id === 'account'">
      <VCardText class="pa-6 pa-sm-8">
        <div class="d-flex align-center gap-4 mb-6">
          <VAvatar
            color="primary"
            variant="tonal"
            size="64"
          >
            {{ auth.user?.initials }}
          </VAvatar><div>
            <h2 class="text-h5 mb-1">
              {{ auth.user?.name }}
            </h2><p class="text-body-1 text-medium-emphasis mb-0">
              {{ auth.user?.email }}
            </p>
          </div>
        </div>
        <VDivider class="mb-6" /><dl>
          <dt class="text-body-2 text-medium-emphasis mb-1">
            Account type
          </dt><dd class="text-body-1 mb-4">
            {{ auth.user ? roleLabels[auth.user.role] : '' }}
          </dd><dt class="text-body-2 text-medium-emphasis mb-1">
            Account status
          </dt><dd class="text-body-1 text-capitalize">
            {{ auth.user?.status }}
          </dd>
        </dl>
      </VCardText>
    </VCard>
    <VCard v-else>
      <VCardText class="text-center pa-8 py-sm-16">
        <VAvatar
          color="primary"
          variant="tonal"
          size="72"
          class="mb-5"
        >
          <VIcon
            :icon="section.icon"
            size="32"
          />
        </VAvatar><h2 class="text-h5 mb-3">
          {{ section.title }}
        </h2><p class="text-body-1 text-medium-emphasis mb-6">
          {{ section.emptyMessage }}
        </p><VBtn
          to="/"
          variant="outlined"
          prepend-icon="tabler-arrow-left"
        >
          Back to overview
        </VBtn>
      </VCardText>
    </VCard>
  </div>
</template>
