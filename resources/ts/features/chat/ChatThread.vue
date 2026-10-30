<script setup lang="ts">
import ChatBubble from "@/features/chat/ChatBubble.vue"
import ChatComposer from "@/features/chat/ChatComposer.vue"
import ChatDayDivider from "@/features/chat/ChatDayDivider.vue"
import type {
  ChatAudience,
  ChatAudienceOption,
  ChatMessage,
  ChatSendInput,
  ChatViewer,
} from "@/features/chat/chat-types"
import { groupByDay, startsRun } from "@/features/chat/chat-types"
import { useChatMessages } from "@/features/chat/use-chat-messages"

// Parents should key this component by request id (`:key="requestId"`) so every conversation starts fresh.
const props = defineProps<{
  requestId: string
  viewer: ChatViewer
  audiences: ChatAudienceOption[]
  defaultAudience?: ChatAudience | null
  /** When set, the composer is replaced by a banner with this text. */
  readOnlyReason?: string
  /** Shows only one audience's messages (the server filters). */
  focus?: ChatAudience | null
  title?: string
  /** Request version sent as `If-Match` when posting. Optional. */
  requestVersion?: number
  providerId?: string
  /** Lets staff quote a message when replying. */
  allowReply?: boolean
}>()
const emit = defineEmits<{
  /** The server accepted a message sent from this thread (the parent can refresh anything that shows a preview). */
  sent: []
}>()

const chat = useChatMessages({
  requestId: props.requestId,
  viewer: props.viewer,
  channel: () => props.focus,
  version: () => props.requestVersion,
  providerId: () => props.providerId,
})
const { messages, loading, error, busy, newSinceSeen } = chat

const scroller = ref<HTMLElement | null>(null)
const content = ref<HTMLElement | null>(null)
const atBottom = ref(true)
const announcement = ref("")
const replyTo = ref<ChatMessage | null>(null)
const composer = ref<InstanceType<typeof ChatComposer> | null>(null)

const days = computed(() => groupByDay(messages.value))
const empty = computed(() => !loading.value && !error.value && messages.value.length === 0)
const emptyText = computed(() =>
  props.viewer === "staff" ? "No messages on this request yet." : "No messages yet. Say hello.",
)
const logLabel = computed(() => (props.title ? `Messages for ${props.title}` : "Messages"))
const showJump = computed(() => !atBottom.value && newSinceSeen.value > 0)

// The composer never starts on a staff note, and a disabled audience is never picked.
const pickDefault = () => {
  const usable = props.audiences.filter(item => !item.disabledReason && item.value !== "internal")
  const wanted = [props.defaultAudience, props.focus].find(value => value && usable.some(item => item.value === value))

  return wanted ?? usable[0]?.value ?? null
}
const audience = ref<ChatAudience | null>(pickDefault())

watch(
  () => props.audiences,
  () => {
    const stillUsable = props.audiences.some(item => item.value === audience.value && !item.disabledReason)

    if (!stillUsable) audience.value = pickDefault()
  },
  { deep: true },
)

function scrollToBottom() {
  const el = scroller.value

  if (!el) return
  el.scrollTop = el.scrollHeight
  atBottom.value = true
  chat.markSeen()
}

function onScroll() {
  const el = scroller.value

  if (!el) return
  atBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 48
  if (atBottom.value) chat.markSeen()
}

// Keep the view on the newest message while the person is there (images and the composer change the height),
// and leave it alone while they read older ones.
useResizeObserver([scroller, content], () => {
  if (atBottom.value) scrollToBottom()
})

const known = new Set<string>()
let initialised = false

// The first load (and a new focus filter) shows the newest message without announcing the history.
watch(
  chat.loaded,
  async ready => {
    known.clear()
    initialised = false
    if (!ready) return
    for (const message of messages.value) known.add(message.id)
    initialised = true
    await nextTick()
    scrollToBottom()
  },
  { flush: "post" },
)

watch(
  messages,
  async list => {
    if (!initialised) return

    const added = list.filter(message => !known.has(message.id))

    for (const message of added) known.add(message.id)
    if (!added.length) return

    const incoming = added.filter(message => !message.ownSide)

    if (incoming.length) {
      const [first] = incoming

      announcement.value = ""
      await nextTick()
      announcement.value =
        incoming.length === 1
          ? `New message from ${first.author.label}: ${first.text.slice(0, 200)}`
          : `${incoming.length} new messages`
    }
    // Own sends (still marked as sending) always scroll into view; other messages only when already at the bottom.
    if (added.some(message => message.localId) || atBottom.value) {
      await nextTick()
      scrollToBottom()
    }
  },
  { flush: "pre" },
)

function reply(message: ChatMessage) {
  replyTo.value = message
  if (props.audiences.some(item => item.value === message.audience && !item.disabledReason))
    audience.value = message.audience
  composer.value?.focus()
}

async function send(input: ChatSendInput) {
  if (await chat.send(input)) emit("sent")
}
</script>

<template>
  <section class="chat-thread" :aria-label="title ? `Conversation: ${title}` : 'Conversation'">
    <header v-if="$slots.header || title" class="chat-thread__header">
      <slot name="header">
        <h2 class="chat-thread__title">{{ title }}</h2>
      </slot>
    </header>

    <VAlert v-if="error" type="error" variant="tonal" density="compact" class="chat-thread__error">
      {{ error }}
      <template #append>
        <VBtn size="small" variant="text" @click="chat.reload()">Retry</VBtn>
      </template>
    </VAlert>

    <div class="chat-thread__stage">
      <div ref="scroller" class="chat-thread__scroller" @scroll.passive="onScroll">
        <div ref="content" class="chat-thread__content">
          <div
            v-if="loading && !messages.length"
            class="chat-thread__skeletons"
            role="status"
            aria-label="Loading messages"
          >
            <div
              v-for="n in 4"
              :key="n"
              class="chat-thread__skeleton"
              :class="{ 'chat-thread__skeleton--own': n % 2 === 0 }"
            />
          </div>
          <p v-else-if="empty" class="chat-thread__empty">{{ emptyText }}</p>

          <div role="log" aria-live="off" :aria-label="logLabel" :aria-busy="loading">
            <template v-for="day in days" :key="day.key">
              <ChatDayDivider :label="day.label" />
              <ChatBubble
                v-for="(message, index) in day.messages"
                :key="message.id"
                :message="message"
                :viewer="viewer"
                :first="startsRun(day.messages[index - 1], message)"
                :can-reply="allowReply"
                @retry="chat.retry"
                @discard="chat.discard"
                @reply="reply"
              />
            </template>
          </div>
        </div>
      </div>

      <VBtn
        v-if="showJump"
        class="chat-thread__jump"
        icon
        color="primary"
        elevation="3"
        :aria-label="`Jump to latest, ${newSinceSeen} new ${newSinceSeen === 1 ? 'message' : 'messages'}`"
        @click="scrollToBottom"
      >
        <VBadge :content="newSinceSeen" color="error" floating>
          <VIcon icon="tabler-arrow-down" />
        </VBadge>
      </VBtn>
    </div>

    <p class="chat-thread__live" aria-live="polite" aria-atomic="true">{{ announcement }}</p>

    <div v-if="readOnlyReason" class="chat-thread__readonly" role="status">
      <VIcon icon="tabler-lock" size="18" />
      {{ readOnlyReason }}
    </div>
    <ChatComposer
      v-else
      ref="composer"
      v-model="audience"
      :viewer="viewer"
      :audiences="audiences"
      :busy="busy"
      :reply-to="replyTo"
      :draft-id="requestId"
      @send="send"
      @clear-reply="replyTo = null"
    />
  </section>
</template>

<style scoped lang="scss">
.chat-thread {
  display: flex;
  flex-direction: column;
  inline-size: 100%;
  block-size: 100%;
  min-block-size: 20rem;
  overflow: hidden;
  background: rgb(var(--v-theme-surface));
}

.chat-thread__header {
  padding: 12px 16px;
  border-block-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.chat-thread__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.chat-thread__error {
  margin: 8px 12px 0;
}

.chat-thread__stage {
  position: relative;
  display: flex;
  flex: 1;
  min-block-size: 0;
}

.chat-thread__scroller {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: rgba(var(--v-theme-on-surface), 0.03);
}

.chat-thread__content {
  min-block-size: 100%;
  padding: 8px 16px 12px;
}

.chat-thread__empty {
  margin: 48px 0;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  text-align: center;
}

.chat-thread__skeletons {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-block: 12px;
}

.chat-thread__skeleton {
  inline-size: 55%;
  block-size: 52px;
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.08);
  animation: chat-pulse 1.4s ease-in-out infinite;

  &--own {
    align-self: flex-end;
    inline-size: 42%;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}

@keyframes chat-pulse {
  50% {
    opacity: 0.5;
  }
}

.chat-thread__jump {
  position: absolute;
  inset-block-end: 12px;
  inset-inline-end: 16px;
}

.chat-thread__live {
  position: absolute;
  overflow: hidden;
  clip: rect(0 0 0 0);
  block-size: 1px;
  inline-size: 1px;
  margin: 0;
  white-space: nowrap;
}

.chat-thread__readonly {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-block-start: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgba(var(--v-theme-on-surface), 0.04);
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.875rem;
}
</style>
