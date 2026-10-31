<script setup lang="ts">
import V1ApproveDialog from "@/features/v1/V1ApproveDialog.vue"
import V1AssignStaff from "@/features/v1/V1AssignStaff.vue"
import V1CancelDialog from "@/features/v1/V1CancelDialog.vue"
import V1Conversation from "@/features/v1/V1Conversation.vue"
import V1DecisionPanel from "@/features/v1/V1DecisionPanel.vue"
import V1DenyDialog from "@/features/v1/V1DenyDialog.vue"
import V1ReplaceProviderDialog from "@/features/v1/V1ReplaceProviderDialog.vue"
import V1RequestSummary from "@/features/v1/V1RequestSummary.vue"
import V1StatusChip from "@/features/v1/V1StatusChip.vue"
import { v1Capabilities } from "@/features/v1/access"
import { formatDateTime } from "@/features/v1/helpers"
import type { V1Actor, V1Request } from "@/features/v1/types"
import { v1Api } from "@/services/v1-api"
import { getErrorMessage } from "@/utils/errors"

const props = defineProps<{ requestId: string; viewer: V1Actor; viewerId: string }>()
const emit = defineEmits<{ changed: [request: V1Request]; back: [] }>()

const request = ref<V1Request | null>(null)
const loading = ref(true)
const error = ref("")
const approveOpen = ref(false)
const denyOpen = ref(false)
const cancelOpen = ref(false)
const replaceOpen = ref(false)
const notice = ref("")

const caps = computed(() => v1Capabilities(props.viewer))
const isCustomer = computed(() => props.viewer === "customer")
const submitted = computed(() => request.value?.status === "submitted")
const approved = computed(() => request.value?.status === "approved")
const canApprove = computed(
  () => caps.value.canDecide && (props.viewer !== "staff" || request.value?.assignee?.id === props.viewerId),
)

const load = async () => {
  loading.value = true
  error.value = ""
  try {
    request.value = await v1Api.getRequest(props.requestId)
  } catch (cause) {
    request.value = null
    error.value = getErrorMessage(cause, "The request could not be loaded.")
  } finally {
    loading.value = false
  }
}

watch(() => props.requestId, load)
onMounted(load)

/** Takes the request a command returned, so the page shows the new version without another round trip. */
const apply = (updated: V1Request, message = "") => {
  request.value = updated
  notice.value = message
  emit("changed", updated)
}

const refresh = async () => {
  await load()
  if (request.value) emit("changed", request.value)
  notice.value = "Request refreshed."
}
</script>

<template>
  <div>
    <VProgressLinear v-if="loading" indeterminate />
    <VAlert v-else-if="error" type="error" variant="tonal">
      {{ error }}
      <template #append>
        <VBtn size="small" variant="text" @click="load">Retry</VBtn>
        <VBtn size="small" variant="text" @click="emit('back')">Back to list</VBtn>
      </template>
    </VAlert>

    <template v-else-if="request">
      <div class="d-flex align-start flex-wrap gap-3 mb-4">
        <VBtn icon="tabler-arrow-left" variant="text" aria-label="Back to the list" class="" @click="emit('back')" />
        <div class="flex-grow-1">
          <div class="text-caption text-medium-emphasis">
            {{ request.id }} · Submitted {{ formatDateTime(request.createdAt) }}
          </div>
          <h2 class="text-h5">{{ request.title }}</h2>
        </div>
        <V1StatusChip :status="request.status" size="default" />
      </div>

      <VAlert
        v-if="notice"
        type="success"
        variant="tonal"
        density="compact"
        closable
        class="mb-4"
        @click:close="notice = ''"
      >
        {{ notice }}
      </VAlert>

      <V1DecisionPanel :request="request" :viewer="viewer" class="mb-4" />

      <div v-if="isCustomer && submitted" class="d-flex justify-end mb-4">
        <VBtn color="error" variant="outlined" prepend-icon="tabler-x" @click="cancelOpen = true">Cancel request</VBtn>
      </div>

      <!-- Decision controls: admin only -->
      <VCard v-if="!isCustomer" variant="outlined" class="mb-4">
        <VCardText>
          <VRow>
            <VCol cols="12" md="6">
              <V1AssignStaff
                v-if="caps.canAssignStaff"
                :request="request"
                @updated="apply($event, 'Staff updated.')"
                @refresh="refresh"
              />
              <div v-else>
                <div class="text-caption text-medium-emphasis">Assigned staff</div>
                <div class="text-body-1">{{ request.assignee?.name ?? "Not assigned" }}</div>
              </div>
            </VCol>
            <VCol cols="12" md="6">
              <div class="text-caption text-medium-emphasis mb-2">Decision</div>
              <div v-if="canApprove && submitted" class="d-flex flex-wrap gap-2">
                <VBtn color="primary" prepend-icon="tabler-check" @click="approveOpen = true">Approve request</VBtn>
                <VBtn
                  v-if="caps.canDeny"
                  color="error"
                  variant="outlined"
                  prepend-icon="tabler-x"
                  @click="denyOpen = true"
                >
                  Deny request
                </VBtn>
              </div>
              <p v-else-if="submitted" class="text-body-2 text-medium-emphasis mb-0">
                <template v-if="viewer === 'staff' && request.assignee?.id !== viewerId">
                  Only the assigned staff member or an admin can approve this request. You can still chat with the
                  customer.
                </template>
                <template v-else-if="viewer === 'staff'">
                  You can approve this request or chat with the customer. Only an admin can deny it.
                </template>
                <template v-else>You can chat with the customer and send quotes.</template>
              </p>
              <div v-else-if="approved && caps.canReplaceProvider" class="d-flex flex-wrap align-center gap-3">
                <span class="text-body-2">Provider: {{ request.provider?.providerName ?? "Not assigned" }}</span>
                <VBtn
                  variant="outlined"
                  :prepend-icon="request.provider ? 'tabler-replace' : 'tabler-user-plus'"
                  @click="replaceOpen = true"
                >
                  {{ request.provider ? "Replace provider" : "Assign provider" }}
                </VBtn>
              </div>
              <p v-else class="text-body-2 text-medium-emphasis mb-0">The decision is final and can't be changed.</p>
            </VCol>
          </VRow>
        </VCardText>
      </VCard>

      <VRow>
        <VCol cols="12" lg="6">
          <V1RequestSummary :request="request" :show-customer="!isCustomer" />
          <VCard v-if="!isCustomer && request.activity.length" variant="outlined" class="mt-4">
            <VCardText>
              <h3 class="text-h6 mb-3">History</h3>
              <div v-for="entry in [...request.activity].reverse()" :key="entry.id" class="mb-3">
                <div class="text-body-2">{{ entry.text }}</div>
                <div class="text-caption text-medium-emphasis">{{ formatDateTime(entry.at) }}</div>
                <div v-if="entry.note" class="text-caption history-note">{{ entry.note }}</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="12" lg="6">
          <V1Conversation :request-id="request.id" :status="request.status" :viewer="viewer" :viewer-id="viewerId" />
        </VCol>
      </VRow>

      <V1ApproveDialog
        v-model="approveOpen"
        :request="request"
        @approved="apply($event, 'Request approved.')"
        @refresh="refresh"
      />
      <V1DenyDialog
        v-model="denyOpen"
        :request="request"
        @denied="apply($event, 'Request denied.')"
        @refresh="refresh"
      />
      <V1CancelDialog
        v-model="cancelOpen"
        :request="request"
        @cancelled="apply($event, 'Request cancelled. It remains in your history.')"
        @refresh="refresh"
      />
      <V1ReplaceProviderDialog
        v-model="replaceOpen"
        :request="request"
        @replaced="apply($event, 'Provider replaced.')"
        @refresh="refresh"
      />
    </template>
  </div>
</template>

<style scoped>
.history-note {
  white-space: pre-line;
}
</style>
