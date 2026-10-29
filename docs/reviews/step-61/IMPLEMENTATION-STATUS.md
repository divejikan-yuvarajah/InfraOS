# Step 61 — Project Timeline

Roadmap title from `Prompts/Steps.docx`: **Step 61 — Project Timeline**. Step 62 (Project Dependency Management) and Step 63 (Project Activity History) were not implemented. Dependencies are a typed `{ status: "not_implemented" }` slot only.

This is an isolated demonstration on disposable memory Mongo. It is not production proof and not owner acceptance. Production readiness stays **BLOCKED**. No final phase recommendation is made here. Step 62 has not started.

## Git

No G1–G5 authorization was present in the execution prompt, so no branch, stage, commit, push, pull request, or merge was performed. Local HEAD remains `743e05323792b9820ab6e9897fb52edbd78f5bd3` on `feature/projecttrace-progress-summary`. `origin/development` is `24a89cf6087fc4d319edcad3fc10850dfb06aa29` (merge of PR #106). `origin/main` was not changed by this work. Unrelated dirty docs and `Prompts/` files were left untouched. G2–G5 wait for the combined Steps 61–62 review. G6 needs a later, separate authorization.

## What the timeline shows

`GET /api/v1/projects/:id/timeline` requires a live session, `project.read`, and `project.timeline.read`. Seed grants for that pair are Super Admin, Gov Admin, Agency Officer, and Project Manager. Contractor, Inspector, and Citizen do not have `project.timeline.read`. Contractor and Citizen are also denied in the service so a `progress.submit` grant does not create project ownership. Inspector timeline access was not invented.

Entries come only from persisted project created/start/planned end/actual end, milestone planned and actual dates, and progress `reportedAt` plus reported percent. Current project and milestone status are labeled as the stored state, not as the time the status changed. A reported 100% does not complete the project. Payment rows and audit events are not timeline sources. A progress note is returned only when `progress.read` is granted. A failed milestone or progress query is `unavailable`, not an empty list. A failed timeline dependency returns 503.

## Focused tests

- `npm run test -w @infraos/api -- tests/projects-timeline.test.ts tests/timeline-policy.test.ts` — exit 0, 2 files, 7 tests.
- `npm run test -w @infraos/web -- src/lib/projects/timeline-view.test.ts` — exit 0, 2 tests.
- `npx tsc -p apps/api/tsconfig.json --noEmit` — exit 0.
- `git diff --check` on the Step 61 edits — clean.
- Full API/web/lint/build suites were not run. They belong to the later combined review.

## Isolated browser

Ports 3000 and 4010 were left running. 3004 and 4014 were already occupied and were not stopped. This demo used 4015 and 3005 with `INFRAOS_NEXT_DIST_DIR=.next-step61-demo`. Fixture label `synthetic-timeline-not-bank`. Those processes were stopped afterward. Next's rewrite of `apps/web/tsconfig.json` was restored.

| Item | Result |
|---|---|
| Project manager `step61-manager@example.com` | Signed in. Overview showed a Timeline link beside Milestones and Physical progress. |
| Project `6ae379502858c8df4cf3c3ea` / INF-TIME-6101 | Timeline GET 200. Deck pour and Abutment works planned ranges. Deck pour recorded start 3 Jul 2026. Reported 40% at 2026-07-01T18:30:00.000Z, displayed 2 Jul 2026 00:00 in Asia/Colombo. Status stayed ACTIVE. |
| Empty project `6ae379502858c8df4cf3c3ec` | GET 200. Status CANCELLED. Copy said no milestone dates and no reported progress. Only the project created timestamp was shown. |
| Foreign officer `step61-foreign@example.com` | GET 404. UI: "This project is outside your scope, or it does not exist." No project title and no progress note. |
| Widths | 390 and 1440: `scrollWidth` was not greater than `clientWidth`. 320, 375, 768, 1024, and 1920 were **NOT RUN**. |
| Locale | Tamil headings, filters, and dates switched. Server provenance stayed the English sentence. Native Sinhala/Tamil review is **NOT RUN**. |
| Keyboard arrow traversal and painted focus contrast | **NOT RUN**. |
| Dedicated reload key on the populated timeline | **NOT RUN**. The populated timeline was loaded successfully twice (GET 200 both times) after the unauthenticated 401s were fixed. |

Evidence: `docs/reviews/step-61/evidence/timeline-390.png`, `timeline-1440.png`, `timeline-tamil.png`, `timeline-foreign-404.png`.

## Acceptance

| ID | Result | Note |
|---|---|---|
| S61-01 | PASS | Project manager sees planned project and milestone dates in stable order. |
| S61-02 | PASS | Recorded milestone start and progress timestamp appear with planned/recorded and date/timestamp labels. |
| S61-03 | PASS | Provenance says reported progress is not inspection verification. 100% does not change project status in the API test. Browser project stayed ACTIVE at 40%. |
| S61-04 | PASS | Cancelled project without schedule dates does not invent milestone or progress events. |
| S61-05 | PASS | API: 401 anonymous, 403 contractor/citizen/inspector, 404 foreign, restricted sources omit titles and notes. Browser foreign 404 shows no title or note. |
| S61-06 | PASS | Page/limit are bounded. Same-day order is deterministic. Source reads are capped. |
| S61-07 | PASS | Semantic list, Tamil switch, and no page overflow at 390 and 1440. Remaining widths, arrow keys, and focus contrast are NOT RUN. Native copy is draft. |
| S61-08 | PASS | Timeline read does not write project, milestone, or progress. No activity feed and no payment write. Full regression suite was not re-run. |

## Unresolved

- Step 62 dependency direction, cycles, and cross-agency links are not decided and are not implemented.
- Inspector has `milestone.read` and `progress.read` but not `project.timeline.read`, so inspectors do not get this page.
- Progress notes are visible to a timeline reader who also has `progress.read`. They are omitted when that grant is removed.
- Production remains blocked. Do not treat this demo as a release.
