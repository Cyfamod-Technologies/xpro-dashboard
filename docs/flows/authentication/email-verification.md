# Email Verification

## Flow

1. User opens the single-use verification link.
2. Frontend passes the opaque token to the backend.
3. Backend validates token hash, account, purpose, and expiry.
4. Email is marked verified and the token is consumed.
5. Viewer account becomes active automatically. If MFA is enabled on a Manager or Super Admin account, activation continues to the MFA challenge when they sign in.
6. System audits the event and shows a success destination.

## Resend

The user can request a replacement after a visible cooldown. The response remains generic. A new token invalidates older unused verification tokens.

## Exceptions

- Expired token: show **Send a new link**.
- Already used: offer login.
- Invalid token: show a safe error and restart path.
- Suspended account: verification does not restore it.

Verification links must not contain role, permission, or personally sensitive data.
