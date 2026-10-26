# Steps 53–54 end-of-phase verification

**SAME-AGENT REVIEW — NOT INDEPENDENT HUMAN SIGNOFF.**

This session implemented Steps 53 and 54 and then reviewed them. Fixture tests and a disposable Mongo replica do not prove Atlas index safety or a live staff sign-in. Nothing here is human acceptance.

Sri Lankan GovTech demonstration. Not an official live government service.

## Roadmap proof

Read-only `Prompts/Steps.docx`:

- **Step 53 — Projects Listing Page.** Sub-line: “Search, filters, statuses, agencies, pagination and sorting.”
- **Step 54 — Project Details & Overview Page.** The docx has that title and no further Step 54 bullets.

`Prompts/INFRAOS_Steps_53_54_Enhanced_Development_Prompt.md` is not in this checkout. The review used the docx titles, `docs/ux/project-detail-architecture.md`, the Step 51 and Step 52 reports, the permission and scope code, and the tracked and untracked diff.

Step 55 **Edit Project & Validation** was not started. No Edit, Submit, or Approve control was added.

## Git

| Item | Value |
|---|---|
| Worktree | `C:\Users\ASUS\Desktop\InfraOS\InfraOS` only |
| Branch | `development` |
| HEAD | `2b0507bf0c500f7e1904523a853d0435d8b92ae7` |
| Upstream | `origin/development` at the same commit |
| Divergence | none. The short status is `## development...origin/development` |
| This review | no stage, commit, push, PR, merge, checkout, or Atlas write |

`git diff --stat` for tracked edits: 17 files, 669 insertions, 72 deletions. `git diff --check` exit 0. That check does not scan untracked files.

### Tracked modifications

- `apps/api/src/modules/projects/projects.routes.ts`
- `apps/api/src/modules/projects/projects.schema.ts`
- `apps/api/src/modules/projects/projects.service.ts`
- `apps/api/src/modules/projects/projects.types.ts`
- `apps/api/tests/projects-foundation.test.ts`
- `apps/web/src/app/projects/page.tsx`
- `apps/web/src/app/projects/[id]/overview/page.tsx`
- `apps/web/src/components/projects/projects-page-client.tsx`
- `apps/web/src/components/projects/project-overview-client.tsx`
- `apps/web/src/components/projects/project-create-page-client.tsx`
- `apps/web/src/lib/projects/api.ts`
- `apps/web/src/lib/projects/messages.ts`
- `apps/web/src/lib/projects/types.ts`
- `apps/web/src/lib/projects/create-transform.ts`
- `apps/web/src/lib/projects/create-transform.test.ts`
- `apps/web/src/lib/auth/state.ts`
- `apps/web/src/styles/auth-access.css`

### Untracked, inspected directly

- `apps/web/src/lib/projects/list-query.ts`
- `apps/web/src/lib/projects/list-query.test.ts`
- `apps/web/src/lib/projects/overview-format.ts`
- `apps/web/src/lib/projects/overview-format.test.ts`
- `docs/reviews/step-53/IMPLEMENTATION-STATUS.md`
- `docs/reviews/step-54/IMPLEMENTATION-STATUS.md`
- this file

Public `/`, `/si`, and `/ta` source files are not in the diff.

## Step 52 gate

**Present. Not silently rebuilt.**

HEAD contains `apps/web/src/app/projects/new/page.tsx` and `POST /api/v1/projects`. The production build lists `/projects/new`. The Step 52 report at `docs/reviews/step-52/END-OF-STEP-VERIFICATION.md` remains **BLOCKED** for release because indexes, deployment auth, and a signed-in disposable-database demo were not approved. This phase did not treat that as fixed. Create still posts once, `retry: false`, and discards the result when the auth epoch or token changed.

## Commands

Historical Step 51 full-suite figures were 291 API tests and 142 web tests. Step 52 was 292 API and 154 web. Those are not this run.

| Command | Exit | Result |
|---|---|---|
| `npm run test:api` | 0 | 29 files, **294 passed**. Run before the web-only review fixes. API source was not changed afterward, so this pass still stands |
| `npm run test:web` first, before the review fixes | 0 | 36 files, 160 passed |
| `npm run test:web` after the cache and enum fixes | 0 | 36 files, **161 passed** |
| `npm run type-check` after those fixes | 0 | web `next typegen && tsc --noEmit`, then API `tsc --noEmit` |
| `npm run lint` after those fixes | 0 | 2 warnings, 0 errors. Both are the existing `react-hooks/incompatible-library` notes: `useReactTable` in `data-table.tsx` and `useForm().watch` in `project-create-form.tsx` |
| `npm run build` first | 1 | Turbopack could not resolve `./primitives.js` and the other `.js` specifiers inside `@infraos/shared-types` because the list and overview clients imported that barrel. See defects |
| `npm run build` after the client stopped importing that barrel | 0 | Web routes include `/projects`, `/projects/new`, and `/projects/[id]/overview`. API `tsc -p tsconfig.build.json` then succeeded |
| `git diff --check` | 0 | tracked diff only |
| `git status --short --branch` | 0 | `## development...origin/development` plus the dirty tree above |

No test was disabled. No failure was waived.

## Step 53 acceptance

| Criterion | Status | Evidence |
|---|---|---|
| Search, status, type, scoped agency, page, limit, allowlisted sort | PASS | Disposable Mongo list test: page size 1, `projectCode` ascending, Unicode `ජල`, status `ACTIVE` empty, `$where` / `$gt` / repeated `sortBy` return 400 |
| Old list defaults | PASS | Omitted `limit` still defaults to 20 in the schema. The UI sends 10 or 20 only. Unknown keys and arrays stay 400 |
| Stable Mongo sort | PASS for the allowlist | Sort is `{ [allowlisted field]: 1 or -1, _id: 1 }`. Equal-key tie pages were not given a separate fixture |
| Ministry, own agency, inspector, super-admin read, contractor and citizen deny | PASS | Existing foundation cases plus the list test. Contractor list is 403 |
| Out-of-scope `agencyId` | PASS | 200, total 0, empty `projects`, and the other project code is absent. It does not become a 404 that confirms existence |
| Agency picker | PASS | `agencies` comes from `distinct` on the scoped filter without the extra `agencyId` clause. It is not a global directory |
| Deactivate and reparent on a later request | PASS | Inactive child is hidden from the ministry admin. Reparent moves the row to the new ministry admin |
| Removed live `project.read` | PASS | A later list or detail request is 403 |
| List DTO | PASS | Summary fields only. The page test asserts `amountMinor` is absent. Description, geometry, and budget are not copied into the summary |
| UI sort is the server sort | PASS by code | `DataTable` `mode="server"` sets `manualSorting` and does not use `getSortedRowModel`. `aria-sort` follows that server sort state. Page sizes are 10 and 20. `total` is the server count |
| Signed-in browser search, back, and forward | NOT RUN | Production preview cannot sign in |

## Step 54 acceptance

| Criterion | Status | Evidence |
|---|---|---|
| One detail route | PASS | Existing `GET /api/v1/projects/:id`. No second route |
| Header and overview fields from the live DTO | PASS | Disposable test: code, description, UTC `2026-10-26T00:00:00.000Z`, Point geometry, `physicalProgress` 12, `actualEndDate` null, manager name `Nimal Perera` only for the project agency |
| Budget only with live `finance.budget.read` | PASS | Present for the project manager. Absent after that permission is pulled from the officer, and absent for the inspector. The client renders the card only when `budget` is on the object. No zero fallback |
| Contractor label | PASS as omission | `Contractor.userId` does not exist. No contractor lookup was added |
| `financialProgress` | PASS as omission | The response test asserts the field name is absent. The overview calls physical progress a recorded number, not an inspection or a finance report |
| 400 malformed id | PASS | `not-an-id` returns 400 |
| 403 contractor and revoked `project.read` | PASS | Detail cases |
| 404 unknown or out of scope | PASS | Other ministry and an inspector without an assignment both get 404. The body does not contain the project code |
| 503 Mongo failure | PASS | `Project.findOne` rejection returns 503 |
| 401 invalid or expired on detail | NOT separately executed | The list route without a bearer is 401 in the foundation test. Detail uses the same `requireAuthenticated` middleware. An expired detail token was not a dedicated case |
| No dead tabs or future actions | PASS | Overview only. No timeline, milestone, document, finance, inspection, risk, edit, submit, or approve links |
| Cache separation | PASS after the review fix | Keys include epoch, user id, and role. A different user id clears the private query cache in `setAuthenticated`. Logout already cleared it |
| Signed-in overview, keyboard, zoom, and widths | NOT RUN | See browser |

## Permission matrix actually enforced

| Actor | List and detail |
|---|---|
| No token | 401 before the handler |
| Government Admin | Active ministry subtree. Inactive child and a reparented child disappear on the next request |
| Agency Officer | Own agency read. Create remains the Step 52 path |
| Project Manager | Own-agency read. Writes still require `managerId` to be that manager |
| Inspector | Projects linked from that inspector’s inspections only. A known id without an assignment is 404 |
| Super Admin | Read, including budget when `finance.budget.read` is live. Operational create stays denied |
| Contractor, Citizen | 403 even if the seeded role contains `project.read` |
| Anyone | Budget on the detail DTO only when the live role still has `finance.budget.read` and the document has a budget |

`no-store` is set on the project router. The client keeps the bearer in memory. List and detail queries use `retry: false`. Create stays a single POST.

## Concurrency and what was not solved

Disposable Mongo covered duplicate create, revision conflict, audit rollback to 503, a list `find` failure, and a detail `findOne` failure. Offset paging can still move when a row is inserted above the current page. The `_id` tie-break makes equal sort keys deterministic; it does not freeze a page against later inserts. A failing agency lookup becomes 503 through the same catch. A grant removed before the next request is visible. A permission change after a write transaction has already snapshotted, and a reparent racing a create, stay the Step 51 **BLOCKED** items. They were not re-proven and were not claimed fixed.

No Atlas connection was opened. `syncIndexes`, `createIndexes`, and demo seed were not run. `apps/api/.env` was not printed.

## Defects found and fixed in this review

1. **Account-switch cache.** The list key was only the role, and the overview key was only the auth epoch. Login does not bump the epoch, and queries stay fresh for 30 seconds. Two officers could see the previous list. Keys now include epoch, user id, and role. `setAuthenticated` clears the private cache when the user id changes. Logout still clears it. Web tests were rerun: 161 passed.
2. **Production build.** Client value imports of `@infraos/shared-types` made Turbopack load `src/index.ts`, whose `.js` specifiers do not resolve. The first `npm run build` exited 1. The web lists now live in `list-query.ts`, and `list-query.test.ts` asserts they equal the shared-types arrays. The rerun build exited 0.
3. **Filter form name.** The list form was named “Clear filters”. It is now named with the page title.

No role ceiling, status, or landing page was changed to make a test pass. `REJECTED` is still not a project status.

## Browser

| Case | Result |
|---|---|
| Signed-in `/login`, `/dashboard`, `/projects`, `/projects/new`, overview, profile, admin, search, sort, filter, pagination, logout, account switch, 320/360/390/768/1024/1440, 200% zoom, keyboard, contrast, reduced motion | **NOT RUN / BLOCKED** |
| Why | `next start` sets `NODE_ENV=production`, and `getAuthAvailability()` then returns `preview`. Signing in would require overriding that policy or starting the API against the configured database. Neither was done |
| Preview privacy, real browser and HTTP | **PASS as privacy only.** `next start -p 3010` was stopped afterward (process exit 1 is that stop) |
| `/projects` | Heading “Sign-in is not live in this build”. Status text says no private records are shown |
| `/projects/507f1f77bcf86cd799439011/overview` | Same gate. The ObjectId did not reveal a project |
| `/`, `/si`, `/ta` | 200. Public landing headings render, including English, සිංහල, and தமிழ் language labels on `/`. `noindex` is false, as before |
| `/login`, `/projects`, `/projects/new`, the overview URL, `/profile` | 200, `noindex` true. HTML did not contain `INF-ROAD`, `amountMinor`, `passwordHash`, `financialProgress`, or `managerName` |

This privacy pass is not signed-in UX.

## Residual blockers

- Atlas indexes are not approved. No index was created.
- Signed-in staff browser demo: **NOT RUN**.
- Step 51 hierarchy reparent during create, and a grant change after the transaction snapshot: **BLOCKED**.
- Step 50 invitation email: **BLOCKED**.
- Null-agency Super Admin login: **BLOCKED**.
- Step 50 frozen grant ceilings were not expanded.
- Sinhala and Tamil project copy is still marked pending native review.
- Detail 401 for an expired token was not a dedicated projects test.
- Equal sort-key page ties and insert-during-pagination drift were not given their own fixtures.

## Manual synthetic demo

Use a disposable API and synthetic verified staff only. Do not point this at Atlas.

1. Sign in as an Agency Officer. Open `/projects`. Confirm the total matches the API `total`, not the number of rows on the page.
2. Search a code, filter status and type, choose only an agency the response listed, sort by code, and move to page 2 at 10 and 20 rows. Browser Back should restore the list URL.
3. Open a code. The overview should show that record’s title, status text, dates as the UTC calendar day, and “Not provided” where description, geometry, or manager name is absent.
4. Repeat as a role without `finance.budget.read`. The budget card should be absent, not “LKR 0.00”.
5. Open another ministry’s project id. Expect the not-found state, not the other project’s title.
6. Sign out and sign in as a different officer. The previous officer’s rows should not remain on screen.

## Recommendation

**BLOCKED**

The isolated list and overview behavior matches Steps 53 and 54, and the phase commands passed after the two review fixes. Production use stays blocked until indexes, deployment auth, and a signed-in disposable-database demo are approved separately. This same-agent review is not human acceptance.

## Git proposals only

Do not run these until a separate explicit approval. Do not use `git add .`. Do not add `Prompts/`, `Steps.docx`, `.env`, secrets, or screenshots.

```text
git add -- apps/api/src/modules/projects/projects.routes.ts apps/api/src/modules/projects/projects.schema.ts apps/api/src/modules/projects/projects.service.ts apps/api/src/modules/projects/projects.types.ts apps/api/tests/projects-foundation.test.ts apps/web/src/app/projects/page.tsx apps/web/src/app/projects/[id]/overview/page.tsx apps/web/src/components/projects/projects-page-client.tsx apps/web/src/components/projects/project-overview-client.tsx apps/web/src/components/projects/project-create-page-client.tsx apps/web/src/lib/projects/api.ts apps/web/src/lib/projects/messages.ts apps/web/src/lib/projects/types.ts apps/web/src/lib/projects/create-transform.ts apps/web/src/lib/projects/create-transform.test.ts apps/web/src/lib/projects/list-query.ts apps/web/src/lib/projects/list-query.test.ts apps/web/src/lib/projects/overview-format.ts apps/web/src/lib/projects/overview-format.test.ts apps/web/src/lib/auth/state.ts apps/web/src/styles/auth-access.css docs/reviews/step-53/IMPLEMENTATION-STATUS.md docs/reviews/step-54/IMPLEMENTATION-STATUS.md docs/reviews/steps-53-54/END-OF-PHASE-VERIFICATION.md
git diff --cached --check
git diff --cached --stat
git commit -m "feat(projecttrace): complete scoped project list and overview"
```

The work is on local `development`, which already matches `origin/development`. This review did not create a branch. Push needs its own approval, and it would publish `development` itself:

```text
git push -u origin development
```

A pull request from `development` into `development` is not a valid next step. A PR needs an owner-approved feature branch first. Merge, and any later `development` to `main` release, each need another explicit approval. No Atlas schema, index, or seed write is proposed.

**STOP. Step 55 was not started.**
