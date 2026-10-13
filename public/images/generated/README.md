# Generated images (demo only)

AI-generated with Figma AI (gemini-3.1-flash-lite-image) on 13 Oct 2026 for the
public-site demo. They show **work scenes, not people's portraits**, so no image
passes for a real provider's identity.

Replace them with real XPro project photos before launch.

| File | Used for |
|---|---|
| `providers/provider-nneka.jpg` | Nneka Services (demo provider) card and profile cover |
| `providers/provider-aisha.jpg` | Aisha Material Supply (demo provider) card and profile cover |
| `services/design.jpg` | Fallback cover for Design providers and jobs |
| `services/construction.jpg` | Fallback cover for Construction |
| `services/hire.jpg` | Fallback cover for Hire |
| `services/procurement.jpg` | Fallback cover for Procurement |
| `services/facility-management.jpg` | Fallback cover for Facility management |
| `services/waste-management.jpg` | Fallback cover for Waste management |

## Popular-job images (`jobs/`)

These are named `{service}-{job}.jpg` and used on the homepage "Popular jobs"
cards. Six jobs reuse a service image instead of a separate file:

| Job | Image |
|---|---|
| Architectural plans | `services/design.jpg` |
| Floor tiling | `services/construction.jpg` |
| Excavator hire | `services/hire.jpg` |
| Cement and blocks | `services/procurement.jpg` |
| Generator and HVAC servicing | `services/facility-management.jpg` |
| Construction debris removal | `services/waste-management.jpg` |
| Residential waste collection | `services/waste-management.jpg` — **temporary**. Its own image wasn't generated because the Figma AI limit was hit; generate `jobs/waste-residential-waste-collection.jpg` later |

Images are 1024 px wide JPEGs. Card layouts should use `object-fit: cover`.
