# Approval and Versioning

## Workflow

```text
DRAFT -> SUBMITTED -> APPROVED -> PUBLISHED
                   -> CHANGES_REQUESTED -> DRAFT
                   -> REJECTED
```

Only Super Admins may approve, reject, or publish. Managers may create, edit, submit, and respond to requested changes within their assigned scope.

## Published record invariant

Once published, a version is immutable. “Edit” on a published record means “Create revision.” The system copies the approved content into a new draft, records its base version, and leaves the existing version visible.

## Review interface

The Super Admin must see:

- Submitter and submission time
- Record and program context
- Validation warnings
- Proposed visibility
- Current public version beside the proposed revision
- Field-level changes
- Evidence changes
- Approve and publish
- Request changes with required comments
- Reject with required reason

## Concurrency

The API should reject updates based on a stale revision number. The frontend must explain that another user changed the draft and offer refresh/comparison rather than silently overwriting work.

## Admin-authored records

The preferred model is review by a second Super Admin. If the MVP permits self-publication, it must be an explicit action requiring a reason and audit event. It must not occur automatically when saving.

## Public switch

Approval and publication may occur atomically in the MVP. If scheduled publication is added later, approval and publication become separate states while preserving the same immutable-version rule.
