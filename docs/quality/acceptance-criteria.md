# Acceptance Criteria

## Authentication

- A Viewer can register without approval but cannot sign in before email verification.
- Viewer registration always creates `budget_viewer` regardless of request payload.
- Only a Super Admin can invite a Manager.
- Managers and Super Admins cannot finish sign-in without MFA.
- Suspended users lose active access immediately.

## Authorization

- Manager access is limited to assigned scope.
- Budget Viewers cannot call mutation or internal-read endpoints.
- Direct protected URLs return access denied without data leakage.

## Publication

- A Manager can create and submit a valid draft.
- Only a Super Admin can approve and publish.
- Changes requested return to the same preserved revision.
- Published content cannot be edited in place.
- A rejected/pending revision does not change viewer data.
- Publication atomically changes all viewer projections.

## Viewer

- Dashboard and exports contain approved versions only.
- Search/filter results match detail data and export totals.
- Every amount shows currency and fiscal-year context.
- Draft evidence and internal comments never appear.

## Quality

- Core flows are usable by keyboard and on mobile.
- Type checking and production build pass.
- Critical workflow and authorization tests pass.
- Error states preserve safe user input and show recovery guidance.
- Audit events exist for every defined critical transition.
