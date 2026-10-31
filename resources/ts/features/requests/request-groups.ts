/**
 * Pure rules behind the request list's project bundles (Spec 04 §4.1a, §6.4, §6.21, §11.2; MS-4, MS-5).
 * A bundle is a set of independent requests linked by a group id: nothing here changes how one request behaves.
 */

/** Child titles are `{project title} — {leaf name}` (Spec 04 §6.2). */
const TITLE_SEPARATOR = " — "

/** Statuses a request can no longer be cancelled from (`cancelling` already has a cancellation under way). */
const NOT_CANCELLABLE_STATUSES = new Set(["closed", "cancelled", "rejected", "cancelling"])

export const CANCEL_NOTE_MIN = 5
export const CANCEL_NOTE_MAX = 1000
export const cancelNoteMessage = "Add a reason between 5 and 1000 characters."

export const BRIEF_MIN = 20
export const BRIEF_MAX = 1000
export const briefMessage = "Write the brief providers will see in the offer (at least 20 characters)."
export const contactCheckMessage =
  "Confirm the offer brief contains no phone numbers, email addresses or site access details."

/** The list fields the grouping reads. `groupPosition` is the card order on the form, from 0. */
export interface GroupableItem {
  id: string
  title?: string
  groupId?: string | null
  groupRef?: string | null
  groupPosition?: number | null
}

export interface SingleEntry<T> {
  kind: "single"
  item: T
}

export interface GroupEntry<T> {
  kind: "group"
  groupId: string

  /** `XPG-nnnnn`; empty only if the server sent a group id without its ref. */
  ref: string

  /** The project title, read from the children (the list does not carry the group itself). */
  title: string

  /** Children in `groupPosition` order. */
  items: T[]
}

export type RequestListEntry<T> = SingleEntry<T> | GroupEntry<T>

const positionOf = (item: GroupableItem) => item.groupPosition ?? Number.MAX_SAFE_INTEGER

/** Stable sort by `groupPosition`, requests without one last. */
const byPosition = <T extends GroupableItem>(items: T[]) =>
  items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => positionOf(a.item) - positionOf(b.item) || a.index - b.index)
    .map(entry => entry.item)

/**
 * The project title shared by a group's children. Each child title is `{project title} — {leaf name}`, so take the part
 * before the last separator and use the one most children agree on (staff can edit a child's title); fall back to the
 * group ref when no child title has the shape.
 */
export const groupTitle = (items: GroupableItem[], ref: string) => {
  const counts = new Map<string, number>()

  for (const item of items) {
    const title = item.title ?? ""
    const cut = title.lastIndexOf(TITLE_SEPARATOR)
    const prefix = cut > 0 ? title.slice(0, cut).trim() : ""

    if (prefix) counts.set(prefix, (counts.get(prefix) ?? 0) + 1)
  }

  let best = ""
  let bestCount = 0

  for (const [prefix, count] of counts) {
    if (count > bestCount) {
      best = prefix
      bestCount = count
    }
  }

  return best || ref || "Project"
}

/**
 * Turns a page of list items into display entries. Ungrouped items stay singles; items sharing a `groupId` become one
 * group entry placed where the group's first item appeared, with its children in `groupPosition` order.
 */
export const groupRequests = <T extends GroupableItem>(items: T[]): Array<RequestListEntry<T>> => {
  const entries: Array<RequestListEntry<T>> = []
  const groups = new Map<string, GroupEntry<T>>()

  for (const item of items) {
    if (!item.groupId) {
      entries.push({ kind: "single", item })

      continue
    }

    const existing = groups.get(item.groupId)

    if (existing) {
      existing.items.push(item)
      if (!existing.ref && item.groupRef) existing.ref = item.groupRef

      continue
    }

    const entry: GroupEntry<T> = {
      kind: "group",
      groupId: item.groupId,
      ref: item.groupRef ?? "",
      title: "",
      items: [item],
    }

    groups.set(item.groupId, entry)
    entries.push(entry)
  }

  for (const entry of groups.values()) {
    entry.items = byPosition(entry.items)
    entry.title = groupTitle(entry.items, entry.ref)
  }

  return entries
}

export interface CancellableFields extends GroupableItem {
  status: string
  overlays?: { cancellation: string | null } | null
}

/** The group's requests that are still open and have no cancellation waiting for a decision, in `groupPosition` order. */
export const cancellableSiblings = <T extends CancellableFields>(items: T[]): T[] =>
  byPosition(items).filter(item => !NOT_CANCELLABLE_STATUSES.has(item.status) && !item.overlays?.cancellation)

export interface ReviewableFields extends GroupableItem {
  status: string
  stage: string
}

/** The group's requests waiting in intake review (not awaiting a customer answer), in `groupPosition` order. */
export const planReviewAll = <T extends ReviewableFields>(items: T[]): T[] =>
  byPosition(items).filter(item => item.stage === "intake_review" && item.status === "submitted")

/** A cancellation note is 5 to 1000 characters once trimmed. */
export const cancelNoteError = (note: string) => {
  const length = note.trim().length

  return length >= CANCEL_NOTE_MIN && length <= CANCEL_NOTE_MAX ? "" : cancelNoteMessage
}

export const briefError = (brief: string) => {
  const length = brief.trim().length

  return length >= BRIEF_MIN && length <= BRIEF_MAX ? "" : briefMessage
}

/** `cancelled` when the server cancelled the request now (free cancel); otherwise a cancellation request was recorded. */
export const cancelOutcome = (view: { status: string }): "cancelled" | "requested" =>
  view.status === "cancelled" ? "cancelled" : "requested"

export interface BatchResult<T, R> {
  item: T
  ok: boolean
  value?: R
  message?: string
}

/** Runs `task` for each item one after another, in order, and keeps going after a failure. */
export const runSequentially = async <T, R>(
  items: T[],
  task: (item: T) => Promise<R>,
  fallbackMessage = "The request could not be completed.",
): Promise<Array<BatchResult<T, R>>> => {
  const results: Array<BatchResult<T, R>> = []

  for (const item of items) {
    try {
      results.push({ item, ok: true, value: await task(item) })
    } catch (cause) {
      results.push({
        item,
        ok: false,
        message: cause instanceof Error && cause.message ? cause.message : fallbackMessage,
      })
    }
  }

  return results
}

/** Readable stage for a sibling row: the detail's `siblings` carry the raw stage, not a label. */
export const stageText = (stage: string) => {
  const text = stage.replaceAll("_", " ")

  return text.charAt(0).toUpperCase() + text.slice(1)
}

export const servicesLabel = (count: number) => `${count} ${count === 1 ? "service" : "services"}`
