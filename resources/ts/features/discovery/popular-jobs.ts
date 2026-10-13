import type { ServiceLine } from '@/features/operations/types'

export interface PopularJob {
  name: string

  /** Small label on the card, for example the type of work. */
  group: string
  body: string
  icon: string

  /** Pre-fills matching intake field keys on the request form. */
  details?: Record<string, string>
}

export const popularJobs: Record<ServiceLine, PopularJob[]> = {
  'Design': [
    { name: 'Architectural plans', group: 'Architectural plan', icon: 'tabler-ruler-2', body: 'Concept to approval-ready drawings for new builds and extensions.', details: { designType: 'Architectural plan' } },
    { name: 'Structural plans', group: 'Structural plan', icon: 'tabler-building-bridge-2', body: 'Foundation, column and slab designs signed off by an engineer.', details: { designType: 'Structural plan' } },
    { name: 'Interior design', group: 'Interior design', icon: 'tabler-armchair', body: 'Layouts, finishes and furnishing plans for homes and offices.', details: { designType: 'Interior design' } },
    { name: 'Design and build', group: 'Design and build', icon: 'tabler-home-plus', body: 'One team to design your project and build it from start to finish.', details: { designType: 'Architectural plan', delivery: 'Design and build with XPro' } },
  ],
  'Construction': [
    { name: 'Floor tiling', group: 'Floor finishing', icon: 'tabler-layout-board', body: 'Porcelain, ceramic and granite tiling for floors and walls.', details: { workType: 'Floor finishing' } },
    { name: 'POP ceiling', group: 'Ceiling', icon: 'tabler-lamp', body: 'Plaster of Paris ceilings with profile lighting.', details: { workType: 'Roof and ceiling' } },
    { name: 'Painting', group: 'Wall finishing', icon: 'tabler-paint', body: 'Interior and exterior painting, screeding and plastering.', details: { workType: 'Wall finishing' } },
    { name: 'Roofing & waterproofing', group: 'Roof', icon: 'tabler-home-check', body: 'Lightweight metal roofing and EPDM waterproofing.', details: { workType: 'Roof and ceiling' } },
  ],
  'Hire': [
    { name: 'Electrician', group: 'Vocational worker', icon: 'tabler-bolt', body: 'Wiring, fittings, panel work and electrical repairs.', details: { hireType: 'Vocational worker', trade: 'Electrician' } },
    { name: 'Plumber', group: 'Vocational worker', icon: 'tabler-droplet', body: 'Pipework, fixtures, water tanks and leak repairs.', details: { hireType: 'Vocational worker', trade: 'Plumber' } },
    { name: 'Site engineer', group: 'Professional', icon: 'tabler-helmet', body: 'Supervision, setting out and quality control on site.', details: { hireType: 'Professional', trade: 'Site engineer' } },
    { name: 'Excavator hire', group: 'Heavy equipment', icon: 'tabler-tractor', body: 'Excavators and earth-moving equipment, with or without an operator.', details: { hireType: 'Heavy equipment', trade: 'Excavator' } },
  ],
  'Procurement': [
    { name: 'Tiles and flooring', group: 'Finishes', icon: 'tabler-layout-board', body: 'Floor and wall tiles delivered to your site.', details: { materials: 'Tiles and flooring' } },
    { name: 'Cement and blocks', group: 'Structure', icon: 'tabler-box', body: 'Cement, sand, blocks and iron rods in site-ready quantities.', details: { materials: 'Cement and blocks' } },
    { name: 'Paint and finishes', group: 'Finishes', icon: 'tabler-paint', body: 'Emulsion, gloss, screeding and plastering supplies.', details: { materials: 'Paint and finishes' } },
    { name: 'Plumbing and electrical fittings', group: 'Fittings', icon: 'tabler-plug', body: 'Pipes, cables, switches, sanitary ware and lighting.', details: { materials: 'Plumbing and electrical fittings' } },
  ],
  'Facility management': [
    { name: 'Routine maintenance', group: 'Property care', icon: 'tabler-home-cog', body: 'Scheduled inspections and upkeep for your building.', details: { serviceNeeds: 'Routine maintenance' } },
    { name: 'Cleaning and janitorial', group: 'Cleaning', icon: 'tabler-brush', body: 'Regular cleaning for offices, estates and homes.', details: { serviceNeeds: 'Cleaning and janitorial' } },
    { name: 'Repairs', group: 'Plumbing and electrical', icon: 'tabler-tools', body: 'Plumbing, electrical and fixture repairs by vetted artisans.', details: { serviceNeeds: 'Repairs' } },
    { name: 'Generator and HVAC servicing', group: 'Equipment', icon: 'tabler-bolt', body: 'Servicing for generators, air conditioning and pumps.', details: { serviceNeeds: 'Generator and HVAC servicing' } },
  ],
  'Waste management': [
    { name: 'Construction debris removal', group: 'Construction debris', icon: 'tabler-trash', body: 'Rubble and site debris hauled away and disposed of properly.', details: { wasteType: 'Construction debris' } },
    { name: 'Site clearance', group: 'Construction debris', icon: 'tabler-recycle', body: 'Bush clearing and plot preparation before work starts.', details: { wasteType: 'Construction debris' } },
    { name: 'Commercial waste collection', group: 'Commercial', icon: 'tabler-building-warehouse', body: 'Scheduled pickups for shops, offices and estates.', details: { wasteType: 'Commercial' } },
    { name: 'Residential waste collection', group: 'Residential', icon: 'tabler-home-2', body: 'Regular household waste collection and one-off clean-outs.', details: { wasteType: 'Residential' } },
  ],
}
