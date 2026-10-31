import assert from "node:assert/strict"
import {
  briefError,
  briefMessage,
  cancelNoteError,
  cancelNoteMessage,
  cancelOutcome,
  cancellableSiblings,
  groupRequests,
  groupTitle,
  planReviewAll,
  runSequentially,
  servicesLabel,
  stageText,
} from "@/features/requests/request-groups.ts"

interface Item {
  id: string
  title: string
  status: string
  stage: string
  groupId: string | null
  groupRef: string | null
  groupPosition: number | null
  overlays?: { cancellation: string | null }
}

const item = (id: string, extra: Partial<Item> = {}): Item => ({
  id,
  title: `Request ${id}`,
  status: "submitted",
  stage: "intake_review",
  groupId: null,
  groupRef: null,
  groupPosition: null,
  ...extra,
})

const inGroup = (id: string, position: number, extra: Partial<Item> = {}) =>
  item(id, { groupId: "g1", groupRef: "XPG-00001", groupPosition: position, title: `Flat 4 — ${id}`, ...extra })

// Ungrouped items pass through as singles, in order
const singles = groupRequests([item("XPR-1"), item("XPR-2")])
assert.deepEqual(
  singles.map(entry => entry.kind),
  ["single", "single"],
)
assert.deepEqual(
  singles.map(entry => (entry.kind === "single" ? entry.item.id : "")),
  ["XPR-1", "XPR-2"],
)
assert.deepEqual(groupRequests([]), [])

// A group sits where its first item appeared; children are sorted by groupPosition; other groups and singles keep order
const page = [
  item("XPR-1"),
  inGroup("XPR-4", 2),
  item("XPR-5", { groupId: "g2", groupRef: "XPG-00002", groupPosition: 0, title: "Office — Cleaning" }),
  inGroup("XPR-3", 0),
  item("XPR-6"),
  inGroup("XPR-2", 1),
]
const entries = groupRequests(page)
assert.deepEqual(
  entries.map(entry => entry.kind),
  ["single", "group", "group", "single"],
)
const first = entries[1]
assert.equal(first.kind, "group")
if (first.kind === "group") {
  assert.equal(first.groupId, "g1")
  assert.equal(first.ref, "XPG-00001")
  assert.equal(first.title, "Flat 4")
  assert.deepEqual(
    first.items.map(row => row.id),
    ["XPR-3", "XPR-2", "XPR-4"],
  )
}
const second = entries[2]
assert.equal(second.kind === "group" && second.title, "Office")
assert.equal(second.kind === "group" && second.items.length, 1, "A group with one request on the page is still a group")

// Requests without a position go last, in list order
const unsorted = groupRequests([
  inGroup("XPR-9", 0, { groupPosition: null }),
  inGroup("XPR-8", 0, { groupPosition: 1 }),
  inGroup("XPR-7", 0, { groupPosition: 0 }),
])
assert.deepEqual(unsorted[0].kind === "group" ? unsorted[0].items.map(row => row.id) : [], ["XPR-7", "XPR-8", "XPR-9"])

// Group title: the most common prefix before the last separator; falls back to the ref
assert.equal(
  groupTitle(
    [
      { id: "a", title: "Flat 4 — Painting" },
      { id: "b", title: "Flat 4 — Tiling" },
    ],
    "XPG-1",
  ),
  "Flat 4",
)
assert.equal(groupTitle([{ id: "a", title: "Home — Phase 2 — Painting" }], "XPG-1"), "Home — Phase 2")
assert.equal(
  groupTitle(
    [
      { id: "a", title: "Flat 4 — Painting" },
      { id: "b", title: "Flat 4 — Tiling" },
      { id: "c", title: "Edited by staff" },
    ],
    "XPG-1",
  ),
  "Flat 4",
)
assert.equal(groupTitle([{ id: "a", title: "No separator" }, { id: "b" }], "XPG-7"), "XPG-7")
assert.equal(groupTitle([], ""), "Project")

// Cancellable siblings: open, no pending cancellation, in groupPosition order
const group = [
  inGroup("XPR-C", 3, { status: "closed", stage: "closed" }),
  inGroup("XPR-A", 1, { status: "under_review", stage: "dispatching" }),
  inGroup("XPR-B", 0),
  inGroup("XPR-D", 2, { status: "cancelled", stage: "cancelled" }),
  inGroup("XPR-E", 4, { status: "rejected", stage: "rejected" }),
  inGroup("XPR-F", 5, {
    status: "matched",
    stage: "pricing",
    overlays: { cancellation: "Cancellation requested — awaiting XPro" },
  }),
  inGroup("XPR-G", 6, { status: "cancelling", stage: "refund_pending" }),
  inGroup("XPR-H", 7, { status: "in_progress", stage: "in_progress", overlays: { cancellation: null } }),
]
assert.deepEqual(
  cancellableSiblings(group).map(row => row.id),
  ["XPR-B", "XPR-A", "XPR-H"],
)
assert.deepEqual(cancellableSiblings([group[0], group[3]]), [])
assert.deepEqual(cancellableSiblings([]), [])

// Review all: intake review only, not awaiting clarification, in groupPosition order
const review = [
  inGroup("XPR-3", 2),
  inGroup("XPR-2", 1, { stage: "awaiting_clarification" }),
  inGroup("XPR-1", 0),
  inGroup("XPR-4", 3, { status: "under_review", stage: "dispatching" }),
  inGroup("XPR-5", 4, { status: "cancelled", stage: "cancelled" }),
]
assert.deepEqual(
  planReviewAll(review).map(row => row.id),
  ["XPR-1", "XPR-3"],
)
assert.deepEqual(planReviewAll([review[1], review[3]]), [])

// Notes and briefs
assert.equal(cancelNoteError("Changed my mind"), "")
assert.equal(cancelNoteError("abcde"), "")
assert.equal(cancelNoteError("  abcd  "), cancelNoteMessage)
assert.equal(cancelNoteError(""), cancelNoteMessage)
assert.equal(cancelNoteError("x".repeat(1000)), "")
assert.equal(cancelNoteError("x".repeat(1001)), cancelNoteMessage)
assert.equal(briefError("x".repeat(20)), "")
assert.equal(briefError(" ".repeat(5) + "x".repeat(19)), briefMessage)
assert.equal(briefError("x".repeat(1000)), "")
assert.equal(briefError("x".repeat(1001)), briefMessage)

// Cancel outcome and labels
assert.equal(cancelOutcome({ status: "cancelled" }), "cancelled")
assert.equal(cancelOutcome({ status: "matched" }), "requested")
assert.equal(servicesLabel(1), "1 service")
assert.equal(servicesLabel(5), "5 services")
assert.equal(stageText("awaiting_payment"), "Awaiting payment")

// Sequential runner: in order, one at a time, keeps going after a failure, reports the message
const calls: string[] = []
let running = 0
let overlapped = false
const results = await runSequentially(["a", "b", "c"], async id => {
  running += 1
  overlapped ||= running > 1
  calls.push(id)
  await new Promise(resolve => setTimeout(resolve, 1))
  running -= 1
  if (id === "b") throw new Error("A cancellation request is waiting.")

  return id.toUpperCase()
})
assert.deepEqual(calls, ["a", "b", "c"])
assert.equal(overlapped, false)
assert.deepEqual(
  results.map(result => result.ok),
  [true, false, true],
)
assert.equal(results[1].message, "A cancellation request is waiting.")
assert.equal(results[2].value, "C")
const odd = await runSequentially(
  [1],
  async () => {
    throw "boom"
  },
  "Fallback",
)
assert.equal(odd[0].message, "Fallback")

console.log("PASS: request groups (grouping, cancellable, review-all, notes, sequential runner)")
