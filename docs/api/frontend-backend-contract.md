# Frontend-Backend Contract

## General

- Base URL is supplied through `VITE_API_BASE_URL`.
- All non-public requests require an authenticated secure session or approved token mechanism.
- JSON uses ISO 8601 UTC timestamps and stable opaque identifiers.
- Money uses amount as a string/minor-unit-safe representation plus ISO currency.
- Lists use documented pagination, sorting, filtering, and total metadata.
- Every mutation supports a request/correlation ID.

## Response shape

```json
{
  "data": {},
  "meta": {},
  "links": {}
}
```

Errors use a stable code, human-readable message, correlation ID, and field errors when relevant.

## Concurrency

Mutable drafts expose a version/ETag. Updates include it, and stale changes return `409 Conflict` with enough metadata to refresh and compare.

## Viewer safety

Viewer endpoints return dedicated approved projections. Internal resources are never sent and filtered in the browser.

## Compatibility

Breaking changes require an API version strategy. Frontend builds should tolerate newly added response fields and must not rely on undocumented fields.
