# Testing Strategy

## Unit tests

- Money and fiscal-year formatting
- Permission/scope helpers
- Validation schemas
- Status-transition presentation
- Viewer projection types
- CSV safety and parsing helpers

## Component tests

- Authentication forms
- Scope-aware navigation
- Project/allocation editors
- Revision diff and viewer preview
- Approval decision panel
- Evidence visibility
- Filters and empty/error states

## Integration tests

- API error normalisation
- Session expiry and permission refresh
- Draft concurrency conflicts
- Upload processing states
- Import validation lifecycle

## End-to-end tests

1. Viewer signup through Budget Dashboard.
2. Admin invitation through Manager first login/MFA.
3. Manager draft through Admin publication and Viewer display.
4. Published revision with changes requested and later approval.
5. Restricted record and file access attempts.
6. CSV import through approved public records.
7. Suspension revoking an active session.

Backend policy tests must prove authorization independently of frontend tests.
