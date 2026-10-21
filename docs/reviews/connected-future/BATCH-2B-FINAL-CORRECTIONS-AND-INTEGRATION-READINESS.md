# Batch 2B — Final corrections & integration readiness

**Branch:** `feature/infraos-connected-future-ui`  
**Review date:** 2026-10-22  
**Owner:** Approved Connected Future direction + Batch 2B Parts 1–3; **final integration approval pending**

## Git reconciliation (after `git fetch origin`)

| Ref | Commit | Notes |
| --- | --- | --- |
| **Feature HEAD** | `caf9ea1` | Part 3 |
| | `db89d5e` | Part 2 |
| | `bad548e` | Part 1 |
| | `da4aea1` | Batch 2A (merge-base with `development`) |
| **`origin/development`** | `41fd47a` + merge history | Includes **PR #45** (`f93abda`) which merged **2A only** (`da4aea1`) |
| **Feature-only delta** | 3 commits | `bad548e`, `db89d5e`, `caf9ea1` — **81 files**, +2967 / −444 vs `origin/development...HEAD` |

**Safest integration path (recommended):**

1. Open **one PR**: `feature/infraos-connected-future-ui` → `development` (brings 2B Parts 1–3 only; 2A already on development via #45).
2. **Do not** force-push, reset, or rebase onto development unless you explicitly want to rewrite the three Part commits.
3. Resolve merge conflicts if any (expect low risk: development moved via main merges; feature branched from post-2A line).
4. **`development` → `main`:** separate release PR after integration QA — not part of this handoff.

**Not performed (per instruction):** commit, push, PR create, merge.

## Corrections in this pass (uncommitted until you approve)

| Issue | Fix |
| --- | --- |
| Mobile GIS label overlap | Replaced absolute chips with responsive `cf-gis-callouts` list — **stacked under map ≤639px**, absolute on ≥640px with adjusted positions |
| Sticky header vs `#anchors` | `--cf-anchor-scroll-margin` + `scroll-padding-top` on `.public-connected-future`; overrides `scroll-mt-28` on sections |

**Files touched:** `coordination-preview-figure.tsx`, `public-batch-2b-part2.css`, `public-connected-future.css`

## Verification

| Command | Result |
| --- | --- |
| `npm run test:web` | **96/96 PASS** |
| `npm run type-check:web` | **PASS** |
| `npm run lint:web` | **PASS** (pre-existing data-table warning) |
| `npm run build:web` | **PASS** |
| `git diff --check` | **PASS** |

### Viewports / visuals

| Width | GIS `#preview` | Lifecycle `#how-it-works` | FAQ `#faq` | Footer |
| --- | --- | --- | --- | --- |
| 320 | `batch-2b-corrected-en-preview-320.png` | — | — | — |
| 375 | en + `si-preview` | `en-lifecycle-375` | en + `ta-faq` | `en-footer-375` |
| 768 | `en-preview-768` | `en-lifecycle-768` | `en-faq-768` | — |
| 1024 | `en-preview-1024` | `en-lifecycle-1024` | — | `en-footer-1024` |
| 1440 | `en-preview-1440` | — | — | — |
| 1920 | `en-preview-1920` | — | — | — |

All under `docs/reviews/connected-future/screenshots/batch-2b-corrected-*.png`. Re-capture:

```bash
cd docs/reviews/connected-future
node capture-batch-2b-corrections.mjs --base=http://localhost:3005
```

### Accessibility & language

| Check | Result |
| --- | --- |
| FAQ `<details>` keyboard / focus-visible | **PASS** (code review) |
| Reduced motion (FAQ chevron) | **PASS** (Part 3 CSS) |
| axe / Lighthouse / SR walkthrough | **NOT RUN** |
| en/si/ta key parity (`messages.test.ts`) | **PASS** |
| Native Sinhala/Tamil review | **PENDING** (unchanged) |
| Mixed English in si/ta FAQ bodies | **Known P2** — not auto-fixed |

## Readiness (three-way)

| | Status |
| --- | --- |
| **Implementation (2B + corrections)** | **COMPLETE** pending your commit of correction diff |
| **Engineering PR readiness** | **READY** — open PR to `development` with 3 commits + optional correction commit |
| **Public launch readiness** | **BLOCKED** — native translation, manual a11y/perf, legal/privacy owner review |

## Suggested commits (you approve before running)

```text
fix(landing): GIS mobile callouts and anchor scroll offset for sticky header
```

Optional squash message after merge review:

```text
style(landing): complete trilingual Connected Future public-site redesign (2A–2B)
```

## PR handoff draft (not created — awaiting your explicit approval to push/open)

**Title:** `style(landing): Batch 2B Parts 1–3 — Connected Future public sections`

**Base:** `development`  
**Head:** `feature/infraos-connected-future-ui`

**Body (copy for `gh pr create`):**

```markdown
## Summary
- Batch 2B Part 1 (`bad548e`): infrastructure problem, platform features, lifecycle path
- Batch 2B Part 2 (`db89d5e`): GIS preview, audiences, trust, transparency
- Batch 2B Part 3 (`caf9ea1`): FAQ, next steps CTA, footer, public info page shell
- Review docs + screenshots under `docs/reviews/connected-future/`
- **Optional follow-up commit:** GIS mobile callouts + sticky-header anchor scroll (currently local)

Batch 2A is already on `development` via PR #45 (`da4aea1`). This PR adds the three 2B commits only.

## Engineering vs launch
- **Engineering merge:** automated tests/build green; trilingual key parity
- **Public launch:** still blocked on native si/ta review, manual a11y/perf, legal/privacy owner sign-off

## Test plan
- [ ] CI: `npm run test:web`, `type-check:web`, `lint:web`, `build:web`
- [ ] `/`, `/si`, `/ta` — anchors `#preview`, `#how-it-works`, `#faq`, `#next-steps`
- [ ] Compare diff to `development` — expect 2B Parts 1–3, not a second copy of 2A
- [ ] Visual: `batch-2b-corrected-*` screenshots (320–1920 GIS matrix)
```

**Suggested commands (you run when ready):**

```bash
git checkout feature/infraos-connected-future-ui
# optional: commit corrections + docs, then push
git push origin feature/infraos-connected-future-ui
gh pr create --base development --head feature/infraos-connected-future-ui --title "..." --body-file ...
```

## Updated related reports

- Part 1–3 reviews and `PHASE-2-PUBLIC-SITE-FINAL-QA.md` — commit SHAs and PR #45 scope corrected in this pass.

## STOP

Phase 3 internal UI and Step 35 **not started**.
