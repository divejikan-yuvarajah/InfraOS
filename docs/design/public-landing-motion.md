# Public landing motion (Step 33)

**Scope:** `/`, `/si`, `/ta`, and public supporting pages only.

## Policy

- **CSS-first** using Step 18 tokens (`--motion-duration-normal`, `--motion-ease-standard`).
- **No GSAP** on this checkpoint (not installed; not required for approved micro-interactions).
- Content is visible in SSR/HTML without JavaScript; no opacity-0 entrance gates.

## Effects in use

| Effect | Implementation | Reduced motion |
| --- | --- | --- |
| Link/button hover/focus color | `.public-motion-interactive` on landing nav, footer, CTAs, mobile menu links | Transitions disabled |
| In-page anchor scroll | `html:focus-within { scroll-behavior: smooth }` when motion allowed | Global `scroll-behavior: auto` in `globals.css` |
| Mobile menu | Existing Radix Sheet; focus returns to menu button on close | Sheet animations shortened via global reduce rule |
| FAQ chevron | Existing `group-open:rotate-180` + `motion-reduce:transition-none` | Unchanged |
| Lifecycle cards | Subtle border hover via `.public-motion-interactive` | Transitions disabled |

## Files

- `apps/web/src/styles/public-landing-motion.css`
- `apps/web/src/lib/landing/public-motion.ts` (policy constant for tests)

## Out of scope

Parallax, scroll pinning, carousels, count-up stats, autoplay, full-page client wrappers, internal dashboard components.
