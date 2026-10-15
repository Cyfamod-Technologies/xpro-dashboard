<script setup lang="ts">
import { useOperationsStore } from '@/stores/operations'
import type { ServiceLine, ServiceRequest } from '@/features/operations/types'
import { requestStatuses, statusLabelFor, when } from '@/features/operations/types'
import { isUnclaimedOverdue } from '@/features/operations/staff'
import { currentAssignment, pendingApprovals } from '@/features/operations/workflow'
import RequestDetail from '@/features/operations/RequestDetail.vue'

const props = defineProps<{ section: string }>()
const ops = useOperationsStore()
const route = useRoute()
const router = useRouter()
const search = ref('')
const status = ref('')
const service = ref<ServiceLine | null>(null)
const owner = ref<'all' | 'mine' | 'unclaimed'>('all')
const ownerFilters = [{ title: 'All', value: 'all' }, { title: 'Mine', value: 'mine' }, { title: 'Unclaimed', value: 'unclaimed' }]
const isAdmin = computed(() => ops.actor?.role === 'admin')
const filterCols = computed(() => isAdmin.value ? 3 : 4)
const pendingRequestIds = computed(() => new Set(pendingApprovals(ops.state).flatMap(item => item.requestId ? [item.requestId] : [])))
const awaitingConfirmation = (request: ServiceRequest) => ops.actor?.role === 'provider' && currentAssignment(request)?.status === 'pending_approval'
const ownerLabel = (staffOwnerId: string) => staffOwnerId ? `Owner: ${ops.staffById(staffOwnerId)?.name ?? 'Former staff member'}` : 'Unclaimed'
const selected = computed(() => ops.requests.find(item => item.id === route.query.request))
const panel = computed(() => ['quotes', 'schedule', 'messages'].includes(props.section) ? props.section : 'overview')

const filtered = computed(() => ops.requests.filter(item => {
  const sectionMatch = props.section === 'quotes' ? item.quotes.some(quote => ops.actor?.role === 'admin' || quote.status !== 'draft') : props.section === 'schedule' ? item.schedules.length : true

  const ownerMatch = !isAdmin.value || owner.value === 'all' || (owner.value === 'mine' ? item.staffOwnerId === ops.actor?.id : !item.staffOwnerId)

  return sectionMatch && ownerMatch && (!status.value || item.status === status.value) && (!service.value || item.service === service.value) && `${item.id} ${item.title} ${item.city}`.toLowerCase().includes(search.value.toLowerCase())
}))

const statuses = computed(() => requestStatuses.map(value => ({ title: statusLabelFor(value, ops.actor?.role ?? 'customer'), value })))
const select = (id?: string) => router.push({ path: route.path, query: id ? { request: id } : {} })
</script>

<template>
  <template v-if="selected">
    <VBtn
      variant="text"
      prepend-icon="tabler-arrow-left"
      class="mb-4"
      @click="select"
    >
      Back to {{ section === 'jobs' ? 'jobs' : section }}
    </VBtn><RequestDetail
      :key="selected.id"
      :request="selected"
      :initial-panel="panel"
    />
  </template>
  <template v-else>
    <VAlert
      v-if="route.query.request"
      variant="tonal"
      color="info"
      class="mb-4"
    >
      This request is unavailable to your account or its assignment has changed.
    </VAlert>
    <div
      v-if="ops.actor?.role === 'customer'"
      class="d-flex justify-end mb-4"
    >
      <VBtn
        to="/request"
        prepend-icon="tabler-plus"
      >
        Request a service
      </VBtn>
    </div>
    <VCard class="mb-6">
      <VCardText>
        <VRow>
          <VCol
            cols="12"
            :md="filterCols"
          >
            <VTextField
              v-model="search"
              label="Search your activity"
              prepend-inner-icon="tabler-search"
              hide-details
              clearable
              @click:clear="search = ''"
            />
          </VCol><VCol
            cols="12"
            sm="6"
            :md="filterCols"
          >
            <VSelect
              v-model="status"
              :items="statuses"
              label="Status"
              hide-details
              clearable
              @click:clear="status = ''"
            />
          </VCol><VCol
            cols="12"
            sm="6"
            :md="filterCols"
          >
            <VSelect
              v-model="service"
              :items="[...new Set(ops.requests.map(item => item.service))]"
              label="Service"
              hide-details
              clearable
              @click:clear="service = null"
            />
          </VCol><VCol
            v-if="isAdmin"
            cols="12"
            sm="6"
            :md="filterCols"
          >
            <VSelect
              v-model="owner"
              :items="ownerFilters"
              label="Owner"
              hide-details
            />
          </VCol>
        </VRow>
      </VCardText>
    </VCard>
    <VRow>
      <VCol
        v-for="request in filtered"
        :key="request.id"
        cols="12"
        md="6"
      >
        <VCard class="h-100">
          <VCardText>
            <div class="d-flex justify-space-between flex-wrap gap-2 mb-3">
              <span class="text-body-2 text-medium-emphasis">{{ request.id }}</span><VChip
                variant="tonal"
                size="small"
                :color="request.status === 'blocked' ? 'warning' : 'primary'"
              >
                {{ statusLabelFor(request.status, ops.actor?.role ?? 'customer') }}
              </VChip>
            </div><div
              v-if="isAdmin"
              class="d-flex flex-wrap gap-2 mb-3"
            >
              <VChip
                size="small"
                variant="tonal"
                :color="request.staffOwnerId ? 'primary' : 'warning'"
              >
                {{ ownerLabel(request.staffOwnerId) }}
              </VChip><VChip
                v-if="pendingRequestIds.has(request.id)"
                size="small"
                color="warning"
                variant="flat"
              >
                Awaiting approval
              </VChip><VChip
                v-if="isUnclaimedOverdue(request)"
                size="small"
                color="error"
                variant="flat"
              >
                Unclaimed &gt; 2h
              </VChip>
            </div><VChip
              v-if="awaitingConfirmation(request)"
              size="small"
              color="warning"
              variant="tonal"
              class="mb-3"
            >
              Awaiting XPro confirmation
            </VChip><h2 class="text-h5 mb-2">
              {{ request.title }}
            </h2><p class="text-medium-emphasis mb-4">
              {{ request.service }} · {{ request.city }}
            </p><p class="text-body-2 mb-4">
              Submitted {{ when(request.createdAt) }}
            </p><VBtn
              variant="outlined"
              @click="select(request.id)"
            >
              {{ section === 'quotes' ? 'View quotes' : section === 'schedule' ? 'View schedule' : section === 'messages' ? 'Open conversation' : 'View request' }}
            </VBtn>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
    <VCard v-if="!filtered.length">
      <VCardText class="text-center py-12">
        <VIcon
          icon="tabler-clipboard-list"
          size="40"
          color="primary"
          class="mb-4"
        /><h2 class="text-h5 mb-3">
          No matching activity
        </h2><p class="text-medium-emphasis">
          Try another filter. Your requests and assigned work will appear here.
        </p><VBtn
          v-if="ops.actor?.role === 'customer'"
          to="/services"
          variant="outlined"
        >
          Explore services
        </VBtn>
      </VCardText>
    </VCard>
  </template>
</template>
