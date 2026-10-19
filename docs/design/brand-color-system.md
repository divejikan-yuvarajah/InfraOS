# INFRAOS brand & color system (Step 17)

## Source of truth

| Layer | Path | Role |
|---|---|---|
| CSS variables | `apps/web/src/styles/tokens.css` | Authoritative runtime tokens (brand hex, neutrals, semantic status, shadcn bridge) |
| Tailwind v4 theme | `apps/web/src/app/globals.css` (`@theme inline`) | Maps CSS vars to utility classes (`bg-primary`, `text-status-success-fg`, etc.) |
| Programmatic hex | `apps/web/src/lib/design/brand-tokens.ts` | Charts/tests only — must stay in sync with `tokens.css` |
| Step 16 visual mapping | `apps/web/src/lib/design/semantic-colors.ts` | Maps domain enums → badge variants (**visual only**, not authorization) |

Do **not** use legacy roadmap colors `#0F172A` / `#F97316` as the active INFRAOS app brand.

## Approved identity palette

| Token | Hex | Usage |
|---|---|---|
| Primary orange | `#FF5B00` | Primary actions, selection, brand emphasis |
| Primary yellow | `#FEB600` | Pending, warning, review-required |
| Primary maroon | `#8C1F28` | Critical, conflict, rejection |
| Primary green | `#279541` | Approved, completed, resolved |

## Neutrals (light-first)

| Intent | Hex |
|---|---|
| Canvas | `#F8FAFC` |
| Surface | `#FFFFFF` |
| Strong text | `#111827` |
| Secondary text | `#475569` |
| Muted text | `#64748B` |
| Border | `#E2E8F0` |

## shadcn mapping (light theme)

- `--primary` → brand orange; `--primary-foreground` → `#111827` (accessible on orange buttons)
- `--destructive` → maroon; destructive buttons use tinted surfaces + maroon text
- Links use `--link-foreground` (`#B63D00`), not raw orange on white

## Interactive policy

- **Focus:** `:focus-visible` 2px outline using brand orange (see `globals.css`); forced-colors fallback uses `CanvasText`
- **Hover:** shadcn component opacity/mix defaults on primary/secondary
- **Selection:** `--selection-bg` `#FFF4ED` with strong text
- **Disabled:** `opacity: 0.5` on buttons (shadcn default)

## Charts / maps (guidance)

Chart CSS vars `--chart-1` … `--chart-5` follow orange → green → yellow → maroon → secondary text. Map layers should reuse semantic meaning, not invent parallel colors.

## Dark mode

A `.dark` token block exists for future use. **Not enabled by default.** See [dark-mode-plan.md](./dark-mode-plan.md).

## Limited brand gradient

`linear-gradient(90deg, #FF5B00 0%, #FEB600 100%)` — marketing/hero accents only, not dashboards or data rows.
