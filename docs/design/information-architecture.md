# Information Architecture

## Super Admin navigation

- Administration Overview
- Approval Queue
- Users
- Programs
- Projects
- Allocations
- Locations
- Imports
- Audit Log
- Settings

## Manager navigation

- Operations Overview
- My Work
- Programs
- Projects
- Allocations
- Evidence
- Actions and Outcomes
- Submissions
- Imports
- Notifications

## Budget Viewer navigation

- Budget Overview
- Explore Projects
- Programs
- Locations
- Projects Requiring Action
- Saved Views
- Exports

Navigation is generated from effective permissions, but route and API authorization are still enforced separately. Global search must use a role-appropriate index so protected names cannot leak through suggestions.

## Global shell

The existing sidebar and top bar should provide:

- Current role/context
- Country context, viewer state selector defaulted to Niger, and state-dependent LGA and period filters
- Search
- Create action for staff
- Notifications
- Help
- Profile and session controls
