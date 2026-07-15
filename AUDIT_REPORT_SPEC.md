# Secwyn Client-ready Audit Report Specification

## Purpose

The Secwyn report is a professional, Secwyn-branded record of an already completed contact audit. It helps an operator or client understand the decision distribution, reconcile the input, work the required actions, inspect evidence limitations, and retain or print the result.

It is not a certificate, human audit, legal opinion, delivery guarantee, inbox guarantee, white-label document, or estimate of revenue/savings.

## Source of truth

The report must be derived from the same in-memory canonical contact results, list summary, and input reconciliation returned for the completed Web audit. It must not create a second scoring model, recompute contact decisions, call an LLM, call a paid vendor, or change Credits.

## Required report sections

1. Secwyn cover/header
2. Executive audit summary using actual Send/Review/Suppress counts
3. Input reconciliation
4. Decision distribution and queue meaning
5. Required Actions derived from recorded `recommended_action` values
6. Top Risk Drivers derived only from negative primary reasons
7. Evidence Coverage
8. Contact-level Results
9. Methodology
10. Evidence Limitations
11. Audit Metadata
12. Secwyn support information

## Required facts

- Input rows, syntax accepted, rejected, duplicates, unique processed, results produced and audit Credits consumed
- Send, Review and Suppress count and percentage
- Email, final decision, base signal score, primary reason and recommended action
- MX, mailbox and catch-all states without coercing unknown/failed/not-tested to No
- Engine version, policy/rules version, audit ID and audit time when actually present
- A separate report-generation timestamp

## Artifacts

- On-screen report
- Downloadable self-contained HTML report
- Browser Print / Save PDF path
- Full CSV and XLSX result exports
- Separate Send, Review and Suppress CSV queues
- Campaign audit summary CSV

All report views, generations, prints and repeated downloads consume zero additional contact Credits.

## Truth and safety boundaries

- Domain evidence is not mailbox evidence.
- Mailbox evidence is not inbox placement or delivery evidence.
- Send means current evidence supports controlled campaign use, not zero risk.
- Review means uncertainty, failure or judgment remains.
- Suppress means a recorded blocking condition applies to the current campaign.
- Do not display potential savings, bounces prevented, revenue preserved, protected domains, compliance status or other unmeasured outcomes.
- Do not invent client, campaign, reviewer, approver, workspace or human-verification metadata.
- Escape every inserted HTML value and neutralize spreadsheet formula markers in CSV/XLSX contexts.

## Scale and presentation

- The on-screen report may preview a bounded number of contacts while stating the exact shown/total count.
- CSV, XLSX and downloaded HTML retain the complete completed result set.
- The report must remain readable in Secwyn dark and light themes, on mobile, and in an ink-conscious light print layout.
- Print hides navigation and interactive controls, repeats table headers where supported, and avoids splitting key cards where practical.
