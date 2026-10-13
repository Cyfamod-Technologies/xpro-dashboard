# ADR 007: Nigerian State-Selectable Budget Views

- **Status:** Accepted
- **Supersedes:** ADR 005
- **Decision:** Treat Nigeria as the platform country, allow Budget Viewers to select a state, and use Niger as the default state.

## Consequences

- Country and state remain explicit on projects, locations, API requests, exports, and saved views.
- The viewer sidebar owns the active state context and starts with Niger.
- Dashboard metrics, project results, LGA options, and exports use the same server-enforced state filter.
- A state with no approved public data returns an empty result rather than falling back to Niger or exposing draft records.
- Administrative geography supports Nigeria's 36 states and the Federal Capital Territory, with configurable LGA and community hierarchies.
- Manager access remains separately constrained by assigned state, LGA, Program, or Project scopes.
