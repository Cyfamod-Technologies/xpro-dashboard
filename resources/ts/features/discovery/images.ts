import type { ServiceLine } from '@/features/operations/types'

/** Demo-only AI-generated scenes in /public/images/generated. Replace with real XPro project photos before launch. */
const BASE = '/images/generated'

const SERVICE_COVERS: Record<ServiceLine, { file: string; alt: string }> = {
  'Design': { file: 'design', alt: 'Architectural drawings and a laptop on a desk' },
  'Construction': { file: 'construction', alt: 'Floor tiling in progress' },
  'Hire': { file: 'hire', alt: 'Excavator and concrete mixer on a site' },
  'Procurement': { file: 'procurement', alt: 'Cement bags and iron rods delivered to site' },
  'Facility management': { file: 'facility-management', alt: 'Technician servicing an air conditioner' },
  'Waste management': { file: 'waste-management', alt: 'Loader clearing construction debris' },
}

const PROVIDER_COVERS: ReadonlyMap<string, string> = new Map([
  ['provider-nneka', 'Residential building site'],
  ['provider-aisha', 'Building materials yard'],
])

interface CoverProvider { id: string; services: ServiceLine[] }

export const serviceCoverImage = (service: ServiceLine): string => `${BASE}/services/${SERVICE_COVERS[service].file}.jpg`

export const serviceCoverAlt = (service: ServiceLine): string => SERVICE_COVERS[service].alt

export function providerCoverImage(provider: CoverProvider): string {
  if (PROVIDER_COVERS.has(provider.id))
    return `${BASE}/providers/${provider.id}.jpg`

  return serviceCoverImage(provider.services[0] ?? 'Construction')
}

/** Meaningful alt text such as "Residential building site — Nneka Services". */
export function providerCoverAlt(provider: CoverProvider & { name: string }): string {
  const subject = PROVIDER_COVERS.get(provider.id) ?? serviceCoverAlt(provider.services[0] ?? 'Construction')

  return `${subject} — ${provider.name}`
}

interface JobCover { path: string; alt: string }

/** Per-job covers, keyed by service line then by the job `name` in popular-jobs.ts. A missing entry falls back to the service cover. */
const JOB_COVERS: Record<ServiceLine, Record<string, JobCover>> = {
  'Design': {
    'Architectural plans': { path: 'services/design.jpg', alt: 'Architectural drawings and a laptop on a desk' },
    'Structural plans': { path: 'jobs/design-structural-plans.jpg', alt: 'Engineering drawings on a site office table overlooking a building under construction' },
    'Interior design': { path: 'jobs/design-interior-design.jpg', alt: 'Styled living room interior with furnishing samples' },
    'Design and build': { path: 'jobs/design-design-and-build.jpg', alt: 'Completed modern two-storey house with a landscaped front yard' },
  },
  'Construction': {
    'Floor tiling': { path: 'services/construction.jpg', alt: 'Floor tiling in progress' },
    'POP ceiling': { path: 'jobs/construction-pop-ceiling.jpg', alt: 'Plaster of Paris ceiling with recessed profile lighting' },
    'Painting': { path: 'jobs/construction-painting.jpg', alt: 'Painter rolling paint onto an interior wall' },
    'Roofing & waterproofing': { path: 'jobs/construction-roofing-waterproofing.jpg', alt: 'Roofers finishing a dark grey metal roof on a modern house' },
  },
  'Hire': {
    'Electrician': { path: 'jobs/hire-electrician.jpg', alt: 'Electrician wiring a distribution panel' },
    'Plumber': { path: 'jobs/hire-plumber.jpg', alt: 'Plumber fitting pipework under a sink' },
    'Site engineer': { path: 'jobs/hire-site-engineer.jpg', alt: 'Site engineer in a hard hat reviewing plans on site' },
    'Excavator hire': { path: 'services/hire.jpg', alt: 'Excavator and concrete mixer on a site' },
  },
  'Procurement': {
    'Tiles and flooring': { path: 'jobs/procurement-tiles-and-flooring.jpg', alt: 'Stacks of floor and wall tiles in a showroom' },
    'Cement and blocks': { path: 'services/procurement.jpg', alt: 'Cement bags and iron rods delivered to site' },
    'Paint and finishes': { path: 'jobs/procurement-paint-and-finishes.jpg', alt: 'Paint buckets and finishing supplies on shelves' },
    'Plumbing and electrical fittings': { path: 'jobs/procurement-plumbing-and-electrical-fittings.jpg', alt: 'Pipes, cables, switches and sanitary fittings laid out' },
  },
  'Facility management': {
    'Routine maintenance': { path: 'jobs/facility-routine-maintenance.jpg', alt: 'Maintenance staff inspecting a building' },
    'Cleaning and janitorial': { path: 'jobs/facility-cleaning-and-janitorial.jpg', alt: 'Cleaner mopping an office lobby' },
    'Repairs': { path: 'jobs/facility-repairs.jpg', alt: 'Artisan repairing a door hinge with a cordless drill' },
    'Generator and HVAC servicing': { path: 'services/facility-management.jpg', alt: 'Technician servicing an air conditioner' },
  },
  'Waste management': {
    'Construction debris removal': { path: 'services/waste-management.jpg', alt: 'Loader clearing construction debris' },
    'Site clearance': { path: 'jobs/waste-site-clearance.jpg', alt: 'Bulldozer clearing bush on a building plot' },
    'Commercial waste collection': { path: 'jobs/waste-commercial-waste-collection.jpg', alt: 'Waste truck collecting bins outside commercial premises' },

    // TODO: jobs/waste-residential-waste-collection.jpg once generated
    'Residential waste collection': { path: 'services/waste-management.jpg', alt: 'Loader clearing construction debris' },
  },
}

export const jobCoverImage = (service: ServiceLine, jobName: string): string => {
  const cover = JOB_COVERS[service][jobName]

  return cover ? `${BASE}/${cover.path}` : serviceCoverImage(service)
}

export const jobCoverAlt = (service: ServiceLine, jobName: string): string =>
  JOB_COVERS[service][jobName]?.alt ?? `${serviceCoverAlt(service)} — ${jobName}`
