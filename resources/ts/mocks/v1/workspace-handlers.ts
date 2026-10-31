import { HttpResponse, http } from "msw"

import { v1Actor } from "@/features/v1/access"
import { defaultWorkingHours } from "@/features/operations/hours"
import type { AdminCatalog, AdminServiceNode, PublicServiceNode } from "@/features/catalog/types"
import type { LocationView } from "@/features/requests/api-types"
import { mockLocations, mockServices } from "@/mocks/v1/seed"
import { store } from "@/mocks/v1/handlers"
import { mockApiBase } from "@/mocks/api-base"
import { users } from "@/mocks/fixtures"
import type { StaffMemberView, StaffOwner } from "@/services/staff-api"
import type { ProviderAdminDetail, ProviderProfileResponse } from "@/services/providers-api"

const api = mockApiBase
const envelope = <T>(data: T) => HttpResponse.json({ data })
const demoActor = (request: Request) => {
  const token = request.headers.get("authorization")?.replace("Bearer ", "")
  const user = users.find(item => token === `mock-token-${item.id}`)
  const role = v1Actor(user)

  return user && role ? { user, role } : undefined
}
const forbidden = () => HttpResponse.json({ error: { code: "FORBIDDEN", message: "Forbidden." } }, { status: 403 })
const date = new Date().toISOString()
const providerProfileStorageKey = "xpro:v1-provider-profiles"
const loadProviderProfiles = (): Record<string, ProviderProfileResponse> => {
  try {
    return JSON.parse(localStorage.getItem(providerProfileStorageKey) ?? "{}") as Record<
      string,
      ProviderProfileResponse
    >
  } catch {
    return {}
  }
}
const providerProfiles = loadProviderProfiles()
const saveProviderProfiles = () => {
  try {
    localStorage.setItem(providerProfileStorageKey, JSON.stringify(providerProfiles))
  } catch {
    // Keep the current demo session usable if storage is unavailable.
  }
}

const locations: LocationView[] = [
  {
    id: "loc-lagos",
    kind: "state",
    name: "Lagos",
    parentId: null,
    aliases: [],
    active: true,
    serviceable: true,
    sort: 0,
    hasChildren: true,
  },
  ...mockLocations.map((name, sort): LocationView => ({
    id: `loc-${name.toLowerCase().replace(/[^a-z]+/g, "-")}`,
    kind: "lga",
    name: name.replace(/, Lagos$/, ""),
    parentId: "loc-lagos",
    aliases: [],
    active: true,
    serviceable: true,
    sort,
    hasChildren: false,
  })),
]

const publicServices: PublicServiceNode[] = mockServices.map((name, index) => ({
  id: `svc-${index + 1}`,
  name,
  description: `${name} services from vetted professionals.`,
  requiresStartDate: true,
  questions: [],
  children: [],
}))

const adminServices: AdminServiceNode[] = publicServices.map((service, index) => ({
  ...service,
  parentId: null,
  depth: 0,
  sortOrder: index,
  active: true,
  version: 1,
  usage: { requests: mockServices.length - index, providers: 1 },
  questions: [],
  children: [],
}))

const staffRows = (): StaffMemberView[] =>
  users
    .filter(user => user.role === "admin" && user.id !== "usr-admin")
    .map((user, index) => {
      const role =
        user.id === "usr-operations"
          ? "operations"
          : user.id === "usr-pricing"
            ? "pricing"
            : user.id === "usr-relations"
              ? "client_relations"
              : "finance"

      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        roles: [role],
        status: "active",
        permissions: [],
        canOwnRequests: true,
        permVersion: 1,
        rowVersion: 1,
        employmentPeriod: 1,
        lastSignInAt: new Date(Date.now() - (index + 1) * 60 * 60 * 1000).toISOString(),
        acceptedAt: date,
        mfaEnrolledAt: null,
        invitedAt: null,
        invitedBy: null,
        invite: null,
        suspension: null,
        deactivation: null,
        leave: null,
        workload: {
          openOwned:
            store
              .listStaff({ id: "usr-admin", role: "admin", name: "Amara Okafor", email: "admin@xpro.test" })
              .find(item => item.id === user.id)?.openRequests ?? 0,
          overdueOwned: 0,
        },
        conflictDeclaration: null,
        policyAcceptance: null,
      }
    })

const catalog: AdminCatalog = { maxDepth: 2, services: adminServices }
const settings = [
  {
    key: "provider.requireEmailVerification",
    value: true,
    version: 1,
    riskClass: "operational",
    updatedBy: "Amara Okafor",
    updatedAt: date,
  },
  {
    key: "provider.requirePhoneVerification",
    value: false,
    version: 1,
    riskClass: "operational",
    updatedBy: "Amara Okafor",
    updatedAt: date,
  },
]

const pageResult = <T>(items: T[], url: URL) => {
  const page = Math.max(Number(url.searchParams.get("page")) || 1, 1)
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 25, 1), 100)
  const start = (page - 1) * limit

  return {
    items: items.slice(start, start + limit),
    total: items.length,
    page,
    limit,
    totalPages: Math.ceil(items.length / limit),
    hasNextPage: start + limit < items.length,
    hasPrevPage: page > 1,
  }
}

const staffOwners = (): StaffOwner[] =>
  staffRows().map(member => ({
    id: member.id,
    name: `${member.firstName} ${member.lastName}`,
    roles: member.roles,
    onLeave: false,
    leaveTo: null,
    workload: member.workload,
  }))

const staffMember = (id: string): StaffMemberView | undefined => {
  const listed = staffRows().find(member => member.id === id)
  if (listed) return listed
  if (id !== "usr-admin") return undefined

  const user = users.find(member => member.id === id)
  if (!user) return undefined

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    roles: ["super_admin"],
    status: "active",
    permissions: user.scopes,
    canOwnRequests: true,
    permVersion: 1,
    rowVersion: 1,
    employmentPeriod: 1,
    lastSignInAt: date,
    acceptedAt: date,
    mfaEnrolledAt: null,
    invitedAt: null,
    invitedBy: null,
    invite: null,
    suspension: null,
    deactivation: null,
    leave: null,
    workload: { openOwned: 0, overdueOwned: 0 },
    conflictDeclaration: null,
    policyAcceptance: null,
  }
}

const baseProviderProfile = (userId: string): ProviderProfileResponse => {
  const provider = store
    .listProviders({ id: "usr-admin", role: "admin", name: "Amara Okafor", email: "admin@xpro.test" })
    .find(item => item.id === userId)
  const user = users.find(item => item.id === userId)
  const areaNames = provider?.areas ?? ["Ikeja, Lagos"]
  const areaIds = areaNames.map(
    name => locations.find(location => location.name === name.replace(/, Lagos$/, ""))?.id ?? locations[1].id,
  )
  const serviceNames = provider?.services ?? []
  const serviceIds = serviceNames.map(
    name => `svc-${Math.max(mockServices.indexOf(name as (typeof mockServices)[number]) + 1, 1)}`,
  )

  return {
    id: userId,
    userId,
    firstName: user?.firstName ?? provider?.name.split(" ")[0] ?? "Demo",
    lastName: user?.lastName ?? provider?.name.split(" ").slice(1).join(" ") ?? "Provider",
    email: user?.email ?? `${userId}@xpro.test`,
    phone: user?.phone ?? "08031234567",
    trade: provider?.trade ?? "Construction professional",
    locationId: areaIds[0] ?? locations[1].id,
    serviceAreaIds: areaIds,
    state: "Lagos",
    city: areaNames[0]?.replace(/, Lagos$/, "") ?? "Ikeja",
    serviceAreas: areaNames,
    outsideServedAreas: false,
    services: serviceNames,
    serviceIds,
    skills: {},
    skillIds: {},
    capacity: 3,
    workingHours: defaultWorkingHours(),
    timeOff: [],
    experience: 5,
    bio: `${provider?.trade ?? "Construction professional"} serving Lagos.`,
    documents: [],
    photo: null,
    portfolio: [],
    verification: provider?.verified ? "approved" : "pending",
    available: provider?.available ?? false,
    version: 1,
    payout: { current: null, pending: null },
    bankReviewState: "none",
    history: [],
  }
}

const profileFor = (userId: string) => (providerProfiles[userId] ??= baseProviderProfile(userId))
const providerDetail = (profile: ProviderProfileResponse): ProviderAdminDetail => ({
  ...profile,
  email: profile.email ?? `${profile.userId}@xpro.test`,
  accountStatus: "active",
  registeredAt: date,
  reliabilityStatus: "clear",
  lastOfferedAt: null,
  activeJobs: 0,
  phoneVerifiedAt: date,
  evidenceSummary: {
    documentCount: profile.documents.length,
    hasPhoto: Boolean(profile.photo),
    pendingDocumentCount: 0,
    hasPendingPhoto: false,
  },
  payout: { ...profile.payout, review: { state: "none" }, history: [] },
  reliabilityEvents: [],
  history: profile.history.map((item, index) => ({
    kind: item.kind,
    decision: item.decision,
    note: item.note,
    actorId: "usr-admin",
    createdAt: item.createdAt,
    version: index + 1,
  })),
})

export const workspaceHandlers = [
  http.get(`${api}/providers/me/files/:id`, ({ request, params }) => {
    if (demoActor(request)?.role !== "provider") return forbidden()

    return envelope({ url: `/demo/files/${encodeURIComponent(String(params.id))}`, expiresInSeconds: 300 })
  }),
  http.get(`${api}/admin/providers/:providerId/files/:id`, ({ request, params }) => {
    if (demoActor(request)?.role !== "admin") return forbidden()

    return envelope({ url: `/demo/files/${encodeURIComponent(String(params.id))}`, expiresInSeconds: 300 })
  }),
  http.post(`${api}/admin/providers/:id/identity/reveal`, ({ request, params }) => {
    if (demoActor(request)?.role !== "admin") return forbidden()
    const profile = profileFor(String(params.id))

    return envelope(
      profile.documents.map(file => ({
        ...file,
        purpose: "provider_document",
        url: `/demo/files/${encodeURIComponent(file.id)}`,
        expiresInSeconds: 300,
      })),
    )
  }),
  http.get(`${api}/providers/me/onboarding-policy`, ({ request }) =>
    demoActor(request)?.role === "provider"
      ? envelope({ phoneVerificationRequired: false, emailVerificationRequired: true })
      : forbidden(),
  ),
  http.get(`${api}/providers/me`, ({ request }) => {
    const actor = demoActor(request)

    return actor?.role === "provider" ? envelope(profileFor(actor.user.id)) : forbidden()
  }),
  http.post(`${api}/providers/me/submissions`, async ({ request }) => {
    const actor = demoActor(request)
    if (actor?.role !== "provider") return forbidden()
    const body = (await request.json()) as Partial<ProviderProfileResponse> & {
      locationId?: string
      serviceAreaIds?: string[]
      serviceIds?: string[]
    }
    const existing = profileFor(actor.user.id)
    const loc = locations.find(item => item.id === body.locationId)
    const areas = (body.serviceAreaIds ?? existing.serviceAreaIds).map(
      id => locations.find(item => item.id === id)?.name ?? id,
    )
    const services = body.serviceIds?.length
      ? body.serviceIds.map(id => mockServices[Number(id.replace("svc-", "")) - 1]).filter(Boolean)
      : ((body.services ?? existing.services) as string[])
    const profile: ProviderProfileResponse = {
      ...existing,
      ...body,
      id: actor.user.id,
      userId: actor.user.id,
      firstName: actor.user.firstName,
      lastName: actor.user.lastName,
      email: actor.user.email,
      locationId: body.locationId ?? existing.locationId,
      state: loc?.kind === "state" ? loc.name : "Lagos",
      city: loc?.kind === "lga" ? loc.name : existing.city,
      serviceAreaIds: body.serviceAreaIds ?? existing.serviceAreaIds,
      serviceAreas: areas.map(name => `${name}, Lagos`),
      services,
      serviceIds:
        body.serviceIds ??
        services.map(name => `svc-${Math.max(mockServices.indexOf(name as (typeof mockServices)[number]) + 1, 1)}`),
      skills: (body.skills as ProviderProfileResponse["skills"] | undefined) ?? existing.skills,
      skillIds: body.skillIds ?? existing.skillIds,
      verification: "pending",
      available: false,
      version: existing.version + 1,
      history: [...existing.history, { kind: "profile", decision: "pending", createdAt: date }],
    }
    providerProfiles[actor.user.id] = profile
    saveProviderProfiles()

    return envelope(profile)
  }),
  http.put(`${api}/providers/me/availability`, async ({ request }) => {
    const actor = demoActor(request)
    if (actor?.role !== "provider") return forbidden()
    const body = (await request.json()) as { available?: boolean }
    const profile = profileFor(actor.user.id)
    if (profile.verification !== "approved")
      return HttpResponse.json(
        { error: { code: "PROFILE_NOT_APPROVED", message: "Your profile needs approval first." } },
        { status: 409 },
      )
    profile.available = Boolean(body.available)
    profile.version += 1
    store.setProviderAvailability(
      { id: actor.user.id, role: "provider", name: "Tunde Bakare", email: actor.user.email },
      profile.available,
    )
    saveProviderProfiles()

    return envelope(profile)
  }),
  http.put(`${api}/providers/me/calendar`, async ({ request }) => {
    const actor = demoActor(request)
    if (actor?.role !== "provider") return forbidden()
    const body = (await request.json()) as {
      workingHours: ProviderProfileResponse["workingHours"]
      timeOff: ProviderProfileResponse["timeOff"]
    }
    const profile = profileFor(actor.user.id)
    profile.workingHours = body.workingHours
    profile.timeOff = body.timeOff
    profile.version += 1
    saveProviderProfiles()

    return envelope(profile)
  }),
  http.get(`${api}/admin/providers/:id`, ({ request, params }) => {
    if (demoActor(request)?.role !== "admin") return forbidden()
    const profile = providerProfiles[String(params.id)] ?? baseProviderProfile(String(params.id))

    return envelope(providerDetail(profile))
  }),
  http.post(`${api}/admin/providers/:id/reviews`, async ({ request, params }) => {
    if (demoActor(request)?.role !== "admin") return forbidden()
    const body = (await request.json()) as { decision: "approved" | "changes_requested" | "rejected"; note?: string }
    const profile = profileFor(String(params.id))
    profile.verification = body.decision
    profile.reviewNote = body.note ?? ""
    profile.version += 1
    profile.history.push({ kind: "profile", decision: body.decision, note: body.note, createdAt: date })
    store.reviewProvider(
      { id: "usr-admin", role: "admin", name: "Amara Okafor", email: "admin@xpro.test" },
      String(params.id),
      body.decision === "approved",
    )
    saveProviderProfiles()

    return envelope(profile)
  }),
  http.get(`${api}/services`, () => envelope(publicServices)),
  http.get(`${api}/admin/catalog`, ({ request }) => {
    if (demoActor(request)?.role !== "admin") return forbidden()

    return envelope(catalog)
  }),
  http.get(`${api}/locations`, ({ request }) => {
    const parentId = new URL(request.url).searchParams.get("parentId")
    const rows = locations.filter(item => (parentId ? item.parentId === parentId : item.kind === "state"))

    return envelope(rows)
  }),
  http.get(`${api}/admin/locations`, ({ request }) => {
    if (demoActor(request)?.role !== "admin") return forbidden()
    const parentId = new URL(request.url).searchParams.get("parentId")

    return envelope(locations.filter(item => (parentId ? item.parentId === parentId : item.kind === "state")))
  }),
  http.post(`${api}/admin/locations`, async ({ request }) => {
    if (demoActor(request)?.role !== "admin") return forbidden()
    const body = (await request.json()) as Omit<LocationView, "id" | "hasChildren">
    const created: LocationView = { ...body, id: `loc-demo-${Date.now()}`, hasChildren: false }
    locations.push(created)

    return envelope(created)
  }),
  http.put(`${api}/admin/locations/:id`, async ({ request, params }) => {
    if (demoActor(request)?.role !== "admin") return forbidden()
    const item = locations.find(location => location.id === String(params.id))
    if (!item)
      return HttpResponse.json({ error: { code: "NOT_FOUND", message: "Location not found." } }, { status: 404 })
    const body = (await request.json()) as Partial<LocationView>
    Object.assign(item, body)

    return envelope(item)
  }),
  http.get(`${api}/admin/settings`, ({ request }) =>
    demoActor(request)?.role === "admin" ? envelope(settings) : forbidden(),
  ),
  http.patch(`${api}/admin/settings`, async ({ request }) => {
    if (demoActor(request)?.role !== "admin") return forbidden()
    const body = (await request.json()) as { changes?: Array<{ key: string; value: unknown; expectedVersion: number }> }
    const changes = (body.changes ?? []).map(change => {
      const setting = settings.find(item => item.key === change.key)
      if (!setting || setting.version !== change.expectedVersion || typeof change.value !== "boolean") return null
      const before = setting.value
      setting.value = change.value
      setting.version += 1
      setting.updatedAt = new Date().toISOString()

      return { key: setting.key, before, after: setting.value, version: setting.version, riskClass: setting.riskClass }
    })
    if (changes.includes(null))
      return HttpResponse.json(
        { error: { code: "VERSION_CONFLICT", message: "Settings changed. Reload and try again." } },
        { status: 409 },
      )

    return envelope({ changeSetId: `demo-settings-${Date.now()}`, changes })
  }),
  http.get(`${api}/admin/settings/history`, ({ request }) =>
    demoActor(request)?.role === "admin"
      ? envelope({ items: [], total: 0, page: 1, limit: 25, totalPages: 0, hasNextPage: false, hasPrevPage: false })
      : forbidden(),
  ),
  http.get(`${api}/admin/providers`, ({ request }) => {
    if (demoActor(request)?.role !== "admin") return forbidden()
    const providers = store
      .listProviders({ id: "usr-admin", role: "admin", name: "Amara Okafor", email: "admin@xpro.test" })
      .map((provider, index) => ({
        id: provider.id,
        userId: provider.id,
        firstName: provider.name.split(" ")[0],
        lastName: provider.name.split(" ").slice(1).join(" "),
        email: provider.id === "usr-provider" ? "provider@xpro.test" : `${provider.id}@xpro.test`,
        phone: "08031234567",
        trade: provider.trade,
        locationId: locations[index + 1]?.id ?? locations[1].id,
        serviceAreaIds: provider.areas.map(
          area => locations.find(location => location.name === area.replace(/, Lagos$/, ""))?.id ?? locations[1].id,
        ),
        state: "Lagos",
        city: provider.areas[0]?.replace(/, Lagos$/, "") ?? "Lagos",
        serviceAreas: provider.areas,
        outsideServedAreas: false,
        services: provider.services,
        serviceIds: provider.services.map(
          name => `svc-${Math.max(mockServices.indexOf(name as (typeof mockServices)[number]) + 1, 1)}`,
        ),
        skills: {},
        skillIds: {},
        capacity: 3,
        workingHours: defaultWorkingHours(),
        timeOff: [],
        experience: 5,
        bio: `${provider.trade} serving Lagos.`,
        documents: [],
        photo: null,
        portfolio: [],
        verification: provider.verified ? "approved" : "pending",
        available: provider.available,
        version: 1,
        payout: { current: null, pending: null },
        bankReviewState: "none",
        history: [],
        profileStarted: true,
        accountStatus: "active",
        registeredAt: date,
      }))

    const url = new URL(request.url)
    const q = (url.searchParams.get("q") ?? "").toLowerCase()
    const verification = url.searchParams.get("verification")
    const matching = providers.filter(provider => {
      const text =
        `${provider.firstName} ${provider.lastName} ${provider.email} ${provider.trade} ${provider.city}`.toLowerCase()

      return (
        (!q || text.includes(q)) &&
        (!verification || (verification === "draft" ? false : provider.verification === verification))
      )
    })

    return envelope(pageResult(matching, url))
  }),
  http.get(`${api}/admin/staff/summary`, ({ request }) => {
    if (demoActor(request)?.role !== "admin") return forbidden()
    const active = staffRows().length + 1

    return envelope({ active, invited: 0, invitedExpired: 0, suspended: 0, former: 0, activeSuperAdmins: 1 })
  }),
  http.get(`${api}/admin/staff`, ({ request }) => {
    if (demoActor(request)?.role !== "admin") return forbidden()
    const url = new URL(request.url)
    const q = (url.searchParams.get("q") ?? "").toLowerCase()
    const rows = staffRows().filter(member =>
      `${member.firstName} ${member.lastName} ${member.email}`.toLowerCase().includes(q),
    )

    return envelope(pageResult(rows, url))
  }),
  http.get(`${api}/admin/staff/owners`, ({ request }) =>
    demoActor(request)?.role === "admin" ? envelope(staffOwners()) : forbidden(),
  ),
  http.get(`${api}/admin/staff/:id`, ({ request, params }) => {
    const actor = demoActor(request)
    const id = String(params.id)
    if (!actor || (actor.role !== "admin" && actor.user.id !== id)) return forbidden()
    const member = staffMember(id)

    return member
      ? envelope(member)
      : HttpResponse.json({ error: { code: "NOT_FOUND", message: "Staff member not found." } }, { status: 404 })
  }),
  http.get(`${api}/admin/staff/:id/history`, ({ request }) =>
    demoActor(request)?.role === "admin"
      ? envelope({ items: [], total: 0, page: 1, limit: 25, totalPages: 0, hasNextPage: false, hasPrevPage: false })
      : forbidden(),
  ),
  http.get(`${api}/admin/refunds`, ({ request }) =>
    demoActor(request)?.role === "admin"
      ? envelope({ items: [], total: 0, page: 1, limit: 25, totalPages: 0, hasNextPage: false, hasPrevPage: false })
      : forbidden(),
  ),
  http.get(`${api}/admin/payouts`, ({ request }) =>
    demoActor(request)?.role === "admin"
      ? envelope({ items: [], total: 0, page: 1, limit: 25, totalPages: 0, hasNextPage: false, hasPrevPage: false })
      : forbidden(),
  ),
]
