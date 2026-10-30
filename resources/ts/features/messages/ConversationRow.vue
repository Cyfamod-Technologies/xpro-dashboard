<script setup lang="ts">
import { formatRowTime, highlightSegments, initials, previewParts } from "@/features/messages/messages-helpers"
import type { ConversationItem } from "@/features/messages/types"

const props = defineProps<{
  item: ConversationItem
  selected: boolean
  /** The active search, used to highlight matches in the title and preview. */
  search: string
  /** The signed-in staff member's full name, so their own messages read "You:". */
  viewerName?: string
}>()
const emit = defineEmits<{ select: [requestId: string] }>()

const preview = computed(() => previewParts(props.item, props.viewerName))
const waiting = computed(() => props.item.waitingForXpro)
const time = computed(() => formatRowTime(props.item.lastMessage.at))
const titleSegments = computed(() => highlightSegments(props.item.title, props.search))
const previewSegments = computed(() => highlightSegments(preview.value.text, props.search))
const ownerLabel = computed(() => (props.item.owner ? `Owner ${props.item.owner.name}` : "Not claimed yet"))
</script>

<template>
  <li class="conv-row-item">
    <button
      type="button"
      class="conv-row"
      :class="{
        'conv-row--selected': selected,
        'conv-row--waiting': waiting > 0,
        'conv-row--closed': item.closed,
      }"
      :aria-current="selected ? 'true' : undefined"
      @click="emit('select', item.requestId)"
    >
      <VAvatar class="conv-row__avatar" color="primary" variant="tonal" size="44" aria-hidden="true">
        <span class="text-body-1 font-weight-medium">{{ initials(item.customer.name) }}</span>
      </VAvatar>

      <span class="conv-row__body">
        <span class="conv-row__line">
          <span class="conv-row__title">
            <template v-for="(segment, index) in titleSegments" :key="index">
              <mark v-if="segment.match" class="conv-row__mark">{{ segment.text }}</mark>
              <template v-else>{{ segment.text }}</template>
            </template>
          </span>
          <time class="conv-row__time" :datetime="item.lastMessage.at">{{ time }}</time>
        </span>

        <span class="conv-row__line">
          <span class="conv-row__preview">
            <em v-if="preview.note" class="conv-row__prefix">{{ preview.prefix }}</em>
            <span v-else class="conv-row__prefix">{{ preview.prefix }}</span>
            <VIcon v-if="preview.attachmentOnly" icon="tabler-paperclip" size="14" class="conv-row__clip" />
            <template v-for="(segment, index) in previewSegments" :key="index">
              <mark v-if="segment.match" class="conv-row__mark">{{ segment.text }}</mark>
              <template v-else>{{ segment.text }}</template>
            </template>
          </span>
          <span v-if="waiting > 0" class="conv-row__badge">
            <span aria-hidden="true">{{ waiting > 99 ? "99+" : waiting }}</span>
            <span class="conv-row__sr">{{ waiting }} waiting for XPro</span>
          </span>
        </span>

        <span class="conv-row__meta">
          <span>{{ item.requestId }}</span>
          <span aria-hidden="true">·</span>
          <span class="conv-row__stage">{{ item.statusLabel }}</span>
          <span aria-hidden="true">·</span>
          <span v-if="item.owner" class="conv-row__owner" :title="item.owner.name">
            <span aria-hidden="true">{{ initials(item.owner.name) }}</span>
            <span class="conv-row__sr">{{ ownerLabel }}</span>
          </span>
          <span v-else>Unclaimed</span>
        </span>
      </span>
    </button>
  </li>
</template>

<style scoped lang="scss">
.conv-row-item {
  list-style: none;
  margin: 0;
  padding: 0;
}

.conv-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  inline-size: 100%;
  min-block-size: 72px;
  padding: 12px 16px;
  border: 0;
  border-block-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-inline-start: 3px solid transparent;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  font: inherit;
  text-align: start;

  &:hover {
    background: rgba(var(--v-theme-on-surface), 0.04);
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--v-theme-primary));
    outline-offset: -2px;
  }

  &--selected,
  &--selected:hover {
    border-inline-start-color: rgb(var(--v-theme-primary));
    background: rgba(var(--v-theme-primary), 0.12);
  }

  // Finished requests are dimmed; the stage label in line 3 still says why.
  &--closed .conv-row__avatar,
  &--closed .conv-row__title,
  &--closed .conv-row__preview {
    opacity: 0.65;
  }
}

.conv-row__avatar {
  flex: none;
}

.conv-row__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-inline-size: 0;
}

.conv-row__line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-inline-size: 0;
}

.conv-row__title {
  overflow: hidden;
  font-size: 0.9375rem;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv-row__time {
  flex: none;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.75rem;
}

.conv-row__preview {
  overflow: hidden;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.8125rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv-row__prefix {
  margin-inline-end: 4px;
}

.conv-row__clip {
  margin-inline-end: 2px;
  vertical-align: -2px;
}

// Messages are waiting for XPro: bold title and preview, like unread in a chat app.
.conv-row--waiting {
  .conv-row__title,
  .conv-row__preview {
    color: rgb(var(--v-theme-on-surface));
    font-weight: 700;
  }

  .conv-row__time {
    color: rgb(var(--v-theme-primary));
    font-weight: 600;
  }
}

.conv-row__badge {
  position: relative;
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  min-inline-size: 20px;
  block-size: 20px;
  padding-inline: 6px;
  border-radius: 10px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-size: 0.75rem;
  font-weight: 600;
}

.conv-row__meta {
  display: flex;
  align-items: center;
  gap: 4px;
  min-inline-size: 0;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.75rem;
  white-space: nowrap;
}

.conv-row__stage {
  overflow: hidden;
  text-overflow: ellipsis;
}

.conv-row__owner {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-inline-size: 20px;
  block-size: 18px;
  padding-inline: 4px;
  border-radius: 9px;
  background: rgba(var(--v-theme-on-surface), 0.08);
  font-size: 0.6875rem;
  font-weight: 600;
}

.conv-row__mark {
  border-radius: 2px;
  background: rgba(var(--v-theme-warning), 0.35);
  color: inherit;
}

.conv-row__sr {
  position: absolute;
  overflow: hidden;
  clip: rect(0 0 0 0);
  block-size: 1px;
  inline-size: 1px;
  white-space: nowrap;
}
</style>
