# Action and Outcome Fields

## Action

### Identity and context

- Stable action ID
- Tracked project ID
- Title
- Issue or context description
- Action type
- Owner or responsible team
- Country, location, and agency context

### Progress and visibility

- Status: `OPEN`, `IN_PROGRESS`, `BLOCKED`, `RESOLVED`, or `CANCELLED`
- Due date and completion date
- Internal notes
- Public guidance or call to action
- Proposed visibility
- Related evidence IDs

## Outcome

- Stable outcome ID
- Related action ID or project ID
- Result summary
- Outcome status: `PROPOSED`, `VERIFICATION_REQUIRED`, `VERIFIED`, or `FORMALLY_CLOSED`
- Verification date
- Verifier and verification notes
- Supporting evidence IDs
- Proposed public summary and visibility

Actions and outcomes are versioned through the containing project revision when they affect viewer-facing information. Internal notes and restricted evidence are never returned by viewer-safe endpoints.
