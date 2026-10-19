# Spacing & layout (Step 18)

## Spacing scale

INFRAOS uses **Tailwind’s default 4px-based scale** (`1` = 4px, `2` = 8px, `4` = 16px, …). Do not fork the global spacing scale unless a documented exception is approved.

### Semantic recipes

| Pattern | Tailwind / token | Notes |
|---|---|---|
| Icon ↔ label | `gap-1` (4px) or `gap-2` (8px) | Toolbar, buttons |
| Label → control | `space-y-1` + `gap-2` to helper | Forms (Step 20) |
| Card inner padding | `p-4` compact / `p-6` comfortable | Match density to surface |
| Table cell (dense) | `px-3 py-2` | Step 21 |
| Page sections | `gap-6` – `gap-8` | Between major blocks |
| Dashboard grid | `gap-4` – `gap-6` | KPI grids |
| Map control touch | `p-2` minimum | Step 23+ |

## Page gutters

Utility: **`gutter-page`** — responsive horizontal padding:

| Viewport | Token | Value |
|---|---|---|
| Default (mobile) | `--gutter-page-mobile` | 16px |
| ≥640px | `--gutter-page-sm` | 20px |
| ≥768px | `--gutter-page-md` | 24px |
| ≥1024px | `--gutter-page-lg` | 32px |

## Container widths

Utilities (max-width + centered):

| Class | Token | Intent |
|---|---|---|
| `container-prose` | 42rem | Documents, long prose |
| `container-form` | 32rem | Standard forms |
| `container-content` | 48rem | Default content pages |
| `container-dashboard` | 90rem | Wide workspace / tables |
| (none) | full bleed | Maps — no arbitrary 1200px cap |

Combine `container-*` with `gutter-page` on page roots. **App shell/sidebar:** Step 23.

## Radius

shadcn base `--radius: 0.5rem` in `tokens.css` drives `--radius-sm` … `--radius-xl` in Tailwind theme. Reference tokens in `layout-tokens.css` (~6–16px). Avoid 24–36px radii on tables/inputs.

## Anti-patterns

- Fixed `max-w-[1200px]` on map workspaces.
- Inconsistent gutters (`px-4` on one page, magic `px-7` on another).
- Extra padding on every nested card (double padding).
