# Performance Requirements

## User experience targets

- Role dashboard shows a useful loading state immediately.
- Search input debounces and cancels superseded requests.
- Lists use server pagination and avoid downloading complete datasets.
- Charts and maps load lazily when below the fold or not required.
- Large uploads show progress and remain cancellable where supported.
- Import jobs run asynchronously and can be revisited.

## Frontend controls

- Route-level code splitting
- Image thumbnailing and responsive delivery
- Stable skeletons to avoid layout shift
- Cached reference data with safe invalidation
- Virtualisation only for genuinely large client-rendered lists
- Bundle analysis before production release

Performance should be measured on representative Nigerian mobile/slow-network conditions, not only a developer laptop. Specific numeric budgets should be set after the first real screens and API environment exist.
