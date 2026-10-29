# Steps 61–62 end-of-phase verification

Date: 2026-10-29 (local). Reviewer: same agent that implemented Steps 61 and 62. This is not an independent owner sign-off.

## Executive verdict

| Item | Result |
| --- | --- |
| Step 61 — Project Timeline | **APPROVE** for the implemented read-only timeline |
| Step 62 — Project Dependency Management | **APPROVE** for same-agency informational prerequisites |
| Combined feature recommendation | **APPROVE** for a later, explicitly authorized G1–G5 |
| Production readiness | **BLOCKED** |
| G1–G6 | **NOT RUN** |

No fatal RBAC leak and no unreliable cycle rejection were found in this pass. A stale-revision retry bug in the dependency graph lock was found and fixed before the final API suite. Same-agent **APPROVE** does not authorize staging, commit, push, merge, or deployment.

## Source requirements and chosen design

Confirmed titles in `Prompts/Steps.docx`:

- Step 60 — Financial Progress Summary
- Step 61 — Project Timeline
- Step 62 — Project Dependency Management
- Step 63 — Project Activity History (not implemented)

`FR-PROJECT-014` (P1, ProjectTrace): Project Manager records dependency links; circular dependency is rejected when detected; the timeline can show a dependency.

Chosen policy, recorded as design decisions:

- Timeline reads require live `project.read` and `project.timeline.read`. Events come from project dates, current milestone dates, and progress `reportedAt` / `reportedPercent`. Notes require `progress.read`. Payments and audit events are omitted. A failed source is `unavailable`. Cap is 100 events per source.
- A dependency is informational. Direction is dependent project → prerequisite (`A depends on B`). Type is `PREREQUISITE` only. Linking does not reschedule, start, complete, or change status, progress, or money.
- The prerequisite must be readable and in the same agency. A readable project in another agency is rejected. An unreadable target is 404 and the title is not returned. Cross-agency prerequisite governance remains deferred.
- Writers need live `project.update` and the project write scope (assigned PM, same-agency officer, government admin in tree). Super Admin, contractor, inspector, and citizen do not get this mutation.
- Dependent status allowed for a new link: DRAFT, APPROVED, ACTIVE. COMPLETED and CANCELLED are rejected.
- Removal sets `removedAt` / `removedBy`. The partial unique index is active rows only. Re-adding reactivates that row.
- Graph changes use one lock document, `_id` `project-dependency-graph`, and compare the caller’s `graphRevision` to `seq` inside a transaction. More than 200 active edges fails closed with 503. The production partial unique index still needs a separate migration approval. Tests sync indexes on the in-memory replica.

`docs/reviews/step-61/IMPLEMENTATION-STATUS.md` still says dependencies are not implemented. That sentence is historical. The code now returns visible informational links.

## Git observation (read-only)

| Ref | SHA |
| --- | --- |
| HEAD | `743e05323792b9820ab6e9897fb52edbd78f5bd3` |
| Branch | `feature/projecttrace-progress-summary` tracking `origin/feature/projecttrace-timeline-dependencies` at the same SHA |
| `origin/development` (local tracking, not freshly fetched) | `24a89cf6087fc4d319edcad3fc10850dfb06aa29` |
| `origin/main` (local tracking) | `4944fe7e55d28598ec4fa9bcbf5087c9807eb5de` |

Index is empty. `743e053` is already a parent of the development merge `24a89cf`. The remote branch named `feature/projecttrace-timeline-dependencies` exists and does not contain Steps 61–62. The worktree is dirty. A checkout from `origin/development` would be unsafe. No stash, reset, clean, or force was used.

`apps/web/tsconfig.json` was rewritten by Next typegen (formatting plus `.next-step62-demo` includes, including trailing whitespace). That generated diff was restored with `git checkout -- apps/web/tsconfig.json`. `git diff --check` is clean afterward.

Unrelated dirty paths left untouched: `docs/operations/production-readiness-gates.md`, `docs/reviews/step-53`, `step-54`, `step-58`, `steps-53-54`, and untracked `Prompts/`. No `.env*` change. Isolated scripts `step61-isolated-dev.ts` and `step62-isolated-dev.ts` are excluded from the API tsconfig. Demo dist directories are gitignored. No new dependency library.

## Step 61 outcomes

| ID | Result | Evidence |
| --- | --- | --- |
| S61-01 | PASS | Assigned PM timeline showed planned start 2026-06-01, planned end 2026-12-31, milestone Deck pour 2026-07-01–2026-08-01 |
| S61-02 | PASS | Recorded milestone start 2026-07-03 labeled Recorded Date; progress labeled Recorded Timestamp; planned items labeled Planned Date. Current status is labeled as the stored status, not a change time |
| S61-03 | PASS | Page states reported progress is not inspection verification and that 100 does not complete the project. Stored status stayed ACTIVE at 100 |
| S61-04 | PASS | Project B showed “No milestone dates are recorded” and “No physical progress has been reported” |
| S61-05 | PASS | Anonymous timeline API 401. Foreign officer timeline, dependencies, and financial-progress 404. Response bodies did not contain the project code, milestone title, progress note, or payment amount. Signed-out browser redirected to `/login` with none of those strings |
| S61-06 | PASS | API timeline tests cover bounds, sort, and invalid cursors. Browser previous/next were disabled on this small fixture |
| S61-07 | PASS | Widths 320, 375, 390, 768, 1024, 1440, and 1920 had `documentElement.scrollWidth` within 1px of the viewport. EN/SI/TA headings and controls switched. Escape closed the confirm dialog. Native Sinhala/Tamil review is NOT RUN. Tab traversal is NOT RUN in this embedded browser: one Tab was sent and focus stayed on Remove relationship. `:focus-visible` CSS is `2px solid` maroon; a mouse-focused button did not match `:focus-visible` |
| S61-08 | PASS | Final API suite 334/334 and web suite 180/180. No Step 63 code. Linking and unlinking left project status ACTIVE |

## Step 62 outcomes

| ID | Result | Evidence |
| --- | --- | --- |
| S62-01 | PASS | PM POST `/api/v1/projects/6ae38bc4cacc66ebd857d76b/dependencies` returned 201. Reload showed “This project depends on INF-DEP-6202” |
| S62-02 | PASS | Direction sentence and “does not change dates or status” were visible. Timeline status stayed ACTIVE |
| S62-03 | PASS | Browser B→A POST returned 409 and the page showed the circle message. API test also rejects self, duplicate, A→B→A, and A→B→C→A (C→A POST 409 after B→C 201). Policy unit test covers the three-node return |
| S62-04 | PASS | `lets only one of two opposite edges commit` passed in the focused rerun after the lock fix and again in the final full API suite. A single-thread DFS is not the evidence used here |
| S62-05 | PASS | DELETE with `graphRevision: 0` returned 409 `CONFLICT`; the link and revision 1 remained. UI DELETE with the current revision returned 200, the list became empty, and status stayed ACTIVE. Re-add is covered by the API test and was NOT RUN in this browser |
| S62-06 | PASS | Foreign dependencies 404 with no title. Contractor and inspector POSTs are 403 in `projects-dependencies.test.ts`. Browser sign-in as those roles was NOT RUN |
| S62-07 | PASS | Anonymous 401. Audit-failure path expects 503 and rolls back in the API test. Strict schema and invalid ids are covered by that suite. A live 503 fault injection in the browser was NOT RUN |
| S62-08 | PASS | After add and remove, project GET stayed `ACTIVE` with `physicalProgress` 100. Policy rejects COMPLETED, CANCELLED, and SUBMITTED dependents |
| S62-09 | PASS | Add, persisted display, cycle 409, and removal were shown in the browser. Screenshots are listed below. The per-link direction sentence stays English in SI and TA; surrounding labels translate. Native review is NOT RUN |
| S62-10 | PASS | Full API and web suites passed on the final run. No RoadSync or Step 63 activity-history code |

## Defect fixed in this review

`runGraph` previously treated a graph retry as permission to adopt the latest lock sequence. A caller’s stale `graphRevision` could then be applied when the new edge did not cycle. After the fix, a graph retry and duplicate-key 11000 return 409 immediately. A transient transaction error retries only while the lock sequence is still the caller’s expected value. `expected` is `const`. Focused dependency tests passed after the logic change. The file lint error `prefer-const` was then cleared. The final full API suite passed.

The Step 48 admin-users failure on the first full API run was not changed. It is an existing intermittent expectation of 503 versus 401 when an audit hook throws. The focused rerun of that file passed, and the final full suite passed.

## Automated gates

Mongo connection variables were removed from the test processes. Suites use the in-memory replica. Web tests used process-only `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=0`, `NEXT_PUBLIC_AUTH_FIXTURE=0`, and `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000`. `.env.local` was not edited. Those process flags were removed after the web suite.

| Gate | First result | Final result |
| --- | --- | --- |
| `npm run test:api` | Exit 1. 37 files passed, 1 failed. 333 passed, 1 failed: `tests/admin-users.test.ts` “disables with epoch revocation, protects the last super admin, and rolls back audit” expected 503, received 401 | Exit 0. 38 files, 334 tests passed. Duration 290.33s |
| Focused rerun | — | Exit 0. `admin-users`, `projects-timeline`, `projects-dependencies`, `dependency-policy`: 4 files, 18 tests |
| `npm run test:web` | Exit 0. 43 files, 180 tests | Same run; no rerun required |
| `npm run type-check` | Exit 0 (lint then failed in the same command) | No second type-check. The later lint and build both typecheck their inputs |
| `npm run lint` | Exit 1. Web: 0 errors, 2 warnings. API: `dependency.service.ts:197` `prefer-const` | Exit 0. Same 2 web warnings, 0 errors. API eslint clean |
| `npm run build` | Exit 0 | Same run |
| `git diff --check` | Clean before the Next tsconfig rewrite | Clean after restoring `apps/web/tsconfig.json` |

Web lint warnings, both `react-hooks/incompatible-library`, left unchanged:

- `apps/web/src/components/ui/data-table.tsx` `useReactTable`
- `apps/web/src/components/projects/project-create-form.tsx` `form.watch`

## Browser demonstration

Isolated disposable API `http://localhost:4016` and web `http://localhost:3006` (`INFRAOS_NEXT_DIST_DIR=.next-step62-demo`, webpack, `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=1`). Ports 3000 and 4010 were not stopped. Fixture label `synthetic-dependencies-not-bank`. Actor: assigned PM `step62-manager@example.com`. Foreign actor: `step62-foreign@example.com`. These rows are synthetic fixtures, not production data.

| Check | HTTP / UI |
| --- | --- |
| PM opens A timeline | `http://localhost:3006/projects/6ae38bc4cacc66ebd857d76b/timeline` |
| Seeded progress and milestone | ACTIVE, 100, Deck pour DELAYED, note “Reported deck placement, not an inspection” |
| Add B as prerequisite of A | POST 201 |
| Reload | Link still present |
| B→A cycle | POST `.../6ae38bc4cacc66ebd857d76d/dependencies` 409; circle copy visible |
| Stale revision | DELETE with `graphRevision` 0 returned 409; link and revision stayed |
| Remove current link | DELETE 200; empty list; status ACTIVE; 100 still shown |
| Progress page | `.../progress` shows “Not a bank payment” |
| Anonymous API | GET timeline 401, no leak |
| Foreign API | Timeline, dependencies, and financial-progress 404, no leak. Own foreign project timeline 200 |
| Signed-out browser | Redirect to `/login?next=%2Fprojects%2F6ae38bc4cacc66ebd857d76b%2Ftimeline`; no project title, milestone, note, or amount |
| Widths | 320, 375, 390, 768, 1024, 1440, 1920: no document overflow |
| Locales | SI heading `ව්‍යාපෘති කාලරේඛාව`; TA heading `திட்ட காலவரிசை`. Layout PASS. Native review NOT RUN |
| Reduced motion | `prefers-reduced-motion: reduce` rules exist in `auth-access.css` and `globals.css`. A forced reduced-motion browser session was NOT RUN |
| Dev overlay | One Next hydration notice pointed at `src/app/layout.tsx` skip link during the B timeline load. The page still rendered. Root layout was not changed |

Screenshots:

- `docs/reviews/steps-61-62/evidence/combined-timeline.png`
- `docs/reviews/steps-61-62/evidence/combined-timeline-320.png`
- `docs/reviews/steps-61-62/evidence/combined-timeline-1440.png`
- `docs/reviews/steps-61-62/evidence/combined-timeline-tamil.png`
- `docs/reviews/steps-61-62/evidence/combined-progress.png`
- Earlier step folders: `docs/reviews/step-61/evidence/`, `docs/reviews/step-62/evidence/`

NOT RUN in this browser: contractor, inspector, and citizen sessions; live database-down 503; three-node click path (covered by the API test); re-add after remove; forced reduced-motion; contrast measurement; arrow-key paging. A second browser tab cannot share the in-memory access token, so the stale revision was proven with an authenticated API DELETE while the page still held the link, then the page removed it successfully.

## Regressions and security

Step 57 separation of duties, Step 58 milestones, Step 59 append-only progress, and Step 60 provisional PAID reads remain covered by the full API and web suites. Step 60 copy on the progress page says stored PAID rows are not a bank payment. Step 51 grant-race and agency-hierarchy races were not re-proven and stay a production blocker. No RoadSync change.

Query keys for dependency reads include epoch, user id, and role key. Hidden targets do not return titles. The timeline does not invent schedule events from a link.

## Open caveats (production remains BLOCKED)

- Step 59 contractor user-to-contractor link is still blocked. Contractor progress reporting stays off.
- Step 60 PAID is a stored status, not bank settlement.
- Step 51 authorization and agency-hierarchy races are not re-proven.
- Sinhala and Tamil are drafts. The direction sentence is still English in those locales.
- Atlas indexes and the dependency partial unique index are not migrated.
- Email delivery, null-agency Super Admin, staging auth cookies, backups, monitoring, and branch protection are not cleared by this review.
- Cross-agency prerequisite policy is deferred.
- The graph lock is one document sequence inside a replica transaction, capped at 200 edges. It is not a separate distributed lock.
- Same-agent review is not owner acceptance.
- Protected-branch settings were not re-queried from GitHub in this pass. Local tracking refs only: development `24a89cf`, main `4944fe7e`. Main was not updated.

## Owner repeat

1. Start only a disposable API and web on free ports. Leave 3000 and 4010 alone. Do not point the process at Atlas or edit `.env.local`.
2. Sign in as the seeded PM, open project A’s timeline, confirm planned/recorded labels and the 100-percent notice, add B, reload, attempt B→A, and expect HTTP 409.
3. DELETE with `graphRevision: 0` and expect 409 with the link still present. Remove with the current revision and expect the project to stay ACTIVE.
4. Open progress and confirm the provisional finance sentence. Sign out and confirm the timeline URL returns to login without the project title.
5. Repeat as a foreign officer and expect 404 without the title.

## Git gates

| Gate | State |
| --- | --- |
| G1 | NOT RUN. Branch `feature/projecttrace-timeline-dependencies` already exists at `743e053`. Dirty tree. Checkout from `origin/development` was not attempted |
| G2 | NOT RUN. Nothing staged |
| G3 | NOT RUN |
| G4 | NOT RUN |
| G5 | NOT RUN. No pull request |
| G6 | NOT RUN. Not authorized. Do not infer it from this APPROVE |

A later single approval can cover G1–G5 only if the owner accepts this feature scope and a safe branch plan. The safe plan is to commit on the existing `feature/projecttrace-timeline-dependencies` (ancestor of development) without switching, stashing, or resetting, then push only `HEAD:refs/heads/feature/projecttrace-timeline-dependencies` and open a draft PR into `development`. G6 still requires a separate approval after PR and CI.

## Handoff

Next roadmap item is Step 63 — Project Activity History. No Step 63 code was added.

Demo listeners started for this walkthrough (API port 4016, web port 3006) are stopped at the end of this review. Ports 3000 and 4010 were left running.
