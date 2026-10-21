# Batch 2B — Part 2 review (GIS preview, audiences, trust, transparency)

**Branch:** `feature/infraos-connected-future-ui`  
**Date:** 2026-10-22  
**Commit:** `db89d5e` — *style(landing): Batch 2B Part 2 GIS, audiences, trust, and transparency*  
**Integration note:** [PR #45](https://github.com/divejikan-yuvarajah/InfraOS/pull/45) merged **Batch 2A only** (`da4aea1`) into `development`. Parts 1–2 remain on this feature branch until a follow-up PR.  
**Status:** **DELIVERED** — owner approved direction; post-delivery GIS mobile callout fix documented in `BATCH-2B-FINAL-CORRECTIONS-AND-INTEGRATION-READINESS.md`.

## Summary

Part 2 transforms four homepage sections into distinct Connected Future compositions: a **dark corridor schematic** with HTML labels and schedule bars (GIS preview), a **2×2 pathway grid** with role icons and real in-page links (audiences), a **warm trust ribbon + 2×2 factual cards** (trust), and a **charcoal dual-band module status** layout replacing the wide table (transparency). No live maps, APIs, login, or fake statistics were added.

## Changed files

| File | Change |
| --- | --- |
| `apps/web/src/components/landing/coordination-preview-figure.tsx` | Geometry-only SVG; HTML chips; timeline bars; sr-only title |
| `apps/web/src/components/landing/product-gis-preview-section.tsx` | Editorial layout + synthetic badge |
| `apps/web/src/components/landing/public-audiences-section.tsx` | Pathway panels + Lucide icons + benefits aside |
| `apps/web/src/components/landing/trust-information-section.tsx` | University ribbon + card grid + human-review note |
| `apps/web/src/components/landing/platform-transparency-section.tsx` | Explore vs planned bands (rows unchanged in data) |
| `apps/web/src/styles/public-batch-2b-part2.css` | **New** — scoped Part 2 styles |
| `apps/web/src/app/globals.css` | Imports Part 2 CSS |
| `apps/web/src/lib/landing/messages.ts` | en/si/ta: preview labels, trust ribbon/human review, transparency band titles |
| `docs/reviews/connected-future/capture-batch-2b-part2.mjs` | Screenshot helper |
| `docs/reviews/connected-future/screenshots/batch-2b-part2-*` | Before/after captures |

**Preserved:** Part 1 sections, Batch 2A hero/RoadSync, anchors (`#preview`, `#audiences`, `#trust-information`, `#transparency`), `preview-data.ts` fixtures and overlap dates.

## Design notes

- **GIS:** Illustrative corridor on charcoal canvas; agency chips; maroon shared segment; yellow overlap window on sample dates (2026-03-10 – 2026-03-20). Badge: “Illustrative example · Synthetic data · Not a live map.”
- **Audiences:** Four pathways (citizens, officers, field staff, visitors) with color top borders; CTAs only to `#problem`, `#solution`, `#features`, `#lifecycle`.
- **Trust:** Compact INFRAOS + university tag; four honest points; demo notice + human-review line for RoadSync.
- **Transparency:** Demonstration modules (ProjectTrace, RoadSync) vs planned/internal items—no percentages or government badges.

## Localization

- **Status:** `unverified-draft` — si/ta band titles and GIS chip strings added; native review **pending**.
- **Parity:** `messages.test.ts` key parity passes across en/si/ta.

## Images / licensing

- Part 2 uses **CSS/SVG only** for GIS schematic (no new photos). Existing photo manifest unchanged.

## Tests

| Command | Result |
| --- | --- |
| `npm run test:web` | **95/95 pass** |
| `npm run type-check:web` | **Pass** |
| `npm run lint:web` | **Pass** (existing data-table warning) |
| `npm run build:web` | **Pass** |
| `git diff --check` | **Pass** |

## Review checklist

| Check | Result |
| --- | --- |
| Anchors and navigation tests | **Pass** |
| No `/login`, fake maps, or live data claims | **Pass** (copy + tests) |
| Keyboard focus on audience links | **Pass** (focus-visible styles) |
| Screen reader text for diagram | **Pass** (sr-only title + figcaption) |
| Manual SR / axe / 320–1920 full sweep | **NOT RUN** |
| Batch 2A / Part 1 regression | **Pass** (build; no edits to hero/RoadSync/Part 1 components) |

## Screenshots

**Before** = stashed Part 2, production build port 3003. **After** = Part 2 applied, port 3002.

| Section | Before (1440) | After (1440) |
| --- | --- | --- |
| GIS preview | `batch-2b-part2-before-en-preview-1440.png` | `batch-2b-part2-after-en-preview-1440.png` |
| Audiences | `batch-2b-part2-before-en-audiences-1440.png` | `batch-2b-part2-after-en-audiences-1440.png` |
| Trust | `batch-2b-part2-before-en-trust-1440.png` | `batch-2b-part2-after-en-trust-1440.png` |
| Transparency | `batch-2b-part2-before-en-transparency-1440.png` | `batch-2b-part2-after-en-transparency-1440.png` |

Mobile 375: `*-preview-375`, `*-audiences-375`, `*-trust-375`, `*-transparency-375` (before/after).  
Locales: `batch-2b-part2-after-si-preview-1440.png`, `batch-2b-part2-after-ta-audiences-1440.png`.

Re-capture:

```bash
cd docs/reviews/connected-future
node capture-batch-2b-part2.mjs --base=http://localhost:3000 --prefix=batch-2b-part2-after
```

## Git status (updated 2026-10-22)

- Part 2 **committed** as `db89d5e` on `feature/infraos-connected-future-ui`.
- **Post-review correction (uncommitted):** responsive GIS callouts in `coordination-preview-figure.tsx` + `public-batch-2b-part2.css` — see final corrections report.

## Open items (P2/P3)

- P1: Native-speaker review of new si/ta GIS/trust strings.
- P2: Manual keyboard tab order through transparency bands and GIS figure on 320px — **partially addressed** by stacked callouts ≤639px.
- P3: Optional axe scan on `#preview` dark canvas contrast for caption text.

## Follow-on

Part 3 completed in commit `caf9ea1`. Phase 3 internal UI and Step 35 **not started**.
