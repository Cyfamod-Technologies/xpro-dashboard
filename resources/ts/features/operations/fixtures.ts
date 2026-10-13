import type { OperationsState, ProviderProfile, RequestStatus, ServiceLine, ServiceRequest } from '@/features/operations/types'

const ago = (days: number) => new Date(Date.now() - days * 86400000).toISOString()
const sampleFile = { id: 'sample-drawing', name: 'Site-brief.pdf', size: 240000, type: 'application/pdf' }

export function createOperationsState(): OperationsState {
  const profiles: ProviderProfile[] = [
    { id: 'usr-provider', name: 'Tunde Bakare', email: 'provider@xpro.test', phone: '0800 000 0001', trade: 'Construction professional', city: 'Abuja', services: ['Design', 'Construction', 'Hire'], experience: 8, bio: 'Residential construction, finishing and design support across Abuja.', rating: 4.8, reviewCount: 64, portfolio: [], available: true, verification: 'changes_requested', documents: [{ ...sampleFile, id: 'provider-doc', name: 'Trade-certificate.pdf' }], reviewNote: 'Please add an identity document before we approve your profile.', history: [{ status: 'changes_requested', note: 'Identity document required.', createdAt: ago(1) }] },
    { id: 'provider-nneka', name: 'Nneka Services', email: 'nneka@example.test', phone: '0800 000 0002', trade: 'Building and property services', city: 'Abuja', services: ['Design', 'Construction', 'Hire', 'Facility management', 'Waste management'], experience: 12, bio: 'Architectural design, residential finishes and property maintenance across Abuja. Our team also coordinates equipment hire and construction debris collection.', rating: 4.8, reviewCount: 64, portfolio: [{ id: 'nneka-portfolio', name: 'Residential-project-portfolio.pdf', size: 360000, type: 'application/pdf' }], available: true, verification: 'approved', documents: [{ ...sampleFile, id: 'nneka-doc', name: 'Verification-pack.pdf' }], reviewNote: 'Documents reviewed and approved.', history: [{ status: 'approved', note: 'Approved for dispatch.', createdAt: ago(5) }] },
    { id: 'provider-ibrahim', name: 'Ibrahim Supplies', email: 'ibrahim@example.test', phone: '0800 000 0003', trade: 'Building material supply', city: 'Abuja', services: ['Procurement'], experience: 10, bio: 'Materials and fittings delivered to site.', rating: 4.8, reviewCount: 64, portfolio: [], available: true, verification: 'pending', documents: [{ ...sampleFile, id: 'ibrahim-doc', name: 'Business-registration.pdf' }], reviewNote: '', history: [{ status: 'pending', note: 'Submitted for review.', createdAt: ago(1) }] },
    { id: 'provider-aisha', name: 'Aisha Material Supply', email: 'aisha@example.test', phone: '0800 000 0004', trade: 'Materials and fittings supplier', city: 'Lagos', services: ['Procurement'], experience: 7, bio: 'Building materials and fittings sourced and delivered to your site.', rating: 4.7, reviewCount: 32, portfolio: [], available: true, verification: 'approved', documents: [], reviewNote: 'Verified supplier.', history: [] },
  ]

  const descriptions: { title: string; service: ServiceLine; status: RequestStatus; address: string }[] = [
    { title: 'Architectural plans for a family home', service: 'Design', status: 'submitted', address: 'Maitama, Abuja' },
    { title: 'Living room floor and wall finishing', service: 'Construction', status: 'in_progress', address: 'Asokoro, Abuja' },
    { title: 'Hire a site engineer for a survey', service: 'Hire', status: 'quoted', address: 'Gwarimpa, Abuja' },
    { title: 'Cement and fittings for site delivery', service: 'Procurement', status: 'under_review', address: 'Jabi, Abuja' },
    { title: 'Property maintenance inspection', service: 'Facility management', status: 'completion_pending', address: 'Wuse II, Abuja' },
    { title: 'Construction debris collection', service: 'Waste management', status: 'scheduled', address: 'Lugbe, Abuja' },
    { title: 'Completed interior design brief', service: 'Design', status: 'closed', address: 'Garki, Abuja' },
  ]

  const requests: ServiceRequest[] = descriptions.map((row, index) => {
    const id = `XPR-${String(index + 1).padStart(5, '0')}`
    const assigned = !['submitted', 'under_review'].includes(row.status)
    const accepted = !['submitted', 'under_review', 'quoted'].includes(row.status)
    const request: ServiceRequest = { ...row, id, ownerId: 'usr-customer', customer: 'Ada Okafor', city: 'Abuja', phone: '0800 000 0000', description: 'Please review the attached project brief and coordinate the service with a verified provider.', budget: 45000000, startDate: '', details: {}, attachments: [{ ...sampleFile, id: `${id}-brief` }], createdAt: ago(index + 1), flag: '', assignments: [], contributions: [], quotes: [], schedules: [], updates: [], messages: [], issues: [] }
    if (assigned) {
      request.assignments.push({ id: `${id}-assignment`, providerId: 'provider-nneka', status: 'accepted', note: 'Matched to the service and location.', response: 'Assignment accepted.', createdAt: ago(2) })
      request.quotes.push({ id: `${id}-quote`, version: 1, status: accepted ? 'accepted' : 'sent', items: [{ description: 'Service and coordination', quantity: 1, rate: 350000 }], total: 35000000, note: 'Scope follows the approved project brief.', createdAt: ago(2), responseNote: accepted ? 'Accepted by customer.' : '' })
    }
    if (accepted)
      request.schedules.push({ id: `${id}-schedule`, startAt: row.status === 'scheduled' ? new Date(Date.now() + (index + 1) * 86400000).toISOString() : ago(3), note: 'Access details confirmed with the customer.', quoteId: `${id}-quote`, status: 'confirmed', customer: 'accepted', provider: 'accepted', responses: ['Both participants confirmed.'] })

    if (['in_progress', 'completion_pending', 'closed'].includes(row.status))
      request.updates.push({ id: `${id}-update`, authorId: 'provider-nneka', author: 'Nneka Services', status: row.status, note: row.status === 'completion_pending' ? 'Inspection completed. Please review the attached service report.' : 'The team has shared a work update.', attachments: [{ ...sampleFile, id: `${id}-evidence`, name: 'Work-report.pdf' }], createdAt: ago(1) })

    request.messages.push({ id: `${id}-message`, authorId: 'usr-admin', author: 'XPro Dispatch', channel: 'customer', text: 'We have your request. We will keep all coordination and updates here.', attachments: [], createdAt: ago(1) })

    return request
  })

  return { schema: 1, nextRequest: 8, requests, providers: profiles, notifications: [{ id: 'welcome-customer', recipientId: 'usr-customer', title: 'Quote ready to review', message: 'Your site engineer request has a quote ready.', requestId: 'XPR-00003', createdAt: ago(1), read: false, channels: ['In-app', 'Email', 'Push'] }, { id: 'welcome-provider', recipientId: 'usr-provider', title: 'Profile changes requested', message: 'Add an identity document to complete verification.', createdAt: ago(1), read: false, channels: ['In-app', 'Email'] }], audit: [{ id: 'initial-audit', actor: 'XPro Dispatch', action: 'Reviewed provider verification', resource: 'Tunde Bakare', createdAt: ago(1) }], preferences: {} }
}
