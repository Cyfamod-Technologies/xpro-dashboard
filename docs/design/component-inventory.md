# Component Inventory

## Shared primitives

- `AppPageHeader`
- `ContextFilterBar`
- `MetricCard`
- `StatusChip`
- `VisibilityBadge`
- `MoneyValue`
- `FiscalYearLabel`
- `LocationBreadcrumb`
- `DataTableShell`
- `FilterDrawer`
- `EmptyState`
- `ErrorState`
- `ConfirmationDialog`
- `FileUploader`
- `EvidenceCard`
- `AuditTimeline`
- `NotificationMenu`

## Workflow components

- `SubmissionReadinessChecklist`
- `ApprovalTimeline`
- `RevisionDiff`
- `ViewerPreview`
- `ReviewDecisionPanel`
- `ChangesRequestedPanel`
- `ImportValidationTable`
- `ProjectStatusTimeline`
- `TakeActionPanel`

## Form sections

- Program identity
- Project identity and source
- Location selector
- Agency selector
- Allocation editor
- Evidence metadata
- Visibility selector
- Action and outcome editor

Components should receive typed values and emit events. Authorization and workflow transitions belong in feature services/composables, not visual primitives.
