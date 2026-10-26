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
