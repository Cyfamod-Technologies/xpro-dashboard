# Flow Index

Each flow defines an observable user journey. Implementations may split screens differently, but must preserve the stated authorization, validation, state transitions, and completion conditions.

## Authentication

- [Viewer registration](authentication/viewer-registration.md)
- [Manager invitation](authentication/manager-invitation.md)
- [Login and role redirect](authentication/login-and-role-redirect.md)
- [Email verification](authentication/email-verification.md)
- [Password recovery](authentication/password-recovery.md)
- [Multi-factor authentication](authentication/multi-factor-authentication.md)
- [Account suspension and offboarding](authentication/account-suspension-and-offboarding.md)

## Administration

- [User management](administration/user-management.md)
- [Manager access management](administration/manager-access-management.md)
- [Location management](administration/location-management.md)
- [System configuration](administration/system-configuration.md)

## Programs and projects

- [Create and manage program](programs/create-and-manage-program.md)
- [Assign program Managers](programs/assign-program-managers.md)
- [Create project](projects/create-project.md)
- [Project lifecycle](projects/project-lifecycle.md)
- [Submit project for approval](projects/submit-project-for-approval.md)
- [Review and publish project](projects/review-and-publish-project.md)
- [Update published project](projects/update-published-project.md)
- [Project evidence](projects/project-evidence.md)
- [Complete and archive project](projects/complete-and-archive-project.md)

## Allocations

- [Create and update allocation](allocations/create-and-update-allocation.md)
- [Allocation approval](allocations/allocation-approval.md)
- [CSV data import](allocations/csv-data-import.md)

## Viewer

- [Budget dashboard](public-viewer/budget-dashboard.md)
- [Search and filter projects](public-viewer/search-and-filter-projects.md)
- [View project details](public-viewer/view-project-details.md)
- [Take Action](public-viewer/take-action.md)

## Actions and outcomes

- [Actions and outcomes](actions/action-and-outcome-workflow.md)

## Approvals

- [Manager submission](approvals/manager-submission.md)
- [Admin review](approvals/admin-review.md)
- [Changes requested](approvals/changes-requested.md)
- [Revision publication](approvals/revision-publication.md)

## Shared flow rules

- A user must be authenticated and authorised for staff flows.
- A Manager must be within the record's assigned scope.
- A Budget Viewer sees approved public projections only.
- Validation errors preserve entered form data.
- Destructive or irreversible actions require explicit confirmation.
- Every state transition returns an updated resource and produces an audit event.
- Notifications must link to an authorised destination.
