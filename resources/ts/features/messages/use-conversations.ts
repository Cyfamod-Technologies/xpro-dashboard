import { conversationsApi } from "@/services/conversations-api"
import { mergeFirstPage, searchMaxLength } from "@/features/messages/messages-helpers"
import type { ConversationItem } from "@/features/messages/types"

/** How often the list refreshes while the tab is visible. */
export const conversationPollMs = 30_000
/** Pause after typing before the search runs. */
export const searchDebounceMs = 300
const pageSize = 25

/**
 * State for the conversation list: the loaded pages, the search and status filters, paging, and the background
 * refresh. A refresh re-fetches the first page and merges it by request id, so later pages stay and nothing
 * the person is looking at is dropped.
 */
export function useConversations() {
  const items = shallowRef<ConversationItem[]>([])
  const statusCounts = ref<Record<string, number>>({})
  const nextCursor = ref<string | null>(null)
  const statuses = ref<string[]>([])
  /** What is typed in the search box. */
  const searchInput = ref("")
  /** The search the list was last loaded with (the debounced value). */
  const search = ref("")
  const loading = ref(true)
  const loadingMore = ref(false)
  const loaded = ref(false)
  const error = ref("")
  const moreError = ref("")
  // A newer load makes older answers stale (the filters changed while they were on their way).
  let generation = 0
  // True until "Load more" fetches a second page.
  let firstPageOnly = true

  const filtersActive = computed(() => statuses.value.length > 0 || search.value.trim() !== "")
  const query = () => ({ status: statuses.value, q: search.value, limit: pageSize })

  /** Loads the first page from scratch (filters changed, or Retry). Shows the skeletons. */
  async function reload() {
    const current = ++generation

    firstPageOnly = true
    loading.value = true
    error.value = ""
    moreError.value = ""
    try {
      const result = await conversationsApi.list(query())

      if (current !== generation) return
      items.value = result.data
      statusCounts.value = result.meta.statusCounts
      nextCursor.value = result.meta.nextCursor
      loaded.value = true
    } catch (cause) {
      if (current !== generation) return
      items.value = []
      error.value = cause instanceof Error ? cause.message : "The conversations could not be loaded."
    } finally {
      if (current === generation) loading.value = false
    }
  }

  /** Background refresh: re-fetches the first page and merges it. Failures are silent; the next tick tries again. */
  async function refresh() {
    if (loading.value || loadingMore.value || !loaded.value) return

    const current = generation

    try {
      const result = await conversationsApi.list(query())

      if (current !== generation) return

      // Rows from later pages stay; rows on the fresh page replace their old copy and come first.
      items.value = mergeFirstPage(items.value, result.data)
      statusCounts.value = result.meta.statusCounts
      // With later pages loaded the cursor must stay at the furthest page; otherwise the fresh one is right.
      if (firstPageOnly) nextCursor.value = result.meta.nextCursor
      error.value = ""
    } catch {
      // Keep what is on screen.
    }
  }

  async function loadMore() {
    if (!nextCursor.value || loadingMore.value || loading.value) return

    const current = generation

    loadingMore.value = true
    moreError.value = ""
    try {
      const result = await conversationsApi.list({ ...query(), cursor: nextCursor.value })

      if (current !== generation) return

      const known = new Set(items.value.map(item => item.requestId))

      items.value = [...items.value, ...result.data.filter(item => !known.has(item.requestId))]
      nextCursor.value = result.meta.nextCursor
      firstPageOnly = false
    } catch (cause) {
      if (current !== generation) return
      moreError.value = cause instanceof Error ? cause.message : "More conversations could not be loaded."
    } finally {
      if (current === generation) loadingMore.value = false
    }
  }

  function setStatuses(next: string[]) {
    statuses.value = next
  }

  function clearStatuses() {
    statuses.value = []
  }

  function clearSearch() {
    searchInput.value = ""
    search.value = ""
  }

  function clearFilters() {
    searchInput.value = ""
    search.value = ""
    statuses.value = []
  }

  // The box updates at once; the list follows after a short pause.
  const applySearch = useDebounceFn((value: string) => {
    search.value = value.trim().slice(0, searchMaxLength)
  }, searchDebounceMs)

  watch(searchInput, value => {
    // Clearing applies at once so "Clear search" does not wait.
    if (value.trim() === "") search.value = ""
    else applySearch(value)
  })

  // Any change of filters starts a fresh first page.
  watch([statuses, search], () => reload(), { deep: true })

  void reload()

  const visibility = useDocumentVisibility()
  const { pause, resume } = useIntervalFn(refresh, conversationPollMs, { immediate: false })

  watch(visibility, state => {
    if (state === "visible") {
      void refresh()
      resume()
    } else pause()
  })
  if (visibility.value === "visible") resume()

  return {
    items,
    statusCounts,
    nextCursor,
    statuses,
    searchInput,
    search,
    loading,
    loadingMore,
    loaded,
    error,
    moreError,
    filtersActive,
    reload,
    refresh,
    loadMore,
    setStatuses,
    clearStatuses,
    clearSearch,
    clearFilters,
  }
}

export type Conversations = ReturnType<typeof useConversations>
