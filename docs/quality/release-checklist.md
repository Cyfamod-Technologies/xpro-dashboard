# Release Checklist

## Product

- Approved scope and decisions are reflected in the release.
- No unresolved blocker in `product/open-questions.md` affects enabled features.
- Demo content and unused routes are removed.
- Production code/assets have confirmed usage rights.

## Engineering

- Environment configuration documented
- Typecheck, build, tests, and lint checks pass
- API version is compatible
- Database migration and rollback reviewed by backend team
- File storage, email, background jobs, and maps configured
- Monitoring and alerting active

## Security and data

- Authorization matrix tested
- Viewer projection inspected for leakage
- MFA, reset, and session revocation tested
- Rate limits and upload scanning active
- Backup restoration tested
- Audit events verified

## Experience

- Mobile, keyboard, and screen-reader critical flows checked
- Loading, empty, error, `403`, `404`, and `409` states checked
- Currency, dates, fiscal year, and timezone checked
- Dashboard totals match filtered lists and exports

## Operations

- At least two accountable Super Admins recommended
- Support path and incident owner defined
- Initial Programs, locations, agencies, and import template approved
- Rollback and public-data correction process rehearsed
