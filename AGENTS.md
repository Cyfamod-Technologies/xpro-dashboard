# Xpro Dashboard

Vue 3, TypeScript, Vite and Vuetify frontend for Xpro customer, provider, and
staff workflows.

- Match surrounding code and keep changes focused.
- Use existing aliases (`@/`, `@core`, `@layouts`, `@styles`).
- Keep routes in `resources/ts/pages`, feature components in
  `resources/ts/features`, API calls in `resources/ts/services/xpro-api.ts`,
  and shared infrastructure in `resources/ts/@core` and `resources/ts/@layouts`.
- Type new interfaces and API responses; avoid adding `any`.
- Define colours in `resources/ts/plugins/vuetify/theme.ts` and consume semantic
  Vuetify tokens. Primary Xpro blue is `#4AA7DF`; use white text on it.
- Keep environment configuration in `.env`; never commit secrets.
- The browser workflows are prototypes. Do not assume their mock API contracts
  match `xpro-server`; verify endpoints and data shapes before integration.

Before finishing, run `pnpm lint:check`, `pnpm typecheck`, and `pnpm build`.
Update `docs/dev.md` when changing scripts or workflows.

CI targets `main`. Deployment is not configured. Do not add AI attribution to
commits or pull requests.
