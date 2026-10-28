# Step 58 end-of-step verification

Date: 2026-10-29. Same-agent review. This is not independent project-owner signoff.

## Conclusions

| Decision | Result |
|---|---|
| Step 58 feature recommendation | **APPROVE** |
| Production readiness | **BLOCKED** |

Weight and hard delete stay explicitly excluded. Sinhala and Tamil copy is draft. Step 51 races, Atlas indexes, email, null-agency Super Admin, staging cookies, monitoring, backup, and branch protection stay open. PR #100 CI success is not release clearance.

## Requirement outcomes

| ID | Outcome | Evidence |
|---|---|---|
| FR-MS-001 create on an eligible project | PASS | API create 201. Browser POST 201 for Bridge deck A and Drainage works B. |
| FR-MS-001 optional weight | BLOCKED / excluded | Schema has no weight. API rejects `weight` with 400. UI says weight is not part of this step. No fake field. |
| FR-MS-002 legal transitions | PASS | Policy unit test. Browser `NOT_STARTED` → `IN_PROGRESS` → `COMPLETED` returned 200, 200. |
| FR-MS-002 illegal transitions | PASS | `NOT_STARTED` + `COMPLETE` returns 409 in `projects-milestones.test.ts`. The page does not offer that button. |
| Stored status `NOT_STARTED`, label Planned | PASS | Create response status `NOT_STARTED`. UI label Planned / සැලසුම් / திட்டமிட்டது. `PLANNED` payload returns 400. |
| BR-PRJ-010 parent not auto-completed | PASS | After completion, parent stayed `APPROVED`, `physicalProgress` 0, `financialProgress` 0 in the API test. Overview showed `APPROVED` and recorded progress `0%`. |
| Workflow #7 timeline | PASS | Ordered list `aria-label="Milestone timeline"` with planned and actual dates. Not a Step 61 Gantt. |
| M4 deletion | BLOCKED / excluded | DELETE returns 404. No delete button. |
| Step 59–61 | Not implemented | No physical-progress submission, financial progress workflow, or global timeline. |

## Quality gates

Commands used the worktree. Web test and build set `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=0`, `NEXT_PUBLIC_AUTH_FIXTURE=0`, and `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000`. API tests used `mongodb-memory-server`. `MONGODB_URI`, `MONGODB_URL`, and `DATABASE_URL` were removed from that test process. `.env.local` was not edited.

| Command | Result |
|---|---|
| `npm run test:api` | PASS. 32 files, 311 tests. |
| `npm run test:web` | PASS. 39 files, 174 tests. Repeated after the denial-message fix: PASS, 174 tests. |
| `npm run type-check` | PASS. An earlier run failed on a missing `MilestoneStatus` export; that was fixed and the rerun passed. |
| `npm run lint` | PASS. 0 errors, 2 existing warnings: `data-table.tsx` `useReactTable`, `project-create-form.tsx` `form.watch`. An earlier lint failed because it scanned `.next-step58`; that output is ignored and the rerun passed. |
| `npm run build` | PASS. Web compiled successfully. API `tsc -p tsconfig.build.json` succeeded. Repeated after the denial fix: PASS. |
| `git diff --check` | PASS after restoring `apps/web/tsconfig.json`. Next had rewritten it during the demo; that rewrite is not part of the feature. |

## Security

| Check | Outcome | Evidence |
|---|---|---|
| Assigned PM create/read/update/transition | PASS | Browser and `creates, lists, edits, and completes...` |
| Other PM same agency | PASS | POST 404 |
| Gov Admin in ministry, agency officer, foreign gov | PASS | Officer and ministry POST 201. Foreign GET 404 |
| Super Admin read, no write | PASS | GET 200, POST 403 |
| Citizen, contractor | PASS | GET 403 |
| Inspector without assignment | PASS | GET 404 |
| Inspector with an inspection | PASS | GET 200, POST 403 |
| Anonymous | PASS | GET 401 |
| Revoked `milestone.create` | PASS | POST 403, then the grant is restored in the test |
| Stale credential epoch | PASS | GET 401 |
| Malformed bearer | PASS | GET 401 |
| Operator object, `agencyId` in body, negative progress, bad ObjectId, text/plain | PASS | 400 or 415 |
| Draft and cancelled parent writes | PASS | 409 |
| Terminal milestone edit | PASS | PATCH after COMPLETE 409 |
| Two clients, one revision | PASS | Statuses 200 and 409. One `milestone.updated` audit |
| Audit failure rollback | PASS | 503 and count 0. Database disconnect was NOT RUN |
| Audit shape | PASS | `resourceType` MILESTONE, actor user id, request id, `newValue.status` only. No title in the snapshot |
| Step 57 review suite | PASS | Included in the 311 API tests. `project.complete` was not unlocked |
| Step 51 hierarchy races | Not claimed fixed | Still a release blocker |

## Browser

Disposable API `http://localhost:4011`. Web `http://localhost:3001`. Resource hosts observed: `localhost:3001` and `localhost:4011`, not port 4000. Listeners were stopped after the walkthrough. Ports 3000 and 4010 were not stopped.

Project `INF-ROAD-5801`, id `6ae24207d94a1f59536d99ad`. Milestone A `6ae24273d94a1f59536d99fe`. Milestone B `6ae24281d94a1f59536d9a1b`.

| Step | Outcome |
|---|---|
| PM login, overview, Milestones link | PASS |
| Create A and B | PASS. POST 201, 201 |
| Edit A | PASS. PATCH 200. Title survived refresh |
| Start then complete A | PASS. POST 200, 200. Progress 100. Parent `APPROVED`, recorded progress `0%` |
| Invalid end-before-start | PASS. Form alert shown. No POST |
| Second-tab stale PATCH | PASS. 409 and "This milestone changed. Reload it before trying again." |
| Escape closes the confirm dialog | PASS |
| Sign out, foreign login, open the URL | PASS. GET 404. Page: "This project is outside your scope, or it does not exist." Titles not shown |
| Widths 320, 375, 390, 768, 1024, 1440, 1920 | PASS for horizontal overflow. `scrollWidth` did not exceed `innerWidth` |
| EN / SI / TA switch | PASS for layout. Headings became සන්ධිස්ථාන and மைல்கற்கள். Native translation review NOT RUN |
| 3:1 focus ring measurement | NOT RUN. Tab moved focus. `:focus-visible` was false under this automation, so the ring was not measured |

Screenshots:

- `docs/reviews/step-58/evidence/step58-review-completed.png`
- `docs/reviews/step-58/evidence/step58-review-parent-approved.png`
- `docs/reviews/step-58/evidence/step58-review-390.png`
- `docs/reviews/step-58/evidence/step58-review-ta-1920.png`
- `docs/reviews/step-58/evidence/step58-review-denied.png`
- Earlier demo shots remain as `step58-desktop-completed.png`, `step58-invalid-dates.png`, `step58-stale-revision.png`, `step58-parent-still-approved.png`, `step58-outsider-denied.png`, `step58-mobile-390.png`

A Next.js dev issue badge appeared during the overview capture. The readable mismatch was `data-cursor-ref` injected by the browser tool, not milestone content.

## Owner walkthrough

From `apps/api`: `PORT=4011`, `FRONTEND_ORIGIN=http://localhost:3001`, `npx tsx src/scripts/step58-isolated-dev.ts`. From `apps/web`: `NEXT_PUBLIC_API_BASE_URL=http://localhost:4011`, `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=1`, `INFRAOS_NEXT_DIST_DIR=.next-step58`, `npx next dev --webpack -p 3001`. Sign in as the printed manager. Open the printed project overview, then Milestones. The password is `DEMO_PASSWORD` in the script. Restore `apps/web/tsconfig.json` after stopping Next.

## Git

Branch `feature/production-readiness-phase-1` at `dabeede1845d019ff69f575c8961c1a318113115`. `origin/development` `596e50648de5e6fad212c5601ff53b6952fa7dad`. `origin/main` `9ca89e9825e7396e0564423923c257ceccd49bd2`. No branch switch, stage, commit, push, or PR.

Unrelated dirty files remain: `docs/operations/production-readiness-gates.md` and the Step 53–54 review files. `Prompts/` is untracked. `.env` files were not changed. Do not `git add .`.

Next approval is still G1, and only if the owner first accepts a safe checkout onto current `origin/development`. G1 was not run.
