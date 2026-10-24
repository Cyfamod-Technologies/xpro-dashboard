# Operations state and workflows

## Live and demo sources

Request pages switch on `VITE_ENABLE_MOCKS`. With mocks disabled, the request form and request,
job, dispatch, quote, payment, finance and payout workspaces use the server through
`services/requests-api.ts`; lifecycle controls render `RequestView.allowedActions`. Notifications,
approvals and admin settings use the same live API. These paths do not use the request demo's
`sessionStorage` snapshot. The dashboard implementation is still partial and requires the
approval-gated Phase 12 verification before it can be treated as production-ready.

With mocks enabled, request screens continue to use the frozen local reducer described below.
The reducer is prototype behavior, not the current 15-status server contract in Spec 04 §5.

## Demo state and persistence

`features/operations/types.ts` defines one demo `OperationsState` snapshot (schema
`6`) containing requests, providers, notifications, audit entries, user
preferences, staff members and operations settings. The sample snapshot comes
from `features/operations/fixtures.ts`. `stores/operations.ts` loads a valid
snapshot from the browser's `sessionStorage` key `xpro-demo-workspace-v1` or
starts from fixtures. The request form keeps an independent draft in
`sessionStorage` under `xpro-public-request-draft`. This state is confined to
the browser tab and is not shared with the server or other users' browsers.

`operations.run(command)` serializes the typed command, waits briefly to
simulate saving, checks the current actor, calls `applyCommand`, then writes the
new snapshot and updates Pinia. It exposes `busy`, `error` and `notice` for UI
feedback. Failed commands leave the prior snapshot intact. Staff with
`settings.manage` can restore fixtures and trigger a simulated failure from
the prototype controls.

## Demo workflow engine

`features/operations/workflow.ts` is the central transition function. It
clones the prior snapshot, validates the actor and command, applies the domain
change, and returns the next snapshot. Components send a discriminated
`Command` from `types.ts`; they do not directly mutate request and provider
records. The same transition can add notifications and audit entries.

The implemented command families cover:

1. Customer intake, staff review, clarification, cancellation and ownership.
2. Provider onboarding, identity and bank review, availability and payout changes.
3. Provider offers, automatic/manual dispatch, response and staff approval.
4. Private provider costing, Xpro quote drafts, publication, customer decisions
   and revisions. Quote rates are stored in kobo.
5. WAT scheduling, progress and completion review, customer acknowledgement,
   issue resolution and final closure.
6. Customer, provider and internal messages, notifications, preferences, staff
   administration and settings.

Approval is part of the state model. For example, provider acceptance remains
`pending_approval` until staff confirms it; customer-visible progress requires
staff review. `pendingApprovals()` gathers pending assignments, progress,
completion, cancellations, quotes, provider changes and bank reviews for the
staff queue. The [product flow](../flows/xpro-frontend-ui.md) details the
journeys and decision rules.

## Views and access

The store derives the current actor from auth and exposes only that actor's
requests through `visibleRequests()`. Staff can view all requests, customers
see their own, and providers see requests for their current assignment.
`visibleMessages()` separates customer, provider and internal channels.
Customer progress lists include approved updates; providers see their own
updates. `publicProvider()` omits private verification and payout fields, and
`providerQuoteView()` omits private rates and totals.

`staffCan()` requires an active staff record and a role granting the requested
permission. The workflow checks permissions again when a command runs, beyond
the router and hidden UI controls. These checks operate on a browser-local
snapshot, so server authorization remains necessary when workflows move to an
API. Attachments currently retain metadata and small image previews in browser
state; there is no upload or notification delivery service.
