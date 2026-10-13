# Revision Publication

1. Super Admin approves a fresh submitted revision.
2. Backend transaction marks the revision approved, updates the resource's published-version pointer, records publication time, writes the audit event, and queues projection/index updates.
3. Viewer endpoints begin returning the new approved version.
4. Caches are invalidated using version-aware keys.
5. Dashboard totals and exports use the same published projection.
6. Manager receives confirmation.

Readers must see either the complete old version or complete new version. A failure before commit leaves the old version public and the submission recoverable. Publication retries must be idempotent and must not create duplicate versions.
