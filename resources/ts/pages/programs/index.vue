<script setup lang="ts">
import { programApi } from '@/services/xpro-api'
import type { Program } from '@/types/domain'
import { useAuthStore } from '@/stores/auth'
import { useRemoteData } from '@/composables/useRemoteData'

definePage({ meta: { roles: ['super_admin', 'manager', 'budget_viewer'] } })

const auth = useAuthStore()
const { data: programs, loading, error, load } = useRemoteData(programApi.list, [] as Program[])
const canManage = computed(() => auth.user?.role !== 'budget_viewer')
const money = (amount: number, currency: string) => new Intl.NumberFormat('en-NG', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(amount)
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Portfolio structure"
      title="Programs"
      description="Nigerian state initiatives that organise related tracked projects, allocations and public outcomes."
    >
      <template #actions>
        <VBtn
          v-if="canManage"
          prepend-icon="tabler-plus"
        >
          New program
        </VBtn>
      </template>
    </PageHeader>
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
    <VRow v-if="loading">
      <VCol
        v-for="item in 3"
        :key="item"
        cols="12"
        md="6"
        lg="4"
      >
        <VSkeletonLoader type="article, actions" />
      </VCol>
    </VRow>
    <VRow v-else>
      <VCol
        v-for="program in programs"
        :key="program.id"
        cols="12"
        md="6"
        lg="4"
      >
        <VCard class="h-100">
          <VCardItem>
            <template #prepend>
              <VAvatar
                color="primary"
                variant="tonal"
                rounded
              >
                <VIcon icon="tabler-stack-2" />
              </VAvatar>
            </template>
            <VCardTitle>{{ program.name }}</VCardTitle><VCardSubtitle>{{ program.code }} · {{ program.countries.join(', ') }}</VCardSubtitle>
          </VCardItem>
          <VCardText>
            <p class="text-body-2 mb-6">
              {{ program.description }}
            </p>
            <VRow>
              <VCol cols="6">
                <div class="text-caption text-medium-emphasis">
                  Projects
                </div><div class="text-h5 font-weight-bold">
                  {{ program.projectCount }}
                </div>
              </VCol><VCol cols="6">
                <div class="text-caption text-medium-emphasis">
                  Allocation
                </div><div class="text-h5 font-weight-bold">
                  {{ money(program.allocationTotal, program.currency) }}
                </div>
              </VCol>
            </VRow>
          </VCardText>
          <VCardActions>
            <VChip
              color="success"
              size="small"
              variant="tonal"
            >
              {{ program.status }}
            </VChip><VSpacer /><VBtn
              variant="text"
              :to="canManage ? `/projects?program=${program.id}` : `/explore?program=${program.id}`"
            >
              View projects
            </VBtn>
          </VCardActions>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>
