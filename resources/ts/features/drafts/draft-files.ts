import { isDraftKeyFor } from "@/features/drafts/draft-envelope"

/**
 * Queued `File` objects cannot go in localStorage, so drafts keep them in IndexedDB.
 * Every function resolves instead of throwing: a draft without its files is still a useful draft.
 */
const dbName = "xpro-drafts"
const storeName = "files"

interface StoredFile {
  draftKey: string
  group: string
  name: string
  type: string
  size: number
  lastModified: number
  file: Blob
}

const open = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB is unavailable."))

    const request = indexedDB.open(dbName, 1)

    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(storeName, { autoIncrement: true })

      store.createIndex("draftKey", "draftKey")
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

const finish = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })

const deleteForKey = (store: IDBObjectStore, draftKey: string) => {
  const cursor = store.index("draftKey").openKeyCursor(IDBKeyRange.only(draftKey))

  cursor.onsuccess = () => {
    if (!cursor.result) return
    store.delete(cursor.result.primaryKey)
    cursor.result.continue()
  }
}

/** Replaces every stored file for a draft. Returns false when the files could not be saved. */
export async function saveDraftFiles(draftKey: string, groups: Record<string, File[]>): Promise<boolean> {
  try {
    const db = await open()
    const transaction = db.transaction(storeName, "readwrite")
    const store = transaction.objectStore(storeName)

    deleteForKey(store, draftKey)
    for (const [group, files] of Object.entries(groups))
      for (const file of files)
        store.add({
          draftKey,
          group,
          name: file.name,
          type: file.type,
          size: file.size,
          lastModified: file.lastModified,
          file,
        } satisfies StoredFile)
    await finish(transaction)
    db.close()

    return true
  } catch {
    return false
  }
}

export async function loadDraftFiles(draftKey: string): Promise<Record<string, File[]>> {
  const groups: Record<string, File[]> = {}

  try {
    const db = await open()
    const request = db
      .transaction(storeName)
      .objectStore(storeName)
      .index("draftKey")
      .getAll(IDBKeyRange.only(draftKey))
    const rows = await new Promise<StoredFile[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as StoredFile[])
      request.onerror = () => reject(request.error)
    })

    db.close()
    for (const row of rows)
      (groups[row.group] ??= []).push(
        new File([row.file], row.name, { type: row.type, lastModified: row.lastModified }),
      )
  } catch {
    /* Nothing to restore. */
  }

  return groups
}

export async function clearDraftFiles(draftKey: string): Promise<void> {
  try {
    const db = await open()
    const transaction = db.transaction(storeName, "readwrite")

    deleteForKey(transaction.objectStore(storeName), draftKey)
    await finish(transaction)
    db.close()
  } catch {
    /* Nothing to clear. */
  }
}

/** Removes the stored files of every draft owned by a user (used on sign-out). */
export async function clearDraftFilesForOwner(owner: string): Promise<void> {
  try {
    const db = await open()
    const transaction = db.transaction(storeName, "readwrite")
    const store = transaction.objectStore(storeName)
    const cursor = store.openCursor()

    cursor.onsuccess = () => {
      if (!cursor.result) return
      if (isDraftKeyFor((cursor.result.value as StoredFile).draftKey, owner)) cursor.result.delete()
      cursor.result.continue()
    }
    await finish(transaction)
    db.close()
  } catch {
    /* Nothing to clear. */
  }
}
