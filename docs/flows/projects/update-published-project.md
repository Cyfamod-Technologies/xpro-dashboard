# Update Published Project

1. Manager opens a published project and selects **Propose Update**.
2. System creates a draft revision from the current published version and records its base version.
3. Manager edits permitted fields, allocations, evidence, status, or action details.
4. UI marks changed fields and keeps the published version available for comparison.
5. Manager submits the revision.
6. Super Admin reviews differences and approves, requests changes, or rejects.
7. If approved, the new version becomes public atomically; the old version remains in history.

If another revision is already pending, the system prevents an accidental parallel edit or requires an explicit merge workflow. A rejected revision never changes public data.
