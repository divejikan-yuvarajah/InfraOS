# Batch 2B — Part 3 review (FAQ, CTAs, footer, supporting pages)

**Branch:** `feature/infraos-connected-future-ui`  
**HEAD (committed):** `db89d5e` — Part 2; Part 3 **uncommitted** at review time  
**Date:** 2026-10-22  
**Prerequisites:** Parts 1–2 committed; owner authorized Part 3 in chat  
**Status:** **READY FOR OWNER VISUAL APPROVAL**

## Summary

Part 3 completes the public support layer: **grouped FAQ** (`<details>`), **charcoal next-steps CTA** (primary → `#solution` RoadSync, secondary → lifecycle), **three-column Connected Future footer** (explore / information / languages), and **aligned info pages** (`public-connected-future` + editorial template). No fake login, forms, or support chat.

## Changed files

| File | Change |
| --- | --- |
| `landing-faq-section.tsx` | Topic groups, accessible details, link to `/faq` |
| `landing-next-steps-section.tsx` | Route motif, orange primary CTA to `#solution` |
| `public-site-footer.tsx` | Wordmark, column IA, contact link, removed footer stepper |
| `public-information-page.tsx` | Connected Future shell + `cf-info-page` sections |
| `public-faq-page.tsx` | Same shell; FAQ without duplicate full-page link |
| `public-how-it-works-page.tsx` | Connected Future header + info styling |
| `public-home.tsx` | Pass `locale` into FAQ |
| `public-batch-2b-part3.css` | **New** scoped styles |
| `globals.css` | Import Part 3 CSS |
| `faq-items.ts` | `FAQ_TOPIC_GROUPS`, `solution` next-step anchor |
| `messages.ts` | FAQ topics, footer nav labels, contact link, CTA copy (en/si/ta) |
| `public-info-pages.ts` | `contact` footer href |
| `landing-trust-faq.test.ts` | FAQ grouping + `solution` anchor |
| `landing-footer-pages.test.ts` | Contact footer path |
| `capture-batch-2b-part3.mjs` | Screenshot helper |

## Screenshots (after)

`docs/reviews/connected-future/screenshots/batch-2b-part3-after-*` — FAQ, next-steps, footer (1440/375), `/about`, `/si/faq`.

**Before:** Pre–Part 3 UI at commit `db89d5e` (plain FAQ list, light CTA band, legacy footer). Re-capture with stash workflow if needed.

## Tests

| Command | Result |
| --- | --- |
| `npm run test:web` | **96/96 pass** (+1 FAQ grouping test) |
| `npm run type-check:web` | **Pass** |
| `npm run lint:web` | **Pass** (existing data-table warning) |
| `npm run build:web` | **Pass** |
| `git diff --check` | **Pass** |

## Localization

- FAQ topics, CTA labels, footer `linkContact` / column titles: **en + si/ta draft**
- **Native review:** PENDING (documented in `translationDraftNote`)

## Accessibility (automated / code review)

- FAQ: native `<details>`/`<summary>`, focus-visible, sr-only count hint  
- CTAs: min height, focus ring on dark band  
- Footer: 44px-ish link targets, language nav preserved  
- **NOT RUN:** axe, full SR walkthrough, 200%/400% zoom matrix

## STOP

Part 3 complete. See `PHASE-2-PUBLIC-SITE-FINAL-QA.md` for full Phase 2 gate. No commit/push/PR performed.
