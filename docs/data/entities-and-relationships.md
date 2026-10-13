# Entities and Relationships

## Identity and access

- `User` has one current Role and account state.
- `ManagerScope` connects a Manager to states, LGAs, Programs, or Projects.
- `Session`, `Invitation`, and verification/reset/MFA records support authentication.

## Domain

- `Program` belongs to the Nigeria operating scope and may cover one or more states.
- `Campaign` optionally groups Projects within a Program.
- `TrackedProject` has stable identity and multiple `ProjectVersion` records.
- A Project belongs to a Program and may belong to a Campaign.
- A Project relates to multiple administrative areas and agencies.
- `Allocation` has stable identity and multiple `AllocationVersion` records.
- Evidence attaches to a proposed version and gains viewer visibility only through publication.
- Actions belong to Projects; Outcomes relate to Actions or Projects.

## Workflow

- `Submission` targets one proposed version.
- `ReviewDecision` records every review cycle and decision.
- The stable resource points to the current published version.
- `AuditEvent` records security, administrative, and domain actions.
- `ImportJob` groups rows, validation, and created drafts.

Database design should enforce important uniqueness and referential rules in addition to application validation.
