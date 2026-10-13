# Product Overview

## Purpose

The Xpro Operations Dashboard is a Nigerian state-level operational publishing system for managing programs, tracked public projects, government budget allocations, supporting evidence, public actions, and approved public versions.

It is not merely an analytics page. It must show what Xpro is tracking, where the work is located, who is responsible, what allocation is attached to it, whether the information has been reviewed, what action is needed, and which version is safe for viewers.

## Product actors

The first release has three roles:

- **Super Admin:** controls users and system reference data, has global access, and provides final approval for publication.
- **Manager:** creates and maintains assigned programs, projects, allocations, evidence, and action updates.
- **Budget Viewer:** creates a read-only account without administrative approval and sees approved public project and allocation data.

## Core value

For Xpro staff, the product provides a consistent workflow and source of truth. For viewers, it turns approved budget information into searchable, understandable project records with geographic context and clear opportunities to take action.

## Product hierarchy

```text
Nigeria
└── State
    └── Program
        └── Campaign (optional in the first release)
            └── Tracked Project
                ├── Allocation
                ├── Location
                ├── Evidence
                ├── Status update
                └── Action
```

Programs describe Xpro initiatives. Tracked Projects describe government-funded public projects monitored within those initiatives. This distinction must remain visible in labels, routes, database entities, and reports.

## Operating model

Managers work on drafts. Super Admins approve public content. Budget Viewers never see a draft, a rejected revision, or an internal comment.

```text
Draft -> Submitted -> Changes Requested or Approved -> Published
```

A published record cannot be overwritten. Any correction creates a revision and follows the same approval process.

## Geographic position

The platform country is Nigeria. Budget Viewers can select a state to change the public budget context, and the interface defaults to Niger. Country and state remain explicit in stored records and API filters. LGAs, communities, fiscal years, agencies, and other administrative reference data remain configurable.

## Public and internal boundaries

The first release publishes approved government project information and allocation details. It does not publish Xpro staff expenses, bank details, internal approvals, confidential donor documents, unverified allegations, or private citizen information.

## Product success

The product succeeds when:

- Managers can move a valid project from draft to submission without external tools.
- Super Admins can understand, review, approve, reject, and audit every submission.
- Approved changes appear to viewers without exposing draft content.
- Viewers can find relevant projects by program, year, location, agency, status, and allocation.
- Every public value can be traced to an approved version and source.
- The interface remains useful on mobile screens and slower connections.
