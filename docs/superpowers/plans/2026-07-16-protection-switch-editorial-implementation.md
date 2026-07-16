# Protection Settings Editorial Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the four low-contrast Protection Settings toggles with a clearly visible editorial switch in both light and dark themes without changing settings behavior.

**Architecture:** Keep the existing native button, state, click handler, `role="switch"`, and `aria-checked`. Replace only the switch-specific utility-class composition with semantic classes, then define state- and theme-scoped CSS in the existing global stylesheet.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS utilities, global CSS, Vitest.

## Global Constraints

- Modify only the Protection Settings switch controls, their theme styles, and the existing theme regression test.
- Preserve all setting names, descriptions, persistence, click behavior, layout, and the Save Settings button.
- Preserve `role="switch"`, `aria-checked`, `aria-label`, and keyboard focus visibility.
- Do not modify other buttons, cards, pages, APIs, database behavior, or risk-scoring rules.
- Do not use subagents without explicit user approval.

---

### Task 1: Editorial Protection Switch

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx:745-777`
- Modify: `src/app/globals.css`
- Test: `tests/e8-6-positioning-theme.test.ts`

**Interfaces:**
- Consumes: the existing `enabled` boolean and `setSettings({ ...s, [typedKey]: !s[typedKey] })` click handler.
- Produces: `.rs-editorial-switch`, `.rs-editorial-switch-label`, and `.rs-editorial-switch-thumb` styling hooks while preserving the existing accessible switch contract.

- [ ] **Step 1: Write the failing theme contract**

Add these assertions inside the existing `E8.6 theme contract` test:

```ts
expect(dashboard).toContain("rs-editorial-switch");
expect(dashboard).toContain("rs-editorial-switch-label");
expect(dashboard).toContain("rs-editorial-switch-thumb");
expect(dashboard).toContain('role="switch"');
expect(dashboard).toContain("aria-checked={enabled}");
expect(globals).toMatch(/\.rs-editorial-switch\s*\{/);
expect(globals).toMatch(/\.rs-editorial-switch\[aria-checked="true"\]\s*\{/);
expect(globals).toMatch(/html\[data-theme="light"\][^}]*\.rs-editorial-switch/s);
```

- [ ] **Step 2: Run the targeted test and verify RED**

Run:

```powershell
npm test -- --run tests/e8-6-positioning-theme.test.ts
```

Expected: one theme-contract failure because the three editorial switch classes do not exist yet.

- [ ] **Step 3: Replace only the switch markup classes**

Keep the current button attributes and click handler. Replace its visual children with:

```tsx
<button
  type="button"
  role="switch"
  aria-checked={enabled}
  aria-label={label}
  onClick={() => {
    setSettings({ ...s, [typedKey]: !s[typedKey] });
  }}
  className="rs-editorial-switch"
>
  <span className="rs-editorial-switch-label">{enabled ? "On" : "Off"}</span>
  <span className="rs-editorial-switch-thumb" />
</button>
```

- [ ] **Step 4: Add the dark/default editorial style**

Add the following focused rules to `src/app/globals.css`:

```css
.rs-editorial-switch {
  position: relative;
  display: inline-flex;
  width: 4rem;
  height: 1.875rem;
  flex: 0 0 auto;
  align-items: center;
  border: 1px solid #687587;
  border-radius: 9999px;
  background: #151a22;
  color: #e8e0d7;
  cursor: pointer;
  transition: border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease;
}

.rs-editorial-switch-label {
  position: absolute;
  right: 0.55rem;
  font-size: 0.55rem;
  font-weight: 750;
  line-height: 1;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  pointer-events: none;
}

.rs-editorial-switch-thumb {
  position: absolute;
  left: 3px;
  width: 1.375rem;
  height: 1.375rem;
  border: 1px solid #d8c9bd;
  border-radius: 9999px;
  background: #f6ede5;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.32);
  transition: transform 180ms ease, background-color 180ms ease, border-color 180ms ease;
}

.rs-editorial-switch[aria-checked="true"] {
  border-color: #d7c9bb;
  background: #f1e8dc;
  color: #10233e;
}

.rs-editorial-switch[aria-checked="true"] .rs-editorial-switch-label {
  left: 0.55rem;
  right: auto;
}

.rs-editorial-switch[aria-checked="true"] .rs-editorial-switch-thumb {
  transform: translateX(34px);
  border-color: #10233e;
  background: #10233e;
}
```

- [ ] **Step 5: Add light theme contrast overrides**

Add:

```css
html[data-theme="light"] :where(.rs-shell, .rs-app) .rs-editorial-switch {
  border-color: #8f9baa;
  background: #fffdf8;
  color: #394b60;
}

html[data-theme="light"] :where(.rs-shell, .rs-app) .rs-editorial-switch .rs-editorial-switch-thumb {
  border-color: #10233e;
  background: #10233e;
  box-shadow: 0 3px 10px rgba(16, 35, 62, 0.18);
}

html[data-theme="light"] :where(.rs-shell, .rs-app) .rs-editorial-switch[aria-checked="true"] {
  border-color: #10233e;
  background: #10233e;
  color: #fff8f2;
}

html[data-theme="light"] :where(.rs-shell, .rs-app) .rs-editorial-switch[aria-checked="true"] .rs-editorial-switch-thumb {
  border-color: #e7d4c6;
  background: #f6ede5;
}
```

- [ ] **Step 6: Run targeted and full tests**

Run:

```powershell
npm test -- --run tests/e8-6-positioning-theme.test.ts
npm test -- --run
git diff --check
```

Expected: 8 targeted tests pass, all full-suite tests pass, and `git diff --check` exits successfully.

- [ ] **Step 7: Verify both themes in a browser**

Open `http://localhost:3000/dashboard` with an authenticated test session and verify:

- Each row has a clearly visible 64-by-30-pixel switch.
- On and Off remain readable without relying only on color.
- Clicking a switch changes `aria-checked`, label text, and thumb position.
- Light and dark themes both maintain clear contrast.
- The Save Settings button and surrounding layout remain unchanged.

- [ ] **Step 8: Commit only the implementation files after user approval**

```powershell
git add -- 'src/app/(dashboard)/dashboard/page.tsx' 'src/app/globals.css' 'tests/e8-6-positioning-theme.test.ts'
git commit -m "Refine protection setting switches"
```
