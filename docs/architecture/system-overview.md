# System Overview

## Context

The product consists of an independently deployable Vue frontend and an independently deployable backend API. The frontend renders experiences and collects input; the backend owns identity, authorization, workflow state, validation, versioning, publication, file metadata, and audit history.

```text
Browser
  -> Vue 3 / Vite frontend
      -> HTTPS JSON API
          -> Authentication and authorization
          -> Domain and workflow services
          -> Relational database
          -> Object/file storage
          -> Email and notification provider
```

## Frontend responsibilities

- Role-specific routing and navigation
- Forms, validation feedback, tables, charts, maps, and uploads
- Draft autosave experience where supported by the API
- Review and comparison interfaces
- Viewer-safe rendering
- Accessible loading, empty, error, offline, and permission states

## Backend responsibilities

- Account creation, invitation, verification, login, MFA, and sessions
- Role and scope enforcement
- Domain validation and database transactions
- Immutable published versions
- Submission and approval state transitions
- Evidence authorization and signed file access
- Audit events
- Notification dispatch
- CSV import processing
- Public-view projections that exclude non-public fields

## Trust boundaries

The browser is untrusted. Role names, visibility levels, record ownership, approval state, and publication state submitted by the frontend must be validated by the backend.

The frontend must never construct a viewer response by filtering an internal object. It should request a dedicated viewer-safe API representation.

## Primary invariants

1. A Budget Viewer cannot mutate domain data.
2. A Manager cannot publish a revision.
3. A published version is immutable.
4. A rejected or pending revision never replaces the published version.
5. Authorization combines role permissions and assigned scope.
6. Every approval and publication action is auditable.
7. Public file access follows the evidence visibility of the approved version.
