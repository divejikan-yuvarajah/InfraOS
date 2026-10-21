# Phase 2 — Public site final QA (Connected Future / Batch 2B)

**Branch:** `feature/infraos-connected-future-ui`  
**Review date:** 2026-10-22  
**Scope:** Full public marketing surface (home + supporting routes), not internal app Phase 3.

## Readiness statuses

| Dimension | Status | Notes |
| --- | --- | --- |
| **Implementation completeness** | **COMPLETE** | Batch 2A + 2B Parts 1–3 implemented on feature branch |
| **Engineering PR readiness** | **READY** | Automated gates green; 96 unit tests; build OK |
| **Public launch readiness** | **PARTIAL / BLOCKED** | Pending native si/ta review, manual a11y/perf, owner/legal sign-off |

## Batch summary (2A → 2B-3)

| Batch | Sections / pages |
| --- | --- |
| **2A** | Hero, RoadSync signature, header, typography, photography |
| **2B-1** | Problem, features, lifecycle |
| **2B-2** | GIS preview, audiences, trust, transparency |
| **2B-3** | FAQ, next steps, footer, info page shell |

## Automated test evidence

```
npm run test:web        → PASS (96/96)
npm run type-check:web  → PASS
npm run lint:web        → PASS (0 errors; 1 pre-existing data-table warning)
npm run build:web       → PASS (24 public routes)
git diff --check        → PASS
```

## Manual / browser matrix

| Check | 320–1920 | en/si/ta | Result |
| --- | --- | --- | --- |
| Section anchors (#problem … #next-steps) | Spot (375/1440) | en + si samples | **PASS** (Playwright captures) |
| Supporting routes (/about, /faq, …) | About + /si/faq captured | si sample | **PARTIAL** (not every slug × locale) |
| Keyboard tab order | — | — | **NOT RUN** |
| Screen reader | — | — | **NOT RUN** |
| axe / Lighthouse | — | — | **NOT RUN** |
| LCP / CLS metrics | — | — | **NOT RUN** |
| Internal dashboard regression | — | — | **NOT RUN** (no dashboard code changed; smoke not re-run) |

## Trilingual matrix (summary)

| Area | en | si | ta | Human review |
| --- | --- | --- | --- | --- |
| Home sections | ✓ | ✓ | ✓ | **PENDING** |
| FAQ topics / CTA | ✓ | ✓ draft | ✓ draft | **PENDING** |
| Footer / info pages | ✓ | ✓ mixed draft | ✓ mixed draft | **PENDING** |
| Metadata / hreflang | ✓ | ✓ | ✓ | **PENDING** copy QA |

Key parity enforced by `messages.test.ts` (same keys all locales).

## Photography & licensing

Unchanged manifest: `docs/design/public-landing-photography-manifest.md` — Wikimedia CC BY-SA expressway/lifecycle photos; Part 2B GIS uses SVG only.

## Security & truthfulness

- No new APIs, auth, or `dangerouslySetInnerHTML` for copy  
- CTAs and footer: only existing routes + in-page anchors  
- Privacy/accessibility pages retain **NEEDS_OWNER_REVIEW** where documented  
- No government endorsement, certification, or live-data claims added  

## Open defects (register)

| ID | Sev | Item |
| --- | --- | --- |
| P1 | Native si/ta review not performed | Blocker for **public launch**, not for engineering PR |
| P2 | Manual keyboard/SR on FAQ `<details>` | |
| P2 | Residual English in si/ta FAQ/footer strings | |
| P3 | Full viewport screenshot matrix for all 24 routes | |
| P3 | Footer removed compact lifecycle stepper (intentional IA simplification) | |

## Suggested checkpoint commits (do not run automatically)

Already on branch:

1. `da4aea1` — Batch 2A hero and RoadSync  
2. `bad548e` — Batch 2B Part 1  
3. `db89d5e` — Batch 2B Part 2  

**Suggested next commit (Part 3 only):**

```text
style(landing): Batch 2B Part 3 FAQ, CTAs, footer, and info pages
```

**Optional squash / release commit after owner approval:**

```text
style(landing): complete trilingual Connected Future public-site redesign
```

## PR handoff (prepared, not created)

- **Target:** `development`  
- **Source:** `feature/infraos-connected-future-ui`  
- **Include:** Parts 1–3 code + `docs/reviews/connected-future/BATCH-2B-PART-*` + `PHASE-2-PUBLIC-SITE-FINAL-QA.md` + screenshot matrix  
- **Exclude:** `Prompts/` unless team wants them in repo  
- **`development` → `main`:** separate release approval only  

## Git state at review

- **Branch:** `feature/infraos-connected-future-ui` tracking `origin/feature/infraos-connected-future-ui`  
- **Uncommitted:** Part 3 files (~13 paths, +268/−139 lines)  
- **Untracked:** Prompts, glossary, capture scripts, Part 3 screenshots  

## HARD STOP

Phase 2 public-site Batch 2B is **complete pending your visual approval**. Phase 3 internal UI and Step 35 **not started**.
