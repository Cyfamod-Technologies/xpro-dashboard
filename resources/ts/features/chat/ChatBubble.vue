<script setup lang="ts">
import ChatAttachment from "@/features/chat/ChatAttachment.vue"
import type { ChatMessage, ChatViewer } from "@/features/chat/chat-types"
import {
  audienceTag,
  formatMessageTime,
  internalNoteLabel,
  participantColor,
  participantKey,
} from "@/features/chat/chat-types"

const props = defineProps<{
  message: ChatMessage
  viewer: ChatViewer
  /** First bubble of a run from the same sender and audience. */
  first: boolean
  /** Shows the Reply button (staff). */
  canReply?: boolean
}>()
const emit = defineEmits<{ retry: [localId: string]; discard: [localId: string]; reply: [message: ChatMessage] }>()

const isNote = computed(() => props.message.audience === "internal")
// In the staff view XPro staff are on the right, but each still gets a name; everyone else only needs one on the left.
const showName = computed(() => props.first && (!props.message.ownSide || props.viewer === "staff"))
const staffAuthored = computed(() => props.viewer === "staff" && props.message.ownSide)
const tag = computed(() => (staffAuthored.value && !isNote.value ? audienceTag(props.message.audience) : ""))
const time = computed(() => formatMessageTime(props.message.createdAt))
const senderColor = computed(() => participantColor(participantKey(props.message.author)))
const images = computed(() => props.message.attachments.filter(file => file.type.startsWith("image/")))
const files = computed(() => props.message.attachments.filter(file => !file.type.startsWith("image/")))
const label = computed(
  () =>
    `${props.message.author.label}${tag.value ? `, ${tag.value}` : ""}${isNote.value ? `, ${internalNoteLabel}` : ""}, ${time.value}`,
)
</script>

<template>
  <article
    class="chat-bubble"
    :class="{
      'chat-bubble--own': message.ownSide,
      'chat-bubble--first': first,
      'chat-bubble--note': isNote,
      'chat-bubble--failed': message.state === 'failed',
    }"
    :aria-label="label"
    :style="{ '--sender': `var(--v-theme-${senderColor})` }"
  >
    <div class="chat-bubble__body">
      <p v-if="isNote" class="chat-bubble__note-label">
        <VIcon icon="tabler-lock" size="14" />
        {{ internalNoteLabel }}
      </p>
      <p v-if="showName" class="chat-bubble__name">{{ message.author.label }}</p>
      <p v-if="tag" class="chat-bubble__tag">{{ tag }}</p>
      <p v-if="message.text" class="chat-bubble__text">{{ message.text }}</p>
      <div
        v-if="images.length"
        class="chat-bubble__images"
        :class="{ 'chat-bubble__images--one': images.length === 1 }"
      >
        <ChatAttachment v-for="file in images.slice(0, 4)" :key="file.id" :file="file" />
      </div>
      <div v-if="files.length || images.length > 4" class="chat-bubble__files">
        <ChatAttachment v-for="file in [...images.slice(4), ...files]" :key="file.id" :file="file" />
      </div>
      <div class="chat-bubble__meta">
        <VBtn
          v-if="canReply && message.state === 'sent'"
          class="chat-bubble__reply"
          icon="tabler-corner-up-left"
          variant="text"
          size="x-small"
          :aria-label="`Reply to ${message.author.label}`"
          @click="emit('reply', message)"
        />
        <time :datetime="message.createdAt">{{ time }}</time>
        <VIcon v-if="message.state === 'sending'" icon="tabler-clock" size="14" aria-label="Sending" />
      </div>
      <p v-if="message.state === 'failed' && message.localId" class="chat-bubble__failed" role="alert">
        <VIcon icon="tabler-alert-circle" size="14" />
        <span :title="message.error">Not sent.</span>
        <button type="button" class="chat-bubble__link" @click="emit('retry', message.localId)">Retry</button>
        <button type="button" class="chat-bubble__link" @click="emit('discard', message.localId)">Discard</button>
      </p>
    </div>
  </article>
</template>

<style scoped lang="scss">
.chat-bubble {
  display: flex;
  justify-content: flex-start;
  margin-block-start: 2px;

  &--own {
    justify-content: flex-end;
  }

  &--first {
    margin-block-start: 10px;
  }

  &--note {
    justify-content: stretch;
  }
}

.chat-bubble__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-inline-size: 0;
  max-inline-size: min(78%, 36rem);
  padding: 6px 10px 4px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));

  .chat-bubble--first & {
    border-start-start-radius: 0;
  }

  .chat-bubble--own & {
    border-color: transparent;
    background: color-mix(in srgb, rgb(var(--v-theme-primary)) 16%, rgb(var(--v-theme-surface)));
  }

  .chat-bubble--own.chat-bubble--first & {
    border-start-start-radius: 8px;
    border-start-end-radius: 0;
  }

  .chat-bubble.chat-bubble--note & {
    inline-size: 100%;
    max-inline-size: none;
    border-color: color-mix(in srgb, rgb(var(--v-theme-warning)) 45%, transparent);
    border-inline-start: 3px solid rgb(var(--v-theme-warning));
    border-radius: 8px;
    background: color-mix(in srgb, rgb(var(--v-theme-warning)) 14%, rgb(var(--v-theme-surface)));
  }

  .chat-bubble--failed & {
    border-color: rgba(var(--v-theme-error), 0.6);
  }

  p {
    margin: 0;
  }
}

.chat-bubble__name {
  // Mixed toward the text colour so the participant colour stays readable on white and in dark mode.
  color: color-mix(in srgb, rgb(var(--sender)) 65%, rgb(var(--v-theme-on-surface)));
  font-size: 0.8125rem;
  font-weight: 600;
}

.chat-bubble__tag,
.chat-bubble__note-label {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.75rem;
  font-weight: 500;
}

.chat-bubble__note-label {
  display: flex;
  align-items: center;
  gap: 4px;
}

.chat-bubble__text {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.chat-bubble__images {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  margin-block-start: 4px;
  inline-size: min(100%, 18rem);

  &--one {
    grid-template-columns: minmax(0, 1fr);
  }
}

.chat-bubble__files {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-block-start: 4px;
}

.chat-bubble__meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.6875rem;
}

.chat-bubble__reply {
  // Shown on hover or keyboard focus; always present on touch screens.
  opacity: 0;
  transition: opacity 0.15s;

  .chat-bubble__body:hover &,
  .chat-bubble__body:focus-within & {
    opacity: 1;
  }

  @media (hover: none) {
    opacity: 1;
  }
}

.chat-bubble__failed {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  color: rgb(var(--v-theme-error));
  font-size: 0.75rem;
}

.chat-bubble__link {
  min-block-size: 24px;
  padding: 0 4px;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-weight: 600;
  text-decoration: underline;

  &:focus-visible {
    outline: 2px solid currentcolor;
    outline-offset: 1px;
  }

  @media (max-width: 599px) {
    min-block-size: 44px;
    padding-inline: 8px;
  }
}
</style>
