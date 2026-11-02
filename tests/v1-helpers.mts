import assert from "node:assert/strict"
import {
  approvalPrefill,
  authorLabelFor,
  canCounter,
  counterOpen,
  denialMinLength,
  eligibleCandidates,
  formatDay,
  formatNaira,
  isSuperseded,
  isVersionConflict,
  koboToNairaInput,
  latestCounter,
  nairaToKobo,
  preview,
  statusLabels,
  validateApproval,
  validateCounter,
  validateDenial,
} from "@/features/v1/helpers.ts"
import type { ProviderCandidate, V1Message } from "@/features/v1/types.ts"

const card = (id: string, authorId: string, amountKobo: number, date: string | null = null): V1Message => ({
  id: `msg-${id}`,
  requestId: "XPR-1",
  kind: "counter",
  authorId,
  authorRole: authorId.startsWith("cus") ? "customer" : "staff",
  authorLabel: authorId,
  text: "",
  attachments: [],
  createdAt: "2026-10-31T10:00:00.000Z",
  counter: { id: `ctr-${id}`, amountKobo, date, note: "" },
})
const text = (id: string, authorId: string): V1Message => ({
  id: `msg-${id}`,
  requestId: "XPR-1",
  kind: "text",
  authorId,
  authorRole: "customer",
  authorLabel: authorId,
  text: "hello",
  attachments: [],
  createdAt: "2026-10-31T10:00:00.000Z",
})
const candidate = (id: string, score: number, verified = true, available = true): ProviderCandidate => ({
  id,
  name: id,
  trade: "Trade",
  services: [],
  areas: [],
  verified,
  available,
  score,
  reasons: [],
})

// --- Labels.
assert.deepEqual(statusLabels, { submitted: "Submitted", approved: "Approved", denied: "Denied", cancelled: "Cancelled" })

// --- Money: kobo in data, naira on screen.
assert.equal(formatNaira(15_000_000), "₦150,000")
assert.equal(formatNaira(15_000_050), "₦150,000.50")
assert.equal(formatNaira(50), "₦0.50")
assert.equal(nairaToKobo("150,000"), 15_000_000)
assert.equal(nairaToKobo("₦ 1,250.5"), 125_050)
assert.equal(nairaToKobo(0), null)
assert.equal(nairaToKobo("-5"), null)
assert.equal(nairaToKobo("abc"), null)
assert.equal(nairaToKobo(""), null)
assert.equal(nairaToKobo("1.234"), null)
assert.equal(koboToNairaInput(15_000_000), "150000")
assert.equal(koboToNairaInput(125_050), "1250.50")
assert.equal(koboToNairaInput(null), "")

// --- Dates.
assert.equal(formatDay("2026-11-03"), "3 Nov 2026")
assert.equal(formatDay(""), "")
assert.equal(formatDay("nope"), "")

// --- latestCounter picks the newest card and skips text.
assert.equal(latestCounter([]), null)
assert.equal(latestCounter([text("1", "cus")]), null)

const thread = [text("1", "cus"), card("2", "stf", 100), text("3", "stf"), card("4", "cus", 90), text("5", "cus")]

assert.equal(latestCounter(thread)?.id, "msg-4")
assert.equal(isSuperseded(thread[1], thread), true)
assert.equal(isSuperseded(thread[3], thread), false)
assert.equal(isSuperseded(thread[0], thread), false)

// --- canCounter: the author cannot counter their own latest card, anyone else can, and only while open.
const latest = latestCounter(thread)

assert.equal(canCounter("cus", latest), false)
assert.equal(canCounter("stf", latest), true)
assert.equal(canCounter("adm", latest), true)
assert.equal(canCounter("stf", null), false)
assert.equal(canCounter("stf", latest, false), false)
assert.equal(counterOpen("submitted"), true)
assert.equal(counterOpen("approved"), false)
assert.equal(counterOpen("denied"), false)

// --- approvalPrefill: the latest counter beats the form's budget and date.
const request = { budgetKobo: 60_000_000, preferredDate: "2026-11-10" }
const candidates = [
  candidate("low", 5),
  candidate("best", 15),
  candidate("unverified", 99, false),
  candidate("away", 50, true, false),
]
const withCounter = approvalPrefill(
  request,
  [card("1", "stf", 65_000_000, "2026-11-12"), card("2", "cus", 58_000_000, "2026-11-11")],
  candidates,
)

assert.equal(withCounter.priceKobo, 58_000_000)
assert.equal(withCounter.date, "2026-11-11")
assert.equal(withCounter.providerId, "best")
assert.deepEqual(withCounter.sources, {
  provider: "best match",
  price: "latest counter offer",
  date: "latest counter offer",
})

const noDate = approvalPrefill(request, [card("1", "stf", 65_000_000)], candidates)

assert.equal(noDate.priceKobo, 65_000_000)
assert.equal(noDate.date, "2026-11-10")
assert.equal(noDate.sources.price, "latest counter offer")
assert.equal(noDate.sources.date, "request form")

const noCounter = approvalPrefill(request, [text("1", "cus")], candidates)

assert.equal(noCounter.priceKobo, 60_000_000)
assert.equal(noCounter.date, "2026-11-10")
assert.deepEqual(noCounter.sources, { provider: "best match", price: "request form", date: "request form" })

const nothing = approvalPrefill({ budgetKobo: 0, preferredDate: "" }, [], [candidate("x", 1, false)])

assert.equal(nothing.priceKobo, null)
assert.equal(nothing.date, null)
assert.equal(nothing.providerId, null)
assert.deepEqual(nothing.sources, { provider: "", price: "", date: "" })

assert.deepEqual(
  eligibleCandidates(candidates).map(item => item.id),
  ["best", "low"],
)

// --- validateApproval: assignee, provider, price above zero, date.
const good = { assigneeId: "usr-staff", providerId: "prv-1", priceKobo: 1, date: "2026-11-10" }

assert.equal(validateApproval(good).valid, true)
assert.equal(validateApproval({ ...good, assigneeId: null }).errors.assignee !== undefined, true)
assert.equal(validateApproval({ ...good, assigneeId: "" }).valid, false)
assert.equal(validateApproval({ ...good, providerId: null }).errors.provider !== undefined, true)
assert.equal(validateApproval({ ...good, priceKobo: 0 }).errors.price !== undefined, true)
assert.equal(validateApproval({ ...good, priceKobo: null }).valid, false)
assert.equal(validateApproval({ ...good, priceKobo: -5 }).valid, false)
assert.equal(validateApproval({ ...good, date: "" }).errors.date !== undefined, true)
assert.equal(validateApproval({ ...good, date: "10/11/2026" }).valid, false)
assert.deepEqual(
  Object.keys(validateApproval({ assigneeId: null, providerId: null, priceKobo: null, date: null }).errors),
  ["assignee", "provider", "price", "date"],
)

// --- validateDenial: at least 10 characters after trimming.
assert.equal(denialMinLength, 10)
assert.equal(validateDenial("").valid, false)
assert.equal(validateDenial("too short").valid, false)
assert.equal(validateDenial("   padded text    ").valid, true)
assert.equal(validateDenial("         x         ").valid, false)
assert.equal(validateDenial("1234567890").valid, true)
assert.equal(validateDenial("x".repeat(1001)).valid, false)
assert.equal(validateDenial(null).valid, false)

// --- validateCounter.
assert.equal(validateCounter({ amountKobo: 100 }).valid, true)
assert.equal(validateCounter({ amountKobo: 0 }).errors.amount !== undefined, true)
assert.equal(validateCounter({ amountKobo: null }).valid, false)
assert.equal(validateCounter({ amountKobo: 100, date: "tomorrow" }).errors.date !== undefined, true)
assert.equal(validateCounter({ amountKobo: 100, date: "2026-11-10", note: "ok" }).valid, true)
assert.equal(validateCounter({ amountKobo: 100, note: "x".repeat(501) }).valid, false)

// --- Small helpers.
assert.equal(preview("  one   two\nthree "), "one two three")
assert.equal(preview("abcdefghij", 5), "abcd…")
assert.equal(isVersionConflict({ status: 409 }), true)
assert.equal(isVersionConflict({ status: 422 }), false)
assert.equal(isVersionConflict(null), false)
assert.equal(authorLabelFor("customer", { authorRole: "staff", authorLabel: "Kemi" }), "XPro Team")
assert.equal(authorLabelFor("customer", { authorRole: "customer", authorLabel: "Ada" }), "Ada")
assert.equal(authorLabelFor("admin", { authorRole: "staff", authorLabel: "Kemi" }), "Kemi")

console.log("v1-helpers: ok")
