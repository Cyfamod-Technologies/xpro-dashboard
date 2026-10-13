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
| Admin / Dispatch | `admin@xpro.test` | None |

## Frontend flow 1

All three account types land on `/`, with a separate role-specific home screen
and menu. Shared section URLs use `/workspace/:section`; the frontend rejects
sections outside the current account's menu. No role prefixes are required.

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
