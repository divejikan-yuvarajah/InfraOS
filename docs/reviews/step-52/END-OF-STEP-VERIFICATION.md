# Step 52 end-of-phase verification

**SAME-AGENT REVIEW — NOT INDEPENDENT HUMAN SIGNOFF.**

Sri Lankan GovTech demonstration. Not an official live government service. This session implemented Step 52 and then reviewed it. Fixture and disposable-Mongo tests do not prove Atlas index safety or a live staff sign-in.

## Roadmap title

Read-only `Prompts/Steps.docx`: **Step 52 — Create Infrastructure Project Workflow**. The same sentence also lists agency, manager, contractor, budget, dates, category, coordinates, affected infrastructure, and other project details.

The locked Step 51 `POST /api/v1/projects` schema accepts code, title, type, LKR budget, and optional description, dates, descriptive location, and geometry. It rejects client agency, manager, contractor, and status. There is no affected-infrastructure field. The form follows that contract. Contractor choice and affected-infrastructure editing were not invented.

The next title in `Steps.docx` is **Step 53 — Projects Listing Page** (search, filters, statuses, agencies, pagination, and sorting). Step 53 was not started.

## Git

| Item | Result |
|---|---|
| Branch | `feature/projecttrace-workflows` |
| HEAD | `2c195516272fa10fb191723cb334464d810c2e6d` (no Step 52 commit) |
| Ancestry | Local `development` and `origin/development` are this same merge of `feature/projecttrace-foundation`. Step 51 source is in this tree. The prompt snapshot `9b339ac` is older than this checkout |
| Worktree | `C:\Users\ASUS\Desktop\InfraOS\InfraOS` only |
| `git diff --check` | exit 0 on tracked edits. Sampled untracked Step 52 files had no trailing whitespace |
| Commit / push / PR | not run |

Tracked edits: project API test, project list and overview clients, project messages, types, API client, route-access test, `auth-access.css`.

Untracked implementation: `apps/web/src/app/projects/new/`, `project-create-form.tsx`, `project-create-page-client.tsx`, `create-transform.ts`, `create-schema.ts`, `create-outcome.ts`, `create-transform.test.ts`, `api.test.ts`, `docs/reviews/step-52/`, and `Prompts/INFRAOS_Steps_52_Enhanced_Development_Prompt.md`. The prompt file stays out of any later commit. No `.env` or lockfile change. No new dependency.

## Create contract

`/projects/new` is a private App Router page. Metadata sets `robots: { index: false, follow: false }`. The production preview response includes `noindex, nofollow`. `/projects` links to it with “Create project”. The link is inside the staff shell, so the production preview gate hides it until a non-production session exists.

The browser body is built only by `buildProjectCreateBody`. Allowed keys are `projectCode`, `title`, `projectType`, `budget`, and optional `description`, `startDate`, `plannedEndDate`, `location`, and `geometry`. `projectType` is the existing ten-value enum. Budget is `{ amountMinor, currency: "LKR" }`. Dates are `YYYY-MM-DDT00:00:00.000Z`. A point is `{ type: "Point", coordinates: [longitude, latitude] }`.

`createProject` calls `POST /api/v1/projects` once through `apiClient` with `authenticated: true` and `retry: false`. The route order is unchanged: `requireAuthenticated`, then live `requirePermission("project.create")`, then strict Zod. There is no Next.js create API route.

| Gate | Evidence | Status |
|---|---|---|
| Required code, title, type, budget | transform test rejects a blank form | PASS |
| Unicode title and code normalization | `කොළඹ நீர்` kept; `inf-road-52` becomes `INF-ROAD-52` | PASS |
| LKR cents `0`, `0.01`, `1250000.50`, `1,250,000.00`, max safe integer | decimal-string conversion | PASS |
| Extra decimals, negative, exponent, blank, non-ASCII digits, overflow | rejected | PASS |
| Leap day, invalid 2025-02-29, end before start, one-sided dates | UTC midnight or field error; blanks omitted | PASS |
| Point `[79.86, 6.92]`, out of range, `NaN`, one coordinate | longitude stays index 0; incomplete point rejected | PASS |
| Forged agency, manager, status, creator | absent from the built body; server schema is `.strict()` | PASS |
| HTTP 201 navigation only for the same epoch and token | `projectCreateCachePlan` and `createProject` session check | PASS |
| 400, 401, 403, 409, 415, 429, 503, network `TypeError` | `classifyCreateError`; none mapped to saved | PASS |
| Detail without `budget` | overview renders the amount only when `project.budget` is present | PASS by code inspection |

Disposable Mongo, inside `npm run test:api`: minimal DRAFT 201 with null start date and the officer’s agency; removed `project.create` returns 403 and writes no row; contractor, inspector, and citizen POST return 403. The earlier Step 51 cases in the same file still pass: missing bearer 401, forged body 400, duplicate code one 201 and one 409, revision race, audit failure 503 with rollback, non-JSON 415, ACTIVE patch 409, other-ministry list total 0, Super Admin create 403 even with an injected grant.

No new test closed the Step 51 hierarchy-reparent race or a permission change after the transaction snapshot. Those stay **BLOCKED**.

## Commands

Step 51 historical counts were **291 API / 142 web**. They are not these results.

| Command | Exit | Result |
|---|---|---|
| `npm run test:api` | 0 | 29 files, **292 passed**. The extra test is the minimal-draft and removed-grant case. No failure in this pass |
| `npm run test:web` | 0 | 34 files, **154 passed** |
| `npm run type-check` | 0 | web and API |
| `npm run lint` | 0 | 0 errors, 2 warnings: existing `useReactTable` in `data-table.tsx`, and `useForm().watch` in `project-create-form.tsx` |
| `npm run build` | 0 | `/projects`, `/projects/[id]/overview`, and `/projects/new` are dynamic. Existing middleware deprecation warning |
| `git diff --check` | 0 | tracked diff |
| `git status --short --branch` | 0 | `feature/projecttrace-workflows` at `2c19551`, dirty as listed above |

## Browser

Signed-in create against a live API: **NOT RUN**. `dev:api` was not started because the API environment targets Atlas.

Production `next start -p 3010`, then stopped:

| Check | Status |
|---|---|
| `/projects/new` signed out | PASS as privacy only. Heading “Sign-in is not live in this build”. No inputs. No `INF-ROAD`, `passwordHash`, `amountMinor`, or `agencyId` in the HTML. `localStorage` empty. `noindex, nofollow`. Widths 320 and 1440 had no horizontal overflow of that gate |
| `/projects` signed out | PASS as the same preview gate |
| `/` | PASS. Public English landing still renders |
| `/si`, `/ta`, `/login`, `/dashboard`, `/profile`, `/settings`, `/admin/users`, `/admin/agencies`, `/admin/roles` | SSR titles returned 200 with no project secrets. Hydrated walk of those private pages was not repeated; they use the same preview gate as `/projects` |
| Form widths 360, 390, 768, 1024, keyboard completion, EN/SI/TA form rendering, 409 form retention, logout during POST | NOT RUN. The production gate never mounts the form |

EN/SI/TA strings differ in the unit test. That is fixture copy, not a browser language pass.

## Carry-forward blockers

- Step 51 signed-in ProjectTrace browser: **NOT RUN**
- Atlas indexes and production auth policy: **not approved**
- Agency reparent during create, and a grant change after the project transaction snapshot: **BLOCKED**
- Step 50 invitation email: **BLOCKED**
- Null-agency Super Admin sign-in: **BLOCKED**
- Step 50 signed-in admin browser: **NOT RUN**
- `REJECTED`, `Project.submittedBy`, and `Contractor.userId`: still absent
- Locale copy is a draft pending native review
- No product defect was changed in this review pass

## Criterion rollup

| Criterion | Status |
|---|---|
| Exact Step 52 title recorded, including the wider docx list | PASS |
| Step 51 dependency present and not rewritten | PASS |
| Guarded noindex `/projects/new` and list link | PASS |
| Strict create body, cents, UTC dates, point, optional blanks | PASS |
| Live `project.create`, role ceiling, scope, no forged authority fields | PASS in disposable Mongo |
| 201, 409, 401, 403, 415, 503, audit rollback | PASS in disposable Mongo |
| POST not auto-retried; unknown outcome not labeled saved | PASS in unit tests |
| UI double-click and session-swap in a real browser | NOT RUN. The client lock and epoch check exist |
| EN/SI/TA draft dictionaries | PASS as unit copy |
| Keyboard, contrast, and form layout at 320–1440 | NOT RUN |
| Signed-out production preview privacy | PASS |
| Signed-in form integration | NOT RUN |
| Public landing left unchanged | PASS |
| Full phase commands | PASS |
| Production index and auth approval | BLOCKED |

## Recommendation

**BLOCKED**

The isolated create workflow matches Step 52, and the phase commands passed. This is not independent human acceptance. Production create cannot be approved until indexes, deployment auth, and a signed-in disposable-database demo are approved separately.

## Owner demo

Use a disposable replica set and synthetic staff. Do not use Atlas.

1. Sign in as an Agency Officer with `project.create`.
2. Open `/projects`, then Create project.
3. Save a unique `INF-ROAD-…` code, a title, a category, and an amount such as `1250000.50`. Leave dates and coordinates blank or add a point with longitude first.
4. Expect 201, DRAFT, the actor’s agency, and `/projects/{id}/overview`.
5. Repeat the code. Expect 409 with the form still filled.
6. Remove `project.create`. Expect 403. Super Admin, contractor, inspector, and citizen creates stay denied.

## Git stop

Nothing was staged. After a separate approval, stage only the Step 52 paths:

```powershell
git add -- apps/web/src/app/projects/new apps/web/src/components/projects apps/web/src/lib/projects apps/web/src/lib/auth/route-access.test.ts apps/web/src/styles/auth-access.css apps/api/tests/projects-foundation.test.ts docs/reviews/step-52
git diff --cached --check
git commit -m "feat(projecttrace): add secure infrastructure project creation workflow"
git push -u origin feature/projecttrace-workflows
```

Do not stage `Prompts/` or `Steps.docx`. Commit, push, the pull request into `development`, the merge, and any later promotion to `main` each need their own approval.

**STOP. Step 53 was not started.**
