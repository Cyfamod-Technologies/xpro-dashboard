# XPro frontend UI flows

Vue/Vuetify browser prototypes for customers, providers and admin. All business
records and workflow actions run locally. Backend, payments, real email/push
notifications and React Native implementation are outside this slice.

## Public browsing and private workspaces

- `/`: public homepage for visitors/customers; role overview for provider/admin.
- `/services`: all six service lines and service-specific discovery.
- `/providers`: search approved profiles by service, location and availability.
- `/providers/:id`: public services, introduction, experience, sample ratings and
  portfolio. Verification documents, private contacts and review notes stay in
  the provider/admin UI.
- `/request`: create a brief in public. Visitors can prepare a validated brief,
  sign in, and resume it before submission. Submission requires a customer account.
  A preferred provider is a dispatch preference rather than an automatic match.
- `/workspace/overview`: customer activity overview. Private sections contain
  submitted requests, published quotes, schedules, messages and notifications.
- `/workspace/:section`: role-specific customer/provider/admin pages.

## Implemented journeys

1. Access: existing mock sign-in, signup, verification, recovery and logout.
2. Intake: six service-specific briefs, attachments, filters, admin review,
   clarification and cancellation with a reason.
3. Providers: editable profile, private verification documents, public portfolio,
   submission/review history, approval/changes/rejection and availability.
4. Dispatch: eligible-provider offers, accept/decline, withdrawal and reassignment.
5. Pricing: private provider costing, admin draft line items, immutable published
   quote versions, customer acceptance/decline/revision and new versions.
6. Scheduling: WAT proposals, both participants' confirmation, date-change requests,
   rescheduling and a basic one-hour proximity check for confirmed appointments.
7. Execution: work updates, blockers, resume and completion evidence.
8. Conversations: separate customer/XPro, provider/XPro and internal staff audiences;
   attachments and generated in-app notifications with read state.
9. Completion: customer acknowledgement or issue report, admin resolution and
   acknowledgement-gated final closure.
10. Overview/utilities: derived activity counts, audit history, account/contact
    preferences, notification settings and admin prototype controls.

## Preview data and limits

Business state persists in this browser's localStorage and is shared between demo
accounts. Actions simulate a short save delay. Admin Settings can simulate a failed
save or restore sample records after confirmation. Failed commands leave data intact.
Notification channel preferences are recorded; email/push are not delivered.

File names/types/sizes are retained. PNG/JPEG/WebP images up to 512 KB also preview
locally; other files are metadata only. There is no upload service or cloud storage.
Public ratings/review counts are sample data; review submission is not implemented.

UI role guards and visibility are for prototype review; real authorization and
provider verification belong to backend integration. Demo accounts use the existing
mock auth. Newly registered accounts/reset passwords are not durable across reloads.

## Validation

Run `pnpm lint:check`, `pnpm typecheck`, `pnpm build` and
`pnpm exec tsx --tsconfig tsconfig.json tests/xpro-workflows.mts`.
The workflow checks cover six-service intake, verification, dispatch, quote revisions,
rescheduling, dual confirmation, audience separation, execution/issues/closure,
cancellation, denied access and atomic failures. Browser checks cover public discovery,
request draft/sign-in/submission, quote decisions, provider/admin handoffs and narrow
layouts.
