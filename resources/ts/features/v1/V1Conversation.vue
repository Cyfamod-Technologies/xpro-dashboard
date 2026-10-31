<script setup lang="ts">
import V1CounterCard from "@/features/v1/V1CounterCard.vue"
import V1CounterDialog from "@/features/v1/V1CounterDialog.vue"
import V1AttachmentPreview from "@/features/v1/V1AttachmentPreview.vue"
import { v1Capabilities } from "@/features/v1/access"
import {
  authorLabelFor,
  canCounter,
  counterOpen,
  formatDateTime,
  isSuperseded,
  latestCounter,
} from "@/features/v1/helpers"
import { checkFiles, fileAccept, fileHint } from "@/features/operations/file-rules"
import type { V1Actor, V1Counter, V1Message, V1Status } from "@/features/v1/types"
import { uploadV1Files } from "@/features/v1/uploads"
import { v1Api } from "@/services/v1-api"
import { getErrorMessage } from "@/utils/errors"

const props = defineProps<{
  requestId: string
  status: V1Status
  viewer: V1Actor
  viewerId: string
  /** Fixed scroll height in px for the message list. */
  height?: number
}>()
const emit = defineEmits<{ sent: [message: V1Message] }>()

const messages = ref<V1Message[]>([])
const loading = ref(true)
const loadError = ref("")
const text = ref("")
const files = ref<File[]>([])
const problems = ref<string[]>([])
const sending = ref(false)
const sendError = ref("")
const list = ref<HTMLElement | null>(null)
const picker = ref<HTMLInputElement | null>(null)

const dialogOpen = ref(false)
const dialogMode = ref<"quote" | "counter">("quote")
const dialogSeed = ref<V1Counter | null>(null)

const latest = computed(() => latestCounter(messages.value))
const open = computed(() => counterOpen(props.status))
const showSendQuote = computed(() => v1Capabilities(props.viewer).canSendQuote && open.value)
const counterAllowed = computed(() => canCounter(props.viewerId, latest.value, open.value, props.viewer))
const canSend = computed(() => !sending.value && (text.value.trim() !== "" || files.value.length > 0))

const ownSide = (message: V1Message) =>
  props.viewer === "customer" ? message.authorRole === "customer" : message.authorRole !== "customer"
const labelFor = (message: V1Message) =>
  message.authorId === props.viewerId ? "You" : authorLabelFor(props.viewer, message)

const scrollToEnd = async () => {
  await nextTick()
  if (list.value) list.value.scrollTop = list.value.scrollHeight
}

const load = async () => {
  loadError.value = ""
  try {
    messages.value = await v1Api.messages(props.requestId)
    await scrollToEnd()
  } catch (cause) {
    loadError.value = getErrorMessage(cause, "The conversation could not be loaded.")
  } finally {
    loading.value = false
  }
}

watch(() => props.requestId, load)
onMounted(load)

const pick = (event: Event) => {
  const input = event.target as HTMLInputElement
  const result = checkFiles("message_attachment", Array.from(input.files ?? []), files.value)

  problems.value = result.problems
  files.value = [...files.value, ...result.accepted]
  // Reset so the same file can be picked again after removing it.
  input.value = ""
}

const send = async () => {
  if (!canSend.value) return

  sending.value = true
  sendError.value = ""
  try {
    const attachments = await uploadV1Files(files.value, "message_attachment")
    const message = await v1Api.sendMessage(props.requestId, {
      kind: "text",
      text: text.value.trim(),
      attachments,
    })

    messages.value = [...messages.value, message]
    text.value = ""
    files.value = []
    problems.value = []
    emit("sent", message)
    await scrollToEnd()
  } catch (cause) {
    sendError.value = getErrorMessage(cause, "The message could not be sent.")
  } finally {
    sending.value = false
  }
}

const openQuote = () => {
  dialogMode.value = "quote"
  dialogSeed.value = latest.value?.counter ?? null
  dialogOpen.value = true
}

const openCounter = (message: V1Message) => {
  dialogMode.value = "counter"
  dialogSeed.value = message.counter ?? null
  dialogOpen.value = true
}

const onSent = async (message: V1Message) => {
  // Reload so the previous card shows as superseded.
  await load()
  emit("sent", message)
}

defineExpose({ reload: load })
</script>

<template>
  <VCard variant="outlined">
    <VCardText class="pb-2">
      <div class="d-flex align-center justify-space-between flex-wrap gap-2">
        <h3 class="text-h6">{{ viewer === "customer" ? "Chat with Xpro" : "Chat with customer" }}</h3>
        <VBtn
          v-if="showSendQuote"
          size="small"
          color="primary"
          variant="tonal"
          prepend-icon="tabler-receipt-2"
          @click="openQuote"
        >
          Send quote
        </VBtn>
      </div>
    </VCardText>

    <div
      ref="list"
      class="conversation-list px-4"
      :style="{ maxBlockSize: `${height ?? 420}px` }"
      role="log"
      aria-live="polite"
      aria-label="Conversation"
    >
      <VProgressLinear v-if="loading" indeterminate />
      <VAlert v-else-if="loadError" type="error" variant="tonal" density="compact">
        {{ loadError }}
        <template #append>
          <VBtn size="small" variant="text" @click="load">Retry</VBtn>
        </template>
      </VAlert>
      <p v-else-if="!messages.length" class="text-body-2 text-medium-emphasis text-center my-6">
        No messages yet.
        {{
          viewer === "customer" ? "Ask Xpro a question about your request." : "Message the customer about this request."
        }}
      </p>
      <div
        v-for="message in messages"
        :key="message.id"
        class="message-row"
        :class="{ 'message-row--own': ownSide(message) }"
      >
        <V1CounterCard
          v-if="message.kind === 'counter'"
          :message="message"
          :superseded="isSuperseded(message, messages)"
          :can-counter="counterAllowed && latest?.id === message.id"
          :author-label="labelFor(message)"
          :own="message.authorId === viewerId"
          @counter="openCounter"
        />
        <div v-else class="bubble" :class="{ 'bubble--own': ownSide(message) }">
          <div class="text-caption font-weight-medium">{{ labelFor(message) }}</div>
          <p v-if="message.text" class="bubble-text mb-0">{{ message.text }}</p>
          <div v-for="file in message.attachments" :key="file.id" class="mt-1">
            <V1AttachmentPreview :file="file" />
          </div>
          <div class="text-caption text-medium-emphasis">{{ formatDateTime(message.createdAt) }}</div>
        </div>
      </div>
    </div>

    <VDivider />
    <div class="pa-3">
      <VAlert v-if="sendError" type="error" variant="tonal" density="compact" class="mb-2">{{ sendError }}</VAlert>
      <VAlert v-for="problem in problems" :key="problem" type="warning" variant="tonal" density="compact" class="mb-2">
        {{ problem }}
      </VAlert>
      <div v-if="files.length" class="d-flex flex-wrap gap-2 mb-2">
        <VChip
          v-for="(file, index) in files"
          :key="`${file.name}-${file.size}`"
          closable
          size="small"
          prepend-icon="tabler-paperclip"
          @click:close="files.splice(index, 1)"
        >
          {{ file.name }}
        </VChip>
      </div>
      <div class="d-flex align-end gap-2">
        <VBtn icon="tabler-paperclip" variant="text" aria-label="Attach a file" @click="picker?.click()" />
        <input ref="picker" type="file" multiple hidden :accept="fileAccept('message_attachment')" @change="pick" />
        <VTextarea
          v-model="text"
          class="flex-grow-1"
          rows="1"
          max-rows="5"
          auto-grow
          hide-details
          density="comfortable"
          :placeholder="viewer === 'customer' ? 'Write to Xpro' : 'Write to the customer'"
          aria-label="Message"
          @keydown.ctrl.enter.prevent="send"
          @keydown.meta.enter.prevent="send"
        />
        <VBtn
          icon="tabler-send"
          color="primary"
          :disabled="!canSend"
          :loading="sending"
          aria-label="Send message"
          @click="send"
        />
      </div>
      <div class="text-caption text-medium-emphasis mt-1">{{ fileHint("message_attachment") }}</div>
    </div>

    <V1CounterDialog
      v-model="dialogOpen"
      :request-id="requestId"
      :mode="dialogMode"
      :seed="dialogSeed"
      @sent="onSent"
    />
  </VCard>
</template>

<style scoped>
.conversation-list {
  overflow-y: auto;
  padding-block: 8px;
}

.message-row {
  display: flex;
  justify-content: flex-start;
  margin-block-end: 12px;
}

.message-row--own {
  justify-content: flex-end;
}

.bubble {
  background: rgba(var(--v-theme-on-surface), 0.06);
  border-radius: 12px;
  max-inline-size: min(80%, 460px);
  padding: 8px 12px;
}

.bubble--own {
  background: rgba(var(--v-theme-primary), 0.14);
}

.bubble-text {
  white-space: pre-line;
}
</style>
