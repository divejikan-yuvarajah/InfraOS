# Step 51 end-of-phase verification

**SAME-AGENT REVIEW — NOT independent human signoff.**

Sri Lankan GovTech demonstration. Not an official live government service. This session implemented Step 51 and then reviewed it. Fixture tests do not prove Atlas or production index safety, and they do not prove a live staff sign-in.

## Sources and roadmap title

Read-only `Prompts/Steps.docx` title: **Step 51 — ProjectTrace Database + API Foundation**.

The enhanced prompt is `Prompts/INFRAOS_Steps_51_Enhanced_Development_Prompt.md`. The next roadmap title, copied from `Steps.docx`, is **Step 52 — Create Infrastructure Project Workflow**. Step 52 was not started.

`REJECTED` is absent from `PROJECT_STATUSES` and was not added. `Project.submittedBy` is absent. `Contractor.userId` is absent. None of these were treated as fixed.

## Git

| Item | Result |
|---|---|
| Branch | `feature/projecttrace-foundation` |
| HEAD | `f43afbbde8e2de2d7e45d7d25aa131a7243f2c52` (no Step 51 commit) |
| Worktree | `C:\Users\ASUS\Desktop\InfraOS\InfraOS` only |
| `git diff --check` | exit 0 (tracked edits only) |
| Commit / push / PR / merge | not run |

Tracked edits: `apps/api/src/routes/v1.ts`, `apps/web/src/components/auth/staff-workspace-shell.tsx`, `apps/web/src/lib/auth/route-access.test.ts` (7 insertions).

Untracked implementation and review, not staged:

- `apps/api/src/modules/projects/projects.schema.ts`
- `apps/api/src/modules/projects/projects.service.ts`
- `apps/api/src/modules/projects/projects.routes.ts`
- `apps/api/src/modules/projects/projects.types.ts`
- `apps/api/tests/projects-foundation.test.ts`
- `apps/web/src/app/projects/`
- `apps/web/src/components/projects/`
- `apps/web/src/lib/projects/`
- `docs/reviews/step-51/`

Left untracked and excluded from any later commit: `Prompts/` (Steps 43–51 prompts and `Steps.docx`). No `.env`, screenshots, or lockfile changes. No new dependencies.

## Endpoint checklist

Mounted in `apps/api/src/routes/v1.ts` under `/api/v1/projects`. Each route uses `requireAuthenticated`, then live `requirePermission`. Responses send `Cache-Control: no-store`.

| Method | Path | Permission | Result |
|---|---|---|---|
| GET | `/api/v1/projects` | `project.read` | PASS in disposable Mongo |
| GET | `/api/v1/projects/:id` | `project.read` | PASS |
| POST | `/api/v1/projects` | `project.create` | PASS, creates DRAFT only |
| PATCH | `/api/v1/projects/:id` | `project.update` | PASS, DRAFT fields only |

There is no submit, review, approve, reject, or status-transition route.

## Field contract

Reuses `apps/api/src/modules/projects/models/project.model.ts`. `projectCode` stays unique and matches `/^INF-[A-Z_]+-[0-9]+$/`. Budget is `{ amountMinor, currency: "LKR" }` in minor units. Geometry goes through existing `validGeometry`. Dates and geometry may be omitted on create. The service rejects an inverted start and planned end.

The server sets `agencyId` from the actor, `createdBy` from the actor, `status: "DRAFT"`, and both progress fields to 0. `managerId` is the actor only when the role is `PROJECT_MANAGER`. Client `agencyId`, `status`, `managerId`, `contractorId`, and operator keys are rejected by strict Zod (400).

List DTO: id, code, title, type, status, agency id and code, manager id, dates, timestamps, revision. No budget, geometry, description, password hash, or raw Mongo document. Detail adds description, location, and geometry. Budget is added only when the live role also has `finance.budget.read`.

Scope is applied in Mongo for both `find` and `countDocuments`. Government Admin reads the active ministry subtree. Officer and Project Manager read their own agency. Project Manager writes require `managerId` equal to the actor. Inspector reads only inspections assigned to that inspector. Contractor and citizen private access returns 403 even though seed data includes `project.read`. Super Admin may list and read, including budget, and cannot create or patch even if `project.create` is written onto the role.

## Security and race evidence

Disposable replica set, `projects-foundation.test.ts` (4 tests), plus the full API suite:

| Threat | Status | Evidence |
|---|---|---|
| Missing bearer | PASS | GET list 401 |
| Expired or replaced JWT on this route | PASS via shared middleware | `auth-jwt` and `auth-me` passed in the full suite; no separate expired token was minted against `/projects` |
| Live `project.read` removed | PASS | later GET 403 |
| Body or query agency, role, status, manager | PASS | strict body 400; unknown query key 400; other-ministry list total 0 and id 404 |
| Duplicate `projectCode` | PASS | one 201, one 409, count 1, memory-server unique index `projectCode_1` |
| Same DRAFT revision | PASS | one 200, one 409 |
| Non-DRAFT write | PASS | stored `ACTIVE` patch returns 409 and the title stays unchanged. `SUBMITTED`, `COMPLETED`, and `CANCELLED` use the same `status !== "DRAFT"` branch and were not each seeded |
| Malformed id | PASS | 400 |
| Unknown or out-of-scope id | PASS | 404 |
| Invalid code, dates, budget, geometry | PASS | negative minor units, inverted dates, and an unclosed polygon return 400 |
| Content-Type `text/plain` | PASS | 415 |
| Database read failure | PASS | mocked `Project.find` rejection returns 503 |
| Audit failure | PASS | `beforeAudit` throw returns 503 and the title is not written |
| Super Admin forged `project.create` | PASS | 403 |
| Hierarchy reparent or deactivate during create | BLOCKED | create and patch take `AGENCY_HIERARCHY_LOCK` and recheck an ACTIVE agency. No test races a Step 49 reparent against a project write |
| Permission change after the project transaction snapshot starts | BLOCKED | role edits use `USER_LIFECYCLE_LOCK`, not the hierarchy lock. A grant already removed before the request returns 403. A commit that lands after the transaction snapshot is not separately proven |

Audit snapshots store status, agency, and create-time budget. They cannot store title, description, or geometry. That limit was not widened.

No `syncIndexes`, `createIndexes`, schema migration, demo seed, or `dev:api` was run. No Atlas index was created by this review.

## Commands

Historical Step 50 counts stay **287 API / 141 web**. They are not the Step 51 counts.

| Command | Exit | Result |
|---|---|---|
| `npm run test:api` first pass | 1 | 29 files, 291 tests, **289 passed / 2 failed**. Failures: `email-verification.service.test.ts` “sends one message when two requests race” (length 2); `admin-users.test.ts` audit rollback expected 503 and received 401. `projects-foundation` passed. These files were not changed by Step 51 |
| Focused rerun of those two files plus `projects-foundation.test.ts` | 0 | 3 files, 22 tests |
| `npm run test:api` second pass, after the other-ministry list assertion | 0 | 29 files, **291 passed** |
| `npm run test:web` | 0 | 32 files, **142 passed** |
| `npm run type-check` | 0 | web and API |
| `npm run lint` | 0 | 0 errors, 1 existing warning: `apps/web/src/components/data-table/data-table.tsx:110` `useReactTable` / `react-hooks/incompatible-library` |
| `npm run build` | 0 | `/projects` and `/projects/[id]/overview` are dynamic routes. Existing middleware deprecation warning only |
| `git diff --check` | 0 | tracked diff only |
| `git status --short` | 0 | branch and inventory above |

The second API pass is the suite that contains the other-ministry total assertion. The first pass is not relabeled as a pass.

## Browser versus fixture

Signed-in `/projects` against a live API: **NOT RUN**. `apps/api/.env` points at Atlas. `dev:api` was not started. A production `next start -p 3010` cannot log a staff user in, because production auth availability is the preview gate.

Signed-out production preview on `http://127.0.0.1:3010` (process stopped afterward): **privacy proof only**.

| Route | Hydrated result |
|---|---|
| `/projects` | “Sign-in is not live in this build” / “No private records are shown.” No `INF-ROAD`, `passwordHash`, `amountMinor`, or `SUPER_ADMIN`. `localStorage` empty. Widths 320 and 1440 had no horizontal overflow |
| `/dashboard`, `/profile`, `/settings`, `/admin/users`, `/admin/agencies`, `/admin/roles` | same preview gate, no private records |
| `/` | public English landing |
| `/si` | public Sinhala landing |
| `/ta` | public Tamil landing |
| `/login` | sign-in form, not a project list |

Widths 360, 390, 768, and 1024 were **NOT RUN**. Keyboard traversal of the project table, EN/SI/TA list copy, filtering, pagination, logout, and back-button cache were **NOT RUN** because the preview never mounts that UI. `messages.test.ts` covers the draft strings only.

## Defects fixed in this review

No product defect was changed in the review pass. The review added assertions to `projects-foundation.test.ts` for content type 415, an ACTIVE draft lock, an injected query key, a negative budget, a removed `project.read` grant, and an other-ministry list total of 0.

Implementation-time fixes already in the uncommitted code, and rechecked here: officer versus Project Manager edit direction, project and inspection cleanup between tests, and a fresh session when a duplicate-key race aborts.

## Carry-forward blockers

These remain open. Step 51 does not close them.

- Step 50 invitation email: **BLOCKED**
- Null-agency Super Admin sign-in: **BLOCKED**
- Step 50 signed-in admin browser: **NOT RUN**
- Atlas and production indexes and deployment auth policy: **not approved**
- `REJECTED` is not a project status
- `Project.submittedBy` does not exist
- `Contractor.userId` does not exist
- Dedicated hierarchy and cross-lock permission races: **BLOCKED** as noted above

## Index proposal (not executed)

The Project schema already declares these indexes. Do not run `syncIndexes` or `createIndexes` against Atlas until a separate owner approves the production database change:

- unique `projectCode`
- `{ agencyId: 1, status: 1, plannedEndDate: 1 }`
- `{ status: 1, plannedEndDate: 1 }`
- `{ managerId: 1, status: 1 }`
- `{ contractorId: 1, status: 1 }`
- `{ projectType: 1, status: 1 }`
- `{ geometry: "2dsphere" }`

Test runs can build them on the disposable memory replica set because non-production Mongoose auto-index is on. That is not production index approval.

## Owner manual demo

Use a disposable Mongo replica set and synthetic approved staff. Do not point this demo at Atlas.

1. Sign in as an Agency Officer with an active agency and `project.create` / `project.read` / `project.update`.
2. POST a DRAFT with a new `INF-…` code, LKR minor budget, and no client agency or status. Expect 201, the officer’s agency, and `managerId` null.
3. GET the list and the detail. Expect the row in the list and budget on the detail only if `finance.budget.read` is present.
4. Repeat the GET as a Government Admin of another ministry. Expect an empty list and 404 for the id.
5. PATCH the title with the returned revision. Expect 200. Repeat the same revision. Expect 409.
6. POST the same code again. Expect 409.
7. As Super Admin, GET may succeed and POST must return 403.
8. Sign out, go back, and confirm the private page no longer shows the project.

## Criterion rollup

| Criterion | Status |
|---|---|
| Schema reuse, unique code, LKR minor budget, GeoJSON, DRAFT-only optional geometry and dates | PASS |
| Mounted GET list, GET detail, POST DRAFT, PATCH DRAFT behind auth then live permission | PASS |
| Mongo scope for list and total, exact id check, PM ownership, ministry subtree, inspector assignment | PASS |
| Contractor and citizen private deny; Super Admin operational write deny | PASS |
| DTO hides private budget unless authorized; no raw documents, passwords, or other-user fields | PASS |
| No status transition or approval path | PASS |
| Disposable concurrency, 401, 403, 400, 404, 409, 415, 503, audit rollback | PASS |
| Hierarchy and cross-lock permission races | BLOCKED |
| Full phase commands after the assertion update | PASS |
| First API pass before that rerun | FAIL, then the same two pre-existing tests passed in isolation and in the second full pass |
| Signed-in browser and live API E2E | NOT RUN |
| Signed-out production preview privacy | PASS as privacy proof only |
| Atlas index and production auth approval | BLOCKED |
| Step 50 email, null-agency Super Admin, signed-in admin | BLOCKED / NOT RUN, unchanged |

## Recommendation

**BLOCKED**

The isolated API foundation and the signed-out preview match Step 51. This is not independent human acceptance, and production read or write cannot be approved until the indexes and deployment auth policy are approved separately. Signed-in project UX was not exercised.

## Git stop

Nothing was staged, committed, pushed, or merged. Proposed commands are owner-controlled and separate. Do not stage `Prompts/`, `Steps.docx`, `.env`, secrets, or screenshots. Do not create another worktree.

```powershell
git status --short
git diff
git add -- apps/api/src/routes/v1.ts apps/api/src/modules/projects/projects.schema.ts apps/api/src/modules/projects/projects.service.ts apps/api/src/modules/projects/projects.routes.ts apps/api/src/modules/projects/projects.types.ts apps/api/tests/projects-foundation.test.ts apps/web/src/app/projects apps/web/src/components/projects apps/web/src/lib/projects apps/web/src/components/auth/staff-workspace-shell.tsx apps/web/src/lib/auth/route-access.test.ts docs/reviews/step-51
git diff --cached --check
git commit -m "feat(projecttrace): establish scoped project database and API foundation"
git push -u origin feature/projecttrace-foundation
```

Commit, push, the pull request from `feature/projecttrace-foundation` into `development`, the merge, and any later `development` to `main` promotion each need their own approval.

**STOP. Step 52 was not started.**
