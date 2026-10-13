# Submit Project for Approval

1. Manager opens a valid draft or revision.
2. UI runs a completeness check across project, allocation, location, agency, evidence, and visibility.
3. Manager reviews the exact viewer preview.
4. Manager enters a submission note and confirms.
5. Backend performs authoritative validation and creates an immutable review snapshot.
6. State becomes `SUBMITTED` and a Super Admin review item is created.
7. Manager sees submission time and current reviewer status.

Validation failures keep the draft editable. The Manager may withdraw a submission only before a review decision, with a required reason and audit event.
