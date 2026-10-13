# Authentication and Authorization

## Account entry paths

- Budget Viewers use public signup and activate automatically after verifying email.
- Managers are invited by Super Admins.
- Super Admins are created through secure setup or an existing Super Admin invitation.

## Authentication requirements

- Verified email is required before access.
- MFA is bypassed until it is enabled on the individual account.
- When `mfaRequired` is enabled for an account, sign-in must complete the MFA challenge before access is granted.
- Password reset links and invitations are single-use and time-limited.
- Security-sensitive changes require recent authentication.
- Sessions can be inspected and revoked.

## Authorization model

Roles provide permission sets; Manager assignments provide scope. The backend evaluates both for every protected request.

Example:

```text
Manager has projects.manage
AND project.program_id is in Manager's assigned programs
=> edit is allowed
```

Viewer APIs return only approved projections. They do not return internal fields and rely on the frontend to hide them.

## Frontend route outcomes

```text
super_admin   -> /admin/dashboard
manager       -> /dashboard
budget_viewer -> /budget
```

Unverified accounts are sent to email verification. Users whose account has MFA enabled and who have not completed it are sent to the MFA challenge. Locked, suspended, or archived accounts are denied access with an appropriate recovery or support message.

## Account states

```text
Viewer:  UNVERIFIED -> ACTIVE -> LOCKED | SUSPENDED -> ARCHIVED
Manager: INVITED -> ACTIVE -> LOCKED | SUSPENDED -> ARCHIVED
Admin:   ACTIVE -> LOCKED | SUSPENDED -> ARCHIVED
```

## Security events

Login failures, password resets, MFA changes, invitation use, session revocation, role changes, scope changes, suspension, and Super Admin creation must be audited.
