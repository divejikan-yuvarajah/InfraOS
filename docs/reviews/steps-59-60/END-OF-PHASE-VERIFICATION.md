# Steps 59–60 end-of-phase verification

Date: 2026-10-29. Same-agent review of the working tree. This is not owner acceptance, independent human signoff, or production release clearance.

## Executive summary

Roadmap titles match `Prompts/Steps.docx`: Step 59 is Physical Progress Tracking and Step 60 is Financial Progress Summary. Assigned project managers can append a reported physical percentage. The financial ratio is a provisional sum of stored `PAID` LKR rows over the project budget. Contractor reporting and bank settlement stay blocked. The phase recommendation is **REVISE**. Production readiness stays **BLOCKED**. G1 has not been run.

## Git

| Item | Value |
|---|---|
| Worktree | `C:\Users\ASUS\Desktop\InfraOS\InfraOS` |
| Branch | `feature/projecttrace-milestones` |
| HEAD | `004d60d78a0e5e660a401689b3978cfd8b7cc43f` |
| Upstream | `origin/feature/projecttrace-milestones` at the same commit |
| `origin/development` | `576b1ede3b2a1ac9d0d88ad41ec16140768c9ff5` |
| Index | Clean. Nothing staged. |

Steps 59–60 are uncommitted. Unrelated dirty files were left in place: `docs/operations/production-readiness-gates.md`, Step 53/54/58 review notes, `docs/reviews/steps-53-54/END-OF-PHASE-VERIFICATION.md`, and everything under `Prompts/`. No landing-page files, Step 61 timeline, payment write API, `.env` change, or Atlas change is in this diff. Isolated scripts are excluded by `apps/api/tsconfig.build.json` (`src/scripts/**`) and are not in `apps/api/dist`.

## What was verified

Step 59 stores an append-only physical report and updates `Project.physicalProgress` only while the project is `ACTIVE`, only for the assigned project manager. `100%` does not change project status, milestone status, or `financialProgress`. A lower percentage needs a note of at least 12 characters. Concurrent posts on one revision yield one 201 and one 409. An audit failure rolls the transaction back and leaves no report with that note.

Step 60 reads `Project.budget.amountMinor` and sums `ProjectPayment` rows for that project with status exactly `PAID` and currency `LKR`. The ratio is provisional. A stored `PAID` row is not a bank settlement. Zero or missing budget, mixed currency, and an unsafe sum are `unavailable` with no ratio. Overrun keeps a ratio above 100 and caps only the bar. The route does not write `Project.financialProgress`.

Contractor identity mapping remains unproven. `Contractor` has no `userId`. The implementation does not match email and does not widen project scope. That item stays **BLOCKED**.

## Automated checks

Process environment for these commands: `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=0`, `NEXT_PUBLIC_AUTH_FIXTURE=0`, `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000`. The shell restored the previous process values afterward. `.env.local` was not edited. API tests use `mongodb-memory-server`. The build used `INFRAOS_NEXT_DIST_DIR=.next-step60` so it did not write the live `.next` directory.

These commands were executed again for this acceptance pass. Atlas variables were not set in the test process. `.env.local` was not edited.

| Command | Result |
|---|---|
| `npm run test:web` | Exit 0. **41 files, 176 tests passed.** |
| `npm run type-check` | Exit 0. Next's `.next-step60` include rewrite of `apps/web/tsconfig.json` was inspected and restored. |
| `npm run lint` | Exit 0. **0 errors, 2 existing warnings** (`data-table.tsx` `useReactTable`, `project-create-form.tsx` `form.watch`). |
| `npm run build` | Exit 0. Web compiled successfully. API `tsc -p tsconfig.build.json` succeeded. |
| `npm run test:api` | First pass: exit 1. **317 passed, 1 failed** in `admin-users.test.ts` step 48 (expected 503, received 401). That test is outside Steps 59–60. Isolated rerun of the file: exit 0, **4 passed**. Full rerun: exit 0, **34 files, 318 tests passed**, including progress (3), financial progress (4), review (6), and milestones (5). |
| `git diff --check` | Recorded after restoring `apps/web/tsconfig.json` and after this document update. |

After the review, the progress meter gained `aria-valuetext`, and a financial read that fails without a summary shows the existing unavailable copy. The second `npm run type-check`, `npm run lint`, and `npm run build` all exited 0. Lint again reported 0 errors and the same 2 warnings.

## Security and concurrency

| Check | Result | Evidence |
|---|---|---|
| Progress read/submit live grant and epoch | PASS | `assertLive` in `progress.service.ts`; progress test epoch 401 and revoked `progress.submit` 403 |
| Finance requires `project.read`, `finance.budget.read`, and `finance.payment.read` | PASS | Route middleware and service permission list; financial test 403 without both finance reads |
| Foreign agency | PASS | `projectReadFilter`; browser `GET` project **404** |
| Inspector / contractor / citizen do not gain finance from `progress.read` | PASS | Financial API test; earlier inspector browser showed the restricted status and no amounts |
| Contractor report | BLOCKED | No user-to-contractor link. API returns 403. Not patched by email match |
| Super Admin null-agency policy | Unchanged | `resolveResourceScope` still returns `none` without an agency id |
| No client `financialProgress` | PASS | Submit schema is `percentage`, `note`, `revision` only |
| `Project.financialProgress` not written | PASS | Update sets `physicalProgress` only; financial test asserts the cache |
| Concurrent progress writes | PASS | API test: statuses sort to 201 and 409; two reports remain |
| Audit-failure rollback | PASS | API test: 503, physical percent unchanged, note count 0 |
| Browser second-tab 409 | NOT RUN | A second tab loaded the new revision. Page-script injection did not attach. API coverage stands |
| Lower-percent validation in the browser | PASS | Short note showed “Check the percentage and note…” and 65% stayed |
| 100% or milestone completion does not complete the project | PASS | Progress test keeps `ACTIVE` at 100. Milestone test completes a milestone without completing the project. `actionBlock("START")` and `actionBlock("COMPLETE")` still block those project actions |
| Step 51 grant races | Still a production blocker | Not re-solved here |
| XSS / operator injection | PASS | Note rejects `$` and control characters; React renders notes as text |
| Pagination | PASS | History `page` min 1, `limit` max 50; unknown query keys 400 |
| Indexes | Code only | `progressReports` unique `{projectId, sequence}`; payments `{projectId, date}`. No Atlas change |
| Query cache | PASS | Progress and finance keys include auth epoch, user id, and role |
| Sensitive logging | PASS | Demo and API logs record ids and status codes, not payment account data or the fixture password |

## Browser demonstration

Disposable memory Mongo. Fixture label `synthetic-paid-rows-not-bank`. Web `http://localhost:3002`. API `http://localhost:4012`. Next dist `.next-step60`. Listeners on 3000 and 4010 were not stopped. Both demo processes were stopped afterward. Network evidence is the API log on port 4012: manager financial read **200**, progress posts **201**, foreign project read **404**.

Actors, no passwords: `step60-manager@example.com` (project manager), `step60-foreign@example.com` (other ministry officer). Inspector denial was already captured in `evidence/step60-review-denied.png` and was not repeated in this pass.

| Step | Result |
|---|---|
| Submit 20% “Earthworks started”, then 65% “Abutment complete” | History shows 65 (previous 20) and 20 (previous 0). Status stayed ACTIVE |
| Reload | 65% and both notes remained |
| Milestone “Abutment works” | Still Planned, milestone progress 0, project ACTIVE |
| Financial summary | Recorded PAID 40% against budget LKR 10,000.00 / paid LKR 4,000.00. Copy says it is not a bank payment |
| Missing budget `…0b/progress` | “A financial ratio is unavailable. No percentage is shown.” |
| Overrun `…0d/progress` | 150%, overrun LKR 50.00, bar note that the bar stops at 100% |
| Sinhala toggle | Headings switch. New finance sentences stay English draft |
| Foreign officer | “This project is outside your scope, or it does not exist.” No note and no money. API 404 |
| 100% report on a fresh disposable project | `http://localhost:3003/projects/6ae342566018a85c42063f04/progress`. POST **201**. Status stayed ACTIVE. Finance stayed 40%. Reload kept 100% and the history row. Screenshot `evidence/phase-100-still-active.png` |
| Stale revision in the browser | Inspected existing `evidence/step59-review-stale.png`: “This project changed. Reload it before reporting again.” Not re-executed in the 3003 session |
| Tamil toggle | Headings switch to Tamil. Finance sentences stay the English draft. Native semantic approval remains NOT RUN |
| Widths 320, 375, 390, 768, 1024, 1440, 1920 | No horizontal overflow. 768, 1024, and 1920 were remeasured on the 100% page |
| Keyboard focus | Staff CSS defines a 2px focus-visible outline. A synthetic Tab event in this session did not move focus, so a painted ring was not measured |
| Native-language semantic approval | NOT RUN |

Screenshots: `evidence/phase-compare-65-40.png`, `evidence/phase-missing-budget.png`, `evidence/phase-overrun-320.png`, `evidence/phase-overrun-390.png`, `evidence/phase-overrun-1440.png`, `evidence/phase-foreign-404.png`, `evidence/phase-100-still-active.png`, `evidence/step59-review-stale.png`, `evidence/step60-review-denied.png`. The 3003/4013 processes were stopped. Ports 3000 and 4010 were left running.

## Acceptance

| Item | Result |
|---|---|
| FR-PROG-001 assigned project manager | PASS |
| FR-PROG-001 contractor | BLOCKED |
| FR-PROG-002 physical vs financial, not assumed equal | PASS |
| FR-PROG-003 100% does not complete the project | PASS |
| BR-FIN-003 ratio from budget and recorded payments, not a client field | PASS |
| Step 59 contractor mapping | BLOCKED |
| Step 60 bank or disbursement provenance | BLOCKED |
| Step 60 recorded-PAID provisional summary | PASS |
| Production readiness | BLOCKED |

**Step 59 recommendation: REVISE.** **Step 60 recommendation: APPROVE** for the provisional read-only summary. **Overall phase recommendation: REVISE.** A green suite is not owner acceptance.

Production stays blocked for Atlas, Step 51 grant races, mail, null-agency Super Admin, native Sinhala/Tamil copy, staging cookies, payment ingestion, and release controls.

## Owner handoff

Start the disposable API from `apps/api` with `PORT` and `FRONTEND_ORIGIN` set, running `npx tsx src/scripts/step60-isolated-dev.ts`. Start Next from `apps/web` with `NEXT_PUBLIC_API_BASE_URL` pointed at that API, `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=1`, and `INFRAOS_NEXT_DIST_DIR=.next-step60`. This review used web `http://localhost:3002` and API `http://localhost:4012`. Stop only those processes.

The project manager can submit physical reports on the seeded ACTIVE project and can see the provisional financial comparison. The foreign officer receives 404 and no notes or money. The inspector can read assigned physical progress and cannot see budget or the ratio. Payments are synthetic rows marked PAID. Do not treat them as disbursed funds.

Outstanding decisions: link a user to a contractor before contractor reporting, and decide whether any future payment workflow is allowed to create `PAID` rows. Step 61, a global timeline, is not started and must not assume these two metrics are one series.

## Git plan, not executed

- G1: create `feature/projecttrace-progress-finance-summary` from current `origin/development` only after approval. Do not stash, reset, clean, or force-switch.
- G2: stage only the Steps 59–60 paths below. Exclude `Prompts/` and the unrelated review and production-readiness docs. Then run `git diff --cached --stat`, `--name-status`, and `--check`.
- G3: `feat(projecttrace): add physical and financial progress views (steps 59-60)`.
- G4: `git push -u origin HEAD:refs/heads/feature/projecttrace-progress-finance-summary`. Never a plain push while this branch tracks `feature/projecttrace-milestones`.
- G5: pull request into `development` after a separate approval.
- G6: merge only after a separate approval. `main` needs its own later release checkpoint.

Suggested stage list:

- `.gitignore`
- `apps/api/src/modules/projects/projects.routes.ts`
- `apps/api/src/modules/projects/financial-progress.policy.ts`
- `apps/api/src/modules/projects/financial-progress.service.ts`
- `apps/api/src/modules/projects/progress.policy.ts`
- `apps/api/src/modules/projects/progress.schema.ts`
- `apps/api/src/modules/projects/progress.service.ts`
- `apps/api/src/modules/projects/models/progress-report.model.ts`
- `apps/api/src/scripts/step59-isolated-dev.ts`
- `apps/api/src/scripts/step60-isolated-dev.ts`
- `apps/api/tests/projects-progress.test.ts`
- `apps/api/tests/projects-financial-progress.test.ts`
- `apps/api/tsconfig.json`
- `apps/web/src/app/projects/[id]/progress/page.tsx`
- `apps/web/src/components/projects/project-overview-client.tsx`
- `apps/web/src/components/projects/project-progress-client.tsx`
- `apps/web/src/lib/projects/finance-api.ts`
- `apps/web/src/lib/projects/finance-summary.ts`
- `apps/web/src/lib/projects/finance-summary.test.ts`
- `apps/web/src/lib/projects/messages.ts`
- `apps/web/src/lib/projects/progress-api.ts`
- `apps/web/src/lib/projects/progress-form.ts`
- `apps/web/src/lib/projects/progress-form.test.ts`
- `apps/web/src/lib/projects/progress-messages.ts`
- `apps/web/src/lib/projects/progress-policy.ts`
- `apps/web/src/styles/auth-access.css`
- `docs/reviews/steps-59-60/`
