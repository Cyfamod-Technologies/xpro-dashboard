# Xpro web and server authentication plan

## Scope and sources

Complete authentication for the Xpro web app and `xpro-server`. The Xpro web
product currently has customer, provider, and staff accounts. Staff permissions
include super admin, operations, pricing, client relations, and finance. Provider
verification and bank review remain separate from account email verification.
Native mobile integration is outside this plan.

Use the live Xpro prototype in `resources/ts/pages/auth`, `resources/ts/stores/auth.ts`,
`resources/ts/features/operations/staff.ts`, and
[the Xpro flow document](../flows/xpro-frontend-ui.md) for intended web behavior.
Use `xpro-server/src/auth`, `prisma/schema.prisma`, and the server's security and
architecture docs for the current API. The two repositories are independent and
need a single agreed contract before mocks are disabled.

## Current gap

| Area | Xpro web prototype | Server starter | Work required |
| --- | --- | --- | --- |
| Account roles | `customer`, `provider`, `admin`; staff role and permission presets live in the operations feature | `user`, `admin`, `super_admin` and `admin`/`user` surfaces | Model customer and provider explicitly, and represent staff roles/permissions on the server. Restrict privileged account creation and role changes. |
| Registration | Customer/provider choice, full name, email and password | `POST /auth/signup` accepts first/last names and always creates a `user` | Define separate server-controlled customer/provider registration. Align form fields, accepted terms, duplicate-email behavior, and response. |
| Email verification | Prototype link token and `/auth/email/verify` | Six-digit email code and `POST /auth/verify-email` | Choose the browser link flow, then align token storage, single-use validation, email template, API DTO, route, resend, and expiry. |
| Login | Mock `token`, `requiresMfa`, and `/auth/mfa/challenge`; Remember this device checkbox | `POST /auth/login` returns `accessToken`, user, session metadata; accepts optional `mfaCode` | Agree on an MFA challenge contract and session lifetime policy. Align web types and routes. |
| Staff invitation | Staff invite UI and an `/auth/invite/accept` adapter method; prototype acceptance completes locally without an MSW handler | No invitation endpoint or table | Add invite, resend, revoke, accept, and privileged staff activation on the server. |
| Recovery | `/auth/password/forgot` and `/auth/password/reset` mock routes | `/auth/forgot-password`, `/auth/reset-password`; email links to `/reset-password` | Align API and email URL with `/auth/reset-password`, plus single-use expiry and session revocation. |
| Profile and sessions | `/me`, JavaScript-readable `accessToken` cookie, client-only logout | `/auth/me`, HTTP-only `xpro_session` cookie, Redis sessions, logout/refresh/revoke endpoints | Use the server session consistently; implement real logout, expiry, refresh, and account-state handling. |
| Responses and errors | Mock `{ data, meta }`, nested mock error code | `{ statusCode, message, data }`, server validation/error shape | Type one agreed envelope and normalize field and rate-limit errors in the web API client. |

## Delivery order

### 1. Fix the shared contract

- Decide the persistent account-role model: customer, provider, or staff account;
  staff permissions are separate from that account type. Define which roles can
  register publicly and which require a staff invitation.
- Specify endpoint paths, DTOs, success/error envelopes, account states, and
  redirects. Use `GET /auth/me` as the current-user authority. Keep the UI's
  provider verification state distinct from email verification.
- Align `VITE_API_BASE_URL`, server address, `FRONTEND_URL`, CORS origins, cookie
  settings, and mock-mode flags across environments. Do not use mock handlers to
  conceal real API failures.

### 2. Build server account and invitation rules

- Add staged Prisma migrations for account type, staff roles/permissions,
  invitation records, and any required account states. Keep existing migrations
  immutable and plan data backfills before new required columns.
- Make public registration server-owned: users cannot assign themselves staff
  permissions. Staff invitations require an authorized super admin and carry
  server-side role assignments. Tokens are hashed, expiring, single-use, and
  revocable; accepting an invite cannot alter its role or email.
- Apply authorization to every protected API action, including provider and bank
  review. Suspend or deactivate accounts by revoking their sessions immediately.
  Audit registration, login, invitation, role changes, MFA, reset, and revocation.

### 3. Complete entry and recovery flows

- Connect customer/provider signup, verification link, resend, and login pages
  to real endpoints. Remove prototype tokens and demo credential prompts from
  real-backend mode. Make login errors generic where account enumeration is a risk.
- Implement a pre-session MFA challenge for staff, including enrollment during
  invitation acceptance and a recovery path. A password alone must never yield
  a usable staff session when MFA is required. Keep MFA secrets and challenge
  material out of browser persistence and logs.
- Align forgot/reset emails with actual web routes. Show a neutral forgot-password
  result, reject used/expired tokens, revoke sessions after reset, and return to
  login. Add password change and recent reauthentication for sensitive actions.

### 4. Make browser sessions reliable

- Prefer the server's HTTP-only cookie for the browser, with credentialed
  requests, exact CORS origins, suitable cookie attributes, and CSRF protection
  on state-changing routes. Retire the JavaScript-readable access-token cookie
  and duplicate API clients after migration.
- Hydrate from `/auth/me` on page load. Use trusted role/status/permission data
  for redirects and guards; accept only local safe return URLs. On `401`, clear
  private state and return to login; on `403`, show access denied.
- Wire logout, logout-all, active-session list/revoke, refresh before expiry,
  and account suspension to the real server. Do not automatically retry unsafe
  mutations. Define what Remember this device actually changes or remove it.

### 5. Verify and release

- Add server integration tests for role escalation, invitation replay, expired
  verification/reset tokens, MFA bypass, session revocation, suspension, and
  cookie CSRF protection. Test privileged permissions against direct API calls.
- Add web tests for form validation, response/error mapping, safe redirects,
  cold-start hydration, MFA challenge, recovery links, and expired sessions.
  Exercise complete flows against PostgreSQL, Redis, and email delivery; mocks
  alone do not establish integration.
- Run `pnpm lint:check`, `pnpm typecheck`, `pnpm build`, and the Xpro workflow
  tests in the dashboard. Run the server build, lint, unit, and end-to-end checks
  for server changes. Review production email links and cookie behavior in each
  deployed environment.

## Done when

Customers and providers can register, verify, sign in, recover access, and
manage sessions. Staff can be invited and complete MFA before privileged access.
Server authorization blocks self-assigned staff roles and unauthorized review
operations. Revoked, suspended, expired, and reset sessions lose access at once,
while the web app clears private state and routes safely. Real-backend mode uses
no prototype credentials, tokens, or budget-platform contracts.
