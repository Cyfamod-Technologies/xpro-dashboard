<script setup lang="ts">
import { adminApi } from '@/services/xpro-api'
import type { AuditEvent } from '@/types/domain'
import { useRemoteData } from '@/composables/useRemoteData'

definePage({ meta: { roles: ['super_admin'] } })

const { data: events, loading, error, load } = useRemoteData(adminApi.auditEvents, [] as AuditEvent[])
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Accountability"
      title="Audit log"
      description="Immutable security, administrative and publication events across the platform."
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
    </VAlert>
    <VCard>
      <VCardText>
        <AppTextField
          label="Search audit events"
          prepend-inner-icon="tabler-search"
          placeholder="Actor, action or resource"
        />
      </VCardText><VDivider /><VSkeletonLoader
        v-if="loading"
        type="list-item-three-line@4"
      /><VList
        v-else
        lines="three"
      >
        <template
          v-for="event in events"
          :key="event.id"
        >
          <VListItem>
            <template #prepend>
              <VAvatar
                :color="event.tone"
                variant="tonal"
              >
                <VIcon icon="tabler-history" />
              </VAvatar>
            </template><VListItemTitle>{{ event.action }}</VListItemTitle><VListItemSubtitle>{{ event.resource }}<br>{{ event.actor }} · {{ new Date(event.createdAt).toLocaleString() }}</VListItemSubtitle>
          </VListItem><VDivider />
        </template>
      </VList>
    </VCard>
  </div>
</template>
