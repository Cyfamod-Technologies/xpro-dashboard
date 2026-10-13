# Manager Access Management

## Assignment

1. Super Admin opens a Manager profile.
2. Admin selects one or more country, program, or project scopes.
3. UI displays the effective access preview.
4. Admin confirms with a reason when access expands materially.
5. Backend validates scope hierarchy, saves assignments, invalidates permission caches, and audits changes.
6. Manager receives a notification.

## Removal

Before removal, the system identifies drafts, submissions, and active responsibilities owned only by that Manager. Admin transfers or explicitly leaves them unassigned. Removal takes effect immediately for API access and existing sessions.

Frontend navigation and cached records refresh after permission change, but the backend remains the enforcement authority.
