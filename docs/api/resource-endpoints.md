# Resource Endpoints

Suggested resource groups:

```text
/api/programs
/api/campaigns
/api/projects
/api/projects/:id/revisions
/api/projects/:id/allocations
/api/allocations
/api/evidence
/api/actions
/api/outcomes
/api/submissions
/api/approvals
/api/imports
/api/locations
/api/administrative-areas
/api/agencies
/api/users
/api/manager-scopes
/api/notifications
/api/audit-events

/api/viewer/dashboard
/api/viewer/programs
/api/viewer/projects
/api/viewer/projects/:publicId
/api/viewer/exports
```

Domain transitions should use explicit commands such as `/submit`, `/request-changes`, `/approve-and-publish`, `/withdraw`, `/complete`, and `/archive` instead of accepting arbitrary status edits.

Lists should document allowed filter and sort keys. Export endpoints must reapply viewer visibility and current approved filters on the server.

## Viewer geography filters

Viewer dashboard and project-list endpoints accept `country` and `state` query parameters. The supported initial country is `Nigeria`; when the client does not provide a state, the backend defaults to `Niger`. The backend must validate the requested state, apply the state constraint before aggregation or pagination, and calculate dashboard metrics from the same filtered, approved-public project set.

```text
GET /api/viewer/dashboard?country=Nigeria&state=Niger
GET /api/viewer/projects?country=Nigeria&state=Lagos
```
