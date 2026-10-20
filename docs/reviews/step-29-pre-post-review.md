# STEP 29 PRE/POST-REVIEW — Stakeholder roles, public audiences & benefits

**Date:** 2026-10-20  
**Branch:** `feature/public-landing-core`  
**Anchor:** `#audiences` (`AUDIENCES_SECTION_ANCHOR`)

## Prerequisites (Steps 27–28)

| Gate | Evidence |
| --- | --- |
| Step 27 reviewed | `docs/reviews/step-27-pre-post-review.md`; merged via PR #28 lineage |
| Step 28 reviewed | `docs/reviews/step-28-pre-post-review.md` |
| Steps 27–28 on `main` / `development` | Merge commit **`ac9e31f`** (PR #30) — lifecycle `#how-it-works`, licensed photography, `#features` |
| Step 29 authorized | User directive 2026-10-20 (execute Step 29 only; stop before Step 30) |

**Native Sinhala/Tamil:** **unverified draft** only (`translationDraftNote` on all locales). **No native-speaker approval claimed.**

## Pre-review scope

**Public routes:** `/`, `/si`, `/ta` only. No public `/login`; staff access described in prose only.

**Existing anchors (Steps 25–28):** `#hero-overview`, `#problem`, `#solution`, `#features`, `#how-it-works`.

**Step 29 deliverables:**

- Four merged audience cards: citizens/communities; government/utility officers & administrators; inspectors/contractors/technical staff; students/researchers/visitors.
- Shared “intended benefits” list with explicit non-claims disclaimer.
- Honest staff-access note (no fake sign-in link).
- Nav label “Who it helps” → `#audiences`.
- en/si/ta copy under `messages.audiences` + `nav.audiences`.

**Out of scope:** Dashboard/admin routes, live data, complaint channels, ministry endorsement, savings metrics, new photography.

## Implementation summary

| Item | Location |
| --- | --- |
| Section UI | `apps/web/src/components/landing/public-audiences-section.tsx` |
| Group IDs | `apps/web/src/lib/landing/audience-groups.ts` |
| Copy | `apps/web/src/lib/landing/messages.ts` (`audiences`, `nav.audiences`) |
| Nav | `apps/web/src/lib/landing/navigation.ts` |
| Page order | After lifecycle in `public-home.tsx` |
| Tests | `landing-audiences.test.ts`, `navigation.test.ts` |

**Audience card links (verified in-page only):**

| Group | Anchor key | Resolves to |
| --- | --- | --- |
| citizens | `lifecycle` | `#how-it-works` |
| agency-teams | `solution` | `#solution` |
| field-teams | `lifecycle` | `#how-it-works` |
| visitors | `features` | `#features` |

**Benefit claims:** Coordination, accountability/milestones, reduced *avoidable* disruption (no zero-disruption guarantee), future public information *aim*, maintenance planning — all framed as **design goals** on a **university prototype**, not measured national savings.

## Trust & access checks

- No `/login` or private dashboard hrefs in landing components.
- Footer/demo banner and `footerDisclosure` unchanged (synthetic data, not official records).
- No fake metrics, ministry phone numbers, public notices, or endorsement language in audience block (covered by tests).

## Locale matrix (Step 29 keys)

| Locale | `audiences.*` + `nav.audiences` | Review status |
| --- | --- | --- |
| en | Complete | English source |
| si | Present | **Draft** — some technical loanwords (`backend permissions`); native review pending |
| ta | Present | **Draft** — residual English in disruption benefit (`inconveniences`); native review pending |

## Photography

No new assets. Step 27 manifest and credits unchanged.

## Tests / build (post-implementation)

| Check | Result (2026-10-20) |
| --- | --- |
| `npm run test:web` | **PASS** (76 tests, incl. 5 audience tests) |
| `npm run type-check:web` | **PASS** |
| `npm run lint:web` | **PASS** (0 errors; pre-existing data-table warning) |
| `npm run build:web` | **PASS** (`/`, `/si`, `/ta`) |

## Manual / a11y QA

| Item | Status |
| --- | --- |
| Browser smoke `#audiences` + locale switch | **NOT RUN** (no automated pass this session) |
| Viewports 320/375/768/1024/1280 | **NOT RUN** |
| 200%/400% zoom, reduced motion | **NOT RUN** |
| axe / Playwright | **NOT RUN** (unchanged from Steps 27–28 notes) |
| Keyboard tab through audience links | **NOT RUN** |

## Regressions (Steps 25–28)

Automated: section anchor tests, navigation hrefs, messages key parity, lifecycle/features tests — **PASS**. No dashboard code touched.

## Git handoff (not executed)

**Suggested commit message:**

```
feat(landing): add public audience and benefits guidance
```

**Status:** Uncommitted changes on `feature/public-landing-core` (based on `ac9e31f`). **No commit/push/merge** without team approval.

## Blockers before production copy sign-off

1. Native-speaker review for si/ta audience strings (especially mixed-language fragments).
2. Optional manual responsive/a11y matrix on `#audiences`.

**STOP:** Step 30 not started.
