import assert from 'node:assert/strict'
import { buildReviewCycles } from '@/features/operations/review-cycles.ts'

const at = (day: number, hour = 9) => new Date(Date.UTC(2026, 9, day, hour)).toISOString()

// A first review that needs changes, is resubmitted and approved is one cycle with four steps.
const first = buildReviewCycles([
  { kind: 'profile', status: 'approved', note: 'Verified.', createdAt: at(3) },
  { kind: 'profile', status: 'submitted', note: '', createdAt: at(2) },
  { kind: 'profile', status: 'changes_requested', note: 'Clearer ID photo.', createdAt: at(1, 12) },
  { kind: 'profile', status: 'submitted', note: '', createdAt: at(1) },
])
assert.equal(first.length, 1)
assert.deepEqual(first[0].steps.map(step => step.label), ['Submitted', 'Changes requested', 'Resubmitted', 'Approved'])
assert.equal(first[0].chip, 'Approved')
assert.equal(first[0].open, false)
assert.equal(first[0].steps[1].note, 'Clearer ID photo.')

// Each held change is its own cycle; the open one carries its fields and the waiting message.
const changes = buildReviewCycles([
  { kind: 'held_change', status: 'submitted', note: '', fields: ['Service areas', 'Job capacity'], createdAt: at(31) },
  { kind: 'held_change', status: 'rejected', note: 'No certificate.', createdAt: at(29) },
  { kind: 'held_change', status: 'submitted', note: '', fields: ['Skills'], createdAt: at(28) },
  { kind: 'held_change', status: 'approved', note: '', createdAt: at(12) },
  { kind: 'held_change', status: 'submitted', note: '', fields: ['Face photo'], createdAt: at(11) },
])
assert.deepEqual(changes.map(cycle => cycle.chip), ['In review', 'Rejected', 'Approved'])
assert.deepEqual(changes[0].fields, ['Service areas', 'Job capacity'])
assert.equal(changes[0].open, true)
assert.match(changes[0].waiting, /current details stay live/)
assert.deepEqual(changes[1].fields, ['Skills'])
assert.deepEqual(changes[2].fields, ['Face photo'])

// A pending change saved before field names were recorded falls back to the live comparison.
const legacy = buildReviewCycles([{ kind: 'held_change', status: 'submitted', note: '', createdAt: at(5) }], { pendingFields: ['Trade'] })
assert.deepEqual(legacy[0].fields, ['Trade'])

// Bank decisions stand alone; a pending bank change shows as in review.
const bank = buildReviewCycles([{ kind: 'bank', status: 'approved', note: '', createdAt: at(21) }], {
  pendingBank: { label: 'GTBank ending 6789', submittedAt: at(30) },
})
assert.deepEqual(bank.map(cycle => cycle.chip), ['In review', 'Approved'])
assert.equal(bank[0].group, 'bank')
assert.deepEqual(bank[0].fields, ['GTBank ending 6789'])
assert.equal(bank[1].steps.length, 1)

// Standing and reliability events are single cards with their own labels.
const other = buildReviewCycles([
  { kind: 'standing', status: 'delisted', note: 'Two no-shows.', createdAt: at(8) },
  { kind: 'standing', status: 'reinstated', note: '', createdAt: at(9) },
  { kind: 'reliability', status: 'cleared', note: '', createdAt: at(10) },
])
assert.deepEqual(other.map(cycle => [cycle.title, cycle.chip, cycle.color]), [
  ['Reliability review', 'Cleared', 'success'],
  ['Account standing', 'Reinstated', 'success'],
  ['Account standing', 'Delisted', 'error'],
])

// Entries without a kind (older data) are treated as profile reviews, and an empty history is empty.
assert.equal(buildReviewCycles([{ status: 'approved', note: '', createdAt: at(1) }])[0].title, 'Profile review')
assert.deepEqual(buildReviewCycles([]), [])

console.log('review-cycles: ok')
