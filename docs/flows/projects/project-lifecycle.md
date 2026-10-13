# Project Lifecycle

## Content workflow status

```text
DRAFT -> SUBMITTED -> CHANGES_REQUESTED | REJECTED | APPROVED -> PUBLISHED
```

## Tracking status

Tracking status is separate from approval status:

```text
PLANNED -> NOT_STARTED -> IN_PROGRESS -> STALLED | ABANDONED
        -> ACTION_REQUIRED -> ACTION_IN_PROGRESS
        -> OUTCOME_VERIFIED -> COMPLETED -> ARCHIVED
```

The separation matters: a published project may be `STALLED`, and a completed project revision may still be awaiting publication.

## Rules

- Only approved content is published.
- Take Action does not imply completion.
- `OUTCOME_VERIFIED` requires evidence and Super Admin approval.
- `COMPLETED` requires a verified outcome or documented formal closure.
- `ARCHIVED` removes the record from active operational lists but preserves viewer history and stable links where applicable.
