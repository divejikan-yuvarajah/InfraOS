# Steps 45–46 phase verification

**SAME-AGENT REVIEW.** The same session wrote this code. This is not an independent human signoff.

Source snapshot: branch `feature/auth-authorization-foundation`, HEAD `08d1108` (same commit as `origin/development`). Steps 45 and 46 are uncommitted. The branch has no upstream. `git diff --check` against HEAD produced no whitespace errors because the new files are untracked. `git status --short` lists only those new files and the two untracked prompt files. No `.env` file is in the change set.

`/api/v1` still mounts health, ready, email verification, and auth only. Permission and scope apps live under `apps/api/tests/helpers/` and are not imported by `apps/api/src/app.ts`.

## Step 45 criteria

| Criterion | Result |
| --- | --- |
| `requireAuthenticated`, then `requirePermission`, on the test harness | PASS |
| Grant is the current `Role.permissions` row, not the JWT, body, or seed fallback | PASS |
| Exact catalog code. Stored `["*"]` does not grant `project.read` | PASS |
| Missing or inactive actor is 401. Active role without the code is 403 `FORBIDDEN` | PASS |
| Role lookup failure is 503. Unknown required code does not call `next()` and returns 500 | PASS |
| Super Admin seed excludes approve, pay, verify, and conflict resolve | PASS |
| Not mounted on `/api/v1`. `/auth/me` is unchanged | PASS |

## Step 46 criteria

| Criterion | Result |
| --- | --- |
| Server predicate on list, count, aggregate, id read, and conditional update. No `{}` fallback | PASS |
| Caller `agencyId`, `userId`, role, permissions, and `$or` are not merged into the filter | PASS |
| 400 malformed id, 403 missing capability or Super Admin operation, 404 missing and out of scope share one body, 409 state or payment SoD, 503 dependency | PASS |
| Agency officer is one agency. Gov admin is that active agency plus active descendants. Cycle or missing parent denies the branch | PASS |
| Project manager reads the agency and writes only when `managerId` is themselves and status is `DRAFT` | PASS |
| Inspector reads only `inspectorId === actor`. Notification matches `userId` | PASS |
| Conflict: one verified party for an agency role; both parties inside the org for gov admin | PASS |
| Super Admin conflict read | PASS. Platform read of one conflict only when the stored role still has `roadsync.conflict.read`. Removing that grant returns 403. Resolve, approve, pay, and verify stay 403 |
| Contractor ownership | BLOCKED. `Contractor` has no `userId`. Email match stays 404 |
| Project submitter/approver SoD | BLOCKED. `Project` has `createdBy` and no `submittedBy`. Payment SoD uses `createdBy` and is tested |
| Production project, payment, map, audit, presigned download, or AI route | Not implemented. Helpers must be reused when those routes exist |

## Policy correction

Super Admin conflict read now follows the permission matrix: platform view, and no resolve. `readConflict` loads the current user and role. It returns the conflict by id only when that role is active `SUPER_ADMIN` and `roadsync.conflict.read` is an exact grant. A removed grant is 403. Agency, ministry, assignment, and fail-closed filters are unchanged. Contractor email matching and project submitter segregation were not added.

## Commands

This correction pass:

| Command | Exit | Count |
| --- | --- | --- |
| `npx vitest run tests/resource-scope.test.ts tests/permission-authorization.test.ts` | 0 | 2 files, 9 tests |
| `npm run test:api` | 0 | 24 files, 269 tests |
| `npm run test:web` | 0 | 26 files, 128 tests |
| `npm run type-check` | 0 | web and API |
| `npm run lint` | 0 | 1 existing web warning in `data-table.tsx` (`useReactTable`). API clean |
| `npm run build` | 0 | web 34 routes, API `tsc` |

`npm run test:api` includes the Step 39–44 auth files: session 10, logout 10, `/auth/me` 4, reset request 10, reset consume 8, JWT 2, rate limit 3. Scope tests are 3. Permission tests are 6.

No test was deleted or skipped. Review additions that passed in those runs: a body carrying `roleKey`, `agencyId`, and `permissions` does not widen a project list; an in-scope document response is exactly id, file name, visibility, and project id; two concurrent payment approvals finish as 200 and 409 with one `APPROVED` row.

## Security notes

No IDOR bypass was found in the helpers. The actor is loaded from Mongo after the bearer check. Scope functions trust that actor object; HTTP harness routes do not read it from the body. Filters go to Mongo. An unknown relationship is `{ _id: { $in: [] } }`.

Super Admin can read a project through `project.read` and can read one conflict through the stored `roadsync.conflict.read` grant. The same token cannot resolve, approve a project, approve a payment, or verify an inspection. Title update stays 403. A gov admin still misses a conflict when one party is outside the organization. A party agency officer can read it. An unrelated agency officer receives the same 404 as a missing id. Citizen-issue reads for Super Admin stay match-none. Coordination reads for Super Admin stay denied. Those are narrower than the seed and are not a bypass.

Document and payment checks load in-scope project ids and then query with `$in`. They do not filter a full tenant dump in JavaScript. A later route should keep that predicate in one aggregation when Super Admin platform reads grow.

There is no audit export, presigned download, or document-ask route. Those future calls must use the same project predicate and must not return `storageKey` or `storageUrl`.

Coordination and citizen-issue checks are direct service calls in the fixture. They are not HTTP routes.

## UI smoke

This correction pass did not repeat the browser. No web file changed. The earlier same-agent smoke still stands. That pass did not start `dev:api` and did not apply Atlas indexes.

| Check | Result |
| --- | --- |
| `/` English landing, skip link, `main`, h1 "Better infrastructure starts with connected plans." | PASS |
| `/` horizontal overflow at 320, 390, 768, 1024, 1440 | PASS (0) |
| `/si` Sinhala landing and skip link | PASS. At 320 the header overflows by 39px. Pre-existing public page. Not changed here |
| `/ta` Tamil landing | PASS. Overflow about 45px near 365px. Pre-existing |
| `/about` public supporting page | PASS |
| `/ta/forgot-password` still says the demo does not send live email | PASS |
| `/login` form present. Credentials were not submitted | PASS |
| `/dashboard` unsigned | Shows "Checking your session.", then "The workspace could not be checked" and Try again. Workspace shell stayed hidden. Live 401 redirect was NOT RUN. The already running API was not used as proof |
| 403 page and private-resource 404 page | NOT RUN. No such product route. Unit tests cover the error mapping |
| Signed-in logout and `/auth/me` 200 | NOT RUN. No approved Atlas login |
| Keyboard/ARIA | Skip link and named fields observed. Full keyboard traversal NOT RUN |
| Reduced motion | NOT RUN |

## Secret and index safety

Untracked Step 45–46 source was read, not only the git diff. No production URI, private key, or live token is in the authorization sources, harnesses, or tests. Fixture JWT secrets are local test strings. Atlas index migrations remain unapplied. `Steps.docx` was not in the repo.

## Owner demo

Do not point a new API process at Atlas.

1. Isolated API plus web: unsigned `/dashboard` stays on the check or retry screen, or goes to `/login` on 401. It must not show the workspace shell.
2. A disposable user can sign in only after `GET /api/v1/auth/me` returns 200.
3. Permission and scope behavior is the harness and `tests/resource-scope.test.ts`, not a public URL.
4. `/`, `/si`, and `/ta/forgot-password` stay public. Live email stays off.

## Acceptance

**APPROVE** the Step 45 and Step 46 foundation, including the Super Admin conflict-read correction.

Remaining blockers, not failures of this correction: contractor ownership stays blocked until a trusted account link exists; project submitter/approver segregation stays blocked until `submittedBy` exists; no production resource route is mounted; live Atlas login and index builds were not run. Do not treat this as Git permission.

## Step 47 handoff

Add real routes only as `requireAuthenticated`, then `requirePermission` with a catalog code, then these scope helpers. Keep health, login, refresh, logout, forgot, reset, verify-email, and `/auth/me` on their current rules. Do not add `Contractor.userId`, `Project.submittedBy`, or an organization id in that step unless the owner approves the model. Do not let Super Admin approve, pay, verify, or resolve. Do not start Atlas index builds. Presigned, audit, and AI reads stay closed until they call the same predicate.

## Proposed Git path

Not executed. Stage only:

- `apps/api/src/modules/identity/authorization/require-permission.ts`
- `apps/api/src/modules/identity/authorization/resource-scope.ts`
- `apps/api/tests/helpers/permission-harness.ts`
- `apps/api/tests/helpers/scope-harness.ts`
- `apps/api/tests/permission-authorization.test.ts`
- `apps/api/tests/resource-scope.test.ts`
- `docs/reviews/steps-45-46/END-OF-PHASE-VERIFICATION.md`

Leave both prompt files and every `.env` untracked.

Suggested commits, after a separate owner request:

1. `feat(auth): check the current role permission before a protected action`
2. `feat(auth): keep resource queries inside the caller's agency and assignment`

Then, only with further explicit approval: `git push -u origin feature/auth-authorization-foundation`, a PR into `development`, a reviewed merge, post-merge smoke, and a separate release approval before `development` moves to `main`. No force push.
