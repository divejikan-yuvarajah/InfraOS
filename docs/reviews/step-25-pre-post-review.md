# Step 25 — Public header, navigation and hero

**Branch:** `feature/public-landing-core`  
**Base:** `development` @ `7f138ff` (Step 24 accessibility foundation merged)  
**Scope:** Step 25 only — not Step 26+

## Pre-review summary

| Item | Finding |
| --- | --- |
| Step 24 on `development` | Yes — `7f138ff` |
| Prior `/` behavior | Dev foundation fixtures + temporary health copy |
| Route groups | Flat `app/page.tsx` at `/`; Step 23 shell remains dev fixture only |
| Skip link | Root layout → `#main` (Step 24 `MAIN_CONTENT_ID`) |
| Branch policy | Shared `feature/public-landing-core` (not per-step branch) |

## Implementation

| Path | Role |
| --- | --- |
| `apps/web/src/components/landing/public-site-header.tsx` | Sticky public header, desktop nav |
| `apps/web/src/components/landing/public-mobile-nav.tsx` | Client Sheet mobile menu |
| `apps/web/src/components/landing/landing-hero.tsx` | Marketing hero, one H1 |
| `apps/web/src/components/landing/hero-coordination-illustration.tsx` | Illustrative SVG + labeled badges |
| `apps/web/src/lib/landing/navigation.ts` | Typed nav config |
| `apps/web/src/lib/landing/public-content.ts` | Hero copy constants |
| `apps/web/src/components/dev/ui-foundation-fixtures.tsx` | Dev-only Step 17–24 previews |
| `apps/web/src/app/page.tsx` | Public landing composition + metadata |
| `docs/marketing/content-claims.md` | Claims register |

## CTAs and nav

- **Home:** `/`
- **Coordination example:** `#hero-overview` (in-page, Step 25)
- **Deferred:** `#problem`, `#solution`, `/login`, marketing subroutes (Steps 26+ / page inventory)

## Post-implementation review

| Check | Result |
| --- | --- |
| `npm run test` (apps/web) | PASS (52 tests, incl. navigation + public-content) |
| `npm run type-check` | PASS |
| `npm run lint` | PASS (0 errors; pre-existing TanStack warning in data-table) |
| `npm run build` | PASS (static `/`) |
| Manual viewport/keyboard/axe | NOT RUN (no browser session in implementation run) |

Build note: `Button asChild` + anchor avoided — `buttonVariants` on `<a>` (Radix Slot requires single child; Button renders loader slot + children).

**Step 26 approval:** Pending user authorization on same branch.
