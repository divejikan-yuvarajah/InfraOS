# Design tokens dictionary (Steps 17–18)

## File map

| File | Step | Contents |
|---|---|---|
| `apps/web/src/styles/tokens.css` | 17 | Brand colors, neutrals, status, shadcn bridge |
| `apps/web/src/styles/typography-tokens.css` | 18 | Type scale, weights, line heights, font stacks |
| `apps/web/src/styles/layout-tokens.css` | 18 | Gutters, containers, shadows, z-index, motion |
| `apps/web/src/app/globals.css` | 17–18 | Tailwind `@theme`, utilities, base layer |
| `apps/web/src/lib/design/brand-tokens.ts` | 17 | Color hex for tests/charts |
| `apps/web/src/lib/design/design-tokens.ts` | 18 | Containers, z-index, motion for TS |

## Token dictionary (selected)

| Name | Value / location | Purpose | Do NOT use for |
|---|---|---|---|
| `--infra-orange` | `#FF5B00` | Brand, primary bg | Body text on white |
| `--primary-foreground` | `#111827` | Text on orange buttons | — |
| `--font-size-body` | `1rem` | Default reading size | KPI headlines |
| `--font-size-metric` | clamp 24–32px | KPI numbers | Paragraph text |
| `--gutter-page-*` | 16–32px | Horizontal page padding | Card inner only |
| `--container-dashboard` | `90rem` | Wide tables/maps chrome | Narrow forms |
| `--shadow-sm` | subtle | Optional card lift | Every KPI tile |
| `--z-modal` | `50` | Dialogs (Radix-aligned) | Random `z-[9999]` |
| `--motion-duration-normal` | `200ms` | Hover/focus transitions | GSAP (Step 33) |

## Utilities (Step 18)

Typography: `type-*` classes (see [typography.md](./typography.md)).

Layout: `gutter-page`, `container-content`, `container-dashboard`, `container-form`, `container-prose`.

Elevation: `shadow-elevation-sm|md|lg`.

Layering: `z-dropdown`, `z-overlay`, `z-toast` (prefer Radix defaults in components when they match).

Motion: `motion-standard` (respects `prefers-reduced-motion`).

## Step 16 policy

`semantic-colors.ts` maps enums to **visual** badge variants only — not permissions.

## Deferred (P2)

- Dark theme typography/shadow tuning ([dark-mode-plan.md](./dark-mode-plan.md))
- Full Tamil/Sinhala locale bundles and guaranteed webfont subset loading

## Related

- [brand-color-system.md](./brand-color-system.md)
- [color-accessibility.md](./color-accessibility.md)
- [motion-elevation.md](./motion-elevation.md)
