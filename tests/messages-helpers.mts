import assert from "node:assert/strict"
import type { ChatAudienceOption } from "@/features/chat/chat-types.ts"
import {
  audienceOptions,
  buildListQuery,
  canUseMessages,
  currentAssignment,
  defaultAudience,
  formatDate,
  formatRowTime,
  highlightSegments,
  initials,
  mergeFirstPage,
  previewParts,
  queryString,
  statusPills,
  toggleStatus,
} from "@/features/messages/messages-helpers.ts"
import {
  finishedStatuses,
  isFinishedStatus,
  requestStatuses,
  statusColor,
  statusLabel,
  statusOrder,
  statusStyles,
} from "@/features/messages/status-labels.ts"
import type { ConversationItem } from "@/features/messages/types.ts"
import { sectionAllowed, workspaceSections } from "@/features/workspace/config.ts"

// ---- status map ---------------------------------------------------------------------------------------------------

// The server's REQUEST_STATUSES (src/requests/domain/statuses.ts), in lifecycle order.
const serverStatuses = [
  "submitted",
  "under_review",
  "matched",
  "quoted",
  "awaiting_payment",
  "ready_to_schedule",
  "scheduled",
  "in_progress",
  "blocked",
  "completion_pending",
  "acknowledged",
  "cancelling",
  "closed",
  "cancelled",
  "rejected",
]

assert.deepEqual([...requestStatuses], serverStatuses)
assert.equal(Object.keys(statusStyles).length, 15)
for (const status of serverStatuses) {
  const style = statusStyles[status as keyof typeof statusStyles]

  assert.ok(style, `missing style for ${status}`)
  assert.ok(style.label.length > 0 && style.label.length <= 20, `label for ${status} should be short`)
  assert.ok(style.color, `missing colour for ${status}`)
}
assert.equal(new Set(serverStatuses.map(status => statusLabel(status))).size, 15, "labels are unique")
assert.equal(statusLabel("in_progress"), "In progress")
assert.equal(statusLabel("brand_new_status"), "Brand new status")
assert.equal(statusColor("brand_new_status"), "secondary")
assert.deepEqual([...finishedStatuses].sort(), ["cancelled", "closed", "rejected"])
assert.equal(isFinishedStatus("closed"), true)
assert.equal(isFinishedStatus("cancelling"), false)
assert.ok(statusOrder("submitted") < statusOrder("closed"))
assert.ok(statusOrder("nonsense") > statusOrder("rejected"))

// ---- permissions and audiences ------------------------------------------------------------------------------------

assert.equal(canUseMessages(undefined), false)
assert.equal(canUseMessages([]), false)
assert.equal(canUseMessages(["request.claim", "view.pricing"]), false)
assert.equal(canUseMessages(["message.internal"]), true)

const all = ["message.customer", "message.provider", "message.internal"]

assert.deepEqual(audienceOptions(all, true), [{ value: "customer" }, { value: "provider" }, { value: "internal" }])
assert.deepEqual(audienceOptions(all, false), [
  { value: "customer" },
  { value: "provider", disabledReason: "No provider on this request yet." },
  { value: "internal" },
])
// Finance-like: provider and internal only.
assert.deepEqual(
  audienceOptions(["message.provider", "message.internal"], true).map(item => item.value),
  ["provider", "internal"],
)
assert.deepEqual(audienceOptions([], true), [])

const row = (overrides: Partial<ConversationItem> = {}): ConversationItem => ({
  requestId: "XPR-00042",
  title: "Roof replacement",
  status: "in_progress",
  statusLabel: "Work under way",
  closed: false,
  owner: { id: "s1", name: "Ada Lovelace" },
  customer: { name: "Chika Okafor" },
  provider: { name: "Tunde Roofing" },
  lastMessage: {
    audience: "customer",
    authorRole: "customer",
    authorLabel: "Chika Okafor",
    text: "Thursday would be ideal.",
    at: new Date(2026, 9, 30, 10, 40).toISOString(),
  },
  waitingForXpro: 2,
  ...overrides,
})

const fullOptions = audienceOptions(all, true)

// Waiting customer message -> customer; waiting provider message -> provider.
assert.equal(defaultAudience(row(), fullOptions), "customer")
assert.equal(
  defaultAudience(
    row({ lastMessage: { ...row().lastMessage, audience: "provider", authorRole: "provider", authorLabel: "Tunde" } }),
    fullOptions,
  ),
  "provider",
)
// Nothing waiting: customer, never the note, even when the last message was a note.
assert.equal(defaultAudience(row({ waitingForXpro: 0 }), fullOptions), "customer")
assert.equal(
  defaultAudience(
    row({
      waitingForXpro: 0,
      lastMessage: { ...row().lastMessage, audience: "internal", authorRole: "admin", authorLabel: "Ada" },
    }),
    fullOptions,
  ),
  "customer",
)
// A staff reply is not "waiting", whatever the count says.
assert.equal(
  defaultAudience(
    row({ lastMessage: { ...row().lastMessage, audience: "provider", authorRole: "admin", authorLabel: "Ada" } }),
    fullOptions,
  ),
  "customer",
)
// No row yet (deep link before the list loads).
assert.equal(defaultAudience(undefined, fullOptions), "customer")
// Cannot write to customer: first allowed audience that is not a note.
assert.equal(defaultAudience(row(), audienceOptions(["message.provider", "message.internal"], true)), "provider")
// Provider waiting but no provider on the request: disabled, so fall back to customer.
const noProvider: ChatAudienceOption[] = audienceOptions(all, false)

assert.equal(
  defaultAudience(
    row({ lastMessage: { ...row().lastMessage, audience: "provider", authorRole: "provider", authorLabel: "Tunde" } }),
    noProvider,
  ),
  "customer",
)
// Notes only: nothing to default to, the composer shows its own banner or staff picks the note.
assert.equal(defaultAudience(row(), audienceOptions(["message.internal"], true)), null)
assert.equal(defaultAudience(row(), []), null)

// ---- row preview and time -----------------------------------------------------------------------------------------

assert.deepEqual(previewParts(row(), "Ada Lovelace"), {
  prefix: "Chika:",
  note: false,
  text: "Thursday would be ideal.",
  attachmentOnly: false,
})
assert.equal(
  previewParts(
    row({ lastMessage: { ...row().lastMessage, audience: "provider", authorRole: "provider", authorLabel: "Tunde Bello" } }),
  ).prefix,
  "Tunde:",
)
const staffLast = row({
  lastMessage: { ...row().lastMessage, audience: "customer", authorRole: "admin", authorLabel: "Ada Lovelace" },
})

assert.equal(previewParts(staffLast, "Ada Lovelace").prefix, "You:")
assert.equal(previewParts(staffLast, "ada lovelace").prefix, "You:")
assert.equal(previewParts(staffLast, "Bola Adeyemi").prefix, "Ada:")
assert.equal(previewParts(staffLast).prefix, "Ada:")

const note = row({
  lastMessage: { ...row().lastMessage, audience: "internal", authorRole: "admin", authorLabel: "Bola Adeyemi" },
})

assert.equal(previewParts(note, "Ada Lovelace").prefix, "Note:")
assert.equal(previewParts(note, "Ada Lovelace").note, true)
// Even your own note reads "Note:".
assert.equal(previewParts(note, "Bola Adeyemi").prefix, "Note:")

const attachment = previewParts(row({ lastMessage: { ...row().lastMessage, text: "" } }))

assert.equal(attachment.text, "Attachment")
assert.equal(attachment.attachmentOnly, true)
assert.equal(previewParts(row({ lastMessage: { ...row().lastMessage, text: "   " } })).attachmentOnly, true)

const now = new Date(2026, 9, 30, 15, 0)
const at = (year: number, month: number, day: number, hour = 9) => new Date(year, month, day, hour, 5).toISOString()

assert.match(formatRowTime(at(2026, 9, 30), now), /\d/, "today shows a time")
assert.ok(!formatRowTime(at(2026, 9, 30), now).includes("Oct"), "today is not a date")
assert.equal(formatRowTime(at(2026, 9, 29, 23), now), "Yesterday")
assert.equal(formatRowTime(at(2026, 9, 27), now), "27 Oct")
assert.equal(formatRowTime(at(2026, 0, 3), now), "3 Jan")
assert.equal(formatRowTime(at(2025, 11, 31), now), "31 Dec 2025")
assert.equal(formatRowTime("not a date", now), "")
// Month boundary: the day before the 1st is "Yesterday".
assert.equal(formatRowTime(at(2026, 9, 31, 8), new Date(2026, 10, 1, 9)), "Yesterday")

assert.equal(formatDate("2026-11-03T00:00:00"), "3 Nov 2026")
assert.equal(formatDate(null), "")
assert.equal(formatDate("garbage"), "")

assert.equal(initials("Chika Okafor"), "CO")
assert.equal(initials("Ada"), "A")
assert.equal(initials("  mary jane watson "), "MW")
assert.equal(initials(""), "?")
assert.equal(initials(undefined), "?")

// ---- status pills and filters -------------------------------------------------------------------------------------

assert.deepEqual(statusPills({ closed: 1, under_review: 4, in_progress: 3, submitted: 0 }), [
  { status: "under_review", label: "Finding provider", count: 4 },
  { status: "in_progress", label: "In progress", count: 3 },
  { status: "closed", label: "Closed", count: 1 },
])
assert.deepEqual(statusPills({}), [])
assert.deepEqual(statusPills(undefined), [])
// A status the dashboard does not know yet still gets a pill, last.
assert.deepEqual(
  statusPills({ mystery: 2, quoted: 1 }).map(pill => pill.status),
  ["quoted", "mystery"],
)

assert.deepEqual(toggleStatus([], "quoted"), ["quoted"])
assert.deepEqual(toggleStatus(["quoted"], "under_review"), ["under_review", "quoted"])
assert.deepEqual(toggleStatus(["under_review", "quoted"], "quoted"), ["under_review"])
assert.deepEqual(toggleStatus(["quoted"], "quoted"), [])

// ---- query building -----------------------------------------------------------------------------------------------

assert.deepEqual(buildListQuery({}), {})
assert.deepEqual(buildListQuery({ status: [], q: "   ", cursor: "", limit: 0 }), {})
assert.deepEqual(buildListQuery({ status: ["quoted", "closed"], q: "  roof  ", cursor: "abc", limit: 25 }), {
  status: ["quoted", "closed"],
  q: "roof",
  cursor: "abc",
  limit: 25,
})
// Unknown statuses would be a 422 from the server, so they are dropped here.
assert.deepEqual(buildListQuery({ status: ["quoted", "bogus"] }), { status: ["quoted"] })
assert.equal(buildListQuery({ limit: 500 }).limit, 50)
assert.equal(buildListQuery({ limit: 1.9 }).limit, 1)
assert.equal(buildListQuery({ q: "x".repeat(300) }).q?.length, 100)
assert.equal(queryString(buildListQuery({ status: ["quoted", "closed"], q: "roof tile", limit: 25 })), "status=quoted&status=closed&q=roof+tile&limit=25")
assert.equal(queryString({}), "")
assert.equal(queryString({ q: "a&b=c" }), "q=a%26b%3Dc")

// ---- highlighting -------------------------------------------------------------------------------------------------

assert.deepEqual(highlightSegments("Roof replacement", ""), [{ text: "Roof replacement", match: false }])
assert.deepEqual(highlightSegments("Roof replacement", "ROOF"), [
  { text: "Roof", match: true },
  { text: " replacement", match: false },
])
assert.deepEqual(highlightSegments("a roof on a roof", "roof"), [
  { text: "a ", match: false },
  { text: "roof", match: true },
  { text: " on a ", match: false },
  { text: "roof", match: true },
])
assert.deepEqual(highlightSegments("Generator", "xyz"), [{ text: "Generator", match: false }])
assert.deepEqual(highlightSegments("", "x"), [{ text: "", match: false }])
// Regex characters are plain text.
assert.deepEqual(highlightSegments("cost (est.) 5%", "(est.)"), [
  { text: "cost ", match: false },
  { text: "(est.)", match: true },
  { text: " 5%", match: false },
])

// ---- refresh merge ------------------------------------------------------------------------------------------------

const a = row({ requestId: "XPR-00001", title: "A" })
const b = row({ requestId: "XPR-00002", title: "B" })
const c = row({ requestId: "XPR-00003", title: "C" })
const d = row({ requestId: "XPR-00004", title: "D" })
const bFresh = row({ requestId: "XPR-00002", title: "B", waitingForXpro: 0 })

// B got a reply and moved up; C and D came from a later page and stay.
const merged = mergeFirstPage([a, b, c, d], [bFresh, a])

assert.deepEqual(
  merged.map(item => item.requestId),
  ["XPR-00002", "XPR-00001", "XPR-00003", "XPR-00004"],
)
assert.equal(merged[0], bFresh, "fresh copy replaces the old one")
assert.deepEqual(mergeFirstPage([], [a, b]), [a, b])
assert.deepEqual(mergeFirstPage([a, b], []), [a, b])

// ---- current provider ---------------------------------------------------------------------------------------------

assert.equal(currentAssignment(null), null)
assert.equal(currentAssignment([]), null)
assert.equal(currentAssignment({ status: "accepted", providerId: "p1" })?.providerId, "p1")
assert.equal(currentAssignment({ status: "declined", providerId: "p1" }), null)
assert.equal(
  currentAssignment([
    { status: "declined", providerId: "p1", offeredAt: "2026-10-01T10:00:00Z" },
    { status: "offered", providerId: "p2", offeredAt: "2026-10-02T10:00:00Z" },
  ])?.providerId,
  "p2",
)
// The latest assignment decides: a newer withdrawn one leaves no current provider.
assert.equal(
  currentAssignment([
    { status: "accepted", providerId: "p1", offeredAt: "2026-10-01T10:00:00Z" },
    { status: "withdrawn", providerId: "p2", offeredAt: "2026-10-02T10:00:00Z" },
  ]),
  null,
)

// ---- sidebar permission rule --------------------------------------------------------------------------------------

const adminMessages = workspaceSections.admin.find(item => item.id === "messages")!

assert.ok(adminMessages.anyPermission?.length === 3)
assert.match(adminMessages.description, /^Every request's conversation in one place\./)
assert.equal(sectionAllowed(adminMessages, () => false), false)
assert.equal(sectionAllowed(adminMessages, permission => permission === "message.internal"), true)
assert.equal(sectionAllowed(adminMessages, permission => permission === "view.pricing"), false)
// Customers and providers keep the shared Messages section.
assert.notEqual(workspaceSections.customer.find(item => item.id === "messages")?.description, adminMessages.description)
assert.equal(workspaceSections.provider.find(item => item.id === "messages")?.anyPermission, undefined)
// Existing single-permission sections still work.
const services = workspaceSections.admin.find(item => item.id === "services")!

assert.equal(sectionAllowed(services, permission => permission === "catalog.manage"), true)
assert.equal(sectionAllowed(services, () => false), false)

console.log("messages-helpers: all checks passed")
