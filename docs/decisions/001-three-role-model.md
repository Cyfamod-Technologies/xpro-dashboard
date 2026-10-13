# ADR 001: Three-Role Model

- **Status:** Accepted
- **Decision:** The MVP has Super Admin, Manager, and Budget Viewer roles.

## Context

Xpro needs a small initial permission model. The Manager will perform operational responsibilities that may later be separated among program, finance, field, or data reviewers.

## Consequences

- Super Admin manages and publishes.
- Manager prepares all operational records in assigned scope.
- Budget Viewer is read-only.
- Permissions remain granular internally so new roles can be composed later without redesigning endpoints or data ownership.
