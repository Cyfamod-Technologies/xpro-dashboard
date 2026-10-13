# Authorization Rules

## Rule evaluation

```text
authenticated
AND account is active
AND role has permission
AND resource is inside assigned scope
AND workflow state permits action
```

## Critical rules

- Only Super Admins manage users, reference configuration, global audit, and publication.
- Managers mutate only assigned records.
- Managers cannot approve/publish.
- Budget Viewers access viewer-safe reads and exports only.
- Draft/review identifiers are invalid on viewer endpoints.
- File downloads independently enforce evidence visibility and approved-version membership.
- Role/scope changes invalidate effective-access caches and active frontend state.

Frontend CASL or route rules should mirror backend permissions for usability, while backend policy tests prove actual enforcement.
