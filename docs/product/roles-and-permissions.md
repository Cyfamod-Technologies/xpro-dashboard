# Roles and Permissions

## Role summary

| Capability                                | Super Admin | Manager             | Budget Viewer                               |
| ----------------------------------------- | ----------- | ------------------- | ------------------------------------------- |
| View global administration dashboard      | Yes         | No                  | No                                          |
| Manage users, roles, and system settings  | Yes         | No                  | No                                          |
| View Nigerian locations and programs      | Yes         | Assigned scope only | Approved public data for the selected state |
| Create and edit programs                  | Yes         | Assigned scope      | No                                          |
| Create and edit projects                  | Yes         | Assigned scope      | No                                          |
| Create and edit allocations               | Yes         | Assigned scope      | No                                          |
| Upload and classify evidence              | Yes         | Assigned scope      | No                                          |
| Submit records for review                 | Yes         | Yes                 | No                                          |
| Approve, reject, and publish              | Yes         | No                  | No                                          |
| View drafts and review comments           | Yes         | Assigned scope      | No                                          |
| View approved project and allocation data | Yes         | Yes                 | Yes                                         |
| Export approved budgeting data            | Yes         | Yes                 | Yes                                         |
| View global audit log                     | Yes         | No                  | No                                          |
| View own/assigned record history          | Yes         | Yes                 | No                                          |

## Super Admin

Super Admins manage the platform and provide final publication approval. They can invite Managers, suspend accounts, assign Manager scopes, configure reference data, inspect all records, and publish approved revisions.

Super Admin creation is never public. It occurs during secure deployment or through an existing Super Admin. Sensitive actions require recent authentication and produce high-priority audit events.

## Manager

Managers carry the operational workload. A Manager may manage only records inside assigned LGA, program, or project scopes. They can prepare drafts, import data, upload evidence, propose visibility, respond to requested changes, record actions and outcomes, and submit records for approval.

Managers cannot publish their own changes or change their own role and scope.

## Budget Viewer

Budget Viewers self-register, verify their email, and receive the fixed `budget_viewer` role. They can browse and export approved public information. They cannot create, comment on, modify, approve, or see non-public data.

The frontend must ignore any role supplied during signup; the backend assigns `budget_viewer` unconditionally.

## Suggested permission keys

```text
users.manage
roles.manage
settings.manage
audit.view_global

programs.view
programs.manage
projects.view
projects.manage
allocations.view
allocations.manage
evidence.view_internal
evidence.manage
actions.manage
submissions.create
submissions.review
records.publish

public_projects.view
public_allocations.view
public_data.export
```

## Scope evaluation

Authorization combines permission and scope. A request is allowed only when both match.

```text
allowed = role_has_permission AND record_is_within_assigned_scope
```

The backend must return `403 Forbidden` when an authenticated user lacks permission or scope. A missing record should return `404 Not Found`. The UI should render an access-denied screen and avoid leaking protected record names.
