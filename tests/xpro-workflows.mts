import assert from 'node:assert/strict'
import { createOperationsState } from '@/features/operations/fixtures.ts'
import { applyCommand, currentAssignment, publicQuote, currentSchedule, visibleRequests, visibleMessages } from '@/features/operations/workflow.ts'
import { intakeFields } from '@/features/operations/types.ts'
import type { Actor, Command, ServiceLine, RequestInput } from '@/features/operations/types.ts'

const customer: Actor = { id: 'usr-customer', name: 'Ada', email: 'customer@xpro.test', role: 'customer' }
const provider: Actor = { id: 'usr-provider', name: 'Tunde', email: 'provider@xpro.test', role: 'provider' }
const admin: Actor = { id: 'usr-admin', name: 'Amara', email: 'admin@xpro.test', role: 'admin' }
const stranger: Actor = { ...customer, id: 'another-customer' }
let state = createOperationsState()
state.requests = []
const run = (actor: Actor, command: Command) => { state = applyCommand(state, actor, command) }
const fails = (actor: Actor, command: Command) => {
  const snapshot = JSON.stringify(state)
  assert.throws(() => applyCommand(state, actor, command))
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
run(provider, { type: 'assignment.respond', requestId, assignmentId: currentAssignment(request())!.id, accept: true, note: 'Accepted' })
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
run(provider, { type: 'progress.add', requestId, status: 'in_progress', note: 'Work started', attachments: [] })
run(provider, { type: 'progress.add', requestId, status: 'blocked', note: 'Access delayed', attachments: [] })
run(provider, { type: 'progress.add', requestId, status: 'in_progress', note: 'Access resolved', attachments: [] })
fails(provider, { type: 'progress.add', requestId, status: 'completion_pending', note: 'No evidence', attachments: [] })
run(provider, { type: 'progress.add', requestId, status: 'completion_pending', note: 'Completed work', attachments: [{ id: 'proof', name: 'Report.pdf', size: 1200, type: 'application/pdf' }] })
fails(admin, { type: 'request.close', requestId })
run(customer, { type: 'completion.respond', requestId, acknowledge: false, note: 'One finish needs correcting.' })
run(admin, { type: 'issue.resolve', requestId, issueId: request().issues[0].id, note: 'Finish corrected and inspected.' })
run(customer, { type: 'completion.respond', requestId, acknowledge: true, note: '' })
run(admin, { type: 'request.close', requestId })
assert.equal(request().status, 'closed')
const otherId = state.requests.find(item => item.service === 'Design')!.id
run(customer, { type: 'request.cancel', requestId: otherId, note: 'No longer needed.' })
assert.equal(state.requests.find(item => item.id === otherId)!.status, 'cancelled')
assert(state.audit.length > 20)
assert(state.notifications.every(item => Boolean(item.recipientId)))
console.log('PASS: all six intake forms; verification; dispatch; costing and immutable quote revisions; rescheduling and dual confirmation; channel privacy; execution, issue resolution and closure; role guards and atomic failures.')
