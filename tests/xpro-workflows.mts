import assert from 'node:assert/strict'
import { createOperationsState } from '@/features/operations/fixtures.ts'
import { applyCommand, currentAssignment, publicQuote, currentSchedule, visibleRequests, visibleMessages, visibleUpdates, pendingApprovals } from '@/features/operations/workflow.ts'
import { intakeFields } from '@/features/operations/types.ts'
import { messageAuthorLabel } from '@/features/operations/staff.ts'
import type { Actor, Command, ServiceLine, RequestInput } from '@/features/operations/types.ts'

const customer: Actor = { id: 'usr-customer', name: 'Ada', email: 'customer@xpro.test', role: 'customer' }
const provider: Actor = { id: 'usr-provider', name: 'Tunde', email: 'provider@xpro.test', role: 'provider' }
const admin: Actor = { id: 'usr-admin', name: 'Amara', email: 'admin@xpro.test', role: 'admin' }
const stranger: Actor = { ...customer, id: 'another-customer' }
const nneka: Actor = { id: 'provider-nneka', name: 'Nneka', email: 'nneka@example.test', role: 'provider' }
const staffActor = (id: string, name: string, email: string): Actor => ({ id, name, email, role: 'admin' })
const operations = staffActor('usr-operations', 'Kemi', 'operations@xpro.test')
const pricing = staffActor('usr-pricing', 'Chidi', 'pricing@xpro.test')
const relations = staffActor('usr-relations', 'Zainab', 'relations@xpro.test')
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
const line = [{ description: 'Construction service', quantity: 2, rate: 120000 }]
fails(stranger, { type: 'request.cancel', requestId, note: 'Invalid access' })
fails(customer, { type: 'provider.review', providerId: provider.id, decision: 'approved', note: '' })
fails(admin, { type: 'assignment.offer', requestId, providerId: provider.id, note: 'Not approved' })
run(provider, { type: 'provider.submit', input: { phone: '0800 000 0001', trade: 'Construction', city: 'Abuja', services: ['Construction'], experience: 8, bio: 'Demo introduction', documents: [{ id: 'identity', name: 'Identity.pdf', size: 1000, type: 'application/pdf' }], portfolio: [] } })
run(admin, { type: 'provider.review', providerId: provider.id, decision: 'approved', note: 'Reviewed documents' })
run(admin, { type: 'request.review', requestId, clarify: true, note: 'Please confirm site access.' })
run(customer, { type: 'message.send', requestId, channel: 'customer', text: 'Site access confirmed.', attachments: [] })
run(admin, { type: 'assignment.offer', requestId, providerId: provider.id, note: 'Suitable for service and location' })
assert.equal(visibleRequests(state, provider).length, 1)
// Provider acceptance is held for XPro; the customer hears nothing until it is confirmed.
let before = state.notifications.length
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
run(admin, { type: 'quote.publish', requestId, quoteId })
assert.equal(publicQuote(request())!.total, 24000000)
fails(admin, { type: 'quote.save', requestId, quoteId, items: line, note: 'Cannot mutate a published version' })
run(customer, { type: 'quote.respond', requestId, quoteId, decision: 'revision_requested', note: 'Reduce quantity to one.' })
run(admin, { type: 'quote.save', requestId, items: [{ ...line[0], quantity: 1 }], note: 'Revised scope' })
quoteId = request().quotes.at(-1)!.id
run(admin, { type: 'quote.publish', requestId, quoteId })
assert.equal(request().quotes[0].items[0].quantity, 2, 'Published line items are retained')
run(customer, { type: 'quote.respond', requestId, quoteId, decision: 'accepted', note: '' })
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
run(admin, { type: 'issue.resolve', requestId, issueId: request().issues[0].id, note: 'Finish corrected and inspected.' })
run(customer, { type: 'completion.respond', requestId, acknowledge: true, note: '' })
run(admin, { type: 'request.close', requestId })
assert.equal(request().status, 'closed')
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
fails(admin, { type: 'cancellation.review', requestId: otherId, approve: true, note: '' })
run(customer, { type: 'request.cancel', requestId: otherId, note: 'No longer needed.' })
run(admin, { type: 'cancellation.review', requestId: otherId, approve: true, note: '' })
assert.equal(otherRequest().status, 'cancelled')
assert.equal(otherRequest().cancellationRequest!.review.state, 'approved')
assert(state.audit.length > 20)
assert(state.notifications.every(item => Boolean(item.recipientId)))
// Staff roles, request ownership, quote sign-off and staff accounts.
const find = (id: string) => state.requests.find(item => item.id === id)!
const staffRecord = (id: string) => state.staff.find(item => item.id === id)!
const recipientsSince = (before: number) => [...new Set(state.notifications.slice(0, state.notifications.length - before).map(item => item.recipientId))].sort()
const denied = /staff role does not allow/
const draftLine = (rate: number) => [{ description: 'Staff test service', quantity: 1, rate }]

// Role limits are enforced by the reducer and stay atomic.
state = createOperationsState()
assert.equal(state.schema, 3)
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
assert.deepEqual(recipientsSince(before), ['provider-nneka', 'usr-admin', 'usr-operations', 'usr-relations'])
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
run(provider, { type: 'provider.submit', input: { phone: '0800 000 0001', trade: 'Construction', city: 'Abuja', services: ['Construction'], experience: 8, bio: 'Demo introduction', documents: [{ id: 'identity-2', name: 'Identity.pdf', size: 1000, type: 'application/pdf' }], portfolio: [] } })
assert.deepEqual(recipientsSince(before), ['usr-admin', 'usr-operations'], 'Only provider reviewers hear about provider submissions')

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
assert.deepEqual(pendingApprovals(state).map(item => item.kind).sort(), ['assignment', 'cancellation', 'progress', 'provider'])
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
assert.deepEqual(pendingApprovals(state).map(item => item.kind), ['provider'], 'Reviewed items leave the queue')
// An admin cancelling directly clears a pending customer request.
state = createOperationsState()
run(relations, { type: 'request.cancel', requestId: 'XPR-00003', note: 'Cancelled by XPro.' })
assert.equal(find('XPR-00003').status, 'cancelled')
assert.equal(find('XPR-00003').cancellationRequest!.review.state, 'approved')

console.log('PASS: all six intake forms; verification; dispatch; costing and immutable quote revisions; rescheduling and dual confirmation; channel privacy; execution, issue resolution and closure; role guards and atomic failures; staff roles and permissions; request ownership, claiming and reassignment; quote sign-off threshold; staff invitations and suspension; admin approval gates for provider alerts, assignments, progress, completion and cancellation.')
