# Password Recovery

## Flow

1. User selects **Forgot password**.
2. User submits email.
3. UI always displays a neutral confirmation.
4. For an eligible account, backend sends a single-use expiring reset link.
5. User opens the link and enters a new password twice.
6. Backend validates token and password requirements, changes the password, consumes the token, and revokes existing sessions.
7. System audits the reset and sends a security notification.
8. User signs in and completes MFA where required.

## Administrative reset

A Super Admin may trigger the same reset email but cannot see or choose the final password. Resetting does not change role or restore a suspended account.

## Failure states

Expired, used, or invalid links offer a fresh recovery request. Rate limiting applies to requests and attempts.
