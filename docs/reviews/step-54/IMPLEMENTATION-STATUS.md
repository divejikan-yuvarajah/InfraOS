# Step 54 implementation checkpoint

**SAME-AGENT IMPLEMENTATION NOTE. Not independent human signoff. Not the overall final review.**

## Roadmap

Exact title: **Project Details & Overview Page**.

`Prompts/Steps.docx` supplies that title and no Step 54 micro-bullets. `Prompts/INFRAOS_Steps_53_54_Enhanced_Development_Prompt.md` is not in this checkout. Binding detail came from `docs/ux/project-detail-architecture.md`, the existing Step 51 detail API, and the Step 54 execution text. Step 55 **Edit Project & Validation** was not started.

## Git

- Branch `development`, HEAD `2b0507bf0c500f7e1904523a853d0435d8b92ae7` (`Merge branch 'feature/projecttrace-workflows' into development`).
- One worktree: `C:\Users\ASUS\Desktop\InfraOS\InfraOS`. No checkout, stage, commit, push, or PR.
- Step 53 listing work remains uncommitted on this branch, together with the Step 54 edits below.

Tracked modifications include the Step 53 list files plus Step 54: `projects.service.ts`, `projects.types.ts`, `projects-foundation.test.ts`, `apps/web/src/app/projects/[id]/overview/page.tsx`, `project-overview-client.tsx`, `projects-page-client.tsx`, `project-create-page-client.tsx`, `create-transform.ts`, `create-transform.test.ts`, `messages.ts`, `types.ts`, `auth-access.css`.

Untracked: `list-query.ts`, `list-query.test.ts`, `overview-format.ts`, `overview-format.test.ts`, `docs/reviews/step-53/`, and this file.

## Step 53 gate

Satisfactory. The same focused API file still covers the Step 53 sort, filter, and scope cases, and that file passed in this run (7 tests, exit 0). No fixture project catalog was invented.

## What the overview shows

The existing protected route `/projects/[id]/overview` stays `noindex`. The server page passes only the route id. The client loads `GET /api/v1/projects/:id` through `fetchProject`. TanStack key is `["project", "core", authEpoch, id]`. Create success writes that same key and still navigates to the overview. A later tab can reuse this key. Logout changes the epoch, so the previous account’s cache entry is not reused. `fetchProject` still refuses a response if the epoch or token moved during the request.

The header shows title, code, status text and color, type, and the project’s agency code. The back link is `/projects` plus the list query only after `parseProjectListParams` rebuilds it, so an unsafe `list` value becomes `/projects`. The code link on the list passes that query.

Overview sections use the live project: description, planned start, planned end, actual end, last update in UTC, place, and a GeoJSON summary (Point coordinates, LineString position count, Polygon ring count). Absent optional values say “Not provided”. Calendar dates are taken from the UTC `YYYY-MM-DD` prefix. LKR uses integer cents. The budget card renders only when the response includes `budget`. Recorded `physicalProgress` is labeled as not an inspection and not a finance report. `financialProgress` is not in the DTO.

## DTO and permissions

`GET /api/v1/projects/:id` is unchanged as a route. It still requires a live session and live `project.read`, then the scoped Mongo filter. Malformed id 400, out of scope 404, contractor 403, database failure 503, `Cache-Control: no-store`.

New detail fields:

| Field | Rule |
|---|---|
| `actualEndDate` | Already stored on the project. Null when absent. |
| `physicalProgress` | Already stored. Not a finance or inspection verdict. |
| `managerName` | First and last name only when `managerId` is set and that user’s `agencyId` equals the project agency. No email. Null becomes “Not provided”. |
| `budget` | Unchanged. Present only when the live role has `finance.budget.read` and the project has a budget. |

Contractor affiliation is omitted. `Contractor.userId` does not exist, and there is no verified contractor display field on this DTO. A separate contractor lookup would be a new relationship read. No new collection, index, or lifecycle route.

## Focused checks

| Check | Exit | Result |
|---|---|---|
| `apps/api` vitest `tests/projects-foundation.test.ts` | 0 | 7 tests. The new case covers owned manager name, UTC start date, geometry type, budget present for a manager, budget absent after `finance.budget.read` is removed, assigned inspector without budget, unassigned inspector 404, other-ministry 404 with no project code, contractor 403, malformed id 400, revoked `project.read` 403, `findOne` failure 503, and no `financialProgress` or email |
| `apps/web` vitest `overview-format.test.ts` and `create-transform.test.ts` | 0 | 12 tests. UTC date, exact cents, geometry summary, safe list return, EN/SI/TA 403 vs 404 vs 503, one core key per epoch, create cache key |
| `apps/web` vitest `list-query.test.ts` | 0 | 3 tests, in the earlier focused run. `list-query.ts` was not changed afterward |
| API `tsc --noEmit` | 0 | |
| Web `tsc --noEmit` | 0 | |
| API eslint on the project service, types, and foundation test | 0 | |
| Web eslint on the overview, list, create, messages, and format files | 0 | After replacing the list URL effect that called `setState` synchronously. The URL is still the list source of truth |

Full `npm run test:api`, `test:web`, lint, and build were not run.

Signed-in browser at 320/360/390/768/1024/1440 and 200% zoom: **NOT RUN**. No production preview was started, and no API was started against Atlas. There is no signed-in E2E result.

## Gaps and blockers

- Production Mongo indexes remain **BLOCKED** and were not created.
- Signed-in overview E2E is **NOT RUN**.
- Sinhala and Tamil copy is marked pending native review.
- Timeline, milestones, documents, finance, inspections, and risks are not linked. Edit, submit, and approve are not on this page.
- Public `/`, `/si`, and `/ta` were not changed. No `/si/projects` route was added.
- Earlier release blockers remain: invitation email, null-agency Super Admin login, and unapproved Atlas indexes.

**Step 54 focused implementation: PASS**, with signed-in browser **NOT RUN** and production indexes **BLOCKED**.

## Handoff

Canonical next step: **Step 55 — Edit Project & Validation**. It should add the authorized edit route and valid draft transitions. This page must not grow an Edit button until that route exists.

**STOP. Step 55 was not implemented. Nothing was staged or committed.**
