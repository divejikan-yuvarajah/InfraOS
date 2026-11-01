# Step 66 — RoadSync Work Request Module: Implementation Status

Branch `feature/roadsync-work-requests` from `origin/development` @ `85c67656`. Uncommitted (G2–G6 not authorised).
Roadmap: `Prompts/Steps.docx` holds the title only; Step 67 is "Map-Based Location & GeoJSON Selection", so Step 66 has no map picker.

## Scope delivered
- API: `GET/POST /api/v1/roadsync/work-requests`, `GET /api/v1/roadsync/work-requests/:id`.
- Web: `/roadsync/work-requests` (list), `/new` (create), `/[id]` (detail). There is also a "Work Requests" nav item.
- Deferred (no roadmap or policy basis yet): PATCH draft edit, submit/cancel transitions, conflict detection, map selection (Step 67).

## Files
API: `apps/api/src/modules/roadsync/work-requests.{schema,service,routes}.ts`, `apps/api/src/routes/v1.ts`, `apps/api/tests/roadsync-work-requests.test.ts`.
Web: `apps/web/src/lib/roadsync/{api,work-requests-view,work-requests-view.test}.ts`, `apps/web/src/components/roadsync/*.tsx`, `apps/web/src/app/roadsync/work-requests/**/page.tsx`, `apps/web/src/styles/mission-control-roadsync.css`, `apps/web/src/components/auth/workspace-nav.ts`.
No schema, index, model or shared-type changes.

## Security and data decisions
- Strict zod body. `agencyId`, `status` and unknown keys are rejected (400). The agency is derived from the project on the server.
- The project must be in the caller's write scope (`projectWriteFilter`: a PM must be the project's manager) and in status APPROVED, ACTIVE, ON_HOLD or DELAYED, and its agency must be ACTIVE. CANCELLED or unapproved projects return 409 (BR-PRJ-007).
- Every request checks the live session, credential epoch and role grant. Super Admin has read-only access (no create grant). Contractor and Citizen get 403. A foreign or unassigned caller gets a generic 404.
- The create and the audit row (`work_request.created`, snapshot `{status, agencyId}` only, never geometry) are written in one transaction. An audit failure rolls back the create (tested).
- GETs perform no writes. Responses use `Cache-Control: no-store`. List queries reject unknown or repeated keys, are bounded (≤50) and use a deterministic sort (`plannedStart, _id`).
- Geometry is GeoJSON Point/LineString/Polygon in lon/lat order, with finite values within bounds, ≤500 vertices, closed rings, and the existing `validGeometry` check.
- Dates must be explicit-offset ISO instants. The UI reads input as Asia/Colombo time (+05:30, no DST) and sends UTC.

## Focused checks
| Command | Result |
|---|---|
| `npm run test -w @infraos/api -- tests/roadsync-work-requests.test.ts` | 7/7 passed |
| `npm run test -w @infraos/web -- src/lib/roadsync/work-requests-view.test.ts src/components/auth/workspace-nav.test.ts` | 15/15 passed |
| `npm run type-check:api` / `type-check:web` | exit 0 / exit 0 |
| `git diff --check` | exit 0 |
Deferred to the phase review: full suites, lint, build.

## Browser demo (real API + Next dev + in-memory Mongo replset on 127.0.0.1, synthetic data)
Verified in headless Chrome:
- The empty state renders.
- The picker lists only the 2 eligible projects; the cancelled one is hidden.
- Reversed dates plus bad geometry show the error summary with focus, and nothing is persisted.
- A valid LineString POST returns 201 with status DRAFT, the agency set, and 09:00 Colombo stored as `03:30Z`.
- Detail and list then show 1 record.
- 320px has no horizontal overflow.
- The foreign officer sees an empty list with no title leak.
- API: foreign detail 404, anonymous 401, assigned PM 200.

Screens are in `screens/01..09`.
Bugs found and fixed during the demo: the project picker used `limit=50` (the projects API caps it at 25), and the web bundle could not resolve runtime enum imports from shared-types. The enums are now local literals with a parity test.

## Acceptance S66-01..14
01 server-derived agency PASS · 02 project write scope / PM assignment PASS · 03 strict create validation PASS · 04 geometry validation PASS · 05 date validation, UTC PASS · 06 CANCELLED/unapproved project 409 PASS · 07 foreign 404 / no leak PASS · 08 capability 403 / anonymous 401 PASS · 09 audit + rollback PASS · 10 no GET writes PASS · 11 bounded validated list PASS · 12 edit/submit NOT IMPLEMENTED (deferred, not shown in UI) · 13 Mission Control UI + states + responsive PASS (owner visual acceptance PENDING) · 14 no conflict engine, no landing changes, no Atlas writes PASS.

## Known limits
- The project picker shows up to 25 projects.
- The geometry preview is a schematic, not a map (Step 67).
- The Work Requests UI is English only: the projects screens' EN/SI/TA switcher was not extended to it.
- The Mission Control sidebar shows "Work Requests" to all staff, consistent with the other nav items; the server enforces access.
