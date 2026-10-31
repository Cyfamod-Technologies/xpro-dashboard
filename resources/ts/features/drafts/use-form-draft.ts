import type { Ref } from "vue"
import type { DraftEnvelope, LegacyDrafts } from "@/features/drafts/draft-envelope"
import { draftStorageKey, readMigratedDraft, wrapDraft } from "@/features/drafts/draft-envelope"
import { clearDraftFiles, loadDraftFiles, saveDraftFiles } from "@/features/drafts/draft-files"

export type DraftStatus = "idle" | "saving" | "saved" | "unavailable"

export interface FormDraftOptions<T> {
  /** Stable form name, e.g. "request". Part of the storage key. */
  formId: string
  /** Bump when the shape of `snapshot()` changes; older drafts are then discarded. */
  version: number
  /** Older shapes to migrate on load instead of discarding. Without it, a draft from another version is dropped. */
  legacy?: LegacyDrafts<T>
  /** Who the draft belongs to: a user id, or "guest" when signed out. */
  owner: () => string
  /** The serialisable form state. Read inside a watcher, so every field it touches is tracked. */
  snapshot: () => T
  /** Applies saved data to the form. Also used to put the form back to its starting state on discard. */
  restore: (data: T) => void | Promise<void>
  /** Queued files to keep, by group name. They are stored in IndexedDB. */
  files?: Record<string, Ref<File[]>>
  /** Called after files were loaded back into their refs. */
  onFilesRestored?: (groups: Record<string, File[]>) => void
  /** Called after the user discards the draft, once `restore` has reset the text fields. */
  onDiscard?: () => void
  /** Fingerprint of the server data the form was seeded from. A changed value asks before restoring. */
  base?: () => string | undefined
  /** Return false to skip drafts entirely (e.g. a profile locked for review). */
  enabled?: () => boolean
  /** On first start by a signed-in user, take over a draft that was begun as a guest. */
  adoptGuest?: boolean
}

const saveDelayMs = 500

const readStore = (): Storage | null => {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function useFormDraft<T>(options: FormDraftOptions<T>) {
  const status = ref<DraftStatus>("idle")
  const savedAt = ref<number | null>(null)
  const restoredAt = ref<number | null>(null)
  const filesLost = ref(false)
  /** Set when the server data changed since the draft was saved; resolve it with `resolveConflict`. */
  const conflict = shallowRef<DraftEnvelope<T> | null>(null)

  const scope = getCurrentScope()
  const fileRefs = Object.entries(options.files ?? {})
  let started = false
  let suspended = false
  let key = ""
  let baselineJson = ""
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending = false
  let dirtyFiles = false

  const hasFiles = () => fileRefs.some(([, source]) => source.value.length > 0)
  const groups = () => Object.fromEntries(fileRefs.map(([name, source]) => [name, source.value]))

  async function save() {
    pending = false
    if (suspended) return

    const store = readStore()

    if (!store) {
      status.value = "unavailable"

      return
    }

    const json = JSON.stringify(options.snapshot())
    const untouched = json === baselineJson && !hasFiles()

    try {
      if (untouched) store.removeItem(key)
      else store.setItem(key, JSON.stringify(wrapDraft(JSON.parse(json) as T, options.version, Date.now(), options.base?.())))
    } catch {
      status.value = "unavailable"

      return
    }
    if (untouched) {
      if (dirtyFiles) await clearDraftFiles(key)
      dirtyFiles = false
      savedAt.value = null
      status.value = "idle"

      return
    }
    if (dirtyFiles) {
      dirtyFiles = false
      filesLost.value = hasFiles() && !(await saveDraftFiles(key, groups()))
    }
    savedAt.value = Date.now()
    status.value = "saved"
  }

  function schedule() {
    if (suspended) return
    pending = true
    status.value = "saving"
    clearTimeout(timer)
    timer = setTimeout(save, saveDelayMs)
  }

  /** Saves right away when a change is waiting; used when the page is hidden or the form is left. */
  function flush() {
    if (!started || !pending) return
    clearTimeout(timer)
    void save()
  }

  function watchChanges() {
    scope?.run(() => {
      watch(options.snapshot, schedule, { deep: true })
      watch(
        () => fileRefs.map(([, source]) => source.value),
        () => {
          dirtyFiles = true
          schedule()
        },
      )
    })
  }

  async function restoreFiles(fromKey: string) {
    const stored = await loadDraftFiles(fromKey)

    for (const [name, source] of fileRefs) if (stored[name]?.length) source.value = stored[name]
    options.onFilesRestored?.(stored)
  }

  async function apply(envelope: DraftEnvelope<T>, fromKey: string) {
    await options.restore(envelope.data)
    restoredAt.value = envelope.savedAt
    savedAt.value = envelope.savedAt
    status.value = "saved"
    if (fileRefs.length) await restoreFiles(fromKey)
    if (fromKey !== key) {
      // Taken over from a guest draft: write it under the user's key and drop the guest copy.
      dirtyFiles = hasFiles()
      readStore()?.removeItem(fromKey)
      await clearDraftFiles(fromKey)
      await save()
    }
  }

  /** Reads any saved draft, restores it and starts autosaving. Call once, after the form holds its starting values. */
  async function start() {
    if (started || typeof window === "undefined") return false
    started = true
    key = draftStorageKey(options.formId, options.owner())
    baselineJson = JSON.stringify(options.snapshot())

    const store = readStore()

    if (!store) {
      status.value = "unavailable"
      watchChanges()

      return false
    }
    if (options.enabled && !options.enabled()) {
      suspended = true

      return false
    }

    let fromKey = key
    let envelope = readMigratedDraft<T>(store.getItem(key), options.version, options.legacy)

    if (!envelope && options.adoptGuest && options.owner() !== "guest") {
      fromKey = draftStorageKey(options.formId, "guest")
      envelope = readMigratedDraft<T>(store.getItem(fromKey), options.version, options.legacy)
    }
    if (!envelope) {
      // Unreadable, expired or outdated drafts are dropped rather than left behind.
      store.removeItem(key)
      watchChanges()

      return false
    }

    const expected = options.base?.()

    if (envelope.base !== undefined && expected !== undefined && envelope.base !== expected) {
      conflict.value = envelope

      return false
    }
    await apply(envelope, fromKey)
    watchChanges()

    return true
  }

  /** Answers the "your data changed since this draft" question. */
  async function resolveConflict(restore: boolean) {
    const envelope = conflict.value

    conflict.value = null
    if (envelope && restore) await apply(envelope, key)
    else await discard(false)
    watchChanges()
  }

  async function removeStored() {
    clearTimeout(timer)
    pending = false
    try {
      readStore()?.removeItem(key)
    } catch {
      /* Nothing to remove. */
    }
    await clearDraftFiles(key)
  }

  /** Throws the draft away and puts the form back to how it started. */
  async function discard(reset = true) {
    await removeStored()
    restoredAt.value = null
    savedAt.value = null
    status.value = "idle"
    filesLost.value = false
    if (!reset) return
    await options.restore(JSON.parse(baselineJson) as T)
    for (const [, source] of fileRefs) source.value = []
    options.onDiscard?.()
  }

  /** Call after a successful submit: removes the draft and stops saving until `resume()`. */
  async function clear() {
    suspended = true
    await removeStored()
    restoredAt.value = null
    savedAt.value = null
    status.value = "idle"
  }

  function resume() {
    suspended = false
    baselineJson = JSON.stringify(options.snapshot())
  }

  if (typeof window !== "undefined") {
    useEventListener(window, "pagehide", flush)
    useEventListener(document, "visibilitychange", () => {
      if (document.visibilityState === "hidden") flush()
    })
  }
  onScopeDispose(flush)

  return { status, savedAt, restoredAt, filesLost, conflict, start, discard, clear, resume, resolveConflict }
}

export type FormDraft = ReturnType<typeof useFormDraft>
