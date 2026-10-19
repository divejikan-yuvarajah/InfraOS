# Motion & elevation (Step 18)

## Motion tokens

| Token | Value | Use |
|---|---|---|
| `--motion-duration-fast` | 150ms | Hover, small toggles |
| `--motion-duration-normal` | 200ms | Default UI transitions |
| `--motion-duration-slow` | 300ms | Selective emphasis only |
| `--motion-ease-standard` | cubic-bezier(0.4, 0, 0.2, 1) | Default |
| `--motion-ease-out` | cubic-bezier(0, 0, 0.2, 1) | Enter animations |

Utility: **`motion-standard`** on elements that animate color/shadow/transform.

### Reduced motion

`globals.css` sets near-zero durations when `prefers-reduced-motion: reduce`. Do not hide essential content behind motion-only reveals.

**Out of scope:** GSAP, cinematic landing animation (Step 33).

## Shadow / elevation

| Token | Utility | When |
|---|---|---|
| `--shadow-none` | (default) | Most dashboard cards — use border |
| `--shadow-sm` | `shadow-elevation-sm` | Subtle lift |
| `--shadow-md` | `shadow-elevation-md` | Popovers, menus |
| `--shadow-lg` | `shadow-elevation-lg` | Dialogs/drawers |

Prefer **surface + border** over shadow for dense government tables.

## Z-index policy

| Token | Value | Owner (future) |
|---|---:|---|
| `--z-base` | 0 | Page content |
| `--z-sticky` | 20 | Sticky header (Step 23) |
| `--z-map-controls` | 30 | Map toolbar |
| `--z-dropdown` | 40 | Dropdowns |
| `--z-overlay` / `--z-modal` | 50 | Sheet/dialog (Radix) |
| `--z-toast` | 60 | Toasts |
| `--z-skip-link` | 70 | Skip link focus |

Stacking contexts still matter — avoid competing ladders. shadcn/Radix overlay z-50 is the reference for modals.

## Anti-patterns

- `z-[99999]` on arbitrary widgets
- Large drop shadows on every KPI card
- Long transitions on layout-critical properties during data entry
