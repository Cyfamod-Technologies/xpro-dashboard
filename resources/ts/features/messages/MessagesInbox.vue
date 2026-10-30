<script setup lang="ts">
import ChatThread from "@/features/chat/ChatThread.vue"
import type { ChatAudience } from "@/features/chat/chat-types"
import ConversationHeader from "@/features/messages/ConversationHeader.vue"
import type { FocusOption } from "@/features/messages/ConversationHeader.vue"
import ConversationList from "@/features/messages/ConversationList.vue"
import RequestInfoPanel from "@/features/messages/RequestInfoPanel.vue"
import { audienceOptions, currentAssignment, defaultAudience, toggleStatus } from "@/features/messages/messages-helpers"
import { isFinishedStatus, statusLabel } from "@/features/messages/status-labels"
import type { ConversationItem } from "@/features/messages/types"
import { conversationPollMs, useConversations } from "@/features/messages/use-conversations"
import type { RequestView } from "@/features/requests/api-types"
import { RequestsApiError, requestsApi } from "@/services/requests-api"
import { useAuthStore } from "@/stores/auth"

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

// Desktop: list, chat and info side by side. Tablet: list and chat, info in a drawer. Phone: one screen at a time.
const isDesktop = useMediaQuery("(min-width: 1280px)")
const isTablet = useMediaQuery("(min-width: 768px)")
const mode = computed<"desktop" | "tablet" | "phone">(() =>
  isDesktop.value ? "desktop" : isTablet.value ? "tablet" : "phone",
)

const scopes = computed(() => auth.user?.scopes ?? [])
const has = (permission: string) => scopes.value.includes(permission)
const viewerName = computed(() => `${auth.user?.firstName ?? ""} ${auth.user?.lastName ?? ""}`.trim())

const {
  items,
  statusCounts,
  nextCursor,
  statuses,
  searchInput,
  search,
  loading,
  loadingMore,
  loaded,
  error: listError,
  moreError,
  filtersActive,
  reload,
  refresh,
  loadMore,
  setStatuses,
  clearStatuses,
  clearSearch,
  clearFilters,
} = useConversations()

// ---- Route state -----------------------------------------------------------------------------------------------------

const selectedId = computed(() =>
  typeof route.query.request === "string" && route.query.request.trim() ? route.query.request.trim() : undefined,
)
const phoneInfoOpen = computed(() => route.query.info === "1")
const phoneScreen = computed<"list" | "chat" | "info">(() =>
  !selectedId.value ? "list" : phoneInfoOpen.value ? "info" : "chat",
)
const tabletInfoOpen = ref(false)

// On phones opening a chat (or the info screen) adds a history entry, so the system back button steps back one screen.
let pushedChat = false
let pushedInfo = false

function select(requestId: string) {
  if (requestId === selectedId.value) {
    if (mode.value === "phone" && phoneInfoOpen.value) router.replace({ query: { request: requestId } })

    return
  }
  if (mode.value === "phone") {
    pushedChat = true
    router.push({ query: { request: requestId } })
  } else router.replace({ query: { request: requestId } })
}

function backToList() {
  if (pushedChat) {
    pushedChat = false
    router.back()
  } else router.replace({ query: {} })
}

function openInfo() {
  if (mode.value === "phone") {
    pushedInfo = true
    router.push({ query: { ...route.query, info: "1" } })
  } else tabletInfoOpen.value = true
}

function closeInfo() {
  if (mode.value !== "phone") {
    tabletInfoOpen.value = false

    return
  }
  if (pushedInfo) {
    pushedInfo = false
    router.back()
  } else router.replace({ query: selectedId.value ? { request: selectedId.value } : {} })
}

// ---- The open request ------------------------------------------------------------------------------------------------

const detail = ref<RequestView>()
const detailLoading = ref(false)
const detailError = ref("")
const focus = ref<ChatAudience | null>(null)
const claiming = ref(false)
const notice = ref("")
const noticeOpen = ref(false)
const snapshot = ref<ConversationItem>()
let detailSequence = 0

async function loadDetail(requestId: string, quiet = false) {
  const current = ++detailSequence

  if (!quiet) {
    detailLoading.value = true
    detailError.value = ""
  }
  try {
    const result = await requestsApi.get(requestId)

    if (current !== detailSequence) return
    detail.value = result
    detailError.value = ""
  } catch (cause) {
    if (current !== detailSequence) return
    if (!quiet) detailError.value = cause instanceof Error ? cause.message : "The conversation could not be opened."
  } finally {
    if (current === detailSequence) detailLoading.value = false
  }
}

watch(
  selectedId,
  id => {
    detail.value = undefined
    focus.value = null
    tabletInfoOpen.value = false
    if (!id) {
      pushedChat = false
      pushedInfo = false
      detailSequence++
      detailLoading.value = false
      detailError.value = ""

      return
    }
    snapshot.value = items.value.find(item => item.requestId === id)
    loadDetail(id)
  },
  { immediate: true },
)

// The row for the open chat. It is remembered, so the owner and provider names stay when a filter hides the row.
const row = computed(() => {
  const id = selectedId.value

  return id ? (items.value.find(item => item.requestId === id) ?? snapshot.value) : undefined
})

watch(
  () => (selectedId.value ? items.value.find(item => item.requestId === selectedId.value) : undefined),
  found => {
    if (found) snapshot.value = found
  },
)

// A link to a request outside the current filters clears the filters, so the row is there when the list reloads.
let handledId: string | undefined

watch(
  [selectedId, loaded],
  ([id, ready]) => {
    if (!id || !ready || handledId === id) return
    handledId = id
    if (filtersActive.value && !items.value.some(item => item.requestId === id)) clearFilters()
  },
  { immediate: true },
)

watch(selectedId, id => {
  if (!id) handledId = undefined
})

// Poll the open request along with the list so its version and read-only state stay current.
const visibility = useDocumentVisibility()
const { pause, resume } = useIntervalFn(
  () => {
    if (selectedId.value) loadDetail(selectedId.value, true)
  },
  conversationPollMs,
  { immediate: false },
)

watch(visibility, state => {
  if (state === "visible") {
    if (selectedId.value) loadDetail(selectedId.value, true)
    resume()
  } else pause()
})
if (visibility.value === "visible") resume()

watch(mode, () => {
  tabletInfoOpen.value = false
})

// ---- Chat wiring -----------------------------------------------------------------------------------------------------

// The chat waits for the first list answer so the default audience can use the row (customer or provider waiting).
const settledOnce = ref(false)

watch(
  [loaded, listError],
  ([ready, failed]) => {
    if (ready || failed) settledOnce.value = true
  },
  { immediate: true },
)

const current = computed(() => currentAssignment(detail.value?.assignment))
const hasProvider = computed(() => !!current.value || !!row.value?.provider)
const audiences = computed(() => audienceOptions(scopes.value, hasProvider.value))
const startAudience = computed(() => defaultAudience(row.value, audiences.value))
const finished = computed(() => (detail.value ? isFinishedStatus(detail.value.status) : false))
const readOnlyReason = computed(() =>
  finished.value ? "This request is closed. Messages can be read but not sent." : undefined,
)
const chatReady = computed(() => !!detail.value && settledOnce.value)

const focusOptions = computed<FocusOption[]>(() => [
  { value: null, title: "All messages" },
  ...(has("message.customer") ? [{ value: "customer" as const, title: "Only customer" }] : []),
  ...(has("message.provider") ? [{ value: "provider" as const, title: "Only provider" }] : []),
  ...(has("message.internal") ? [{ value: "internal" as const, title: "Only staff notes" }] : []),
])

const ownerName = computed(() => {
  if (row.value?.owner) return row.value.owner.name
  if (detail.value?.staffOwnerId && detail.value.staffOwnerId === auth.user?.id) return viewerName.value || "You"

  return detail.value?.staffOwnerId ? "Another staff member" : ""
})
const title = computed(() => detail.value?.title || row.value?.title || selectedId.value || "")
const customerName = computed(() => detail.value?.customerName || row.value?.customer.name || "Customer")
const subtitle = computed(() => {
  const stage = detail.value?.statusLabel || row.value?.statusLabel || (detail.value ? statusLabel(detail.value.status) : "")

  return [stage, ownerName.value ? `Owner: ${ownerName.value}` : "Unclaimed"].filter(Boolean).join(" · ")
})
const canClaim = computed(
  () => !!detail.value && !detail.value.staffOwnerId && !finished.value && detail.value.allowedActions.includes("request.claim"),
)
const openTo = computed(() => ({ path: "/admin/requests", query: { request: selectedId.value ?? "" } }))

function say(message: string) {
  notice.value = message
  noticeOpen.value = true
}

async function claim() {
  const request = detail.value

  if (!request || claiming.value) return
  claiming.value = true
  try {
    detail.value = await requestsApi.claim(request.id, request.version)
    say("Request claimed.")
    refresh()
  } catch (cause) {
    if (cause instanceof RequestsApiError && cause.code === "VERSION_CONFLICT") {
      say("This request has changed. It has been refreshed; try again.")
      loadDetail(request.id, true)
    } else say(cause instanceof Error ? cause.message : "The request could not be claimed.")
  } finally {
    claiming.value = false
  }
}

// A sent message changes the row (preview, waiting badge, position), so the list reloads its first page.
function onSent() {
  refresh()
  if (selectedId.value) loadDetail(selectedId.value, true)
}

function retryChat() {
  if (selectedId.value) loadDetail(selectedId.value)
}
</script>

<template>
  <div class="inbox" :class="`inbox--${mode}`">
    <div v-show="mode !== 'phone' || phoneScreen === 'list'" class="inbox__list">
      <ConversationList
        v-model:search-input="searchInput"
        :items="items"
        :status-counts="statusCounts"
        :statuses="statuses"
        :search="search"
        :selected-id="selectedId"
        :viewer-name="viewerName"
        :loading="loading"
        :loading-more="loadingMore"
        :has-more="!!nextCursor"
        :error="listError"
        :more-error="moreError"
        :stacked="mode === 'phone'"
        @toggle-status="setStatuses(toggleStatus(statuses, $event))"
        @clear-statuses="clearStatuses"
        @clear-search="clearSearch"
        @select="select"
        @load-more="loadMore"
        @retry="reload"
      />
    </div>

    <section
      v-show="mode !== 'phone' || phoneScreen === 'chat'"
      class="inbox__chat"
      aria-label="Conversation"
    >
      <div v-if="!selectedId" class="inbox__placeholder">
        <VIcon icon="tabler-message-circle" size="48" />
        <p class="inbox__placeholder-title">Select a conversation</p>
        <p class="inbox__placeholder-text">Pick a request on the left to read it and reply.</p>
      </div>

      <template v-else-if="detailError && !detail">
        <div class="inbox__chat-error">
          <VBtn
            v-if="mode === 'phone'"
            icon="tabler-arrow-left"
            variant="text"
            aria-label="Back to conversations"
            @click="backToList"
          />
          <VAlert type="error" variant="tonal" density="compact" class="flex-grow-1">
            {{ detailError }}
            <template #append>
              <VBtn size="small" variant="text" @click="retryChat">Retry</VBtn>
            </template>
          </VAlert>
        </div>
      </template>

      <template v-else-if="!chatReady">
        <div class="inbox__chat-head">
          <ConversationHeader
            :request-id="selectedId"
            :title="title"
            :subtitle="subtitle"
            :customer-name="customerName"
            :focus="focus"
            :focus-options="focusOptions"
            :can-claim="false"
            :claiming="false"
            :show-back="mode === 'phone'"
            :opens-info="mode !== 'desktop'"
            :open-to="openTo"
            @back="backToList"
            @open-info="openInfo"
            @update:focus="focus = $event"
          />
        </div>
        <div class="inbox__chat-loading" role="status" aria-label="Loading messages">
          <div v-for="n in 4" :key="n" class="inbox__bubble-skeleton" :class="{ 'inbox__bubble-skeleton--own': n % 2 === 0 }" />
        </div>
      </template>

      <ChatThread
        v-else-if="detail"
        :key="selectedId"
        :request-id="detail.id"
        viewer="staff"
        :title="title"
        :audiences="audiences"
        :default-audience="startAudience"
        :read-only-reason="readOnlyReason"
        :focus="focus"
        :provider-id="current?.providerId"
        @sent="onSent"
      >
        <template #header>
          <ConversationHeader
            :request-id="detail.id"
            :title="title"
            :subtitle="subtitle"
            :customer-name="customerName"
            :focus="focus"
            :focus-options="focusOptions"
            :can-claim="canClaim"
            :claiming="claiming"
            :show-back="mode === 'phone'"
            :opens-info="mode !== 'desktop'"
            :open-to="openTo"
            @back="backToList"
            @open-info="openInfo"
            @claim="claim"
            @update:focus="focus = $event"
          />
        </template>
      </ChatThread>
    </section>

    <div v-if="mode === 'desktop'" class="inbox__info">
      <RequestInfoPanel
        v-if="selectedId"
        :request="detail"
        :row="row"
        :loading="detailLoading"
        :error="detailError"
        :can-see-contact="has('view.customer_contact')"
        :can-claim="canClaim"
        :claiming="claiming"
        :has-provider="hasProvider"
        :owner-fallback="ownerName"
        @claim="claim"
        @retry="retryChat"
      />
      <div v-else class="inbox__placeholder">
        <p class="inbox__placeholder-text">Request details appear here.</p>
      </div>
    </div>

    <VNavigationDrawer
      v-else-if="mode === 'tablet'"
      v-model="tabletInfoOpen"
      location="end"
      temporary
      :width="360"
      aria-label="Request info"
    >
      <RequestInfoPanel
        :request="detail"
        :row="row"
        :loading="detailLoading"
        :error="detailError"
        :can-see-contact="has('view.customer_contact')"
        :can-claim="canClaim"
        :claiming="claiming"
        :has-provider="hasProvider"
        :owner-fallback="ownerName"
        fullscreen
        @back="closeInfo"
        @claim="claim"
        @retry="retryChat"
      />
    </VNavigationDrawer>

    <div v-else-if="phoneScreen === 'info'" class="inbox__info inbox__info--screen">
      <RequestInfoPanel
        :request="detail"
        :row="row"
        :loading="detailLoading"
        :error="detailError"
        :can-see-contact="has('view.customer_contact')"
        :can-claim="canClaim"
        :claiming="claiming"
        :has-provider="hasProvider"
        :owner-fallback="ownerName"
        fullscreen
        @back="closeInfo"
        @claim="claim"
        @retry="retryChat"
      />
    </div>

    <VSnackbar v-model="noticeOpen" :timeout="4000" location="bottom">{{ notice }}</VSnackbar>
  </div>
</template>

<style scoped lang="scss">
.inbox {
  display: grid;
  overflow: hidden;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
  background: rgb(var(--v-theme-surface));
  // The page needs to keep the composer in view, so the inbox fills what is left under the navbar and above the footer.
  block-size: calc(100dvh - 11.5rem);
  min-block-size: 32rem;

  &--desktop {
    grid-template-columns: 360px minmax(0, 1fr) 320px;
  }

  &--tablet {
    grid-template-columns: 340px minmax(0, 1fr);
  }

  &--phone {
    grid-template-columns: minmax(0, 1fr);
  }
}

.inbox__list,
.inbox__chat,
.inbox__info {
  min-block-size: 0;
  min-inline-size: 0;
  overflow: hidden;
}

.inbox__list {
  border-inline-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.inbox--phone .inbox__list {
  border-inline-end: 0;
}

.inbox__info {
  border-inline-start: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));

  &--screen {
    border-inline-start: 0;
  }
}

.inbox__chat {
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-surface));
}

.inbox__chat-head {
  padding: 12px 16px;
  border-block-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.inbox__chat-error {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  padding: 12px;
}

.inbox__placeholder {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 24px;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  text-align: center;
}

.inbox__placeholder-title {
  margin: 8px 0 0;
  color: rgb(var(--v-theme-on-surface));
  font-size: 1.125rem;
  font-weight: 600;
}

.inbox__placeholder-text {
  margin: 0;
}

.inbox__chat-loading {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: rgba(var(--v-theme-on-surface), 0.03);
}

.inbox__bubble-skeleton {
  inline-size: 55%;
  block-size: 52px;
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.08);
  animation: inbox-pulse 1.4s ease-in-out infinite;

  &--own {
    align-self: flex-end;
    inline-size: 42%;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}

@keyframes inbox-pulse {
  50% {
    opacity: 0.5;
  }
}
</style>
