# Batch 2B — Part 1 review (Infrastructure Problem, Platform Features, Lifecycle)

**Branch:** `feature/infraos-connected-future-ui`  
**Base commit (Batch 2A):** `da4aea1` — *style(landing): Batch 2A hero and RoadSync visual corrections*  
**Date:** 2026-10-21  
**Scope:** Part 1 only — **STOP** before GIS/audiences/trust (Part 2) and FAQ/footer (Part 3).

## Summary

Batch 2B Part 1 replaces the pre-2B **uniform white card grids** (visual-rescue patterns) with three distinct Connected Future sections: an **editorial problem story** with licensed construction photography, **ProjectTrace / RoadSync spotlights** plus a compact planned-capabilities panel, and an **eight-stage connected-route lifecycle** on a dark network canvas. Batch 2A hero, RoadSync signature block, header, typography, national palette, anchors, and disclosure tone are preserved.

## Changed files

| File | Role |
| --- | --- |
| `apps/web/src/components/landing/infrastructure-problem-section.tsx` | Editorial layout: photo + flow vignette + three icon fact rows |
| `apps/web/src/components/landing/platform-features-section.tsx` | Spotlight panels for ProjectTrace/RoadSync; dashed planned roadmap |
| `apps/web/src/components/landing/infrastructure-lifecycle-section.tsx` | Wires new connected path component + scenario footer |
| `apps/web/src/components/landing/connected-lifecycle-path.tsx` | **New** — 8-stage route/timeline (desktop grid, mobile vertical) |
| `apps/web/src/styles/public-batch-2b-part1.css` | **New** — section-specific layout, accents, responsive lifecycle |
| `apps/web/src/app/globals.css` | Imports `public-batch-2b-part1.css` |
| `apps/web/src/lib/landing/messages.ts` | en/si/ta copy: `problem.callout`, `problem.flowLabel`, retitled problem cards (UI shows first 3), `features.plannedPanelTitle` |
| `docs/reviews/connected-future/capture-batch-2b-part1.mjs` | **New** — Playwright section capture helper (review tooling) |
| `docs/reviews/connected-future/screenshots/batch-2b-*` | Before/after section PNGs (this review) |

**Unchanged on homepage (Batch 2A):** `landing-hero.tsx`, `roadsync-signature-section.tsx`, `roadsync-infographic.tsx`, `public-connected-future.css`, header/mobile nav, `#solution` / RoadSync anchor flow.

**Legacy (not used by Part 1 sections):** `lifecycle-stepper.tsx`, older classes in `public-landing-visual-rescue.css` — retained for other routes/tests compatibility.

## Visual improvements

### Infrastructure Problem (`#problem`)

- **Before:** Text column + generic expressway photo; four equal stacked cards (`batch-2b-before-en-problem-1440.png`).
- **After:** Construction corridor photo (Seeduwa, CC BY-SA) with maroon accent frame; illustrative **same-corridor / separate-schedules** flow card; three **color-coded fact rows** (MapPin / CalendarRange / Shovel) with callout band — no fourth duplicate card in the UI (fourth card remains in copy for tests/data parity).
- Distinct from hero (two-column story vs hero stage) and RoadSync (narrative vs calendar infographic).

### Platform Features (`#features`)

- **Before:** Five similar white cards in one grid.
- **After:** Large **ProjectTrace** (orange) and **RoadSync** (green) spotlights with mini SVG motifs; **planned capabilities** in a dashed neutral panel with explicit “not live on this site” title; module names kept in English where appropriate with localized titles/bodies.

### Infrastructure Lifecycle (`#how-it-works`)

- **Before:** Repetitive step boxes / stepper styling.
- **After:** Dark **network canvas**, numbered nodes, Lucide stage icons, national-color node rings, desktop **4×2 connected grid** with route lines; mobile **vertical sequence** with the same text (no hover-only content). Scenario + approvals disclaimer block retained below.

## Photography & attribution

| Asset | Section | License |
| --- | --- | --- |
| `expressway-construction-seeduwa.jpg` | Problem figure | Rehman Abubakr, [CC BY-SA](https://commons.wikimedia.org/wiki/File:ConstructionE03-January2012-01.JPG) |

Manifest: `docs/design/public-landing-photography-manifest.md` (Problem + Hero share this file). On-page credits via `copy.photography.problemExpresswayCredit`.

## Localization

- **Locales:** English, Sinhala (`/si`), Tamil (`/ta`) — static `messages.ts` keys aligned for new fields (`callout`, `flowLabel`, `plannedPanelTitle`, updated problem card titles/bodies for cards 1–3).
- **Status:** `unverified-draft` — native-speaker review **pending** (documented; no OpenRouter on landing).
- **Script fonts:** Noto Sans Sinhala / Tamil via existing layout tokens (unchanged).

## Tests & build

| Command | Result |
| --- | --- |
| `npm run test:web` | **95/95 pass** |
| `npm run type-check:web` | **Pass** |
| `npm run lint:web` | **Pass** (0 errors; existing TanStack Table warning in dashboard data-table) |
| `npm run build:web` | **Pass** |

## Independent review checklist

| Check | Result |
| --- | --- |
| Section anchors `#problem`, `#features`, `#how-it-works` | **Pass** (navigation tests + capture script) |
| Heading hierarchy (H2 section titles, H3 fact/feature titles) | **Pass** (component markup review) |
| No implied live maps / auth / national data | **Pass** (planned panel + feature disclaimers) |
| National palette (#FF5B00, #FEB600, #8C1F28, #279541) | **Pass** (CSS tokens in Part 1 stylesheet) |
| Batch 2A hero / RoadSync regression (build + spot screenshots) | **Pass** (no edits in 2A files this batch) |
| Internal dashboards untouched | **Pass** (landing-only diff scope) |
| Keyboard / focus manual pass | **NOT RUN** (relies on existing focus-visible + semantic links; recommend quick tab-through QA) |
| Screen reader walkthrough | **NOT RUN** |
| 320 / 768 / 1920 full-page sweep | **NOT RUN** (375 + 1440 section captures only) |
| `prefers-reduced-motion` | **Pass** (no mandatory motion; lifecycle info visible without animation) |
| Horizontal overflow scan (all locales) | **NOT RUN** (visual review at 375/1440 on en/si/ta samples) |

## Remaining defects / follow-ups

| Priority | Item |
| --- | --- |
| P1 | Native-speaker review of si/ta problem/features/lifecycle strings |
| P2 | Manual keyboard + SR audit on new fact rows and lifecycle nodes |
| P2 | Fourth problem card exists in data but not rendered — intentional for layout; confirm product copy strategy |
| P3 | Remove or relocate local Playwright `node_modules` under `docs/reviews/connected-future` if not wanted in repo (`.gitignore` added) |
| P3 | Optional: prune unused visual-rescue section classes once Parts 2–3 land |

## Screenshots

**Before** = production build at commit `da4aea1` (port 3001). **After** = current working tree (port 3000).

### English — desktop (1440)

| Section | Before | After |
| --- | --- | --- |
| Problem | `screenshots/batch-2b-before-en-problem-1440.png` | `screenshots/batch-2b-after-en-problem-1440.png` |
| Features | `screenshots/batch-2b-before-en-features-1440.png` | `screenshots/batch-2b-after-en-features-1440.png` |
| Lifecycle | `screenshots/batch-2b-before-en-lifecycle-1440.png` | `screenshots/batch-2b-after-en-lifecycle-1440.png` |

### English — mobile (375)

| Section | Before | After |
| --- | --- | --- |
| Problem | `screenshots/batch-2b-before-en-problem-375.png` | `screenshots/batch-2b-after-en-problem-375.png` |
| Features | `screenshots/batch-2b-before-en-features-375.png` | `screenshots/batch-2b-after-en-features-375.png` |
| Lifecycle | `screenshots/batch-2b-before-en-lifecycle-375.png` | `screenshots/batch-2b-after-en-lifecycle-375.png` |

### Sinhala / Tamil (1440 samples)

- `screenshots/batch-2b-after-si-problem-1440.png`
- `screenshots/batch-2b-after-si-features-1440.png`
- `screenshots/batch-2b-after-ta-features-1440.png`
- `screenshots/batch-2b-after-ta-lifecycle-1440.png`

Re-capture after local changes:

```bash
cd docs/reviews/connected-future
node capture-batch-2b-part1.mjs --base=http://localhost:3000 --prefix=batch-2b-after
```

## Git status (Part 1 — not committed)

Expected modified/untracked: Part 1 components, CSS, `messages.ts`, `globals.css`, review doc + screenshots, capture script, `.gitignore` under `docs/reviews/connected-future/`. **No commit, push, or merge** per instruction.

## STOP

Batch 2B **Part 1 complete**. Do **not** start Part 2 (GIS/audiences/trust), Part 3 (FAQ/footer), Phase 3, or Step 35 until authorized.
