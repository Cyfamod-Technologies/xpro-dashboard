# Account Suspension and Offboarding

## Suspension

1. Super Admin opens the user record.
2. Admin selects **Suspend**, enters a reason, and confirms.
3. Backend changes state to `SUSPENDED`, revokes sessions and active security tokens, and audits the action.
4. Assigned draft work remains intact but cannot be changed by the suspended user.
5. Admin receives a list of active assignments requiring transfer.

Suspension is reversible. Restoration requires confirmation and does not silently expand scope.

## Offboarding

1. Admin transfers programs, projects, submissions, and review responsibilities.
2. Admin archives the account.
3. Backend revokes sessions, invitations, reset tokens, and active access.
4. Historical authorship and audit events remain linked to the archived identity.

Accounts and audit history are not hard-deleted through the normal interface.
