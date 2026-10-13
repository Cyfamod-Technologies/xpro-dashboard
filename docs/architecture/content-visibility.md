# Content Visibility

## Levels

| Level | Audience | Typical content |
| --- | --- | --- |
| Public | Future anonymous audience if enabled | Explicitly approved public project information |
| Registered Viewer | Verified Budget Viewers and staff | Approved allocation and project views |
| Internal | Managers in scope and Super Admins | Drafts, internal notes, non-public evidence |
| Restricted | Explicitly authorised staff | Sensitive personal, security, or investigative material |

## MVP viewer boundary

Budget Viewers may receive:

- Approved project title and description
- Program
- Nigerian state, LGA, and approved project location
- Fiscal year
- Responsible agency
- Allocation amount and source
- Approved status and last verified date
- Evidence explicitly approved for viewer access
- Approved Take Action instructions

Budget Viewers must not receive:

- Draft or rejected revisions
- Review comments or rejection reasons
- Internal assignments
- Private citizen identities
- Staff personal information
- Bank details or Xpro internal expenses
- Unverified allegations
- Restricted files or file URLs
- Global audit information

## Enforcement

Visibility is enforced in queries, serializers, file access, exports, search indexes, caches, and notifications. Hiding a frontend component is insufficient.

Managers propose visibility. Super Admin approval confirms what becomes viewer-visible. Changing a published item's visibility creates a revision.
