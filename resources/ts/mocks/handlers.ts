import { HttpResponse, delay, http } from 'msw'

import { allocations, auditEvents, demoCredentials, notifications, programs, projects, submissions, users } from '@/mocks/fixtures'
import type { AddEvidencePayload, CreateProjectPayload, DashboardMetric, ReviewDecisionPayload, Submission, TrackedProject, User, UserRole } from '@/types/domain'

const api = '*/api'
const accountPasswords = new Map<string, string>(demoCredentials.map(item => [item.email, item.password]))

const envelope = <T>(data: T, meta?: Record<string, unknown>) => HttpResponse.json({ data, meta })

const validationError = (message: string) => HttpResponse.json(
  { error: { code: 'VALIDATION_ERROR', message } },
  { status: 422 },
)

const isEmail = (value: unknown) => /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(String(value ?? '').trim())
const isStrongPassword = (value: unknown) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(String(value ?? ''))
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

const bearerUser = (request: Request): User | undefined => {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')

  return users.find(user => token === `mock-token-${user.id}`)
}

const requireUser = (request: Request): User | Response => bearerUser(request)
  ?? HttpResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Your session has expired.' } }, { status: 401 })

const formatCompactNaira = (amount: number) => `₦${new Intl.NumberFormat('en-NG', { maximumFractionDigits: 1, notation: 'compact' }).format(amount)}`

const viewerMetrics = (visibleProjects: TrackedProject[], state: string): DashboardMetric[] => [
  { label: 'Approved allocation', value: formatCompactNaira(visibleProjects.reduce((total, project) => total + project.allocation, 0)), helper: `${state} current view`, icon: 'tabler-cash-banknote', color: 'primary' },
  { label: 'Published projects', value: String(visibleProjects.length), helper: `Approved data for ${state}`, icon: 'tabler-building-community', color: 'success' },
  { label: 'Action required', value: String(visibleProjects.filter(project => project.actionRequired).length), helper: 'Projects need attention', icon: 'tabler-speakerphone', color: 'warning' },
  { label: 'With verification', value: String(visibleProjects.filter(project => project.lastVerifiedAt).length), helper: 'Published verification records', icon: 'tabler-rosette-discount-check', color: 'info' },
]

const roleMetrics = (role: Exclude<UserRole, 'budget_viewer'>) => {
  if (role === 'super_admin') {
    return [
      { label: 'Awaiting review', value: '2', helper: '1 needs attention', icon: 'tabler-clipboard-check', color: 'warning' as const },
      { label: 'Published projects', value: '6', helper: 'Across 3 Nigerian states', icon: 'tabler-world-check', color: 'success' as const },
      { label: 'Active managers', value: '6', helper: '2 programs assigned', icon: 'tabler-users', color: 'primary' as const },
      { label: 'Data quality', value: '92%', helper: 'Up 4% this month', icon: 'tabler-shield-check', color: 'info' as const },
    ]
  }

  if (role === 'manager') {
    return [
      { label: 'My active projects', value: '8', helper: 'Across 8 LGAs', icon: 'tabler-folders', color: 'primary' as const },
      { label: 'Drafts', value: '1', helper: 'Needs source evidence', icon: 'tabler-file-pencil', color: 'info' as const },
      { label: 'Submitted', value: '2', helper: 'Awaiting admin review', icon: 'tabler-clock-check', color: 'warning' as const },
      { label: 'Published allocation', value: '₦952M', helper: '2025–2026', icon: 'tabler-cash', color: 'success' as const },
    ]
  }

  return []
}

export const handlers = [
  http.post(`${api}/auth/login`, async ({ request }) => {
    await delay(500)

    const payload = await request.json() as { email?: string; password?: string }
    if (!isEmail(payload.email) || !payload.password)
      return validationError('Enter a valid email address and password.')

    const normalizedEmail = String(payload.email).trim().toLowerCase()

    const user = accountPasswords.get(normalizedEmail) === payload.password
      ? users.find(item => item.email === normalizedEmail)
      : undefined

    if (!user)
      return HttpResponse.json({ error: { code: 'INVALID_CREDENTIALS', message: 'The email or password is incorrect.' } }, { status: 422 })

    if (user.status === 'unverified')
      return validationError('Verify your email before signing in.')
    if (user.status !== 'active')
      return validationError('This account is not currently active.')

    return envelope({ token: `mock-token-${user.id}`, user, requiresMfa: user.mfaRequired })
  }),

  http.post(`${api}/auth/mfa/challenge`, async ({ request }) => {
    await delay(350)

    const payload = await request.json() as { code?: string }
    if (payload.code !== '123456')
      return validationError('The authentication code is invalid or has expired.')

    return envelope({ verified: true })
  }),

  http.post(`${api}/auth/register`, async ({ request }) => {
    await delay(600)

    const payload = await request.json() as { name?: string; email?: string; password?: string; role?: string }
    const name = String(payload.name ?? '').trim()
    const email = String(payload.email ?? '').trim().toLowerCase()

    if (name.length < 2)
      return validationError('Enter your full name.')
    if (!isEmail(email))
      return validationError('Enter a valid email address.')
    if (!isStrongPassword(payload.password))
      return validationError('Use a stronger password to create your account.')
    if (users.some(user => user.email === email))
      return validationError('An account already exists for this email address.')

    if (payload.role !== 'customer' && payload.role !== 'provider')
      return validationError('Choose a customer or provider account.')

    users.push({
      id: `usr-${crypto.randomUUID()}`,
      name,
      email,
      role: payload.role,
      status: 'unverified',
      title: payload.role === 'customer' ? 'XPro Customer' : 'XPro Service Provider',
      initials: name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(),
      scopes: [],
      mfaRequired: false,
    })
    accountPasswords.set(email, String(payload.password))

    return envelope({ email, name, status: 'unverified' })
  }),

  http.post(`${api}/auth/email/verify`, async ({ request }) => {
    await delay(450)

    const payload = await request.json() as { token?: string; email?: string }
    const user = users.find(item => item.email === String(payload.email ?? '').trim().toLowerCase())

    if (payload.token !== 'prototype-verification-token' || !user || user.status !== 'unverified')
      return validationError('This verification link is invalid or has already been used.')

    user.status = 'active'

    return envelope({ verified: true })
  }),

  http.post(`${api}/auth/password/forgot`, async ({ request }) => {
    await delay(450)

    const payload = await request.json() as { email?: string }
    if (!isEmail(payload.email))
      return validationError('Enter a valid email address.')

    return envelope({ sent: true })
  }),

  http.post(`${api}/auth/password/reset`, async ({ request }) => {
    await delay(450)

    const payload = await request.json() as { token?: string; password?: string; email?: string }
    if (payload.token !== 'prototype-token')
      return validationError('This password reset link is invalid or has expired.')
    if (!isStrongPassword(payload.password))
      return validationError('Use a stronger password to protect your account.')

    const email = String(payload.email ?? '').trim().toLowerCase()

    if (!accountPasswords.has(email))
      return validationError('This password reset link is invalid or has expired.')

    accountPasswords.set(email, String(payload.password))

    return envelope({ reset: true })
  }),

  http.get(`${api}/me`, ({ request }) => {
    const current = requireUser(request)
    if (current instanceof Response)
      return current

    return envelope(current)
  }),

  http.get(`${api}/dashboard`, async ({ request }) => {
    await delay(250)

    const current = requireUser(request)
    if (current instanceof Response)
      return current

    const requestedCountry = new URL(request.url).searchParams.get('country') ?? 'Nigeria'
    const requestedState = new URL(request.url).searchParams.get('state') ?? 'Niger'

    const visibleProjects = current.role === 'budget_viewer'
      ? projects.filter(project => project.approvalStatus === 'published' && project.country === requestedCountry && project.state === requestedState)
      : projects

    return envelope({
      metrics: current.role === 'budget_viewer' ? viewerMetrics(visibleProjects, requestedState) : roleMetrics(current.role),
      projects: visibleProjects,
      programs,
      submissions: current.role === 'budget_viewer' ? [] : submissions,
      notifications,
    })
  }),

  http.get(`${api}/programs`, ({ request }) => {
    const current = requireUser(request)
    if (current instanceof Response)
      return current

    return envelope(programs)
  }),

  http.get(`${api}/projects`, ({ request }) => {
    const current = requireUser(request)
    if (current instanceof Response)
      return current
    const requestedCountry = new URL(request.url).searchParams.get('country') ?? 'Nigeria'
    const requestedState = new URL(request.url).searchParams.get('state') ?? 'Niger'

    return envelope(current.role === 'budget_viewer' ? projects.filter(project => project.approvalStatus === 'published' && project.country === requestedCountry && project.state === requestedState) : projects)
  }),

  http.post(`${api}/projects`, async ({ request }) => {
    await delay(500)

    const current = requireUser(request)
    if (current instanceof Response)
      return current
    if (!['manager', 'super_admin'].includes(current.role))
      return HttpResponse.json({ error: { code: 'FORBIDDEN', message: 'You do not have permission to create projects.' } }, { status: 403 })

    const payload = await request.json() as Partial<CreateProjectPayload>
    const title = String(payload.title ?? '').trim()
    const description = String(payload.description ?? '').trim()
    const agency = String(payload.agency ?? '').trim()
    const lga = String(payload.lga ?? '').trim()
    const source = String(payload.source ?? '').trim()
    const amount = Number(payload.amount)

    if (title.length < 3 || description.length < 20 || !agency || !lga || !source || !Number.isFinite(amount) || amount <= 0)
      return validationError('Complete the required project, location, agency, allocation, and source fields.')

    const program = programs.find(item => item.name === payload.program)
    if (!program)
      return validationError('Select a valid program.')

    const project: TrackedProject = {
      id: `project-${projects.length + 1}`,
      publicId: slugify(title),
      title,
      description,
      programId: program.id,
      programName: program.name,
      country: String(payload.country ?? 'Nigeria'),
      state: String(payload.state ?? ''),
      lga,
      sector: String(payload.sector ?? ''),
      agency,
      fiscalYear: String(payload.fiscalYear ?? ''),
      allocation: amount,
      currency: 'NGN',
      trackingStatus: 'not_started',
      approvalStatus: 'draft',
      managerId: current.id,
      managerName: current.name,
      lastVerifiedAt: null,
      actionRequired: Boolean(payload.actionRequired),
      evidenceCount: 0,
      version: 1,
    }

    projects.push(project)
    allocations.push({
      id: `allocation-${allocations.length + 1}`,
      projectId: project.id,
      fiscalYear: project.fiscalYear,
      amount: project.allocation,
      currency: project.currency,
      source,
      classification: 'Capital expenditure',
      agency: project.agency,
      approvalStatus: 'draft',
    })

    return envelope(project, { created: true })
  }),

  http.post(`${api}/projects/:id/submit`, async ({ params, request }) => {
    await delay(450)

    const current = requireUser(request)
    if (current instanceof Response)
      return current
    if (current.role !== 'manager')
      return HttpResponse.json({ error: { code: 'FORBIDDEN', message: 'Only Managers can submit project work.' } }, { status: 403 })

    const payload = await request.json() as { note?: string }
    const project = projects.find(item => item.id === params.id)
    if (!project || project.managerId !== current.id)
      return HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'Project not found.' } }, { status: 404 })
    if (!['draft', 'changes_requested'].includes(project.approvalStatus))
      return validationError('Only editable drafts or requested changes can be submitted.')
    if (String(payload.note ?? '').trim().length < 10)
      return validationError('Add a submission note with at least 10 characters.')

    project.approvalStatus = 'submitted'
    project.version += 1

    const submission: Submission = {
      id: `sub-${submissions.length + 1}`,
      projectId: project.id,
      projectTitle: project.title,
      managerName: current.name,
      submittedAt: new Date().toISOString(),
      type: project.version > 2 ? 'project_revision' : 'new_project',
      status: 'pending',
      risk: project.evidenceCount === 0 ? 'attention' : 'normal',
      changedFields: project.version > 2 ? 4 : 12,
    }

    submissions.unshift(submission)
    notifications.unshift({
      id: `note-${notifications.length + 1}`,
      title: 'Project submitted for review',
      message: `${project.title} is ready for Super Admin review.`,
      createdAt: submission.submittedAt,
      read: false,
      tone: 'info',
    })

    return envelope({ project, submission })
  }),

  http.post(`${api}/projects/:id/evidence`, async ({ params, request }) => {
    await delay(350)

    const current = requireUser(request)
    if (current instanceof Response)
      return current
    if (!['manager', 'super_admin'].includes(current.role))
      return HttpResponse.json({ error: { code: 'FORBIDDEN', message: 'You do not have permission to attach evidence.' } }, { status: 403 })

    const payload = await request.json() as Partial<AddEvidencePayload>
    const title = String(payload.title ?? '').trim()
    const source = String(payload.source ?? '').trim()
    const project = projects.find(item => item.id === params.id)
    if (!project || (current.role === 'manager' && project.managerId !== current.id))
      return HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'Project not found.' } }, { status: 404 })
    if (!title || title.length < 3 || !source || source.length < 3)
      return validationError('Add an evidence title and source reference.')
    if (!['draft', 'changes_requested'].includes(project.approvalStatus))
      return validationError('Evidence can only be added to an editable project.')

    project.evidenceCount += 1

    return envelope(project, { evidence: { title, source } })
  }),

  http.get(`${api}/projects/:id`, ({ params, request }) => {
    const current = requireUser(request)
    if (current instanceof Response)
      return current
    const project = projects.find(item => item.id === params.id || item.publicId === params.id)
    if (!project || (current.role === 'budget_viewer' && project.approvalStatus !== 'published'))
      return HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'Project not found.' } }, { status: 404 })

    return envelope(project)
  }),

  http.get(`${api}/allocations`, ({ request }) => {
    const current = requireUser(request)
    if (current instanceof Response)
      return current

    return envelope(current.role === 'budget_viewer' ? allocations.filter(item => item.approvalStatus === 'published') : allocations)
  }),

  http.get(`${api}/submissions`, ({ request }) => {
    const current = requireUser(request)
    if (current instanceof Response)
      return current
    if (current.role === 'budget_viewer')
      return HttpResponse.json({ error: { code: 'FORBIDDEN', message: 'You do not have access to submissions.' } }, { status: 403 })

    return envelope(submissions)
  }),

  http.post(`${api}/submissions/:id/decision`, async ({ params, request }) => {
    await delay(450)

    const current = requireUser(request)
    if (current instanceof Response)
      return current
    if (current.role !== 'super_admin')
      return HttpResponse.json({ error: { code: 'FORBIDDEN', message: 'Only Super Admins can make publication decisions.' } }, { status: 403 })

    const payload = await request.json() as Partial<ReviewDecisionPayload>
    const submission = submissions.find(item => item.id === params.id)
    const project = submission ? projects.find(item => item.id === submission.projectId) : undefined
    if (!submission || !project)
      return HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'Submission not found.' } }, { status: 404 })
    if (!['approved', 'changes_requested', 'rejected'].includes(String(payload.decision)))
      return validationError('Select a valid review decision.')
    if (String(payload.note ?? '').trim().length < 10)
      return validationError('Add a decision note with at least 10 characters.')

    const decision = payload.decision as ReviewDecisionPayload['decision']

    submission.status = decision
    project.approvalStatus = decision === 'approved' ? 'published' : decision
    if (decision === 'approved')
      project.version += 1

    auditEvents.unshift({
      id: `audit-${auditEvents.length + 1}`,
      actor: current.name,
      action: decision === 'approved' ? 'Published project' : decision === 'changes_requested' ? 'Requested changes' : 'Rejected project',
      resource: project.title,
      createdAt: new Date().toISOString(),
      tone: decision === 'approved' ? 'success' : 'warning',
    })

    return envelope({ submission, project })
  }),

  http.get(`${api}/users`, ({ request }) => {
    const current = requireUser(request)
    if (current instanceof Response)
      return current
    if (current.role !== 'super_admin')
      return HttpResponse.json({ error: { code: 'FORBIDDEN', message: 'You do not have access to user administration.' } }, { status: 403 })

    return envelope(users)
  }),

  http.get(`${api}/notifications`, ({ request }) => {
    const current = requireUser(request)
    if (current instanceof Response)
      return current

    return envelope(notifications)
  }),

  http.get(`${api}/audit-events`, ({ request }) => {
    const current = requireUser(request)
    if (current instanceof Response)
      return current
    if (current.role !== 'super_admin')
      return HttpResponse.json({ error: { code: 'FORBIDDEN', message: 'You do not have access to the global audit log.' } }, { status: 403 })

    return envelope(auditEvents)
  }),
]
