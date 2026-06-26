# RiskShield AI Decision Schema

## Phase 1 core decision model

The first-stage product should translate a lead list into clear send decisions and launch readiness guidance.

### List-level decisions

- `send`
- `review`
- `suppress`

### Campaign-level statuses

- `ready_to_launch`
- `launch_with_caution`
- `do_not_launch`

### List acceptance outcomes

- `accept_as_is`
- `accept_after_cleanup`
- `needs_enrichment`
- `reject_do_not_send`

## Required campaign fields

- `campaign_readiness_score`
- `top_risk_reasons`
- `estimated_waste_prevented`
- `client_risk_brief`

## Contact-level result fields

Recommended per-contact fields:

- `email`
- `normalized_email`
- `decision`
- `queue`
- `reason_codes`
- `primary_reason`
- `recommended_action`
- `business_impact`
- `confidence`
- `evidence`

## Meaning of the queues

### Send

Contacts that are acceptable to include in the launch queue.

### Review

Contacts that should be manually inspected or cleaned up before campaign launch.

### Suppress

Contacts that should not be sent in the current campaign.

## Recommended interpretation rules

### ready_to_launch

The list can move forward with minimal friction and low expected waste.

### launch_with_caution

The list can launch, but the sender should review risk concentration, content sensitivity, or deliverability concerns first.

### do_not_launch

The list should not be launched as-is.

## Top risk reasoning

Reason codes should be designed to support agency-friendly explanations such as:

- disposable or temporary signal
- role-based or generic inbox pattern
- malformed or suspicious address structure
- low confidence match
- missing enrichment or weak context
- domain or sending risk indicator
- likely waste or client-experience risk

## Output philosophy

The product should not stop at valid / invalid.

It should tell the user:

- what to send
- what to review
- what to suppress
- why
- what the business impact is

