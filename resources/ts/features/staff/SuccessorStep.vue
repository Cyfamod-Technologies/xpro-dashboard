<script setup lang="ts">
import { requestsApi } from "@/services/requests-api"
import type { OwnedRequestsInput, StaffOwner } from "@/services/staff-api"
import { staffApi } from "@/services/staff-api"

const props = defineProps<{
  /** The member being changed. */
  staffId: string
  name: string
  /** Open requests they own, from the directory row. */
  openOwned: number
}>()

const model = defineModel<OwnedRequestsInput | undefined>({ default: undefined })
/** True when every owned request has a destination. */
const complete = defineModel<boolean>("complete", { default: false })

const owners = ref<StaffOwner[]>([])
const requests = ref<Array<{ id: string; title: string; statusLabel: string | null }>>([])
const loading = ref(false)
const loadError = ref("")
const mode = ref<"all" | "each">("all")
const all = ref("")
const each = reactive<Record<string, string>>({})

const finished = new Set(["closed", "cancelled", "rejected"])
const QUEUE = "queue"

const options = computed(() => [
  ...owners.value.map(owner => ({
    title: `${owner.name} · ${owner.workload.openOwned} open${owner.workload.overdueOwned ? `, ${owner.workload.overdueOwned} overdue` : ""}`,
    value: owner.id,
    props: {
      disabled: owner.onLeave,
      subtitle: owner.onLeave ? `On leave until ${owner.leaveTo ?? "later"}` : undefined,
    },
  })),
  { title: "Return to the unclaimed queue", value: QUEUE },
])

const load = async () => {
  loading.value = true
  loadError.value = ""
  try {
    const [ownerList, list] = await Promise.all([
      staffApi.owners(props.staffId),
      requestsApi.list({ owner: props.staffId, itemsPerPage: 100 }),
    ])
    owners.value = ownerList.data
    requests.value = list.items
      .filter(item => !finished.has(item.status))
      .map(item => ({ id: item.id, title: item.title ?? item.id, statusLabel: item.statusLabel }))
  } catch (cause) {
    loadError.value = cause instanceof Error ? cause.message : "Staff who can take over could not be loaded."
  } finally {
    loading.value = false
  }
}

watch(
  [mode, all, each],
  () => {
    if (mode.value === "all") {
      model.value = all.value ? { all: all.value } : undefined
      complete.value = Boolean(all.value)

      return
    }
    const items = requests.value.filter(item => each[item.id]).map(item => ({ requestId: item.id, to: each[item.id] }))
    model.value = items.length ? { items } : undefined
    complete.value = requests.value.length > 0 && items.length === requests.value.length
  },
  { deep: true },
)

watch(requests, () => {
  complete.value = mode.value === "all" ? Boolean(all.value) : false
})

onMounted(load)
</script>

<template>
  <div>
    <VAlert type="warning" variant="tonal" class="mb-4">
      <strong>{{ name }} owns {{ openOwned }} open request{{ openOwned === 1 ? "" : "s" }}.</strong>
      Choose who takes them over before continuing.
    </VAlert>
    <VAlert v-if="loadError" type="error" variant="tonal" class="mb-3">
      {{ loadError }}
      <template #append><VBtn size="small" variant="text" @click="load">Retry</VBtn></template>
    </VAlert>
    <div v-if="loading" class="d-flex justify-center py-4">
      <VProgressCircular indeterminate color="primary" size="28" aria-label="Loading staff who can take over" />
    </div>
    <template v-else>
      <VRadioGroup v-model="mode" inline hide-details class="mb-2">
        <VRadio label="One person takes all" value="all" />
        <VRadio label="Choose per request" value="each" :disabled="!requests.length" />
      </VRadioGroup>
      <VSelect
        v-if="mode === 'all'"
        v-model="all"
        :items="options"
        label="Move all open requests to"
        hint="Nobody on leave is offered. The unclaimed queue tells everyone who can own requests."
        persistent-hint
      />
      <div v-else>
        <div v-for="item in requests" :key="item.id" class="d-flex align-center gap-3 mb-2">
          <div class="flex-grow-1 text-body-2">
            <strong>{{ item.id }}</strong> · {{ item.title }}
            <div v-if="item.statusLabel" class="text-caption text-medium-emphasis">{{ item.statusLabel }}</div>
          </div>
          <VSelect
            v-model="each[item.id]"
            :items="options"
            label="Move to"
            density="compact"
            hide-details
            style="max-inline-size: 260px"
          />
        </div>
      </div>
    </template>
  </div>
</template>
