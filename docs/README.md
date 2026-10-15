# Xpro Dashboard Documentation

Start with [development](dev.md) and [branding](design/xpro-branding.md).
The remaining files are inherited operations-dashboard reference material;
product assumptions and API contracts require review for Xpro. They do not
represent approved Xpro requirements.

This directory preserves the source dashboard's reference specification, workflows, architecture, data rules, API expectations, and delivery criteria.

## Product summary

The inherited example dashboard tracks programs, public projects, allocation details, evidence, approval history, and approved public versions. Managers prepare records, Super Admins approve and publish them, and self-registered Budget Viewers explore approved project and allocation data.

The platform operates in Nigeria and supports state-level budget views, with Niger as the default state and configurable LGAs and communities. It uses the existing Vue 3, Vite, Vuetify, and Vuexy-derived application shell as the visual starting point, while replacing demo content and any assets that are not licensed for production use.

## Read this first

1. [Product overview](product/product-overview.md)
2. [Goals and scope](product/goals-and-scope.md)
3. [Approved decisions](product/approved-decisions.md)
4. [Roles and permissions](product/roles-and-permissions.md)
5. [System overview](architecture/system-overview.md)
6. [Flow index](flows/README.md)
7. [Information architecture](design/information-architecture.md)
8. [Frontend-backend contract](api/frontend-backend-contract.md)
9. [Acceptance criteria](quality/acceptance-criteria.md)

## Documentation areas

| Area            | Purpose                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------- |
| `product/`      | Product purpose, scope, terminology, roles, decisions, and roadmap                       |
| `architecture/` | System boundaries, frontend structure, access control, publication, audit, and security  |
| `flows/`        | One document for every important user and administrative journey                         |
| `design/`       | Navigation, dashboards, screens, components, branding, responsiveness, and accessibility |
| `api/`          | Contracts the frontend expects the independent backend to provide                        |
| `data/`         | Entities, fields, relationships, statuses, and examples                                  |
| `quality/`      | Acceptance, testing, security, performance, and release requirements                     |
| `decisions/`    | Architecture decision records for choices that should not be silently reversed           |

## Core operating model

```text
Manager creates or revises a record
        -> Manager submits it
        -> Super Admin reviews it
        -> Super Admin approves and publishes it
        -> Budget Viewer sees the approved public version
        -> Public action and verified outcomes are recorded
```

Published data is immutable. A later correction creates a new draft revision; the currently approved version stays visible until the new revision receives Super Admin approval.

## Documentation conventions

- **Must** describes a release requirement.
- **Should** describes the recommended implementation unless a documented constraint prevents it.
- **May** describes optional behaviour.
- Public data always means data explicitly approved for Budget Viewer access.
- A hidden navigation item is not an authorization control; the backend must enforce every permission.
- Changes to an agreed decision should update both the relevant specification and its record in `decisions/`.

## Current roles

- **Super Admin:** manages users and configuration, reviews submissions, approves publication, and has global visibility.
- **Manager:** manages assigned programs, tracked projects, allocations, evidence, actions, and submissions.
- **Budget Viewer:** self-registers and receives read-only access to approved public project and allocation data.

Additional reviewer, donor, field, or finance roles are outside the first release, but the permission model must allow them to be introduced later.
