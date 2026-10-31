# Xpro Dashboard Documentation

This repository contains the Xpro customer, provider, and staff web prototype.
The current product flows are documented in [Xpro frontend UI flows](flows/xpro-frontend-ui.md).
Use [architecture](architecture/README.md) for the implemented frontend,
[development](dev.md) for local setup and checks, [branding](design/xpro-branding.md)
for visual tokens, the [table and details standard](design/table-details-standard.md)
with the [Action queue](design/admin-action-queue.md) and [Requests](design/admin-requests.md) admin designs, and the [web and server auth plan](api/auth-web-server-plan.md)
for backend integration work. The [dashboard ↔ API coverage map](api/README.md)
lists each current page capability, required request, source-wiring status and completion percentage.

The dashboard can run with mock auth and browser-local workflow state, or use
partial live API workflows with mocks disabled. The independent `xpro-server`
repository supplies the API. Several auth paths and live pages still need
alignment; see the coverage map for the current source-code audit. Use verified
API behavior as the source of truth when completing an integration.
