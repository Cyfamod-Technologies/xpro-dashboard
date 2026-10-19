# Frontend structure

## Runtime

The app is Vue 3 and TypeScript, built with Vite. Vuetify supplies UI controls
and layouts, Pinia holds application state, and Vue Router uses route files from
`resources/ts/pages`. `resources/ts/main.ts` starts the Mock Service Worker when
`VITE_ENABLE_MOCKS` is not `false`, registers plugins and mounts `App.vue`. Mock
requests that have no handler pass through to the configured API origin.

`resources/ts/layouts/default.vue` selects `PublicShell` for routes marked
`publicSite`; workspace routes use the configured horizontal or vertical
navigation layout. Auth screens use the blank layout. Route metadata and the
global guard decide access before a page renders.

## Source map

| Location                                                         | Responsibility                                                                                                   |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `resources/ts/pages`                                             | URL entry points and route metadata; workspace pages are thin wrappers.                                          |
| `resources/ts/features/discovery`                                | Public home, service discovery, and the customer request form.                                                   |
| `resources/ts/features/auth`                                     | Shared auth screen UI and validation.                                                                            |
| `resources/ts/features/workspace`                                | Role menus, service lines, section routing and workspace views.                                                  |
| `resources/ts/features/operations`                               | Request, provider, dispatch, quote, schedule, message, staff and approval UI; typed commands and workflow rules. |
| `resources/ts/stores/auth.ts`                                    | Current user, token, MFA challenge and session hydration.                                                        |
| `resources/ts/stores/operations.ts`                              | Demo business state, derived views and command execution.                                                        |
| `resources/ts/services/xpro-api.ts`, `resources/ts/utils/api.ts` | Prototype auth API adapter and HTTP client.                                                                      |
| `resources/ts/mocks`                                             | In-browser auth fixtures and MSW handlers.                                                                       |

`SectionView.vue` maps a section ID to the appropriate operations component.
The role-specific section list in `features/workspace/config.ts` is the source
for navigation and valid workspace section IDs. Six service lines are defined
there: Design, Construction, Hire, Procurement, Facility management and Waste
management.

## Request path

```text
Public home / services
  -> /request form (draft saved in sessionStorage)
  -> customer sign-in when needed
  -> operations.run({ type: "request.create", ... })
  -> applyCommand validates and returns the next demo state
  -> sessionStorage snapshot + reactive Pinia state
  -> customer, provider and staff views read role-specific projections
```

Other workflow screens follow the same `operations.run(command)` path. Auth
screens are separate: they call `authApi`, which currently resolves through MSW
when mocks are enabled. The business workflow does not call `xpro-server` yet.
