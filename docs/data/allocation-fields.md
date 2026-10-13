# Allocation Fields

- Stable allocation ID
- Parent Project
- Fiscal year
- Amount
- ISO currency
- Budget source
- Classification/category
- Responsible agency
- Budget/reference code
- Source document or URL
- Notes
- Proposed viewer visibility
- Revision number and base version
- Approval/publication metadata

Amounts must use safe decimal/minor-unit handling rather than binary floating point. Currency is mandatory. Negative amounts are rejected unless a future adjustment model explicitly supports them.

Viewer totals include only approved published allocation versions. Mixed currencies are grouped, not silently summed.
