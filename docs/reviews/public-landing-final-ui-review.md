# Public landing final UI/UX review (Steps 25–34)

**Date:** 2026-10-21  
**Branch:** `feature/public-landing-enhancements`  
**Baseline:** `5cd1685` (Steps 25–34 already on `development` and `main`)

## Pre-review

Steps 25–34 are implemented and merged. This pass is a small public-only hardening change, not a new roadmap step.

| Priority | Issue | Action |
| --- | --- | --- |
| P1 | Seven primary links overflow between 768px and ~1024px | Desktop nav from `lg`; menu below that |
| P2 | Footer links below comfortable touch height | `min-h-11` |
| P2 | Fixed 56px header clips wrapped brand row | `min-h-14` |
| P1 | Native si/ta review | **Not done** — documented, not invented |
| P2 | New photographs | **Not added** — only existing CC BY-SA assets |
| P3 | Homepage language switch drops hash | Left unchanged (SSR/hash hydration risk) |

## Post-review

| Check | Result |
| --- | --- |
| `npm run test:web` | **PASS** (96) |
| type-check / lint / build | **PASS** (lint: pre-existing data-table warning) |
| Viewports, axe, Lighthouse, screen reader | **NOT RUN** |
| Internal dashboards | Not edited |

**Public-release readiness:** PARTIAL (native review and manual a11y outstanding).  
**Technical PR readiness:** after this commit, small follow-up only.

**Suggested commit:** `style(landing): finalize trilingual public-site UX and quality`

**Step 35:** not started.
