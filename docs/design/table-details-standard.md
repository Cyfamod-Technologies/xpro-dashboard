# Table and details standard (admin pages)

Every admin work queue is a **table that opens a details page**. The reference is the admin **Providers** page: `resources/ts/features/operations/ProviderAdminDirectory.vue` (table) and `ProviderAdminDetails.vue` (details), routed by `resources/ts/pages/admin/providers/[id].vue` (`definePage({ meta: { adminSection: "providers" } })`). Reuse these Vuetify components and spacing; do not invent new ones. Messages is the one exception (chat layout, see xpro-doc `plans/admin-redesign/chat-standard.md`).

Pages that follow it: [Action queue](admin-action-queue.md), [Requests](admin-requests.md), Providers (already), Staff (xpro-doc `plans/admin-redesign/13-staff.md`).

## Table page

- A filters `VCard` (`VCardText > VRow`, `VTextField` search with `tabler-search`, clearable, 300 ms debounce, and `VSelect` filters, all `hide-details`), then an error `VAlert type="error" variant="tonal"`, then a `VCard` holding a `VDataTableServer`.
- `VDataTableServer` with `v-model:page`, `v-model:items-per-page` (options 10, 25, 50), unsortable headers, `loading`, and a `no-data-text` that names the filters.
- First column: `<strong>` name, then a `text-body-2 text-medium-emphasis` second line. Status as `VChip size="small" variant="tonal"`. Last column: `VBtn size="small" variant="text"` "Open details", aligned to the end.
- Any filter or search change resets the page to 1. Filter, page and search live in the URL query so Back restores them.

## Details page

- Loading: centred `VProgressCircular` with an aria-label. Error: `VAlert` tonal with a Retry button.
- Header: back icon button (`tabler-arrow-left`, aria-label), breadcrumb "Admin workspace / {Page}" in `text-body-2 text-medium-emphasis`, `h1.text-h4`, status `VChip`s, then action buttons.
- A dismissible success `VAlert` after each command.
- Body: `VRow` with `VCol lg=8` (stacked `VCard class="mb-5"`, each with a `VCardTitle` and fields labelled by `text-caption text-medium-emphasis`) and `VCol lg=4` (the actions card, "People" or "Summary" cards). Cards that do not apply are not rendered. No tabs.
- Commands: a `VDialog max-width="560" persistent` with a title, a description, a required note `VTextarea` where the action needs a reason, an error `VAlert`, and Cancel and confirm buttons.
- Back goes to the page the user came from (`?from=`), with its filters; the fallback is the table.
