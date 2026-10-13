# Manager Invitation

## Goal

Allow a Super Admin to onboard a Manager with defined operational scope.

## Flow

1. Super Admin opens **Users > Invite Manager**.
2. Admin enters name, official email, job title, unit, country/program scopes, and optional initial assignments.
3. System validates email uniqueness and that all scopes exist.
4. Admin reviews and sends the invitation.
5. Backend creates an `INVITED` Manager and a single-use expiring token.
6. Manager opens the email link. The link must match the invited email.
7. Manager confirms profile, creates a password, and accepts policies.
8. If MFA is enabled on the account, the Manager configures it and recovery codes are shown once.
9. Account becomes `ACTIVE`; invitation, activation, role, scope, and any MFA enrollment events are audited.
10. Manager lands on the Operations Dashboard and onboarding checklist.

## Administrative controls

Pending invitations can be resent after cooldown, revoked, or allowed to expire. Resending invalidates the previous token. Changing the invited email requires revoking and creating a new invitation.

## Completion

The Manager can access only assigned scopes. MFA configuration is required only when MFA has been enabled on the account.
