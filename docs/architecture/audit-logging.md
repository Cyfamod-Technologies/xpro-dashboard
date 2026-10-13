# Audit Logging

## Purpose

Audit history proves who changed, reviewed, approved, published, accessed, or administratively altered important records.

## Required fields

- Event identifier
- Actor identifier and role at the time
- Timestamp in UTC
- Action
- Resource type and identifier
- Country/program scope where applicable
- Previous and new values for controlled changes
- Reason or review comment where required
- Request/correlation identifier
- Session or source metadata according to privacy policy

## Required events

- Authentication and security changes
- User invitation, activation, suspension, restoration, and archival
- Role and Manager scope changes
- Program, project, allocation, evidence, action, and outcome changes
- Submission, approval, rejection, changes requested, and publication
- Export and bulk import
- File replacement or visibility change
- Administrative configuration changes

## Immutability and access

Application users cannot edit or delete audit events. Super Admins can search the global log. Managers see record history within their scope but not sensitive system-security details. Budget Viewers do not access the audit log.

Audit retention, export, and deletion rules must be decided with Xpro policy before production.
