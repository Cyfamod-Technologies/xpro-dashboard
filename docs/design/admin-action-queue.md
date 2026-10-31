# Admin Action queue: design flow

Part of the admin dashboard redesign (programme notes: xpro-doc `plans/admin-redesign/README.md`). Status: **decisions agreed on 2026-10-31** (all three, as recommended); this write-up is awaiting review. Nothing is built.

## Summary

The page at `/admin/approvals` is the staff to-do list: every item that is waiting on a staff member, across requests, providers and money. It is renamed **Action queue** because many items are not approvals ("Needs an owner", "Schedule it", "Quote to build").

The redesign is a **table** (filters on top, a paged table below) and no side panel. Each row opens the **details page** of the thing it is about, with the decision card at the top of that page. The table and details follow the Providers pattern in [Table and details standard](table-details-standard.md).

The queue and the Requests page are different views of the same work: the queue is organised by **action**, Requests by **record**. A row here always leads to a record there ([admin-requests.md](admin-requests.md)).

## 1. Today

**Frontend (xpro-dashboard)**

- Live mode: the `approvals` section renders from `features/requests/PlatformWorkspace.vue`, which calls `requestsApi.approvals({ filter, kind, page })` and `requestsApi.approvalCounts()` (`services/requests-api.ts`). Filters are `can_act | mine | all | overdue`.
- Demo mode: `features/operations/ApprovalQueue.vue` (frozen; reads the demo reducer; 9 kinds).
- Each live row is an `ApprovalView` with only: `id, kind, itemId, requestId, openedAt, dueAt, overdue, canDecide, blockedReason`. It has **no title, request reference, owner, or provider name**, so a table row cannot say what the item is without extra fetches.
- Counts are typed as `{ open, overdue }`; spec 02 §6.11 says `{ canAct, overdueByKind }`. These need reconciling.

**Backend (xpro-server)**

- `GET /admin/approvals` (`filter`, `kind`, `page`) and `GET /admin/approvals/counts` exist (request-flow audit item FX-3.12 is marked done). No `q`, no sort option beyond the server order.

## 2. What the specs require

xpro-doc `specs/02-staff-management.md` §6.11: one queue for every staff-actionable item, 27 kinds, deadlines in working time, reminder at 50 percent, escalation at 100 percent, and a daily overdue digest.

- Each row shows: kind, request id and title (or provider name), owner (with "On leave" and delegate), waiting time, "Due in" or "Overdue by", and a **"You can act"** badge. When the caller holds the permission but a separation-of-duties rule blocks them, the badge becomes the reason, for example "You edited this quote last".
- Filters: **You can act** (default), **Mine**, **All**, **Overdue**, and per kind.
- The Overview counter "Awaiting your action" counts only items the caller can decide.
- A decision on a stale item returns 409; the UI removes the row and says "Already decided by {name}."
- Items are visible to all staff, but fields inside follow §10 (a bank row shows a masked number without `view.bank_full`).
- The spec's inline-action rule ("decide in the queue") is **replaced** by this design: decisions are made on the details page. Update spec 02 §6.11 accordingly (see §5).

## 3. Users and jobs

| Role                                 | Job                                                                 |
| ------------------------------------ | ------------------------------------------------------------------- |
| Any staff with a deciding permission | See what only they can move forward, in deadline order, and open it |
| Request owner                        | See their own items and anything overdue on their requests ("Mine") |
| Super admin                          | See everything overdue, by kind and owner                           |
| Finance (later)                      | Payout, refund and offline-payment items                            |

## 4. Design

### 4.1 Page

Heading **Action queue**, sidebar label the same. Route stays `/admin/approvals`.

**Filters card** (same layout as the Providers filters: `VCard > VCardText > VRow`, `hide-details`):

| Control          | Width | Values                                                                              |
| ---------------- | ----- | ----------------------------------------------------------------------------------- |
| Show (`VSelect`) | md 4  | You can act (default), Mine, Overdue, All                                           |
| Kind (`VSelect`) | md 4  | All kinds, then the kinds the caller can see, grouped as Requests, Providers, Money |
| Counts           | md 4  | Two `VChip` tonal: "{n} you can act", "{n} overdue" (red when above zero)           |

No search box in the first build; the queue has no `q` filter on the server (see §5).

**Table** (`VDataTableServer` in a `VCard`, 10/25/50 per page, unsortable headers, as Providers):

| Column  | Content                                                                                                                                 |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Item    | `<strong>` title (request title, or provider name); under it `text-body-2 text-medium-emphasis`: "XP-1042 · Leaking pipe" or "Provider" |
| Kind    | `VChip` small tonal, colour by group (request items primary, provider items secondary, money warning)                                   |
| Owner   | Name, "Unclaimed", or "—" for provider items; "On leave" suffix                                                                         |
| Waiting | "1h 40m" (working time)                                                                                                                 |
| Due     | Chip: error when overdue ("Overdue by 40m"), plain text otherwise ("In 3h")                                                             |
| Status  | "You can act" (success tonal chip), or the `blockedReason` as plain text, or "No permission"                                            |
| Action  | `VBtn size="small" variant="text"`: "Open details"                                                                                      |

Order: overdue first, then earliest `dueAt`. Empty text: "Nothing is waiting for you." with a "Show all" link when the filter is You can act and All is not empty.

### 4.2 Row to details

"Open details" goes to the record, at the card that holds the decision, with `from=queue` so Back returns here:

| Kinds                                                                                       | Opens                  | Scrolls to card                                    |
| ------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------- |
| `unclaimed`, `intake`, `clarification_overdue`, `needs_assignment`, `assignment`, `no_show` | `/admin/requests/:id`  | Dispatch and offers                                |
| `quote_build`, `quote_approval`, `quote_followup`                                           | `/admin/requests/:id`  | Quote                                              |
| `schedule_needed`, `schedule_change`                                                        | `/admin/requests/:id`  | Schedule                                           |
| `progress`, `blocker`, `completion`, `completion_issue`                                     | `/admin/requests/:id`  | Updates                                            |
| `cancellation`, `ready_to_close`, `escalation`                                              | `/admin/requests/:id`  | Summary (the decision card is at the top anyway)   |
| `offline_payment`, `refund`, `payout`, `payout_second`, `compensation` _(planned)_          | `/admin/requests/:id`  | Payment                                            |
| `provider`, `provider_changes`, `provider_reliability`, `bank`                              | `/admin/providers/:id` | The existing review cards (no change to that page) |

The scroll target is a `?focus=<card>` query value; an unknown value is ignored.

### 4.3 Flow

1. Staff notice the count (Overview counter, bell, or sign-in landing).
2. They open the Action queue; it shows **You can act**, overdue first.
3. They press **Open details**; the details page opens on the right card with the decision card at the top of the right column.
4. They decide (dialog with a required note, as Providers do); the page shows the success notice and the next step.
5. **Back** returns to the queue with the same filter, kind and page (the queue keeps its state in the URL query: `?filter=&kind=&page=`).

### 4.4 States

| State                                | Behaviour                                                                                           |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Loading                              | Table `loading` bar (as Providers)                                                                  |
| Empty                                | "Nothing is waiting for you."                                                                       |
| Error                                | `VAlert` error tonal above the table, with Retry                                                    |
| Stale item (409 on the details page) | Notice "Already decided by {name}." and the card updates                                            |
| Freshness                            | Re-fetch every 30 s while the tab is visible; rows update in place; the page number does not change |

### 4.5 Permissions

The page is in the sidebar for any staff member (items are visible to all staff). "You can act" depends on `canDecide`; a row without it still opens the details page read-only. Hide kinds the caller cannot see (for example money kinds for non-Finance roles when those ship).

### 4.6 Staff landing page

After sign-in, staff who hold at least one deciding permission land on `/admin/approvals`. Others land on Overview. Overview stays in the sidebar. (Decision 3.)

### 4.7 Phones

Rows become stacked cards (the Vuetify data table's mobile mode) with the same fields: title and kind on the first line, then Owner, Due, Status, and the "Open details" button.

## 5. Backend changes

| Change                                                                                                                                                                            | Why                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Enrich `ApprovalView` with `label` (human kind label), `title`, `ref` (request id), `subjectName` (provider name for provider items), `ownerName`, `ownerOnLeave`, `waitingSince` | The table needs these without a fetch per row |
| `GET /admin/approvals` returns `total` and honours `pageSize`                                                                                                                     | `VDataTableServer` needs both                 |
| `GET /admin/approvals/counts` returns `{ canAct, overdue, overdueByKind }`                                                                                                        | Matches spec 02 §6.11 and the two chips       |
| Order: overdue first, then `dueAt` ascending                                                                                                                                      | Stated in §4.1                                |
| Optional later: `q` (request id or title, provider name)                                                                                                                          | Search box                                    |

Docs to update in the same change: spec 02 §6.11 (replace "inline actions" with "decide on the details page"), spec 04 (the approvals row in the endpoint table), `platform-flow.md` §14 and §15 (screen names: "Action queue"), and `reference/notifications.md` (deep links keep `/admin/approvals` for the digest and use `/admin/requests/:id?focus=` for item links).

## 6. Build phases

1. **Rename and shell.** Sidebar label and heading to "Action queue", route unchanged. No behaviour change.
2. **Backend enrichment** (§5), so rows carry title, owner and total.
3. **Table.** New `features/operations/ApprovalDirectory.vue` copied from the shape of `ProviderAdminDirectory.vue`; `SectionView` renders it for `approvals` in live mode. Rows link to the right route using the §4.2 table, even before the details cards exist (the Requests page opens the request; `focus` is ignored).
4. **Query state and Back.** Keep filter, kind and page in the URL; the details page reads `from=queue` and goes back with those values.
5. **Landing page** rule (§4.6).
6. **Remove** the live branch in `PlatformWorkspace.vue` for `approvals` once phase 3 is verified.

Phases 3 to 6 depend on the Requests details page ([admin-requests.md](admin-requests.md) phase 2) for the `focus` scrolling; the table works without it.

## 7. Decisions

| #   | Decision                      | Status                                                                                                |
| --- | ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | Page name                     | **Agreed: "Action queue".** Alternative was "To do"                                                   |
| 2   | Quick approve from the table  | **Agreed: no.** Always open the details page                                                          |
| 3   | Staff landing page            | **Agreed: Action queue** for staff who can decide something; Overview stays in the sidebar            |
| 4   | Row opens by                  | Recommend the **"Open details" button only**, as Providers do; keep it a real button for keyboard use |
| 5   | Search box in the first build | Recommend **no**; add `q` later if the queue grows past a few pages                                   |
| 6   | Auto-refresh interval         | Recommend **30 s** (same as notifications)                                                            |
