# Step 50 end-of-step verification

**SAME-AGENT REVIEW — NOT independent human signoff.**

Sri Lankan GovTech demonstration. Not an official live government service.

**Recommendation: BLOCKED** for release and merge. The Step 50 API and private page are implemented, two review defects were fixed, and the final automated commands passed. This review does not approve human sign-off. Signed-in browser administration is **NOT RUN**. Invitation email and null-agency Super Admin login stay **BLOCKED** from Steps 48–49.

HEAD `9d3ef4e` on `feature/identity-role-permission-admin`, matching `development` / `origin/development` (PR #83). `Steps.docx` (read-only) titles this step **Step 50 — Role & Permission Administration** and the next item **Step 51 — ProjectTrace Database + API Foundation**. Step 51 was not started. No commit, push, PR, branch, worktree, `.env`, or Atlas change was made.

## Status

| Area | Status |
|---|---|
| Seven-role read, Gov Admin read-only, other roles denied even with injected grants | **PASS** (isolated API) |
| Metadata and grant writes, ceiling, frozen contested grants, revision 200+409, audit rollback, no epoch bump | **PASS** (isolated API) |
| Transaction start failure returns 503 and does not change the role | **PASS** after the fix below |
| Steps 39–49 auth, session, reset, profile, user, agency, permission, and scope tests inside `npm run test:api` | **PASS** |
| Signed-out `/admin/roles` shows no role rows, grants, tokens, or account data | **PASS** (production preview gate) |
| Signed-in Super Admin / Gov Admin / officer browser administration | **NOT RUN** |
| Editor keyboard, 320–1440 layout, reduced motion, and EN/SI/TA in the live editor | **NOT RUN** |
| Invitation email | **BLOCKED** |
| Null-agency Super Admin sign-in | **BLOCKED** |
| Atlas indexes | not created |

## Fixes in this review

1. The grant form treated an untouched checkbox list as an empty array, so Save could send `permissions: []` and wipe a role. The visible set now stays on the saved grants until that role is explicitly edited. Covered by `visibleRoleGrants` in the web unit test.
2. `mongoose.startSession()` sat outside the mutation `try`. A failed session start became HTTP 500. It is now inside the `try` and returns 503 with no role write. The first full API run failed this new assertion (`500`). The rerun passed.

## Policy and discrepancy register

Ceiling = that role’s `SYSTEM_ROLE_PERMISSIONS` minus the blocked set. Frozen grants cannot be added or removed. Seeds and locked docs were not edited.

| Item | Treatment | Status |
|---|---|---|
| Gov Admin `agency.manage` is in the seed. Step 49 writes are Super Admin only. | Frozen. Not purged and not newly grantable. | **BLOCKED** owner decision |
| Super Admin `citizen_issue.assign` / `update` / `close` are operational seed writes. The matrix row is “Platform”. | Frozen. Not purged. | Owner decision pending. Not broadened. |
| Super Admin `project.approve`, payment approve/reject, inspection verify/reject, conflict resolve | Rejected with 409. Not in the safe ceiling. | **PASS** |
| Contractor `role.manage`, `finance.payment.approve`, `inspection.verify` | Rejected with 409. | **PASS** |
| `role.manage` and `permission.manage` on operational roles | Rejected. Only Super Admin can hold them through this API. | **PASS** |
| Other Super Admin seed writes that the matrix marks Platform (users, agencies, documents, assets, maintenance, audit) | Still inside the editable ceiling. Not treated as new grants. | Recorded. Not silently expanded. |

Actor denial is 403. Ceiling, frozen, revision, and last-governance conflicts are 409. Unknown, duplicate, wildcard, and extra JSON fields are 400.

Mutations take `USER_LIFECYCLE_LOCK` inside a replica-set transaction and recheck the live actor plus `role.manage` and `permission.manage` after the lock. Removing `profile.read` makes the next profile request 403. In-flight work is not described as cancelled. Approved grant edits do not change `credentialEpoch`, role assignment, or other roles. A no-op metadata save writes no audit row. Audit snapshots store catalog permission codes, actor, role id, and request id. They do not store the reason, the new name, passwords, or tokens. The audit schema has no name or reason field.

Last operable Super Admin means ACTIVE, email-verified, and `agencyId` not null. Governance codes cannot be removed from the Super Admin role. A Step 48 assignment racing a governance strip keeps `role.manage` and `permission.manage`, and at least one eligible Super Admin remains. If assignment wins first, the strip can return 401 because that actor is no longer Super Admin. Simultaneous agency reparent was **NOT RUN**. Reparent uses `AGENCY_HIERARCHY_LOCK`, not the user lifecycle lock, so it does not serialize with a grant edit. It also does not change role permissions.

## Commands

Repo root. Database tests used the disposable in-memory replica set. `dev:api` was not started. Atlas was not contacted.

| Command | Exit | Result |
|---|---|---|
| `npm run test:api` (before the 503 fix) | 1 | 28 files, 286 passed, 1 failed (`admin-roles` expected 503, received 500) |
| `npm run test:api` (after the fix) | 0 | 28 files, **287** passed |
| `npm run test:web` | 0 | 31 files, **141** passed |
| `npm run type-check` | 0 | pass, including a rerun after the service fix |
| `npm run lint` | 0 | 1 pre-existing warning in `apps/web/src/components/data-table/data-table.tsx` (`useReactTable` / `react-hooks/incompatible-library`). Changed role files were linted again with no findings. |
| `npm run build` | 0 | route list includes `/admin/roles`, `/admin/users`, and `/admin/agencies`. No `/si/admin/roles` or `/ta/admin/roles`. |
| `git diff --check` | 0 | tracked whitespace clean. Untracked trees were read directly. |

API files that passed in the final suite include `admin-roles` (4), `admin-users` (4), `agency-management` (4), `profile-self-service` (6), `permission-authorization` (6), `resource-scope` (3), `auth-session`, `auth-me`, `auth-logout`, `auth-jwt`, `password-reset-request`, and `password-reset-consume`. No test was skipped or deleted.

## Browser

`next start -p 3010` only. No API process. `NODE_ENV=production` forces the auth availability gate to preview, so private routes do not redirect to `/login` in this build. They render: “Sign-in is not live in this build” and “No private records are shown.”

| Check | Evidence | Status |
|---|---|---|
| Signed-out `/admin/roles` HTML and screen | No `SUPER_ADMIN`, `role.manage`, `profile.read`, `passwordHash`, or `localStorage`. Title is “Roles · INFRAOS”. Screen shows the preview gate only. | **PASS** for no private data. Login redirect **NOT RUN** in this production start. |
| `/`, `/si`, `/ta`, `/login` | Public landing and sign-in form still render. `/si/admin/roles` is 404. | **PASS** as a smoke check. Full visual regression **NOT RUN**. |
| `/dashboard`, `/profile`, `/settings`, `/admin/users`, `/admin/agencies` | Same preview-length HTML family. No grant payload. | **PASS** for absence of private SSR data. |
| Super Admin edit, Gov Admin read-only, officer/contractor 403, 409, 503, logout, keyboard, widths, EN/SI/TA in the editor | Not exercised against an API. | **NOT RUN** |

The temporary server was stopped. Screenshot `step50-admin-roles-signed-out.png` is a local temp file and must not be committed.

## Files to review (untracked source included)

Modified: `apps/api/src/routes/v1.ts`, `apps/web/src/components/auth/staff-workspace-shell.tsx`, `apps/web/src/components/auth/workspace-home.tsx`, `apps/web/src/lib/auth/route-access.test.ts`, `apps/web/src/styles/auth-access.css`.

Untracked: `apps/api/src/modules/identity/admin-roles/`, `apps/api/tests/admin-roles.test.ts`, `apps/web/src/app/admin/roles/`, `apps/web/src/components/admin/admin-roles-page-client.tsx`, `apps/web/src/lib/admin-roles/`, `docs/reviews/step-50/`.

`Prompts/` and `Steps.docx` stay untracked and out of any commit.

## Owner demo (isolated only)

1. Stay on this branch. Do not start the API with `apps/api/.env`.
2. Use a disposable replica set and a Super Admin who is ACTIVE, email-verified, and attached to an ACTIVE agency.
3. `GET /api/v1/admin/roles` returns seven roles. Gov Admin can read and cannot PATCH or PUT. An officer or contractor receives 403 even if those grants are written onto the role.
4. Change one description. Repeat the same revision and expect 409.
5. Remove a non-frozen grant such as officer `profile.read`. The next profile call returns 403. Restore it with a reason. `credentialEpoch` stays unchanged.
6. Adding `project.approve` to Super Admin, or `finance.payment.approve` to Contractor, returns 409 and does not store the grant.

## Step 51 handoff

Step 51 is ProjectTrace database and API foundation. Do not start it until the owner accepts this BLOCKED review, the frozen `agency.manage` and citizen-issue grants, and the carried email and null-agency limits.

## Git approval — not executed

Proposed stage list, not `git add .`:

- `apps/api/src/routes/v1.ts`
- `apps/api/src/modules/identity/admin-roles`
- `apps/api/tests/admin-roles.test.ts`
- `apps/web/src/app/admin/roles`
- `apps/web/src/components/admin/admin-roles-page-client.tsx`
- `apps/web/src/lib/admin-roles`
- `apps/web/src/components/auth/staff-workspace-shell.tsx`
- `apps/web/src/components/auth/workspace-home.tsx`
- `apps/web/src/lib/auth/route-access.test.ts`
- `apps/web/src/styles/auth-access.css`
- `docs/reviews/step-50`

Exclude `Prompts/`, `Steps.docx`, `.env`, screenshots, and unrelated branches.

Proposed commit message, after a separate approval:

`feat(identity): add governed role and permission administration`

Further separate approvals are required to push, open a PR, merge that PR into `development`, and later merge `development` into `main`.

STOP. No Git write was performed.
