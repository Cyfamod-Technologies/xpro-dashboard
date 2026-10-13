# Validation and Errors

## Error shape

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Some fields need attention.",
    "correlationId": "req_...",
    "fields": {
      "allocations.0.amount": ["Amount must be greater than or equal to zero."]
    }
  }
}
```

## Standard handling

- `400`: malformed request
- `401`: clear invalid session and return to login
- `403`: access-denied state without protected detail
- `404`: not-found state
- `409`: stale revision or workflow conflict with recovery guidance
- `413`: upload too large
- `422`: bind field errors while preserving input
- `429`: display retry timing when safe
- `5xx`: stable error screen with correlation ID and retry

Validation messages should describe correction, not internal implementation. Bulk import errors include safe row numbers and columns.
