# Dark mode plan (P2 — not enabled in Step 17)

## Current state

- `tokens.css` includes a `.dark { … }` block and shadcn-compatible variables for a future toggle.
- The application **does not** set `class="dark"` on `<html>` and has no theme switcher.

## Why deferred

Step 17 scope is the light-first government/enterprise canvas. Full dark parity requires Step 18 typography/spacing review and Step 19 component pass.

## When implementing

1. Re-run `contrast.test.ts` with dark surface/text pairs.
2. Adjust `--status-*` surfaces for `#1F2937` panels.
3. Keep brand hexes unchanged; tune derived foregrounds only.
4. Respect `prefers-color-scheme` only if product approves — do not silently override user OS preference without a setting.
