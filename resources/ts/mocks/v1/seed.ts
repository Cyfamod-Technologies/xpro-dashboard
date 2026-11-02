import type { V1Message, V1Request } from "@/features/v1/types"

// The in-memory V1 data the mock API starts from. Pure: no Vue, MSW or browser imports, so the tests can load it.
// Money is kobo. Dates are relative to `now`, so the demo always looks current.

export interface MockProvider {
  id: string
  name: string
  trade: string
  services: string[]
  areas: string[]
  verified: boolean
  available: boolean
  rating: number
}

export interface MockStaff {
  id: string
  name: string
  email: string
  roles: string[]
}

export interface V1MockData {
  /** Bump when the shape changes, so an old `localStorage` copy is dropped. */
  schema: 1
  nextRequest: number
  nextMessage: number
  nextActivity: number
  requests: V1Request[]
  messages: V1Message[]
  providers: MockProvider[]
  staff: MockStaff[]
}

export const mockSchema = 1 as const

export const mockServices = [
  "Design",
  "Construction",
  "Hire",
  "Procurement",
  "Facility management",
  "Waste management",
] as const

export const mockLocations = [
  "Ikeja, Lagos",
  "Lekki, Lagos",
  "Victoria Island, Lagos",
  "Ikoyi, Lagos",
  "Yaba, Lagos",
  "Surulere, Lagos",
  "Ajah, Lagos",
  "Maryland, Lagos",
] as const

/** The demo accounts the seed is written around (see `mocks/fixtures.ts`). */
export const demoIds = {
  customer: "usr-customer",
  admin: "usr-admin",
  staff: "usr-operations",
  secondStaff: "usr-relations",
  provider: "usr-provider",
} as const

const day = 24 * 60 * 60 * 1000
const hour = 60 * 60 * 1000

const iso = (now: Date, offsetMs: number) => new Date(now.getTime() + offsetMs).toISOString()
const dateOnly = (now: Date, days: number) => new Date(now.getTime() + days * day).toISOString().slice(0, 10)

const customer = {
  id: demoIds.customer,
  name: "Ada Okafor",
  email: "customer@xpro.test",
  phone: "08031234567",
}
const admin = { id: demoIds.admin, name: "Amara Okafor" }
const kemi = { id: demoIds.staff, name: "Kemi Adebayo" }

export const createProviders = (): MockProvider[] => [
  {
    id: demoIds.provider,
    name: "Tunde Bakare",
    trade: "Construction professional",
    services: ["Construction", "Design", "Hire"],
    areas: ["Ikeja, Lagos", "Lekki, Lagos", "Victoria Island, Lagos"],
    verified: true,
    available: true,
    rating: 4.8,
  },
  {
    id: "prv-ngozi",
    name: "Ngozi Interiors",
    trade: "Interior design and finishing",
    services: ["Design", "Construction"],
    areas: ["Lekki, Lagos", "Ikoyi, Lagos", "Victoria Island, Lagos"],
    verified: true,
    available: true,
    rating: 4.6,
  },
  {
    id: "prv-femi",
    name: "Femi Facility Services",
    trade: "Facility and waste management",
    services: ["Facility management", "Waste management"],
    areas: ["Ikeja, Lagos", "Yaba, Lagos", "Surulere, Lagos", "Maryland, Lagos"],
    verified: true,
    available: true,
    rating: 4.4,
  },
  {
    // Not verified yet, so it never appears as a candidate.
    id: "prv-chuks",
    name: "Chuks Plumbing",
    trade: "Plumbing and drainage",
    services: ["Construction", "Facility management"],
    areas: ["Ikeja, Lagos", "Ajah, Lagos"],
    verified: false,
    available: true,
    rating: 0,
  },
]

export const createStaff = (): MockStaff[] => [
  { id: demoIds.staff, name: kemi.name, email: "operations@xpro.test", roles: ["operations"] },
  { id: "usr-pricing", name: "Chidi Nwosu", email: "pricing@xpro.test", roles: ["pricing"] },
  { id: demoIds.secondStaff, name: "Zainab Lawal", email: "relations@xpro.test", roles: ["client_relations"] },
  { id: "usr-finance", name: "Ngozi Eze", email: "finance@xpro.test", roles: ["finance"] },
]

export const createSeed = (now: Date = new Date()): V1MockData => {
  const base = {
    customer,
    attachments: [],
    provider: null,
  }

  const unassigned: V1Request = {
    ...base,
    id: "XPR-00101",
    version: 1,
    service: "Construction",
    title: "Repaint a three-bedroom flat",
    description:
      "Interior repaint of a three-bedroom flat in Lekki: living room, bedrooms and corridor. Walls need light sanding and one coat of primer first.",
    location: "Lekki, Lagos",
    address: "12 Admiralty Way, Lekki Phase 1",
    phone: customer.phone,
    contactMethod: "whatsapp",
    budgetKobo: 45_000_000,
    preferredDate: dateOnly(now, 14),
    status: "submitted",
    assignee: null,
    createdAt: iso(now, -3 * hour),
    decision: { status: "submitted" },
    activity: [
      {
        id: "act-1",
        kind: "submitted",
        text: "Ada Okafor submitted the request",
        by: customer.name,
        at: iso(now, -3 * hour),
      },
    ],
  }

  const negotiating: V1Request = {
    ...base,
    id: "XPR-00102",
    version: 3,
    service: "Construction",
    title: "Office floor tiling",
    description:
      "Retile about 120 square metres of open-plan office floor in Ikeja. Old tiles must be lifted and the screed levelled before laying.",
    location: "Ikeja, Lagos",
    address: "4 Allen Avenue, Ikeja",
    phone: customer.phone,
    contactMethod: "phone",
    budgetKobo: 60_000_000,
    preferredDate: dateOnly(now, 10),
    status: "submitted",
    assignee: { ...kemi },
    createdAt: iso(now, -2 * day),
    decision: { status: "submitted" },
    activity: [
      {
        id: "act-2",
        kind: "submitted",
        text: "Ada Okafor submitted the request",
        by: customer.name,
        at: iso(now, -2 * day),
      },
      {
        id: "act-3",
        kind: "assigned",
        text: `${admin.name} assigned ${kemi.name}`,
        by: admin.name,
        at: iso(now, -2 * day + hour),
      },
    ],
  }

  const approved: V1Request = {
    ...base,
    id: "XPR-00103",
    version: 5,
    service: "Construction",
    title: "Generator house and plinth",
    description:
      "Build a ventilated block generator house with a concrete plinth behind a Victoria Island office. Drawings are attached.",
    location: "Victoria Island, Lagos",
    address: "27 Adetokunbo Ademola Street, Victoria Island",
    phone: customer.phone,
    contactMethod: "email",
    budgetKobo: 55_000_000,
    preferredDate: dateOnly(now, 7),
    attachments: [{ id: "att-drawing", name: "Generator-house-drawing.pdf", size: 412_000, type: "application/pdf" }],
    status: "approved",
    assignee: { ...kemi },
    createdAt: iso(now, -6 * day),
    decision: {
      status: "approved",
      by: admin,
      at: iso(now, -4 * day),
      terms: {
        providerId: demoIds.provider,
        providerName: "Tunde Bakare",
        priceKobo: 48_000_000,
        date: dateOnly(now, 9),
      },
    },
    provider: {
      providerId: demoIds.provider,
      providerName: "Tunde Bakare",
      assignedBy: admin.name,
      assignedAt: iso(now, -4 * day),
    },
    activity: [
      {
        id: "act-4",
        kind: "submitted",
        text: "Ada Okafor submitted the request",
        by: customer.name,
        at: iso(now, -6 * day),
      },
      {
        id: "act-5",
        kind: "assigned",
        text: `${admin.name} assigned ${kemi.name}`,
        by: admin.name,
        at: iso(now, -6 * day + hour),
      },
      {
        id: "act-6",
        kind: "approved",
        text: `${admin.name} approved: Tunde Bakare, ₦480,000`,
        by: admin.name,
        at: iso(now, -4 * day),
      },
    ],
  }

  const denied: V1Request = {
    ...base,
    id: "XPR-00104",
    version: 3,
    service: "Waste management",
    title: "Site clearance after demolition",
    description:
      "Clear and haul away demolition waste from a half-acre plot, including two skips of rubble and some metal scrap.",
    location: "Ibadan",
    address: "Plot 9, Ring Road, Ibadan",
    phone: customer.phone,
    contactMethod: "phone",
    budgetKobo: 20_000_000,
    preferredDate: dateOnly(now, 5),
    status: "denied",
    assignee: null,
    createdAt: iso(now, -9 * day),
    decision: {
      status: "denied",
      reason:
        "The site is outside the areas Xpro currently serves. Choose a supported Lagos location and submit a new request.",
      by: admin,
      at: iso(now, -8 * day),
    },
    activity: [
      {
        id: "act-7",
        kind: "submitted",
        text: "Ada Okafor submitted the request",
        by: customer.name,
        at: iso(now, -9 * day),
      },
      {
        id: "act-8",
        kind: "denied",
        text: `${admin.name} denied the request`,
        by: admin.name,
        at: iso(now, -8 * day),
        note: "The site is outside the areas Xpro currently serves.",
      },
    ],
  }

  const text = (
    id: string,
    requestId: string,
    author: { id: string; role: V1Message["authorRole"]; label: string },
    body: string,
    offsetMs: number,
  ): V1Message => ({
    id,
    requestId,
    kind: "text",
    authorId: author.id,
    authorRole: author.role,
    authorLabel: author.label,
    text: body,
    attachments: [],
    createdAt: iso(now, offsetMs),
  })

  const card = (
    id: string,
    counterId: string,
    requestId: string,
    author: { id: string; role: V1Message["authorRole"]; label: string },
    amountKobo: number,
    date: string,
    note: string,
    offsetMs: number,
    supersededBy: string | null,
  ): V1Message => ({
    id,
    requestId,
    kind: "counter",
    authorId: author.id,
    authorRole: author.role,
    authorLabel: author.label,
    text: "",
    attachments: [],
    createdAt: iso(now, offsetMs),
    counter: { id: counterId, amountKobo, date, note, supersededBy },
  })

  const customerAuthor = { id: customer.id, role: "customer" as const, label: customer.name }
  const kemiAuthor = { id: kemi.id, role: "staff" as const, label: kemi.name }
  const adminAuthor = { id: admin.id, role: "admin" as const, label: admin.name }

  const messages: V1Message[] = [
    text(
      "msg-1",
      "XPR-00102",
      customerAuthor,
      "Can the tiling start the week after next? The office is closed on weekends.",
      -2 * day + 2 * hour,
    ),
    text(
      "msg-2",
      "XPR-00102",
      kemiAuthor,
      "Hi Ada, yes we can. Let me price it with the weekend schedule.",
      -2 * day + 3 * hour,
    ),
    card(
      "msg-3",
      "ctr-1",
      "XPR-00102",
      kemiAuthor,
      65_000_000,
      dateOnly(now, 10),
      "Includes lifting old tiles and levelling the screed.",
      -2 * day + 4 * hour,
      "ctr-2",
    ),
    card(
      "msg-4",
      "ctr-2",
      "XPR-00102",
      customerAuthor,
      58_000_000,
      dateOnly(now, 10),
      "My budget is closer to this. Can we do weekends only?",
      -day,
      "ctr-3",
    ),
    card(
      "msg-5",
      "ctr-3",
      "XPR-00102",
      kemiAuthor,
      62_000_000,
      dateOnly(now, 12),
      "Weekend work adds two days. This is our best price.",
      -day + 3 * hour,
      null,
    ),
    text(
      "msg-6",
      "XPR-00103",
      customerAuthor,
      "Attached are the drawings for the generator house.",
      -6 * day + 2 * hour,
    ),
    card(
      "msg-7",
      "ctr-4",
      "XPR-00103",
      adminAuthor,
      48_000_000,
      dateOnly(now, 9),
      "Materials and labour included.",
      -5 * day,
      null,
    ),
    text("msg-8", "XPR-00103", customerAuthor, "That works for us. Thank you.", -5 * day + 2 * hour),
  ]

  return {
    schema: mockSchema,
    nextRequest: 105,
    nextMessage: 9,
    nextActivity: 9,
    requests: [unassigned, negotiating, approved, denied],
    messages,
    providers: createProviders(),
    staff: createStaff(),
  }
}
