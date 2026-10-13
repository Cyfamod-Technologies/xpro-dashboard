# Budget Dashboard

## Entry

An active verified Budget Viewer lands at `/budget`. All data comes from viewer-safe approved endpoints.

## Dashboard

- State selector in the viewer sidebar, defaulted to Niger
- LGA and reporting-period filters scoped to the selected state
- Total approved allocation
- Number of published tracked projects
- Allocation by Program, country, location, sector, agency, and fiscal year
- Project tracking-status distribution
- Recently verified updates
- Projects requiring action
- Map coverage where data quality permits

Every card or chart links to the filtered project list. Amounts always show currency and fiscal-year context. Mixed currencies are not summed without an explicitly documented conversion basis.

Changing the state refreshes dashboard metrics, projects, allocation groupings, and state-dependent filter options. Nigeria remains the fixed country context. A state with no published records shows a clear empty state rather than falling back to another state's data.

## States

Loading uses stable skeletons. Empty results explain active filters. Errors offer retry. Restricted or draft information never appears in chart payloads, tooltips, downloads, or client-side caches.
