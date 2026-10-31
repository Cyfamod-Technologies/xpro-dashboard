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

## Form drafts

The provider profile and the request form autosave to the browser so a reload or
closed tab does not lose the work. The code lives in `resources/ts/features/drafts`.

- Text is saved to `localStorage` under `xpro:draft:<form>:<user id or "guest">`.
  Queued files are saved to the `xpro-drafts` IndexedDB database.
- Drafts expire after 14 days. Bump the `version` passed to `useFormDraft` when a
  form's saved shape changes; older drafts are then dropped.
- A guest's request draft moves to their account after they sign in.
- The bank account number is never saved. A provider profile waiting for review
  is not drafted.
- Choosing Logout from the user menu removes that user's drafts. An expired
  session keeps them.
- To clear drafts while testing, delete the `xpro:draft:*` keys and the
  `xpro-drafts` database in the browser's storage tools.
- `pnpm exec tsx tests/form-drafts.mts` runs the draft envelope tests.
- `pnpm exec tsx tests/safe-redirect.mts` runs the tests for the post-sign-in redirect check (`utils/safe-redirect.ts`, shared by login, signup and the verify-email page).
- `pnpm exec tsx tests/request-bundle.mts` runs the tests for the live request form's several-services logic (limit, duplicate service, single vs group request body, server error paths, draft migration; `features/discovery/request-bundle.ts`).
- `pnpm exec tsx tests/request-groups.mts` runs the tests for the request list's project bundles (grouping, cancel-all and review-all selection, notes and briefs, sequential runner; `features/requests/request-groups.ts`).
- `pnpm exec tsx tests/catalog-skills.mts` runs the tests for the provider's service tree helpers (leaf skills, search, renamed-service aliases; `features/catalog/types.ts`).
- `pnpm exec tsx tests/review-cycles.mts` runs the tests for how the provider's review history is grouped into one card per review (`features/operations/review-cycles.ts`).
- `pnpm exec tsx tests/featured-slots.mts` runs the tests for the Featured providers slot helpers (reorder, search, unsaved-change count).

## Chat

The shared chat lives in `resources/ts/features/chat`: `ChatThread.vue` (timeline and
composer), `ChatBubble.vue`, `ChatComposer.vue`, `ChatDayDivider.vue`,
`ChatAttachment.vue`, `use-chat-messages.ts` (load, poll, send) and `chat-types.ts`
(pure helpers, tested by `pnpm exec tsx tests/chat-helpers.mts`). The design is in
the platform chat standard in the project docs.

- `ChatThread` is driven by props only: `requestId`, `viewer` (`staff`, `customer` or
  `provider`), `audiences`, an optional `defaultAudience`, `readOnlyReason` and `focus`.
  Key it by request id (`<ChatThread :key="requestId" … />`) so each conversation gets
  a fresh message list, poller and unsent-text draft.
- The audience is never defaulted to a staff note and is never remembered. The parent
  picks the default.
- Attachments use the `message_attachment` upload purpose (same formats and 20 MB limit
  as request attachments, 6 files per message), defined in
  `features/operations/file-rules.ts`.
- The open conversation refreshes every 10 s while the tab is visible (`chatPollMs`)
  and straight away when the tab becomes visible again.
- Unsent text is kept with `useFormDraft` as `xpro:draft:chat-<request id>:<user id>`,
  so Logout clears it with the other drafts. Replies to a specific message are not sent
  to the server yet (it has no reply field), so `allowReply` is off by default.

## Admin Messages

The staff Messages page (live mode only; demo mode keeps `RequestBoard`) is a
WhatsApp-style inbox in `resources/ts/features/messages`: `MessagesInbox.vue` (route
state, layout), `ConversationList.vue` and `ConversationRow.vue` (search, status pills,
rows), `ConversationHeader.vue`, `RequestInfoPanel.vue`, `use-conversations.ts` (paging,
filters, 30 s refresh) and the pure modules `messages-helpers.ts` and `status-labels.ts`
(tested by `pnpm exec tsx tests/messages-helpers.mts`). `services/conversations-api.ts`
calls `GET /admin/conversations`. The design is `plans/admin-redesign/01-messages.md` in
the project docs.

- `/admin/messages?request=<XPR-id>` opens a chat (deep link from notifications). A
  request outside the current search or status filters clears the filters. On phones the
  list, chat and info are separate screens (`?info=1` for the last) and use history
  entries, so the system back button steps back one screen.
- The status pills use the dashboard's own map of the 15 request statuses in
  `status-labels.ts`; a row's `statusLabel` is the stage label and only appears in the
  row's third line. Keep the map in step with the server's `REQUEST_STATUSES`.
- The chat is the shared `ChatThread`, keyed by request id. The composer audiences come
  from the viewer's `message.customer`, `message.provider` and `message.internal`
  scopes. The Messages sidebar item and route need at least one of them
  (`anyPermission` in `features/workspace/config.ts`, checked by `sectionAllowed`).
- Customer contact in the info panel needs `view.customer_contact`. The claim button
  shows when the request has no owner and the server lists `request.claim` in
  `allowedActions`.
- The staff request view lists assignments without provider names, so the info panel
  shows the current provider's name from the conversation row and has no "Earlier
  providers" list yet.

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

For a Docker deployment, pass the API URL as a build argument. The Docker
context excludes `.env`, and the build fails if the URL is missing:

```bash
docker build -f infra/Dockerfile \
  --build-arg VITE_API_BASE_URL=https://your-api-host \
  --build-arg VITE_ENABLE_MOCKS=false \
  -t xpro-dashboard .
```

Setting these variables only on the running Nginx container does not change
the already-built JavaScript. Rebuild and redeploy after changing either value.

The [architecture index](architecture/README.md) describes the current web
routes, authentication adapter and browser-local operations workflow.
