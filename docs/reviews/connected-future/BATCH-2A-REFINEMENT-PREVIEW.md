# Batch 2A — Refinement preview (designer-level)

**Branch:** `feature/infraos-connected-future-ui`  
**Date:** 2026-10-21  
**Scope:** Header, hero, RoadSync only (Batch 2A). No Batch 2B / Phase 3.

## Part A — Audit (before this pass)

| Area | Defect | Root cause (files) |
| --- | --- | --- |
| Hero | Generic 50/50 split; photo felt detached from coordination story | `landing-hero.tsx` grid layout; `public-connected-future.css` symmetric columns |
| Hero imagery | Empty highway read; weak “works” story | Prior hero used Southern Expressway scenic photo |
| RoadSync | Thin corridor line + stacked bordered bars | `roadsync-coordination-showcase.tsx` schematic CSS |
| Header | Duplicate loud orange CTA vs hero | `public-site-header.tsx` `cf-site-header__cta` |
| Typography | Modest display scale; all Geist | `--cf-display-size` capped ~2.75rem; no display family |
| si/ta | Headlines not aligned with EN editorial H1 | `messages.ts` hero titles |

**Before captures:** Prior refinement PNGs under `docs/reviews/connected-future/screenshots/` (`refinement-*`, `batch-2a-after-*`).

## Art direction (single)

**Professional Infrastructure Intelligence** — warm `#FAF6F0` base, charcoal type, flag palette as *roles* (maroon structure, orange primary action, green utility, gold highlights). One dominant Seeduwa **construction** photo with lightweight route annotation; copy panel overlaps photo on desktop (editorial stage, not 50/50).

## Image choice

| Option | Verdict |
| --- | --- |
| Southern Expressway scenic (De Alwis) | Weaker “active works” story — kept for lifecycle only |
| **Seeduwa expressway construction (Abubakr, CC BY-SA)** | **Selected** — earthworks/corridor activity; Wikimedia-verified |
| AI-generated | Not used (no authorized generation in pipeline) |

## Typography

| Latin | Decision |
| --- | --- |
| Geist | Body, UI, nav |
| **Manrope** (`--font-display`) | Display: H1, section titles, wordmark title — scoped under `.public-connected-future` |
| Noto Sans Sinhala / Tamil | Unchanged; no uppercase/tracking on si/ta eyebrows |

## Locale risks (draft — native review pending)

| Risk | Mitigation |
| --- | --- |
| Long si/ta hero lines | Relaxed line-height; no Latin uppercase on eyebrows |
| RoadSync diagram SVG labels | English in SVG at md+; mobile `<dl>` uses localized strings |
| Mixed Latin in si/ta body | Glossary in `docs/design/public-landing-translation-glossary.md` |

## File plan (implemented)

- `landing-hero.tsx`, `hero-coordination-overlay.tsx`, `public-connected-future.css`
- `roadsync-infographic.tsx`, `roadsync-signature-section.tsx`
- `public-site-header.tsx` (header CTA removed)
- `messages.ts`, `layout.tsx` (Manrope), photography manifest
