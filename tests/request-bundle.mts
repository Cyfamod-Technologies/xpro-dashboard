import assert from 'node:assert/strict'
import type { PublicQuestion, PublicServiceNode } from '@/features/catalog/types.ts'
import { readMigratedDraft, wrapDraft } from '@/features/drafts/draft-envelope.ts'
import {
  DUPLICATE_SERVICE_MESSAGE,
  MAX_SERVICES_PER_SUBMISSION,
  REQUEST_DRAFT_VERSION,
  addServiceHint,
  allowanceBlockMessage,
  allowanceFrom,
  allowanceInfo,
  buildSubmission,
  canAddService,
  canRemoveService,
  cardsFromDraft,
  duplicateCardKeys,
  isCardComplete,
  migrateRequestDraft,
  newServiceCard,
  readRequestDraft,
  resolveService,
  serviceCap,
  serviceLimitHint,
  splitServiceErrors,
  toServiceDraft,
} from '@/features/discovery/request-bundle.ts'
import type { RequestDraft, ServiceCardState } from '@/features/discovery/request-bundle.ts'

const question = (id: string, type: PublicQuestion['type'], required = false): PublicQuestion => ({
  id,
  key: id,
  label: id,
  helpText: null,
  type,
  required,
  options: type === 'single_choice' ? [{ id: 'opt-a', label: 'A' }] : [],
  config: {},
  dateRole: null,
  sensitive: false,
  matchesSkill: false,
})

const node = (id: string, children: PublicServiceNode[] = [], questions: PublicQuestion[] = []): PublicServiceNode => ({
  id,
  name: id,
  description: null,
  icon: null,
  requiresStartDate: false,
  questions,
  children,
})

// Renovation > Painting (leaf), Renovation > Tiling (leaf); Waste (leaf, with its own questions)
const tree = [
  node('renovation', [node('painting'), node('tiling')], [question('area', 'number', true), question('notes', 'long_text')]),
  node('waste', [], [question('kind', 'single_choice', true)]),
]

const card = (key: string, selectedIds: string[], extra: Partial<ServiceCardState> = {}): ServiceCardState => ({
  ...newServiceCard(key),
  selectedIds,
  ...extra,
})

const shared = { title: 'Lekki site', cityId: 'c1', districtId: 'd1', address: '1 Admiralty Way', phone: '08031234567', contactMethod: 'phone' }

// Limit: five services at most, never fewer than one card
assert.equal(MAX_SERVICES_PER_SUBMISSION, 5)
assert.ok(canAddService(1))
assert.ok(canAddService(4))
assert.ok(!canAddService(5), 'The fifth card is the last')
assert.ok(!canAddService(7))
assert.ok(canAddService(2, 10), 'A larger server limit is honoured')
assert.ok(!canRemoveService(1), 'The last card cannot be removed')
assert.ok(canRemoveService(2))
assert.equal(serviceLimitHint(), 'You can request up to 5 services at a time.')
assert.equal(DUPLICATE_SERVICE_MESSAGE, 'Add each service once. Use the quantity field to ask for more than one.')

// Duplicate leaf: the message belongs on the second card, not the first
const first = card('a', ['renovation', 'painting'])
const second = card('b', ['renovation', 'painting'])
const third = card('c', ['renovation', 'tiling'])
const half = card('d', ['renovation'])
const half2 = card('e', ['renovation'])

assert.deepEqual([...duplicateCardKeys([first, second, third], tree)], ['b'])
assert.deepEqual([...duplicateCardKeys([first, third], tree)], [], 'Two different leaves are fine')
assert.deepEqual([...duplicateCardKeys([half, half2], tree)], [], 'Cards without a leaf yet are not duplicates')
assert.deepEqual([...duplicateCardKeys([first, second, card('f', ['renovation', 'painting'])], tree)], ['b', 'f'])
assert.deepEqual([...duplicateCardKeys([card('g', ['waste']), card('h', ['waste'])], tree)], ['h'], 'A top-level leaf counts too')

// A card is complete only with a leaf, its required answers and a 20 character brief
const brief = 'Repaint two bedrooms and the hallway.'

assert.ok(isCardComplete(card('a', ['renovation', 'painting'], { answers: { area: '20' }, description: brief }), tree))
assert.ok(!isCardComplete(card('a', ['renovation', 'painting'], { description: brief }), tree), 'Required answer missing')
assert.ok(!isCardComplete(card('a', ['renovation'], { answers: { area: '20' }, description: brief }), tree), 'No leaf yet')
assert.ok(!isCardComplete(card('a', ['renovation', 'painting'], { answers: { area: '20' }, description: 'Too short' }), tree))

// Resolving a card: leaf id, typed answers, kobo budget, empty start date left out
const painting = resolveService(
  card('a', ['renovation', 'painting'], { answers: { area: '20', notes: '  South facing  ', junk: 'x' }, description: brief, budget: 150000.5 }),
  tree,
)

assert.deepEqual(painting, {
  serviceId: 'painting',
  answers: { area: 20, notes: 'South facing' },
  description: brief,
  budget: 15000050,
  startDate: undefined,
})
assert.equal(resolveService(card('a', ['renovation']), tree), null, 'No leaf, nothing to send')
assert.equal(resolveService(card('a', []), tree)?.budget, undefined)
assert.equal(resolveService(card('a', ['waste'], { budget: 0 }), tree)?.budget, 0, 'No budget stays zero')
assert.equal(resolveService(card('a', ['waste'], { startDate: '2026-12-01' }), tree)?.startDate, '2026-12-01')

// One service: the single create shape with that card's files, no group fields
const wasteService = resolveService(card('w', ['waste'], { answers: { kind: 'opt-a' }, description: brief }), tree)

assert.ok(painting && wasteService)

const single = buildSubmission(shared, [{ service: wasteService, attachments: [{ id: 'own-1' }] }])

assert.equal(single.kind, 'single')
assert.deepEqual(single.body, {
  ...shared,
  serviceId: 'waste',
  description: brief,
  budget: 0,
  answers: { kind: 'opt-a' },
  attachments: [{ id: 'own-1' }],
})
assert.ok(!('startDate' in single.body), 'startDate is left out when empty')
assert.ok(!('services' in single.body))

// Several services: each card's files on its own service, never a top-level attachments (MS-8)
const dated = { ...painting, startDate: '2026-12-01' }
const group = buildSubmission(shared, [
  { service: dated, attachments: [] },
  { service: wasteService, attachments: [{ id: 'own-2' }] },
])

assert.equal(group.kind, 'group')
assert.deepEqual(group.body, {
  ...shared,
  services: [
    { serviceId: 'painting', answers: { area: 20, notes: 'South facing' }, description: brief, budget: 15000050, startDate: '2026-12-01' },
    { serviceId: 'waste', answers: { kind: 'opt-a' }, description: brief, budget: 0, attachments: [{ id: 'own-2' }] },
  ],
})
assert.ok('services' in group.body && !('startDate' in group.body.services[1]), 'startDate omitted when empty')
assert.ok('services' in group.body && !('attachments' in group.body.services[0]), 'No empty attachments list on a service')
assert.ok(!('serviceId' in group.body), 'The bundle body has no top-level service')
assert.ok(!('attachments' in group.body), 'The bundle body has no top-level attachments')
assert.ok(!JSON.stringify(group.body).includes('shared-1'))

// Open-request allowance (MS-6): the cap on cards, the messages, and when submit is blocked
const pending = (openCount: number, limit: number) => ({ hasPending: openCount > 0, openCount, limit, remaining: Math.max(0, limit - openCount) })
const allowance = (openCount: number, limit: number) => allowanceFrom(pending(openCount, limit))

assert.deepEqual(allowanceFrom(pending(1, 3)), { open: 1, limit: 3, remaining: 2 })
assert.equal(allowanceFrom({ hasPending: true, requestId: 'XPR-1' }), null, 'An older response without the allowance is unknown')
assert.equal(allowanceFrom(undefined), null)
assert.equal(allowanceFrom({ openCount: '1', limit: 3, remaining: 2 }), null)
assert.equal(allowanceFrom({ openCount: 5, limit: 3, remaining: -2 })?.remaining, 0, 'Never below zero')

assert.equal(serviceCap(null), 5, 'Unknown allowance: the per-submission maximum')
assert.equal(serviceCap(allowance(0, 3)), 3)
assert.equal(serviceCap(allowance(0, 20)), 5, 'Never above the per-submission maximum')
assert.equal(serviceCap(allowance(2, 3)), 1)
assert.equal(serviceCap(allowance(3, 3)), 0)
assert.equal(serviceCap(allowance(0, 20), 3), 3, 'A lower server maximum wins')
assert.ok(!canAddService(1, serviceCap(allowance(2, 3))), 'One request left: no second card')
assert.ok(canAddService(1, serviceCap(allowance(1, 3))))
assert.ok(!canAddService(2, serviceCap(allowance(1, 3))))

// remaining = 0: the exact server messages
assert.equal(
  allowanceBlockMessage(allowance(1, 1), 1),
  'You already have an open request. Wait for it to finish, or cancel it, before sending another.',
)
assert.equal(
  allowanceBlockMessage(allowance(3, 3), 1),
  'You already have 3 open requests, the most XPro allows at a time. Wait for one to finish, or cancel one, before sending another.',
)
assert.equal(
  allowanceBlockMessage(allowance(4, 3), 2),
  'You already have 4 open requests, the most XPro allows at a time. Wait for one to finish, or cancel one, before sending another.',
  'Over the limit counts as none left',
)

// 0 < remaining < cards (for example a restored draft): how many services to remove
assert.equal(
  allowanceBlockMessage(allowance(2, 3), 3),
  'You can have 3 open requests at a time and you have 2. Remove 2 services from this submission, or finish an open request first.',
)
assert.equal(
  allowanceBlockMessage(allowance(0, 1), 2),
  'You can have 1 open request at a time and you have 0. Remove 1 service from this submission, or finish an open request first.',
  'Limit 1 reads "request"',
)
assert.equal(
  allowanceBlockMessage(allowance(2, 5), 4),
  'You can have 5 open requests at a time and you have 2. Remove 1 service from this submission, or finish an open request first.',
)

// Submit is blocked exactly when there is a message
assert.equal(allowanceBlockMessage(allowance(2, 3), 1), '', 'One card fits the one left')
assert.equal(allowanceBlockMessage(allowance(1, 3), 2), '', 'Two cards fit the two left')
assert.equal(allowanceBlockMessage(allowance(0, 3), 3), '')
assert.equal(allowanceBlockMessage(null, 5), '', 'Unknown allowance: the server decides')

// Hint and info line only speak when the allowance is below the per-submission maximum
assert.equal(addServiceHint(null), 'You can request up to 5 services at a time.')
assert.equal(addServiceHint(allowance(0, 20)), 'You can request up to 5 services at a time.')
assert.equal(addServiceHint(allowance(2, 3)), 'You can send 1 request right now.')
assert.equal(addServiceHint(allowance(1, 3)), 'You can send 2 requests right now.')
assert.equal(allowanceInfo(null), '')
assert.equal(allowanceInfo(allowance(0, 20)), '')
assert.equal(allowanceInfo(allowance(0, 5)), '')
assert.equal(allowanceInfo(allowance(3, 3)), '', 'None left: the warning alert speaks instead')
assert.equal(allowanceInfo(allowance(1, 3)), 'You have 1 of 3 open requests, so you can send 2 more right now.')

// Error paths: services[i] goes to card i, everything else stays general
const split = splitServiceErrors(
  [
    { field: 'services[1].description', message: 'Add at least 20 characters.' },
    { field: 'services[1].answers.area', message: 'Second message for the same card.' },
    { field: 'services[0].answers.kind', message: 'Complete kind.' },
    { field: 'title', message: 'Add a title.' },
    { field: 'services', message: 'You can request up to 5 services at a time.' },
    { field: 'services[9].description', message: 'Past the end.' },
    { field: 'services[10]', message: 'Index 10 is not index 1.' },
  ],
  3,
)

assert.deepEqual(split.byService, { 0: 'Complete kind.', 1: 'Add at least 20 characters.' })
assert.deepEqual(split.general, [
  'Add a title.',
  'You can request up to 5 services at a time.',
  'Past the end.',
  'Index 10 is not index 1.',
])
assert.deepEqual(splitServiceErrors({ field: 'services[0].x', message: 'no' }, 2), { byService: {}, general: [] }, 'Not a list')
assert.deepEqual(splitServiceErrors([{ path: 'services.2.description', message: 'Dot path.' }], 3).byService, { 2: 'Dot path.' })
assert.deepEqual(splitServiceErrors([{ field: 'services[0].x' }, 'Plain text'], 2), { byService: {}, general: ['Plain text'] })

// Draft: a v1 draft (one service) becomes a list of one
assert.equal(REQUEST_DRAFT_VERSION, 2)

const oldDraft = {
  title: 'Fix the roof',
  address: '1 Admiralty Way',
  phone: '08031234567',
  contactMethod: 'email',
  description: brief,
  budget: 250000,
  startDate: '2026-12-01',
  city: 'Lagos',
  service: 'Design',
  details: { size: '3 bed' },
  selectedIds: ['renovation', 'painting'],
  answers: { area: '20' },
  cityId: 'c1',
  districtId: 'd1',
  submitKey: 'key-1',
}
const migrated = migrateRequestDraft(oldDraft, 1)

assert.ok(migrated)
assert.deepEqual(migrated.services, [
  { selectedIds: ['renovation', 'painting'], answers: { area: '20' }, description: brief, budget: 250000, startDate: '2026-12-01' },
])
assert.equal(migrated.title, 'Fix the roof')
assert.equal(migrated.contactMethod, 'email')
assert.equal(migrated.cityId, 'c1')
assert.equal(migrated.submitKey, 'key-1')
assert.deepEqual(migrated.details, { size: '3 bed' })
assert.equal(migrateRequestDraft(oldDraft, 3), null, 'Unknown versions are dropped')
assert.equal(migrateRequestDraft('nope', 1), null)
assert.equal(migrateRequestDraft(null, 1), null)
assert.equal(migrateRequestDraft({}, 1)?.services.length, 1, 'An empty old draft still gives one blank service')

// The migration runs when the stored v1 envelope is read, and a current draft is left alone
const now = Date.UTC(2026, 9, 30, 12)
const legacy = { versions: [1], migrate: migrateRequestDraft }
const fromV1 = readMigratedDraft<RequestDraft>(JSON.stringify(wrapDraft(oldDraft, 1, now)), 2, legacy, now + 1000)

assert.equal(fromV1?.v, 2)
assert.equal(fromV1?.savedAt, now, 'The save time is kept')
assert.equal(fromV1?.data.services.length, 1)
assert.equal(readMigratedDraft(JSON.stringify(wrapDraft(oldDraft, 1, now)), 2, undefined, now), null, 'No migration, no draft')
assert.equal(readMigratedDraft(JSON.stringify(wrapDraft(oldDraft, 1, now + 1)), 2, legacy, now + 14 * 86_400_000 + 2), null, 'Expired')
assert.equal(readMigratedDraft(JSON.stringify(wrapDraft(oldDraft, 5, now)), 2, legacy, now), null, 'Unknown version')

const current = readMigratedDraft<RequestDraft>(JSON.stringify(wrapDraft(migrated, 2, now)), 2, legacy, now)

assert.deepEqual(current?.data, migrated)

// Draft round trip: cards -> draft -> JSON -> cards
const cards = [
  card('a', ['renovation', 'painting'], { answers: { area: '20' }, description: brief, budget: 1000, startDate: '2026-12-01' }),
  card('b', ['waste'], { answers: { kind: 'opt-a' }, description: 'Clear the compound after work.' }),
]
const saved: RequestDraft = { ...migrated, services: cards.map(toServiceDraft) }
const reloaded = readRequestDraft(JSON.parse(JSON.stringify(saved)))

assert.deepEqual(reloaded, saved)
assert.ok(!('attachments' in saved) && !('files' in saved), 'No shared file slot in the draft')
assert.ok(saved.services.every(service => !('files' in service) && !('attachments' in service)), 'Files are stored apart, per card')

let counter = 0
const restored = cardsFromDraft(reloaded?.services ?? [], tree, () => `k${++counter}`)

assert.deepEqual(
  restored.map(({ key, ...rest }) => ({ key, ...rest })),
  [
    { ...cards[0], key: 'k1' },
    { ...cards[1], key: 'k2' },
  ],
)

// A restored card drops what the catalogue no longer has
const stale = cardsFromDraft(
  [{ selectedIds: ['renovation', 'gone'], answers: { area: '5', ghost: 'x' }, description: '', budget: 0, startDate: '' }],
  tree,
)

assert.deepEqual(stale[0].selectedIds, ['renovation'])
assert.deepEqual(stale[0].answers, { area: '5' })

// A damaged draft still restores to at least one card, and never more than the limit
assert.equal(readRequestDraft({ title: 'x' })?.services.length, 1)
assert.equal(readRequestDraft({ services: 'nope' })?.services.length, 1)
assert.equal(readRequestDraft({ services: Array.from({ length: 9 }, () => ({})) })?.services.length, 5)
assert.equal(readRequestDraft(null), null)
assert.equal(cardsFromDraft([], tree).length, 1)
assert.equal(readRequestDraft({})?.contactMethod, 'phone')

console.log('PASS: request bundle (limit, allowance, duplicate leaf, single vs group body without top-level attachments, kobo, startDate, error paths, draft migration and round trip)')
