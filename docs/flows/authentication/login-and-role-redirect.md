# Login and Role Redirect

## Flow

1. User enters email and password.
2. Backend verifies credentials using rate-limited, generic failure responses.
3. Backend checks account state and email verification.
4. If MFA is required, user completes the challenge.
5. Backend creates or rotates the secure session and returns the current user plus effective permissions/scopes.
6. Frontend loads authenticated state and redirects:

```text
Super Admin   -> /admin/dashboard
Manager       -> /dashboard
Budget Viewer -> /budget
```

7. The first destination loads data from a role-appropriate endpoint.

## State handling

- `UNVERIFIED`: direct to verification guidance.
- `INVITED`: direct to invitation completion.
- `LOCKED`: explain temporary lock and recovery route.
- `SUSPENDED` or `ARCHIVED`: deny access and show support guidance.
- Unknown authenticated role: deny access safely and log configuration error.

## Existing session

Visiting login with a valid session redirects to the role home. On `401`, the frontend clears session state and returns to login with the intended safe destination. Redirect parameters must only permit local application routes.
