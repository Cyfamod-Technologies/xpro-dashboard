import assert from 'node:assert/strict'
import type { PublicServiceNode } from '@/features/catalog/types.ts'
import { catalogIdsFromNames, leafIdsOf, skillOptionsForRoot, visibleNodeIds } from '@/features/catalog/types.ts'
import { serviceNameCandidates, staticServiceName } from '@/features/discovery/service-aliases.ts'

const node = (id: string, name: string, children: PublicServiceNode[] = []): PublicServiceNode => ({
  id,
  name,
  description: null,
  requiresStartDate: false,
  questions: [
    {
      id: `${id}-q`,
      key: 'q',
      label: 'A question',
      helpText: null,
      type: 'single_choice',
      required: false,
      options: [{ id: `${id}-o`, label: 'An option' }],
      config: {},
      dateRole: null,
      sensitive: false,
      matchesSkill: true,
    },
  ],
  children,
})

const tiling = node('tiling', 'Tiling')
const construction = node('construction', 'Construction', [
  node('floor', 'Floor Finishing', [tiling, node('screed', 'Screed')]),
  node('roof', 'Roofing'),
])
const hiring = node('hiring', 'Hiring', [node('pro', 'Professionals', [node('architect', 'Architect')])])
const design = node('design', 'Design')

// Skills are the leaves at depth 1 or deeper, labelled with their parent below the top level, never question options.
assert.deepEqual(skillOptionsForRoot(construction), [
  { id: 'tiling', label: 'Tiling · Floor Finishing' },
  { id: 'screed', label: 'Screed · Floor Finishing' },
  { id: 'roof', label: 'Roofing' },
])
assert.deepEqual(skillOptionsForRoot(hiring), [{ id: 'architect', label: 'Architect · Professionals' }])
assert.deepEqual(skillOptionsForRoot(design), [])
assert.deepEqual(leafIdsOf(construction), ['tiling', 'screed', 'roof'])
assert.deepEqual(leafIdsOf(design), ['design'])

// Search keeps a match's ancestors, and shows everything below a matching group.
assert.equal(visibleNodeIds([construction], '  '), null)
assert.deepEqual([...visibleNodeIds([construction], 'tiling')!].sort(), ['construction', 'floor', 'tiling'])
assert.deepEqual([...visibleNodeIds([construction], 'floor')!].sort(), ['construction', 'floor', 'screed', 'tiling'])
assert.deepEqual([...visibleNodeIds([construction, hiring], 'nothing')!], [])

// Stored names find ids, including a root stored under its old name.
const ids = catalogIdsFromNames([construction, hiring], ['Construction', 'Hire'], { Hire: ['Architect'], Construction: ['Tiling'] })
assert.deepEqual(ids.serviceIds, ['construction', 'hiring'])
assert.deepEqual(ids.skillIds, { hiring: ['architect'], construction: ['tiling'] })

assert.equal(staticServiceName('Hiring'), 'Hire')
assert.equal(staticServiceName('Design'), 'Design')
assert.deepEqual(serviceNameCandidates('Facility management'), ['Facility management', 'Facility Management'])
assert.deepEqual(serviceNameCandidates('Design'), ['Design'])

console.log('catalog skills ok')
