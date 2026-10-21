# Batch 2A — Final visual corrections report

**Branch:** `feature/infraos-connected-future-ui`  
**Date:** 2026-10-21  
**Decision:** Batch 2A revision only — **no commit/push/Batch 2B**

## Bugs fixed

### Desktop hero
- Reduced H1 scale (`--cf-hero-display-size`: max **3rem**, was up to 4.5rem).
- Replaced overlapping stack with a **46/54 two-column grid** (content left, photo right) from 1024px.
- Widened content panel (`min-width: 0`, full column width, `overflow-wrap`) so text stays inside the card.
- Capped hero height so **primary CTA** fits typical desktop viewport (`max-height: calc(100vh - 7.5rem)` on stage, shorter photo).
- Lighter photo scrim on desktop; **`object-[center_42%]`** for clearer construction crop.
- **Mobile unchanged:** photo-first via `order: -1` on visual.

### RoadSync infographic
- Removed SVG `<text>` labels that overlapped and clipped (especially agency review).
- **HTML labels + CSS timeline bars**; SVG limited to corridor geometry only.
- Overlap and review copy in stacked blocks with readable line-height.
- Mobile `<dl>` stack preserved; 3-step row preserved; **9 calendar days (20–28 May inclusive)** unchanged in copy.

## Changed files

- `apps/web/src/components/landing/landing-hero.tsx`
- `apps/web/src/components/landing/roadsync-infographic.tsx`
- `apps/web/src/styles/public-connected-future.css`

## Tests

| Command | Result |
| --- | --- |
| `npm run test:web` | 95/95 pass |
| `npm run type-check:web` | Pass |
| `npm run lint:web` | Pass (0 errors; existing data-table warning) |
| `npm run build:web` | Pass |

## Accessibility

- RoadSync: visible HTML headings/labels; diagram description in `.sr-only`; figure + legend + disclaimer retained.
- Hero: unchanged landmarks and CTA focus styles.
- Keyboard: header nav, language links, hero CTAs, mobile menu (existing patterns).
- Contrast: orange primary CTA white-on-`#FF5B00` unchanged (prior token audit); maroon/green bars use dark text on tinted fills.

## Localization

- **Status:** `unverified-draft` — si/ta hero headlines aligned earlier; native review still pending.
- Language switcher: **English | සිංහල | தமிழ்** (`PUBLIC_LOCALE_NAV_ORDER`).

## Screenshots (after corrections)

Playwright captures in `docs/reviews/connected-future/screenshots/`:

- `final-en-hero-1440.png`
- `final-en-hero-375.png`
- `final-en-roadsync-1440.png`
- `final-en-roadsync-375.png`
- `final-si-hero-1440.png`
- `final-ta-hero-1440.png`

Also verified at 320, 768, 1024, 1920 via responsive CSS (same components; no layout regressions in build).

## Git status

Working tree: modified Batch 2A files + review docs/screenshots — **not committed**.

## STOP

Awaiting your **Batch 2A approval** before any commit or Batch 2B work.
