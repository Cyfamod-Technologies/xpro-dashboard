import assert from 'node:assert/strict'
import { draftKeyPrefix, draftStorageKey, draftTtlMs, hashString, isDraftKeyFor, readDraft, readMigratedDraft, sameDraftData, wrapDraft } from '@/features/drafts/draft-envelope.ts'

const now = Date.UTC(2026, 9, 29, 12)
const data = { title: 'Fix the roof', details: { size: '3 bed' } }

// Round trip
const raw = JSON.stringify(wrapDraft(data, 2, now, 'abc'))
const restored = readDraft<typeof data>(raw, 2, now + 1000)

assert.deepEqual(restored?.data, data)
assert.equal(restored?.base, 'abc')
assert.equal(restored?.savedAt, now)
assert.equal(readDraft(JSON.stringify(wrapDraft(data, 2, now)), 2, now)?.base, undefined, 'No base key when the form has none')

// Missing, corrupt or malformed drafts are ignored
assert.equal(readDraft(null, 2, now), null)
assert.equal(readDraft('', 2, now), null)
assert.equal(readDraft('{not json', 2, now), null)
assert.equal(readDraft('null', 2, now), null)
assert.equal(readDraft('"text"', 2, now), null)
assert.equal(readDraft(JSON.stringify({ v: 2, data }), 2, now), null, 'Missing savedAt')
assert.equal(readDraft(JSON.stringify({ v: 2, savedAt: now }), 2, now), null, 'Missing data')

// A new form shape discards older drafts
assert.equal(readDraft(raw, 3, now), null)

// A form can migrate an older shape instead of discarding it
const legacy = { versions: [2], migrate: (old: unknown, from: number) => (from === 2 ? { ...(old as object), migrated: true } : null) }

assert.deepEqual(readMigratedDraft(raw, 3, legacy, now + 1000)?.data, { ...data, migrated: true })
assert.equal(readMigratedDraft(raw, 3, legacy, now + 1000)?.v, 3)
assert.equal(readMigratedDraft(raw, 3, undefined, now), null)
assert.equal(readMigratedDraft(JSON.stringify(wrapDraft(data, 1, now)), 3, legacy, now), null, 'Only the listed versions migrate')
assert.deepEqual(readMigratedDraft(raw, 2, legacy, now)?.data, data, 'A current draft is not migrated')

// Expiry after the TTL, but not before
assert.ok(readDraft(raw, 2, now + draftTtlMs))
assert.equal(readDraft(raw, 2, now + draftTtlMs + 1), null)
assert.equal(draftTtlMs, 14 * 24 * 60 * 60 * 1000)

// A draft stamped well in the future (clock change) is not trusted
assert.equal(readDraft(JSON.stringify(wrapDraft(data, 2, now + 3_600_000)), 2, now), null)

// "Nothing changed" detection
assert.ok(sameDraftData({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2] }))
assert.ok(!sameDraftData({ a: 1 }, { a: 2 }))

// Fingerprints are stable and sensitive to changes
assert.equal(hashString('profile-1'), hashString('profile-1'))
assert.notEqual(hashString('profile-1'), hashString('profile-2'))
assert.notEqual(hashString(''), hashString(' '))

// Keys are per form and per owner, and sign-out only matches the owner's keys
assert.equal(draftStorageKey('request', 'usr-1'), `${draftKeyPrefix}request:usr-1`)
assert.ok(isDraftKeyFor(draftStorageKey('request', 'usr-1'), 'usr-1'))
assert.ok(isDraftKeyFor(draftStorageKey('provider-profile', 'usr-1'), 'usr-1'))
assert.ok(!isDraftKeyFor(draftStorageKey('request', 'usr-12'), 'usr-1'), 'A longer id is not the same owner')
assert.ok(!isDraftKeyFor(draftStorageKey('request', 'guest'), 'usr-1'))
assert.ok(!isDraftKeyFor('somethingelse:usr-1', 'usr-1'), 'Only draft keys are touched')

console.log('PASS: form drafts (envelope round trip, corrupt data, version, expiry, fingerprints, per-owner keys)')
