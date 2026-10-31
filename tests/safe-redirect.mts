import assert from 'node:assert/strict'
import { safeRedirectPath } from '@/utils/safe-redirect.ts'

// In-app paths pass through unchanged
for (const ok of ['/request', '/requests?request=XPR-00001', '/overview', '/services/design'])
  assert.equal(safeRedirectPath(ok), ok, ok)

// Anything that could leave the app, or loop back into sign-in, is refused
for (const bad of [
  undefined,
  null,
  42,
  ['/request'],
  '',
  'request',
  'https://evil.example',
  '//evil.example',
  '/\\evil.example',
  '/request\nSet-Cookie',
  '/request\u0000',
  '/login',
  '/login?redirect=/request',
  '/auth/verify-email',
  '/access-denied',
])
  assert.equal(safeRedirectPath(bad), null, String(bad))
