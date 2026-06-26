# RiskShield AI Client-ready Audit Report Spec

## Purpose

This report is the customer-facing deliverable for agencies and outbound teams. It should turn a list audit into something a client can review, approve, and export.

## Required report sections

The report must include:

1. Client name
2. Campaign name
3. Upload date / audit date
4. Total contacts
5. Launch Status
6. Campaign Readiness Score
7. Send / Review / Suppress breakdown
8. Top Risk Reasons
9. Estimated Waste Prevented
10. Recommended Workflow
11. Client Risk Brief
12. Export links

## Required export artifacts

The report should link to:

- `send_queue.csv`
- `review_queue.csv`
- `suppression_list.csv`
- `risk_summary.csv`

## Report content guidance

### Launch Status

Show one of:

- `ready_to_launch`
- `launch_with_caution`
- `do_not_launch`

### Campaign Readiness Score

Use a simple score that can be explained to clients and internal stakeholders.

### Send / Review / Suppress breakdown

Show count and percentage by queue.

### Top Risk Reasons

List the most important risk drivers, not every low-signal detail.

### Estimated Waste Prevented

Estimate how much unnecessary sending, review time, or client risk was avoided by running the audit.

### Recommended Workflow

Explain the next operational step:

- launch now
- cleanup first
- enrich first
- suppress risky records

### Client Risk Brief

Provide a short, client-ready summary in plain language.

## Tone

The report should read like an agency deliverable:

- credible
- concise
- client-safe
- action-oriented
- easy to forward

## Output principle

The goal is not to over-explain the model. The goal is to give the customer a report they can confidently use to launch or pause a campaign.

