# Multi-Factor Authentication

## Enrollment

1. Backend generates an MFA secret and setup challenge.
2. User scans the authenticator QR code or enters the secret manually.
3. User submits a current code to prove enrollment.
4. Backend activates MFA and returns one-time recovery codes.
5. UI instructs the user to store recovery codes safely and does not display them again.
6. Enrollment is audited and a security notification is sent.

## Login challenge

After password authentication, the user enters an authenticator code or unused recovery code. Successful recovery-code use invalidates that code and warns the user about the remaining set.

## Reset

Super Admin MFA reset requires recent Super Admin authentication, explicit confirmation, a reason, and audit logging. A Super Admin must not disable their own last protection without a verified replacement method.

MFA is mandatory for Managers and Super Admins and optional for Budget Viewers.
