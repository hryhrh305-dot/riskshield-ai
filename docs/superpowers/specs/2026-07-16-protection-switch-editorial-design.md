# Protection Settings Editorial Switch Design

## Scope

Replace only the four toggle controls in the Dashboard Protection Settings card. Preserve their state, click behavior, accessibility attributes, settings persistence, surrounding copy, layout, and Save Settings button.

## Visual Direction

Use a compact editorial switch with strong ink-and-paper contrast instead of the current fluorescent green control.

- Size: approximately 64 by 30 pixels, with no change to the surrounding row spacing.
- Shape: restrained capsule track with a circular thumb.
- Typography: small uppercase `ON` or `OFF` status inside the track, using the existing interface font.
- Motion: short horizontal thumb transition only; reduced-motion behavior remains governed by the existing global rule.

## Theme Treatment

### Light theme

- On track: deep navy ink.
- On thumb: warm ivory.
- Off track: warm paper.
- Off border and thumb: clearly visible navy/blue-gray.
- Status text: high contrast against the active track.

### Dark theme

- On track: warm ivory with a dark ink thumb and label.
- Off track: charcoal with a visible blue-gray border and ivory thumb.
- Status text: high contrast in both states.

## Interaction and Accessibility

- Keep the native button, `role="switch"`, `aria-checked`, and existing accessible label.
- Preserve the current click handler and settings data flow.
- Maintain a visible keyboard focus ring in both themes.
- The status must remain understandable without relying on color alone through the `ON` and `OFF` labels and thumb position.

## Implementation Boundary

- Add dedicated semantic classes to the existing switch elements.
- Add theme-scoped CSS for those classes.
- Do not change setting names, descriptions, business rules, API behavior, persistence, layout, other buttons, or other pages.

## Verification

- Add a regression contract for the semantic switch classes and theme styles.
- Verify enabled and disabled states in both light and dark themes.
- Verify click behavior updates `aria-checked` and moves the thumb.
- Run the targeted theme test and the full test suite.
