# Admin Requests: design flow

Part of the admin dashboard redesign (programme notes: xpro-doc `plans/admin-redesign/README.md`). Status: **decisions agreed on 2026-10-31** (the shared ones, as recommended); this write-up is awaiting review. Nothing is built.

## Summary

`/admin/requests` is where staff find a request and work it. The redesign is a **requests table** (filters on top) that opens a **request details page** at `/admin/requests/:id`. Both follow the Providers pattern in [Table and details standard](table-details-standard.md).

Today the page is a card grid with the selected request's panels stacked underneath in one 1,200-line component shared with customers and providers. The redesign gives staff their own table and details components and reuses the existing panels as cards, so customers and providers are not touched.

The Action queue ([admin-action-queue.md](admin-action-queue.md)) is the to-do list; each row there opens a request here.

## 1. Today

**Frontend (xpro-dashboard)**
- `pages/admin/[section].vue` renders `SectionView.vue`; for `requests` (and `jobs`, `dispatch`, `quotes`, `schedule`, `messages`) in live mode it renders `features/requests/RequestsWorkspace.vue` (1,223 lines).
- That component serves **all three roles**. It loads a list (`requestsApi.list({ q, stage, nextActor: "me", page: 1, itemsPerPage: 50 })`), shows each as `RequestListCard.vue` (id, status chip, title, service and place, "Next: …", one button), and when one is selected renders its panels below: dispatch and offers, quote building and publishing, payout, payment (including offline), schedule, progress, completion, cancellation, project groups (`RequestGroupPanel`, `ReviewAllDialog`, `CancelAllDialog`), and customer request limit.
- There is **no staff details route** for a request. `pages/admin` has only `providers/[id].vue` and `staff/[id].vue` as detail pages.
- `RequestSummary` has no owner, no customer name, and no list total.

**Backend (xpro-server, `src/requests`)**
- `GET /requests` takes `page`, `owner` (`all | mine | unclaimed | <staff id>`), `status`, `stage`, `service`, `nextActor`, `q`. Staff-only `owner` already exists.
- `GET /requests/:id`, `/activity`, `/messages` exist.

## 2. What the specs require

From xpro-doc `platform-flow.md` §5 to §9, xpro-doc `specs/04-request-lifecycle.md` and xpro-doc `specs/02-staff-management.md` §6.8 to §6.10.

- Staff see the whole request. Customers and providers see only their side; the **customer contact** and **site address** follow `view.customer_contact` and the schedule-confirmed rule. Providers never see prices (quote scope only).
- Every staff action has a permission (`request.claim`, `request.review`, `dispatch.manage`, `quote.manage`, `quote.approve`, `schedule.manage`, `progress.review`, `issue.resolve`, `request.cancel`, `request.close`). A control the caller cannot use is hidden or shows why it is disabled, never a failing click.
- A request has an **owner**; claim, release, hand off and reassign are separate commands. An unclaimed request shows "Needs an owner".
- Quote sign-off: the person who edited the draft cannot approve it (separation of duties). Self-approval is allowed only for the sole active super admin, with a reason.
- Project bundles (`XPG-nnnnn`) are separate requests linked by a group; each is reviewed and cancelled on its own, with "review all" and "cancel all" shortcuts.
- Staff messages go through the Messages page (`01-messages.md` (xpro-doc `plans/admin-redesign/`)); the details page links to the request's conversation rather than embedding chat.

## 3. Users and jobs

| Role | Job |
|---|---|
| Intake and dispatch staff | Review a new request, assign or offer to providers, handle no-shows |
| Quote staff | Build, sign off, publish and revise quotes |
| Schedule staff | Propose a time and handle reschedules |
| Progress reviewers | Approve updates, blockers and completion reports |
| Finance | Record offline payments, see payment state |
| Super admin | Anything above, plus reassign owners and resolve escalations |

## 4. Design

### 4.1 Requests table (`/admin/requests`)

Heading **Requests**.

**Filters card** (`VCard > VCardText > VRow`, `hide-details`, same as Providers):

| Control | Width | Values |
|---|---|---|
| Search (`VTextField`, `tabler-search`, clearable, 300 ms debounce) | md 4 | Id, title, customer |
| Show (`VSelect`) | md 2 | Needs my action (default), All requests |
| Owner (`VSelect`) | md 3 | All owners, Mine, Unclaimed |
| Stage (`VSelect`) | md 3 | All stages, then the stage labels |

"Needs my action" sends `nextActor=me`. "Waiting on others" is not offered: the server has no filter for it (see §5).

**Table** (`VDataTableServer` in a `VCard`, 10/25/50, unsortable headers):

| Column | Content |
|---|---|
| Request | `<strong>` title; under it: "XP-1042 · Mrs Bello". A project child also shows a small `VChip` "XPG-00021 · 2 of 3" |
| Service | Service name; under it the city and district |
| Stage | `VChip` small tonal with `statusLabel`; a second chip for a flag or pending cancellation |
| Waiting on | `nextActorLabel` (e.g. "You", "XPro Dispatch", "Customer"); "You" is emphasised |
| Owner | Name, or "Unclaimed" |
| Updated | Relative time |
| Action | `VBtn size="small" variant="text"`: "Open details" |

Order: requests that need the caller first, then most recently updated. Empty text: "No requests match these filters."

**Project bundles** appear as flat rows with the group chip; clicking the chip filters the table to that group. Expandable group rows are not built (decision 4).

### 4.2 Request details (`/admin/requests/:id`)

New page `pages/admin/requests/[id].vue` (`definePage({ meta: { adminSection: "requests" } })`) renders a new `AdminRequestDetails.vue`, same shape as `ProviderAdminDetails.vue`:

**Header row** (`d-flex align-center flex-wrap gap-3 mb-5`):
- Back icon button (`tabler-arrow-left`, aria-label "Back to Action queue" or "Back to requests", from `?from=`).
- Breadcrumb `text-body-2 text-medium-emphasis`: "Admin workspace / Requests".
- `h1.text-h4`: the request title; under it the id and service path.
- Chips: status label; owner (or "Unclaimed"); overlays (flag, cancellation).
- Header buttons: **Message** (opens the request's conversation in Messages) and **More** (menu: hand off, release, escalate; only items the caller may use).

**Notice** `VAlert success tonal closable` after a command.

**Two columns** (`VRow`):

**Left, `VCol lg=8`: stacked cards (`VCard class="mb-5"`, `VCardTitle`, `VCardText` with `text-caption text-medium-emphasis` labels, as Providers).** A card renders only when it applies to the request's stage:

| Card | Shows | Existing panel |
|---|---|---|
| Request | Brief, answers (sensitive ones masked), service path, place, dates | `RequestLifecycle`, answers |
| Dispatch and offers | Mode, ranked providers, current offers, assignment, replace/reassign | dispatch section of `RequestsWorkspace` |
| Quote | Cost items, customer quote, versions, sign-off state | quote section |
| Payment | Payment status, offline payment, payout amount | payment and payout sections |
| Schedule | Proposed or confirmed slot, reschedule requests | schedule section |
| Updates | Provider progress updates, photos, blockers, completion report, customer issue | progress and completion sections |
| Project | Sibling requests, review-all and cancel-all | `RequestGroupPanel` |
| History | Activity log with actor and time | `GET /requests/:id/activity` |

Order follows the stage: the card that holds the current action comes first, the rest follow in lifecycle order, History last. `?focus=<card>` scrolls to and briefly highlights a card.

**Right, `VCol lg=4`:**

1. **Next step** card (the equivalent of "Review actions" on Providers). It has one of three forms:
   - **Needs your decision** (when an approval-queue item is waiting and `canDecide`): a `VAlert tonal info` with what the item is and what the other party will see after approval, then the decision buttons ("Approve", "Return", "Reject" as the kind allows). Each opens the standard confirm `VDialog` (max-width 560, persistent, required note textarea, error `VAlert`, Cancel and confirm), exactly like `ProviderAdminDetails`.
   - **Blocked**: the `blockedReason`, for example "You edited this quote last."
   - **Waiting on someone else**: "Waiting on the customer" or "Waiting on {provider}" with the due time.
2. **People** card: customer (contact shown only with `view.customer_contact`), provider and what XPro Dispatch name they see, owner with Claim, Release or Hand off.
3. **Key facts** card: quote total, paid yes or no, scheduled date, created, last update.

### 4.3 Flows

| Flow | Steps |
|---|---|
| Work from the queue | Action queue row, "Open details", details page on the right card, decide in the right column, Back to the queue (filter kept) |
| Find a request | Requests table, search or filter, "Open details", Back to the table (filters kept in the URL) |
| Claim an unclaimed request | Table shows "Unclaimed", open details, People card, Claim |
| Decide an intake | Open details, Request card shows the brief, Next step card offers Approve, Ask for clarification, Reject (each asks for a note) |

### 4.4 States

| State | Behaviour |
|---|---|
| Loading | Table `loading`; details page centred `VProgressCircular` with aria-label (as Providers) |
| Error | List: `VAlert error tonal` with Retry. Details: `VAlert error tonal` with Retry, and a Back button |
| Not found or no access | "This request does not exist or you cannot view it." with a link to the table |
| Read-only | A closed, cancelled or rejected request hides decision controls and the Next step card says why |
| Stale (409) | Notice "This request changed. Showing the latest." and the page reloads |
| Freshness | The table and the open details page re-fetch every 30 s while visible; the page does not scroll or reorder cards under the cursor |

### 4.5 Permissions

Sidebar item for any staff member. Table rows are those the server returns for the caller. Cards and buttons follow the permissions in §2; sensitive fields follow spec 02 §10.

### 4.6 Phones

The table becomes stacked cards. On the details page the columns stack: Next step first, then the left cards, then People and Key facts.

### 4.7 What does not change

The customer and provider screens, `RequestsWorkspace.vue` for those roles, and the sidebar pages **Dispatch, Quotes, Schedule, Jobs** (still "To audit"). Those pages keep using `RequestsWorkspace` until their own design flows replace them.

## 5. Backend changes

| Change | Why |
|---|---|
| `GET /requests` (staff) returns `total` and honours `itemsPerPage` | Table paging. Confirm what the list result carries today |
| `RequestSummary` (staff) adds `owner { id, name }`, `customerName`, `flag` | Owner and customer columns |
| Optional `nextActor=others` filter | A "Waiting on others" option, only if wanted later |
| `GET /requests/:id` (staff) adds `pendingApproval { kind, itemId, dueAt, overdue, canDecide, blockedReason, preview }` | Next step card without a second call to the queue |
| `preview` text for each decision kind (what the other side will see) | The "Needs your decision" card |

Docs to update: spec 04 (staff list fields and the `pendingApproval` field), `platform-flow.md` §14 and §15 (screen names and routes: `/admin/requests/:id`), `reference/api-design.md`.

## 6. Build phases

1. **Table.** `AdminRequestDirectory.vue` and the `pages/admin/requests` route for staff in live mode; "Open details" goes to the new route; backend `total`, owner and customer fields.
2. **Details shell.** `pages/admin/requests/[id].vue`, `AdminRequestDetails.vue` with header, Request card, People card, Key facts, History, Back with `from`. The existing panels are not yet moved: the page embeds the current `RequestsWorkspace` detail for the id, so the route works from day one.
3. **Move the panels** into cards one at a time, in this order: Updates, Quote, Dispatch and offers, Schedule, Payment, Project. Each lands with its own check. Extract a panel into its own component and use it from both `RequestsWorkspace` and the new page, so customer and provider screens keep working.
4. **Next step card** with the decision dialogs and the `pendingApproval` backend field.
5. **`focus` scrolling** and the Action queue links (needs [admin-action-queue.md](admin-action-queue.md) phase 3).
6. **Retire** the staff branch of `RequestsWorkspace` when every card has moved.

## 7. Decisions

| # | Decision | Status |
|---|---|---|
| 1 | Open from the table by | **Agreed: details page.** Staff never decide from the table |
| 2 | Layout of the details page | **Agreed: the Providers pattern**: stacked cards (left) and an actions card (right). **No tabs** (a change from the first sketch) |
| 3 | Show only the cards that apply | **Agreed**, as recommended |
| 4 | Project bundles in the table | Recommend **flat rows with a group chip** now; expandable group rows only if staff ask |
| 5 | "Waiting on others" filter | Recommend **not now**; the server cannot filter it and "All" covers it |
| 6 | Row opens by | Recommend the **"Open details" button only**, as Providers do |
| 7 | Messages | Recommend a **Message button** that opens the conversation in Messages; no chat on the details page |
