import assert from 'node:assert/strict'
import { limitBody, limitError, limitLabel, limitMessage, limitNoteMessage, noteError } from '@/features/requests/customer-limit.ts'

assert.equal(limitMessage, 'Choose a limit from 1 to 50, or leave it empty to use the default.')
assert.equal(limitNoteMessage, 'Add a note explaining why this limit changes.')

// Whole numbers 1 to 50 only, unless the platform default is chosen
for (const ok of [1, 7, 50, '1', '50', ' 12 ']) assert.equal(limitError(ok, false), '', String(ok))
for (const bad of [0, 51, -1, 2.5, '', '  ', 'abc', null, undefined, Number.NaN, '1.5'])
  assert.equal(limitError(bad, false), limitMessage, String(bad))
assert.equal(limitError('', true), '', 'Platform default needs no number')
assert.equal(limitError(999, true), '')

// Note: 5 to 500 characters once trimmed
assert.equal(noteError('Needs more'), '')
assert.equal(noteError('abcde'), '')
assert.equal(noteError('  abcd  '), limitNoteMessage)
assert.equal(noteError(''), limitNoteMessage)
assert.equal(noteError('x'.repeat(500)), '')
assert.equal(noteError('x'.repeat(501)), limitNoteMessage)

// The request body
assert.deepEqual(limitBody('8', false, '  Trusted agency  '), { limit: 8, note: 'Trusted agency' })
assert.deepEqual(limitBody('', true, 'Back to default'), { limit: null, note: 'Back to default' })
assert.equal(limitBody('0', false, 'Back to default'), null)
assert.equal(limitBody('8', false, 'no'), null)

// Shown value
assert.equal(limitLabel({ override: null, effective: 3 }), '3 (platform default)')
assert.equal(limitLabel({ override: 10, effective: 10 }), '10')

console.log('PASS: customer request limit (range, note, body, label)')
