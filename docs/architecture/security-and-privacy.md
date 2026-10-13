# Security and Privacy

## Baseline controls

- HTTPS in every non-local environment
- Secure password hashing on the backend
- Email verification
- MFA for Manager and Super Admin roles
- Rate limiting for signup, login, recovery, imports, and uploads
- CSRF protection when cookie sessions are used
- Strict authorization on every endpoint and file
- Safe upload type, size, and malware validation
- Secrets stored outside the frontend bundle and repository
- Dependency and container vulnerability scanning
- Security headers and restrictive content policy where practical
- Backups and tested restoration
- Centralised error monitoring without confidential payloads

## Public registration controls

Viewer signup should use bot protection where needed, generic account-existence responses, verification expiry, resend limits, duplicate detection, and optional disposable-email controls.

The backend always assigns the Viewer role and ignores client-supplied role or permission values.

## Sensitive content

Private citizens, children, whistleblowers, exact vulnerable locations, internal investigations, personal contacts, banking, credentials, unpublished images, and unverified allegations require internal or restricted classification.

## Data minimisation

Collect only information needed for the defined workflow. Avoid storing raw authentication secrets, unnecessary device fingerprints, or personal data in free-text fields.

## Frontend precautions

- Do not place tokens or confidential record data in URLs.
- Do not persist restricted API responses in long-lived browser storage.
- Clear session state on logout and permission changes.
- Escape or sanitise rich text and uploaded filenames.
- Avoid exposing backend stack traces.
- Treat authorization failures as expected application states.
