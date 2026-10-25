# Step 48 implementation status

SAME-AGENT implementation note. Phase review: `docs/reviews/steps-48-49/END-OF-PHASE-VERIFICATION.md`. Verdict there is limited foundation, not full phase shipment.

## Preflight

- Workspace: `C:\Users\ASUS\Desktop\InfraOS\InfraOS` only. No extra worktree.
- Branch created: `feature/identity-administration` from `development` `f0c8187` (PR #79, Step 47 included; `d4db911` is an ancestor).
- `main` remains `ea7377a`. Not updated.
- Tracked tree was clean. Untracked `Prompts/*` was left untouched.
- `Steps.docx` (read-only) titles this step **Step 48 — Admin User Management**. It does not specify routes. Routes below follow the Step 48/49 prompt and existing API style.
- `requireAuthenticated` still requires an active agency. Null-agency `SUPER_ADMIN` login was not widened. Creating a `SUPER_ADMIN` through this API is fail-closed (`409`) because provisioning a platform role refuses an agency, and that account could not sign in.

## What shipped

Protected staff directory:

- `GET /api/v1/admin/users`
- `GET /api/v1/admin/users/:id`
- `POST /api/v1/admin/users`
- `PATCH /api/v1/admin/users/:id` (name + revision only)
- `POST /api/v1/admin/users/:id/disable`
- `POST /api/v1/admin/users/:id/enable` (same `user.disable` grant)
- `POST /api/v1/admin/users/:id/assignment` (Super Admin + `user.update` only)

Each route uses `requireAuthenticated`, then the live Role permission, then server scope. Callers cannot pass `source`, `capability`, permissions, or a target user id as authority. Gov Admin can read the active ministry subtree and can create, rename, disable, or enable only non-privileged staff inside that subtree. Gov Admin cannot create or edit another Gov Admin or a Super Admin, and cannot call assignment. Agency Officer can read their own agency only. Other roles are denied even if `user.read` is injected onto the role. Citizen accounts are omitted from the directory.

Create reuses `provisionStaff` (bcrypt 12, `PENDING`, `emailVerified: false`) inside a transaction with an append-only audit row. The trusted actor is built on the server. The response says activation delivery is **BLOCKED**. No password, hash, epoch, permission list, or token is returned.

Disable, enable, and assignment take a lifecycle lock, re-check the actor's live grant, bump `credentialEpoch`, close refresh families, revoke refresh sessions, and write audit in the same transaction. A thrown audit hook rolls the user change back. Two Super Admins disabling each other cannot both succeed; one account stays active. Self-disable is `409`. Enabling an unverified account is `409` and does not set `emailVerified`.

UI: `/admin/users` behind the existing private route guard, TanStack Query, React Hook Form + Zod, EN/SI/TA draft copy, and an always-visible activation-unavailable notice. Mutations set `retry: false`. JWTs stay in memory via the existing client.

## Focused checks

| Check | Result |
|---|---|
| `apps/api` `vitest run tests/admin-users.test.ts` | **PASS** — 4 tests, exit 0 |
| `apps/api` `vitest run tests/registration.service.test.ts` | **PASS** — 7 tests, exit 0 |
| `apps/api` `tsc -p tsconfig.json --noEmit` | **PASS** — exit 0 |
| `apps/api` eslint on admin-users, registration service, `v1.ts`, admin test | **PASS** — exit 0 |
| `apps/web` `vitest run src/lib/admin-users/schema.test.ts` | **PASS** — 2 tests, exit 0 |
| `apps/web` `tsc -p tsconfig.json --noEmit` | **PASS** — exit 0 |
| `apps/web` eslint on admin users UI, schema, shell, workspace home | **PASS** — exit 0 |
| `npm run test:api`, `test:web`, root lint, build | **NOT RUN** — reserved for the one phase review |
| Browser admin flow | **NOT RUN** — no isolated API process was started; Atlas was not used |
| Production invitation email | **BLOCKED** — no delivery provider |
| New Super Admin account creation | **BLOCKED** — `409`, auth agency gate unchanged |
| Step 49 agency management | **NOT STARTED** |

## Demo (isolated only)

1. Sign in as a Gov Admin or Super Admin who already has an active agency.
2. Open `/admin/users`.
3. Create an officer with an in-scope agency code. Expect `PENDING`, `emailVerified: false`, and the activation-unavailable notice. Do not expect email.
4. Disable that user and confirm an old access token fails protected routes.
5. Do not point this demo at Atlas.

## Git

No stage, commit, push, or PR was performed.

Suggested commit message after owner approval: `feat(identity): add scoped admin staff directory and lifecycle controls`.

## Step 49 handoff

Agency management is not part of this step. Do not start it until the owner accepts Step 48.
