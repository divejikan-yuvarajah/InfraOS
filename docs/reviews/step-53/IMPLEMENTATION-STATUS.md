# Step 53 implementation checkpoint

**SAME-AGENT IMPLEMENTATION NOTE. Not independent human signoff. Not the overall final review.**

## Roadmap

`Prompts/Steps.docx` (read-only): **Step 53 — Projects Listing Page**. Sub-line: “Search, filters, statuses, agencies, pagination and sorting.”

`Prompts/INFRAOS_Steps_53_54_Enhanced_Development_Prompt.md` is not in this checkout. Implementation followed the user execution text and that docx line. Step 54 in the same docx is **Project Details & Overview Page**. It was not started.

## Git

- Branch `development`, tracking `origin/development`.
- HEAD `2b0507bf0c500f7e1904523a853d0435d8b92ae7` (`Merge branch 'feature/projecttrace-workflows' into development`).
- One worktree: `C:\Users\ASUS\Desktop\InfraOS\InfraOS`.
- Step 52 `/projects/new` and `POST /api/v1/projects` are in this commit. No new branch was created: this prompt forbids checkout without a separate approval. The listing changes are uncommitted on `development`.
- No stage, commit, push, PR, or Atlas write.

## Step 52 gate

PASS for presence. `apps/web/src/app/projects/new/page.tsx` and `createProject` are in HEAD. The create link is shown only as a role hint for Government Admin, Agency Officer, and Project Manager. The API remains the authority.

## API contract

`GET /api/v1/projects` still uses `requireAuthenticated`, then live `project.read`, then the scoped Mongo filter for both rows and `countDocuments`.

Optional query fields added to the strict schema: `agencyId` (24-hex ObjectId), `sortBy` (`createdAt`, `updatedAt`, `projectCode`, `title`, `projectType`, `status`, `startDate`, `plannedEndDate`), `sortDir` (`asc` or `desc`). Page stays 1–1000, limit 1–25, `q` max 80. Unknown keys, repeated values, `$` search text, and unknown sort fields return 400. Sort is applied in Mongo with `_id` ascending as the tie-break.

`agencyId` is added with `$and`, so it can only narrow the caller’s scope. An out-of-scope id returns total 0 and an empty page. The response adds `agencies`: distinct agency id and code values already inside the caller’s other filters. It is not a directory of every agency. List rows still omit budget, geometry, and description.

Index proposal, not executed: the schema already has indexes for agency/status/planned end, status/planned end, type/status, and unique `projectCode`. Title, `updatedAt`, and `startDate` sorts are not separately indexed. Do not run `createIndexes` on Atlas until that change is approved.

## Focused checks

| Check | Exit | Result |
|---|---|---|
| `apps/api` vitest `tests/projects-foundation.test.ts` | 0 | 6 tests. Includes two-page `projectCode` sort, Unicode search, status filter, `$where` / `$gt` / repeated `sortBy` 400, out-of-scope `agencyId` total 0, inactive child hidden from the ministry admin, reparent moves visibility, contractor 403, no `amountMinor` on the page |
| `apps/web` vitest `list-query.test.ts` and `messages.test.ts` | 0 | 4 tests |
| API `tsc --noEmit` | 0 | |
| Web `tsc --noEmit` | 0 | |

The first API run failed one existing assertion that treated `agencyId` as an unknown key (expected 400, got 200). That query is now a narrowing filter. The assertion was updated to require total 0 and an empty page, and `roleKey` remains 400. The rerun passed.

Full `npm run test:api`, `test:web`, lint, and build were not run. Signed-in browser listing was **NOT RUN**.

## Acceptance

| Criterion | Status |
|---|---|
| Search, status, type, scoped agency, pagination, allowlisted sort | PASS |
| Scope intersection, no budget on the list, role denial | PASS |
| Production indexes | BLOCKED until separately approved |
| Signed-in browser at 320–1440 | NOT RUN |
| Step 54 | NOT STARTED |

**Step 53 focused implementation: PASS**, with browser **NOT RUN** and production indexes **BLOCKED**.

**STOP. Step 54 was not implemented.**

## Addendum — 26 October 2026 verification

**SAME-AGENT VERIFICATION. Not owner or browser signoff.**

Roadmap line, reconfirmed from `Prompts/Steps.docx`: **Step 53 — Projects Listing Page.** “Search, filters, statuses, agencies, pagination and sorting.”

### Git at this check

- Directory: `C:\Users\ASUS\Desktop\InfraOS\InfraOS`
- Branch: `development`, tracking `origin/development`
- SHA: `35edec5d309a067e181b74a27ce85f69eebc9f36` (`feat(projecttrace): complete scoped project list and overview`)
- Tracked tree matches that commit. Untracked only: `Prompts/INFRAOS_Steps_53_54_Enhanced_Development_Prompt.md` and `Prompts/INFRAOS_Steps_55_56_Enhanced_Development_Prompt.md`. Those were not edited or staged.
- **NO CODE CHANGES** in this verification. No branch, commit, push, or checkout.

The historical section above describes the pre-commit tree at `2b0507b`. That note is stale. Step 53 and Step 54 code are both in `35edec5`. This pass did not modify Step 54.

### Classification

| Behavior | Status |
|---|---|
| Auth, live `project.read`, scope, `Cache-Control: no-store` | EXISTS+VERIFIED in disposable Mongo |
| Allowlisted page, limit, q, status, type, agencyId, sortBy, sortDir | EXISTS+VERIFIED |
| Unknown, repeated, and `$` queries return 400 | EXISTS+VERIFIED |
| `agencyId` narrows scope; out-of-scope id returns an empty page | EXISTS+VERIFIED |
| Server sort with `_id` tie-break; page total from `countDocuments` | EXISTS+VERIFIED for distinct codes. Equal-key page ties were not given a separate fixture |
| List omits budget, geometry, and description | EXISTS+VERIFIED |
| Gov subtree, officer agency, inspector assignment, super-admin read, contractor/citizen 403 | EXISTS+VERIFIED |
| Later deactivation, reparent, and removed `project.read` | EXISTS+VERIFIED |
| Noindex `/projects`, server-mode table, URL state, code link with safe `list` return | EXISTS+VERIFIED by code and list-query tests. Browser NOT RUN |
| Query key includes epoch, user id, and role | EXISTS+VERIFIED by the key helper. Signed-out account switch NOT RUN |
| EN/SI/TA copy | EXISTS. Native review pending |
| Signed-in browser at 320–1440 | BLOCKED |
| Offset stability while rows are inserted | NOT a defect. `_id` tie-break does not stop page drift |

`/projects/new` and `POST /api/v1/projects` remain in this SHA. No `REJECTED` status was added.

### Focused commands

| Command | Exit | Result |
|---|---|---|
| `npm run test -w @infraos/api -- tests/projects-foundation.test.ts` | 0 | 7 tests. Disposable replica only |
| `npm run test -w @infraos/web -- src/lib/projects/list-query.test.ts` | 0 | 4 tests |
| `npm run type-check:web` | 0 | |
| `npm run type-check:api` | 0 | |

### Browser

**BLOCKED / NOT RUN.** `apps/api/.env` has an Atlas `MONGODB_URI`. This pass did not start `dev:api`, did not open that database, and did not seed it. `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=1` is set for development only. Production `next start` still forces the preview gate, and that gate is not a signed-in demo. No screenshot was taken.

To view the list later, use a disposable Mongo process, point only that process at it without writing the Atlas URI into logs, create a synthetic verified staff account through the normal provisioning flow, then open `http://localhost:3000/login` and `http://localhost:3000/projects` with `npm run dev:web`. Do not use `next start` for that check.

### Gate

Code-level Step 53 checks are satisfactory. Browser acceptance is not. Step 54 was not started or changed by this pass.

### Proposed Git commands — do not run until a separate approval

No source fix exists, so no commit is proposed. Do not stage the untracked `Prompts/` files. If a later hardening change is approved:

```text
git switch development
git pull --ff-only origin development
git switch -c feature/projecttrace-list-overview-hardening
git add -- <exact reviewed paths only>
git diff --cached --check
git commit -m "fix(projecttrace): harden scoped project listing"
```

Push, a pull request into `development`, merge, and any `main` release each need their own approval.
