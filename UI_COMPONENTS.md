# RiskShield AI UI Components

This file records the reusable UI pattern system for RiskShield AI.
Every future UI task must read this file before adding or modifying visual components.
The current visual direction is xAI-first, with Sentry, Vercel, and Stripe used as secondary references for security, developer, and billing surfaces.

## 1. PageShell

Purpose:

- Provide the default dark premium app surface and max-width layout

Visual rules:

- Near-black page background
- Thin hairline borders
- Minimal top navigation
- No large rainbow gradients

State rules:

- Sticky header allowed
- Loading state must preserve shell spacing

Mobile rules:

- Header compresses cleanly
- Navigation must remain reachable

Do:

- Reuse for dashboard, pricing, docs-like product pages

Don't:

- Rebuild page chrome from scratch for each page

Reuse guidance:

- Use existing shell rhythm before creating custom wrappers

## 2. SectionHeader

Purpose:

- Standardize section titles and supporting copy

Visual rules:

- White title
- Muted body copy
- Optional mono eyebrow

State rules:

- Empty and loading states should still preserve header spacing

Mobile rules:

- Titles wrap naturally

Do:

- Use for dashboard modules and marketing sections

Don't:

- Mix multiple heading styles inside one page

Reuse guidance:

- Prefer a single hierarchy across the page

## 3. PrimaryButton

Purpose:

- Main CTA on a page or card

Visual rules:

- White fill
- Black text
- Pill radius
- Minimal hover lift only

State rules:

- Disabled state reduces opacity only
- Loading keeps layout stable

Mobile rules:

- Comfortable touch height

Do:

- Use for Start Free, Upgrade, Generate, Submit

Don't:

- Use multiple competing primary buttons in one small surface

Reuse guidance:

- Reuse `rs-button-primary`

## 4. SecondaryButton

Purpose:

- Support action beside a primary CTA

Visual rules:

- Dark background
- Hairline border
- White text
- Pill radius

State rules:

- Hover is subtle

Mobile rules:

- May stack under primary CTA

Do:

- Use for docs, demos, manage, secondary flows

Don't:

- Style it like a random third button family

Reuse guidance:

- Reuse `rs-button-secondary`

## 5. GhostButton

Purpose:

- Lightweight action for low emphasis controls

Visual rules:

- Transparent or near-transparent
- No heavy fill

State rules:

- Hover only changes text or background slightly

Mobile rules:

- Maintain tap area

Reuse guidance:

- Use only when primary and secondary would overpower the layout

## 6. DashboardCard

Purpose:

- Standard dashboard module container

Visual rules:

- Dark surface
- Thin border
- No strong shadow

State rules:

- Supports empty, populated, and warning variants

Mobile rules:

- Full width

Reuse guidance:

- Reuse across API, recent checks, feedback, admin tools

## 7. MetricCard

Purpose:

- Show key numeric summary

Visual rules:

- Large number
- Clear label
- Quiet helper text

State rules:

- Healthy, warning, critical should use restrained semantic color

Mobile rules:

- One card per row if needed

Reuse guidance:

- Same metric pattern across dashboard

## 8. PricingCard

Purpose:

- Present a plan and conversion CTA

Visual rules:

- Dark monochrome card
- Growth / featured plan can be polarity-flipped
- Strong price hierarchy

State rules:

- Self-serve, contact-only, disabled states must remain clear

Mobile rules:

- Cards stack vertically

Reuse guidance:

- Keep one shared family for Starter / Growth / Scale

## 9. RiskBadge

Purpose:

- Show ALLOW / REVIEW / BLOCK clearly

Visual rules:

- ALLOW = green
- REVIEW = amber
- BLOCK = red
- Compact pill or rounded tag

State rules:

- Must always remain readable against dark background

Mobile rules:

- Badge must not overflow small cards

Reuse guidance:

- Use same semantic colors everywhere

## 10. RiskScoreDisplay

Purpose:

- Show 0-100 score with decision context

Visual rules:

- Score large and obvious
- Decision nearby
- Supporting reason below

State rules:

- Do not show score alone without context on result surfaces

Reuse guidance:

- Keep score hierarchy consistent between landing preview and real result pages

## 11. RiskScoreRing

Purpose:

- Circular or progress-based score framing

Visual rules:

- Thin precise ring
- No playful multicolor treatment

Reuse guidance:

- Use only when it improves scan readability

## 12. DataTable

Purpose:

- Dense operational data display

Visual rules:

- Dark surface
- Thin separators
- Soft hover

State rules:

- Empty rows and loading rows must preserve table structure

Mobile rules:

- Horizontal scroll or stacked alternate display, but never broken overflow

Reuse guidance:

- Use same row rhythm on dashboard and pricing comparison tables

## 13. TableStatusCell

Purpose:

- Status field inside a table

Visual rules:

- Prefer badges over plain colored text

Reuse guidance:

- Follow RiskBadge colors

## 14. FormInput

Purpose:

- Standard text input

Visual rules:

- Dark fill
- Hairline border
- White text
- Muted placeholder

State rules:

- Error and focus must be clear

Mobile rules:

- Full width

Reuse guidance:

- Use same input family across auth-safe product surfaces and dashboard tools

## 15. SearchInput

Purpose:

- Search / filter field

Visual rules:

- Same base as FormInput

Reuse guidance:

- Do not invent a separate bright search style

## 16. UploadZone

Purpose:

- Upload files for bulk risk processing

Visual rules:

- Dark bordered dropzone
- Clear drag / hover state

State rules:

- Empty, hover, uploading, uploaded states must remain distinct

Mobile rules:

- Keep action reachable without drag support

## 17. EmptyState

Purpose:

- Explain no-data situations

Visual rules:

- Calm, low-noise, helpful

State rules:

- Always include a next action when possible

Reuse guidance:

- Avoid generic filler copy

## 18. UpgradeCallout

Purpose:

- Convert free or lower-tier users without breaking trust

Visual rules:

- Dark surface
- Clear CTA
- No aggressive flashing

State rules:

- Show value unlock, not just denial

Reuse guidance:

- Highlight API, bulk, export, advanced explanation unlocks

## 19. APICodeBlock

Purpose:

- Show endpoints / snippets

Visual rules:

- Dark code surface
- Mono font
- Thin border

Reuse guidance:

- Same style on docs and dashboard helper surfaces

## 20. AIExplanationPanel

Purpose:

- Show AI-generated explanation or summary

Visual rules:

- Calm readable panel
- Not louder than risk score itself

State rules:

- Loading and unavailable states must be explicit

## 21. RecommendedActionPanel

Purpose:

- Show next step recommendation

Visual rules:

- Short, high-signal block

Reuse guidance:

- Keep action language direct

## 22. UsageMeter

Purpose:

- Visualize quota / remaining credits

Visual rules:

- Thin meter
- Clear percentage
- Semantic warning only near limit

## 23. BillingPlanCard

Purpose:

- Show active plan and billing status

Visual rules:

- Dark card
- Plan name prominent
- Status and billing date secondary

## Reuse policy

- Search existing components and patterns first
- Reuse existing classes and card families whenever possible
- Do not create near-duplicate button, card, or badge styles without a strong reason
