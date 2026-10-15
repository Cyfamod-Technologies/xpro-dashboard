import type {
  BankAccount,
  OperationsState,
  ProviderProfile,
  RequestStatus,
  ServiceLine,
  ServiceRequest,
  StaffMember,
  WorkingHours,
} from "@/features/operations/types"
import { defaultAssignmentSettings, serviceSkills } from "@/features/operations/types"

const ago = (days: number) => new Date(Date.now() - days * 86400000).toISOString()
const sampleFile = { id: "sample-drawing", name: "Site-brief.pdf", size: 240000, type: "application/pdf" }
const bankAccount = (
  bankCode: string,
  bankName: string,
  accountNumber: string,
  accountName: string,
  submittedAt: string,
): BankAccount => ({ bankCode, bankName, accountNumber, accountName, submittedAt })
const approvedReview = (at: string) => ({ state: "approved" as const, by: "usr-finance", note: "", at })
const pendingReview = () => ({ state: "pending" as const, by: "", note: "", at: "" })

/** Weekly hours: Monday to Friday 08:00-17:00, Saturday 09:00-14:00 when worked, Sunday off. */
const week = (saturday = true): WorkingHours => {
  const weekday = { start: "08:00", end: "17:00" }

  return {
    mon: weekday,
    tue: { ...weekday },
    wed: { ...weekday },
    thu: { ...weekday },
    fri: { ...weekday },
    sat: saturday ? { start: "09:00", end: "14:00" } : null,
    sun: null,
  }
}

export function createOperationsState(): OperationsState {
  const profiles: ProviderProfile[] = [
    {
      id: "usr-provider",
      name: "Tunde Bakare",
      email: "provider@xpro.test",
      phone: "0800 000 0001",
      trade: "Construction professional",
      city: "Abuja",
      services: ["Design", "Construction", "Hire"],
      serviceAreas: ["Abuja", "Maitama", "Wuse II"],
      skills: {
        Design: ["Architectural plan", "Interior design"],
        Construction: ["Floor finishing", "Wall finishing"],
        Hire: ["Builder", "Site engineer"],
      },
      capacity: 3,
      lastOfferedAt: "",
      workingHours: week(false),
      timeOff: [],
      experience: 8,
      bio: "Residential construction, finishing and design support across Abuja.",
      rating: 4.8,
      reviewCount: 64,
      portfolio: [],
      available: true,
      verification: "changes_requested",
      documents: [{ ...sampleFile, id: "provider-doc", name: "Trade-certificate.pdf" }],
      reviewNote: "Please add an identity document before we approve your profile.",
      history: [{ status: "changes_requested", note: "Identity document required.", createdAt: ago(1) }],
      photo: null,
      pendingChanges: null,
      changesReview: null,
      payout: { current: null, pending: null, review: null, history: [] },
    },
    {
      id: "provider-nneka",
      name: "Nneka Services",
      email: "nneka@example.test",
      phone: "0800 000 0002",
      trade: "Building and property services",
      city: "Abuja",
      services: ["Design", "Construction", "Hire", "Facility management", "Waste management"],
      serviceAreas: ["Abuja", "Asokoro", "Maitama", "Wuse II", "Garki"],
      skills: {
        Design: [...serviceSkills.Design],
        Construction: [...serviceSkills.Construction],
        Hire: [
          "Architect",
          "Civil/structural engineer",
          "Site engineer",
          "Builder",
          "Interior designer",
          "Excavator",
          "Tipper truck",
        ],
        "Facility management": [...serviceSkills["Facility management"]],
        "Waste management": [...serviceSkills["Waste management"]],
      },
      capacity: 4,
      lastOfferedAt: ago(1),
      workingHours: week(),
      timeOff: [],
      experience: 12,
      bio: "Architectural design, residential finishes and property maintenance across Abuja. Our team also coordinates equipment hire and construction debris collection.",
      rating: 4.8,
      reviewCount: 64,
      portfolio: [
        { id: "nneka-portfolio", name: "Residential-project-portfolio.pdf", size: 360000, type: "application/pdf" },
      ],
      available: true,
      verification: "approved",
      documents: [{ ...sampleFile, id: "nneka-doc", name: "Verification-pack.pdf" }],
      reviewNote: "Documents reviewed and approved.",
      history: [{ status: "approved", note: "Approved for dispatch.", createdAt: ago(5) }],
      photo: { id: "nneka-photo", name: "Nneka-photo.jpg", size: 80000, type: "image/jpeg" },
      pendingChanges: null,
      changesReview: null,
      payout: {
        current: bankAccount("058", "Guaranty Trust Bank", "0123456789", "NNEKA SERVICES LTD", ago(5)),
        pending: null,
        review: approvedReview(ago(5)),
        history: [
          { action: "Bank details approved", by: "Ngozi Eze", byId: "usr-finance", note: "", createdAt: ago(5) },
        ],
      },
    },
    {
      id: "provider-ibrahim",
      name: "Ibrahim Supplies",
      email: "ibrahim@example.test",
      phone: "0800 000 0003",
      trade: "Building material supply",
      city: "Abuja",
      services: ["Procurement"],
      serviceAreas: ["Abuja", "Jabi", "Wuse II"],
      skills: { Procurement: ["Cement and blocks", "Iron rods and steel", "Sand and granite"] },
      capacity: 3,
      lastOfferedAt: "",
      workingHours: week(),
      timeOff: [],
      experience: 10,
      bio: "Materials and fittings delivered to site.",
      rating: 4.8,
      reviewCount: 64,
      portfolio: [],
      available: true,
      verification: "pending",
      documents: [{ ...sampleFile, id: "ibrahim-doc", name: "Business-registration.pdf" }],
      reviewNote: "",
      history: [{ status: "pending", note: "Submitted for review.", createdAt: ago(1) }],
      photo: { id: "ibrahim-photo", name: "Ibrahim-photo.jpg", size: 80000, type: "image/jpeg" },
      pendingChanges: null,
      changesReview: null,
      payout: {
        current: null,
        pending: bankAccount("057", "Zenith Bank", "2034567891", "IBRAHIM SUPPLIES", ago(1)),
        review: pendingReview(),
        history: [
          {
            action: "Bank details submitted",
            by: "Ibrahim Supplies",
            byId: "provider-ibrahim",
            note: "",
            createdAt: ago(1),
          },
        ],
      },
    },
    {
      id: "provider-aisha",
      name: "Aisha Material Supply",
      email: "aisha@example.test",
      phone: "0800 000 0004",
      trade: "Materials and fittings supplier",
      city: "Lagos",
      services: ["Procurement"],
      serviceAreas: ["Lagos", "Ikeja", "Lekki"],
      skills: { Procurement: ["Tiles and flooring", "Paint and finishes", "Plumbing and electrical fittings"] },
      capacity: 3,
      lastOfferedAt: ago(9),
      workingHours: week(false),
      timeOff: [],
      experience: 7,
      bio: "Building materials and fittings sourced and delivered to your site.",
      rating: 4.7,
      reviewCount: 32,
      portfolio: [],
      available: true,
      verification: "approved",
      documents: [],
      reviewNote: "Verified supplier.",
      history: [],
      photo: { id: "aisha-photo", name: "Aisha-photo.jpg", size: 80000, type: "image/jpeg" },
      pendingChanges: null,
      changesReview: null,
      payout: {
        current: bankAccount("044", "Access Bank", "0690000031", "AISHA MATERIAL SUPPLY", ago(20)),
        pending: bankAccount("033", "United Bank for Africa", "2109876543", "AISHA MATERIAL SUPPLY", ago(0.5)),
        review: pendingReview(),
        history: [
          { action: "Bank details approved", by: "Ngozi Eze", byId: "usr-finance", note: "", createdAt: ago(20) },
          {
            action: "Bank change requested",
            by: "Aisha Material Supply",
            byId: "provider-aisha",
            note: "",
            createdAt: ago(0.5),
          },
        ],
      },
    },
    {
      id: "provider-chinedu",
      name: "Chinedu Okeke Electrical and Plumbing",
      email: "chinedu@example.test",
      phone: "0800 000 0005",
      trade: "Electrician and plumber",
      city: "Abuja",
      services: ["Hire"],
      serviceAreas: ["Abuja", "Wuse II", "Jabi", "Gwarimpa"],
      skills: { Hire: ["Electrician", "Plumber"] },
      capacity: 3,
      lastOfferedAt: ago(10),
      workingHours: week(),
      timeOff: [],
      experience: 9,
      bio: "Licensed electrician and plumber for homes, offices and building sites across central Abuja.",
      rating: 4.7,
      reviewCount: 41,
      portfolio: [],
      available: true,
      verification: "approved",
      documents: [{ ...sampleFile, id: "chinedu-doc", name: "Verification-pack.pdf" }],
      reviewNote: "Documents reviewed and approved.",
      history: [{ status: "approved", note: "Approved for dispatch.", createdAt: ago(12) }],
      photo: { id: "chinedu-photo", name: "Chinedu-photo.jpg", size: 80000, type: "image/jpeg" },
      pendingChanges: null,
      changesReview: null,
      payout: {
        current: bankAccount("044", "Access Bank", "0234567890", "CHINEDU OKEKE", ago(12)),
        pending: null,
        review: approvedReview(ago(12)),
        history: [
          { action: "Bank details approved", by: "Ngozi Eze", byId: "usr-finance", note: "", createdAt: ago(12) },
        ],
      },
    },
    {
      id: "provider-musa",
      name: "Musa Plant and Equipment Hire",
      email: "musa@example.test",
      phone: "0800 000 0006",
      trade: "Heavy equipment operator",
      city: "Abuja",
      services: ["Hire"],
      serviceAreas: ["Abuja", "Lugbe", "Kubwa"],
      skills: { Hire: ["Excavator", "Bulldozer", "Pay loader", "Heavy equipment operator"] },
      capacity: 3,
      lastOfferedAt: ago(4),
      workingHours: week(false),
      timeOff: [],
      experience: 15,
      bio: "Excavators, bulldozers and pay loaders with experienced operators for site clearing and earthworks.",
      rating: 4.6,
      reviewCount: 27,
      portfolio: [],
      available: true,
      verification: "approved",
      documents: [{ ...sampleFile, id: "musa-doc", name: "Verification-pack.pdf" }],
      reviewNote: "Documents reviewed and approved.",
      history: [{ status: "approved", note: "Approved for dispatch.", createdAt: ago(9) }],
      photo: { id: "musa-photo", name: "Musa-photo.jpg", size: 80000, type: "image/jpeg" },
      pendingChanges: null,
      changesReview: null,
      payout: {
        current: bankAccount("058", "Guaranty Trust Bank", "0345678901", "MUSA PLANT AND EQUIPMENT HIRE", ago(9)),
        pending: null,
        review: approvedReview(ago(9)),
        history: [
          { action: "Bank details approved", by: "Ngozi Eze", byId: "usr-finance", note: "", createdAt: ago(9) },
        ],
      },
    },
    {
      id: "provider-bola",
      name: "Bola Finishing Works",
      email: "bola@example.test",
      phone: "0800 000 0007",
      trade: "Floor and wall finishing",
      city: "Abuja",
      services: ["Construction"],
      serviceAreas: ["Abuja", "Asokoro", "Gwarimpa"],
      skills: { Construction: ["Floor finishing", "Wall finishing", "Final finishing"] },
      capacity: 2,
      lastOfferedAt: ago(6),
      workingHours: week(),
      timeOff: [],
      experience: 6,
      bio: "Tiling, screeding, plastering and painting crew for new builds and renovations.",
      rating: 4.5,
      reviewCount: 18,
      portfolio: [],
      available: true,
      verification: "approved",
      documents: [{ ...sampleFile, id: "bola-doc", name: "Verification-pack.pdf" }],
      reviewNote: "Documents reviewed and approved.",
      history: [{ status: "approved", note: "Approved for dispatch.", createdAt: ago(7) }],
      photo: { id: "bola-photo", name: "Bola-photo.jpg", size: 80000, type: "image/jpeg" },
      pendingChanges: null,
      changesReview: null,
      payout: {
        current: bankAccount("057", "Zenith Bank", "0456789012", "BOLA FINISHING WORKS", ago(7)),
        pending: null,
        review: approvedReview(ago(7)),
        history: [
          { action: "Bank details approved", by: "Ngozi Eze", byId: "usr-finance", note: "", createdAt: ago(7) },
        ],
      },
    },
  ]

  const descriptions: { title: string; service: ServiceLine; status: RequestStatus; address: string }[] = [
    {
      title: "Architectural plans for a family home",
      service: "Design",
      status: "submitted",
      address: "Maitama, Abuja",
    },
    {
      title: "Living room floor and wall finishing",
      service: "Construction",
      status: "in_progress",
      address: "Asokoro, Abuja",
    },
    { title: "Hire a site engineer for a survey", service: "Hire", status: "quoted", address: "Gwarimpa, Abuja" },
    {
      title: "Cement and fittings for site delivery",
      service: "Procurement",
      status: "under_review",
      address: "Jabi, Abuja",
    },
    {
      title: "Property maintenance inspection",
      service: "Facility management",
      status: "completion_pending",
      address: "Wuse II, Abuja",
    },
    {
      title: "Construction debris collection",
      service: "Waste management",
      status: "scheduled",
      address: "Lugbe, Abuja",
    },
    { title: "Completed interior design brief", service: "Design", status: "closed", address: "Garki, Abuja" },
  ]

  const requests: ServiceRequest[] = descriptions.map((row, index) => {
    const id = `XPR-${String(index + 1).padStart(5, "0")}`
    const assigned = !["submitted", "under_review"].includes(row.status)
    const accepted = !["submitted", "under_review", "quoted"].includes(row.status)
    const request: ServiceRequest = {
      ...row,
      id,
      ownerId: "usr-customer",
      customer: "Ada Okafor",
      city: "Abuja",
      phone: "0800 000 0000",
      description: "Please review the attached project brief and coordinate the service with a verified provider.",
      budget: 45000000,
      startDate: "",
      details: {},
      attachments: [{ ...sampleFile, id: `${id}-brief` }],
      createdAt: ago(index + 1),
      staffOwnerId: ["XPR-00001", "XPR-00004"].includes(id) ? "" : "usr-operations",
      claimedAt: ["XPR-00001", "XPR-00004"].includes(id) ? "" : ago(2),
      flag: "",
      assignments: [],
      contributions: [],
      quotes: [],
      schedules: [],
      updates: [],
      messages: [],
      issues: [],
      dispatch: { mode: "auto", attempts: 0, needsManual: id === "XPR-00001" },
      cancellationRequest: null,
    }
    if (assigned) {
      request.assignments.push({
        id: `${id}-assignment`,
        providerId: "provider-nneka",
        status: "accepted",
        note: "Matched to the service and location.",
        response: "Assignment accepted.",
        createdAt: ago(2),
        source: "manual",
        attempt: 1,
        score: null,
        expiresAt: ago(1),
      })
      request.quotes.push({
        id: `${id}-quote`,
        version: 1,
        status: accepted ? "accepted" : "sent",
        items: [{ description: "Service and coordination", quantity: 1, rate: 35000000 }],
        total: 35000000,
        note: "Scope follows the approved project brief.",
        createdAt: ago(2),
        responseNote: accepted ? "Accepted by customer." : "",
        approvalRequestedBy: "",
        publishedBy: "usr-pricing",
      })
    }
    if (accepted)
      request.schedules.push({
        id: `${id}-schedule`,
        startAt: row.status === "scheduled" ? new Date(Date.now() + (index + 1) * 86400000).toISOString() : ago(3),
        note: "Access details confirmed with the customer.",
        quoteId: `${id}-quote`,
        status: "confirmed",
        customer: "accepted",
        provider: "accepted",
        responses: ["Both participants confirmed."],
      })

    if (["in_progress", "completion_pending", "closed"].includes(row.status))
      request.updates.push({
        id: `${id}-update`,
        authorId: "provider-nneka",
        author: "Nneka Services",
        status: row.status,
        note:
          row.status === "completion_pending"
            ? "Inspection completed. Please review the attached service report."
            : "The team has shared a work update.",
        attachments: [{ ...sampleFile, id: `${id}-evidence`, name: "Work-report.pdf" }],
        createdAt: ago(1),
        review: { state: "approved", by: "usr-operations", note: "", at: ago(1) },
      })

    if (id === "XPR-00004")
      request.assignments.push({
        id: `${id}-assignment`,
        providerId: "provider-nneka",
        status: "pending_approval",
        note: "Matched automatically to the service, area and skills.",
        response: "Happy to take this on.",
        createdAt: ago(1),
        source: "auto",
        attempt: 1,
        score: { total: 79.5, factors: { skill: 1, area: 1, capacity: 0.5, fairness: 0.143, experience: 0.6 } },
        expiresAt: new Date(Date.now() + 23 * 3600000).toISOString(),
      })
    if (id === "XPR-00002")
      request.updates.unshift({
        id: `${id}-update-pending`,
        authorId: "provider-nneka",
        author: "Nneka Services",
        status: "in_progress",
        note: "Tiling 60% complete. Photos attached.",
        attachments: [{ ...sampleFile, id: `${id}-photos`, name: "Tiling-progress.pdf" }],
        createdAt: ago(0.25),
        review: { state: "pending", by: "", note: "", at: "" },
      })
    if (id === "XPR-00003")
      request.cancellationRequest = {
        note: "Project postponed to next quarter.",
        requestedAt: ago(0.5),
        review: { state: "pending", by: "", note: "", at: "" },
      }

    request.dispatch.attempts = request.assignments.length
    request.messages.push({
      id: `${id}-message`,
      authorId: "usr-admin",
      author: "XPro Dispatch",
      authorRole: "admin",
      channel: "customer",
      text: "We have your request. We will keep all coordination and updates here.",
      attachments: [],
      createdAt: ago(1),
    })

    return request
  })

  const staffRecord = (id: string, name: string, email: string, roles: StaffMember["roles"]): StaffMember => ({
    id,
    name,
    email,
    roles,
    status: "active",
    invitedAt: ago(30),
    history: [{ action: "Account created", by: "System", byId: "system", createdAt: ago(30) }],
  })

  const staff: StaffMember[] = [
    staffRecord("usr-admin", "Amara Okafor", "admin@xpro.test", ["super_admin"]),
    staffRecord("usr-operations", "Kemi Adebayo", "operations@xpro.test", ["operations"]),
    staffRecord("usr-pricing", "Chidi Nwosu", "pricing@xpro.test", ["pricing"]),
    staffRecord("usr-relations", "Zainab Lawal", "relations@xpro.test", ["client_relations"]),
    staffRecord("usr-finance", "Ngozi Eze", "finance@xpro.test", ["finance"]),
  ]

  return {
    schema: 6,
    nextRequest: 8,
    requests,
    providers: profiles,
    notifications: [
      {
        id: "welcome-customer",
        recipientId: "usr-customer",
        title: "Quote ready to review",
        message: "Your site engineer request has a quote ready.",
        requestId: "XPR-00003",
        createdAt: ago(1),
        read: false,
        channels: ["In-app", "Email", "Push"],
      },
      {
        id: "welcome-provider",
        recipientId: "usr-provider",
        title: "Profile changes requested",
        message: "Add an identity document to complete verification.",
        createdAt: ago(1),
        read: false,
        channels: ["In-app", "Email"],
      },
    ],
    audit: [
      {
        id: "initial-audit",
        actor: "XPro Dispatch",
        actorId: "usr-admin",
        action: "Reviewed provider verification",
        resource: "Tunde Bakare",
        note: "Identity document required.",
        createdAt: ago(1),
      },
    ],
    preferences: {},
    staff,
    settings: { quoteApprovalThreshold: null, assignment: defaultAssignmentSettings() },
  }
}
