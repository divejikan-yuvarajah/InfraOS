# Batch 2A — Designer-level final report

**Status:** Ready for **visual approval** (no commit/push performed).  
**Branch:** `feature/infraos-connected-future-ui`  
**Translation status:** `unverified-draft` (si/ta pending native review)

## What changed

1. **Hero** — Editorial stage: overlapping white content panel on dominant Seeduwa construction photo, route annotation SVG, gradient scrim, Manrope H1, headline *“Better infrastructure starts with connected plans.”*
2. **RoadSync** — Engineering-style SVG infographic (`roadsync-infographic.tsx`): corridor map strip, date rails, 9-day overlap (20–28 May inclusive), agency review panel; mobile text stack below 768px.
3. **Header** — Removed duplicate orange header CTA; desktop nav ≥1024px; **English | සිංහල | தமிழ்** in utility bar.
4. **Copy** — EN/si/ta hero + photography alt/credit for construction hero; overlap label *Shared corridor segment*.

## Screenshots (after)

Captured at `http://localhost:3000` (dev). Files in `docs/reviews/connected-future/screenshots/`:

| File | Viewport |
| --- | --- |
| `designer-en-hero-1440.png` | Desktop hero |
| `designer-en-roadsync-1440.png` | Desktop RoadSync (`#solution`) |
| `designer-en-hero-375.png` | Mobile hero |
| `designer-en-roadsync-375.png` / `designer-en-roadsync-375-diagram.png` | Mobile RoadSync |
| `designer-en-hero-320.png` | Narrow mobile |
| `designer-en-hero-768.png` | Tablet |
| `designer-si-hero-1440.png` | Sinhala hero |
| `designer-ta-hero-1440.png` | Tamil hero |
| `batch-2a-designer-en-hero-1440-v2.png` | Alternate desktop hero capture |

## Image license (hero)

- **File:** `apps/web/public/landing/photos/expressway-construction-seeduwa.jpg`
- **Source:** [ConstructionE03-January2012-01.JPG](https://commons.wikimedia.org/wiki/File:ConstructionE03-January2012-01.JPG)
- **Author:** Rehman Abubakr — **CC BY-SA**
- **Manifest:** `docs/design/public-landing-photography-manifest.md`

## Typography

- **Body / UI:** Geist (`--font-sans`)
- **Display (public landing only):** Manrope 500–800 (`--font-display`)
- **si/ta:** Noto Sans Sinhala / Tamil via existing layout variables

## Tests (2026-10-21)

| Script | Result |
| --- | --- |
| `npm run test:web` | **95/95 pass** |
| `npm run type-check:web` | **Pass** |
| `npm run lint:web` | **Pass** (0 errors; 1 existing data-table warning) |
| `npm run build:web` | **Pass** |

## Accessibility / QA notes

- Hero: semantic `<section>`, `aria-labelledby`, photo alt + visible credit
- RoadSync: `<figure>`, SVG `<title>`/`<desc>`, mobile `<dl>` fallback
- Primary CTA: `#solution`; secondary: how-it-works route
- Reduced motion: no new animation libraries; overlay is static SVG
- **OpenRouter:** not used on public site

## Changed / new files (Batch 2A surface)

- `apps/web/src/components/landing/landing-hero.tsx`
- `apps/web/src/components/landing/hero-coordination-overlay.tsx`
- `apps/web/src/components/landing/roadsync-infographic.tsx`
- `apps/web/src/components/landing/roadsync-signature-section.tsx`
- `apps/web/src/components/landing/public-site-header.tsx`
- `apps/web/src/styles/public-connected-future.css`
- `apps/web/src/app/layout.tsx`, `globals.css`
- `apps/web/src/lib/landing/messages.ts`, `locales.ts`, `messages.test.ts`
- `docs/design/public-landing-photography-manifest.md`

Legacy / unused in render path (safe to delete in a later cleanup): `hero-route-layer.tsx`, `roadsync-coordination-showcase.tsx`.

## Git

Working tree: **modified + untracked** Batch 2A files only; **no commit, push, or merge**.

## STOP — approval gate

Please review the screenshot folder above. Reply **approve Batch 2A** or list specific revisions. Batch 2B remains **not started**.
