# Development

Use Node.js 24 and pnpm 11 or newer. Install dependencies from the committed
lockfile with `pnpm install --frozen-lockfile`. Postinstall generates the local
Iconify stylesheet and MSW service worker; both are ignored by Git.

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` | Vite development server |
| `pnpm build` | Production build in `dist/` |
| `pnpm preview` | Serve the production build |
| `pnpm typecheck` | Vue and TypeScript checks |
| `pnpm lint:check` | Check the inherited ESLint rules without modifying files |
| `pnpm lint` | Apply ESLint fixes |
| `pnpm build:icons` | Generate Iconify CSS |
| `pnpm msw:init` | Generate the local mock service worker |
| `pnpm postinstall` | Generate both local assets |

## Structure

Routes live in `resources/ts/pages`; feature components in
`resources/ts/features`; API methods in `resources/ts/services/xpro-api.ts`;
shared template infrastructure in `resources/ts/@core` and
`resources/ts/@layouts`. Follow existing aliases and TypeScript conventions.

## Git and CI

The local repository starts on `codex/setup-dashboard`. There is no configured
remote or deployment target. Add the intended remote and choose your default
branch when publishing. `.github/workflows/ci.yml` runs frozen dependency
installation, lint, type checking and build for `main` pushes and pull requests.
The source deployment workflow and source CODEOWNERS are omitted.

## Backend

Mocks are enabled by default. Do not treat the inherited operations contracts
as compatible with `xpro-server`; adapt authentication, role names and response
envelopes before turning mocks off. Keep environment values in `.env`, which
is ignored by Git; `.env.example` contains placeholders only.
