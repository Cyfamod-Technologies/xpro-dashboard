import assert from "node:assert/strict"
import type { RequestMessageView } from "@/features/requests/api-types.ts"
import {
  audienceHelp,
  audienceLabel,
  audienceTag,
  dayLabel,
  groupByDay,
  isOwnSide,
  participantColor,
  participantKey,
  startsRun,
  toChatMessages,
} from "@/features/chat/chat-types.ts"

// Local time, so day boundaries match what a person sees.
const now = new Date(2026, 9, 29, 15, 0)
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).toISOString()

const raw = (
  id: string,
  role: string,
  label: string,
  channel: RequestMessageView["channel"],
  createdAt: string,
): RequestMessageView => ({
  id,
  channel,
  providerId: null,
  text: `text ${id}`,
  createdAt,
  author: { role, label },
  attachments: [],
})

// Audience labels and helper lines
assert.equal(audienceLabel("customer"), "Customer")
assert.equal(audienceLabel("provider"), "Provider")
assert.equal(audienceLabel("internal"), "Staff note")
assert.equal(audienceTag("customer"), "to Customer")
assert.equal(audienceTag("provider"), "to Provider")
assert.equal(audienceHelp.customer, "Customer sees this as XPro Team")
assert.equal(audienceHelp.provider, "Provider sees this as XPro Dispatch")
assert.equal(audienceHelp.internal, "Staff note, hidden from the customer and provider")

// Which side a message sits on
assert.ok(isOwnSide("customer", "customer"))
assert.ok(!isOwnSide("customer", "admin"))
assert.ok(!isOwnSide("customer", "provider"))
assert.ok(isOwnSide("provider", "provider"))
assert.ok(!isOwnSide("provider", "admin"))
assert.ok(isOwnSide("staff", "admin"), "Every staff role is XPro")
assert.ok(isOwnSide("staff", "operations"))
assert.ok(!isOwnSide("staff", "customer"))
assert.ok(!isOwnSide("staff", "provider"))

// Day labels
assert.equal(dayLabel(new Date(2026, 9, 29, 1), now), "Today")
assert.equal(dayLabel(new Date(2026, 9, 28, 23, 59), now), "Yesterday")
assert.equal(dayLabel(new Date(2026, 9, 27, 10), now), "Tue 27 Oct")
assert.equal(dayLabel(new Date(2025, 11, 31, 10), now), "Wed 31 Dec")
assert.equal(dayLabel(new Date(2026, 0, 1, 10), new Date(2026, 0, 2, 9)), "Yesterday", "Month and year boundaries")

// Mapping and ordering: oldest first, server order kept for equal times
const mapped = toChatMessages(
  [
    raw("c", "admin", "Ada", "customer", at(28, 9)),
    raw("a", "customer", "Chika", "customer", at(27, 9)),
    raw("b", "provider", "Tunde", "provider", at(27, 9)),
  ],
  "staff",
)

assert.deepEqual(
  mapped.map(m => m.id),
  ["a", "b", "c"],
)
assert.deepEqual(
  mapped.map(m => m.ownSide),
  [false, false, true],
)
assert.deepEqual(
  mapped.map(m => m.audience),
  ["customer", "provider", "customer"],
)
assert.ok(mapped.every(m => m.state === "sent" && m.providerId === null))
assert.deepEqual(
  toChatMessages([raw("a", "customer", "Chika", "customer", at(27, 9))], "customer").map(m => m.ownSide),
  [true],
)
assert.deepEqual(
  toChatMessages([raw("a", "customer", "Chika", "customer", at(27, 9))], "provider").map(m => m.ownSide),
  [false],
)

// Grouping by day
const timeline = toChatMessages(
  [
    raw("1", "customer", "Chika", "customer", at(27, 9)),
    raw("2", "customer", "Chika", "customer", at(27, 9, 5)),
    raw("3", "admin", "Ada", "customer", at(28, 8)),
    raw("4", "admin", "Ada", "customer", at(29, 8)),
  ],
  "staff",
)
const groups = groupByDay(timeline, now)

assert.deepEqual(
  groups.map(g => g.label),
  ["Tue 27 Oct", "Yesterday", "Today"],
)
assert.deepEqual(
  groups.map(g => g.messages.length),
  [2, 1, 1],
)
assert.deepEqual(groupByDay([], now), [])

// Runs: same sender, same audience, same day
const [m1, m2, m3, m4] = timeline

assert.ok(startsRun(undefined, m1))
assert.ok(!startsRun(m1, m2), "Same sender, audience and day continues the run")
assert.ok(startsRun(m2, m3), "A different sender starts a run")
assert.ok(startsRun(m3, m4), "A new day starts a run")
assert.ok(startsRun(m3, { ...m3, id: "x", audience: "provider" }), "A different audience starts a run")
assert.ok(
  startsRun(m3, { ...m3, id: "y", author: { role: "admin", label: "Bola" } }),
  "A different staff member starts a run",
)
assert.ok(!startsRun(m3, { ...m3, id: "z", createdAt: at(28, 20) }))

// Participant colours are stable and fixed for customer and provider
const palette = new Set(["primary", "secondary", "warning", "error"])

assert.equal(participantColor("customer"), "success")
assert.equal(participantColor("provider"), "info")
assert.equal(participantColor("staff:Ada"), participantColor("staff:Ada"))
assert.ok(palette.has(participantColor("staff:Ada")))
assert.ok(palette.has(participantColor("staff:Bola")))
assert.equal(participantKey({ role: "customer", label: "Chika" }), "customer")
assert.equal(participantKey({ role: "provider", label: "Tunde Roofing" }), "provider")
assert.equal(participantKey({ role: "admin", label: "Ada" }), "staff:Ada")

console.log("chat-helpers: all assertions passed")
