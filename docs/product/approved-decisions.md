# Approved Decisions

This page summarises the product decisions approved during discovery. Detailed rationale is recorded in `../decisions/`.

| Topic                     | Decision                                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Visual starting point     | Build on the current dashboard shell and adapt it to Xpro branding and workflows                                           |
| Colour palette            | Use Xpro blue `#4AA7DF` with white action text and blue-grey secondary tokens                                              |
| Typography                | Retain Public Sans from the current codebase                                                                               |
| Roles                     | Super Admin, Manager, and Budget Viewer only for the first release                                                         |
| Manager onboarding        | Invitation-only through a Super Admin                                                                                      |
| Viewer onboarding         | Public self-registration with email verification and automatic activation                                                  |
| Super Admin onboarding    | Secure setup or invitation by an existing Super Admin; never public signup                                                 |
| Manager responsibility    | Handles program, project, allocation, evidence, action, and submission responsibilities                                    |
| Publication authority     | Super Admin provides final approval before information becomes visible to viewers                                          |
| Source of truth           | This platform is authoritative for the records it manages                                                                  |
| Geographic architecture   | Nigeria is the platform country; Budget Viewers can select a state and default to Niger; country and state remain explicit |
| Public information        | Approved project information, allocation details, and explicitly public evidence/action content                            |
| Published updates         | Immutable; changes create a new revision that requires Super Admin approval                                                |
| Completion                | Requires an approved, verified outcome or formal closure; “Take Action” alone is not completion                            |
| Offline use               | Deferred to a later release                                                                                                |
| Donor access              | Donors are metadata/funding entities in the MVP, not user accounts                                                         |
| Existing-system migration | None required; this is a new system with new data                                                                          |
| Initial data loading      | CSV import should be supported                                                                                             |
| Internal finance          | Xpro confidential expenses and banking are outside the public budgeting scope                                              |

## Change control

Changing a decision requires:

1. A written reason.
2. Impact assessment across product, data, API, design, and security documents.
3. A new or superseding architecture decision record.
4. Product-owner approval before implementation.
