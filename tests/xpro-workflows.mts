import assert from 'node:assert/strict'
import { createOperationsState } from '@/features/operations/fixtures.ts'
import { applyCommand, currentAssignment, currentSchedule, inbox, payoutReady, pendingApprovals, profileChangeRows, providerQuoteView, publicProvider, publicQuote, quoteTotal, visibleAssignments, visibleDetails, visibleMessages, visibleRequests, visibleUpdates } from '@/features/operations/workflow.ts'
import { intakeFields, isFinished, lineTotal, money, requestStatuses, statusLabelFor, statusLabels } from '@/features/operations/types.ts'
import { isNuban, maskAccount, resolveAccountDemo } from '@/features/operations/banks.ts'
import { messageAuthorLabel, staffCan } from '@/features/operations/staff.ts'
import type { Actor, Command, ProviderInput, RequestInput, RequestStatus, ServiceLine } from '@/features/operations/types.ts'

const customer: Actor = { id: 'usr-customer', name: 'Ada', email: 'customer@xpro.test', role: 'customer' }
const provider: Actor = { id: 'usr-provider', name: 'Tunde', email: 'provider@xpro.test', role: 'provider' }
const admin: Actor = { id: 'usr-admin', name: 'Amara', email: 'admin@xpro.test', role: 'admin' }
const stranger: Actor = { ...customer, id: 'another-customer' }
const nneka: Actor = { id: 'provider-nneka', name: 'Nneka', email: 'nneka@example.test', role: 'provider' }
const staffActor = (id: string, name: string, email: string): Actor => ({ id, name, email, role: 'admin' })
const operations = staffActor('usr-operations', 'Kemi', 'operations@xpro.test')
const pricing = staffActor('usr-pricing', 'Chidi', 'pricing@xpro.test')
const relations = staffActor('usr-relations', 'Zainab', 'relations@xpro.test')
const finance: Actor = { id: 'usr-finance', name: 'Ngozi', email: 'finance@xpro.test', role: 'admin' }
const demoPhoto = { id: 'face', name: 'Face.jpg', size: 1000, type: 'image/jpeg' }
const demoBank = { bankCode: '058', accountNumber: '0123456789', accountName: 'TUNDE BAKARE' }
let state = createOperationsState()
state.requests = []

const run = (actor: Actor, command: Command) => { state = applyCommand(state, actor, command) }

const fails = (actor: Actor, command: Command) => {
  const snapshot = JSON.stringify(state)

  assert.throws(() => applyCommand(state, actor, command))
  assert.equal(JSON.stringify(state), snapshot, 'Failed mutations must be atomic')
}

const failsWith = (actor: Actor, command: Command, pattern: RegExp) => {
  const snapshot = JSON.stringify(state)

  assert.throws(() => applyCommand(state, actor, command), pattern)
  assert.equal(JSON.stringify(state), snapshot, 'Failed mutations must be atomic')
}

const future = new Date(Date.now() + 5 * 86400000).toISOString()
for (const service of Object.keys(intakeFields) as ServiceLine[]) {
  const input: RequestInput = { title: `Test ${service} request`, service, city: 'Abuja', address: 'Demo site', phone: '0800 000 0000', description: 'A sufficiently detailed demo brief for the service.', budget: 120000, startDate: '', attachments: [], details: {} }
  for (const field of intakeFields[service]) {
    if (field.required)
      input.details[field.key] = field.options?.[0] ?? (field.type === 'number' ? '2' : field.type === 'date' ? future.slice(0, 10) : 'Demo requirement')
  }
  run(customer, { type: 'request.create', input })
}
assert.equal(state.requests.length, 6, 'Every service accepts its dedicated brief')

const requestId = state.requests.find(item => item.service === 'Construction')!.id
const request = () => state.requests.find(item => item.id === requestId)!
const newNotes = (before: number) => state.notifications.slice(0, state.notifications.length - before)

// Provider alerts: matching approved, available providers in the city hear about the request, but cannot open it.
assert.deepEqual(request().alertedProviderIds, ['provider-nneka'])
assert.deepEqual(state.requests.find(item => item.service === 'Procurement')!.alertedProviderIds, [], 'Pending and out-of-city providers are not alerted')

const alertNote = state.notifications.find(item => item.recipientId === 'provider-nneka' && item.title === 'New Construction request in Abuja')!

assert(alertNote, 'Alerted provider receives a notification')
assert.equal(alertNote.requestId, undefined, 'Alert carries no request id')
assert(!alertNote.message.includes('Test Construction request'), 'Alert carries no request title')
assert(!state.notifications.some(item => item.recipientId === provider.id && item.title.startsWith('New ')), 'Unverified providers are not alerted')
assert.equal(visibleRequests(state, nneka).length, 0, 'Alerted providers cannot view the request')
assert(state.audit.some(item => item.action === 'Providers alerted' && item.requestId === requestId))

// Quote rates are whole kobo: 2 x N120,000.
const line = [{ description: 'Construction service', quantity: 2, rate: 12000000 }]

fails(stranger, { type: 'request.cancel', requestId, note: 'Invalid access' })
fails(customer, { type: 'provider.review', providerId: provider.id, decision: 'approved', note: '' })
fails(admin, { type: 'assignment.offer', requestId, providerId: provider.id, note: 'Not approved' })
run(provider, { type: 'provider.submit', input: { phone: '0800 000 0001', trade: 'Construction', city: 'Abuja', services: ['Construction'], experience: 8, bio: 'Demo introduction', documents: [{ id: 'identity', name: 'Identity.pdf', size: 1000, type: 'application/pdf' }], portfolio: [], photo: demoPhoto, bank: demoBank } })
run(admin, { type: 'provider.review', providerId: provider.id, decision: 'approved', note: 'Reviewed documents' })
run(admin, { type: 'request.review', requestId, clarify: true, note: 'Please confirm site access.' })
run(customer, { type: 'message.send', requestId, channel: 'customer', text: 'Site access confirmed.', attachments: [] })
let before = state.notifications.length
run(admin, { type: 'assignment.offer', requestId, providerId: provider.id, note: 'Suitable for service and location' })
assert.equal(visibleRequests(state, provider).length, 1)
assert.equal(newNotes(before).find(item => item.recipientId === provider.id && item.title === 'Assignment offered')!.requestId, requestId, 'An offered provider can open the request')

// Provider acceptance is held for XPro; the customer hears nothing until it is confirmed.
before = state.notifications.length
run(provider, { type: 'assignment.respond', requestId, assignmentId: currentAssignment(request())!.id, accept: true, note: 'Accepted' })
assert.equal(currentAssignment(request())!.status, 'pending_approval')
assert.notEqual(request().status, 'matched')
assert(!newNotes(before).some(item => item.recipientId === customer.id), 'Customer is not told about a pending acceptance')
assert(newNotes(before).every(item => item.recipientId.startsWith('usr-')), 'Only staff hear about a pending acceptance')
fails(provider, { type: 'quote.contribute', requestId, items: line, note: 'Too early' })
fails(provider, { type: 'assignment.review', requestId, assignmentId: currentAssignment(request())!.id, approve: true, note: '' })
fails(pricing, { type: 'assignment.review', requestId, assignmentId: currentAssignment(request())!.id, approve: true, note: '' })
fails(admin, { type: 'assignment.review', requestId, assignmentId: currentAssignment(request())!.id, approve: false, note: ' ' })
before = state.notifications.length
run(admin, { type: 'assignment.review', requestId, assignmentId: currentAssignment(request())!.id, approve: false, note: 'Please confirm your availability first.' })
assert.equal(request().assignments.at(-1)!.status, 'withdrawn')
assert.equal(request().status, 'under_review')
assert(newNotes(before).some(item => item.recipientId === provider.id && item.title === 'Assignment not confirmed' && item.message.includes('availability')))
assert.equal(state.audit.find(item => item.action === 'Assignment rejected')!.note, 'Please confirm your availability first.', 'Review notes are kept in the activity history')
assert.equal(visibleRequests(state, provider).length, 0)
run(admin, { type: 'assignment.offer', requestId, providerId: provider.id, note: 'Suitable for service and location' })
run(provider, { type: 'assignment.respond', requestId, assignmentId: currentAssignment(request())!.id, accept: true, note: 'Accepted' })
before = state.notifications.length
run(admin, { type: 'assignment.review', requestId, assignmentId: currentAssignment(request())!.id, approve: true, note: '' })
assert.equal(currentAssignment(request())!.status, 'accepted')
assert.equal(request().status, 'matched')
assert(newNotes(before).some(item => item.recipientId === customer.id && item.title === 'Provider matched'))
assert(newNotes(before).some(item => item.recipientId === provider.id && item.title === 'Assignment confirmed by XPro'))
fails(admin, { type: 'assignment.review', requestId, assignmentId: currentAssignment(request())!.id, approve: true, note: '' })
run(provider, { type: 'quote.contribute', requestId, items: line, note: 'Provider cost' })
run(admin, { type: 'quote.save', requestId, items: line, note: 'Customer scope' })
let quoteId = request().quotes.at(-1)!.id
before = state.notifications.length
run(admin, { type: 'quote.publish', requestId, quoteId })
assert.equal(publicQuote(request())!.total, 24000000)
assert.equal(quoteTotal(line), 24000000, 'Total is the sum of quantity x kobo rate')

const publishedNote = newNotes(before).find(item => item.recipientId === provider.id && item.title === 'Quote sent to customer')!

assert(publishedNote, 'The assigned provider hears that the quote was sent')
assert.equal(publishedNote.requestId, requestId)
assert(!/\d{4}|₦|NGN/.test(publishedNote.message.replace(requestId, '')), 'The provider notification carries no amounts')
assert(newNotes(before).some(item => item.recipientId === customer.id && item.title === 'Quote ready to review'))

// Providers see the scope of the quote, never its money.
const scopeView = providerQuoteView(request())!

assert.deepEqual(scopeView.lines, [{ description: 'Construction service', quantity: 2 }])
assert.equal(scopeView.status, 'sent')
assert(!/rate|total|note|12000000|24000000/.test(JSON.stringify(scopeView)), 'The provider view carries no money')
failsWith(admin, { type: 'quote.save', requestId, quoteId: 'missing-quote', items: line, note: 'No such version' }, /no longer exists/)
failsWith(admin, { type: 'quote.save', requestId, items: [{ ...line[0], rate: 1.5 }], note: 'Fractional kobo' }, /unit price/)
failsWith(admin, { type: 'quote.save', requestId, items: [{ ...line[0], rate: 0 }], note: 'Free' }, /unit price/)
failsWith(admin, { type: 'quote.save', requestId, items: [{ ...line[0], quantity: 0 }], note: 'No quantity' }, /unit price/)
failsWith(admin, { type: 'quote.save', requestId, items: [{ ...line[0], rate: Number.MAX_SAFE_INTEGER }, { ...line[0], rate: Number.MAX_SAFE_INTEGER }], note: 'Too large' }, /too large/)
failsWith(provider, { type: 'quote.contribute', requestId, items: [{ ...line[0], rate: Number.NaN }], note: 'Not a number' }, /unit price/)
fails(admin, { type: 'quote.save', requestId, quoteId, items: line, note: 'Cannot mutate a published version' })
failsWith(customer, { type: 'quote.respond', requestId, quoteId, decision: 'maybe' as 'accepted', note: 'Unclear' }, /accept, decline or request/)
run(customer, { type: 'quote.respond', requestId, quoteId, decision: 'revision_requested', note: 'Reduce quantity to one.' })
assert(!newNotes(before).some(item => item.recipientId === provider.id && item.title === 'Customer accepted the quote'), 'Only an acceptance is passed to the provider')
run(admin, { type: 'quote.save', requestId, items: [{ ...line[0], quantity: 1 }], note: 'Revised scope' })
quoteId = request().quotes.at(-1)!.id
run(admin, { type: 'quote.publish', requestId, quoteId })
assert.equal(request().quotes[0].items[0].quantity, 2, 'Published line items are retained')
before = state.notifications.length
run(customer, { type: 'quote.respond', requestId, quoteId, decision: 'accepted', note: '' })
assert(newNotes(before).some(item => item.recipientId === provider.id && item.title === 'Customer accepted the quote' && item.requestId === requestId))
assert.equal(providerQuoteView(request())!.status, 'accepted')
assert.deepEqual(providerQuoteView(request())!.lines, [{ description: 'Construction service', quantity: 1 }])
run(admin, { type: 'schedule.propose', requestId, startAt: future, note: 'Site visit' })
let scheduleId = currentSchedule(request())!.id
run(customer, { type: 'schedule.respond', requestId, scheduleId, accept: false, note: 'Later date please' })
run(admin, { type: 'schedule.propose', requestId, startAt: new Date(Date.parse(future) + 86400000).toISOString(), note: 'Revised date' })

const oldScheduleId = scheduleId

scheduleId = currentSchedule(request())!.id
fails(provider, { type: 'schedule.respond', requestId, scheduleId: oldScheduleId, accept: true, note: '' })
run(customer, { type: 'schedule.respond', requestId, scheduleId, accept: true, note: '' })
assert.equal(currentSchedule(request())!.status, 'proposed')
run(provider, { type: 'schedule.respond', requestId, scheduleId, accept: true, note: '' })
assert.equal(request().status, 'scheduled')
run(admin, { type: 'message.send', requestId, channel: 'internal', text: 'Private admin note', attachments: [] })
run(admin, { type: 'message.send', requestId, channel: 'provider', text: 'Private provider conversation', attachments: [] })
assert(!visibleMessages(request(), customer).some(item => item.channel !== 'customer'))
assert(!visibleMessages(request(), provider).some(item => item.channel !== 'provider'))
assert.equal(visibleMessages(request(), stranger).length, 0)
fails(customer, { type: 'message.send', requestId, channel: 'internal', text: 'Forbidden', attachments: [] })

// Customer and provider responses never carry personal names.
assert.deepEqual(currentSchedule(request())!.responses, ['Customer: Confirmed', 'Provider: Confirmed'])
assert(!currentSchedule(request())!.responses.concat(request().schedules.flatMap(item => item.responses)).some(item => item.includes('Ada') || item.includes('Tunde')))
assert(request().schedules.some(item => item.responses.includes('Customer: Later date please')))

// Progress updates are held for XPro review before they change the job or reach the customer.
const reviewUpdate = (approve: boolean, note = '') => run(operations, { type: 'progress.review', requestId, updateId: request().updates[0].id, approve, note })

before = state.notifications.length
run(provider, { type: 'progress.add', requestId, status: 'in_progress', note: 'Work started', attachments: [] })
assert.equal(request().status, 'scheduled', 'A pending update does not change the job status')
assert.equal(request().updates[0].review.state, 'pending')
assert.equal(visibleUpdates(request(), customer).length, 0, 'Customers do not see pending updates')
assert.equal(visibleUpdates(request(), provider).length, 1)
assert.equal(visibleUpdates(request(), admin).length, 1)
assert(!newNotes(before).some(item => item.recipientId === customer.id), 'Customer is not told about a pending update')
fails(provider, { type: 'progress.add', requestId, status: 'in_progress', note: 'Second update', attachments: [] })
failsWith(pricing, { type: 'progress.review', requestId, updateId: request().updates[0].id, approve: true, note: '' }, /staff role does not allow/)
failsWith(relations, { type: 'progress.review', requestId, updateId: request().updates[0].id, approve: true, note: '' }, /staff role does not allow/)
fails(provider, { type: 'progress.review', requestId, updateId: request().updates[0].id, approve: true, note: '' })
fails(operations, { type: 'progress.review', requestId, updateId: request().updates[0].id, approve: false, note: '' })
before = state.notifications.length
reviewUpdate(false, 'Please add photos of the site.')
assert.equal(request().updates[0].review.state, 'rejected')
assert.equal(request().status, 'scheduled', 'A rejected update leaves the job status alone')
assert(newNotes(before).some(item => item.recipientId === provider.id && item.title === 'Update not approved' && item.message.includes('photos')))
assert.equal(visibleUpdates(request(), customer).length, 0)
fails(operations, { type: 'progress.review', requestId, updateId: request().updates[0].id, approve: true, note: '' })
run(provider, { type: 'progress.add', requestId, status: 'in_progress', note: 'Work started, photos to follow', attachments: [] })
before = state.notifications.length
reviewUpdate(true)
assert.equal(request().status, 'in_progress')
assert(newNotes(before).some(item => item.recipientId === customer.id && item.title === 'Progress update'))
assert(newNotes(before).some(item => item.recipientId === provider.id && item.title === 'Update approved'))
assert.equal(visibleUpdates(request(), customer).length, 1)
run(provider, { type: 'progress.add', requestId, status: 'blocked', note: 'Access delayed', attachments: [] })
reviewUpdate(true)
assert.equal(request().status, 'blocked')
run(provider, { type: 'progress.add', requestId, status: 'in_progress', note: 'Access resolved', attachments: [] })
reviewUpdate(true)
fails(provider, { type: 'progress.add', requestId, status: 'completion_pending', note: 'No evidence', attachments: [] })
run(provider, { type: 'progress.add', requestId, status: 'completion_pending', note: 'Completed work', attachments: [{ id: 'proof', name: 'Report.pdf', size: 1200, type: 'application/pdf' }] })
assert.equal(request().status, 'in_progress', 'Completion only becomes pending after approval')
fails(customer, { type: 'completion.respond', requestId, acknowledge: true, note: '' })
assert(pendingApprovals(state).some(item => item.kind === 'completion' && item.requestId === requestId))
before = state.notifications.length
reviewUpdate(true)
assert.equal(request().status, 'completion_pending')
assert(newNotes(before).some(item => item.recipientId === customer.id && item.title === 'Please confirm your job is complete'))
fails(admin, { type: 'request.close', requestId })
run(customer, { type: 'completion.respond', requestId, acknowledge: false, note: 'One finish needs correcting.' })
assert.equal(state.audit.find(item => item.action === 'Completion issue reported' && item.requestId === requestId)!.note, 'One finish needs correcting.')
assert.equal(request().status, 'blocked')
failsWith(provider, { type: 'progress.add', requestId, status: 'in_progress', note: 'Carrying on regardless', attachments: [] }, /resolving the issue/)
before = state.notifications.length
run(admin, { type: 'issue.resolve', requestId, issueId: request().issues[0].id, note: 'Finish corrected and inspected.' })
assert.equal(request().status, 'completion_pending')
assert(newNotes(before).some(item => item.recipientId === provider.id && item.title === 'Issue resolved' && item.requestId === requestId))
failsWith(admin, { type: 'issue.resolve', requestId, issueId: request().issues[0].id, note: 'Resolved twice' }, /resolution for the open issue/)
run(customer, { type: 'completion.respond', requestId, acknowledge: true, note: '' })
run(admin, { type: 'request.close', requestId })
assert.equal(request().status, 'closed')
failsWith(customer, { type: 'message.send', requestId, channel: 'customer', text: 'Thanks again', attachments: [] }, /request is closed/)
failsWith(admin, { type: 'message.send', requestId, channel: 'internal', text: 'Wrap up', attachments: [] }, /request is closed/)
failsWith(admin, { type: 'request.flag', requestId, note: 'Too late' }, /request is closed/)
failsWith(admin, { type: 'request.reassign', requestId, staffId: 'usr-relations', note: 'Too late' }, /request is closed/)

const otherId = state.requests.find(item => item.service === 'Design')!.id

// Customer cancellation is a request until XPro approves it.
const otherRequest = () => state.requests.find(item => item.id === otherId)!

before = state.notifications.length
run(customer, { type: 'request.cancel', requestId: otherId, note: 'No longer needed.' })
assert.notEqual(otherRequest().status, 'cancelled')
assert.equal(otherRequest().cancellationRequest!.review.state, 'pending')
assert(newNotes(before).length > 0 && newNotes(before).every(item => item.recipientId !== customer.id && item.title === 'Cancellation requested'))
fails(customer, { type: 'request.cancel', requestId: otherId, note: 'Asking again.' })
fails(customer, { type: 'cancellation.review', requestId: otherId, approve: true, note: '' })
fails(pricing, { type: 'cancellation.review', requestId: otherId, approve: true, note: '' })
fails(admin, { type: 'cancellation.review', requestId: otherId, approve: false, note: '' })
before = state.notifications.length
run(admin, { type: 'cancellation.review', requestId: otherId, approve: false, note: 'Design work has already begun.' })
assert.notEqual(otherRequest().status, 'cancelled')
assert.equal(otherRequest().cancellationRequest!.review.state, 'rejected')
assert(newNotes(before).some(item => item.recipientId === customer.id && item.message.includes('already begun')))
assert.equal(state.audit.find(item => item.action === 'Cancellation not approved' && item.requestId === otherId)!.note, 'Design work has already begun.')
fails(admin, { type: 'cancellation.review', requestId: otherId, approve: true, note: '' })
run(customer, { type: 'request.cancel', requestId: otherId, note: 'No longer needed.' })
run(admin, { type: 'cancellation.review', requestId: otherId, approve: true, note: '' })
assert.equal(otherRequest().status, 'cancelled')
assert.equal(otherRequest().cancellationRequest!.review.state, 'approved')
assert(state.audit.length > 20)
assert(state.audit.every(item => item.actorId && typeof item.note === 'string'), 'Every activity entry records the actor id and a note')
assert(state.notifications.every(item => Boolean(item.recipientId)))

// Staff roles, request ownership, quote sign-off and staff accounts.
const find = (id: string) => state.requests.find(item => item.id === id)!
const staffRecord = (id: string) => state.staff.find(item => item.id === id)!
const recipientsSince = (before: number) => [...new Set(state.notifications.slice(0, state.notifications.length - before).map(item => item.recipientId))].sort()
const denied = /staff role does not allow/
// Naira in, kobo out: the draft rates below are written in naira for readability.
const draftLine = (naira: number) => [{ description: 'Staff test service', quantity: 1, rate: Math.round(naira * 100) }]

// Role limits are enforced by the reducer and stay atomic.
state = createOperationsState()
assert.equal(state.schema, 5)
assert.equal(state.settings.quoteApprovalThreshold, null)
assert.equal(find('XPR-00001').staffOwnerId, '')
assert.equal(find('XPR-00002').staffOwnerId, 'usr-operations')
failsWith(operations, { type: 'quote.save', requestId: 'XPR-00003', items: draftLine(100000), note: 'Not pricing' }, denied)
run(pricing, { type: 'quote.save', requestId: 'XPR-00003', items: draftLine(100000), note: 'Pricing draft' })

const pricedQuoteId = find('XPR-00003').quotes.at(-1)!.id

failsWith(operations, { type: 'quote.publish', requestId: 'XPR-00003', quoteId: pricedQuoteId }, denied)
failsWith(relations, { type: 'quote.publish', requestId: 'XPR-00003', quoteId: pricedQuoteId }, denied)
failsWith(pricing, { type: 'assignment.offer', requestId: 'XPR-00001', providerId: 'provider-nneka', note: 'Not dispatch' }, denied)
failsWith(pricing, { type: 'message.send', requestId: 'XPR-00003', channel: 'customer', text: 'Hello', attachments: [] }, denied)
failsWith(pricing, { type: 'request.review', requestId: 'XPR-00001', clarify: false, note: '' }, denied)
failsWith(relations, { type: 'request.close', requestId: 'XPR-00005' }, denied)
failsWith(relations, { type: 'assignment.withdraw', requestId: 'XPR-00003', assignmentId: 'XPR-00003-assignment', note: 'Not dispatch' }, denied)
failsWith(relations, { type: 'schedule.propose', requestId: 'XPR-00003', startAt: future, note: 'Not dispatch' }, denied)
failsWith(operations, { type: 'staff.invite', name: 'New Person', email: 'new@xpro.test', roles: ['pricing'] }, denied)
failsWith(operations, { type: 'settings.save', quoteApprovalThreshold: 500000 }, denied)
failsWith(customer, { type: 'request.claim', requestId: 'XPR-00001' }, /not available for your account type/)
run(pricing, { type: 'message.send', requestId: 'XPR-00003', channel: 'internal', text: 'Pricing note', attachments: [] })
assert.equal(find('XPR-00003').messages.at(-1)!.authorRole, 'admin')
assert.equal(find('XPR-00003').staffOwnerId, 'usr-operations', 'Pricing staff never change the owner')

// New requests alert everyone who can claim, never pricing staff.
before = state.notifications.length
run(customer, { type: 'request.create', input: { title: 'Ownership request', service: 'Hire', city: 'Abuja', address: 'Demo site', phone: '0800 000 0000', description: 'A sufficiently detailed demo brief for ownership.', budget: 0, startDate: '', attachments: [], details: { hireType: 'Professional', trade: 'Surveyor', quantity: '1', endDate: future.slice(0, 10) } } })
assert.deepEqual(recipientsSince(before), ['provider-nneka', 'usr-admin', 'usr-customer', 'usr-operations', 'usr-relations'], 'The customer gets a receipt; staff who can claim and the alerted provider are told')
assert.equal(state.notifications.find(item => item.recipientId === customer.id && item.title === 'Request received')!.requestId, state.requests[0].id)

const ownedId = state.requests[0].id

assert.equal(find(ownedId).staffOwnerId, '')
assert.equal(find(ownedId).claimedAt, '')

// First admin action auto-claims; later events only reach the owner (and pricing for pricing events).
before = state.notifications.length
run(operations, { type: 'request.review', requestId: ownedId, clarify: false, note: 'Reviewing intake.' })
assert.equal(find(ownedId).staffOwnerId, 'usr-operations')
assert(find(ownedId).claimedAt)
assert(state.audit.some(item => item.action === 'Request claimed automatically' && item.requestId === ownedId))
assert(!recipientsSince(before).includes('usr-pricing'))
before = state.notifications.length
run(customer, { type: 'message.send', requestId: ownedId, channel: 'customer', text: 'Any update?', attachments: [] })
assert.deepEqual(recipientsSince(before), ['usr-operations'])
run(relations, { type: 'message.send', requestId: ownedId, channel: 'customer', text: 'We are on it.', attachments: [] })
assert.equal(find(ownedId).staffOwnerId, 'usr-operations', 'Later actors do not take ownership')
before = state.notifications.length
run(customer, { type: 'quote.respond', requestId: 'XPR-00003', quoteId: find('XPR-00003').quotes.find(item => item.status === 'sent')!.id, decision: 'revision_requested', note: 'Please revise.' })
assert.deepEqual(recipientsSince(before), ['usr-operations', 'usr-pricing'], 'Pricing events reach the owner and pricing role only, not super admins or client relations')
before = state.notifications.length
run(provider, { type: 'provider.submit', input: { phone: '0800 000 0001', trade: 'Construction', city: 'Abuja', services: ['Construction'], experience: 8, bio: 'Demo introduction', documents: [{ id: 'identity-2', name: 'Identity.pdf', size: 1000, type: 'application/pdf' }], portfolio: [], photo: demoPhoto, bank: demoBank } })
assert.deepEqual(recipientsSince(before), ['usr-admin', 'usr-finance', 'usr-operations'], 'Only provider and bank reviewers hear about provider submissions')
assert(!recipientsSince(before).includes('usr-pricing'))

// Claiming and reassigning.
const unclaimedId = 'XPR-00001'

failsWith(operations, { type: 'request.claim', requestId: 'XPR-00002' }, /already has an owner/)
failsWith(pricing, { type: 'request.claim', requestId: unclaimedId }, denied)
run(relations, { type: 'request.claim', requestId: unclaimedId })
assert.equal(find(unclaimedId).staffOwnerId, 'usr-relations')
failsWith(operations, { type: 'request.claim', requestId: unclaimedId }, /already has an owner/)
failsWith(operations, { type: 'request.reassign', requestId: unclaimedId, staffId: 'usr-operations', note: 'Not allowed' }, denied)
failsWith(admin, { type: 'request.reassign', requestId: unclaimedId, staffId: 'usr-pricing', note: 'Pricing cannot own' }, /can own requests/)
failsWith(admin, { type: 'request.reassign', requestId: unclaimedId, staffId: 'usr-operations', note: ' ' }, /reason/)
before = state.notifications.length
run(admin, { type: 'request.reassign', requestId: unclaimedId, staffId: 'usr-operations', note: 'Operations leads this one.' })
assert.equal(find(unclaimedId).staffOwnerId, 'usr-operations')
assert.deepEqual(recipientsSince(before), ['usr-operations', 'usr-relations'])

const reassignAudit = state.audit.find(item => item.action === 'Request owner reassigned' && item.requestId === unclaimedId)!

assert.equal(reassignAudit.note, 'Operations leads this one.', 'The reassignment reason is stored')
assert.equal(reassignAudit.actorId, 'usr-admin')

// Flag notes are trimmed and a blank note clears the flag.
run(operations, { type: 'request.flag', requestId: unclaimedId, note: '  Chase the customer  ' })
assert.equal(find(unclaimedId).flag, 'Chase the customer')
assert.equal(state.audit[0].action, 'Escalation flagged')
assert.equal(state.audit[0].note, 'Chase the customer')
run(operations, { type: 'request.flag', requestId: unclaimedId, note: '   ' })
assert.equal(find(unclaimedId).flag, '')
assert.equal(state.audit[0].action, 'Escalation cleared')
assert(state.notifications.some(item => item.title === 'Request assigned to you' && item.recipientId === 'usr-operations'))

// Pricing staff draft on an unclaimed request without becoming its owner.
run(pricing, { type: 'quote.save', requestId: 'XPR-00004', items: draftLine(50000), note: 'Pricing prep' })
assert.equal(find('XPR-00004').staffOwnerId, '')

// Quote sign-off threshold.
state = createOperationsState()
failsWith(pricing, { type: 'settings.save', quoteApprovalThreshold: 300000 }, denied)
failsWith(admin, { type: 'settings.save', quoteApprovalThreshold: 0 }, /positive/)
failsWith(admin, { type: 'settings.save', quoteApprovalThreshold: -5 }, /positive/)
failsWith(admin, { type: 'settings.save', quoteApprovalThreshold: Number.NaN }, /positive/)
run(admin, { type: 'settings.save', quoteApprovalThreshold: 300000 })
assert.equal(state.settings.quoteApprovalThreshold, 30000000)
run(pricing, { type: 'quote.save', requestId: 'XPR-00003', items: draftLine(100000), note: 'Below threshold' })
run(pricing, { type: 'quote.publish', requestId: 'XPR-00003', quoteId: find('XPR-00003').quotes.at(-1)!.id })
assert.equal(find('XPR-00003').quotes.at(-1)!.status, 'sent')
assert.equal(find('XPR-00003').quotes.at(-1)!.publishedBy, 'usr-pricing')
run(pricing, { type: 'quote.save', requestId: 'XPR-00003', items: draftLine(400000), note: 'High value' })

const highQuoteId = find('XPR-00003').quotes.at(-1)!.id

before = state.notifications.length
run(pricing, { type: 'quote.publish', requestId: 'XPR-00003', quoteId: highQuoteId })
assert.equal(find('XPR-00003').quotes.at(-1)!.status, 'draft')
assert.equal(find('XPR-00003').quotes.at(-1)!.approvalRequestedBy, 'usr-pricing')
assert.equal(find('XPR-00003').quotes.at(-1)!.publishedBy, '')
run(pricing, { type: 'quote.save', requestId: 'XPR-00003', quoteId: highQuoteId, items: draftLine(400000), note: 'Edited after request' })
assert.equal(find('XPR-00003').quotes.at(-1)!.approvalRequestedBy, '', 'Editing a draft clears a pending approval request')
assert(state.audit.some(item => item.action === 'Quote approval request cleared after edit'))
run(pricing, { type: 'quote.publish', requestId: 'XPR-00003', quoteId: highQuoteId })
assert.equal(find('XPR-00003').quotes.at(-1)!.approvalRequestedBy, 'usr-pricing', 'Publishing again re-requests approval')
assert.equal(find('XPR-00003').quotes.at(-1)!.status, 'draft')
assert.equal(find('XPR-00003').status, 'quoted')
assert.deepEqual(recipientsSince(before), ['usr-admin'])
assert(state.notifications.slice(0, state.notifications.length - before).every(item => item.title === 'Quote approval needed'))
assert(state.audit.some(item => item.action === 'Quote approval requested'))
run(admin, { type: 'quote.publish', requestId: 'XPR-00003', quoteId: highQuoteId })
assert.equal(find('XPR-00003').quotes.at(-1)!.status, 'sent')
assert.equal(find('XPR-00003').quotes.at(-1)!.publishedBy, 'usr-admin')
assert.equal(find('XPR-00003').quotes.at(-1)!.approvalRequestedBy, '')

// Staff accounts.
state = createOperationsState()
failsWith(admin, { type: 'staff.invite', name: 'Duplicate', email: 'PRICING@xpro.test', roles: ['pricing'] }, /already exists/)
failsWith(admin, { type: 'staff.invite', name: 'X', email: 'short@xpro.test', roles: ['pricing'] }, /full name/)
failsWith(admin, { type: 'staff.invite', name: 'No Roles', email: 'noroles@xpro.test', roles: [] }, /role/)
failsWith(admin, { type: 'staff.invite', name: 'Bad Email', email: 'not-an-email', roles: ['pricing'] }, /email/)
run(admin, { type: 'staff.invite', name: 'Ngozi Eze', email: 'ngozi@xpro.test', roles: ['super_admin'] })

const invited = state.staff.at(-1)!

assert.equal(invited.status, 'invited')
assert.equal(invited.history[0].action, 'Invited')

const invitedActor = staffActor(invited.id, invited.name, invited.email)

failsWith(invitedActor, { type: 'request.review', requestId: 'XPR-00001', clarify: false, note: '' }, /not active/)
failsWith(admin, { type: 'staff.status', staffId: 'usr-admin', status: 'suspended', reassignTo: '' }, /own account status/)
failsWith(admin, { type: 'staff.roles', staffId: 'usr-admin', roles: ['operations'] }, /At least one active super admin/)
run(admin, { type: 'staff.status', staffId: invited.id, status: 'active', reassignTo: '' })
failsWith(admin, { type: 'staff.status', staffId: invited.id, status: 'active', reassignTo: '' }, /already active/)
run(invitedActor, { type: 'staff.roles', staffId: 'usr-admin', roles: ['operations'] })
assert.deepEqual(staffRecord('usr-admin').roles, ['operations'])
failsWith(invitedActor, { type: 'staff.roles', staffId: invited.id, roles: ['pricing'] }, /At least one active super admin/)
failsWith(admin, { type: 'staff.invite', name: 'Not Allowed', email: 'denied@xpro.test', roles: ['pricing'] }, denied)
run(invitedActor, { type: 'staff.roles', staffId: 'usr-admin', roles: ['super_admin'] })

// Suspending an owner requires a successor.
const ownedByOperations = state.requests.filter(item => item.staffOwnerId === 'usr-operations' && !['closed', 'cancelled'].includes(item.status)).map(item => item.id)

assert(ownedByOperations.length > 0)
failsWith(admin, { type: 'staff.status', staffId: 'usr-operations', status: 'suspended', reassignTo: '' }, /takes over/)
failsWith(admin, { type: 'staff.status', staffId: 'usr-operations', status: 'suspended', reassignTo: 'usr-pricing' }, /can own requests/)
failsWith(admin, { type: 'staff.status', staffId: 'usr-operations', status: 'suspended', reassignTo: 'usr-operations' }, /can own requests/)
run(admin, { type: 'staff.status', staffId: 'usr-operations', status: 'suspended', reassignTo: 'usr-relations' })
assert.equal(staffRecord('usr-operations').status, 'suspended')
assert(ownedByOperations.every(id => find(id).staffOwnerId === 'usr-relations'))
assert(state.staff.every(item => item.history.length > 0))
failsWith(operations, { type: 'request.review', requestId: 'XPR-00001', clarify: false, note: '' }, /not active/)
failsWith(operations, { type: 'message.send', requestId: 'XPR-00001', channel: 'internal', text: 'Still here?', attachments: [] }, /not active/)
failsWith(operations, { type: 'request.claim', requestId: 'XPR-00001' }, /not active/)
failsWith(admin, { type: 'request.reassign', requestId: ownedByOperations[0], staffId: 'usr-operations', note: 'Suspended staff cannot own' }, /can own requests/)
run(admin, { type: 'staff.status', staffId: 'usr-operations', status: 'active', reassignTo: '' })
run(operations, { type: 'request.claim', requestId: 'XPR-00001' })

// Customers and providers never see staff names.
const seeded = createOperationsState().requests[0].messages[0]

assert.equal(messageAuthorLabel(seeded, 'customer'), 'XPro Team')
assert.equal(messageAuthorLabel({ ...seeded, channel: 'provider' }, 'provider'), 'XPro Dispatch')
run(relations, { type: 'message.send', requestId: 'XPR-00003', channel: 'customer', text: 'Customer-facing note', attachments: [] })
run(relations, { type: 'message.send', requestId: 'XPR-00003', channel: 'provider', text: 'Provider-facing note', attachments: [] })

const customerNote = find('XPR-00003').messages.find(item => item.text === 'Customer-facing note')!
const providerNote = find('XPR-00003').messages.find(item => item.text === 'Provider-facing note')!

assert.equal(customerNote.author, 'Zainab')
assert.equal(messageAuthorLabel(customerNote, 'customer'), 'XPro Team')
assert.equal(messageAuthorLabel(providerNote, 'provider'), 'XPro Dispatch')
assert.equal(messageAuthorLabel(customerNote, 'admin'), 'Zainab')
assert.equal(messageAuthorLabel({ ...customerNote, authorRole: 'customer', author: 'Ada' }, 'provider'), 'Ada')

// Approval queue seed data and permission-gated reviews.
state = createOperationsState()
assert.deepEqual(pendingApprovals(state).map(item => item.kind).sort(), ['assignment', 'bank', 'bank', 'cancellation', 'progress', 'provider'])
assert.deepEqual(pendingApprovals(state).map(item => item.createdAt), [...pendingApprovals(state).map(item => item.createdAt)].sort(), 'Queue is oldest first')
assert.equal(visibleUpdates(find('XPR-00002'), customer).length, 1, 'Customers only see approved updates')
assert.equal(visibleUpdates(find('XPR-00002'), nneka).length, 2)
assert.equal(visibleUpdates(find('XPR-00002'), stranger).length, 1)
assert(find('XPR-00004').assignments.some(item => item.status === 'pending_approval'))
assert.equal(visibleRequests(state, nneka).some(item => item.id === 'XPR-00004'), true, 'A provider can open the job they accepted')
failsWith(pricing, { type: 'assignment.review', requestId: 'XPR-00004', assignmentId: 'XPR-00004-assignment', approve: true, note: '' }, denied)
failsWith(relations, { type: 'progress.review', requestId: 'XPR-00002', updateId: 'XPR-00002-update-pending', approve: true, note: '' }, denied)
failsWith(pricing, { type: 'cancellation.review', requestId: 'XPR-00003', approve: true, note: '' }, denied)
run(operations, { type: 'assignment.review', requestId: 'XPR-00004', assignmentId: 'XPR-00004-assignment', approve: true, note: '' })
assert.equal(find('XPR-00004').status, 'matched')
run(operations, { type: 'progress.review', requestId: 'XPR-00002', updateId: 'XPR-00002-update-pending', approve: true, note: '' })
assert.equal(find('XPR-00002').status, 'in_progress')
assert.equal(visibleUpdates(find('XPR-00002'), customer).length, 2)
run(relations, { type: 'cancellation.review', requestId: 'XPR-00003', approve: true, note: '' })
assert.equal(find('XPR-00003').status, 'cancelled')
assert.deepEqual(pendingApprovals(state).map(item => item.kind).sort(), ['bank', 'bank', 'provider'], 'Reviewed items leave the queue')

// An admin cancelling directly clears a pending customer request.
state = createOperationsState()
run(relations, { type: 'request.cancel', requestId: 'XPR-00003', note: 'Cancelled by XPro.' })
assert.equal(find('XPR-00003').status, 'cancelled')
assert.equal(find('XPR-00003').cancellationRequest!.review.state, 'approved')

// Provider onboarding, bank verification and payout details.
const onboarding = (patch: Partial<ProviderInput> = {}): ProviderInput => ({ phone: '0800 000 0001', trade: 'Construction', city: 'Abuja', services: ['Construction'], experience: 8, bio: 'Demo introduction', documents: [{ id: 'identity-3', name: 'Identity.pdf', size: 1000, type: 'application/pdf' }], portfolio: [], photo: demoPhoto, bank: demoBank, ...patch })
const profileOf = (id: string) => state.providers.find(item => item.id === id)!

state = createOperationsState()
assert(staffCan(staffRecord('usr-finance'), 'bank.review'))
assert(!staffCan(staffRecord('usr-finance'), 'provider.review'))
assert(!staffCan(staffRecord('usr-operations'), 'bank.review'))
failsWith(finance, { type: 'request.claim', requestId: 'XPR-00001' }, denied)
assert(payoutReady(profileOf('provider-nneka')), 'Seeded verified provider can be paid')
assert(!payoutReady(profileOf('provider-ibrahim')), 'First bank details are still pending')
assert(!payoutReady(profileOf('provider-aisha')), 'A pending bank change blocks payouts')
assert.equal(profileOf('provider-aisha').payout.current!.accountNumber, '0690000031', 'The old account stays on record')
assert.equal(profileOf('usr-provider').payout.current, null)
assert.deepEqual(pendingApprovals(state).filter(item => item.kind === 'bank').map(item => item.providerId).sort(), ['provider-aisha', 'provider-ibrahim'])

// Provider submission requires a photo and valid bank details, atomically.
failsWith(provider, { type: 'provider.submit', input: onboarding({ photo: null }) }, /face photo/)
failsWith(provider, { type: 'provider.submit', input: onboarding({ photo: { ...demoPhoto, type: 'application/pdf' } }) }, /face photo/)
failsWith(provider, { type: 'provider.submit', input: onboarding({ bank: { ...demoBank, accountNumber: '012345678' } }) }, /10-digit/)
failsWith(provider, { type: 'provider.submit', input: onboarding({ bank: { ...demoBank, bankCode: '000' } }) }, /Choose a bank/)
failsWith(provider, { type: 'provider.submit', input: onboarding({ bank: { ...demoBank, accountName: ' ' } }) }, /Verify the account name/)
before = state.notifications.length
run(provider, { type: 'provider.submit', input: onboarding() })
assert.equal(profileOf(provider.id).payout.pending!.bankName, 'Guaranty Trust Bank')
assert.equal(profileOf(provider.id).payout.review!.state, 'pending')
assert.equal(profileOf(provider.id).payout.current, null)
assert.equal(profileOf(provider.id).photo!.name, 'Face.jpg')
assert(!('bank' in profileOf(provider.id)), 'The bank input is not stored on the profile')
assert.equal(profileOf(provider.id).payout.history[0].action, 'Bank details submitted')
assert(recipientsSince(before).includes('usr-finance'))
assert(!recipientsSince(before).includes('usr-pricing'))
assert(state.notifications.some(item => item.recipientId === 'usr-finance' && item.title === 'Bank details to verify' && item.message === 'Tunde'))
assert(!payoutReady(profileOf(provider.id)))
assert(pendingApprovals(state).some(item => item.kind === 'bank' && item.providerId === provider.id))

// Resubmitting the same pending bank does not notify Finance again.
before = state.notifications.length
run(provider, { type: 'provider.submit', input: onboarding() })
assert(!newNotes(before).some(item => item.title === 'Bank details to verify'))
assert.equal(profileOf(provider.id).payout.history.length, 1)

// Only bank reviewers decide, and a rejection needs a reason.
failsWith(operations, { type: 'payout.review', providerId: provider.id, approve: true, note: '' }, denied)
failsWith(pricing, { type: 'payout.review', providerId: provider.id, approve: true, note: '' }, denied)
failsWith(provider, { type: 'payout.review', providerId: provider.id, approve: true, note: '' }, /not available for your account type/)
failsWith(finance, { type: 'payout.review', providerId: provider.id, approve: false, note: ' ' }, /Explain/)
failsWith(finance, { type: 'payout.review', providerId: 'provider-nneka', approve: true, note: '' }, /not awaiting review/)
before = state.notifications.length
run(finance, { type: 'payout.review', providerId: provider.id, approve: true, note: 'Name matches.' })
assert.equal(profileOf(provider.id).payout.current!.accountNumber, '0123456789')
assert.equal(profileOf(provider.id).payout.pending, null)
assert.equal(profileOf(provider.id).payout.review!.state, 'approved')
assert.equal(profileOf(provider.id).payout.review!.by, 'usr-finance')
assert(payoutReady(profileOf(provider.id)))
assert(newNotes(before).some(item => item.recipientId === provider.id && item.title === 'Payout details approved'))
assert(state.audit.some(item => item.action === 'Bank details approved'))
assert(!pendingApprovals(state).some(item => item.kind === 'bank' && item.providerId === provider.id))

// Changing details later keeps the old account and blocks payouts until reviewed.
const newBank = { bankCode: '033', accountNumber: '2109876543', accountName: 'TUNDE BAKARE' }

failsWith(provider, { type: 'payout.update', bank: demoBank }, /already your payout details/)
failsWith(provider, { type: 'payout.update', bank: { ...newBank, accountNumber: '123' } }, /10-digit/)
failsWith(customer, { type: 'payout.update', bank: newBank }, /not available for your account type/)
failsWith({ ...provider, id: 'new-provider' }, { type: 'payout.update', bank: newBank }, /Complete your provider profile/)

const verificationBefore = profileOf(provider.id).verification

before = state.notifications.length
run(provider, { type: 'payout.update', bank: newBank })
assert.equal(profileOf(provider.id).payout.current!.bankName, 'Guaranty Trust Bank', 'Current account unchanged until approval')
assert.equal(profileOf(provider.id).payout.pending!.bankName, 'United Bank for Africa')
assert.equal(profileOf(provider.id).verification, verificationBefore, 'A bank change does not reopen identity verification')
assert(!payoutReady(profileOf(provider.id)))
assert(recipientsSince(before).includes('usr-finance') && !recipientsSince(before).includes('usr-operations'))
assert.equal(profileOf(provider.id).payout.history[0].action, 'Bank change requested')
failsWith(provider, { type: 'payout.update', bank: { ...newBank, accountNumber: '3109876543' } }, /still awaiting XPro review/)
failsWith(finance, { type: 'payout.review', providerId: provider.id, approve: false, note: '' }, /Explain/)
before = state.notifications.length
run(finance, { type: 'payout.review', providerId: provider.id, approve: false, note: 'Account name does not match.' })
assert.equal(profileOf(provider.id).payout.current!.accountNumber, '0123456789', 'Rejection keeps the current account')
assert.equal(profileOf(provider.id).payout.pending, null)
assert.equal(profileOf(provider.id).payout.review!.state, 'rejected')
assert.equal(profileOf(provider.id).payout.review!.note, 'Account name does not match.')
assert(payoutReady(profileOf(provider.id)))
assert(newNotes(before).some(item => item.recipientId === provider.id && item.title === 'Payout details not approved' && item.message === 'Account name does not match.'))
run(provider, { type: 'payout.update', bank: newBank })
run(admin, { type: 'payout.review', providerId: provider.id, approve: true, note: '' })
assert.equal(profileOf(provider.id).payout.current!.accountNumber, '2109876543', 'Super admins hold every permission')

// Submitting the profile again with the current account is not a bank change.
before = state.notifications.length
run(provider, { type: 'provider.submit', input: onboarding({ bank: newBank }) })
assert(!newNotes(before).some(item => item.title === 'Bank details to verify'))
assert.equal(profileOf(provider.id).payout.pending, null)
assert(payoutReady(profileOf(provider.id)))

// The seeded bank change is approved from the queue.
run(finance, { type: 'payout.review', providerId: 'provider-aisha', approve: true, note: '' })
assert.equal(profileOf('provider-aisha').payout.current!.bankName, 'United Bank for Africa')
assert(payoutReady(profileOf('provider-aisha')))

// The public projection never exposes the face photo or payout details.
for (const item of state.providers.filter(entry => entry.verification === 'approved')) {
  assert(item.payout, 'Approved provider records carry payout details')

  const projection = publicProvider(item)

  assert(!('photo' in projection) && !('payout' in projection) && !('documents' in projection) && !('email' in projection))
  assert(!JSON.stringify(projection).includes(item.payout.current?.accountNumber ?? 'no-account'))
}

// Simulated bank lookup.
assert.equal(await resolveAccountDemo('058', '0123456789', 'Tunde Bakare'), 'TUNDE BAKARE')
await assert.rejects(resolveAccountDemo('000', '0123456789', 'Tunde'), /Choose a bank/)
await assert.rejects(resolveAccountDemo('058', '12345', 'Tunde'), /10-digit/)
await assert.rejects(resolveAccountDemo('058', '0123450000', 'Tunde'), /could not verify/)
assert(isNuban('0123456789') && !isNuban('012345678') && !isNuban('01234567ab'))
assert.equal(maskAccount('0123456789'), '******6789')

// ---------------------------------------------------------------------------
// Known-issue fixes: money in kobo, enum checks, notes, notifications, privacy, bank rule, rule gaps.
// ---------------------------------------------------------------------------
const aisha: Actor = { id: 'provider-aisha', name: 'Aisha', email: 'aisha@example.test', role: 'provider' }
const newRequest = (patch: Partial<RequestInput> = {}): RequestInput => ({ title: 'Fresh construction request', service: 'Construction', city: 'Abuja', address: 'Demo site', phone: '0800 000 0000', description: 'A sufficiently detailed demo brief for the service.', budget: 0, startDate: '', attachments: [], details: { workType: 'Floor finishing' }, ...patch })

// A1: seeded rates are whole kobo and totals add up.
state = createOperationsState()

const seededQuote = find('XPR-00003').quotes[0]

assert.equal(seededQuote.items[0].rate, 35000000, 'Seeded rates are kobo')
assert.equal(seededQuote.total, lineTotal(seededQuote.items[0]))
assert(money(seededQuote.total).includes('350,000'))
assert.equal(quoteTotal([{ description: 'Half day', quantity: 0.5, rate: 333 }]), 167, 'Each line rounds to a whole kobo')

// A2: enum values are checked by the reducer, atomically.
failsWith(nneka, { type: 'progress.add', requestId: 'XPR-00002', status: 'paused' as 'blocked', note: 'Pausing', attachments: [] }, /valid update type/)
failsWith(customer, { type: 'quote.respond', requestId: 'XPR-00003', quoteId: 'XPR-00003-quote', decision: 'maybe' as 'accepted', note: 'Unclear' }, /accept, decline or request/)
failsWith(admin, { type: 'message.send', requestId: 'XPR-00002', channel: 'public' as 'internal', text: 'Hello', attachments: [] }, /valid conversation/)
failsWith(customer, { type: 'message.send', requestId: 'XPR-00002', channel: 'toString' as 'customer', text: 'Hello', attachments: [] }, /valid conversation/)
failsWith(admin, { type: 'staff.status', staffId: 'usr-pricing', status: 'deleted' as 'active', reassignTo: '' }, /active or suspended/)
failsWith(admin, { type: 'provider.review', providerId: 'provider-ibrahim', decision: 'maybe' as 'approved', note: '' }, /approve, request changes or reject/)

// A3: notes and actor ids reach the activity history and the review histories.
run(operations, { type: 'progress.review', requestId: 'XPR-00002', updateId: 'XPR-00002-update-pending', approve: false, note: 'Photos are blurry.' })
assert.equal(state.audit[0].action, 'Progress update rejected')
assert.equal(state.audit[0].note, 'Photos are blurry.')
assert.equal(state.audit[0].actorId, 'usr-operations')
run(operations, { type: 'provider.review', providerId: 'provider-ibrahim', decision: 'changes_requested', note: 'Add a clearer photo.' })
assert.equal(state.audit[0].note, 'Add a clearer photo.')
run(finance, { type: 'payout.review', providerId: 'provider-ibrahim', approve: true, note: 'Name matches.' })
assert.equal(state.audit[0].note, 'Name matches.')
assert.equal(profileOf('provider-ibrahim').payout.history[0].byId, 'usr-finance')
assert.equal(profileOf('provider-ibrahim').payout.history[0].by, 'Ngozi')
run(admin, { type: 'staff.invite', name: 'Extra Person', email: 'extra@xpro.test', roles: ['pricing'] })
assert.equal(state.staff.at(-1)!.history[0].byId, 'usr-admin')
assert(state.staff.every(item => item.history.every(entry => entry.byId)))
run(relations, { type: 'request.cancel', requestId: 'XPR-00001', note: 'Duplicate request.' })
assert.equal(state.audit.find(item => item.action === 'Request cancelled' && item.requestId === 'XPR-00001')!.note, 'Duplicate request.')
assert(state.audit.every(item => item.actorId && typeof item.note === 'string'))

// A5: the provider view of a quote never carries money, and never shows drafts.
state = createOperationsState()
assert.equal(providerQuoteView(find('XPR-00001')), null)
run(pricing, { type: 'quote.save', requestId: 'XPR-00003', items: draftLine(999999), note: 'Unpublished draft' })

const sentView = providerQuoteView(find('XPR-00003'))!

assert.deepEqual(sentView.lines, [{ description: 'Service and coordination', quantity: 1 }])
assert.equal(sentView.status, 'sent')
assert(!/350000|35000000|999999|99999900/.test(JSON.stringify(sentView)))

// A6: provider privacy for the customer's provider preference and for dispatch history.
run(customer, { type: 'request.create', input: newRequest({ details: { workType: 'Floor finishing', preferredProviderId: 'provider-nneka' } }) })

const preferred = state.requests[0]

assert.equal(visibleDetails(preferred, customer).preferredProviderId, 'provider-nneka')
assert.equal(visibleDetails(preferred, admin).preferredProviderId, 'provider-nneka')
assert(!('preferredProviderId' in visibleDetails(preferred, nneka)))
assert.equal(visibleDetails(preferred, nneka).workType, 'Floor finishing')
assert.equal(preferred.details.preferredProviderId, 'provider-nneka', 'The stored request is untouched')

const multi = structuredClone(find('XPR-00002'))

multi.assignments.unshift({ id: 'earlier', providerId: 'provider-ibrahim', status: 'declined', note: 'Internal dispatch note', response: 'Too busy', createdAt: new Date().toISOString() })
assert.deepEqual(visibleAssignments(multi, nneka).map(item => item.id), ['XPR-00002-assignment'], 'Providers only see their own assignments')
assert.equal(visibleAssignments(multi, nneka)[0].note, 'Matched to the service and location.', 'The offered provider still sees the dispatch note')
assert.equal(visibleAssignments(multi, admin).length, 2)
assert.equal(visibleAssignments(multi, admin)[0].note, 'Internal dispatch note')
assert(visibleAssignments(multi, customer).every(item => item.note === ''), 'Customers never see the dispatch note')
assert.equal(multi.assignments[1].note, 'Matched to the service and location.', 'The stored assignment is untouched')

// A7: payouts pause during a bank change, and profile submissions cannot replace a pending change.
state = createOperationsState()

const aishaInput = (bank = { bankCode: '033', accountNumber: '2109876543', accountName: 'AISHA MATERIAL SUPPLY' }): ProviderInput => ({ phone: '0800 000 0004', trade: 'Materials and fittings supplier', city: 'Lagos', services: ['Procurement'], experience: 7, bio: 'Building materials and fittings sourced and delivered to your site.', documents: [{ id: 'aisha-doc-1', name: 'CAC.pdf', size: 1000, type: 'application/pdf' }], portfolio: [], photo: { id: 'aisha-photo', name: 'Aisha-photo.jpg', size: 80000, type: 'image/jpeg' }, bank })

assert(!payoutReady(profileOf('provider-aisha')))
failsWith(aisha, { type: 'provider.submit', input: aishaInput({ bankCode: '058', accountNumber: '0123456789', accountName: 'AISHA MATERIAL SUPPLY' }) }, /still awaiting XPro review/)
failsWith(aisha, { type: 'provider.submit', input: aishaInput({ bankCode: '044', accountNumber: '0690000031', accountName: 'AISHA MATERIAL SUPPLY' }) }, /still awaiting XPro review/)
before = state.notifications.length
run(aisha, { type: 'provider.submit', input: aishaInput() })
assert(!newNotes(before).some(item => item.title === 'Bank details to verify'), 'Resubmitting the pending bank does not notify Finance again')
assert.equal(profileOf('provider-aisha').payout.pending!.accountNumber, '2109876543')
assert.equal(profileOf('provider-aisha').payout.history.length, 2)
assert(!payoutReady(profileOf('provider-aisha')))

// A8: rule gaps.
state = createOperationsState()
assert.equal(find('XPR-00001').status, 'submitted')
run(operations, { type: 'assignment.offer', requestId: 'XPR-00001', providerId: 'provider-nneka', note: 'Offer from intake' })
assert.equal(find('XPR-00001').status, 'under_review', 'Making an offer moves a submitted request into review')
failsWith(customer, { type: 'completion.respond', requestId: 'XPR-00002', acknowledge: true, note: '' }, /not awaiting your confirmation/)
run(customer, { type: 'completion.respond', requestId: 'XPR-00005', acknowledge: false, note: 'Report is incomplete.' })

const issueId = find('XPR-00005').issues[0].id

assert.equal(find('XPR-00005').status, 'blocked')
find('XPR-00005').status = 'completion_pending'
failsWith(customer, { type: 'completion.respond', requestId: 'XPR-00005', acknowledge: true, note: '' }, /Resolve open issues/)
find('XPR-00005').status = 'in_progress'
failsWith(relations, { type: 'issue.resolve', requestId: 'XPR-00005', issueId, note: 'Resolved.' }, /blocked job/)
find('XPR-00005').status = 'blocked'
failsWith(nneka, { type: 'progress.add', requestId: 'XPR-00005', status: 'in_progress', note: 'Carrying on', attachments: [] }, /resolving the issue/)
before = state.notifications.length
run(relations, { type: 'issue.resolve', requestId: 'XPR-00005', issueId, note: 'Report replaced.' })
assert.equal(find('XPR-00005').status, 'completion_pending')
assert(newNotes(before).some(item => item.recipientId === 'provider-nneka' && item.title === 'Issue resolved'))
assert.equal(state.audit[0].note, 'Report replaced.')

// A new published quote supersedes an accepted one and cancels the confirmed schedule.
assert.equal(find('XPR-00006').quotes[0].status, 'accepted')
assert.equal(currentSchedule(find('XPR-00006'))!.status, 'confirmed')
run(pricing, { type: 'quote.save', requestId: 'XPR-00006', items: draftLine(450000), note: 'Revised scope' })

const revisedId = find('XPR-00006').quotes.at(-1)!.id

before = state.notifications.length
run(pricing, { type: 'quote.publish', requestId: 'XPR-00006', quoteId: revisedId })
assert.equal(find('XPR-00006').quotes[0].status, 'superseded')
assert.equal(find('XPR-00006').quotes.at(-1)!.status, 'sent')
assert(!find('XPR-00006').quotes.some(item => item.status === 'accepted'))
assert.equal(currentSchedule(find('XPR-00006'))!.status, 'cancelled')
assert.equal(find('XPR-00006').status, 'quoted')
assert.equal(publicQuote(find('XPR-00006'))!.id, revisedId)
assert(newNotes(before).some(item => item.recipientId === 'provider-nneka' && item.title === 'Quote sent to customer'))

// Closed, cancelled and rejected requests refuse messages, flags and reassignment.
failsWith(customer, { type: 'message.send', requestId: 'XPR-00007', channel: 'customer', text: 'Hello?', attachments: [] }, /request is closed/)
failsWith(admin, { type: 'request.flag', requestId: 'XPR-00007', note: 'Flag' }, /request is closed/)
failsWith(admin, { type: 'request.reassign', requestId: 'XPR-00007', staffId: 'usr-relations', note: 'Move it' }, /request is closed/)
run(relations, { type: 'request.cancel', requestId: 'XPR-00003', note: 'Customer withdrew.' })
failsWith(admin, { type: 'message.send', requestId: 'XPR-00003', channel: 'customer', text: 'Hello?', attachments: [] }, /request is closed/)
failsWith(admin, { type: 'request.flag', requestId: 'XPR-00003', note: 'Flag' }, /request is closed/)
failsWith(admin, { type: 'request.reassign', requestId: 'XPR-00003', staffId: 'usr-relations', note: 'Move it' }, /request is closed/)

// A9: alerts and availability require a vetted provider.
state = createOperationsState()
run(nneka, { type: 'provider.availability', available: false })
run(customer, { type: 'request.create', input: newRequest({ details: { workType: 'Floor finishing', preferredProviderId: 'provider-nneka' } }) })
assert.deepEqual(state.requests[0].alertedProviderIds, [], 'An unavailable preferred provider is not alerted')
assert(!state.notifications.some(item => item.recipientId === 'provider-nneka' && item.title.startsWith('New ')))
run(nneka, { type: 'provider.availability', available: true })
run(customer, { type: 'request.create', input: newRequest({ city: 'Lagos', details: { workType: 'Floor finishing', preferredProviderId: 'provider-nneka' } }) })
assert.deepEqual(state.requests[0].alertedProviderIds, ['provider-nneka'], 'A preferred provider is alerted whatever the city')
failsWith(provider, { type: 'provider.availability', available: true }, /must be approved/)
failsWith({ ...nneka, id: 'provider-ibrahim' }, { type: 'provider.availability', available: true }, /must be approved/)

// A10: the inbox lists everything, and providers are only linked to requests they can open.
state = createOperationsState()
state.preferences[customer.id] = { name: 'Ada', phone: '', email: true, push: true, inApp: false, timezone: 'Africa/Lagos' }
before = state.notifications.length
run(customer, { type: 'request.create', input: newRequest() })

const quietReceipt = newNotes(before).find(item => item.recipientId === customer.id && item.title === 'Request received')!

assert(!quietReceipt.channels.includes('In-app'), 'The preference only changes the delivery channels')
assert(inbox(state, customer.id).some(item => item.id === quietReceipt.id), 'The inbox shows every notification')
assert(!inbox(state, customer.id).some(item => item.recipientId !== customer.id))
before = state.notifications.length
run(operations, { type: 'assignment.withdraw', requestId: 'XPR-00004', assignmentId: 'XPR-00004-assignment', note: 'Reassigning.' })
assert.equal(newNotes(before).find(item => item.recipientId === 'provider-nneka' && item.title === 'Assignment withdrawn')!.requestId, undefined, 'No link once the provider lost access')
assert(newNotes(before).some(item => item.recipientId === customer.id && item.title === 'Assignment withdrawn' && item.requestId === 'XPR-00004'))

// B1: an approved provider stays public while sensitive edits wait for review.
state = createOperationsState()

const nnekaBank = { bankCode: '058', accountNumber: '0123456789', accountName: 'NNEKA SERVICES LTD' }
const nnekaInput = (patch: Partial<ProviderInput> = {}): ProviderInput => ({ phone: '0800 000 0002', trade: 'Building and property services', city: 'Abuja', services: ['Design', 'Construction', 'Hire', 'Facility management', 'Waste management'], experience: 12, bio: profileOf('provider-nneka').bio, documents: [{ id: 'nneka-doc', name: 'Verification-pack.pdf', size: 240000, type: 'application/pdf' }], portfolio: profileOf('provider-nneka').portfolio, photo: { id: 'nneka-photo', name: 'Nneka-photo.jpg', size: 80000, type: 'image/jpeg' }, bank: nnekaBank, ...patch })
const publicIds = () => state.providers.filter(item => item.verification === 'approved').map(item => item.id)

before = state.notifications.length
run(nneka, { type: 'provider.submit', input: nnekaInput({ phone: '0800 111 2222', experience: 15, bio: 'Updated public introduction.', portfolio: [] }) })
assert.equal(profileOf('provider-nneka').verification, 'approved')
assert.equal(profileOf('provider-nneka').phone, '0800 111 2222', 'Non-sensitive fields apply immediately')
assert.equal(profileOf('provider-nneka').experience, 15)
assert.equal(profileOf('provider-nneka').bio, 'Updated public introduction.')
assert.deepEqual(profileOf('provider-nneka').portfolio, [])
assert.equal(profileOf('provider-nneka').pendingChanges, null)
assert(publicIds().includes('provider-nneka'))
assert.equal(publicProvider(profileOf('provider-nneka')).bio, 'Updated public introduction.')
assert(!newNotes(before).some(item => item.title === 'Profile changes to review' || item.title === 'Provider verification submitted'))
assert(!pendingApprovals(state).some(item => item.providerId === 'provider-nneka' && (item.kind === 'provider' || item.kind === 'provider_changes')))
assert(state.audit.some(item => item.action === 'Provider profile updated'))

const newPhoto = { id: 'nneka-photo-2', name: 'New-photo.jpg', size: 1000, type: 'image/png' }
const sensitive = nnekaInput({ trade: 'Civil works contractor', services: ['Design', 'Construction'], photo: newPhoto })

before = state.notifications.length
run(nneka, { type: 'provider.submit', input: sensitive })
assert.equal(profileOf('provider-nneka').verification, 'approved', 'The provider stays approved')
assert(publicIds().includes('provider-nneka'), 'The provider stays public')
assert.equal(profileOf('provider-nneka').trade, 'Building and property services', 'Sensitive fields wait for review')
assert.equal(profileOf('provider-nneka').services.length, 5)
assert.equal(profileOf('provider-nneka').photo!.id, 'nneka-photo')
assert.equal(profileOf('provider-nneka').pendingChanges!.trade, 'Civil works contractor')
assert.equal(profileOf('provider-nneka').changesReview!.state, 'pending')
assert.equal(publicProvider(profileOf('provider-nneka')).trade, 'Building and property services', 'The public profile keeps the current trade')
assert.deepEqual(profileChangeRows(profileOf('provider-nneka')).map(row => row.label), ['Trade', 'Services', 'Face photo'])
assert.deepEqual(recipientsSince(before), ['usr-admin', 'usr-operations'], 'Only provider reviewers are told')
assert(newNotes(before).every(item => item.title === 'Profile changes to review'))
assert(pendingApprovals(state).some(item => item.kind === 'provider_changes' && item.providerId === 'provider-nneka'))
before = state.notifications.length
run(nneka, { type: 'provider.submit', input: sensitive })
assert(!newNotes(before).some(item => item.title === 'Profile changes to review'), 'Resubmitting the same pending changes does not notify again')
failsWith(relations, { type: 'provider.changes.review', providerId: 'provider-nneka', approve: true, note: '' }, denied)
failsWith(finance, { type: 'provider.changes.review', providerId: 'provider-nneka', approve: true, note: '' }, denied)
failsWith(nneka, { type: 'provider.changes.review', providerId: 'provider-nneka', approve: true, note: '' }, /not available for your account type/)
failsWith(operations, { type: 'provider.changes.review', providerId: 'provider-nneka', approve: false, note: ' ' }, /Explain/)
failsWith(operations, { type: 'provider.changes.review', providerId: 'provider-aisha', approve: true, note: '' }, /not awaiting review/)
before = state.notifications.length
run(operations, { type: 'provider.changes.review', providerId: 'provider-nneka', approve: false, note: 'The photo is unclear.' })
assert.equal(profileOf('provider-nneka').trade, 'Building and property services')
assert.equal(profileOf('provider-nneka').pendingChanges, null)
assert.equal(profileOf('provider-nneka').changesReview!.state, 'rejected')
assert.equal(profileOf('provider-nneka').changesReview!.note, 'The photo is unclear.')
assert.equal(profileOf('provider-nneka').verification, 'approved')
assert(publicIds().includes('provider-nneka'))
assert(newNotes(before).some(item => item.recipientId === 'provider-nneka' && item.title === 'Profile changes not approved' && item.message === 'The photo is unclear.'))
assert.equal(state.audit[0].note, 'The photo is unclear.')
assert(!pendingApprovals(state).some(item => item.kind === 'provider_changes'))
failsWith(operations, { type: 'provider.changes.review', providerId: 'provider-nneka', approve: true, note: '' }, /not awaiting review/)
run(nneka, { type: 'provider.submit', input: sensitive })
before = state.notifications.length
run(operations, { type: 'provider.changes.review', providerId: 'provider-nneka', approve: true, note: 'Looks good.' })
assert.equal(profileOf('provider-nneka').trade, 'Civil works contractor')
assert.deepEqual(profileOf('provider-nneka').services, ['Design', 'Construction'])
assert.equal(profileOf('provider-nneka').photo!.name, 'New-photo.jpg')
assert.equal(profileOf('provider-nneka').pendingChanges, null)
assert.equal(profileOf('provider-nneka').changesReview!.state, 'approved')
assert.equal(profileOf('provider-nneka').changesReview!.by, 'usr-operations')
assert.equal(profileOf('provider-nneka').verification, 'approved')
assert.equal(publicProvider(profileOf('provider-nneka')).trade, 'Civil works contractor')
assert(newNotes(before).some(item => item.recipientId === 'provider-nneka' && item.title === 'Profile changes approved'))

// Asking for the current values again withdraws pending changes.
run(nneka, { type: 'provider.submit', input: nnekaInput({ trade: 'Interior fit-out', services: ['Design', 'Construction'], photo: newPhoto }) })
assert.equal(profileOf('provider-nneka').pendingChanges!.trade, 'Interior fit-out')
run(nneka, { type: 'provider.submit', input: nnekaInput({ trade: 'Civil works contractor', services: ['Design', 'Construction'], photo: newPhoto }) })
assert.equal(profileOf('provider-nneka').pendingChanges, null)
assert.equal(profileOf('provider-nneka').changesReview, null)
assert(!pendingApprovals(state).some(item => item.kind === 'provider_changes'))

// B2: rejecting a request.
state = createOperationsState()
run(customer, { type: 'request.create', input: newRequest() })

const rejectId = state.requests[0].id

run(operations, { type: 'assignment.offer', requestId: rejectId, providerId: 'provider-nneka', note: 'Offer first.' })
assert.equal(find(rejectId).status, 'under_review')
failsWith(pricing, { type: 'request.reject', requestId: rejectId, note: 'No capacity.' }, denied)
failsWith(finance, { type: 'request.reject', requestId: rejectId, note: 'No capacity.' }, denied)
failsWith(customer, { type: 'request.reject', requestId: rejectId, note: 'No capacity.' }, /not available for your account type/)
failsWith(operations, { type: 'request.reject', requestId: rejectId, note: '   ' }, /reason/)
failsWith(operations, { type: 'request.reject', requestId: 'XPR-00002', note: 'Too late.' }, /intake review/)
failsWith(operations, { type: 'request.reject', requestId: 'XPR-00007', note: 'Too late.' }, /intake review/)
before = state.notifications.length
run(operations, { type: 'request.reject', requestId: rejectId, note: 'We cannot serve this location yet.' })
assert.equal(find(rejectId).status, 'rejected')
assert(isFinished(find(rejectId).status))
assert.equal(find(rejectId).assignments.at(-1)!.status, 'withdrawn')
assert.equal(currentAssignment(find(rejectId)), undefined)
assert.equal(visibleRequests(state, nneka).some(item => item.id === rejectId), false)

const rejectionNote = newNotes(before).find(item => item.recipientId === customer.id)!

assert.equal(rejectionNote.title, 'Request not accepted')
assert.equal(rejectionNote.message, 'We cannot serve this location yet.')
assert.equal(rejectionNote.requestId, rejectId)

const providerNotes = newNotes(before).filter(item => item.recipientId === 'provider-nneka')

assert.equal(providerNotes.length, 1, 'An alerted and offered provider is told once')
assert.equal(providerNotes[0].requestId, undefined, 'No link to a request the provider cannot open')
assert(find(rejectId).messages.some(item => item.channel === 'customer' && item.text === 'Not accepted: We cannot serve this location yet.'))
assert.equal(state.audit[0].action, 'Request rejected')
assert.equal(state.audit[0].note, 'We cannot serve this location yet.')
assert(!pendingApprovals(state).some(item => item.requestId === rejectId))
failsWith(operations, { type: 'request.reject', requestId: rejectId, note: 'Again.' }, /intake review/)
failsWith(customer, { type: 'request.cancel', requestId: rejectId, note: 'Cancel it.' }, /no longer open/)
failsWith(operations, { type: 'assignment.offer', requestId: rejectId, providerId: 'provider-nneka', note: 'Offer again.' }, /no longer open/)
failsWith(operations, { type: 'request.review', requestId: rejectId, clarify: false, note: '' }, /moved beyond intake/)
failsWith(operations, { type: 'request.claim', requestId: rejectId }, /cannot be claimed|already has an owner/)
failsWith(customer, { type: 'message.send', requestId: rejectId, channel: 'customer', text: 'Please reconsider.', attachments: [] }, /request is closed/)
failsWith(operations, { type: 'request.flag', requestId: rejectId, note: 'Flag' }, /request is closed/)
assert.equal(statusLabelFor('rejected', 'customer'), 'Not accepted')

// A pending customer cancellation is settled by the rejection.
run(customer, { type: 'request.create', input: newRequest({ title: 'Second construction request' }) })

const secondId = state.requests[0].id

run(customer, { type: 'request.cancel', requestId: secondId, note: 'Changed my mind.' })
assert(pendingApprovals(state).some(item => item.kind === 'cancellation' && item.requestId === secondId))
run(relations, { type: 'request.reject', requestId: secondId, note: 'Brief is out of scope.' })
assert.equal(find(secondId).cancellationRequest!.review.state, 'approved')
assert(!pendingApprovals(state).some(item => item.requestId === secondId))

// B4: contact method and per-role status labels.
run(customer, { type: 'request.create', input: newRequest({ title: 'Default contact request' }) })
assert.equal(state.requests[0].contactMethod, 'phone', 'Contact method defaults to phone')
run(customer, { type: 'request.create', input: newRequest({ title: 'Both contact request', contactMethod: 'both' }) })
assert.equal(state.requests[0].contactMethod, 'both')
run(customer, { type: 'request.create', input: newRequest({ title: 'Email contact request', contactMethod: 'email' }) })
assert.equal(state.requests[0].contactMethod, 'email')
failsWith(customer, { type: 'request.create', input: newRequest({ contactMethod: 'fax' as 'both' }) }, /contact/)

const everyStatus: RequestStatus[] = requestStatuses

assert.equal(everyStatus.length, 12)
assert(everyStatus.includes('rejected'))
for (const role of ['customer', 'provider', 'admin'] as const) {
  for (const status of everyStatus)
    assert(statusLabelFor(status, role), `${role} has a label for ${status}`)
}
assert.equal(statusLabelFor('submitted', 'customer'), 'Request sent')
assert.equal(statusLabelFor('under_review', 'customer'), 'XPro is reviewing')
assert.equal(statusLabelFor('matched', 'provider'), 'Job accepted — submit pricing')
assert.equal(statusLabelFor('quoted', 'provider'), 'Awaiting customer decision')
assert.equal(statusLabelFor('completion_pending', 'provider'), 'Awaiting customer confirmation')
assert.equal(statusLabelFor('submitted', 'admin'), 'New — needs review')
assert.equal(statusLabelFor('acknowledged', 'admin'), 'Ready to close')
assert.equal(statusLabelFor('rejected', 'admin'), 'Rejected')
assert.equal(statusLabelFor('rejected', 'provider'), 'Not accepted')
assert.equal(statusLabelFor('cancelled', 'provider'), 'Cancelled / withdrawn')
assert.equal(statusLabelFor('closed', 'customer'), statusLabels.closed, 'statusLabels stays the customer map')
assert(everyStatus.every(status => statusLabels[status] === statusLabelFor(status, 'customer')))

console.log('PASS: all six intake forms; verification; dispatch; costing in whole kobo and immutable quote revisions; rescheduling and dual confirmation; channel privacy; execution, issue resolution and closure; role guards and atomic failures; reducer enum checks; staff roles and permissions; request ownership, claiming and reassignment; quote sign-off threshold; staff invitations and suspension; admin approval gates for provider alerts, assignments, progress, completion and cancellation; provider onboarding with face photo and bank details; Finance bank verification, bank changes and payout readiness; notes and actor ids in the activity history; request receipts and provider notifications; provider-safe quote scope and detail privacy; pending bank change blocks profile resubmission; rule gaps on closed requests, issues and superseded quotes; approved provider edits with held sensitive changes; request rejection; contact method and per-role status labels.')
