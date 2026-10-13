# Frontend Architecture

## Current foundation

The repository uses Vue 3, Vite, TypeScript, Vue Router, Vuetify, Pinia-capable dependencies, CASL, charting libraries, and Mapbox GL. The existing application shell should be retained where useful, while demo pages and unused navigation are removed as product screens are introduced.

## Recommended source organisation

```text
resources/ts/
├── app/
│   ├── router/
│   ├── guards/
│   └── providers/
├── features/
│   ├── auth/
│   ├── administration/
│   ├── programs/
│   ├── projects/
│   ├── allocations/
│   ├── evidence/
│   ├── approvals/
│   ├── viewer/
│   └── audit/
├── shared/
│   ├── api/
│   ├── components/
│   ├── composables/
│   ├── constants/
│   ├── formatters/
│   ├── types/
│   └── validation/
├── layouts/
├── pages/
└── styles/
```

This is a target organisation, not an instruction to move every current file at once. New product work should use feature boundaries and shared primitives deliberately.

## State

- Server data should be treated as cached remote state, not duplicated casually across stores.
- Authentication/session state should have one authoritative frontend store.
- Draft form state belongs close to the form and should not leak into unrelated global state.
- Filters that users expect to share or revisit should be reflected in query parameters.

## Routing

Route metadata should describe authentication, role, and permission requirements. A global guard may improve navigation, but API authorization remains mandatory.

## API layer

All requests should pass through one typed client that handles:

- Base URL configuration
- Credentials or tokens
- Correlation/request IDs
- Normalised validation errors
- `401` session expiry
- `403` access denial
- Safe retry rules
- Abort signals for superseded searches

## Components

Domain screens should compose reusable primitives such as `StatusChip`, `MoneyValue`, `LocationBreadcrumb`, `ApprovalTimeline`, `RevisionDiff`, `VisibilityBadge`, `EvidenceCard`, and `EmptyState`. Domain rules should not be hidden inside generic visual components.

## Quality

New code must pass type checking and production build. Critical authorization, revision, and form behaviours should be tested before release.
