# Xpro Branding

The dashboard keeps the source project's layout and Public Sans typography.
Its primary colour is the supplied Xpro blue `#4AA7DF`.

## Tokens

Define runtime colours in `resources/ts/plugins/vuetify/theme.ts` and consume
Vuetify semantic tokens in components and styles.

| Token           | Light     | Dark      |
| --------------- | --------- | --------- |
| Primary         | `#4AA7DF` | `#4AA7DF` |
| Primary darken  | `#318EC6` | `#318EC6` |
| On primary      | `#FFFFFF` | `#FFFFFF` |
| Brand backdrop  | `#102A3A` | `#102A3A` |
| Secondary       | `#526A82` | `#A7C3DA` |
| Page background | `#F5F8FB` | `#101E2A` |
| Card surface    | `#FFFFFF` | `#172B3B` |

Text and icons on filled primary buttons, active navigation and primary
backgrounds use white, as requested. The auth story uses a separate navy
backdrop token so its white copy stays visible. Status colours retain their semantic roles.
The existing application defaults to light mode; dark tokens are ready for
future theme switching. Keep loader branding in `index.html` in sync.

## Mark

`public/images/xpro-logo-transparent.png` is the platform logo with its white
background removed, used in navigation, authentication, the loader and browser
icon. The supplied original remains in `public/images/xpro-logo.png`. Preserve
its proportions and transparency; do not add a white CSS backing. Hide duplicate platform titles beside it.

## Public company details

Source: [Xpro about page](https://xpro.ng/about.php).

- Name: Excellent Professionals and Procurement
- Email: `admin@xpro.ng`
- Location: Abuja, Nigeria
- Address: 63 Claude Ake Street, 2nd Avenue, Abuja
- Address: No. 4 Aminu Ifesinachi Crescent, Abuja

These details are centralised in `resources/ts/utils/branding.ts`. They do not
change the inherited prototype accounts or operational geography defaults.

## Reference workflows

Inherited product documentation describes example operations and budget flows.
It is reference material for the scaffold rather than an approved Xpro scope.
