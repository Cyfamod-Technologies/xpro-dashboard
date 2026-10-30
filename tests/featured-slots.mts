import assert from 'node:assert/strict'
import { automaticSlots, changeCount, matchesSearch, moveId } from '@/features/operations/featured-slots.ts'

assert.deepEqual(moveId(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a'])
assert.deepEqual(moveId(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b'])
const same = ['a', 'b']
assert.equal(moveId(same, 1, 1), same, 'A drop on the same slot changes nothing')
assert.equal(moveId(same, 0, 5), same, 'A drop outside the list changes nothing')

assert.equal(automaticSlots(12, 3), 9)
assert.equal(automaticSlots(12, 15), 0)

const row = { name: 'Ada Okafor', businessName: 'Okafor Electric', trade: 'Electrical', city: 'Abuja' }
assert.ok(matchesSearch(row, ''))
assert.ok(matchesSearch(row, 'ada abuja'))
assert.ok(matchesSearch(row, 'ELECTRIC'))
assert.ok(!matchesSearch(row, 'plumbing'))
assert.ok(matchesSearch({ ...row, businessName: null }, 'okafor'))

assert.equal(changeCount(['a', 'b'], ['a', 'b']), 0)
assert.equal(changeCount(['a', 'b'], ['b', 'a']), 1, 'A reorder is one change')
assert.equal(changeCount(['a'], ['a', 'c']), 1)
assert.equal(changeCount(['a', 'b'], ['b', 'c']), 2, 'One removed and one added')
assert.equal(changeCount([], []), 0)

console.log('featured-slots: ok')
