# Viewer Registration

## Goal

Allow a person to create a read-only Budget Viewer account without administrative approval.

## Preconditions

- The person is not authenticated.
- Viewer registration is enabled.

## Flow

1. User selects **Create a Budget Viewer account** from the login page.
2. Signup explains that the account provides read-only access to approved budgeting information and cannot access operational drafts.
3. User provides full name, email, password, password confirmation, and accepts required terms.
4. Client performs usability validation; backend repeats authoritative validation.
5. Backend ignores any client role value and assigns `budget_viewer`.
6. Backend creates an `UNVERIFIED` account and sends a time-limited verification link.
7. UI shows a neutral confirmation and resend option with cooldown.
8. User verifies email.
9. Account becomes `ACTIVE`, the event is audited, and the user is directed to login or an authenticated Budget Dashboard session.

## Exceptions

- Existing email: return a generic sign-in/recovery message without exposing account state.
- Weak or breached password: reject with actionable requirements.
- Bot/rate limit: show retry guidance without revealing internal rules.
- Expired verification: offer a new link.
- Suspended existing account: do not create a duplicate; direct to support generically.

## Completion

The verified user can access `/budget` and cannot access Manager or Super Admin routes or mutation endpoints.
