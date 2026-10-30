<script setup lang="ts">
import ConversationRow from "@/features/messages/ConversationRow.vue"
import { statusPills } from "@/features/messages/messages-helpers"
import type { ConversationItem } from "@/features/messages/types"

const props = defineProps<{
  items: ConversationItem[]
  /** Conversations per status, for the pills. */
  statusCounts: Record<string, number>
  /** Selected status pills. */
  statuses: string[]
  /** What is typed in the box. */
  searchInput: string
  /** The search the list was loaded with (drives highlighting and the empty message). */
  search: string
  selectedId?: string
  viewerName?: string
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  error: string
  moreError: string
  /** Phone: the header, search and pills scroll away with the rows instead of staying put. */
  stacked?: boolean
}>()
const emit = defineEmits<{
  "update:searchInput": [value: string]
  toggleStatus: [status: string]
  clearStatuses: []
  clearSearch: []
  select: [requestId: string]
  loadMore: []
  retry: []
}>()

const pills = computed(() => statusPills(props.statusCounts))
const total = computed(() => Object.values(props.statusCounts).reduce((sum, count) => sum + count, 0))
const searching = computed(() => props.search.trim() !== "")
const announcement = computed(() => {
  if (props.loading || props.error) return ""

  return props.items.length === 1 ? "1 conversation" : `${props.items.length} conversations`
})
const searchModel = computed({
  get: () => props.searchInput,
  set: value => emit("update:searchInput", value ?? ""),
})
</script>

<template>
  <section class="conv-list" :class="{ 'conv-list--stacked': stacked }" aria-labelledby="conv-list-title">
    <div class="conv-list__top">
      <h2 id="conv-list-title" class="conv-list__title">Messages</h2>
      <VTextField
        v-model="searchModel"
        class="conv-list__search"
        type="search"
        density="comfortable"
        variant="outlined"
        placeholder="Search requests"
        aria-label="Search requests"
        prepend-inner-icon="tabler-search"
        clearable
        hide-details
        autocomplete="off"
        @keydown.esc="emit('clearSearch')"
      />
      <div class="conv-list__pills" role="group" aria-label="Filter by request status">
        <button
          type="button"
          class="conv-pill"
          :class="{ 'conv-pill--on': statuses.length === 0 }"
          :aria-pressed="statuses.length === 0"
          @click="emit('clearStatuses')"
        >
          <VIcon v-if="statuses.length === 0" icon="tabler-check" size="14" />
          All
          <span v-if="total" class="conv-pill__count">{{ total }}</span>
        </button>
        <button
          v-for="pill in pills"
          :key="pill.status"
          type="button"
          class="conv-pill"
          :class="{ 'conv-pill--on': statuses.includes(pill.status) }"
          :aria-pressed="statuses.includes(pill.status)"
          @click="emit('toggleStatus', pill.status)"
        >
          <VIcon v-if="statuses.includes(pill.status)" icon="tabler-check" size="14" />
          {{ pill.label }}
          <span class="conv-pill__count">{{ pill.count }}</span>
        </button>
      </div>
    </div>

    <p class="conv-list__sr" role="status" aria-live="polite">{{ announcement }}</p>

    <div class="conv-list__scroll">
      <div v-if="loading" class="conv-list__skeletons" role="status" aria-label="Loading conversations">
        <div v-for="n in 6" :key="n" class="conv-skeleton">
          <div class="conv-skeleton__avatar" />
          <div class="conv-skeleton__lines">
            <div class="conv-skeleton__line" style="inline-size: 60%" />
            <div class="conv-skeleton__line" style="inline-size: 85%" />
            <div class="conv-skeleton__line" style="inline-size: 40%; block-size: 10px" />
          </div>
        </div>
      </div>

      <VAlert v-else-if="error" type="error" variant="tonal" density="compact" class="ma-3">
        {{ error }}
        <template #append>
          <VBtn size="small" variant="text" @click="emit('retry')">Retry</VBtn>
        </template>
      </VAlert>

      <div v-else-if="!items.length" class="conv-list__empty">
        <template v-if="searching">
          <p>No requests match "{{ search }}".</p>
          <VBtn variant="tonal" size="small" @click="emit('clearSearch')">Clear search</VBtn>
        </template>
        <template v-else-if="statuses.length">
          <p>No requests in this status have messages.</p>
          <VBtn variant="tonal" size="small" @click="emit('clearStatuses')">Show all</VBtn>
        </template>
        <p v-else>No conversations yet. They start when a customer or provider writes to XPro.</p>
      </div>

      <template v-else>
        <ul class="conv-list__rows" aria-label="Conversations">
          <ConversationRow
            v-for="item in items"
            :key="item.requestId"
            :item="item"
            :selected="item.requestId === selectedId"
            :search="search"
            :viewer-name="viewerName"
            @select="emit('select', $event)"
          />
        </ul>
        <div v-if="hasMore || moreError" class="conv-list__more">
          <p v-if="moreError" class="conv-list__more-error" role="alert">{{ moreError }}</p>
          <VBtn variant="tonal" size="small" :loading="loadingMore" @click="emit('loadMore')">
            {{ moreError ? "Retry" : "Load more" }}
          </VBtn>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped lang="scss">
.conv-list {
  display: flex;
  flex-direction: column;
  inline-size: 100%;
  block-size: 100%;
  min-block-size: 0;
  background: rgb(var(--v-theme-surface));

  &--stacked {
    overflow-y: auto;

    .conv-list__scroll {
      flex: none;
      overflow: visible;
    }
  }
}

.conv-list__top {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: 12px;
  padding: 16px 16px 8px;
}

.conv-list__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.conv-list__pills {
  display: flex;
  gap: 8px;
  padding-block-end: 8px;
  overflow-x: auto;
  scrollbar-width: thin;
}

.conv-pill {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 4px;
  min-block-size: 32px;
  padding: 4px 12px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 16px;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  font: inherit;
  font-size: 0.8125rem;
  white-space: nowrap;

  &:hover {
    background: rgba(var(--v-theme-on-surface), 0.05);
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--v-theme-primary));
    outline-offset: 2px;
  }

  &--on,
  &--on:hover {
    border-color: rgba(var(--v-theme-primary), 0.6);
    background: rgba(var(--v-theme-primary), 0.16);
    color: rgb(var(--v-theme-primary));
    font-weight: 600;
  }

  @media (max-width: 767px) {
    min-block-size: 44px;
    padding-inline: 16px;
  }
}

.conv-pill__count {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.75rem;
  font-weight: 600;
}

.conv-pill--on .conv-pill__count {
  color: inherit;
}

.conv-list__scroll {
  flex: 1;
  min-block-size: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  border-block-start: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.conv-list__rows {
  margin: 0;
  padding: 0;
}

.conv-list__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 24px;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  text-align: center;

  p {
    margin: 0;
  }
}

.conv-list__more {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
}

.conv-list__more-error {
  margin: 0;
  color: rgb(var(--v-theme-error));
  font-size: 0.875rem;
}

.conv-list__skeletons {
  display: flex;
  flex-direction: column;
}

.conv-skeleton {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  border-block-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.conv-skeleton__avatar,
.conv-skeleton__line {
  background: rgba(var(--v-theme-on-surface), 0.08);
  animation: conv-pulse 1.4s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}

.conv-skeleton__avatar {
  flex: none;
  block-size: 44px;
  inline-size: 44px;
  border-radius: 50%;
}

.conv-skeleton__lines {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  padding-block-start: 2px;
}

.conv-skeleton__line {
  block-size: 12px;
  border-radius: 4px;
}

@keyframes conv-pulse {
  50% {
    opacity: 0.5;
  }
}

.conv-list__sr {
  position: absolute;
  overflow: hidden;
  clip: rect(0 0 0 0);
  block-size: 1px;
  inline-size: 1px;
  margin: 0;
  white-space: nowrap;
}
</style>
