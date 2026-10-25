# Steps 48–49 end-of-phase verification

**SAME-AGENT REVIEW. Not independent human sign-off.**

**Verdict: LIMITED FOUNDATION.** Do not treat the phase as fully shipped.

Isolated tests, type-check, lint, and build passed. Invitation email, null-agency Super Admin sign-in, and signed-in browser administration were not proven against a live API. Those stay blocked.

Branch: `feature/identity-administration` (base `development` `f0c8187`). `main` is still `ea7377a`. Nothing was staged, committed, or pushed.

`Steps.docx` (read-only) only titles Step 48 “Admin User Management” and Step 49 “Agency Management”.

## Acceptance

| Step | Isolated behavior | Phase call |
|---|---|---|
| 48 Staff directory | **PASS** for scoped list/detail, pending create, name update, disable/enable, assignment, epoch revocation, last-admin race, audit rollback | **LIMITED** — activation email **BLOCKED**; new Super Admin create **BLOCKED** (`409`) |
| 49 Agency directory | **PASS** for scope, Unicode create, immutable code, metadata revision, opposing reparent race, dependency 409, audit rollback, Step 48 picker after deactivate/reparent | **PASS** for the implemented governance rules |

## Commands (repo root, this review)

| Command | Exit | Result |
|---|---|---|
| `npm run test:web` | 0 | 30 files, **137** tests |
| `npm run test:api` | 0 | 27 files, **283** tests |
| `npm run type-check` | 0 | pass |
| `npm run lint` | 0 | 1 pre-existing warning in `apps/web/src/components/data-table/data-table.tsx` (`useReactTable`) |
| `npm run build` | 0 | web routes include `/admin/users` and `/admin/agencies`; API `tsc` pass |
| `git diff --check` | 0 | pass |

API suite includes `admin-users` (4), `agency-management` (4), profile (6), permission (6), resource scope (3), registration (7), and password-reset request (10). No test was skipped or weakened. `apps/api/.env` is not in the change list. `dev:api` was **not** started because that env points at Atlas.

`git diff` does not show untracked source. Untracked Step 48/49 trees were read directly: `apps/api/src/modules/identity/admin-users/`, `apps/api/src/modules/agencies/management/`, both test files, `apps/web/src/app/admin/`, `apps/web/src/components/admin/`, `apps/web/src/lib/admin-users/`, `apps/web/src/lib/admin-agencies/`, and the two status notes. No `.env`, token, or prompt file is part of the proposed commits. `Prompts/` and `Steps.docx` stay untracked.

## Security review

- Routes mount on `/api/v1/admin/users` and `/api/v1/admin/agencies` behind `requireAuthenticated` and the live Role permission. `roleKey` is not taken from the JWT or the body.
- Directory roles are an allowlist. Injecting `user.read` or `agency.manage` onto Inspector or Project Manager still returns 403. Contractor and Citizen have neither grant. Agency Officer can read own-agency staff and own agency only.
- Government Admin can manage non-privileged staff inside the active ministry subtree and cannot create or edit another Government Admin or Super Admin. The seed still lists `agency.manage` for Government Admin. Manage routes still return 403 for that role. The seed was not edited.
- Super Admin seed remains governance plus operational read. It does not add `project.approve`, `finance.payment.approve`, or `inspection.verify`. Pre-existing `citizen_issue.close` on that seed was not changed here.
- `requireAuthenticated` still requires an active agency. A platform user with a null agency cannot sign in. Creating a Super Admin stays `409`.
- Two Super Admins disabling each other cannot both succeed. Self-disable is `409`.
- Disable, enable, and assignment bump `credentialEpoch`, close refresh families, and revoke sessions in one transaction. A thrown audit hook rolls the user or agency write back.
- Reparent takes the `agency-hierarchy` lock inside the transaction. The opposing A→B and B→A test returned one 200 and one 409 and did not leave a cycle. That is a **PASS**, not a claim from reads alone.
- Deactivate with active users or open projects returns 409 counts and does not delete or reassign rows.
- Pending staff stay `emailVerified: false`. Responses do not contain the password, hash, epoch, or permission array. Create responses say activation delivery is unavailable.
- No `syncIndexes` or `createIndexes` was added. The lock document reuses the Step 48 collection with a second key. It is not an Atlas index migration.

Residual: a permission removed after the in-transaction grant check and before commit can still finish that request. The next request sees the new grant.

## Browser versus fixture

| Case | Evidence |
|---|---|
| Signed-out `/admin/users` and `/admin/agencies` on `next start` port 3010 | **PASS** — guard text only: “No private records are shown.” HTML had no `passwordHash`, epoch, or example emails |
| `/`, `/login` in that same browser | **PASS** — public landing and sign-in form still render |
| SSR HTML for `/`, `/si`, `/ta`, `/about`, `/login`, `/dashboard`, `/profile`, `/settings`, forgot/reset, both admin routes | **PASS** — no staff or credential strings |
| Signed-in create, disable, reparent, 409 dialogs, width sweep, EN/SI/TA in the live UI | **NOT RUN** — no isolated API was started; Atlas was not used |
| Supertest matrix | **PASS** — fixture proof, not a browser session |

The temporary web server was stopped after this check.

## Owner demo (isolated Mongo only)

1. Run the API against a disposable replica set, not Atlas.
2. Sign in as a Super Admin who already has an active agency.
3. Open `/admin/users`, create an officer, and confirm status `PENDING` and the activation-unavailable notice. Do not expect email.
4. Disable that user and confirm the old access token fails.
5. Open `/admin/agencies`, create a department, then deactivate an agency that still has staff and expect 409.
6. Sign in as a Government Admin and confirm the other ministry is absent and agency create returns 403.

## Step 50

Role and permission administration is not implemented. Do not start it from this review.

## Git — proposal only, not run

Exclude `Prompts/`, `Steps.docx`, `.env`, and any secret.

After a separate approval, commit Step 48, then Step 49, on `feature/identity-administration`:

```powershell
git add apps/api/src/routes/v1.ts `
  apps/api/src/modules/identity/registration.service.ts `
  apps/api/src/modules/identity/admin-users `
  apps/api/tests/admin-users.test.ts `
  apps/web/src/app/admin/users `
  apps/web/src/components/admin/admin-users-page-client.tsx `
  apps/web/src/components/auth/staff-workspace-shell.tsx `
  apps/web/src/components/auth/workspace-home.tsx `
  apps/web/src/styles/auth-access.css `
  apps/web/src/lib/admin-users `
  docs/reviews/step-48/IMPLEMENTATION-STATUS.md
git commit -m "feat(identity): add scoped administrative user management"
```

```powershell
git add apps/api/src/modules/agencies/management `
  apps/api/src/modules/identity/admin-users/admin-lifecycle-lock.model.ts `
  apps/api/tests/agency-management.test.ts `
  apps/web/src/app/admin/agencies `
  apps/web/src/components/admin/admin-agencies-page-client.tsx `
  apps/web/src/lib/admin-agencies `
  docs/reviews/step-49/IMPLEMENTATION-STATUS.md `
  docs/reviews/steps-48-49/END-OF-PHASE-VERIFICATION.md
git commit -m "feat(agencies): add governed agency management"
```

The second commit also needs the shell, workspace, CSS, and `v1.ts` lines for agencies if those hunks were not split in the first commit. Stage only the agency hunks if the first commit already took the shared files. Do not use `git add .`.

Further approval, separately: push, pull request into `development`, merge, then a later `development` to `main` release. No Atlas index and no Step 50.

## Owner checklist

- [ ] Accept limited foundation, or send back for revision
- [ ] Decide how a Super Admin with no agency may sign in before any Super Admin create path
- [ ] Choose an invitation provider before claiming staff can activate
- [ ] Approve the two commits, then push, then the development pull request, then main, each on its own
