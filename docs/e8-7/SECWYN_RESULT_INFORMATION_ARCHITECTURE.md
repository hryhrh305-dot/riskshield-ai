# Secwyn E8.7 Result Information Architecture

## Shared principle

One completed audit has one canonical set of contact facts. Web presentation and report artifacts may organize those facts differently, but they do not recompute score, decision, reason, action, evidence state, version, audit identity or Credits.

## Single contact result order

1. Final Decision
2. Primary Reason
3. Recommended Action
4. Base Signal Score and the existing 0–25 / 26–65 / 66–100 range
5. Available evidence summary
6. Unknown, not-tested and failed states
7. Decision explanation and existing technical evidence
8. Audit metadata
9. Evidence boundary: Domain is not Mailbox, and Mailbox is not Inbox

Technical evidence remains available; the change is information order, not field deletion.

## Bulk audit workbench order

1. Input method and progress
2. Input Reconciliation
3. Export pack
4. Secwyn client-ready report for currently entitled plans
5. Decision distribution: Send / Review / Suppress
6. Required Actions derived from recorded `recommended_action`
7. Top Risk Drivers derived from non-Send primary reasons
8. Evidence Coverage for MX, mailbox and catch-all states
9. Contact preview with actual shown/total count
10. Search and Decision tabs over the same result array
11. Full detailed result table and expandable technical fields

The browser initially renders at most 250 detailed result rows and allows the user to reveal the next 250. Exports retain the complete completed result set.

## Client-ready report order

1. Secwyn cover/header
2. Executive Audit Summary using actual distribution
3. Input Reconciliation
4. Required Actions
5. Top Risk Drivers
6. Evidence Coverage
7. Contact-level Results
8. Methodology and Evidence Limitations
9. Audit Metadata
10. Secwyn support/footer

No client, campaign, reviewer, approver, workspace or human-verification identity appears unless it exists in the actual result source. The current Web run does not provide those identities, so E8.7 omits them.

## Queue language

- **Send:** Current evidence supports controlled campaign use. It is not a zero-risk, delivery or inbox statement.
- **Review:** Evidence is incomplete, uncertain, failed, conflicting or requires judgment.
- **Suppress:** A recorded blocking condition applies to the current campaign; the contact stays out until corrected and re-audited.

## State handling

- Zero results: state says no contact result is available; percentages remain 0, never NaN.
- Empty queue: state says no result is in that queue.
- Invalid/duplicate input: reconciliation remains visible and is not counted as a unique processed contact.
- Partial mismatch: report adds an explicit partial-data limitation if list summary total and available contact rows differ.
- Unknown/not-tested/lookup-failed: each remains a separate evidence state.
- Download/report failure: underlying audit results remain visible; no Credits are consumed for retrying the artifact.

## Protected legacy surfaces

Audit History continues to show only facts actually saved in the legacy `pre_send_*` tables. API and Google Sheets continue to expose their existing compatible DTO/columns. E8.7 does not create durable report state or a second history schema.
