# STEP 31 PRE/POST-REVIEW — Trust, FAQ, next steps

**Date:** 2026-10-20  
**Branch:** `feature/public-landing-enhancements`  
**Base:** Step 30 commit `fc98e14` on `development` @ `e425427`

## Pre-review

| Prerequisite | Evidence |
| --- | --- |
| Steps 25–29 on `development` | PR #31 @ `e425427` |
| Step 30 checkpoint | `fc98e14` on same branch; pushed `origin/feature/public-landing-enhancements` |
| Human Step 30 sign-off | **Partial** — automated review PARTIAL; user authorized Step 31 execution |
| Branch | Reused `feature/public-landing-enhancements`; no new step branch |

## Post-review

| Deliverable | Status |
| --- | --- |
| `#trust-information` — 4 honest points + demo notice | Done |
| `#faq` — 9 `<details>` items, stable IDs | Done |
| `#next-steps` — primary `#how-it-works`, secondary `#preview` | Done |
| Primary nav | Unchanged (7 links) |
| Staff login CTA | Omitted (no route) |
| en/si/ta keys | Parity via `messages.test.ts`; **native review pending** |
| New photos | None |
| Dashboard/backend | Untouched |

## Tests (2026-10-20)

| Command | Result |
| --- | --- |
| `npm run test:web` | **PASS** (84) |
| `npm run type-check:web` | **PASS** |
| `npm run lint:web` | **PASS** (0 errors; pre-existing data-table warning) |
| `npm run build:web` | **PASS** |
| Browser/axe/zoom | **NOT RUN** |

**Suggested commit (not executed):** `feat(landing): add public trust faq and next steps`

**Step 32:** NOT STARTED — awaits explicit authorization.
