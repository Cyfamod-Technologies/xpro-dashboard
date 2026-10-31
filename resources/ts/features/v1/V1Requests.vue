<script setup lang="ts">
import V1RequestDetail from "@/features/v1/V1RequestDetail.vue"
import V1RequestList from "@/features/v1/V1RequestList.vue"
import type { V1Actor, V1Status } from "@/features/v1/types"
import { useAuthStore } from "@/stores/auth"

// Requests for every V1 actor: customers see their own, admins all, staff only those assigned to them.
// `?request=<id>` opens the detail and `?status=` opens the list on a status (the Overview counts link there).
const props = defineProps<{ viewer: V1Actor }>()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const requestId = computed(() => (typeof route.query.request === "string" ? route.query.request : ""))
const initialStatus = computed<V1Status | "">(() => {
  const status = route.query.status

  return status === "submitted" || status === "approved" || status === "denied" || status === "cancelled" ? status : ""
})

const initialAssignee = computed(() => (typeof route.query.assignee === "string" ? route.query.assignee : ""))

const open = (id: string) => router.push({ query: { ...route.query, request: id } })
const back = () => {
  const query = { ...route.query }

  delete query.request

  return router.push({ query })
}
</script>

<template>
  <div>
    <div v-if="!requestId" class="d-flex align-center justify-end mb-4">
      <VBtn v-if="props.viewer === 'customer'" to="/request" prepend-icon="tabler-plus">Request a service</VBtn>
    </div>
    <V1RequestDetail
      v-if="requestId"
      :key="requestId"
      :request-id="requestId"
      :viewer="props.viewer"
      :viewer-id="auth.user?.id ?? ''"
      @back="back"
    />
    <V1RequestList
      v-else
      :viewer="props.viewer"
      :initial-status="initialStatus"
      :initial-assignee="initialAssignee"
      @select="open"
    />
  </div>
</template>
