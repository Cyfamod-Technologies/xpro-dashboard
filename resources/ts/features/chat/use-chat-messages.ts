import { requestsApi } from "@/services/requests-api"
import type { ChatAudience, ChatMessage, ChatSendInput, ChatViewer } from "@/features/chat/chat-types"
import { toChatMessages } from "@/features/chat/chat-types"

/** How often the open conversation refreshes while the tab is visible. */
export const chatPollMs = 10_000

export interface ChatMessagesOptions {
  requestId: string
  viewer: ChatViewer
  /** Limits the timeline to one audience. Leave out for the merged timeline. */
  channel?: () => ChatAudience | null | undefined
  /** Request version for `If-Match`. The message endpoint works without it. */
  version?: () => number | undefined
  /** Provider the message is about, for staff writing to a provider. */
  providerId?: () => string | undefined
}

interface PendingSend {
  localId: string
  input: ChatSendInput
  createdAt: string
  state: "sending" | "sent" | "failed"
  error?: string
  /** The server accepted it; the entry stays visible until a fresh load has brought the real message in. */
  delivered: boolean
  /** Uploads that already finished, so a retry does not upload them again. */
  uploaded: Array<{ id: string }>
  idempotencyKey: string
}

const optimisticRole: Record<ChatViewer, string> = { staff: "staff", customer: "customer", provider: "provider" }

// Same upload flow as the request lifecycle screen: create, PUT the bytes, then mark the upload complete.
async function uploadFiles(files: File[], uploaded: Array<{ id: string }>) {
  for (const file of files.slice(uploaded.length)) {
    const upload = await requestsApi.createUpload({
      name: file.name,
      size: file.size,
      type: file.type,
      purpose: "message_attachment",
    })
    const response = await fetch(upload.uploadUrl, { method: upload.method, headers: upload.headers, body: file })

    if (!response.ok) throw new Error(`Could not upload ${file.name}.`)
    await requestsApi.completeUpload(upload.id)
    uploaded.push({ id: upload.id })
  }

  return uploaded
}

/** Loads, polls and sends messages for one request. Create one per conversation (key the parent by request id). */
export function useChatMessages(options: ChatMessagesOptions) {
  const server = shallowRef<ChatMessage[]>([])
  const pending = ref<PendingSend[]>([])
  const loading = ref(true)
  const error = ref("")
  const loaded = ref(false)
  const seen = shallowRef(new Set<string>())
  let sequence = 0

  const channel = () => options.channel?.() ?? undefined

  const pendingMessages = computed<ChatMessage[]>(() =>
    pending.value
      .filter(entry => !channel() || channel() === entry.input.audience)
      .map(entry => ({
        id: entry.localId,
        localId: entry.localId,
        audience: entry.input.audience,
        providerId: null,
        text: entry.input.text,
        createdAt: entry.createdAt,
        author: { role: optimisticRole[options.viewer], label: "You" },
        attachments: entry.input.files.map((file, index) => ({
          id: `${entry.localId}-${index}`,
          name: file.name,
          type: file.type,
          size: file.size,
          local: true,
        })),
        ownSide: true,
        state: entry.state,
        error: entry.error,
      })),
  )

  /** Server messages followed by the ones still being sent. */
  const messages = computed(() => [...server.value, ...pendingMessages.value])

  /** Messages from the server that arrived after the last `markSeen()`. */
  const newSinceSeen = computed(() => server.value.filter(message => !seen.value.has(message.id)).length)

  function markSeen() {
    seen.value = new Set(server.value.map(message => message.id))
  }

  // Messages never change, so an id that is already known keeps its object and the list is only ever appended to.
  function merge(next: ChatMessage[]) {
    const known = new Map(server.value.map(message => [message.id, message]))
    const merged = next.map(message => known.get(message.id) ?? message)
    const unchanged =
      merged.length === server.value.length && merged.every((message, index) => message === server.value[index])

    if (!unchanged) server.value = merged
  }

  /** Fetches the conversation. `quiet` loads (polling) never show the skeletons. */
  async function load(quiet = false) {
    const current = ++sequence
    const settled = pending.value.filter(entry => entry.delivered).map(entry => entry.localId)

    if (!quiet && !loaded.value) loading.value = true
    try {
      const raw = await requestsApi.messages(options.requestId, { channel: channel() })

      // A newer load started meanwhile; its result is the one to keep.
      if (current !== sequence) return
      merge(toChatMessages(raw, options.viewer))
      pending.value = pending.value.filter(entry => !settled.includes(entry.localId))
      error.value = ""
      if (!loaded.value) {
        loaded.value = true
        markSeen()
      }
    } catch (cause) {
      if (current !== sequence) return
      error.value = cause instanceof Error ? cause.message : "The messages could not be loaded."
    } finally {
      if (current === sequence) loading.value = false
    }
  }

  const reload = () => load(false)

  async function deliver(entry: PendingSend) {
    entry.state = "sending"
    entry.error = undefined
    try {
      const attachments = await uploadFiles(entry.input.files, entry.uploaded)

      await requestsApi.sendMessage(
        options.requestId,
        {
          channel: entry.input.audience,
          text: entry.input.text,
          attachments,
          ...(options.providerId?.() ? { providerId: options.providerId() } : {}),
        },
        options.version?.(),
        entry.idempotencyKey,
      )
      entry.delivered = true
      entry.state = "sent"
      await load(true)
    } catch (cause) {
      entry.state = "failed"
      entry.error = cause instanceof Error ? cause.message : "The message could not be sent."
    }
  }

  /** Adds the message straight away as "sending", then sends it. Resolves to true when the server accepted it. */
  async function send(input: ChatSendInput) {
    const entry = reactive<PendingSend>({
      localId: `local-${globalThis.crypto.randomUUID()}`,
      input: { ...input, files: [...input.files] },
      createdAt: new Date().toISOString(),
      state: "sending",
      delivered: false,
      uploaded: [],
      idempotencyKey: globalThis.crypto.randomUUID(),
    })

    pending.value = [...pending.value, entry]
    await deliver(entry)

    return entry.delivered
  }

  /** Tries a failed message again with its original text and files. */
  async function retry(localId: string) {
    const entry = pending.value.find(item => item.localId === localId && item.state === "failed")

    if (!entry) return false
    await deliver(entry)

    return entry.delivered
  }

  /** Drops a failed message the person no longer wants to send. */
  function discard(localId: string) {
    pending.value = pending.value.filter(entry => entry.localId !== localId)
  }

  const busy = computed(() => pending.value.some(entry => entry.state === "sending" && !entry.delivered))

  const visibility = useDocumentVisibility()
  const { pause, resume } = useIntervalFn(() => load(true), chatPollMs, { immediate: false })

  // Poll only while the tab is visible and refresh at once when it comes back.
  watch(visibility, state => {
    if (state === "visible") {
      void load(true)
      resume()
    } else pause()
  })
  if (visibility.value === "visible") resume()

  watch(channel, () => {
    server.value = []
    loaded.value = false
    void load()
  })

  void load()

  return { messages, loading, loaded, error, busy, newSinceSeen, reload, send, retry, discard, markSeen }
}

export type ChatMessages = ReturnType<typeof useChatMessages>
