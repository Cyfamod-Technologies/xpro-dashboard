<script setup lang="ts">
import { useDisplay } from "vuetify"
import { useAuthStore } from "@/stores/auth"
import { useFormDraft } from "@/features/drafts/use-form-draft"
import { checkFiles, fileAccept, fileRules, formatFileSize } from "@/features/operations/file-rules"
import type {
  ChatAudience,
  ChatAudienceOption,
  ChatMessage,
  ChatSendInput,
  ChatViewer,
} from "@/features/chat/chat-types"
import { audienceHelp, audienceLabel } from "@/features/chat/chat-types"

const props = defineProps<{
  viewer: ChatViewer
  /** Audiences the person may write to. Empty means they cannot send at all. */
  audiences: ChatAudienceOption[]
  /** The chosen audience. The parent sets the default; it is never remembered between conversations. */
  modelValue: ChatAudience | null
  busy?: boolean
  /** Message being answered, shown as a quote above the text box. */
  replyTo?: ChatMessage | null
  /** Conversation id used to keep unsent text (the request id). Leave out to keep nothing. */
  draftId?: string
}>()
const emit = defineEmits<{
  "update:modelValue": [value: ChatAudience]
  send: [input: ChatSendInput]
  clearReply: []
}>()

const maxLength = 4000
const counterFrom = 3600
const auth = useAuthStore()
const { smAndDown } = useDisplay()
const uid = useId()
const helperId = `${uid}-helper`
const counterId = `${uid}-counter`

const text = ref("")
const files = ref<File[]>([])
const problems = ref<string[]>([])
const field = ref<HTMLTextAreaElement | null>(null)
const picker = ref<HTMLInputElement | null>(null)

const isStaff = computed(() => props.viewer === "staff")
const current = computed(() => props.audiences.find(item => item.value === props.modelValue))
const canSend = computed(
  () =>
    !!current.value &&
    !current.value.disabledReason &&
    !props.busy &&
    (text.value.trim() !== "" || files.value.length > 0),
)
const helper = computed(() => (isStaff.value && props.modelValue ? audienceHelp[props.modelValue] : ""))
const describedBy = computed(
  () =>
    [helper.value ? helperId : "", text.value.length >= counterFrom ? counterId : ""].filter(Boolean).join(" ") ||
    undefined,
)
const replyPreview = computed(() => (props.replyTo?.text || "Attachment").slice(0, 140))

// Unsent text survives a reload or switching conversation. The audience is deliberately not saved.
if (props.draftId) {
  const draft = useFormDraft<{ text: string }>({
    formId: `chat-${props.draftId}`,
    version: 1,
    owner: () => auth.user?.id ?? "guest",
    snapshot: () => ({ text: text.value }),
    restore: data => {
      text.value = data.text
    },
  })

  onMounted(async () => {
    await draft.start()
    resize()
  })
}

function resize() {
  const el = field.value

  if (!el) return
  el.style.height = "auto"
  el.style.height = `${el.scrollHeight}px`
}

watch(text, () => nextTick(resize))

function addFiles(picked: File[]) {
  if (!picked.length) return

  const result = checkFiles("message_attachment", picked, files.value)

  problems.value = result.problems
  if (result.accepted.length) files.value = [...files.value, ...result.accepted]
}

function onPick(event: Event) {
  const input = event.target as HTMLInputElement

  addFiles(Array.from(input.files ?? []))
  // Reset so the same file can be picked again after removing it.
  input.value = ""
}

function removeFile(index: number) {
  files.value = files.value.filter((_, position) => position !== index)
  problems.value = []
}

function onPaste(event: ClipboardEvent) {
  const images = Array.from(event.clipboardData?.files ?? []).filter(file => file.type.startsWith("image/"))

  if (!images.length) return
  // Screenshots all arrive as "image.png", so give each a name of its own.
  addFiles(
    images.map(
      (file, index) =>
        new File([file], `pasted-${Date.now()}-${index + 1}.${file.type.split("/")[1] ?? "png"}`, {
          type: file.type,
          lastModified: Date.now(),
        }),
    ),
  )
  if (!event.clipboardData?.getData("text/plain")) event.preventDefault()
}

function submit() {
  if (!canSend.value || !props.modelValue) return
  emit("send", {
    audience: props.modelValue,
    text: text.value.trim(),
    files: files.value,
    replyToId: props.replyTo?.id ?? null,
  })
  // A failed send stays in the timeline with its text and files, so the box can be emptied now.
  text.value = ""
  files.value = []
  problems.value = []
  if (props.replyTo) emit("clearReply")
  nextTick(() => {
    resize()
    field.value?.focus()
  })
}

function onKeydown(event: KeyboardEvent) {
  // Enter sends on desktop; on phones it adds a line and the Send button sends.
  if (event.key !== "Enter" || event.shiftKey || event.isComposing || smAndDown.value) return
  event.preventDefault()
  submit()
}

function choose(value: ChatAudience) {
  emit("update:modelValue", value)
  nextTick(() => field.value?.focus())
}

defineExpose({ focus: () => field.value?.focus() })
</script>

<template>
  <div v-if="!audiences.length" class="chat-composer__readonly" role="status">
    <VIcon icon="tabler-lock" size="18" />
    Your role cannot send messages on this request.
  </div>

  <form v-else class="chat-composer" :class="modelValue ? `chat-composer--${modelValue}` : ''" @submit.prevent="submit">
    <div v-if="replyTo" class="chat-composer__quote">
      <div class="chat-composer__quote-text">
        <strong>{{ replyTo.author.label }}</strong>
        <span>{{ replyPreview }}</span>
      </div>
      <VBtn icon="tabler-x" variant="text" size="small" aria-label="Cancel reply" @click="emit('clearReply')" />
    </div>

    <div v-if="isStaff" class="chat-composer__audience">
      <VMenu>
        <template #activator="{ props: menu }">
          <VBtn
            v-bind="menu"
            class="chat-composer__chip"
            variant="tonal"
            size="small"
            append-icon="tabler-chevron-down"
            :aria-label="`Reply to ${current ? audienceLabel(current.value) : 'choose an audience'}`"
          >
            Reply to: {{ current ? audienceLabel(current.value) : "Choose" }}
          </VBtn>
        </template>
        <VList density="compact" aria-label="Reply to">
          <VListItem
            v-for="item in audiences"
            :key="item.value"
            :active="item.value === modelValue"
            :disabled="!!item.disabledReason"
            :title="audienceLabel(item.value)"
            :subtitle="item.disabledReason"
            @click="choose(item.value)"
          />
        </VList>
      </VMenu>
    </div>

    <div v-if="files.length" class="chat-composer__files">
      <VChip
        v-for="(file, index) in files"
        :key="`${file.name}-${file.size}-${file.lastModified}`"
        size="small"
        closable
        close-label="Remove file"
        prepend-icon="tabler-paperclip"
        @click:close="removeFile(index)"
      >
        {{ file.name }} · {{ formatFileSize(file.size) }}
      </VChip>
    </div>
    <ul v-if="problems.length" class="chat-composer__problems" role="alert">
      <li v-for="problem in problems" :key="problem">{{ problem }}</li>
    </ul>

    <div class="chat-composer__row">
      <VBtn
        class="chat-composer__icon"
        icon="tabler-plus"
        variant="text"
        :aria-label="`Attach files. ${fileRules.message_attachment.formats}, up to ${fileRules.message_attachment.maxFiles} files.`"
        :disabled="files.length >= fileRules.message_attachment.maxFiles"
        @click="picker?.click()"
      />
      <input ref="picker" type="file" multiple hidden :accept="fileAccept('message_attachment')" @change="onPick" />
      <textarea
        ref="field"
        v-model="text"
        class="chat-composer__field"
        rows="1"
        :maxlength="maxLength"
        :aria-describedby="describedBy"
        aria-label="Message"
        placeholder="Write a message"
        enterkeyhint="enter"
        @keydown="onKeydown"
        @paste="onPaste"
      />
      <VBtn
        class="chat-composer__icon"
        type="submit"
        icon="tabler-send"
        color="primary"
        variant="flat"
        aria-label="Send message"
        :disabled="!canSend"
        :loading="busy"
      />
    </div>

    <div class="chat-composer__foot">
      <span v-if="helper" :id="helperId" class="chat-composer__helper">{{ helper }}</span>
      <span v-if="text.length >= counterFrom" :id="counterId" class="chat-composer__counter">
        {{ text.length.toLocaleString() }} / {{ maxLength.toLocaleString() }}
      </span>
    </div>
  </form>
</template>

<style scoped lang="scss">
.chat-composer {
  --tint: transparent;

  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 12px 6px;
  border-block-start: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: color-mix(in srgb, var(--tint) 10%, rgb(var(--v-theme-surface)));

  &--customer {
    --tint: rgb(var(--v-theme-primary));
  }

  &--provider {
    --tint: rgb(var(--v-theme-info));
  }

  &--internal {
    --tint: rgb(var(--v-theme-warning));
  }
}

.chat-composer__readonly {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-block-start: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgba(var(--v-theme-on-surface), 0.04);
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.875rem;
}

.chat-composer__quote {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 4px 4px 10px;
  border-inline-start: 3px solid rgb(var(--v-theme-primary));
  border-radius: 4px;
  background: rgba(var(--v-theme-on-surface), 0.05);
  font-size: 0.8125rem;
}

.chat-composer__quote-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-inline-size: 0;

  span {
    overflow: hidden;
    color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.chat-composer__audience {
  display: flex;
}

.chat-composer__files {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chat-composer__problems {
  margin: 0;
  padding-inline-start: 18px;
  color: rgb(var(--v-theme-error));
  font-size: 0.8125rem;
}

.chat-composer__row {
  display: flex;
  align-items: flex-end;
  gap: 6px;
}

.chat-composer__field {
  flex: 1;
  min-inline-size: 0;
  max-block-size: calc(6 * 1.5em + 20px);
  padding: 10px 14px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 20px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  font: inherit;
  line-height: 1.5;
  overflow-y: auto;
  resize: none;

  &:focus-visible {
    border-color: rgb(var(--v-theme-primary));
    outline: 1px solid rgb(var(--v-theme-primary));
  }

  &::placeholder {
    color: rgba(var(--v-theme-on-surface), var(--v-disabled-opacity));
  }
}

.chat-composer__foot {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  min-block-size: 16px;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.75rem;
}

.chat-composer__counter {
  margin-inline-start: auto;
}

@media (max-width: 959px) {
  .chat-composer__icon {
    min-inline-size: 44px;
    min-block-size: 44px;
  }

  .chat-composer__chip {
    min-block-size: 44px;
  }

  .chat-composer__field {
    min-block-size: 44px;
  }
}
</style>
