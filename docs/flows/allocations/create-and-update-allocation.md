# Create and Update Allocation

## Fields

- Tracked Project
- Fiscal year
- Amount and currency
- Budget source and classification
- Responsible agency
- Budget/reference code
- Source document or URL
- Notes and proposed viewer visibility

## Flow

1. Manager adds an allocation inside a project draft or revision.
2. Backend validates scope, currency, precision, year, source, and non-negative value.
3. UI calculates totals without replacing authoritative backend calculations.
4. Allocation is submitted with the project or as an allocation revision.
5. Super Admin compares the proposed value with the currently published allocation.
6. Approval publishes the new allocation version.

Published amounts cannot be edited in place. Corrections require a revision and reason.
