---
version: alpha
name: xAI-Inspired-design-analysis
description: An inspired interpretation of xAI's design language — Elon Musk's frontier-AI company whose web surface is a strict near-black canvas broken only by white pill outlines, occasional warm sunset / dusk gradient accents, a custom geometric sans (Universal Sans) for display, and an uppercase tracked monospace caption face; the whole system reads as engineered-cosmic, unmarketed.

colors:
  primary: "#ffffff"
  on-primary: "#0a0a0a"
  ink: "#ffffff"
  ink-hover: "#fafaf7"
  body: "#dadbdf"
  body-mid: "#7d8187"
  mute: "#7d8187"
  hairline: "#212327"
  canvas: "#0a0a0a"
  canvas-soft: "#1a1c20"
  canvas-card: "#191919"
  canvas-mid: "#363a3f"
  accent-sunset: "#ff7a17"
  accent-sunset-soft: "#ffc285"
  accent-dusk: "#7c3aed"
  accent-twilight: "#c4b5fd"
  accent-breeze: "#a0c3ec"
  accent-midnight: "#0d1726"

typography:
  display-xl:
    fontFamily: universalSans, Inter, system-ui, -apple-system, sans-serif
    fontSize: 96px
    fontWeight: 400
    lineHeight: 96px
    letterSpacing: -2.4px
  display-lg:
    fontFamily: universalSans, Inter, system-ui, sans-serif
    fontSize: 72px
    fontWeight: 400
    lineHeight: 72px
    letterSpacing: -1.8px
  display-md:
    fontFamily: universalSans, Inter, system-ui, sans-serif
    fontSize: 48px
    fontWeight: 400
    lineHeight: 48px
    letterSpacing: -1.2px
  display-sm:
    fontFamily: universalSans, Inter, system-ui, sans-serif
    fontSize: 32px
    fontWeight: 400
    lineHeight: 36px
    letterSpacing: -0.6px
  display-xs:
    fontFamily: universalSans, Inter, system-ui, sans-serif
    fontSize: 20px
    fontWeight: 400
    lineHeight: 28px
  body-lg:
    fontFamily: universalSans, Inter, system-ui, sans-serif
    fontSize: 18px
    fontWeight: 400
    lineHeight: 28px
  body-md:
    fontFamily: universalSans, Inter, system-ui, sans-serif
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
  body-sm:
    fontFamily: universalSans, Inter, system-ui, sans-serif
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
  caption-mono:
    fontFamily: GeistMono, ui-monospace, SFMono-Regular, Menlo, Monaco, monospace
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
    letterSpacing: 1.4px
  caption-mono-sm:
    fontFamily: GeistMono, ui-monospace, SFMono-Regular, Menlo, monospace
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
    letterSpacing: 1.2px
  button-md:
    fontFamily: universalSans, Inter, system-ui, sans-serif
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px

rounded:
  none: 0px
  sm: 8px
  pill: 9999px
  full: 9999px

spacing:
  xxs: 2px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  3xl: 48px
  4xl: 64px

components:
  nav-bar:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    padding: "{spacing.md} {spacing.xl}"
  nav-link:
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    borderColor: "{colors.primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.pill}"
    padding: "{spacing.xs} {spacing.md}"
  button-outline-on-dark:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    typography: "{typography.button-md}"
    rounded: "{rounded.pill}"
    padding: "{spacing.sm} {spacing.lg}"
  button-outline-sm:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    typography: "{typography.button-md}"
    rounded: "{rounded.pill}"
    padding: "{spacing.xs} {spacing.md}"
  text-input:
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md} {spacing.lg}"
  card-content:
    backgroundColor: "{colors.canvas-card}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: "{spacing.xl}"
  card-feature-product:
    backgroundColor: "{colors.canvas-card}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: "{spacing.xl}"
  hero-band:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.display-xl}"
    padding: "{spacing.4xl} {spacing.xl}"
  content-band:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.display-md}"
    padding: "{spacing.4xl} {spacing.xl}"
  eyebrow-mono:
    textColor: "{colors.ink}"
    typography: "{typography.caption-mono}"
  divider-hairline:
    borderColor: "{colors.hairline}"
  footer:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.body}"
    typography: "{typography.body-sm}"
    padding: "{spacing.3xl} {spacing.xl}"

  ex-pricing-tier:
    description: "Default Pricing tier card. Re-uses feature-card chrome with brand canvas-soft surface."
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.sm}"
    padding: "{spacing.xl}"
  ex-pricing-tier-featured:
    description: "Featured/highlighted tier — polarity-flipped surface (dark fill + light text in light mode, light fill + dark text in dark mode)."
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    padding: "{spacing.xl}"
  ex-product-selector:
    description: "What's Included summary card — re-purposed for SaaS / B2B verticals (NOT a literal product gallery)."
    backgroundColor: "{colors.canvas-soft}"
    rounded: "{rounded.sm}"
    padding: "{spacing.xl}"
  ex-cart-drawer:
    description: "Subscription summary — re-purposed for SaaS / B2B (line items per add-on, not literal cart)."
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.sm}"
    padding: "{spacing.xl}"
    item-divider: "{colors.hairline}"
  ex-app-shell-row:
    description: "Sidebar nav row inside the App Shell example. Active state uses brand primary as the indicator."
    backgroundColor: "{colors.canvas}"
    activeIndicator: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md} {spacing.lg}"
  ex-data-table-cell:
    description: "Default data-table th + td chrome. Header uses mono-caps eyebrow typography; body uses body-sm."
    headerBackground: "{colors.canvas-soft}"
    headerTypography: "{typography.caption-mono}"
    bodyTypography: "{typography.body-sm}"
    cellPadding: "{spacing.md} {spacing.lg}"
    rowBorder: "{colors.hairline}"
  ex-auth-form-card:
    description: "Sign-in / sign-up card. Re-uses feature-card chrome with text-input primitives inside."
    backgroundColor: "{colors.canvas-soft}"
    rounded: "{rounded.sm}"
    padding: "{spacing.xl}"
  ex-modal-card:
    description: "Modal dialog surface — same chrome as feature-card with elevated shadow."
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.sm}"
    padding: "{spacing.xl}"
  ex-empty-state-card:
    description: "Empty-state illustration frame."
    backgroundColor: "{colors.canvas-soft}"
    rounded: "{rounded.sm}"
    padding: "{spacing.3xl}"
    captionTypography: "{typography.body-md}"
  ex-toast:
    description: "Toast notification surface — feature-card shape + medium shadow."
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md} {spacing.lg}"
    typography: "{typography.body-sm}"

---

## Overview

xAI is Elon Musk's frontier-AI lab and the website wears that posture with engineered restraint: a near-black canvas `{colors.canvas}` (`#0a0a0a`) edge-to-edge, white outline pills as every interactive element, and a single proprietary geometric sans `Universal Sans` carrying every display headline at weight 400. There is no gradient hero, no atmospheric backdrop, no product screenshot. The brand reads as confidently sparse — a research lab announcing its work rather than a SaaS marketing site.

Type is the second decisive voice. `Universal Sans` carries every display at weight 400 (regular) with aggressive negative tracking (`-2.4 px` at 96 px, scaling down through the display ladder). For technical labels, eyebrows, and metric counters, the brand pairs `Geist Mono` (uppercase, 1.4 px positive tracking) — every section eyebrow reads as a code comment more than a marketing label.

Every interactive element is a pill (`{rounded.pill}` 9999 px) with 1 px white-translucent border `rgba(255, 255, 255, 0.25)`. The button shape never varies — the same translucent-white pill carries "Try Grok", "Read announcement", "Custom Voices", "Sign up now", and every "Read" anchor. The pill is the entire shape system.

Key characteristics:

- A single near-black canvas (`{colors.canvas}` `#0a0a0a`) with white outline pills as the entire interactive vocabulary.
- Universal Sans weight 400 for display, Geist Mono uppercase tracked for labels — the two-face contrast is the brand voice.
- Every button is a `{rounded.pill}` outline with translucent-white border. The brand never uses filled CTAs except for one variant (white-filled pill on Sign Up).
- Cards are tight `{rounded.sm}` 8 px rectangles in a slightly-lighter `{colors.canvas-card}` (`#191919`) fill with hairline border. No shadows.
- A muted accent palette of sunset-orange / dusk-purple / twilight-violet / breeze-blue lives in the design tokens but appears rarely on the main marketing surface — reserved for product illustrations and icons.
- Massive negative letter-spacing on display headlines (`-2.4 px` at 96 px) gives the typography a precise, gathered look.

## Colors

### Brand and accent

- White (`{colors.primary}` — `#ffffff`): The brand's primary color — used as button outline, button-primary fill, and all display text.
- Sunset Orange (`{colors.accent-sunset}` — `#ff7a17`): Warm accent used inside product illustrations and rare emphasis moments.
- Sunset Soft (`{colors.accent-sunset-soft}` — `#ffc285`)
- Dusk Purple (`{colors.accent-dusk}` — `#7c3aed`)
- Twilight (`{colors.accent-twilight}` — `#c4b5fd`)
- Breeze Blue (`{colors.accent-breeze}` — `#a0c3ec`)
- Midnight (`{colors.accent-midnight}` — `#0d1726`)

### Surface

- Canvas (`{colors.canvas}` — `#0a0a0a`): Default page background.
- Canvas Soft (`{colors.canvas-soft}` — `#1a1c20`): Slightly lighter dark fill used for hovered nav items and tooltips.
- Canvas Card (`{colors.canvas-card}` — `#191919`): Card fill used inside product-feature cards.
- Canvas Mid (`{colors.canvas-mid}` — `#363a3f`): Mid-dark nested surface.
- Hairline (`{colors.hairline}` — `#212327`): 1 px solid dividers on dark surfaces.

### Text

- Ink (`{colors.ink}` — `#ffffff`): Default foreground on canvas.
- Ink Hover (`{colors.ink-hover}` — `#fafaf7`)
- Body (`{colors.body}` — `#dadbdf`)
- Body Mid / Mute (`{colors.body-mid}` — `#7d8187`)

## Typography

### Font family

Two faces ladder the system:

1. `universalSans` — used for display, body, button, and link roles.
2. `GeistMono` — used for uppercase section eyebrows, label captions, and metric counters.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.display-xl}` | 96px | 400 | 96px | -2.4px | Maximum hero scale |
| `{typography.display-lg}` | 72px | 400 | 72px | -1.8px | Sub-hero displays |
| `{typography.display-md}` | 48px | 400 | 48px | -1.2px | Section headlines |
| `{typography.display-sm}` | 32px | 400 | 36px | -0.6px | Card-cluster headings |
| `{typography.display-xs}` | 20px | 400 | 28px | 0 | Inline displays |
| `{typography.body-lg}` | 18px | 400 | 28px | 0 | Lead paragraphs |
| `{typography.body-md}` | 16px | 400 | 24px | 0 | Default body |
| `{typography.body-sm}` | 14px | 400 | 20px | 0 | Secondary body |
| `{typography.caption-mono}` | 14px | 400 | 20px | 1.4px | Section eyebrow |
| `{typography.caption-mono-sm}` | 12px | 400 | 16px | 1.2px | Small mono labels |
| `{typography.button-md}` | 14px | 400 | 20px | 0 | Button label |

### Principles

- Weight 400 for everything.
- Tight negative tracking on display sizes.
- Geist Mono uppercase for eyebrows.

## Layout

### Spacing system

- Base unit: 4 px.
- Section padding: hero / content bands at `{spacing.4xl}` 64 px on desktop.
- Card interior padding: `{spacing.xl}` 24 px.

### Grid and container

- Marketing content centers at about 1200 px.
- Product / announcement card grid: 2-up at desktop, 1-up at mobile.

### Responsive strategy

| Name | Width | Key Changes |
|---|---|---|
| Mobile | < 768px | Hero scales 96 → 48 px, grids 1-up, hamburger nav |
| Desktop | >= 768px | Full hero and 2-up grids |

## Elevation and depth

| Level | Treatment | Use |
|---|---|---|
| Level 0 | No shadow, no border | Default |
| Level 1 | 1 px solid `{colors.hairline}` border | Card chrome, button outlines |

The brand uses no shadows. Hairline borders carry all elevation cues.

## Shapes

| Token | Value | Use |
|---|---|---|
| `{rounded.none}` | 0px | Full-bleed bands |
| `{rounded.sm}` | 8px | Card chrome |
| `{rounded.pill}` | 9999px | Every button |
| `{rounded.full}` | 9999px | Circular icon containers |

## Components

### Buttons

`button-primary`

- Background `{colors.primary}`
- Text `{colors.on-primary}`
- 1 px solid white border
- Label `{typography.button-md}`
- Shape `{rounded.pill}`

`button-outline-on-dark`

- Background `{colors.canvas}`
- Text `{colors.ink}`
- 1 px solid `{colors.hairline}` border
- Same pill shape and button typography

`button-outline-sm`

- Same as outline button with tighter padding

### Cards and containers

`card-content`

- Background `{colors.canvas-card}`
- Text `{colors.ink}`
- 1 px solid `{colors.hairline}` border
- Padding `{spacing.xl}`
- Shape `{rounded.sm}`

`card-feature-product`

- Same chrome as `card-content`

### Inputs and forms

`text-input`

- Background `{colors.canvas-soft}`
- Text `{colors.ink}`
- 1 px solid `{colors.hairline}`
- Body typography
- 8 px radius

### Navigation

`nav-bar`

- Background `{colors.canvas}`
- Text `{colors.ink}`
- Minimal spacing

`nav-link`

- White text on dark background

`footer`

- Background `{colors.canvas}`
- Text `{colors.body}`

### Signature components

`hero-band`

- Background `{colors.canvas}`
- Text `{colors.ink}`
- Massive display typography

`content-band`

- Background `{colors.canvas}`
- Section headline with eyebrow above

`eyebrow-mono`

- Text `{colors.ink}`
- `GeistMono`
- Uppercase and tracked

`divider-hairline`

- 1 px solid `{colors.hairline}`

## Do's and don'ts

### Do

- Reserve `{colors.canvas}` as the only page surface.
- Set hero headlines in display sizes with strong negative tracking.
- Use `{rounded.pill}` on every interactive element.
- Pair Universal Sans style with Geist Mono uppercase labels.
- Use white-translucent borders for outline buttons.

### Don't

- Don't introduce a light-mode counterpart.
- Don't bold display headlines.
- Don't use filled buttons broadly.
- Don't drop shadows on cards.
- Don't substitute the xAI tone with generic SaaS gradients or template visuals.
