# XPro frontend UI flows

Vue/Vuetify browser prototypes for customers, providers and admin. All business
records and workflow actions run locally. Backend, payments, real email/push
notifications and React Native implementation are outside this slice.

## Public browsing and private workspaces

- `/`: public homepage for everyone, signed in or not.
- `/services`: all six service lines and service-specific discovery.
- `/providers` and `/providers/:id`: currently redirect to `/services`. Public
  provider search and profile routes are not exposed in the current build.
- `/request`: create a brief in public. Visitors can prepare a validated brief,
  sign in, and resume it before submission. Submission requires a customer account.
  XPro handles provider assignment; the customer does not pick a provider.
- `/overview`: customer/provider activity overview. Private sections at top
  level (`/requests`, `/jobs`, `/quotes`, `/schedule`, `/messages`,
  `/notifications`, `/settings`, `/account`, `/verification`, `/availability`)
  contain submitted requests, published quotes, schedules and messages.
- `/admin` and `/admin/:section`: the admin (staff) console, admin accounts only.
  Old workspace-prefixed section URLs redirect to the new paths.

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
10. Staff management: admin accounts carry staff roles (super admin, operations,
    pricing, client relations, finance) and the reducer enforces one permission
    per action; see "Staff management" below.
11. Overview/utilities: derived activity counts, audit history, account/contact
    preferences, notification settings and admin prototype controls.
12. Approval gates: anything a provider or customer does that affects the other
    party is held for XPro, then shown or notified after approval. See "Approval
    gates" below.
13. Provider sign-up and payout details: "Become a provider" opens sign-up with the
    Provider role preselected; onboarding at `/verification` collects documents, a
    staff-only face photo and bank details (simulated account lookup). Operations
    (`provider.review`) and Finance (`bank.review`) approve separately; bank
    changes under `/payouts` keep the old account active until approved. See
    "Provider sign-up and payout details" below.

## Approval gates

- New requests alert eligible providers with a generic notice. They cannot open
  the request before XPro offers the assignment.
- Provider acceptance becomes `pending_approval`. XPro (`dispatch.manage`) confirms or
  rejects it; only then is the request matched, pricing opened and the customer told.
- Provider progress and completion reports are pending until a staff member with
  `progress.review` approves them. Approval moves the job status and notifies the
  customer; rejection keeps the status and sends the note to the provider. A provider
  has one pending update at a time. Customers only see approved updates.
- Customer cancellation is a request. XPro (`request.cancel`) approves or rejects it;
  an admin cancelling directly clears any pending request.
- Providers see "XPro customer" instead of the customer's name, phone and budget, and
  the full site address only once the schedule is confirmed. Schedule responses are
  labelled "Customer" and "Provider" rather than by name.
- `/admin/approvals` lists every pending item (assignments, progress, completion,
  cancellations, quotes awaiting sign-off, provider verifications) oldest first, with
  inline approve/reject for the first four kinds. Requests with pending items show an
  "Awaiting approval" chip on the board and the admin overview counts them.

## Provider sign-up and payout details

- Public entry: header and homepage "Become a provider" buttons go to
  `/auth/signup?role=provider`, which preselects Provider.
- `/verification` is the onboarding form with a checklist (profile, documents,
  face photo, bank details, submitted, identity verified, bank verified). The photo
  is visible to staff only and never in the public provider projection.
- Bank details: bank (demo Paystack codes), 10-digit account number and a
  "Verify account" step that fills a read-only account name. Demo: account numbers
  ending in `0000` fail verification. No API is called.
- Submitting creates a pending bank review and alerts staff with `bank.review`
  (Finance, super admin). Identity verification stays with `provider.review`.
- `/payouts` (provider): current account, pending change, last rejection note,
  history, and a change form (`payout.update`). Payouts stay on the verified
  account until Finance approves; with no verified account they are paused
  (`payoutReady`).
- Staff: provider review shows the photo and payout block; `/admin/approvals` has
  a Bank filter with inline approve/reject (reject needs a reason). Account numbers
  are masked unless the staff member has `bank.review`.

## Staff management

- Roles are presets of permissions (`features/operations/staff.ts`). All staff can
  view every request, conversation and provider; roles limit actions only. Action
  buttons are hidden when the signed-in staff member lacks the permission.
- Ownership: new requests are unclaimed and alert everyone who can claim. Staff claim
  a request or become owner on their first action; pricing staff never own requests.
  Super admins reassign owners. After claiming, only the owner is notified, plus
  staff with the pricing role for pricing events. Unclaimed for more than two
  hours flags the request in the queue and the admin overview.
- Quote sign-off: pricing staff and super admins publish quotes and the publisher is
  recorded. With a threshold set in Settings, a quote at or above it published by a
  non-super-admin waits for super admin approval and notifies super admins.
- `/admin/staff` (super admin only): invite by name, email and roles; edit roles;
  suspend (choosing a successor for open requests) and reactivate. The last active
  super admin cannot be suspended or demoted, and nobody can suspend themselves.
  Suspended staff are signed out and every command they send is rejected. Demo mode:
  invited staff are listed but only seeded accounts can sign in.
- Settings (super admin only): prototype controls and the quote approval threshold.
- Customers and providers see staff messages as "XPro Team" or "XPro Dispatch".

## Preview data and limits

Business state persists in this tab's sessionStorage and is shared between demo
accounts using that tab. Actions simulate a short save delay. Admin Settings
can simulate a failed save or restore sample records after confirmation. Failed
commands leave data intact.
Notification channel preferences are recorded; email/push are not delivered.

File names/types/sizes are retained. PNG/JPEG/WebP images up to 512 KB also preview
locally; other files are metadata only. There is no upload service or cloud storage.
Provider ratings/review counts are sample data; public provider profile routes
currently redirect to `/services`, and review submission is not implemented.

UI role guards and visibility are for prototype review; real authorization and
provider verification belong to backend integration. Demo accounts use the existing
mock auth. Newly registered accounts/reset passwords are not durable across reloads.

## Validation

Run `pnpm lint:check`, `pnpm typecheck`, `pnpm build` and
`pnpm exec tsx --tsconfig tsconfig.json tests/xpro-workflows.mts`.
The workflow checks cover six-service intake, verification, dispatch, quote revisions,
rescheduling, dual confirmation, audience separation, execution/issues/closure,
cancellation, denied access and atomic failures, plus staff permissions, ownership,
quote approval and staff account rules, and the approval gates. Browser checks cover public discovery,
request draft/sign-in/submission, quote decisions, provider/admin handoffs and narrow
layouts.
