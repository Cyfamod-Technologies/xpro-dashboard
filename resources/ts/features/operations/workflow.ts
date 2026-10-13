/* eslint indent: ["error", 2, { "SwitchCase": 1 }] */
import type { Actor, Command, OperationsState, Preferences, QuoteItem, ServiceRequest } from '@/features/operations/types'
import { intakeFields } from '@/features/operations/types'

const id = () => crypto.randomUUID()
const now = () => new Date().toISOString()

const need = (condition: unknown, message: string): void => {
  if (!condition)
    throw new Error(message)
}

export const currentAssignment = (request: ServiceRequest) => {
  const assignment = request.assignments.at(-1)

  return assignment && ['offered', 'accepted'].includes(assignment.status) ? assignment : undefined
}
export const publicQuote = (request: ServiceRequest) => request.quotes.filter(quote => quote.status !== 'draft' && quote.status !== 'superseded').at(-1)
export const currentSchedule = (request: ServiceRequest) => request.schedules.at(-1)
export const canViewRequest = (request: ServiceRequest, actor: Actor) => actor.role === 'admin' || (actor.role === 'customer' && request.ownerId === actor.id) || (actor.role === 'provider' && currentAssignment(request)?.providerId === actor.id)
export const visibleRequests = (state: OperationsState, actor: Actor) => state.requests.filter(request => canViewRequest(request, actor))
export const visibleMessages = (request: ServiceRequest, actor: Actor, channel?: string) => request.messages.filter(message => {
  if (!canViewRequest(request, actor))
    return false
  if (channel && message.channel !== channel)
    return false

  return actor.role === 'admin' || (actor.role === 'customer' && message.channel === 'customer') || (actor.role === 'provider' && message.channel === 'provider' && message.providerId === actor.id)
})
export const defaultPreferences = (actor: Actor): Preferences => ({ name: actor.name, phone: '', email: true, push: true, inApp: true, timezone: 'Africa/Lagos' })
export const quoteTotal = (items: QuoteItem[]) => {
  need(items.length > 0 && items.every(item => item.description.trim().length > 0 && Number.isFinite(item.quantity) && item.quantity > 0 && Number.isFinite(item.rate) && item.rate > 0), 'Add a description, positive quantity and unit price for every line item.')

  const total = items.reduce((sum, item) => sum + Math.round(item.quantity * item.rate * 100), 0)

  need(Number.isSafeInteger(total), 'The quote total is too large.')

  return total
}

export function applyCommand(previous: OperationsState, actor: Actor, command: Command): OperationsState {
  const state = structuredClone(previous)
  const requireRole = (...roles: Actor['role'][]) => need(roles.includes(actor.role), 'This action is not available for your account type.')

  const requestFor = (requestId: string): ServiceRequest => {
    const request = state.requests.find(item => item.id === requestId)

    need(request && canViewRequest(request, actor), 'This request is no longer available to your account.')

    return request!
  }

  const audit = (action: string, resource: string, requestId?: string) => state.audit.unshift({ id: id(), actor: actor.name, action, resource, requestId, createdAt: now() })

  const notify = (recipientId: string, title: string, message: string, requestId?: string) => {
    const prefs = state.preferences[recipientId]
    const channels = [prefs?.inApp !== false ? 'In-app' : '', prefs?.email !== false ? 'Email' : '', prefs?.push !== false ? 'Push' : ''].filter(Boolean)

    state.notifications.unshift({ id: id(), recipientId, title, message, requestId, read: false, channels, createdAt: now() })
  }

  const event = (request: ServiceRequest, action: string, recipients: string[] = [request.ownerId, 'usr-admin']) => {
    audit(action, request.title, request.id)
    for (const recipient of new Set(recipients.filter(target => target && target !== actor.id)))
      notify(recipient, action, `${request.id} · ${request.title}`, request.id)
  }

  const editable = (request: ServiceRequest) => need(!['closed', 'cancelled', 'acknowledged'].includes(request.status), 'This job is no longer open for changes.')

  const providerAssignment = (request: ServiceRequest) => {
    requireRole('provider')

    const assignment = currentAssignment(request)

    need(assignment?.providerId === actor.id && assignment.status === 'accepted', 'Accept the current assignment before updating this job.')

    return assignment!
  }

  switch (command.type) {
    case 'request.create': {
      requireRole('customer')

      const input = command.input

      need(input.title.trim().length >= 3 && input.description.trim().length >= 20, 'Add a title and a project brief of at least 20 characters.')
      need(input.city.trim() && input.address.trim() && input.phone.trim(), 'Complete your contact and site details.')
      need(Number.isSafeInteger(Math.round(input.budget * 100)) && input.budget >= 0, 'Budget must be zero or a positive amount.')
      need(Object.hasOwn(intakeFields, input.service), 'Choose a valid service.')
      for (const field of intakeFields[input.service]) {
        const value = input.details[field.key]?.trim() ?? ''

        need(!field.required || value, `Complete ${field.label.toLowerCase()}.`)
        need(!value || !field.options || field.options.includes(value), `Choose a valid ${field.label.toLowerCase()}.`)
        need(!value || field.type !== 'number' || (Number.isFinite(Number(value)) && Number(value) > 0), `${field.label} must be positive.`)
        need(!value || field.type !== 'date' || !Number.isNaN(Date.parse(value)), `${field.label} must be a valid date.`)
      }
      if (input.startDate && input.details.endDate)
        need(input.details.endDate >= input.startDate, 'Hire end date cannot be before the start date.')
      const details = Object.fromEntries(intakeFields[input.service].map(field => [field.key, input.details[field.key] ?? '']))
      if (input.details.preferredProviderId) {
        const preferred = state.providers.find(item => item.id === input.details.preferredProviderId)

        need(preferred?.verification === 'approved' && preferred.services.includes(input.service), 'Choose a public provider who offers this service, or remove the provider preference.')
        details.preferredProviderId = input.details.preferredProviderId
      }

      const request: ServiceRequest = { ...input, details, budget: Math.round(input.budget * 100), id: `XPR-${String(state.nextRequest++).padStart(5, '0')}`, ownerId: actor.id, customer: actor.name, status: 'submitted', createdAt: now(), flag: '', assignments: [], contributions: [], quotes: [], schedules: [], updates: [], messages: [], issues: [] }

      state.requests.unshift(request)
      event(request, 'Request submitted', ['usr-admin'])

      return state
    }
    case 'provider.submit': {
      requireRole('provider')

      const input = command.input

      need(input.phone.trim() && input.trade.trim() && input.city.trim() && input.services.length && input.bio.trim(), 'Complete your contact, trade, location, services and introduction.')
      need(input.services.every(service => Object.hasOwn(intakeFields, service)), 'Choose valid service lines.')
      need(Number.isFinite(input.experience) && input.experience >= 0, 'Experience must be zero or positive.')
      need(input.documents.length, 'Attach at least one verification document.')
      let profile = state.providers.find(item => item.id === actor.id)
      if (!profile) {
        profile = { id: actor.id, name: actor.name, email: actor.email, ...input, rating: 0, reviewCount: 0, available: false, verification: 'draft', reviewNote: '', history: [] }
        state.providers.push(profile)
      }
      Object.assign(profile, input, { name: actor.name, verification: 'pending', reviewNote: '' })
      profile.history.unshift({ status: 'pending', note: 'Profile submitted for review.', createdAt: now() })
      audit('Provider profile submitted', profile.name)
      notify('usr-admin', 'Provider verification submitted', profile.name)

      return state
    }
    case 'provider.review': {
      requireRole('admin')

      const profile = state.providers.find(item => item.id === command.providerId)

      need(profile && profile.verification === 'pending', 'Only a pending submission can be reviewed.')
      need(command.decision === 'approved' || command.note.trim(), 'Explain the requested changes or rejection.')
      profile!.verification = command.decision
      profile!.reviewNote = command.note.trim()
      profile!.history.unshift({ status: command.decision, note: command.note || 'Documents approved.', createdAt: now() })
      audit(`Provider ${command.decision.replaceAll('_', ' ')}`, profile!.name)
      notify(profile!.id, 'Verification review updated', command.note || 'Your profile has been approved for dispatch.')

      return state
    }
    case 'provider.availability': {
      requireRole('provider')

      const profile = state.providers.find(item => item.id === actor.id)

      need(profile, 'Submit your provider profile before changing availability.')
      profile!.available = command.available
      audit('Provider availability updated', actor.name)

      return state
    }
    case 'preferences.save': {
      need(command.input.name.trim().length >= 2, 'Enter your full name.')
      need(command.input.timezone === 'Africa/Lagos', 'Use the supported WAT timezone.')
      state.preferences[actor.id] = command.input
      audit('Account preferences updated', actor.name)

      return state
    }
    case 'notification.read': {
      for (const notification of state.notifications.filter(item => item.recipientId === actor.id && (!command.notificationId || item.id === command.notificationId)))
        notification.read = true

      return state
    }
  }

  const request = requestFor(command.requestId)
  const assignment = currentAssignment(request)
  switch (command.type) {
    case 'request.review':
      requireRole('admin')
      need(['submitted', 'under_review'].includes(request.status), 'This request has moved beyond intake review.')
      need(!command.clarify || command.note.trim(), 'Add the clarification you need from the customer.')
      request.status = 'under_review'
      if (command.note.trim())
        request.messages.push({ id: id(), authorId: actor.id, author: actor.name, channel: command.clarify ? 'customer' : 'internal', text: command.note.trim(), attachments: [], createdAt: now() })
      event(request, command.clarify ? 'Clarification requested' : 'Request review started')
      break
    case 'request.cancel':
      requireRole('admin', 'customer')
      editable(request)
      need(actor.role === 'admin' || !['in_progress', 'blocked', 'completion_pending'].includes(request.status), 'Contact XPro to cancel work that has already started.')
      need(command.note.trim(), 'Add a reason for cancellation.')
      request.status = 'cancelled'
      if (assignment)
        assignment.status = 'withdrawn'
      for (const schedule of request.schedules)
        schedule.status = 'cancelled'
      request.messages.push({ id: id(), authorId: actor.id, author: actor.name, channel: 'customer', text: `Cancelled: ${command.note}`, attachments: [], createdAt: now() })
      event(request, 'Request cancelled', [request.ownerId, assignment?.providerId ?? '', 'usr-admin'])
      break
    case 'request.flag':
      requireRole('admin')
      request.flag = command.note.trim()
      audit(command.note ? 'Escalation flagged' : 'Escalation cleared', request.title, request.id)
      break
    case 'assignment.offer': {
      requireRole('admin')
      editable(request)
      need(!['in_progress', 'completion_pending', 'blocked', 'scheduled'].includes(request.status), 'Resolve the current job or schedule before changing its provider.')
      need(!assignment, 'Withdraw the current offer or assignment before reassigning.')

      const profile = state.providers.find(item => item.id === command.providerId)

      need(profile?.verification === 'approved' && profile.available && profile.services.includes(request.service), 'Choose an approved, available provider for this service.')
      request.assignments.push({ id: id(), providerId: profile!.id, status: 'offered', note: command.note, response: '', createdAt: now() })
      event(request, 'Assignment offered', [profile!.id])
      break
    }
    case 'assignment.respond':
      requireRole('provider')
      need(assignment?.id === command.assignmentId && assignment.providerId === actor.id && assignment.status === 'offered', 'This offer is no longer awaiting your response.')
      if (command.accept) {
        const profile = state.providers.find(item => item.id === actor.id)

        need(profile?.verification === 'approved' && profile.available, 'Your profile must be approved and available to accept work.')
      }
      need(command.accept || command.note.trim(), 'Add a reason for declining.')
      assignment!.status = command.accept ? 'accepted' : 'declined'
      assignment!.response = command.note
      request.status = command.accept ? 'matched' : 'under_review'
      event(request, command.accept ? 'Provider accepted assignment' : 'Provider declined assignment')
      break
    case 'assignment.withdraw':
      requireRole('admin')
      editable(request)
      need(assignment?.id === command.assignmentId, 'The assignment has already changed.')
      need(!['in_progress', 'completion_pending'].includes(request.status), 'Block or resolve ongoing work before reassigning.')
      need(command.note.trim(), 'Explain the withdrawal or reassignment.')
      assignment!.status = 'withdrawn'
      assignment!.response = command.note
      for (const quote of request.quotes.filter(item => ['sent', 'accepted'].includes(item.status)))
        quote.status = 'superseded'
      request.status = 'under_review'
      for (const schedule of request.schedules)
        schedule.status = 'cancelled'
      event(request, 'Assignment withdrawn', [request.ownerId, assignment!.providerId, 'usr-admin'])
      break
    case 'quote.contribute':
      editable(request)
      providerAssignment(request)
      request.contributions.push({ id: id(), providerId: actor.id, items: command.items, total: quoteTotal(command.items), note: command.note, createdAt: now() })
      event(request, 'Provider pricing submitted', ['usr-admin'])
      break
    case 'quote.save': {
      requireRole('admin')
      editable(request)
      need(!['in_progress', 'blocked', 'completion_pending'].includes(request.status), 'Pricing revisions for active work require a separate scope review.')

      const total = quoteTotal(command.items)
      if (command.quoteId) {
        const quote = request.quotes.find(item => item.id === command.quoteId)

        need(quote?.status === 'draft', 'Published quote versions cannot be edited. Create a new version.')
        Object.assign(quote!, { items: command.items, total, note: command.note })
      }
      else {
        request.quotes.push({ id: id(), version: Math.max(0, ...request.quotes.map(item => item.version)) + 1, status: 'draft', items: command.items, total, note: command.note, responseNote: '', createdAt: now() })
      }
      audit('Quote draft saved', request.title, request.id)
      break
    }
    case 'quote.publish': {
      requireRole('admin')
      editable(request)
      need(!['in_progress', 'blocked', 'completion_pending'].includes(request.status), 'Quotes cannot be published while work is in execution.')

      const quote = request.quotes.find(item => item.id === command.quoteId)

      need(quote?.status === 'draft' && request.quotes.at(-1)?.id === quote.id, 'Publish the latest draft version. Older drafts cannot replace newer quotes.')
      need(assignment?.status === 'accepted', 'Confirm a provider assignment before publishing the quote.')
      for (const previousQuote of request.quotes.filter(item => item.status === 'sent'))
        previousQuote.status = 'superseded'
      quote!.status = 'sent'
      request.status = 'quoted'
      for (const schedule of request.schedules)
        schedule.status = 'cancelled'
      event(request, 'Quote ready to review', [request.ownerId])
      break
    }
    case 'quote.respond': {
      requireRole('customer')
      editable(request)

      const quote = publicQuote(request)

      need(quote?.id === command.quoteId && quote.status === 'sent', 'This quote has already changed or received a response.')
      need(command.decision === 'accepted' || command.note.trim(), 'Explain the decline or revision request.')
      quote!.status = command.decision
      quote!.responseNote = command.note
      request.status = command.decision === 'accepted' ? 'matched' : 'under_review'
      event(request, `Quote ${command.decision.replaceAll('_', ' ')}`, ['usr-admin'])
      break
    }
    case 'schedule.propose': {
      requireRole('admin')
      editable(request)
      need(!['in_progress', 'completion_pending', 'blocked'].includes(request.status), 'This job has already entered execution.')

      const quote = publicQuote(request)

      need(quote?.status === 'accepted' && assignment?.status === 'accepted', 'An accepted quote and provider assignment are required for scheduling.')
      need(Date.parse(command.startAt) > Date.now(), 'Choose a future date and time.')

      const overlaps = state.requests.some(other => other.id !== request.id && currentAssignment(other)?.providerId === assignment!.providerId && currentSchedule(other)?.status === 'confirmed' && Math.abs(Date.parse(currentSchedule(other)!.startAt) - Date.parse(command.startAt)) < 3600000)

      need(!overlaps, 'This provider already has a confirmed appointment within one hour. Choose another time.')
      for (const schedule of request.schedules)
        schedule.status = 'cancelled'
      request.schedules.push({ id: id(), startAt: command.startAt, note: command.note, quoteId: quote!.id, status: 'proposed', customer: 'pending', provider: 'pending', responses: [] })
      request.status = 'matched'
      event(request, 'Schedule proposed', [request.ownerId, assignment!.providerId])
      break
    }
    case 'schedule.respond': {
      requireRole('customer', 'provider')
      editable(request)

      const schedule = currentSchedule(request)

      need(schedule?.id === command.scheduleId && schedule.status === 'proposed' && publicQuote(request)?.id === schedule.quoteId && publicQuote(request)?.status === 'accepted', 'This schedule is no longer awaiting confirmation.')

      const responseRole = actor.role === 'provider' ? 'provider' : 'customer'

      need(schedule![responseRole] === 'pending', 'Your response has already been recorded.')
      need(command.accept || command.note.trim(), 'Explain your requested schedule change.')
      schedule![responseRole] = command.accept ? 'accepted' : 'changes_requested'
      schedule!.responses.push(`${actor.name}: ${command.accept ? 'Confirmed' : command.note}`)
      if (!command.accept) {
        schedule!.status = 'changes_requested'
      }
      else if (schedule!.customer === 'accepted' && schedule!.provider === 'accepted') {
        schedule!.status = 'confirmed'
        request.status = 'scheduled'
      }
      event(request, command.accept ? 'Schedule response recorded' : 'Schedule change requested', [request.ownerId, assignment?.providerId ?? '', 'usr-admin'])
      break
    }
    case 'progress.add':
      editable(request)
      providerAssignment(request)
      need(currentSchedule(request)?.status === 'confirmed', 'Confirm the schedule before starting work.')
      need(command.note.trim(), 'Add a progress note.')
      need(['scheduled', 'in_progress', 'blocked'].includes(request.status), 'This job is not open for execution updates.')
      need(command.status !== 'blocked' || request.status === 'in_progress', 'Start the job before reporting a blocker.')
      need(command.status !== 'completion_pending' || request.status === 'in_progress', 'Resume or start work before reporting completion.')
      need(command.status !== 'completion_pending' || command.attachments.length || request.updates.some(update => update.attachments.length), 'Attach work evidence before reporting completion.')
      request.status = command.status
      request.updates.unshift({ id: id(), authorId: actor.id, author: actor.name, status: command.status, note: command.note, attachments: command.attachments, createdAt: now() })
      event(request, command.status === 'completion_pending' ? 'Completion ready for review' : 'Job progress updated')
      break
    case 'completion.respond':
      requireRole('customer')
      need(request.status === 'completion_pending' && !request.issues.some(item => item.status === 'open'), 'Resolve open issues before completion review.')
      need(command.acknowledge || command.note.trim(), 'Explain the unresolved issue.')
      request.status = command.acknowledge ? 'acknowledged' : 'blocked'
      if (!command.acknowledge)
        request.issues.unshift({ id: id(), note: command.note, status: 'open', resolution: '', createdAt: now() })
      event(request, command.acknowledge ? 'Customer acknowledged completion' : 'Completion issue reported', ['usr-admin', assignment?.providerId ?? ''])
      break
    case 'issue.resolve': {
      requireRole('admin')

      const issue = request.issues.find(item => item.id === command.issueId)

      need(issue?.status === 'open' && command.note.trim(), 'Add a resolution for the open issue.')
      issue!.status = 'resolved'
      issue!.resolution = command.note
      if (!request.issues.some(item => item.status === 'open'))
        request.status = 'completion_pending'
      event(request, 'Completion issue resolved')
      break
    }
    case 'request.close':
      requireRole('admin')
      need(request.status === 'acknowledged' && !request.issues.some(item => item.status === 'open'), 'Customer acknowledgement is required before final closure.')
      request.status = 'closed'
      request.flag = ''
      event(request, 'Job closed', [request.ownerId, assignment?.providerId ?? ''])
      break
    case 'message.send':
      need(command.text.trim() || command.attachments.length, 'Write a message or attach a file.')
      need(actor.role === 'admin' || command.channel === actor.role, 'Choose a conversation available to your account.')
      need(command.channel !== 'provider' || assignment, 'Assign a provider before starting a provider conversation.')
      request.messages.push({ id: id(), authorId: actor.id, author: actor.name, channel: command.channel, providerId: command.channel === 'provider' ? assignment?.providerId : undefined, text: command.text.trim(), attachments: command.attachments, createdAt: now() })
      event(request, 'New conversation update', command.channel === 'customer' ? [request.ownerId, 'usr-admin'] : command.channel === 'provider' ? [assignment!.providerId, 'usr-admin'] : ['usr-admin'])
      break
  }

  return state
}
