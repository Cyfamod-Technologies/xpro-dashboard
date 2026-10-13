# ADR 004: Versioned Project Updates

- **Status:** Accepted
- **Decision:** Published records are immutable; updates create revisions requiring approval.

## Consequences

- Stable resources point to current published versions.
- Pending versions coexist with public versions.
- The UI needs field-level comparison and viewer preview.
- Publication must be atomic and idempotent.
- Previous versions remain available for authorised history and audit.
