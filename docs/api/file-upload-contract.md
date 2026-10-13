# File Upload Contract

## Required metadata

- Filename and media type
- Size
- Evidence type
- Title and description
- Source/capture date
- Location where applicable
- Proposed visibility
- Parent draft/revision

## Behaviour

The API validates authorization before issuing an upload target or accepting content. It enforces size/type rules, scans content, normalises filenames, records a checksum, and returns processing state.

```text
PENDING_UPLOAD -> PROCESSING -> READY | REJECTED | QUARANTINED
```

Files are not viewer-accessible merely because upload completed. Viewer access requires membership in an approved published version and viewer-safe visibility. Protected downloads should use short-lived authorised URLs or streamed responses.

Replacing or removing published evidence creates a revision. Orphaned failed uploads follow a retention cleanup policy.
