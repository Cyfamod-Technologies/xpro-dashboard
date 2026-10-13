# XPro frontend UI implementation

Build customer, provider and admin browser prototypes with mock data only.
Keep backend and React Native work separate. Match the existing Vue/Vuetify
structure, components and semantic XPro theme colours.

All roles share `/` as their landing route. The current account selects the
home screen, navigation and permitted `/workspace/:section` pages. This is
prototype navigation behaviour; real server authorization belongs to later
backend integration.

## Flow order

1. Access and workspace shell: sign-in, customer/provider registration,
   verification, recovery, logout and role-specific navigation.
2. Service requests and admin intake: all six service lines, My Tasks and review.
3. Provider onboarding and admin verification.
4. Dispatch, assignment offers and provider responses.
5. Provider costing, admin quotes and customer decisions.
6. Scheduling, confirmation and rescheduling.
7. Job execution, evidence and progress tracking.
8. Conversations, files and notification UI.
9. Completion acknowledgement, exceptions and closure.
10. Operational overview, activity history and account/settings refinement.

Review each flow before starting the next. Use shared mock records so actions,
lists, detail views and status history remain consistent. Include loading,
empty, validation, failure, success and confirmation states as relevant.

## Flow 1

The first slice adapts existing authentication screens and supplies separate
customer, provider and admin home components, navigation and account views.
Future sections have empty-state shells, not implemented business workflows.
Customer/provider mock signup accounts can be verified and used to sign in.
Registration and password edits exist only for the current preview lifetime.
Refreshing resets these changes; seeded demo accounts remain available.

Validate lint, type checking and build, then inspect desktop/narrow browser
layouts and the sign-in, navigation, denied-section and logout journeys.
