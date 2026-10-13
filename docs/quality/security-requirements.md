# Security Requirements

- No secret, private API credential, or MFA seed in the frontend bundle.
- Manager/Super Admin MFA enforced server-side.
- Viewer role fixed server-side during signup.
- Rate limits and generic responses for authentication endpoints.
- Route, resource, export, search, and file authorization tested.
- Published/viewer serializers exclude internal fields by construction.
- Upload size/type/malware validation completed before use.
- Rich text and filenames rendered safely.
- Security headers reviewed for production.
- Dependencies scanned and critical findings resolved or explicitly accepted.
- Session cookies/tokens use suitable secure storage and lifecycle controls.
- Audit logs cannot be modified through application APIs.
- Backups and restoration are tested before launch.
- Logs and monitoring exclude credentials and restricted payloads.

Security review is required before enabling public registration or production file upload.
