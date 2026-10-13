<script setup lang="ts">
import { notificationApi } from '@/services/xpro-api'
import type { NotificationItem } from '@/types/domain'
import { useRemoteData } from '@/composables/useRemoteData'

definePage({ meta: { roles: ['super_admin', 'manager'] } })

const { data: notifications, loading, error, load } = useRemoteData(notificationApi.list, [] as NotificationItem[])
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Updates"
      title="Notifications"
      description="Review submission decisions, publication events, assignments and security notices."
    />
    <VAlert
      v-if="error"
      color="error"
      variant="tonal"
      class="mb-6"
    >
      {{ error }} <VBtn
        variant="text"
        @click="load"
      >
        Retry
      </VBtn>
    </VAlert><VCard>
      <VSkeletonLoader
        v-if="loading"
        type="list-item-three-line@3"
      /><VList
        v-else
        lines="three"
      >
        <template
          v-for="notification in notifications"
          :key="notification.id"
        >
          <VListItem>
            <template #prepend>
              <VBadge
                :model-value="!notification.read"
                dot
                color="error"
              >
                <VAvatar
                  :color="notification.tone"
                  variant="tonal"
                >
                  <VIcon icon="tabler-bell" />
                </VAvatar>
              </VBadge>
            </template><VListItemTitle>{{ notification.title }}</VListItemTitle><VListItemSubtitle>{{ notification.message }}<br>{{ new Date(notification.createdAt).toLocaleString() }}</VListItemSubtitle><template #append>
              <VBtn
                icon="tabler-arrow-up-right"
                variant="text"
              />
            </template>
          </VListItem><VDivider />
        </template>
      </VList>
    </VCard>
  </div>
</template>
