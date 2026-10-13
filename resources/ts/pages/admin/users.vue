<script setup lang="ts">
import { DEFAULT_STATE, NIGERIAN_STATES } from '@/utils/constants'

import { adminApi } from '@/services/xpro-api'
import type { User } from '@/types/domain'
import { roleLabels } from '@/types/domain'
import { useRemoteData } from '@/composables/useRemoteData'

definePage({ meta: { roles: ['super_admin'] } })

const {
  data: users,
  loading,
  error,
  load,
} = useRemoteData(adminApi.users, [] as User[])

const inviteOpen = ref(false)
const invited = ref(false)

const invite = reactive({
  name: '',
  email: '',
  program: 'State Projects Monitoring',
  location: DEFAULT_STATE,
})

const sendInvite = () => {
  inviteOpen.value = false
  invited.value = true
}
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Administration"
      title="Users and access"
      description="Invite Managers, inspect Viewer account states and keep operational access within an assigned scope."
    >
      <template #actions>
        <VBtn
          prepend-icon="tabler-user-plus"
          @click="inviteOpen = true"
        >
          Invite manager
        </VBtn>
      </template>
    </PageHeader>
    <VSnackbar
      v-model="invited"
      color="success"
    >
      Prototype Manager invitation created.
    </VSnackbar>
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
      <VSkeletonLoader
        v-if="loading"
        type="table-heading, table-thead, table-tbody"
      /><VTable v-else>
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Status</th>
            <th>Scope</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="user in users"
            :key="user.id"
          >
            <td>
              <div class="d-flex align-center gap-3">
                <VAvatar
                  color="primary"
                  variant="tonal"
                  size="38"
                >
                  {{
                    user.initials
                  }}
                </VAvatar>
                <div>
                  <div class="font-weight-semibold">
                    {{ user.name }}
                  </div>
                  <div class="text-caption">
                    {{ user.email }}
                  </div>
                </div>
              </div>
            </td>
            <td>{{ roleLabels[user.role] }}</td>
            <td>
              <VChip
                color="success"
                size="small"
                variant="tonal"
              >
                {{
                  user.status
                }}
              </VChip>
            </td>
            <td>{{ user.scopes.join(" · ") }}</td>
            <td>
              <VBtn
                icon="tabler-dots-vertical"
                variant="text"
              />
            </td>
          </tr>
        </tbody>
      </VTable>
    </VCard>
    <VDialog
      v-model="inviteOpen"
      max-width="640"
    >
      <VCard>
        <VCardItem>
          <VCardTitle>Invite a Manager</VCardTitle><VCardSubtitle>
            The Manager must verify email and configure MFA.
          </VCardSubtitle>
        </VCardItem><VCardText>
          <VRow>
            <VCol cols="12">
              <AppTextField
                v-model="invite.name"
                label="Full name"
              />
            </VCol><VCol cols="12">
              <AppTextField
                v-model="invite.email"
                label="Official email"
                type="email"
              />
            </VCol><VCol
              cols="12"
              sm="6"
            >
              <AppSelect
                v-model="invite.location"
                label="State scope"
                :items="NIGERIAN_STATES"
                hint="Defaults to Niger"
                persistent-hint
              />
            </VCol><VCol
              cols="12"
              sm="6"
            >
              <AppSelect
                v-model="invite.program"
                label="Program scope"
                :items="[
                  'State Projects Monitoring',
                  'Primary Healthcare Delivery',
                  'Community Infrastructure',
                ]"
              />
            </VCol>
          </VRow>
        </VCardText><VCardActions class="pa-5">
          <VBtn
            variant="text"
            @click="inviteOpen = false"
          >
            Cancel
          </VBtn><VSpacer /><VBtn
            prepend-icon="tabler-send"
            @click="sendInvite"
          >
            Send invitation
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>
