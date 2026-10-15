# Xpro Dashboard

Vue 3, TypeScript, Vite and Vuetify dashboard bootstrapped from the local
`ng-sou-frontend` project, with Xpro branding and primary colour `#4AA7DF`.

## Requirements

- Node.js 24 (see `.nvmrc`)
- pnpm 11 or newer

## Run locally

```bash
cp .env.example .env
pnpm install --frozen-lockfile
pnpm dev
```

The development server runs at `http://localhost:5173`. A local `.env` is
already created during the initial setup; it contains the example values only.

`VITE_ENABLE_MOCKS=true` enables the inherited prototype flows, so the
frontend works without a backend. Programs, projects, budgets, approvals and
sample geographic data are retained as examples from the source project.

## Prototype accounts

All prototype accounts use the password `Password123!`.

| Role | Email | Additional step |
| --- | --- | --- |
| Customer | `customer@xpro.test` | None |
| Provider | `provider@xpro.test` | None |
| Staff · Super admin | `admin@xpro.test` | None |
| Staff · Operations | `operations@xpro.test` | None |
| Staff · Pricing | `pricing@xpro.test` | None |
| Staff · Client relations | `relations@xpro.test` | None |
| Staff · Finance | `finance@xpro.test` | None |

Staff accounts share the same password as the other prototype accounts.

Every admin account has one or more staff roles (super admin, operations,
pricing, client relations, finance). Roles are presets of permissions, and the workflow
reducer checks one permission per action, so staff can see everything but only
act within their role. New requests land unclaimed in a shared queue and alert
every staff member who can claim requests. A staff member claims a request, or
becomes its owner the first time they act on it; pricing staff never become
owners. Super admins can reassign owners, manage staff at `/admin/staff`
(invite, change roles, suspend with a hand-over of open requests), approve
quotes above an optional high-value threshold in Settings, and restore sample
records. Requests unclaimed for more than two hours are flagged in the queue and
counted on the admin overview. Suspended staff are signed out and cannot act.
Invited staff appear in the Staff list, but only the seeded accounts can sign in.
Saved prototype data from before staff roles is reset on first load.

Provider and customer actions that affect the other party are held for XPro. The
admin Approvals queue (`/admin/approvals`) lists provider acceptances, progress and
completion reports and customer cancellation requests, each approved or rejected
inline by staff with the matching permission (including bank details, for Finance);
quotes and provider verifications link to their own review screens.

Providers sign up themselves: the public site's "Become a provider" button opens
sign-up with Provider preselected. After verifying their email, a provider
completes the onboarding form at `/verification` (profile, documents, a face photo
that only staff see, and bank details) with a checklist of what is left. The bank
account name comes from a simulated lookup (no API call; account numbers ending in
`0000` fail it). Staff review in two separate approvals: Operations verifies
identity (`provider.review`) and Finance verifies the bank account (`bank.review`),
both from `/admin/approvals`. Providers can change bank details later under
*Payout details* (`/payouts`); the old account stays in use until Finance approves
the change, and account numbers are masked for staff without `bank.review`.
Saved prototype data is reset once on first load after this update.

## Frontend flow 1

`/` is always the public site, for signed-in and signed-out visitors alike.
Signing in sends customers and providers to `/overview`, and admins to `/admin`.
Customer and provider sections live at top level (`/overview`, `/requests`,
`/jobs`, `/quotes`, ...); the admin console lives at `/admin` (overview) and
`/admin/:section`. The router guard rejects sections outside the current
account's menu, and sends admins who open a shared section URL to its `/admin`
equivalent. Old workspace-prefixed section URLs redirect to the new paths.

Sign-in, customer/provider registration, verification and recovery are simulated
by browser MSW handlers. Demo sessions survive refresh; newly registered accounts
and password changes reset when the preview reloads. No email is sent.

The remaining workflow sections currently show navigation/empty-state shells;
their forms and business interactions are implemented one flow at a time.
The inherited budget/project routes are not part of the XPro prototype navigation.

## Theme

The primary colour is `#4AA7DF` in both theme definitions. Text and icons on solid primary backgrounds use white. Semantic colours are defined in
`resources/ts/plugins/vuetify/theme.ts`; the initial loader colour is defined
in `index.html`. The supplied platform logo is in
`public/images/xpro-logo-transparent.png`, referenced by `themeConfig.ts` and the auth shell.
Public contact details are defined in `resources/ts/utils/branding.ts`, sourced
from [the Xpro about page](https://xpro.ng/about.php).
See [branding](docs/design/xpro-branding.md).

## API integration

Set `VITE_API_BASE_URL` to your API URL and `VITE_ENABLE_MOCKS=false` when
integrating a real backend. The copied API adapter in
`resources/ts/services/xpro-api.ts` retains the source project's contracts.
It must be adapted to `xpro-server` endpoints, response envelopes and roles
before real authentication and dashboard requests will work.

## Verify

```bash
pnpm lint:check
pnpm typecheck
pnpm build
pnpm preview
```

Production output is written to `dist/`. CI runs lint, type checking and a production
build on pull requests and pushes to `main`. Deployment is not configured;
the source project's deployment workflow and CODEOWNERS were not copied.
The Docker build remains available in `infra/Dockerfile`.

See [development](docs/dev.md) for scripts and repository conventions. The
[documentation index](docs/README.md) includes inherited reference workflows.
