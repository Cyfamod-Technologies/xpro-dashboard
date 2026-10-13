# Data Model

## Core entities

- User
- Role
- Permission
- ManagerScope
- Country
- AdministrativeArea
- Program
- Campaign
- TrackedProject
- ProjectVersion
- Allocation
- AllocationVersion
- Agency
- Evidence
- Action
- Outcome
- Submission
- ReviewDecision
- Notification
- AuditEvent
- ImportJob

## Key relationships

```text
Country 1--* AdministrativeArea
Country 1--* Program
Program 1--* Campaign
Program 1--* TrackedProject
Campaign 0..1--* TrackedProject
TrackedProject 1--* ProjectVersion
TrackedProject 1--* Allocation
Allocation 1--* AllocationVersion
TrackedProject *--* AdministrativeArea
TrackedProject *--* Agency
ProjectVersion 1--* Evidence
TrackedProject 1--* Action
Action 0..1--1 Outcome
Submission 1--1 proposed version
Submission 1--* ReviewDecision
```

## Versioning principle

Stable entities provide identity; version entities hold content. The public projection points to an approved published version. A pending revision coexists with the public version and cannot modify it.

## Nigerian state geographic model

Administrative geography should support a hierarchy rather than fixed `state` and `lga` columns only. Each area has a type, parent, country, code, and name. The platform configures Nigeria, its states and the Federal Capital Territory, their LGAs, and optional communities. Niger is an interface default, not a schema constraint.

Money values must store amount, currency, and precision safely. Fiscal year must not be inferred from the calendar date alone.

## Provenance

Important allocation and status fields should include source references. Evidence and imports should preserve uploader/importer, timestamps, source filename or URL, and validation results.
