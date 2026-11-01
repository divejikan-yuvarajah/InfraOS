# 05 — Phase 6: ProjectTrace `/dashboard` in Site Plan

## What changed
- **Order follows principle 1, "action before history":**
  1. Attention lane
  2. Progress and money
  3. Portfolio lifecycle
  4. Milestones
  5. Reviews (only when the API returns them)
  6. Recent projects
- **Replaced:** six equal KPI cards and the donut are gone. A **portfolio lifecycle line** (S1/S2) replaces them:
  - main path Draft → Completed, with counts and links to the filtered project list;
  - On hold, Delayed, Rejected and Cancelled shown as branch chips;
  - the "Projects by status" data table is kept as the text equivalent.
- **Progress and money (S3/S4):**
  - *Completed by status* has a solid green check card.
  - *Reported 100%, not completed* has a dashed card, a dashed ring mark and a `Reported` chip, so it can never read as completed.
  - Stored paid total carries a `Provisional` chip; when finance is withheld or unavailable, the matching honesty chip is shown instead.
- **Context bar (S5):** breadcrumb, scope pill and "As of" time.
- **Language:** the dashboard's own language row is removed; the shell switch now drives it.
- **Mobile demo marker:** a compact `Demo` chip in the top bar under 640 px, and the full `Demo data` badge in the drawer.
- **"Role dashboards":** there is a single `/dashboard` route. Role differences come from the API itself:
  - `scope` (platform / agency / assigned);
  - `reviews` (null → the panel is omitted);
  - `finance` (`withheld` / `unavailable` chips);
  - `assignedToYou`.
  
  No role-specific data was invented.

## Data honesty
- **Every figure is a real `DashboardPayload` field.** No trends, deltas or sparklines: the API has no history.
- **No dual progress bar on the dashboard.** The payload has no aggregate physical or financial percentage, so drawing one would be fabricated. The `DualProgress` component (Provisional on the financial side) goes on the project record page in the next phase.
- **Origin labels are claimed only where policy allows a single origin.** Checked against `lifecycle.policy.ts` and `review.policy.ts`:
  - "from Active" is shown only for On hold and Delayed;
  - Rejected (from Submitted or Under review) and Cancelled (from four states) show no origin.
  - The Phase 4 `lifecycleRail` was corrected to match: Rejected now claims only Draft and Submitted as passed. Tests were added.

### Synthetic demo data seen in the walkthrough
Demo DB, local only: 10 fictional projects, 2 milestones.

| Check | Result |
|---|---|
| Attention lane | Delayed 1, Planned end before today 1, Reported 100% and still open 1 |
| Completed vs reported 100% | 1 vs 1, shown in visually distinct cards |
| Lifecycle counts | Draft 1, Submitted 1, Under review 1, Approved 1, Active 2, Completed 1 |
| Branches | On hold 1 (from Active), Delayed 1 (from Active), Cancelled 1 |

## Uniqueness test (section 6.1)

| Test | Result | Evidence |
|---|---|---|
| **Logo removal** | **Pass.** With the brand hidden, the drafting-grid canvas, the route-line lifecycle with node shapes, dashed "Reported" vs solid "Completed" cards and the dotted honesty chips identify INFRAOS. None of these appear in stock templates. | `screens/phase-6/uniq-logo-removed-1280.png` |
| **Default shadcn comparison** (`dashboard-01`: inset sidebar → section cards → area chart → data table; per its text on ui.shadcn.com/blocks, visuals unverified) | **Different in all four dimensions.** *Hierarchy:* action lane first vs KPI cards first. *Composition:* asymmetric 7/5 + full-width lifecycle vs card row + chart. *Status language:* shape + tone + text nodes vs plain badges. *Detail:* honesty chips, dashed reported state, branch origins, no area chart (no time series exists). | code + screenshots |
| **Squint** (6 px blur) | **Pass.** The attention lane (tinted maroon and yellow rows, orange top rule) is the strongest mass. Lifecycle nodes are second. Recent projects recede. | `screens/phase-6/uniq-squint-1280.png` |
| **Density** (20 projects) | **Partial / deferred.** The dashboard shows only the API's recent projects (10 here); 10 rows plus links fit in about 470 px at 1280. The 20-row table density test belongs to `/projects` (next phase, compact mode). | `dashboard-en-1280.png` |

## Responsive and i18n
- Widths checked in English and Sinhala at **1280, 768 and 360 px**. Horizontal page overflow: **none in all 6 cases**.
- At 360 px the lifecycle wraps to a 3×2 grid. It no longer scrolls sideways, which the first pass did; that was fixed this phase.
- Top bar with the final language labels (EN / සිංහල / தமிழ்) retaken: `topbar-switcher-ta-1280.png`, `topbar-mobile-ta-360.png`, `drawer-ta-360.png`. These replace the Phase 5 shots, which showed the abbreviated labels.
- New or missing SI/TA strings are listed in `i18n-missing.md`.
- The Sinhala screenshots show no clipping. Long Sinhala labels wrap in the lane and the cards.

## Verification

| Command | Result |
|---|---|
| `npm run test -w @infraos/web -- src/lib/projects/dashboard-view.test.ts src/lib/design/site-plan.test.ts` | 25/25 passed |
| `npm run type-check:web` | exit 0 |
| `npx eslint` (dashboard, shell, home, dashboard-view + test) | exit 0 |
| Browser (Chrome headless, demo API + Next dev, synthetic data) | as above; only console error is the pre-login refresh 401 |

**Deferred:** full suites, build and lint (end of the redesign). The keyboard-only walkthrough will be done in the cross-app pass.
