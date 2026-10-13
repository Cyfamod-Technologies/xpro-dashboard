# Navigation

## Principles

- Show the next useful action prominently.
- Preserve filters when navigating between a dashboard and its underlying list.
- Use breadcrumbs for Program, Project, and Allocation hierarchy.
- Keep public and administrative sections visually distinct.
- Do not show unusable demo routes.
- Do not use navigation hiding as the only access control.

## Proposed routes

```text
/auth/login
/auth/signup
/auth/verify-email
/auth/forgot-password
/auth/reset-password
/auth/mfa
/auth/accept-invite

/admin/dashboard
/admin/users
/admin/approvals
/admin/locations
/admin/settings
/audit-log

/dashboard
/my-work
/programs
/programs/:programId
/projects
/projects/new
/projects/:projectId
/projects/:projectId/revisions/:revisionId
/allocations
/evidence
/actions
/submissions
/imports

/budget
/explore
/explore/projects/:publicId
/take-action/:publicId
```

Routes use stable opaque identifiers. Viewer URLs use public identifiers and never expose draft revision IDs.
