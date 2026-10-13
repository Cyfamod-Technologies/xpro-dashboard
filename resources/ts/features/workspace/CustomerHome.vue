<script setup lang="ts">
import { serviceLines } from '@/features/workspace/config'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const firstName = computed(() => auth.user?.name.split(' ')[0] ?? 'there')
</script>

<template>
  <div>
    <VCard
      class="mb-6 pa-6 pa-sm-8"
      color="primary"
      variant="tonal"
    >
      <div class="text-overline mb-2">
        YOUR XPRO WORKSPACE
      </div>
      <h1 class="text-h3 mb-3">
        Welcome, {{ firstName }}.
      </h1>
      <p class="text-body-1 mb-5">
        From your first brief to the final finish, keep your projects in one place.
      </p>
      <VBtn
        to="/workspace/requests"
        prepend-icon="tabler-clipboard-list"
      >
        View my requests
      </VBtn>
    </VCard>
    <div class="mb-5">
      <h2 class="text-h5 mb-2">
        What can we help you with?
      </h2>
      <p class="text-body-1 text-medium-emphasis mb-0">
        Six service lines. One team to coordinate your work.
      </p>
    </div>
    <VRow class="mb-6">
      <VCol
        v-for="service in serviceLines"
        :key="service.name"
        cols="12"
        sm="6"
        lg="4"
      >
        <VCard
          :to="{ path: '/workspace/requests', query: { service: service.name } }"
          class="h-100"
        >
          <VCardText>
            <VAvatar
              color="primary"
              variant="tonal"
              class="mb-4"
            >
              <VIcon :icon="service.icon" />
            </VAvatar>
            <h3 class="text-h6 mb-2">
              {{ service.name }}
            </h3>
            <p class="text-body-2 text-medium-emphasis mb-0">
              {{ service.description }}
            </p>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
    <VCard>
      <VCardText class="d-flex align-center flex-wrap gap-4">
        <VAvatar
          color="secondary"
          variant="tonal"
        >
          <VIcon icon="tabler-message-circle" />
        </VAvatar>
        <div class="flex-grow-1">
          <h2 class="text-h6 mb-1">
            Stay connected with XPro
          </h2><p class="text-body-2 text-medium-emphasis mb-0">
            Keep project questions and updates together.
          </p>
        </div>
        <VBtn
          to="/workspace/messages"
          variant="outlined"
        >
          Open messages
        </VBtn>
      </VCardText>
    </VCard>
  </div>
</template>
