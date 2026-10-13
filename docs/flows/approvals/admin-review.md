# Admin Review

The Super Admin approval queue supports filtering by type, Program, country, Manager, age, and validation risk.

For each submission, the Admin reviews context, current public version, proposed changes, allocation deltas, evidence, public preview, and audit history. Available decisions are:

- Approve and publish
- Request changes with required comments
- Reject with required reason

The backend rechecks authority and revision freshness at decision time. Decisions are transactional, audited, and notified. High-risk self-publication, if permitted in the MVP, requires an explicit reason.
