import assert from "node:assert/strict"
import type { MockActor } from "@/mocks/v1/store.ts"
import { V1MockError, createV1Store, storageKey } from "@/mocks/v1/store.ts"
import type { V1CreateRequestBody } from "@/features/v1/types.ts"

const now = new Date("2026-10-31T09:00:00.000Z")
const fresh = () => createV1Store({ storage: null, now: () => now })

const customer: MockActor = { id: "usr-customer", role: "customer", name: "Ada Okafor", email: "customer@xpro.test" }
const other: MockActor = { id: "usr-other", role: "customer", name: "Bola Ade", email: "bola@xpro.test" }
const admin: MockActor = { id: "usr-admin", role: "admin", name: "Amara Okafor", email: "admin@xpro.test" }
const kemi: MockActor = { id: "usr-operations", role: "staff", name: "Kemi Adebayo", email: "operations@xpro.test" }
const zainab: MockActor = { id: "usr-relations", role: "staff", name: "Zainab Lawal", email: "relations@xpro.test" }
const tunde: MockActor = { id: "usr-provider", role: "provider", name: "Tunde Bakare", email: "provider@xpro.test" }
const ngozi: MockActor = { id: "prv-ngozi", role: "provider", name: "Ngozi Interiors", email: "n@xpro.test" }

const unassigned = "XPR-00101"
const negotiating = "XPR-00102" // assigned to Kemi; the newest card is Kemi's
const approvedId = "XPR-00103" // approved; Tunde Bakare is on it
const deniedId = "XPR-00104"

const failsWith = (run: () => unknown, status: number, code?: string) => {
  try {
    run()
  } catch (error) {
    assert.ok(error instanceof V1MockError, `expected a V1MockError, got ${String(error)}`)
    assert.equal(error.status, status, `status ${error.status} ${error.code} ${error.message}`)
    if (code) assert.equal(error.code, code)

    return error
  }
  assert.fail(`expected status ${status} but nothing was thrown`)
}

const terms = { providerId: "usr-provider", priceKobo: 50_000_000, date: "2026-11-20" }
const newRequest: V1CreateRequestBody = {
  service: "Design",
  title: "Kitchen redesign",
  description: "Redesign a small kitchen with new cabinets and lighting.",
  location: "Yaba, Lagos",
  address: "5 Herbert Macaulay Way, Yaba",
  phone: "08031234567",
  contactMethod: "email",
  budgetKobo: 30_000_000,
  preferredDate: "2026-12-01",
  attachments: [],
}

// --- Seed: 2 submitted (one unassigned, one with a counter exchange), 1 approved, 1 denied.
{
  const store = fresh()
  const page = store.listRequests(admin)

  assert.equal(page.total, 4)
  assert.deepEqual(store.counts(admin), { submitted: 2, approved: 1, denied: 1, unassigned: 1, assigned: 1 })
  assert.equal(store.getRequest(admin, unassigned).assignee, null)
  assert.equal(store.getRequest(admin, negotiating).assignee?.id, "usr-operations")
  assert.equal(store.getRequest(admin, deniedId).decision.reason?.length! >= 10, true)
  assert.equal(store.getRequest(admin, approvedId).decision.terms?.priceKobo, 48_000_000)

  const cards = store.messages(admin, negotiating).filter(item => item.kind === "counter")

  assert.equal(cards.length, 3)
  assert.equal(cards[2].authorId, "usr-operations")
  assert.equal(cards[2].counter?.supersededBy, null)
  assert.equal(cards[0].counter?.supersededBy, cards[1].counter?.id)

  assert.equal(store.formOptions().services.length, 6)
  assert.ok(store.formOptions().locations.every(item => item.name.includes("Lagos")))
}

// --- Visibility: a customer sees only their own, staff only what is assigned to them, providers no requests at all.
{
  const store = fresh()

  assert.equal(store.listRequests(customer).total, 4)
  assert.equal(store.listRequests(other).total, 0)
  failsWith(() => store.getRequest(other, unassigned), 404)
  failsWith(() => store.messages(other, negotiating), 404)
  failsWith(() => store.sendMessage(other, negotiating, { kind: "text", text: "hi", attachments: [] }), 404)

  assert.deepEqual(
    store
      .listRequests(kemi)
      .items.map(item => item.id)
      .sort(),
    [negotiating, approvedId],
  )
  assert.equal(store.listRequests(zainab).total, 0)
  failsWith(() => store.getRequest(zainab, negotiating), 404)
  failsWith(() => store.getRequest(kemi, unassigned), 404)

  failsWith(() => store.listRequests(tunde), 403)
  failsWith(() => store.getRequest(tunde, approvedId), 403)
  failsWith(() => store.counts(tunde), 403)

  // Customers never see the assignee or the audit trail; Xpro does.
  const mine = store.getRequest(customer, negotiating)

  assert.equal(mine.assignee, null)
  assert.deepEqual(mine.activity, [])
  assert.ok(store.getRequest(admin, negotiating).activity.length > 0)

  // Filters.
  assert.equal(store.listRequests(admin, { status: "submitted" }).total, 2)
  assert.equal(store.listRequests(admin, { assignee: "unassigned" }).total, 2)
  assert.equal(store.listRequests(admin, { assignee: "usr-operations" }).total, 2)
  assert.equal(store.listRequests(admin, { service: "Waste management" }).total, 1)
  assert.equal(store.listRequests(admin, { q: "tiling" }).total, 1)
  assert.equal(store.listRequests(admin, { itemsPerPage: 2, page: 2 }).items.length, 2)
}

// --- Submitting: customers only, with validation and a new id.
{
  const store = fresh()

  failsWith(() => store.createRequest(admin, newRequest), 403)
  failsWith(() => store.createRequest(kemi, newRequest), 403)
  failsWith(() => store.createRequest(customer, { ...newRequest, title: "x" }), 422)
  failsWith(() => store.createRequest(customer, { ...newRequest, description: "short" }), 422)
  failsWith(() => store.createRequest(customer, { ...newRequest, service: "Plumbing" }), 422)
  failsWith(() => store.createRequest(customer, { ...newRequest, location: "Ibadan" }), 422)
  failsWith(() => store.createRequest(customer, { ...newRequest, phone: "12345" }), 422)
  failsWith(() => store.createRequest(customer, { ...newRequest, budgetKobo: -1 }), 422)

  const created = store.createRequest(customer, newRequest)

  assert.equal(created.id, "XPR-00105")
  assert.equal(created.status, "submitted")
  assert.equal(created.version, 1)
  assert.equal(created.assignee, null)
  assert.equal(store.getRequest(customer, created.id).title, "Kitchen redesign")
  assert.equal(store.getRequest(admin, created.id).activity[0].kind, "submitted")
  assert.equal(store.createRequest(customer, newRequest).id, "XPR-00106")
}

// --- Assigning staff: admin only, versioned, with an owner check; A5 allows it after approval too.
{
  const store = fresh()
  const request = store.getRequest(admin, unassigned)

  failsWith(() => store.assignStaff(kemi, unassigned, { staffId: "usr-operations", expectedOwnerId: null }), 403)
  failsWith(() => store.assignStaff(customer, unassigned, { staffId: "usr-operations", expectedOwnerId: null }), 403)
  failsWith(
    () => store.assignStaff(admin, unassigned, { staffId: "usr-pricing", expectedOwnerId: null }, request.version),
    422,
  )
  failsWith(
    () =>
      store.assignStaff(admin, unassigned, { staffId: "usr-operations", expectedOwnerId: null }, request.version + 5),
    409,
    "VERSION_CONFLICT",
  )
  failsWith(
    () =>
      store.assignStaff(
        admin,
        unassigned,
        { staffId: "usr-operations", expectedOwnerId: "usr-relations" },
        request.version,
      ),
    409,
    "OWNER_CHANGED",
  )

  const assigned = store.assignStaff(
    admin,
    unassigned,
    { staffId: "usr-operations", expectedOwnerId: null },
    request.version,
  )

  assert.equal(assigned.assignee?.id, "usr-operations")
  assert.equal(assigned.version, request.version + 1)
  assert.equal(assigned.activity.at(-1)?.kind, "assigned")
  // The new owner sees it; a stale second assignment fails.
  assert.equal(store.getRequest(kemi, unassigned).id, unassigned)
  failsWith(
    () => store.assignStaff(admin, unassigned, { staffId: "usr-relations", expectedOwnerId: null }, request.version),
    409,
  )
  failsWith(
    () => store.assignStaff(admin, unassigned, { staffId: "usr-operations", expectedOwnerId: "usr-operations" }),
    422,
  )

  const moved = store.assignStaff(admin, unassigned, {
    staffId: "usr-relations",
    expectedOwnerId: "usr-operations",
    note: "Cover",
  })

  assert.equal(moved.assignee?.id, "usr-relations")
  assert.equal(moved.activity.at(-1)?.kind, "reassigned")
  failsWith(() => store.getRequest(kemi, unassigned), 404)

  // A5: reassigning an approved request works.
  const reassigned = store.assignStaff(admin, approvedId, {
    staffId: "usr-relations",
    expectedOwnerId: "usr-operations",
  })

  assert.equal(reassigned.assignee?.id, "usr-relations")
  assert.equal(reassigned.status, "approved")

  assert.deepEqual(
    store.listStaff(admin).map(item => item.id),
    ["usr-operations", "usr-relations"],
  )
  failsWith(() => store.listStaff(kemi), 403)
  failsWith(() => store.listStaff(customer), 403)
}

// --- Approve: admin only, needs an assignee, provider, price above zero and a date; one decision only.
{
  const store = fresh()

  failsWith(() => store.approve(kemi, negotiating, terms), 403)
  failsWith(() => store.approve(customer, negotiating, terms), 403)
  failsWith(() => store.approve(tunde, negotiating, terms), 403)
  failsWith(() => store.approve(admin, unassigned, terms), 422, "ASSIGNEE_REQUIRED")
  failsWith(() => store.approve(admin, negotiating, { ...terms, priceKobo: 0 }), 422)
  failsWith(() => store.approve(admin, negotiating, { ...terms, date: "" }), 422)
  failsWith(() => store.approve(admin, negotiating, { ...terms, providerId: "" }), 422)
  failsWith(() => store.approve(admin, negotiating, { ...terms, providerId: "prv-chuks" }), 422) // unverified
  failsWith(() => store.approve(admin, negotiating, { ...terms, providerId: "nobody" }), 422)

  // A stale version is a 409 carrying the fresh request.
  const request = store.getRequest(admin, negotiating)
  const conflict = failsWith(
    () => store.approve(admin, negotiating, terms, request.version - 1),
    409,
    "VERSION_CONFLICT",
  )

  assert.equal((conflict.details as { current: { id: string } }).current.id, negotiating)
  assert.equal(store.getRequest(admin, negotiating).status, "submitted")

  const approved = store.approve(admin, negotiating, terms, request.version)

  assert.equal(approved.status, "approved")
  assert.equal(approved.version, request.version + 1)
  assert.deepEqual(approved.decision.terms, { ...terms, providerName: "Tunde Bakare" })
  assert.equal(approved.decision.by?.id, "usr-admin")
  assert.equal(approved.provider?.providerId, "usr-provider")
  assert.equal(approved.activity.at(-1)?.kind, "approved")

  // A second decision is a 409, fresh version or not; the decision cannot change.
  failsWith(() => store.approve(admin, negotiating, terms, approved.version), 409, "ALREADY_DECIDED")
  failsWith(
    () => store.deny(admin, negotiating, { reason: "Changed our mind about this." }, approved.version),
    409,
    "ALREADY_DECIDED",
  )
  assert.equal(store.getRequest(admin, negotiating).status, "approved")
  assert.equal(store.getRequest(customer, negotiating).decision.terms?.providerName, "Tunde Bakare") // A2

  // The assigned provider now has the job.
  assert.deepEqual(
    store
      .providerJobs(tunde)
      .map(item => item.id)
      .sort(),
    [negotiating, approvedId],
  )
}

// --- Deny: admin only, reason of at least 10 characters, unassigned requests allowed.
{
  const store = fresh()

  failsWith(() => store.deny(kemi, negotiating, { reason: "Outside our service area." }), 403)
  failsWith(() => store.deny(customer, negotiating, { reason: "Outside our service area." }), 403)
  failsWith(() => store.deny(admin, unassigned, { reason: "too short" }), 422)
  failsWith(() => store.deny(admin, unassigned, { reason: "         x         " }), 422)

  const request = store.getRequest(admin, unassigned)

  failsWith(
    () => store.deny(admin, unassigned, { reason: "Outside our service area." }, request.version + 1),
    409,
    "VERSION_CONFLICT",
  )

  const denied = store.deny(admin, unassigned, { reason: "  Outside our service area.  " }, request.version)

  assert.equal(denied.status, "denied")
  assert.equal(denied.decision.reason, "Outside our service area.")
  assert.equal(denied.version, request.version + 1)
  assert.equal(store.getRequest(customer, unassigned).decision.reason, "Outside our service area.")
  failsWith(() => store.deny(admin, unassigned, { reason: "Outside our service area." }), 409, "ALREADY_DECIDED")
  failsWith(() => store.approve(admin, unassigned, terms), 409, "ALREADY_DECIDED")
  assert.equal(store.counts(customer).denied, 2)
}

// --- Counter cards: the owner, an admin and the assigned staff only; latest-card rules; no effect on the request.
{
  const store = fresh()
  const before = store.getRequest(admin, negotiating)

  // The newest card is Kemi's, so the customer can counter it.
  const countered = store.sendMessage(customer, negotiating, {
    kind: "counter",
    text: "",
    attachments: [],
    counter: { amountKobo: 59_000_000, date: "2026-11-12", note: "Final answer" },
  })

  assert.equal(countered.kind, "counter")
  assert.equal(countered.authorRole, "customer")

  const cards = store.messages(admin, negotiating).filter(item => item.kind === "counter")

  assert.equal(cards.at(-1)?.id, countered.id)
  assert.equal(cards.at(-2)?.counter?.supersededBy, countered.counter?.id)
  assert.equal(cards.at(-1)?.counter?.supersededBy, null)

  // A customer cannot counter their own latest card.
  failsWith(
    () =>
      store.sendMessage(customer, negotiating, {
        kind: "counter",
        text: "",
        attachments: [],
        counter: { amountKobo: 1, date: null, note: "" },
      }),
    409,
    "NO_OFFER_TO_COUNTER",
  )
  // ...nor start a negotiation: with no Xpro card there is nothing to counter.
  failsWith(
    () =>
      store.sendMessage(customer, unassigned, {
        kind: "counter",
        text: "",
        attachments: [],
        counter: { amountKobo: 100, date: null, note: "" },
      }),
    409,
    "NO_OFFER_TO_COUNTER",
  )

  // The assigned staff member and the admin can send a quote or counter; an unassigned one cannot even read it.
  const quote = store.sendMessage(kemi, negotiating, {
    kind: "counter",
    text: "",
    attachments: [],
    counter: { amountKobo: 60_000_000, date: null, note: "" },
  })

  assert.equal(quote.authorRole, "staff")
  assert.equal(
    store.sendMessage(admin, negotiating, {
      kind: "counter",
      text: "",
      attachments: [],
      counter: { amountKobo: 59_500_000, date: "2026-11-13", note: "Admin offer" },
    }).authorRole,
    "admin",
  )
  failsWith(
    () =>
      store.sendMessage(zainab, negotiating, {
        kind: "counter",
        text: "",
        attachments: [],
        counter: { amountKobo: 100, date: null, note: "" },
      }),
    404,
  )
  // Admin or staff can open a negotiation on a thread with no cards yet.
  store.sendMessage(admin, unassigned, {
    kind: "counter",
    text: "",
    attachments: [],
    counter: { amountKobo: 44_000_000, date: null, note: "" },
  })
  // Validation.
  failsWith(
    () =>
      store.sendMessage(admin, unassigned, {
        kind: "counter",
        text: "",
        attachments: [],
        counter: { amountKobo: 0, date: null, note: "" },
      }),
    422,
  )
  failsWith(() => store.sendMessage(admin, unassigned, { kind: "counter", text: "", attachments: [] }), 422)
  failsWith(() => store.sendMessage(admin, unassigned, { kind: "text", text: "   ", attachments: [] }), 422)

  // Providers have no message access at all.
  failsWith(() => store.sendMessage(tunde, approvedId, { kind: "text", text: "hello", attachments: [] }), 403)
  failsWith(() => store.messages(tunde, approvedId), 403)

  // Messages never change the request.
  const after = store.getRequest(admin, negotiating)

  assert.equal(after.version, before.version)
  assert.equal(after.status, "submitted")
  assert.deepEqual(after.decision, before.decision)

  // Once decided, no new card can start, but text still flows.
  store.approve(admin, negotiating, terms)
  failsWith(
    () =>
      store.sendMessage(admin, negotiating, {
        kind: "counter",
        text: "",
        attachments: [],
        counter: { amountKobo: 100, date: null, note: "" },
      }),
    409,
    "COUNTER_CLOSED",
  )
  assert.equal(
    store.sendMessage(customer, negotiating, { kind: "text", text: "Thank you", attachments: [] }).kind,
    "text",
  )
  failsWith(
    () =>
      store.sendMessage(admin, deniedId, {
        kind: "counter",
        text: "",
        attachments: [],
        counter: { amountKobo: 100, date: null, note: "" },
      }),
    409,
    "COUNTER_CLOSED",
  )
}

// --- Provider candidates: verified and available only, best fit first.
{
  const store = fresh()
  const candidates = store.providerCandidates(admin, negotiating) // Construction in Ikeja

  assert.deepEqual(
    candidates.map(item => item.id),
    ["usr-provider", "prv-ngozi", "prv-femi"],
  )
  assert.ok(candidates.every(item => item.verified && item.available))
  assert.ok(!candidates.some(item => item.id === "prv-chuks"))
  assert.deepEqual(candidates[0].reasons, ["Offers Construction", "Serves Ikeja"])
  assert.equal(store.providerCandidates(kemi, negotiating).length, 3)
  failsWith(() => store.providerCandidates(zainab, negotiating), 404)
  failsWith(() => store.providerCandidates(customer, negotiating), 403)
  failsWith(() => store.providerCandidates(tunde, negotiating), 403)
}

// --- Replacing the provider: admin or assigned staff, after approval, with a reason; the old provider loses the job.
{
  const store = fresh()
  const request = store.getRequest(admin, approvedId)

  assert.deepEqual(
    store.providerJobs(tunde).map(item => item.id),
    [approvedId],
  )
  assert.equal(store.providerJobs(ngozi).length, 0)

  failsWith(
    () => store.replaceProvider(customer, approvedId, { providerId: "prv-ngozi", reason: "Better fit for this job." }),
    403,
  )
  failsWith(
    () => store.replaceProvider(tunde, approvedId, { providerId: "prv-ngozi", reason: "Better fit for this job." }),
    403,
  )
  failsWith(
    () => store.replaceProvider(zainab, approvedId, { providerId: "prv-ngozi", reason: "Better fit for this job." }),
    404,
  )
  failsWith(() => store.replaceProvider(admin, approvedId, { providerId: "prv-ngozi", reason: "short" }), 422)
  failsWith(
    () => store.replaceProvider(admin, approvedId, { providerId: "usr-provider", reason: "Better fit for this job." }),
    422,
  )
  failsWith(
    () => store.replaceProvider(admin, approvedId, { providerId: "prv-chuks", reason: "Better fit for this job." }),
    422,
  )
  failsWith(
    () =>
      store.replaceProvider(
        admin,
        approvedId,
        { providerId: "prv-ngozi", reason: "Better fit for this job." },
        request.version - 1,
      ),
    409,
    "VERSION_CONFLICT",
  )
  failsWith(
    () => store.replaceProvider(admin, unassigned, { providerId: "prv-ngozi", reason: "Better fit for this job." }),
    409,
    "NOT_APPROVED",
  )

  const replaced = store.replaceProvider(
    kemi,
    approvedId,
    { providerId: "prv-ngozi", reason: "Better fit for this job." },
    request.version,
  )

  assert.equal(replaced.provider?.providerId, "prv-ngozi")
  assert.equal(replaced.status, "approved")
  assert.equal(replaced.decision.terms?.providerName, "Tunde Bakare") // the decision stays as recorded
  assert.equal(replaced.activity.at(-1)?.kind, "provider_replaced")
  assert.equal(store.providerJobs(tunde).length, 0)
  assert.deepEqual(
    store.providerJobs(ngozi).map(item => item.id),
    [approvedId],
  )
  failsWith(() => store.providerJob(tunde, approvedId), 404)
  assert.equal(store.providerJob(ngozi, approvedId).id, approvedId)

  const adminReplace = store.replaceProvider(admin, approvedId, {
    providerId: "usr-provider",
    reason: "Back to the first provider.",
  })

  assert.equal(adminReplace.provider?.providerId, "usr-provider")
}

// --- Provider jobs: only their own, and nothing about the customer's price (A3).
{
  const store = fresh()
  const job = store.providerJob(tunde, approvedId)

  assert.equal(job.customer.name, "Ada Okafor")
  assert.equal(job.customer.phone, "08031234567")
  assert.equal(job.date.length, 10)
  assert.ok(!JSON.stringify(job).toLowerCase().includes("price"))
  assert.ok(!JSON.stringify(job).includes("budget"))
  failsWith(() => store.providerJob(tunde, negotiating), 404) // not approved, not theirs
  failsWith(() => store.providerJob(ngozi, approvedId), 404)
  failsWith(() => store.providerJob(tunde, "XPR-99999"), 404)
  failsWith(() => store.providerJobs(customer), 403)
  failsWith(() => store.providerJobs(admin), 403)
}

// --- Conversations: admins see every customer thread; customers their own; staff and providers none.
{
  const store = fresh()
  const rows = store.adminConversations(admin)

  assert.deepEqual(rows.map(item => item.requestId).sort(), [negotiating, approvedId])

  const negotiation = rows.find(item => item.requestId === negotiating)!

  assert.equal(negotiation.waitingForXpro, 0) // Kemi spoke last
  assert.equal(negotiation.lastMessage?.kind, "counter")
  assert.equal(store.adminConversations(admin, { q: "generator" }).length, 1)
  assert.equal(store.adminConversations(admin, { q: "ada okafor" }).length, 2)

  store.sendMessage(customer, negotiating, { kind: "text", text: "Any update?", attachments: [] })
  store.sendMessage(customer, negotiating, { kind: "text", text: "Hello?", attachments: [] })
  assert.equal(store.adminConversations(admin).find(item => item.requestId === negotiating)?.waitingForXpro, 2)

  assert.equal(store.customerConversations(customer).length, 2)
  assert.equal(store.customerConversations(customer)[0].assignee, null)
  assert.equal(store.customerConversations(other).length, 0)
  failsWith(() => store.adminConversations(kemi), 403)
  failsWith(() => store.adminConversations(customer), 403)
  failsWith(() => store.adminConversations(tunde), 403)
  failsWith(() => store.customerConversations(admin), 403)
}

// --- State is kept in storage between loads, and reset goes back to the seed.
{
  const memory = new Map<string, string>()
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => void memory.set(key, value),
    removeItem: (key: string) => void memory.delete(key),
  }
  const first = createV1Store({ storage, now: () => now })

  first.deny(admin, unassigned, { reason: "Outside our service area." })
  assert.ok(memory.has(storageKey))

  const second = createV1Store({ storage, now: () => now })

  assert.equal(second.getRequest(admin, unassigned).status, "denied")
  second.reset(now)
  assert.equal(second.getRequest(admin, unassigned).status, "submitted")
  assert.equal(createV1Store({ storage, now: () => now }).getRequest(admin, unassigned).status, "submitted")

  memory.set(storageKey, "{not json")
  assert.equal(createV1Store({ storage, now: () => now }).listRequests(admin).total, 4)
  memory.set(storageKey, JSON.stringify({ schema: 99, requests: [], messages: [] }))
  assert.equal(createV1Store({ storage, now: () => now }).listRequests(admin).total, 4)
}

console.log("v1-mock-store: ok")
