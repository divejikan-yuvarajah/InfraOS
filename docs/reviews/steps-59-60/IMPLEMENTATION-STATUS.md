# Steps 59–60 implementation status

Date: 2026-10-29. Step 59 only. Step 60 was not started. Same-agent record, not owner signoff.

## Preflight

| Item | Result |
|---|---|
| Worktree | `C:\Users\ASUS\Desktop\InfraOS\InfraOS` |
| Branch at start | `feature/projecttrace-milestones` at `004d60d` |
| `origin/development` | `576b1ede3b2a1ac9d0d88ad41ec16140768c9ff5` (merge of PR #104) |
| G1 | Not run. Dirty unrelated docs and `Prompts/` were left in place. No branch switch, stash, commit, or push. |

## Contractor mapping

**BLOCKED.** `Contractor` has contact email and no `userId`. `User` has no contractor link. `projectWriteFilter` and `projectReadFilter` already deny contractor ownership. Step 59 does not match email, does not widen the project filter, and does not change the permission catalog. A contractor with `progress.submit` receives **403** on read and write.

## Reporting rule

Only `PROJECT_MANAGER` assigned as `managerId` may submit, and only while the parent status is `ACTIVE`. `APPROVED` and every other status return **409**. Project `START` and `COMPLETE` stay locked. `100%` updates `physicalProgress` only. `financialProgress`, milestone status, and project status stay unchanged. A lower percentage requires a note of at least 12 characters and is stored as a new history row.

## Routes

| Method | Path | Permission |
|---|---|---|
| GET | `/api/v1/projects/:id/progress` | `progress.read` |
| GET | `/api/v1/projects/:id/progress/history` | `progress.read` |
| POST | `/api/v1/projects/:id/progress` | `progress.submit` |

`Cache-Control: no-store`. POST body is `{ percentage, note, revision }` only.

## Checks

| Command | Result |
|---|---|
| `npm run test -w @infraos/api -- tests/projects-progress.test.ts` | First run failed: project code `INF-PROG-APP` rejected by `INF-[A-Z_]+-[0-9]+`. Rerun after `INF-PROG-5902`: **3 passed**. |
| `npm run test -w @infraos/web -- src/lib/projects/progress-form.test.ts` | **1 passed**. |
| `npm run type-check` | PASS. |
| `npm run lint` | PASS. 0 errors, 2 existing warnings (`data-table.tsx` `useReactTable`, `project-create-form.tsx` `form.watch`). |
| `git diff --check` | Recorded after restoring the Next rewrite of `apps/web/tsconfig.json`. |

Full `test:api` / `test:web` / `build` were not run. They remain for the combined review.

## Browser

Disposable API `http://localhost:4011`. Web `http://localhost:3001` with `NEXT_PUBLIC_API_BASE_URL=http://localhost:4011`. Fixture `synthetic-active-not-started`. Project `INF-ROAD-5901` (`6ae30ca2467b46d8ebc1d9cd`), status `ACTIVE`. Listeners on 3001 and 4011 were stopped. Ports 3000 and 4010 were left running. `.env.local` was not edited.

| Step | Outcome |
|---|---|
| Assigned PM login, open progress | PASS. Official status `ACTIVE`, recorded `0%`. |
| POST 20% “Deck steel placed” | PASS. 201. |
| POST 65% “Abutment complete” | PASS. 201. Status stayed `ACTIVE`. |
| Reload | PASS. `65%` and the note remained. |
| Second tab then stale POST | PASS. Second POST 201, first-tab POST **409**. UI: “This project changed. Reload it before reporting again.” |
| Foreign Gov Admin | PASS. Alert: “This project is outside your scope, or it does not exist.” Page text did not include the notes or `65%`. |
| Contractor in the browser | NOT RUN. API test returns 403. The page states that contractor reporting is unavailable until a user link exists. |
| Widths 320, 375, 390, 768, 1024, 1440, 1920 | No horizontal overflow (`scrollWidth` did not exceed `innerWidth`). Screenshots: 390 and the stale-report form. |
| Native SI/TA review | NOT RUN. |

Screenshots:

- `docs/reviews/steps-59-60/evidence/step59-review-conflict.png`
- `docs/reviews/steps-59-60/evidence/step59-review-stale.png`
- `docs/reviews/steps-59-60/evidence/step59-review-390.png`

## Acceptance

| Item | Outcome |
|---|---|
| FR-PROG-001 assigned PM report and history | PASS |
| FR-PROG-001 contractor report | BLOCKED |
| FR-PROG-002 physical vs financial | Not in Step 59 |
| FR-PROG-003 100% does not complete the project | PASS |
| Step 58 milestone progress not copied onto the project | PASS |
| Production readiness | BLOCKED |

**Step 59 recommendation: REVISE.** Assigned-PM reporting is ready for review. Full P0 acceptance is not claimed while contractor reporting has no identity mapping.

## Step 60 — recorded PAID financial summary

Read-only. `Project.financialProgress` is not read or written. A stored `PAID` row is a recorded status, not a bank confirmation. There is no payment-approval or disbursement API in this step.

### Formula

`budgetMinor` is `Project.budget.amountMinor`. `paidMinor` is the sum of `ProjectPayment.amount.amountMinor` for the same `projectId`, status exactly `PAID`, currency `LKR`. `ratioPercent = (paidMinor / budgetMinor) * 100` using integer hundredths (`paid * 10000n / budget`) when the budget is a positive safe integer. `PENDING`, `APPROVED`, `REJECTED`, and `CANCELLED` are excluded, as are other projects.

| Condition | Result |
|---|---|
| Budget missing, not a safe integer, or 0 | `unavailable`, reason `missing_budget`. No ratio. |
| Any included row is not LKR | `unavailable`, reason `mixed_currency`. No totals. |
| Amount or sum is not a safe integer | `unavailable`, reason `unsafe_amount`. |
| Paid exceeds budget | `provisional`. Ratio stays above 100. Remaining is 0. Overrun is the excess. The bar fill caps at 100. |
| Otherwise | `provisional`, with budget, paid, remaining, overrun, ratio, and provenance. |

Provenance: “Sum of stored payment rows marked PAID, in LKR cents. This is not a bank confirmation or a disbursement approval.”

### Route and permissions

`GET /api/v1/projects/:id/financial-progress`. Middleware: authenticated session, `project.read`, `finance.budget.read`, and `finance.payment.read`. The project is loaded with the existing project read scope. Foreign agency is 404. Missing either finance permission is 403 and the body has no money fields. Inspector, contractor, and citizen do not receive finance access from `progress.read`. Super Admin is allowed only when the existing actor scope already permits the project. `Cache-Control: no-store`. A dependency hook failure is 503 and does not return 0. `POST` on this path is not implemented.

### UI

The authenticated progress page compares Step 59 reported physical progress with this recorded financial ratio. The two bars are separate. Copy states that the measures need not match and do not verify an inspection, a payment, or completion. A 403 shows “Budget and payment figures are not available for this sign-in.” An unavailable source shows that no percentage is displayed. Sinhala and Tamil strings for the new labels inherit the English draft.

### Checks

| Command | Result |
|---|---|
| `npm run test -w @infraos/api -- tests/projects-financial-progress.test.ts` | First run failed: duplicate contractor `REG-60` because core cleanup does not delete contractors. After `Contractor.deleteMany` in `afterEach`: **4 passed**. |
| `npx tsc -p tsconfig.json --noEmit` in `apps/api` | PASS after replacing a Mongoose currency predicate (`TS2677`) with an explicit row loop. |
| `npm run test -w @infraos/web -- src/lib/projects/finance-summary.test.ts` | **1 passed**. |
| `git diff --check` | Clean after restoring Next's rewrite of `apps/web/tsconfig.json`. |
| Full phase suite, lint, and production build | Recorded in `END-OF-PHASE-VERIFICATION.md`. |

### Browser evidence

Owned disposable API `http://localhost:4011` and web `http://localhost:3001` (`INFRAOS_NEXT_DIST_DIR=.next-step60`). Memory Mongo only. Fixture label `synthetic-paid-rows-not-bank`. Ports 3000 and 4010 were left running. Both disposable processes were stopped after the walkthrough.

| Case | URL | Observed |
|---|---|---|
| PM, budget LKR 10,000.00, recorded PAID LKR 4,000.00 | `/projects/6ae31f9ba0499a6c45343e28/progress` | Physical report submitted as 65% (“Abutment complete”). Financial ratio stayed 40%. Remaining LKR 6,000.00. Overrun LKR 0.00. Provisional provenance shown. `calculatedAt` 2026-10-29T11:22:03.510Z. |
| Missing budget | `/projects/6ae31f9ba0499a6c45343e2a/progress` | “A financial ratio is unavailable. No percentage is shown.” No budget or ratio. |
| Overrun, budget 10000 cents, PAID 15000 cents | `/projects/6ae31f9ba0499a6c45343e2c/progress` | Physical 0%. Financial 150%. Bar note “The bar stops at 100%.” Overrun LKR 50.00. Screenshot `evidence/step60-review-overrun-ratio.png`. |
| Inspector on the 65% project | same main URL, `step60-inspector@example.com` | Physical 65% remains. Status: “Budget and payment figures are not available for this sign-in.” No LKR amounts and no financial percentage. Screenshot `evidence/step60-review-denied.png`. |

Desktop screenshots are in `docs/reviews/steps-59-60/evidence/`. A separate mobile-width capture for Step 60 was not taken.

### Step 60 acceptance

| Check | Result |
|---|---|
| Read-only PAID-only LKR ratio | PASS |
| Zero or missing budget is unavailable, not 0% | PASS |
| Overrun ratio above 100, bar fill capped | PASS |
| Other statuses and other projects excluded | PASS |
| Finance permission required for money and ratio | PASS |
| Inspector browser shows no money leak | PASS |
| `Project.financialProgress` cache unchanged | PASS |
| Bank or disbursement confirmation | Not claimed |
| Production readiness | BLOCKED |

**Step 60 recommendation: APPROVE** for the provisional, permission-scoped summary. This is separate from Step 59, which stays **REVISE** because contractor reporting is still blocked. Production readiness stays **BLOCKED**. Unresolved: no operational payment ingestion, no bank proof, contractor identity mapping, and native review of Sinhala and Tamil draft copy.

Phase review added an accessible meter value (`aria-valuetext`) and a status line when the financial read fails without a summary, so a 503 does not look like a missing zero. Combined results, the joined browser walkthrough, and the Git plan are in `END-OF-PHASE-VERIFICATION.md`.

G1 is still required before `feature/projecttrace-progress-finance-summary`. Do not use a plain `git push` from `feature/projecttrace-milestones`. No commit, push, PR, or merge was made for Steps 59–60.
