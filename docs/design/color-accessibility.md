# Color accessibility (Step 17)

## Requirements

- Normal text: **WCAG 2.x contrast ≥ 4.5:1**
- Large text / meaningful non-text UI: **≥ 3:1** where applicable
- Status: **never color alone** — pair with label and/or icon

Automated checks: `apps/web/src/lib/design/contrast.test.ts` (Vitest + `contrast.ts` sRGB formula).

## Approved pairs (verified in tests)

| Foreground | Background | Ratio (approx.) | Use |
|---|---|---:|---|
| `#111827` | `#FF5B00` | ≥ 4.5 | Primary button text |
| `#B63D00` | `#FFFFFF` | ≥ 4.5 | Links, orange emphasis on white |
| `#6C5311` | `#FFF8E6` | ≥ 4.5 | Pending/warning badge text |
| `#166B30` | `#ECFDF3` | ≥ 4.5 | Success badge text |
| `#8C1F28` | `#FDECEE` | ≥ 4.5 | Critical badge text |
| `#FFFFFF` | `#8C1F28` | ≥ 4.5 | Solid maroon destructive (if used) |

## Do not use for ordinary body text on white

| Foreground | Background | Issue |
|---|---|---|
| `#FF5B00` | `#FFFFFF` | ~3.11:1 — use `#B63D00` or surface badge |
| `#FEB600` | `#FFFFFF` | ~1.76:1 — use badge surface + `#6C5311` |
| `#FFFFFF` | `#279541` | ~3.85:1 — use dark text on green or tinted surface |

## Focus

Focus ring uses brand orange on light canvas. Verify per-component when Step 19 adds dense controls. `prefers-reduced-motion` respected in `globals.css`.

## Manual visual QA

Run the dev server and check:

- Home page token card (badges + buttons)
- Keyboard tab order and `:focus-visible` on buttons
- Narrow (~375px) and desktop widths

Record outcomes in the Step 17 handoff (PASS / NOT RUN).

## Dark mode

Not shipped in Step 17. Re-audit all pairs when `.dark` is enabled (P2).
