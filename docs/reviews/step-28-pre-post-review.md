# STEP 28 POST-REVIEW — Infrastructure lifecycle / how coordination works

**Date:** 2026-10-20  
**Branch:** `feature/public-landing-core`  
**Anchor:** `#how-it-works` (`HOW_IT_WORKS_SECTION_ANCHOR`)

## Step 27 approval evidence

- Step 27 merged via PR #28 (`3567322` — multilingual `#features` overview).
- `docs/reviews/step-27-pre-post-review.md` on branch (feature inventory + disclosure).
- User directive (conversation): approved continuing on `feature/public-landing-core` before Step 28.
- **Native Sinhala/Tamil:** still **unverified draft** (`translationDraftNote` on all locales).

## Lifecycle order and source-of-truth

Canonical order (product scope + Step 28 spec):

`Plan → Coordinate → Approve → Build → Verify → Monitor → Complete → Maintain`

Code source: `apps/web/src/lib/landing/lifecycle-stages.ts` (`LIFECYCLE_STAGE_IDS`).

## How eight stages are represented (DOM semantics)

- `InfrastructureLifecycleSection`: one `<section id="how-it-works">`, `<h2>`, semantic `<ol>` with **eight** `<li>` items in canonical order (two-column grid at `md+`, single column on narrow viewports).
- Each item: visible “Stage N” label, `<h3>` stage title, body copy.
- Non-interactive stages (no spurious `tabIndex`).
- Synthetic scenario + human-approval note in a bordered aside below the list.
- Optional licensed photo (lifecycle expressway) — rights in `docs/design/public-landing-photography-manifest.md`.

Distinct from Step 26 `#solution` three-step illustrative flow (coordination intro only).

## Sample scenario label correctness

- `scenarioTitle` includes illustrative/synthetic labeling in en/si/ta.
- `scenarioBody` describes road resurfacing + water-main overlap as **fictional**; not government records or live INFRAOS detections.
- `approvalsNote` states authorized human officials; overlap signals ≠ automatic cancellation/emergency.
- **Coordinate** stage mentions RoadSync as candidate overlap surfacing for **human review** (not automatic resolution).

## Three-locale translation status

- Full `lifecycle.*` keys in `messages.ts` for `en`, `si`, `ta`; `messages.test.ts` key parity.
- **Review status:** machine/draft — **pending native-speaker validation** (do not treat as official translation).

## Keyboard / reflow / reduced-motion findings

- Nav link “Project lifecycle” → `#how-it-works` with `scroll-mt-28` on section.
- Stages are not focus targets; links retain focus rings.
- `motion-reduce:transition-none` on stage cards.
- **Manual QA:** spot-check `/` and `/si` in browser — **PARTIAL** (375px emulation + anchor); full 320–1280 matrix and keyboard tab audit **NOT RUN** in this pass.
- **axe / Playwright:** **NOT RUN** (no Playwright; axe CLI ChromeDriver mismatch in prior pass).

## Tests / build and regressions

| Check | Result |
| --- | --- |
| `landing-lifecycle.test.ts` | PASS |
| `navigation.test.ts` (incl. `#how-it-works`) | PASS |
| `messages.test.ts` | PASS |
| Full `npm run test:web` | PASS (see CI log at review time) |
| `type-check:web` | PASS |
| `lint:web` | PASS (pre-existing data-table warning) |
| `build:web` | PASS |
| Step 25–27 anchors (`#hero-overview`, `#problem`, `#solution`, `#features`) | PASS (unchanged) |

## Actual files changed, docs and git status

**Step 28 core:**

- `apps/web/src/components/landing/infrastructure-lifecycle-section.tsx`
- `apps/web/src/lib/landing/lifecycle-stages.ts`
- `apps/web/src/lib/landing/landing-lifecycle.test.ts`
- `apps/web/src/lib/landing/messages.ts` (`lifecycle`, `nav.lifecycle`)
- `apps/web/src/lib/landing/navigation.ts`
- `apps/web/src/components/landing/public-home.tsx`

**Also on branch (Step 27 polish, same commit family):** photography components/assets — out of Step 28 scope but present on `feature/public-landing-core`.

**Docs:** this file; `docs/reviews/public-landing-core-progress.md`.

**Git:** `feature/public-landing-core` @ `ed90975` + small uncommitted copy/test tweak (RoadSync coordinate wording). **Not committed/pushed** per gate rules.

**Note:** `main` @ `a0ce99c` does **not** include Step 28 until feature branch merges to `development` → `main`.

## Defects fixed and retests

- Reinforced **Coordinate** stage copy (en/si/ta) to state RoadSync surfaces overlaps for human review only; extended lifecycle unit test to assert RoadSync mention.

## Step 28 result

**COMPLETE** (implementation + automated checks). **PARTIAL** on full manual/a11y matrix and native translation sign-off.

## Permission to proceed to Step 29

**Waiting** — explicit user approval required. Step 29 not implemented.

## Suggested checkpoint commit (after approval only)

```text
feat(landing): explain infrastructure coordination lifecycle
```
