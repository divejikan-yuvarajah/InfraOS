# Step 62 — Project Dependency Management

Roadmap title: **Step 62 — Project Dependency Management**. FR-PROJECT-014 is implemented as an informational prerequisite link on the existing project timeline. This is not owner acceptance. Production stays **BLOCKED**. Stored PAID is not bank confirmation. Contractor progress reporting stays blocked. Step 63 was not started. No stage, commit, push, pull request, or merge was performed.

## Git

Local branch remains `feature/projecttrace-progress-summary` at `743e05323792b9820ab6e9897fb52edbd78f5bd3`. `git status -sb` reported that this checkout tracks `origin/feature/projecttrace-timeline-dependencies`. G1 was not authorized, so this execution did not create, switch, or push that branch. The index was empty. Unrelated dirty files were left untouched: `docs/operations/production-readiness-gates.md`, older Step 53/54/58 reviews, and untracked `Prompts/` files. Next's rewrite of `apps/web/tsconfig.json` was restored after the demo.

## Policy decisions

These are implementation decisions, not roadmap text.

- Direction is dependent `projectId` → `prerequisiteProjectId`: “this project depends on” the prerequisite. The only type is `PREREQUISITE`.
- A link does not move dates, milestones, progress, money, or project status, and it does not unlock START, MARK_DELAYED, COMPLETE, or CANCEL.
- Writes use the live `project.update` grant plus the existing `projectWriteFilter`. Assigned project managers, same-agency officers, and in-tree gov admins can write. Super Admin, contractor, inspector, and citizen are denied.
- The prerequisite must be readable and in the same agency as the dependent. A readable project in another agency is 409. An unreadable project is 404 and its title is not returned. Cross-agency links are deferred.
- Dependent status must be DRAFT, APPROVED, or ACTIVE. COMPLETED, CANCELLED, and the other stored statuses return 409.
- Active uniqueness is the ordered pair where `removedAt` is null. Removal sets `removedAt` and `removedBy`. Re-adding reactivates that row and keeps prior audit rows.
- Cycle checks run inside a replica transaction under a dedicated `project-dependency-graph` lock. The agency hierarchy lock is not reused. More than 200 active edges in the agency fails closed with 503. A new production index needs a separate migration approval; tests build the partial unique index in memory.

## Focused tests

- `npm run test -w @infraos/api -- tests/projects-dependencies.test.ts tests/dependency-policy.test.ts tests/projects-timeline.test.ts` — 3 files, 14 tests, exit 0. The dependency file was re-run after the permission-removal case and passed 6 tests.
- The opposite-edge case ran `A→B` and `B→A` together. One request was 201, one was 409, one active edge remained, and one link audit was written.
- `npm run test -w @infraos/web -- src/lib/projects/dependency-view.test.ts src/lib/projects/timeline-view.test.ts` — 2 files, 4 tests, exit 0.
- `npx tsc -p apps/api/tsconfig.json --noEmit` and `npx tsc -p apps/web/tsconfig.json --noEmit` — exit 0.
- ESLint on the new dependency API and web files — exit 0.
- The full API/web/lint/build suite was not run. That belongs to the combined review.

## Browser

Disposable memory Mongo only. Ports 3000 and 4010 were left running. 3004 and 4014 were already occupied and were not stopped. The demo used 4016 and 3006 with `INFRAOS_NEXT_DIST_DIR=.next-step62-demo` and webpack, because Turbopack failed to compile `next/font/google` in that dist directory. Those two listeners were stopped afterward. Fixture label `synthetic-dependencies-not-bank`. The manager was `step62-manager@example.com`.

First disposable run, project A `6ae380c5fa301a0620953954`:

| Action | HTTP |
|---|---|
| Add prerequisite B from the timeline | POST `/api/v1/projects/6ae380c5fa301a0620953954/dependencies` 201 |
| Refresh | Link still read “This project depends on INF-DEP-6202”. Status stayed ACTIVE. |
| Add the same pair again | POST 409. The page said to reload. |
| On B, add A | POST `/api/v1/projects/6ae380c5fa301a0620953956/dependencies` 409. B stayed empty. |
| Self link and foreign target, from the signed-in page | Self 409. Foreign target 404. The body did not contain the foreign code or title. Search for `6299` offered no add button. |
| Escape | The confirmation closed and focus returned to “Remove relationship”. |
| Width 390 | `scrollWidth` was not greater than the viewport. Sinhala and Tamil headings rendered. |

Second disposable run, project A `6ae387fa276a683e2ea17c4c`:

| Action | HTTP |
|---|---|
| Add B | POST 201 |
| Soft-remove while the page still held revision 1 | DELETE 200. A and B both still GET as ACTIVE. |
| Confirm remove on that stale page | DELETE 409. The page showed the reload sentence. |
| Reload | “No prerequisites are recorded.” Status stayed ACTIVE. |
| Add the same pair again | POST 201 |
| Widths 320 and 1920 | No horizontal overflow. |

Evidence: `docs/reviews/step-62/evidence/prerequisites-linked.png`, `cycle-409.png`, `timeline-390-si.png`, `timeline-390-ta.png`, `stale-409.png`.

## Acceptance

| ID | Result | Note |
|---|---|---|
| S62-01 | PASS | Assigned manager added B and saw it after refresh. The second run added it again after removal. |
| S62-02 | PASS | Copy says the project depends on the prerequisite and that dates and status do not change. The timeline list shows the code, title, and status. No schedule event is invented from the link. |
| S62-03 | PASS | Browser: duplicate 409, B→A 409, self 409. API tests also reject A→A, A→B then B→A, and A→B→C→A, with status and `__v` unchanged. |
| S62-04 | PASS | The replica test committed one of the two opposite edges. The active graph stayed one edge, with one matching audit. |
| S62-05 | PASS | Stale confirm returned 409 and the reload sentence. Soft removal left both projects. The same pair was added again with POST 201. |
| S62-06 | PASS | Foreign search showed no target. Direct foreign POST was 404 without the foreign title. API tests deny contractor, inspector, citizen, and Super Admin writes. |
| S62-07 | PASS | API tests cover 401, 403 after `project.update` is removed, credential epoch, unknown query key, and audit-hook rollback with no stored link. |
| S62-08 | PASS | Browser status stayed ACTIVE at 0% after add and removal. API tests reject a completed dependent and assert status is unchanged. |
| S62-09 | PASS | Screenshots cover the link, the cycle message, Sinhala and Tamil at 390, and the stale message. Escape restored focus. Widths 320, 390, and 1920 did not overflow. Native Sinhala and Tamil review is not done. |
| S62-10 | PASS | Step 61 timeline tests passed, 5 tests. The timeline still shows planned and recorded dates only. No activity feed and no lifecycle shortcut was added. The full Steps 57–60 suite was not re-run here. |

## Section B

Ready for the combined Steps 61–62 review. Not ready to stage. G2–G5 wait for that review and its authorization. G6 is not authorized.

Unresolved for that review:

- Cross-agency prerequisites remain rejected until an explicit policy exists.
- The partial unique index is created in tests. Production still needs a separate migration approval.
- Sinhala and Tamil strings are drafts.
- The historical Step 61 status file still describes the pre-dependency slot. The code now returns visible informational links.
