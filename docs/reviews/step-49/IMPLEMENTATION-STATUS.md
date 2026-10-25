# Step 49 implementation status

SAME-AGENT implementation note. Phase review: `docs/reviews/steps-48-49/END-OF-PHASE-VERIFICATION.md`. Verdict there is limited foundation, not full phase shipment.

## Preflight

- Branch remains `feature/identity-administration` at base `f0c8187`, with the uncommitted Step 48 files kept.
- `Steps.docx` (read-only) titles this step **Step 49 — Agency Management** and does not define routes.
- No new branch, worktree, ministry collection, permission seed edit, dependency, or Atlas index.
- The locked seed currently includes `agency.manage` on `GOV_ADMIN`. Step 49 does not remove it. Manage routes still require that permission, then reject every role except `SUPER_ADMIN`.

## What shipped

`/api/v1/admin/agencies`

- `GET /` and `GET /:id` — `requireAuthenticated` + live `agency.read`, then server scope
- `POST /` — create
- `PATCH /:id` — name and contact metadata plus revision; code, type, status, and parent are rejected
- `POST /:id/reparent` — hierarchy change
- `POST /:id/deactivate` — status change only

`SUPER_ADMIN` can read and govern. `GOV_ADMIN` can read the active ministry and active descendants only. `AGENCY_OFFICER` and `PROJECT_MANAGER` can read their own agency when `agency.read` is granted. Other roles are denied even if the permission is injected. Out-of-scope ids return 404, and list totals use the same filter.

Codes are uppercased and immutable. Names accept Unicode and reject control characters. A ministry cannot have a parent. Any other type needs an active parent. Reparent walks ancestors and descendants, refuses self-parent, inactive parents, existing cycles, and depth past 8. Opposing reparents share the existing `agency-hierarchy` lock document inside a replica-set transaction, so A→B and B→A cannot both commit. Metadata updates use `__v`.

Deactivation returns 409 with counts of active children, non-disabled users, open projects, and open work requests. It does not delete or reassign those records. Cancelled projects and work requests do not block it. A deactivated agency is no longer accepted by Step 48 staff creation. Moving an agency out of a ministry removes it from that Gov Admin’s later user and agency reads. An inactive parent makes the Gov Admin scope empty on the next request.

Audit rows use `identity.agency.created`, `updated`, `reparented`, and `deactivated` with actor, request id, status, and parent id. A failed audit write rolls the agency change back. The audit snapshot has no name or contact fields, so those values are not copied into it.

`/admin/agencies` is a guarded page with search, type and status filters, hierarchy parent column, and Super Admin create, rename, reparent, and deactivate controls. Other signed-in roles see the directory their API call returns, without manage controls. Mutations are not retried. English, Sinhala, and Tamil copy is a draft.

## Focused checks

| Check | Result |
|---|---|
| API `vitest run tests/agency-management.test.ts` | **PASS** — 4 tests, exit 0 |
| API `tsc --noEmit` | **PASS** — exit 0 |
| API eslint on agency management, v1 router, lock key | **PASS** — exit 0 |
| Web `src/lib/admin-agencies/schema.test.ts` | **PASS** — 2 tests, exit 0 |
| Web `tsc --noEmit` | **PASS** — exit 0 |
| Web eslint on the agency page, client, and shell links | **PASS** — exit 0 |
| Full API/web suites, root lint, and build | **NOT RUN** — reserved for the phase review |
| Browser | **NOT RUN** |
| Atlas indexes | **NOT RUN** |

## Demo

Use an isolated API, not Atlas. Sign in as a Super Admin who already has an active agency. Open `/admin/agencies`, create a department under an active ministry, then try to deactivate an agency that still has staff. Expect 409 and no status change. A Gov Admin session should list only that ministry subtree and should receive 403 from create, reparent, and deactivate.

## Git

No stage, commit, push, or pull request was made.

## Step 50

Role and permission administration was not started.
