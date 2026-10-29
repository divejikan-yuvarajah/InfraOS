# Step 63 — Project Activity History

Date: 2026-10-30 (local). Branch: `feature/projecttrace-activity-history` at `c0ff470f95af1e5c4bc04a016f11846edd798392` (tracks `origin/development`). Not committed.

## Verdict

Privacy-safe activity history is implemented for the existing timeline audience. Timeline remains the planned-date view. This document is an implementation record, not owner acceptance. Production readiness stays **BLOCKED**. G1–G6 were **NOT RUN**.

## Design

- `GET /api/v1/projects/:id/activity` requires a live session, `project.read`, and `project.timeline.read`. No `project.activity.read` permission was added. Inspector, contractor, and citizen stay outside this route.
- Query: `limit` 1–50 default 20, `cursor`, `category` `all|project|milestone|progress|dependency`. Unknown or repeated keys are 400. Response is `no-store`.
- Rows are allowlisted persisted actions only. Unknown actions are omitted. Actor text is “Authorized staff” or “System event”. Notes, reasons, emails, IP, user agent, raw snapshots, and money are not returned.
- A progress report is hidden only when one unused `progress.reported` audit has the same percent and the same timestamp. A later report with the same percent stays visible and is still not inspection verification. `createdAt` is used only when no `project.created` audit exists and the source query was not truncated.
- A dependency title is read from `newValue.prerequisiteProjectId` or, for a removal, `oldValue.prerequisiteProjectId`. The identifier is not returned. A title or code is returned only when that project is inside the caller's read scope.
- Ordering is timestamp descending, then id descending. Source reads stop at 200 rows. A truncated source is `partial_source_coverage`.
- The GET path does not write audit, project, milestone, progress, dependency, or graph-lock documents.

## Browser evidence

Isolated API `http://localhost:4017` and web `http://localhost:3007`. Synthetic project `6ae3b63f012065a4d8789910` (`INF-ACT-6301`).

- Signed-in manager opened `/projects/6ae3b63f012065a4d8789910/activity` from the overview link target. Status stayed **ACTIVE** at reported **100%**.
- Rows showed project updates, a visible prerequisite `INF-ACT-6302`, a restricted prerequisite with no foreign title, milestone “Deck pour”, and reported progress. The private progress note and the manager email were absent.
- Load more revealed the older created, milestone, and progress rows and then disappeared. Category filters for milestones, progress, and dependencies changed the list.
- Sinhala and Tamil chrome rendered. Native review is **NOT RUN**. Event titles stay English.
- Layout widths 320, 375, 390, 768, 1024, 1440, and 1920 did not grow `scrollWidth` past the viewport.
- A signed-out visit redirected to `/login` without the project title. An unauthenticated browser fetch returned **401** and `Cache-Control: no-store`.
- A foreign agency officer saw “outside your scope” and did not see the project title or activity rows.

Screenshots: `docs/reviews/step-63/evidence/`. Demo listeners on 3007 and 4017 were stopped. Ports 3000 and 4010 were left running.

Correction browser, 2026-10-30, disposable Mongo on `http://localhost:4018` and web `http://localhost:3008`, project `6ae3c2908951be3b567df23c`:

- The manager signed in, opened activity, and used Load more. The older created, milestone, and progress rows appeared, status stayed ACTIVE at 100 percent, and the manager email was absent.
- At width 320, `scrollWidth` stayed 320.
- Sign-out returned the same URL to `/login` with no earlier rows. The foreign officer then saw “outside your scope” and did not see “Deck pour”, “Project draft updated”, or the project title.
- Those listeners were stopped. Ports 3000 and 4010 were still listening.

## Checks

| Command | Result |
| --- | --- |
| Focused API activity tests | pass |
| `npm run test:api` | 337 passed, exit 0 |
| `npm run test:web` | first run 181 passed / 1 failed because the shell still had live-auth env from the demo; rerun with that env removed: 182 passed, exit 0 |
| `npm run type-check` | first web failure: activity query key was a string; fixed; rerun exit 0 |
| `npm run lint` | exit 0, two existing web warnings |
| `npm run build` | exit 0 |
| `git diff --check` | exit 0 |

Correction rerun on 2026-10-30, local only: API 337 exit 0, web 184 exit 0, type-check exit 0 after restoring the `ActivityViewItem` import, lint exit 0 with the same two warnings, build exit 0. GitHub Actions has not run these uncommitted fixes.

## Limitations

- Sinhala and Tamil event titles are still the English draft keys. Native review was not run.
- History is the allowlisted sources, capped at 200 rows per source. It is not a complete audit export.
- Stored payment rows are omitted. A stored PAID value is not a bank settlement.
- Cross-agency prerequisites stay hidden. Contractor user linkage and Step 51 grant races remain outside this step.
- No Atlas index was created. The correction is uncommitted. PR #112 is not merged.
