import { isDraftKeyFor } from "@/features/drafts/draft-envelope"
import { clearDraftFilesForOwner } from "@/features/drafts/draft-files"

/** Removes everything saved as drafts for a user. Used when they sign out on purpose. */
export async function clearDraftsForOwner(owner: string): Promise<void> {
  try {
    const store = window.localStorage
    const keys = Array.from({ length: store.length }, (_, index) => store.key(index)).filter(
      (key): key is string => key !== null && isDraftKeyFor(key, owner),
    )

    for (const key of keys) store.removeItem(key)
  } catch {
    /* Storage is unavailable, so there is nothing saved to clear. */
  }
  await clearDraftFilesForOwner(owner)
}
