# Development

Use Node.js 24 and pnpm 11 or newer. Install dependencies from the committed
lockfile with `pnpm install --frozen-lockfile`. Postinstall generates the local
Iconify stylesheet and MSW service worker; both are ignored by Git.

## Scripts

| Script             | Purpose                                    |
| ------------------ | ------------------------------------------ |
| `pnpm dev`         | Vite development server                    |
| `pnpm build`       | Production build in `dist/`                |
| `pnpm preview`     | Serve the production build                 |
| `pnpm typecheck`   | Vue and TypeScript checks                  |
| `pnpm lint:check`  | Check ESLint rules without modifying files |
| `pnpm lint`        | Apply ESLint fixes                         |
| `pnpm build:icons` | Generate Iconify CSS                       |
| `pnpm msw:init`    | Generate the local mock service worker     |
| `pnpm postinstall` | Generate both local assets                 |

## Structure

Routes live in `resources/ts/pages`; feature components in
`resources/ts/features`; API methods in `resources/ts/services/xpro-api.ts`;
shared template infrastructure in `resources/ts/@core` and
`resources/ts/@layouts`. Follow existing aliases and TypeScript conventions.

## Git and CI

The repository has an `origin` remote. `.github/workflows/ci.yml` runs frozen
dependency installation, lint, type checking and build for `main` pushes and
pull requests.
No deployment workflow or CODEOWNERS file is present.

## Backend

Set `VITE_ENABLE_MOCKS=true` to opt into the demo. With `false` or an unset
value, the dashboard skips the mock worker, sample records and prototype-only
controls. Unsupported operations show a message instead of saving browser-local
changes. Vite embeds this value during `pnpm build`, so rebuild and redeploy
after changing it; changing the server's runtime environment alone does not
update a previously built client. The Xpro web prototype and `xpro-server` do not
yet share a complete authentication contract; see the
[web and server auth plan](api/auth-web-server-plan.md) before turning mocks off.
Keep environment values in `.env`, which is ignored by Git; `.env.example`
contains placeholders only.

The [architecture index](architecture/README.md) describes the current web
routes, authentication adapter and browser-local operations workflow.
