# Review and Publish Project

1. Super Admin opens the approval queue.
2. Admin selects a project submission.
3. Screen displays the current public version, proposed version, field changes, evidence changes, source completeness, public preview, and warnings.
4. Admin may inspect source files using authorised access.
5. Admin chooses:
   - **Approve and publish**
   - **Request changes** with actionable comments
   - **Reject** with a reason
6. Backend verifies that the review target is still current and performs the state transition transactionally.
7. Publication updates the public-version pointer, search projection, summaries, and audit log.
8. Manager is notified.

Budget Viewers must either see the old complete version or the new complete version, never a partially updated record.
