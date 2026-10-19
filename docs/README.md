# Xpro Dashboard Documentation

This repository contains the Xpro customer, provider, and staff web prototype.
The current product flows are documented in [Xpro frontend UI flows](flows/xpro-frontend-ui.md).
Use [architecture](architecture/README.md) for the implemented frontend,
[development](dev.md) for local setup and checks, [branding](design/xpro-branding.md)
for visual tokens, and the [web and server auth plan](api/auth-web-server-plan.md)
for backend integration work.

The frontend prototype uses mock auth and browser-local workflow state. The
independent `xpro-server` repository supplies the backend starter; its current
API and data model are not yet aligned with all Xpro web flows. Treat the auth
plan as a work plan, and use code and verified API behavior as the source of truth
when implementing an integration.
