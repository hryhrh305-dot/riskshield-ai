# Secwyn E8.6 Light Mode Validation

## Design intent

The default theme remains Secwyn dark. Light mode uses the user-approved warm editorial direction shown in the supplied visual reference: warm ivory canvas, white cards, deep navy typography, fine blue-gray borders, restrained shadows, editorial marketing headings, and cyan reserved for functional focus/accent. No code, content, rules, or assets were read from another product repository.

## Implementation contract

- Storage key: `secwyn-theme`.
- Allowed values: `dark`, `light`.
- If no stored choice exists, use `prefers-color-scheme`.
- Apply the choice before hydration through the root `beforeInteractive` script.
- Persist explicit user choice in local storage.
- Toggle is keyboard-operable, has an accessible label, exposes pressed state, and remains available on desktop/mobile.
- Theme changes use shared CSS variables and targeted utility overrides; page layouts and business behavior are unchanged.

## Surface matrix

| Surface group | Dark | Light | Method |
|---|---|---|---|
| Homepage/header/footer/sample/FAQ | Covered | Covered | `rs-shell`, shared cards, editorial title class |
| Pricing/tables/plan cards | Covered | Covered | `rs-app`, shared tokens, variable table background |
| API and Sheets docs/code blocks | Covered | Covered | `rs-shell`, `rs-code`, form/card overrides |
| Login/signup/recovery | Covered | Covered | Existing `rs-shell` classes plus root toggle |
| Dashboard/cards/alerts/navigation | Covered | Covered | Existing `rs-app` plus token and utility overrides |
| Bulk upload/progress/results/download controls | Covered | Covered | Existing `rs-shell` and shared form/table selectors |
| Single risk check/forms/results | Covered | Covered | Existing `rs-shell` and shared form/card selectors |
| Audit history | Covered | Covered | Existing `rs-shell` and shared cards |
| Admin E8/feedback | Covered | Covered | Existing `rs-shell` and shared tokens |
| Privacy/Terms | Covered | Covered | Added `rs-legal` wrapper; legal text unchanged |
| 404 | Covered | Covered | New `rs-shell` recovery page |

## Accessibility checks

- Focus indicator uses the theme accent with a 3px outline and offset.
- Light body text uses navy/slate rather than low-contrast gray.
- Status colors remain distinct and are always accompanied by text labels.
- Mobile toggle keeps the accessible name while visually collapsing its text.
- Reduced-motion preference continues to disable nonessential animation.

## Validation notes

- Static contract tests assert pre-hydration initialization, persistence, system fallback, light palette tokens, toggle labels, and focus-visible styling.
- Browser evidence should cover both themes on public pages. Protected product pages must be verified with a non-production test session; production credentials are not used solely for screenshots.
