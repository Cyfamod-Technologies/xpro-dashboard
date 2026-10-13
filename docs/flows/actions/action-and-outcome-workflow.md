# Actions and Outcomes

## Purpose

Actions capture the operational or advocacy work needed to respond to a tracked project issue. Outcomes capture what happened after that work. They are related to a project, but they do not replace the project's approval status or tracking status.

## Manager flow

1. Manager opens **Actions and Outcomes** or the project's **Tracking & actions** tab.
2. Manager creates an action with a title, issue/context, owner, due date, and proposed visibility.
3. Manager records progress updates and attaches supporting evidence where relevant.
4. The project tracking status may move to `ACTION_REQUIRED` or `ACTION_IN_PROGRESS`.
5. When the action produces a result, Manager records an outcome with a result summary, verification date, and evidence.
6. Any viewer-facing wording, status, evidence, or visibility change is saved as a project revision.
7. Manager reviews the public preview and submits the revision to the Super Admin.

## Viewer Take Action relationship

The viewer-facing Take Action panel may show only action guidance that is included in the approved public version. A viewer response is a separate moderated submission; it does not directly change the project, action, outcome, or tracking status.

## Approval and visibility

- Draft actions, internal notes, private evidence, and proposed outcomes remain internal.
- Super Admin reviews the proposed public wording, evidence, and visibility.
- Approval publishes the complete revision atomically.
- The prior published version remains visible while the revision is pending, rejected, or returned for changes.
- Every creation, update, submission, decision, and publication produces an audit event and relevant notification.

## Completion rules

`OUTCOME_VERIFIED` requires supporting evidence and Super Admin approval. `COMPLETED` requires an approved verified outcome or a documented formal closure. A Take Action prompt, viewer response, or open action never implies completion.

## MVP decisions still required

- Which action types are enabled at launch (for example, contact guidance, structured feedback, status report, or follow).
- Whether viewer feedback requires a verified Budget Viewer account.
- Which evidence types may be public by default.
- What evidence qualifies an outcome as verified.
