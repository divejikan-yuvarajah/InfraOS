# Step 58 — Milestone management

Date: 2026-10-28. Same-agent implementation record. This is not an independent human signoff.

End-of-step verification on 2026-10-29 added the denial fallback, Escape-to-close, draft language switch, and the extra API cases. The verification record is `docs/reviews/step-58/END-OF-STEP-VERIFICATION.md`. Feature recommendation there is **APPROVE**. Production readiness stays **BLOCKED**.

## Verdict

**Feature-ready for owner review.** Assigned staff can create, edit, list, and transition milestones on an approved project. The parent project is not completed and its recorded physical progress is not changed.

**Production-ready: BLOCKED.** Existing release blockers remain. Step 58 does not clear them.

## What works

Storage stays on the existing `milestones` collection. Status values are `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`, `DELAYED`, `BLOCKED`, and `CANCELLED`. The UI label for `NOT_STARTED` is **Planned**. A second stored value `PLANNED` is not accepted.

Routes, all with `Cache-Control: no-store`:

| Method | Path | Permission |
|---|---|---|
| GET | `/api/v1/projects/:projectId/milestones` | `milestone.read` |
| GET | `/api/v1/projects/:projectId/milestones/:milestoneId` | `milestone.read` |
| POST | `/api/v1/projects/:projectId/milestones` | `milestone.create` |
| PATCH | `/api/v1/projects/:projectId/milestones/:milestoneId` | `milestone.update` |
| POST | `/api/v1/projects/:projectId/milestones/:milestoneId/transition` | `milestone.update` |

There is no DELETE route. `milestone.delete` remains in the catalog, and hard delete is **BLOCKED / not implemented**. The UI says milestones are not deleted.

Optional milestone **weight** is **BLOCKED / not implemented**. The API rejects unknown keys, including `weight`.

Writes require the permission, a live role, project write scope, and a parent status of `APPROVED` or `ACTIVE`. `PROJECT_MANAGER` writes only when `managerId` is the actor. `GOV_ADMIN` and `AGENCY_OFFICER` use agency scope. `SUPER_ADMIN` can read in platform scope and cannot write. `CITIZEN` and `CONTRACTOR` are denied. `INSPECTOR` can read only when an `Inspection.inspectorId` matches the actor. Lookups require `milestone.projectId` to match the URL.

Legal transitions, stored enum:

```text
NOT_STARTED -> IN_PROGRESS | DELAYED | BLOCKED
IN_PROGRESS -> COMPLETED | DELAYED | BLOCKED | CANCELLED
DELAYED     -> IN_PROGRESS | CANCELLED
BLOCKED     -> IN_PROGRESS | CANCELLED
COMPLETED   -> terminal
CANCELLED   -> terminal
```

`COMPLETE` sets that milestone's `progress` to 100 and `actualEnd`. It does not change `Project.status`, `Project.physicalProgress`, or `Project.financialProgress`.

Mutations send a numeric `revision`, match `__v`, increment `__v`, and append an audit event in the same transaction. Audit snapshots store `status` and `agencyId` only. Title and description are not in the audit snapshot schema, so they are not copied into the snapshot.

The staff page is `/projects/[id]/milestones`, linked from the project overview. Query keys include the auth epoch, user, and role. Sinhala and Tamil labels are drafts. Native review is still pending.

## Step 58 paths

- `apps/api/src/modules/projects/projects.routes.ts`
- `apps/api/src/modules/projects/project.constants.ts` (exports `MilestoneStatus` from the existing array)
- `apps/api/src/modules/projects/milestone.policy.ts`
- `apps/api/src/modules/projects/milestones.schema.ts`
- `apps/api/src/modules/projects/milestones.service.ts`
- `apps/api/src/scripts/step58-isolated-dev.ts`
- `apps/api/tests/projects-milestones.test.ts`
- `apps/api/tsconfig.json` (excludes the isolated script from rootDir checking)
- `apps/web/src/app/projects/[id]/milestones/page.tsx`
- `apps/web/src/components/projects/project-milestones-client.tsx`
- `apps/web/src/components/projects/project-overview-client.tsx`
- `apps/web/src/lib/projects/messages.ts`
- `apps/web/src/lib/projects/milestone-form.ts`
- `apps/web/src/lib/projects/milestone-form.test.ts`
- `apps/web/src/lib/projects/milestone-messages.ts`
- `apps/web/src/lib/projects/milestones-api.ts`
- `apps/web/src/styles/auth-access.css`
- `apps/web/eslint.config.mjs` (ignores `.next-step*/**`)
- `.gitignore` (ignores `.next-step58/`)
- `docs/reviews/step-58/`

Do not stage `Prompts/`, `docs/operations/production-readiness-gates.md`, or the Step 53–54 review files with this work. They were already dirty and are unrelated.

## Focused checks

| Command | Result |
|---|---|
| `npm run test -w @infraos/api -- tests/projects-milestones.test.ts` | PASS. 1 file, 4 tests. |
| `npm run test -w @infraos/web -- src/lib/projects/milestone-form.test.ts src/lib/projects/messages.test.ts` | PASS. 2 files, 3 tests. |
| `git diff --check` | PASS, no whitespace errors. |

## Section B — full gates, run once after implementation

| Command | Result |
|---|---|
| `npm run test:api` | PASS. 32 files, 311 tests. Includes Step 57 review tests and the Step 58 adversarial case. |
| `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=0` `NEXT_PUBLIC_AUTH_FIXTURE=0` `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000` `npm run test:web` | PASS. 39 files, 174 tests. Rerun after the denial-message fix also passed 174. |
| `npm run type-check` | PASS after exporting `MilestoneStatus` and removing an unreachable comparison. |
| `npm run lint` | PASS with the two existing web warnings in `data-table.tsx` (`useReactTable`) and `project-create-form.tsx` (`form.watch`). 0 errors. |
| `npm run build` | PASS. Web route `/projects/[id]/milestones` is present. API `tsc -p tsconfig.build.json` succeeded. |

The first lint invocation failed because it scanned `.next-step58` (384 errors). That output is now ignored. The rerun above is the one to use.

No live Atlas connection. `apps/web/.env.local` and `apps/api/.env` were not edited. The public landing was not edited.

## Browser evidence

Disposable in-process Mongo only. API `http://localhost:4011`. Web `http://localhost:3001` with `NEXT_PUBLIC_API_BASE_URL=http://localhost:4011` and `INFRAOS_NEXT_DIST_DIR=.next-step58`. Those listeners were stopped after the walkthrough. Ports 3000 and 4010 were still listening afterward. Port 4000 was not listening at the check. Nothing on 3000, 4000, or 4010 was stopped.

Synthetic project `INF-ROAD-5801`, id `6ae23c71932ff3e39472db8f`, status `APPROVED`, agency `DEPT_WEST`. Assigned actor `step58-manager@example.com` (`PROJECT_MANAGER`). Outsider `step58-foreign@example.com` (`GOV_ADMIN` on `MIN_WATER`). The fixture password is `DEMO_PASSWORD` in `apps/api/src/scripts/step58-isolated-dev.ts`. It is not copied here.

| Action | HTTP |
|---|---|
| Manager create, two POSTs | 201, 201 |
| Manager list | 200 |
| PATCH milestone `6ae23ce6932ff3e39472dc0a` | 200, then a second tab with the old revision returned 409 |
| POST transition on `6ae23ce0932ff3e39472dbed` (`NOT_STARTED` to `IN_PROGRESS`, then `IN_PROGRESS` to `COMPLETED`) | 200, 200 |
| Anonymous GET milestones | 401 |
| Foreign GET project and GET/POST milestones | 404, 404, 404. Response bodies did not contain the milestone titles. |
| Manager GET project after completion | 200. `status` `APPROVED`, `physicalProgress` 0. |

The first two creates were the same title because the demo submitted the form twice. The second record was then edited in the UI to **Drainage works B**. **Bridge deck A** ended `COMPLETED`, progress 100, actual start and end `2026-10-28`. The parent overview still showed `APPROVED` and recorded progress `0%`. An end date before the start showed: "Check the title and planned dates. The end date cannot be before the start." The second browser tab showed: "This milestone changed. Reload it before trying again." After sign-out, the foreign account opened the milestones URL and saw "This project is outside your scope, or it does not exist." The page text did not include the milestone titles.

Screenshots:

- `docs/reviews/step-58/evidence/step58-desktop-completed.png`
- `docs/reviews/step-58/evidence/step58-invalid-dates.png`
- `docs/reviews/step-58/evidence/step58-stale-revision.png`
- `docs/reviews/step-58/evidence/step58-parent-still-approved.png`
- `docs/reviews/step-58/evidence/step58-outsider-denied.png`
- `docs/reviews/step-58/evidence/step58-mobile-390.png`

Viewport notes: 390px was captured. At 320px the date input stayed inside the form (`innerWidth` 320, no overflow). Separate captures at 768, 1024, 1440, and 1920 were **NOT RUN**. A dedicated keyboard-focus screenshot was **NOT RUN**. The staff focus treatment `#b63d00` is the existing rule in `auth-access.css`. Two-tab 409 was run, not only the API suite.

To repeat: do not stop 3000, 4000, or 4010. From `apps/api`, set `PORT=4011` and `FRONTEND_ORIGIN=http://localhost:3001`, then run `npx tsx src/scripts/step58-isolated-dev.ts`. From `apps/web`, set `NEXT_PUBLIC_API_BASE_URL=http://localhost:4011`, `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=1`, and `INFRAOS_NEXT_DIST_DIR=.next-step58`, then run `npx next dev --webpack -p 3001`. Use `localhost`. The printed project id changes every seed. Sign in as the manager, open the overview, and use the Milestones link. Next may rewrite `apps/web/tsconfig.json`; restore that file with `git checkout -- apps/web/tsconfig.json` after stopping that Next process.

## Production blockers, unchanged

- Atlas indexes are not applied from this step. No live index build or migration was run.
- Step 51 hierarchy and grant-snapshot races remain release blockers. A milestone transaction does not repair them.
- Invitation email delivery is not implemented here.
- Null-agency Super Admin handling is unchanged.
- Sinhala and Tamil copy is draft. Native review is pending.
- Staging cookie and origin settings are unchanged.
- Branch protection is unchanged.
- Production login stays opt-in. This step did not enable it.

No new Step 58 production blocker beyond the deferred weight and hard-delete decisions, which are intentional.

## Step 59 handoff

Physical-progress submission and project financial progress were **not** implemented. Do not treat milestone `progress` as `Project.physicalProgress`. Do not start Step 59 from this record.

## Git

Worktree: `C:\Users\ASUS\Desktop\InfraOS\InfraOS` only.

Branch: `feature/production-readiness-phase-1` at `dabeede1845d019ff69f575c8961c1a318113115`, tracking `origin/feature/production-readiness-phase-1`.

`origin/development`: `596e50648de5e6fad212c5601ff53b6952fa7dad`.

`origin/main`: `9ca89e9825e7396e0564423923c257ceccd49bd2`.

No branch switch, stage, commit, push, or PR was made. G1 was not executed. The worktree has unrelated dirty files, so switching onto `origin/development` is not safe without the owner resolving those files first. Do not stash, reset, or clean.

| Checkpoint | Proposed operation | Status |
|---|---|---|
| G1 | `git switch -c feature/projecttrace-milestones origin/development` | Not run. Dirty tracked files make checkout unsafe. |
| G2 | `git add` of the Step 58 paths listed above only | Not run. Never `git add .`. |
| G3 | `git commit -m "feat(projecttrace): add scoped milestone management"` | Not run. |
| G4 | `git push -u origin feature/projecttrace-milestones` | Not run. |
| G5 | PR into `development` | Not run. |
| G6 | Merge | Not run. |
