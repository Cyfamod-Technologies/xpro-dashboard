# Authentication Contract

## Suggested endpoints

```text
POST /api/auth/viewer/register
POST /api/auth/email/verify
POST /api/auth/email/resend
POST /api/auth/login
POST /api/auth/mfa/challenge
POST /api/auth/logout
POST /api/auth/logout-all
POST /api/auth/password/forgot
POST /api/auth/password/reset
POST /api/auth/invitations/:token/accept
GET  /api/me
GET  /api/me/sessions
DELETE /api/me/sessions/:id
```

`/api/me` returns identity, account state, role, effective permissions, assigned scopes, MFA state, and safe preferences. It does not return password, MFA secret, or security-token data.

Viewer registration accepts no effective role field. Manager invitation acceptance cannot change the role or scopes encoded server-side for the invitation.

Expected statuses include `401` for unauthenticated, `403` for unauthorised, `409` for conflicting account/invitation state, `422` for validation, and `429` for rate limiting.
