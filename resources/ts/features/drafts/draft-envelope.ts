/** Drafts older than this are dropped instead of restored. */
export const draftTtlMs = 14 * 24 * 60 * 60 * 1000

export const draftKeyPrefix = "xpro:draft:"

export interface DraftEnvelope<T> {
  /** Form shape version. A draft saved with another version is discarded. */
  v: number
  savedAt: number
  /** Fingerprint of the server data the draft was started from, when the form has any. */
  base?: string
  data: T
}

export const draftStorageKey = (formId: string, owner: string) => `${draftKeyPrefix}${formId}:${owner}`

export const wrapDraft = <T>(data: T, version: number, now = Date.now(), base?: string): DraftEnvelope<T> => ({
  v: version,
  savedAt: now,
  ...(base === undefined ? {} : { base }),
  data,
})

/** Parses a stored draft. Returns null when it is missing, unreadable, from another version or expired. */
export const readDraft = <T>(
  raw: string | null,
  version: number,
  now = Date.now(),
  ttlMs = draftTtlMs,
): DraftEnvelope<T> | null => {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<DraftEnvelope<T>> | null

    if (!parsed || typeof parsed !== "object") return null
    if (parsed.v !== version || typeof parsed.savedAt !== "number" || !("data" in parsed)) return null
    if (now - parsed.savedAt > ttlMs || parsed.savedAt > now + 60_000) return null

    return parsed as DraftEnvelope<T>
  } catch {
    return null
  }
}

/** Older draft shapes a form can still read. `migrate` returns the current shape, or null to drop the draft. */
export interface LegacyDrafts<T> {
  versions: number[]
  migrate: (data: unknown, fromVersion: number) => T | null
}

/** Like `readDraft`, but a draft saved with one of `legacy.versions` is migrated to the current shape instead of dropped. */
export const readMigratedDraft = <T>(
  raw: string | null,
  version: number,
  legacy?: LegacyDrafts<T>,
  now = Date.now(),
): DraftEnvelope<T> | null => {
  const current = readDraft<T>(raw, version, now)

  if (current || !legacy) return current
  for (const from of legacy.versions) {
    const old = readDraft<unknown>(raw, from, now)

    if (!old) continue

    const data = legacy.migrate(old.data, from)

    return data === null ? null : { ...old, v: version, data }
  }

  return null
}

/** A draft that matches the form's starting state carries no work worth keeping. */
export const sameDraftData = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Small, stable fingerprint (djb2) used to notice that the server data behind a draft has changed. */
export const hashString = (value: string) => {
  let hash = 5381

  for (let index = 0; index < value.length; index++) hash = ((hash << 5) + hash + value.charCodeAt(index)) | 0

  return (hash >>> 0).toString(36)
}

/** True when a storage key belongs to the given owner (a user id or "guest"). */
export const isDraftKeyFor = (key: string, owner: string) => key.startsWith(draftKeyPrefix) && key.endsWith(`:${owner}`)
