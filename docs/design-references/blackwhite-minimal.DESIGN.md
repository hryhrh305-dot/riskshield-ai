---
version: alpha
name: Black-White Minimal RiskShield AI
description: Frozen snapshot of the current RiskShield AI UI. This version is a strict black-and-white enterprise minimal system built for security, trust, and clarity. It keeps the xAI-inspired restraint, but reads more like a hardened product shell: dense enough for dashboards, quiet enough for pricing, and sober enough for billing and admin workflows.

colors:
  canvas: "#0a0a0a"
  canvas-soft: "#111111"
  canvas-card: "#161616"
  canvas-elevated: "#1b1b1b"
  ink: "#ffffff"
  ink-soft: "#d9d9d9"
  ink-muted: "#8a8f98"
  hairline: "rgba(255,255,255,0.10)"
  hairline-strong: "rgba(255,255,255,0.18)"
  primary: "#ffffff"
  primary-inverse: "#0a0a0a"
  success: "#22c55e"
  warning: "#f59e0b"
  danger: "#ef4444"

typography:
  display-xl:
    fontFamily: universalSans, Inter, system-ui, sans-serif
    fontSize: 72px
    fontWeight: 400
    lineHeight: 1.0
    letterSpacing: -1.8px
  display-lg:
    fontFamily: universalSans, Inter, system-ui, sans-serif
    fontSize: 48px
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: -1.2px
  heading-xl:
    fontFamily: universalSans, Inter, system-ui, sans-serif
    fontSize: 32px
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: -0.64px
  heading-md:
    fontFamily: universalSans, Inter, system-ui, sans-serif
    fontSize: 20px
    fontWeight: 400
    lineHeight: 1.25
  body-md:
    fontFamily: universalSans, Inter, system-ui, sans-serif
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: universalSans, Inter, system-ui, sans-serif
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.4
  mono-label:
    fontFamily: GeistMono, ui-monospace, SFMono-Regular, Menlo, monospace
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: 1.2px

rounded:
  card: 24px
  panel: 20px
  input: 14px
  pill: 9999px

layout:
  page:
    background: canvas
    maxWidth: 7xl
    paddingX: 24px
    sectionGap: 40px
  shell:
    headerHeight: 72px
    desktopNav: inline
    mobileNav: collapsible
  pricing:
    cardGrid: 1-up mobile, 2-up tablet, 3-up desktop
    featuredPlan: Growth
  dashboard:
    moduleGrid: dense two-column
    sidePanels: stacked on mobile

components:
  header:
    background: canvas
    borderBottom: hairline
    iconBox: rounded pill, white outline, transparent fill
  button-primary:
    background: primary
    text: primary-inverse
    border: none
    shape: pill
  button-secondary:
    background: canvas-soft
    text: ink
    border: hairline
    shape: pill
  card:
    background: canvas-card
    border: hairline
    shadow: none
    shape: card
  featured-card:
    background: canvas-elevated
    border: hairline-strong
    shadow: none
    shape: card
  badge:
    background: canvas-soft
    border: hairline
    text: ink-soft
    shape: pill
  input:
    background: canvas-soft
    border: hairline
    text: ink
    shape: input

pages:
  landing:
    tone: sparse, credible, high-trust
    signature: hero headline with one crisp product illustration or status preview
  pricing:
    tone: premium, direct, conversion-focused
    signature: strong plan contrast plus clear annual savings
  dashboard:
    tone: operational, dense, security-first
    signature: metric cards and result tables with hard contrast
  risk-check:
    tone: practical, fast, readable
    signature: prominent input first, result second
  billing:
    tone: calm, transactional, reliable
    signature: plan status, renewal, and portal access

rules:
  - Keep every surface dark and restrained.
  - Use white as the dominant accent.
  - Keep borders thin and legible.
  - Prefer clarity over decoration.
  - Preserve strong hierarchy in pricing, billing, and dashboard modules.
  - Keep mobile layouts functional before ornamental.

do_not:
  - Do not introduce colorful marketing gradients.
  - Do not add shadows as the main depth signal.
  - Do not make the dashboard feel playful.
  - Do not hide pricing or billing details.
  - Do not blur the difference between cards, buttons, and inputs.
---

## Snapshot Notes

This file names the current UI snapshot as `Black-White Minimal RiskShield AI`.

Use this label when you want to refer to the frozen black-white version of the product UI.
It is the rollback target for the current visual direction.

Reference status:

- Current product UI snapshot
- Safe to reuse as the baseline for later black-white minimal projects
- Distinct from the broader xAI-first design reference
