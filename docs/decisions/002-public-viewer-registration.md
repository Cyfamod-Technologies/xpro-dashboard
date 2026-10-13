# ADR 002: Public Viewer Registration

- **Status:** Accepted
- **Decision:** Budget Viewers may self-register without approval and activate after email verification.

## Consequences

- Registration always assigns `budget_viewer` on the backend.
- Viewer endpoints must contain approved public-safe projections only.
- Bot protection, rate limiting, verification expiry, and generic account responses are required.
- Self-registration cannot grant Manager or Super Admin access.
