# Goals and Scope

## Goals

The first release must:

1. Establish a secure three-role authentication model.
2. Let Super Admins invite Managers.
3. Let Budget Viewers self-register and activate their account through email verification.
4. Manage Nigerian state locations, programs, tracked projects, allocations, evidence, and actions.
5. Make the dashboard the source of truth for those records.
6. Require Super Admin approval before new or changed information becomes visible to viewers.
7. Preserve a complete revision and approval history.
8. Provide useful dashboards, search, filters, and exports for approved budgeting data.
9. Support state-selectable Nigerian data with explicit country, state, LGA, and community context; default the interface to Nigeria and Niger.
10. Build on the current frontend shell and adapt it to Xpro branding and workflows.

## In scope for the MVP

- Login, logout, session management, and password recovery
- Email verification
- Viewer self-registration
- Manager invitation and activation
- Mandatory MFA for Super Admins and Managers
- User suspension and offboarding
- Role- and scope-based authorization
- Nigerian state, LGA, and administrative-location reference data
- Program management
- Tracked Project management
- Government allocation management
- Evidence metadata and file upload
- Public visibility classification
- Draft, submission, review, approval, publication, and revision workflows
- Action-required and outcome tracking
- Dashboard summaries and maps
- Search, filters, saved views, pagination, and exports
- CSV import with preview and row validation
- Notifications
- Audit history
- Responsive and accessible presentation

## Explicitly out of scope for the MVP

- Offline-first field operation
- Donor accounts
- Field Officer, Finance Reviewer, or M&E-specific roles
- Public anonymous access unless separately approved
- Xpro payroll, bank accounts, staff expenses, or vendor payments
- Accounting-system integration
- Migration from another issue tracker
- Automated predictive risk or anomaly detection
- A fully configurable workflow builder
- Native mobile applications

## Future-compatible requirements

The implementation should permit later addition of:

- New roles without schema redesign
- Offline PWA capture
- Donor-scoped reporting
- Public anonymous pages
- Accounting or identity-provider integrations
- Additional geographic structures without changing the core project schema
- Program-specific project templates
- Multi-stage approval chains

## Constraints

- Frontend and backend are independent repositories and must run independently.
- The backend is the authorization authority; frontend guards are for experience, not security.
- Publicly visible data must always come from an approved version.
- Production code and assets must have a valid right of use.
- Nigeria is the platform country and Niger is the initial/default state; state selection must never bypass publication or role-based visibility rules.
