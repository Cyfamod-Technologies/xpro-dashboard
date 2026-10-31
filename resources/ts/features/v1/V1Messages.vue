<script setup lang="ts">
import V1Conversation from "@/features/v1/V1Conversation.vue"
import V1StatusChip from "@/features/v1/V1StatusChip.vue"
import { formatDateTime, preview } from "@/features/v1/helpers"
import type { V1Conversation as ConversationRow, V1Actor, V1Request } from "@/features/v1/types"
import { v1Api } from "@/services/v1-api"
import { useAuthStore } from "@/stores/auth"
import { getErrorMessage } from "@/utils/errors"

// Customer conversations only: customers see their own request threads, admins see every customer thread. There is no
// provider or internal audience here.
const props = defineProps<{ viewer: Extract<V1Actor, "customer" | "admin"> }>()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const rows = ref<ConversationRow[]>([])
const loading = ref(true)
const error = ref("")
const search = ref("")
const selected = ref<V1Request | null>(null)
const selectedError = ref("")

const selectedId = computed(() => (typeof route.query.request === "string" ? route.query.request : ""))
const isAdmin = computed(() => props.viewer === "admin")
const visible = computed(() => {
  const q = search.value.trim().toLowerCase()

  // Admins search on the server; customers filter their own short list here.
  return isAdmin.value || !q
    ? rows.value
    : rows.value.filter(row => `${row.requestId} ${row.title}`.toLowerCase().includes(q))
})
const waitingTotal = computed(() => rows.value.filter(row => row.waitingForXpro > 0).length)

const load = async () => {
  loading.value = true
  error.value = ""
  try {
    rows.value = isAdmin.value
      ? await v1Api.adminConversations({ q: search.value })
      : await v1Api.customerConversations()
  } catch (cause) {
    error.value = getErrorMessage(cause, "Conversations could not be loaded.")
  } finally {
    loading.value = false
  }
}

let timer: ReturnType<typeof setTimeout> | undefined

watch(search, () => {
  if (!isAdmin.value) return
  clearTimeout(timer)
  timer = setTimeout(load, 250)
})
onBeforeUnmount(() => clearTimeout(timer))
onMounted(load)

watch(
  selectedId,
  async id => {
    selected.value = null
    selectedError.value = ""
    if (!id) return
    try {
      selected.value = await v1Api.getRequest(id)
    } catch (cause) {
      selectedError.value = getErrorMessage(cause, "This conversation could not be opened.")
    }
  },
  { immediate: true },
)

const select = (id: string) => router.push({ query: { ...route.query, request: id } })
const back = () => {
  const query = { ...route.query }

  delete query.request

  return router.push({ query })
}
const requestLink = (id: string) => ({ path: isAdmin.value ? "/admin/requests" : "/requests", query: { request: id } })
const lastLine = (row: ConversationRow) =>
  row.lastMessage ? `${row.lastMessage.authorLabel.split(" ")[0]}: ${preview(row.lastMessage.text, 70)}` : ""
</script>

<template>
  <VRow>
    <VCol cols="12" md="4" :class="{ 'd-none d-md-block': Boolean(selectedId) }">
      <VCard>
        <VCardText>
          <VTextField
            v-model="search"
            :label="isAdmin ? 'Search by request or customer' : 'Search your conversations'"
            density="compact"
            prepend-inner-icon="tabler-search"
            hide-details
            clearable
            class="mb-3"
          />
          <VChip v-if="isAdmin && waitingTotal" color="warning" size="small" variant="tonal" class="mb-3">
            {{ waitingTotal }} waiting for Xpro
          </VChip>
          <VAlert v-if="error" type="error" variant="tonal" density="compact" class="mb-2">
            {{ error }}
            <template #append>
              <VBtn size="small" variant="text" @click="load">Retry</VBtn>
            </template>
          </VAlert>
          <VProgressLinear v-if="loading" indeterminate />
          <VList v-if="visible.length" lines="three" class="pa-0">
            <VListItem
              v-for="row in visible"
              :key="row.requestId"
              :active="row.requestId === selectedId"
              @click="select(row.requestId)"
            >
              <VListItemTitle class="font-weight-medium">{{ row.title }}</VListItemTitle>
              <VListItemSubtitle> {{ row.requestId }}{{ isAdmin ? ` · ${row.customer.name}` : "" }} </VListItemSubtitle>
              <VListItemSubtitle>{{ lastLine(row) }}</VListItemSubtitle>
              <template #append>
                <VChip v-if="isAdmin && row.waitingForXpro > 0" size="x-small" color="warning" variant="flat">
                  Waiting for Xpro
                </VChip>
              </template>
            </VListItem>
          </VList>
          <p v-else-if="!loading && !error" class="text-medium-emphasis text-center py-6 mb-0">
            {{ isAdmin ? "No customer conversations yet." : "Your conversations with Xpro will appear here." }}
          </p>
        </VCardText>
      </VCard>
    </VCol>

    <VCol cols="12" md="8" :class="{ 'd-none d-md-block': !selectedId }">
      <VCard v-if="!selectedId" variant="outlined">
        <VCardText class="text-center text-medium-emphasis py-12">Choose a conversation to read it.</VCardText>
      </VCard>
      <VAlert v-else-if="selectedError" type="error" variant="tonal">{{ selectedError }}</VAlert>
      <template v-else-if="selected">
        <div class="d-flex align-center flex-wrap gap-3 mb-4">
          <VBtn
            icon="tabler-arrow-left"
            variant="text"
            aria-label="Back to conversations"
            class="d-md-none"
            @click="back"
          />
          <div class="flex-grow-1">
            <div class="text-caption text-medium-emphasis">
              {{ selected.id }}{{ isAdmin ? ` · ${selected.customer.name}` : "" }} ·
              {{ formatDateTime(selected.createdAt) }}
            </div>
            <h2 class="text-h6">{{ selected.title }}</h2>
          </div>
          <V1StatusChip :status="selected.status" />
          <VBtn variant="outlined" size="small" :to="requestLink(selected.id)">Open request</VBtn>
        </div>
        <V1Conversation
          :key="selected.id"
          :request-id="selected.id"
          :status="selected.status"
          :viewer="viewer"
          :viewer-id="auth.user?.id ?? ''"
          :height="480"
          @sent="load"
        />
      </template>
      <VProgressLinear v-else indeterminate />
    </VCol>
  </VRow>
</template>
