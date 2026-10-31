<script setup lang="ts">
import V1StatusChip from "@/features/v1/V1StatusChip.vue"
import { formatDay, preview, statusOptions } from "@/features/v1/helpers"
import type { V1Actor, V1Request, V1RequestFilters, V1Staff, V1Status } from "@/features/v1/types"
import { v1Api } from "@/services/v1-api"
import { getErrorMessage } from "@/utils/errors"

const props = defineProps<{
  viewer: V1Actor
  selectedId?: string
  /** Opening status filter, e.g. from an Overview count. */
  initialStatus?: V1Status | ""
  /** Opening assignee filter (`unassigned` or a staff id), admin only. */
  initialAssignee?: string
}>()
const emit = defineEmits<{ select: [id: string]; loaded: [items: V1Request[]] }>()

const itemsPerPage = 8
const items = ref<V1Request[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(true)
const error = ref("")
const search = ref("")
const status = ref<V1Status | "">(props.initialStatus ?? "")
const assignee = ref(props.viewer === "admin" ? (props.initialAssignee ?? "") : "")
const service = ref("")
const staff = ref<V1Staff[]>([])
const services = ref<string[]>([])

const isAdmin = computed(() => props.viewer === "admin")
const isCustomer = computed(() => props.viewer === "customer")
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / itemsPerPage)))
const assigneeItems = computed(() => [
  { title: "Any assignee", value: "" },
  { title: "Unassigned", value: "unassigned" },
  ...staff.value.map(member => ({ title: member.name, value: member.id })),
])

const filters = (): V1RequestFilters => ({
  status: status.value,
  assignee: assignee.value,
  service: service.value,
  q: search.value,
  page: page.value,
  itemsPerPage,
})

const load = async () => {
  loading.value = true
  error.value = ""
  try {
    const result = await v1Api.listRequests(filters())

    items.value = result.items
    total.value = result.total
    emit("loaded", result.items)
  } catch (cause) {
    error.value = getErrorMessage(cause, "Requests could not be loaded.")
  } finally {
    loading.value = false
  }
}

let timer: ReturnType<typeof setTimeout> | undefined

// A filter change goes back to page 1; the page watcher loads when the page moves, otherwise load directly.
const reloadFromStart = () => {
  if (page.value !== 1) page.value = 1
  else load()
}

watch([status, assignee, service], reloadFromStart)
watch(search, () => {
  clearTimeout(timer)
  timer = setTimeout(reloadFromStart, 250)
})
watch(page, load)
onBeforeUnmount(() => clearTimeout(timer))

onMounted(async () => {
  load()
  try {
    const options = await v1Api.formOptions()

    services.value = options.services.map(item => item.name)
    if (isAdmin.value) staff.value = await v1Api.listStaff()
  } catch {
    // The filters still work without these lists.
  }
})

const secondLine = (request: V1Request) => {
  const parts = [request.id, request.service, formatDay(request.createdAt)]

  if (!isCustomer.value) parts.push(request.assignee ? `Assigned to ${request.assignee.name}` : "Unassigned")

  return parts.join(" · ")
}

defineExpose({ reload: load })
</script>

<template>
  <VCard>
    <VCardText>
      <div class="d-flex flex-wrap gap-3 mb-4">
        <VTextField
          v-model="search"
          class="list-search"
          label="Search"
          density="compact"
          prepend-inner-icon="tabler-search"
          hide-details
          clearable
        />
        <VSelect
          v-model="status"
          :items="[{ title: 'Any status', value: '' }, ...statusOptions]"
          label="Status"
          density="compact"
          hide-details
          class="list-filter"
        />
        <VSelect
          v-if="isAdmin"
          v-model="assignee"
          :items="assigneeItems"
          label="Assignee"
          density="compact"
          hide-details
          class="list-filter"
        />
        <VSelect
          v-model="service"
          :items="[{ title: 'Any service', value: '' }, ...services]"
          label="Service"
          density="compact"
          hide-details
          class="list-filter"
        />
      </div>

      <VAlert v-if="error" type="error" variant="tonal" density="compact" class="mb-3">
        {{ error }}
        <template #append>
          <VBtn size="small" variant="text" @click="load">Retry</VBtn>
        </template>
      </VAlert>
      <VProgressLinear v-if="loading" indeterminate class="mb-2" />

      <VList v-if="items.length" lines="three" class="pa-0">
        <VListItem
          v-for="request in items"
          :key="request.id"
          :active="request.id === selectedId"
          class="px-3"
          @click="emit('select', request.id)"
        >
          <VListItemTitle class="font-weight-medium">{{ request.title }}</VListItemTitle>
          <VListItemSubtitle>{{ secondLine(request) }}</VListItemSubtitle>
          <VListItemSubtitle v-if="isCustomer && request.status === 'denied'" class="text-error">
            {{ preview(request.decision.reason ?? "") }}
          </VListItemSubtitle>
          <template #append>
            <V1StatusChip :status="request.status" />
          </template>
        </VListItem>
      </VList>
      <p v-else-if="!loading && !error" class="text-medium-emphasis text-center py-8 mb-0">
        {{
          viewer === "customer"
            ? "You have no requests that match."
            : viewer === "staff"
              ? "No requests assigned to you match."
              : "No requests match."
        }}
      </p>

      <VPagination v-if="pageCount > 1" v-model="page" :length="pageCount" density="comfortable" class="mt-3" />
    </VCardText>
  </VCard>
</template>

<style scoped>
.list-search {
  flex: 2 1 200px;
}

.list-filter {
  flex: 1 1 140px;
}
</style>
