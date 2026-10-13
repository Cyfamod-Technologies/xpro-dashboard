/* eslint indent: ["error", 2, { "SwitchCase": 1 }] */
import type { Actor, Command, OperationsState, Preferences, ProgressUpdate, QuoteItem, Review, ServiceRequest, StaffMember, StaffPermission, StaffRole } from '@/features/operations/types'
import { intakeFields } from '@/features/operations/types'
import { activeStaffInRole, activeStaffWith, staffCan, staffRoleLabels, staffRolePermissions } from '@/features/operations/staff'

const id = () => crypto.randomUUID()
const now = () => new Date().toISOString()

const need = (condition: unknown, message: string): void => {
  if (!condition)
    throw new Error(message)
}

export const currentAssignment = (request: ServiceRequest) => {
  const assignment = request.assignments.at(-1)

  return assignment && ['offered', 'pending_approval', 'accepted'].includes(assignment.status) ? assignment : undefined
}
export const pendingReview = (): Review => ({ state: 'pending', by: '', note: '', at: '' })
export const visibleUpdates = (request: ServiceRequest, actor: Actor): ProgressUpdate[] => request.updates.filter(update => actor.role === 'admin' || (actor.role === 'provider' && update.authorId === actor.id) || (actor.role === 'customer' && update.review.state === 'approved'))

export interface PendingApproval { kind: 'assignment' | 'progress' | 'completion' | 'cancellation' | 'quote' | 'provider'; requestId?: string; providerId?: string; itemId: string; title: string; createdAt: string }

export const pendingApprovals = (state: OperationsState): PendingApproval[] => {
  const items: PendingApproval[] = []

  for (const request of state.requests.filter(item => !['closed', 'cancelled'].includes(item.status))) {
    for (const assignment of request.assignments.filter(item => item.status === 'pending_approval'))
      items.push({ kind: 'assignment', requestId: request.id, providerId: assignment.providerId, itemId: assignment.id, title: request.title, createdAt: assignment.createdAt })
    for (const update of request.updates.filter(item => item.review.state === 'pending'))
      items.push({ kind: update.status === 'completion_pending' ? 'completion' : 'progress', requestId: request.id, providerId: update.authorId, itemId: update.id, title: request.title, createdAt: update.createdAt })
    if (request.cancellationRequest?.review.state === 'pending')
      items.push({ kind: 'cancellation', requestId: request.id, itemId: request.id, title: request.title, createdAt: request.cancellationRequest.requestedAt })
    for (const quote of request.quotes.filter(item => item.status === 'draft' && item.approvalRequestedBy))
      items.push({ kind: 'quote', requestId: request.id, itemId: quote.id, title: request.title, createdAt: quote.createdAt })
  }
  for (const profile of state.providers.filter(item => item.verification === 'pending'))
    items.push({ kind: 'provider', providerId: profile.id, itemId: profile.id, title: profile.name, createdAt: profile.history[0]?.createdAt ?? '' })

  return items.sort((a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0))
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
  const staffMember = actor.role === 'admin' ? state.staff.find(item => item.id === actor.id) : undefined

  const requireStaff = (permission: StaffPermission) => {
    requireRole('admin')
    need(staffMember?.status === 'active', 'Your staff account is not active.')
    need(staffCan(staffMember, permission), 'Your staff role does not allow this action.')
  }

  const staffFor = (request: ServiceRequest, extra?: StaffRole) => [
    ...(request.staffOwnerId ? [request.staffOwnerId] : activeStaffWith(state, 'request.claim').map(item => item.id)),
    ...(extra ? activeStaffInRole(state, extra).map(item => item.id) : []),
  ]

  const isOpen = (request: ServiceRequest) => !['closed', 'cancelled'].includes(request.status)
  const isLastSuperAdmin = (member: StaffMember) => member.status === 'active' && member.roles.includes('super_admin') && !state.staff.some(item => item.id !== member.id && item.status === 'active' && item.roles.includes('super_admin'))

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

  const event = (request: ServiceRequest, action: string, recipients: string[] = [request.ownerId, ...staffFor(request)]) => {
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

      const request: ServiceRequest = { ...input, details, budget: Math.round(input.budget * 100), id: `XPR-${String(state.nextRequest++).padStart(5, '0')}`, ownerId: actor.id, customer: actor.name, status: 'submitted', createdAt: now(), staffOwnerId: '', claimedAt: '', flag: '', assignments: [], contributions: [], quotes: [], schedules: [], updates: [], messages: [], issues: [], alertedProviderIds: [], cancellationRequest: null }

      state.requests.unshift(request)
      event(request, 'Request submitted', staffFor(request))

      const alerted = details.preferredProviderId ? state.providers.filter(item => item.id === details.preferredProviderId) : state.providers.filter(item => item.verification === 'approved' && item.available && item.services.includes(request.service) && item.city.toLowerCase() === request.city.toLowerCase())

      request.alertedProviderIds = alerted.map(item => item.id)
      for (const target of alerted)
        notify(target.id, `New ${request.service} request in ${request.city}`, 'Awaiting XPro approval. You\'ll receive an offer if you\'re selected.')
      if (alerted.length)
        audit('Providers alerted', `${alerted.length} provider${alerted.length === 1 ? '' : 's'}`, request.id)

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
      for (const member of activeStaffWith(state, 'provider.review'))
        notify(member.id, 'Provider verification submitted', profile.name)

      return state
    }
    case 'provider.review': {
      requireStaff('provider.review')

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
    case 'staff.invite': {
      requireStaff('staff.manage')

      const name = command.name.trim()
      const email = command.email.trim()
      const roles = [...new Set(command.roles)]

      need(name.length >= 2, 'Enter the staff member\'s full name.')
      need(/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email), 'Enter a valid email address.')
      need(!state.staff.some(item => item.email.toLowerCase() === email.toLowerCase()), 'A staff member with this email already exists.')
      need(roles.length > 0 && roles.every(role => Object.hasOwn(staffRolePermissions, role)), 'Choose at least one valid staff role.')
      state.staff.push({ id: `staff-${id()}`, name, email, roles, status: 'invited', invitedAt: now(), history: [{ action: 'Invited', by: actor.name, createdAt: now() }] })
      audit('Staff invited', `${name} · ${roles.map(role => staffRoleLabels[role]).join(', ')}`)

      return state
    }
    case 'staff.roles': {
      requireStaff('staff.manage')

      const member = state.staff.find(item => item.id === command.staffId)
      const roles = [...new Set(command.roles)]

      need(member, 'This staff member is no longer available.')
      need(roles.length > 0 && roles.every(role => Object.hasOwn(staffRolePermissions, role)), 'Choose at least one valid staff role.')
      need(!isLastSuperAdmin(member!) || roles.includes('super_admin'), 'At least one active super admin is required.')

      const label = roles.map(role => staffRoleLabels[role]).join(', ')

      member!.roles = roles
      member!.history.unshift({ action: `Roles changed to ${label}`, by: actor.name, createdAt: now() })
      audit('Staff roles updated', `${member!.name} · ${label}`)
      if (member!.status === 'active')
        notify(member!.id, 'Your staff roles changed', `You are now: ${label}.`)

      return state
    }
    case 'staff.status': {
      requireStaff('staff.manage')

      const member = state.staff.find(item => item.id === command.staffId)

      need(member, 'This staff member is no longer available.')
      need(command.staffId !== actor.id, 'You cannot change your own account status.')
      if (command.status === 'active') {
        need(member!.status !== 'active', 'This staff account is already active.')
      }
      else {
        need(member!.status !== 'suspended', 'This staff account is already suspended.')
        need(!isLastSuperAdmin(member!), 'At least one active super admin is required.')

        const owned = state.requests.filter(item => item.staffOwnerId === member!.id && isOpen(item))

        if (owned.length) {
          const target = state.staff.find(item => item.id === command.reassignTo)

          need(command.reassignTo, 'Choose who takes over this member\'s open requests.')
          need(target && target.id !== member!.id && staffCan(target, 'request.claim'), 'Choose an active staff member who can own requests.')
          for (const item of owned) {
            item.staffOwnerId = target!.id
            item.claimedAt = now()
            audit('Request owner reassigned', item.title, item.id)
          }
          notify(target!.id, 'Requests assigned to you', `${owned.length} open request${owned.length === 1 ? '' : 's'} moved from ${member!.name}.`)
        }
      }
      member!.status = command.status
      member!.history.unshift({ action: command.status === 'active' ? 'Activated' : 'Suspended', by: actor.name, createdAt: now() })
      audit(command.status === 'active' ? 'Staff activated' : 'Staff suspended', member!.name)

      return state
    }
    case 'settings.save': {
      requireStaff('settings.manage')

      const threshold = command.quoteApprovalThreshold === null ? null : Math.round(command.quoteApprovalThreshold * 100)

      need(threshold === null || (Number.isSafeInteger(threshold) && threshold > 0), 'Enter a positive approval threshold, or turn the approval rule off.')
      state.settings.quoteApprovalThreshold = threshold
      audit('Settings updated', 'Quote approval threshold')

      return state
    }
  }

  const request = requestFor(command.requestId)
  const assignment = currentAssignment(request)

  const performCancel = (reason: string) => {
    request.status = 'cancelled'
    if (assignment)
      assignment.status = 'withdrawn'
    for (const schedule of request.schedules)
      schedule.status = 'cancelled'
    request.messages.push({ id: id(), authorId: actor.id, author: actor.name, authorRole: actor.role, channel: 'customer', text: `Cancelled: ${reason}`, attachments: [], createdAt: now() })
    event(request, 'Request cancelled', [request.ownerId, assignment?.providerId ?? '', ...staffFor(request)])
  }

  switch (command.type) {
    case 'request.claim':
      requireStaff('request.claim')
      need(!request.staffOwnerId, 'This request already has an owner.')
      need(isOpen(request), 'Closed or cancelled requests cannot be claimed.')
      request.staffOwnerId = actor.id
      request.claimedAt = now()
      audit('Request claimed', request.title, request.id)
      break
    case 'request.reassign': {
      requireStaff('request.reassign')

      const target = state.staff.find(item => item.id === command.staffId)

      need(staffCan(target, 'request.claim'), 'Choose an active staff member who can own requests.')
      need(target!.id !== request.staffOwnerId, 'This staff member already owns the request.')
      need(command.note.trim(), 'Add a reason for reassigning this request.')

      const previousOwnerId = request.staffOwnerId

      request.staffOwnerId = target!.id
      request.claimedAt = now()
      audit('Request owner reassigned', `${request.title} · ${target!.name}`, request.id)
      if (target!.id !== actor.id)
        notify(target!.id, 'Request assigned to you', `${request.id} · ${request.title}`, request.id)
      if (previousOwnerId && previousOwnerId !== actor.id)
        notify(previousOwnerId, 'Request reassigned', `${request.id} · ${request.title}`, request.id)
      break
    }
    case 'request.review':
      requireStaff('request.review')
      need(['submitted', 'under_review'].includes(request.status), 'This request has moved beyond intake review.')
      need(!command.clarify || command.note.trim(), 'Add the clarification you need from the customer.')
      request.status = 'under_review'
      if (command.note.trim())
        request.messages.push({ id: id(), authorId: actor.id, author: actor.name, authorRole: actor.role, channel: command.clarify ? 'customer' : 'internal', text: command.note.trim(), attachments: [], createdAt: now() })
      event(request, command.clarify ? 'Clarification requested' : 'Request review started')
      break
    case 'request.cancel':
      requireRole('admin', 'customer')
      if (actor.role === 'admin')
        requireStaff('request.cancel')
      editable(request)
      need(actor.role === 'admin' || !['in_progress', 'blocked', 'completion_pending'].includes(request.status), 'Contact XPro to cancel work that has already started.')
      need(command.note.trim(), 'Add a reason for cancellation.')
      if (actor.role === 'admin') {
        performCancel(command.note)
        if (request.cancellationRequest?.review.state === 'pending')
          request.cancellationRequest.review = { state: 'approved', by: actor.id, note: '', at: now() }
      }
      else {
        need(request.cancellationRequest?.review.state !== 'pending', 'Your cancellation request is already awaiting XPro.')
        request.cancellationRequest = { note: command.note.trim(), requestedAt: now(), review: pendingReview() }
        event(request, 'Cancellation requested', staffFor(request))
      }
      break
    case 'cancellation.review': {
      requireStaff('request.cancel')
      editable(request)

      const cancellation = request.cancellationRequest

      need(cancellation?.review.state === 'pending', 'No cancellation request is awaiting review.')
      need(command.approve || command.note.trim(), 'Explain why the cancellation is not approved.')
      if (command.approve) {
        cancellation!.review = { state: 'approved', by: actor.id, note: command.note.trim(), at: now() }
        performCancel(cancellation!.note)
      }
      else {
        cancellation!.review = { state: 'rejected', by: actor.id, note: command.note.trim(), at: now() }
        audit('Cancellation not approved', request.title, request.id)
        notify(request.ownerId, 'Cancellation not approved', command.note.trim(), request.id)
      }
      break
    }
    case 'request.flag':
      requireStaff('request.flag')
      request.flag = command.note.trim()
      audit(command.note ? 'Escalation flagged' : 'Escalation cleared', request.title, request.id)
      break
    case 'assignment.offer': {
      requireStaff('dispatch.manage')
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
      assignment!.status = command.accept ? 'pending_approval' : 'declined'
      assignment!.response = command.note
      if (!command.accept)
        request.status = 'under_review'
      event(request, command.accept ? 'Provider accepted — approval needed' : 'Provider declined assignment', staffFor(request))
      break
    case 'assignment.review':
      requireStaff('dispatch.manage')
      editable(request)
      need(assignment?.id === command.assignmentId && assignment.status === 'pending_approval', 'This assignment is no longer awaiting approval.')
      need(command.approve || command.note.trim(), 'Explain why the assignment is not confirmed.')
      if (command.approve) {
        assignment!.status = 'accepted'
        request.status = 'matched'
        audit('Assignment approved', request.title, request.id)
        notify(request.ownerId, 'Provider matched', `${request.id} · ${request.title}`, request.id)
        notify(assignment!.providerId, 'Assignment confirmed by XPro', `${request.id} · ${request.title}`, request.id)
      }
      else {
        assignment!.status = 'withdrawn'
        assignment!.response = command.note.trim()
        request.status = 'under_review'
        audit('Assignment rejected', request.title, request.id)
        notify(assignment!.providerId, 'Assignment not confirmed', command.note.trim())
      }
      break
    case 'assignment.withdraw':
      requireStaff('dispatch.manage')
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
      event(request, 'Assignment withdrawn', [request.ownerId, assignment!.providerId, ...staffFor(request)])
      break
    case 'quote.contribute':
      editable(request)
      providerAssignment(request)
      request.contributions.push({ id: id(), providerId: actor.id, items: command.items, total: quoteTotal(command.items), note: command.note, createdAt: now() })
      event(request, 'Provider pricing submitted', staffFor(request, 'pricing'))
      break
    case 'quote.save': {
      requireStaff('quote.manage')
      editable(request)
      need(!['in_progress', 'blocked', 'completion_pending'].includes(request.status), 'Pricing revisions for active work require a separate scope review.')

      const total = quoteTotal(command.items)
      if (command.quoteId) {
        const quote = request.quotes.find(item => item.id === command.quoteId)

        need(quote?.status === 'draft', 'Published quote versions cannot be edited. Create a new version.')
        Object.assign(quote!, { items: command.items, total, note: command.note })
        if (quote!.approvalRequestedBy) {
          quote!.approvalRequestedBy = ''
          audit('Quote approval request cleared after edit', request.title, request.id)
        }
      }
      else {
        request.quotes.push({ id: id(), version: Math.max(0, ...request.quotes.map(item => item.version)) + 1, status: 'draft', items: command.items, total, note: command.note, responseNote: '', approvalRequestedBy: '', publishedBy: '', createdAt: now() })
      }
      audit('Quote draft saved', request.title, request.id)
      break
    }
    case 'quote.publish': {
      requireStaff('quote.manage')
      editable(request)
      need(!['in_progress', 'blocked', 'completion_pending'].includes(request.status), 'Quotes cannot be published while work is in execution.')

      const quote = request.quotes.find(item => item.id === command.quoteId)

      need(quote?.status === 'draft' && request.quotes.at(-1)?.id === quote.id, 'Publish the latest draft version. Older drafts cannot replace newer quotes.')
      need(assignment?.status === 'accepted', 'Confirm a provider assignment before publishing the quote.')

      const threshold = state.settings.quoteApprovalThreshold

      if (threshold !== null && quote!.total >= threshold && !staffCan(staffMember, 'quote.approve')) {
        quote!.approvalRequestedBy = actor.id
        audit('Quote approval requested', request.title, request.id)
        for (const approver of activeStaffWith(state, 'quote.approve'))
          notify(approver.id, 'Quote approval needed', `${request.id} · ${request.title}`, request.id)
        break
      }
      for (const previousQuote of request.quotes.filter(item => item.status === 'sent'))
        previousQuote.status = 'superseded'
      quote!.status = 'sent'
      quote!.publishedBy = actor.id
      quote!.approvalRequestedBy = ''
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
      event(request, `Quote ${command.decision.replaceAll('_', ' ')}`, staffFor(request, 'pricing'))
      break
    }
    case 'schedule.propose': {
      requireStaff('schedule.manage')
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
      schedule!.responses.push(`${actor.role === 'provider' ? 'Provider' : 'Customer'}: ${command.accept ? 'Confirmed' : command.note}`)
      if (!command.accept) {
        schedule!.status = 'changes_requested'
      }
      else if (schedule!.customer === 'accepted' && schedule!.provider === 'accepted') {
        schedule!.status = 'confirmed'
        request.status = 'scheduled'
      }
      event(request, command.accept ? 'Schedule response recorded' : 'Schedule change requested', [request.ownerId, assignment?.providerId ?? '', ...staffFor(request)])
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
      need(!request.updates.some(update => update.authorId === actor.id && update.review.state === 'pending'), 'Wait for XPro to review your previous update.')
      request.updates.unshift({ id: id(), authorId: actor.id, author: actor.name, status: command.status, note: command.note, attachments: command.attachments, createdAt: now(), review: pendingReview() })
      event(request, command.status === 'completion_pending' ? 'Completion report — approval needed' : 'Progress update — approval needed', staffFor(request))
      break
    case 'progress.review': {
      requireStaff('progress.review')
      editable(request)

      const update = request.updates.find(item => item.id === command.updateId)

      need(update?.review.state === 'pending', 'This update is no longer awaiting review.')
      need(command.approve || command.note.trim(), 'Explain why the update is not approved.')
      if (command.approve) {
        need(update!.status === 'in_progress' ? ['scheduled', 'in_progress', 'blocked'].includes(request.status) : request.status === 'in_progress', 'This update no longer fits the current job status. Reject it instead.')
        need(update!.status !== 'completion_pending' || update!.attachments.length || request.updates.some(item => item.id !== update!.id && item.review.state === 'approved' && item.attachments.length), 'Work evidence is required before completion can be approved.')
        update!.review = { state: 'approved', by: actor.id, note: command.note.trim(), at: now() }
        request.status = update!.status
        audit('Progress update approved', request.title, request.id)
        notify(request.ownerId, update!.status === 'completion_pending' ? 'Please confirm your job is complete' : 'Progress update', `${request.id} · ${request.title}`, request.id)
        notify(update!.authorId, 'Update approved', `${request.id} · ${request.title}`, request.id)
      }
      else {
        update!.review = { state: 'rejected', by: actor.id, note: command.note.trim(), at: now() }
        audit('Progress update rejected', request.title, request.id)
        notify(update!.authorId, 'Update not approved', command.note.trim(), request.id)
      }
      break
    }
    case 'completion.respond':
      requireRole('customer')
      need(request.status === 'completion_pending' && !request.issues.some(item => item.status === 'open'), 'Resolve open issues before completion review.')
      need(command.acknowledge || command.note.trim(), 'Explain the unresolved issue.')
      request.status = command.acknowledge ? 'acknowledged' : 'blocked'
      if (!command.acknowledge)
        request.issues.unshift({ id: id(), note: command.note, status: 'open', resolution: '', createdAt: now() })
      event(request, command.acknowledge ? 'Customer acknowledged completion' : 'Completion issue reported', [...staffFor(request), assignment?.providerId ?? ''])
      break
    case 'issue.resolve': {
      requireStaff('issue.resolve')

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
      requireStaff('request.close')
      need(request.status === 'acknowledged' && !request.issues.some(item => item.status === 'open'), 'Customer acknowledgement is required before final closure.')
      request.status = 'closed'
      request.flag = ''
      event(request, 'Job closed', [request.ownerId, assignment?.providerId ?? ''])
      break
    case 'message.send':
      need(command.text.trim() || command.attachments.length, 'Write a message or attach a file.')
      if (actor.role === 'admin')
        requireStaff(`message.${command.channel}`)
      else
        need(command.channel === actor.role, 'Choose a conversation available to your account.')
      need(command.channel !== 'provider' || assignment, 'Assign a provider before starting a provider conversation.')
      request.messages.push({ id: id(), authorId: actor.id, author: actor.name, authorRole: actor.role, channel: command.channel, providerId: command.channel === 'provider' ? assignment?.providerId : undefined, text: command.text.trim(), attachments: command.attachments, createdAt: now() })
      event(request, 'New conversation update', command.channel === 'customer' ? [request.ownerId, ...staffFor(request)] : command.channel === 'provider' ? [assignment!.providerId, ...staffFor(request)] : staffFor(request))
      break
  }

  if (actor.role === 'admin' && command.type !== 'request.claim' && command.type !== 'request.reassign' && !request.staffOwnerId && staffCan(staffMember, 'request.claim') && isOpen(request)) {
    request.staffOwnerId = actor.id
    request.claimedAt = now()
    audit('Request claimed automatically', request.title, request.id)
  }

  return state
}
