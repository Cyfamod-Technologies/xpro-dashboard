# ADR 006: Public Data Boundary

- **Status:** Accepted
- **Decision:** Budget Viewers see approved project information, allocation details, and explicitly approved evidence/action content.

## Context

Self-registration means any person with an eligible verified email may become a Viewer. The system also contains operational drafts and potentially sensitive evidence.

## Consequences

- Xpro internal expenses, bank information, staff data, review comments, draft content, restricted evidence, and unverified allegations are excluded.
- Viewer APIs and exports use dedicated public-safe projections.
- Managers propose visibility; Super Admin publication approves it.
- A visibility change to published data requires a revision.
