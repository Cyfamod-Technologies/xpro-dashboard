# Routes and access

## Page groups

| URLs | Current behavior |
| --- | --- |
| `/`, `/services`, `/request` | Public site. Visitors can browse and prepare a request; submitting requires a customer session. |
| `/providers`, `/providers/:id` | Redirect to `/services`; standalone provider discovery pages are not currently exposed. |
| `/login`, `/auth/signup`, `/auth/verify-email`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/mfa`, `/auth/accept-invite` | Auth screens using the blank layout. Signup is for customer or provider accounts. |
| `/overview` and top-level sections such as `/requests`, `/jobs`, `/verification`, `/payouts`, `/quotes`, `/schedule`, `/messages`, `/notifications`, `/settings`, `/account` | Customer or provider workspace, subject to that role's section list. |
| `/admin`, `/admin/:section` | Staff workspace. The `admin` account role opens sections allowed by its staff permissions. |
| `/access-denied` | Route guard destination for unsupported access. |

`resources/ts/plugins/1.router/index.ts` hydrates auth before navigation. It
redirects guests from private routes to `/login` with a `redirect` query, sends
signed-in users away from guest-only auth screens, requires a pending MFA
challenge for `/auth/mfa`, and redirects old `/workspace/:section` bookmarks to
role-specific URLs. An admin visiting a shared top-level section is sent to the
equivalent `/admin` section. Unknown or disallowed sections go to
`/access-denied`. A staff session is cleared if its matching operations staff
record is missing or inactive.

The account roles used by the web workspace are `customer`, `provider` and
`admin`. Staff permissions are a second layer within `admin`: a staff member
can hold `super_admin`, `operations`, `pricing`, `client_relations` and/or
`finance` roles. `features/operations/staff.ts` maps those roles to action
permissions; `staff.manage` also gates the Staff navigation section. These are
Xpro operations roles, not separate account roles.

## Current auth path

`stores/auth.ts` keeps the user in memory and the access token in an
`accessToken` cookie read by client JavaScript. Login calls `authApi.login`. For
an MFA response, it retains a pending challenge in memory and completes it via
`authApi.verifyMfa`; otherwise it stores the returned token and user. On
reload, `hydrate()` calls `/me` when a token exists. Logout clears local auth
state. `utils/api.ts` uses `VITE_API_BASE_URL` (or `/api`), adds
`X-XPro-Client: web`, and sends the cookie token as a Bearer token.

With mocks enabled, `mocks/handlers.ts` handles login, MFA challenge, signup,
email verification, password recovery and `/me`. Mock accounts are seeded in
`mocks/fixtures.ts`. Newly registered accounts and changed passwords live in
the worker's memory and do not survive a full reload. The staff invitation UI
completes locally in prototype mode; the non-mock API methods for invitation
acceptance and MFA enrollment are present in the adapter but have no matching
MSW handlers. The resend-verification API method also has no matching handler.

These route checks and local role projections make the prototype usable for
review. They do not enforce server authorization. The auth adapter and session
handling still need alignment with `xpro-server`; see the
[integration plan](../api/auth-web-server-plan.md).
