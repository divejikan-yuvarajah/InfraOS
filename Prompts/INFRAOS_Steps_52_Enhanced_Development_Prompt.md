# INFRAOS — Step 52 of 190 | Enhanced Development Prompt
## Create Infrastructure Project Workflow

**Product:** INFRAOS — National Infrastructure Intelligence & Coordination Platform  
**Vision:** *The Operating System for National Infrastructure*  
**Core lifecycle:** Plan → Coordinate → Approve → Build → Verify → Monitor → Complete → Maintain  
**Scope:** Step **52 only**, following the merged Step 51 ProjectTrace Database + API Foundation  
**Source review date:** 26 October 2026 (GitHub snapshot at document preparation)  
**GitHub:** https://github.com/divejikan-yuvarajah/InfraOS  
**ONLY working directory:** `C:\Users\ASUS\Desktop\InfraOS\InfraOS`  
**Suggested shared ProjectTrace feature branch:** `feature/projecttrace-workflows` (reuse a suitable already-open shared ProjectTrace feature branch after inspection; **not** one branch per step)  
**Integration branch:** `development` after approval; **stable release:** `main` only after separate approval  
**Companion:** `INFRAOS_Steps_52_Cursor_Agent_Execution_Prompts.md`

> **Roadmap source and fidelity.** The committed `docs/reviews/step-51/END-OF-STEP-VERIFICATION.md` explicitly says its agent read the local `Prompts/Steps.docx` and copied **“Step 52 — Create Infrastructure Project Workflow.”** This title is verified **indirectly from that committed handoff**, not by this generator reading the original DOCX. The exact original Step 52 sub-bullets are **not** accessible here. Cursor must inspect `Prompts/Steps.docx` **read-only inside the permitted checkout** before implementation; if its actual Step 52 instructions change this scope materially, report the conflict and do not silently substitute this proposed detail. The architectural and acceptance design below is an implementation-ready interpretation of the title, constrained by locked existing source and requirements.

---

# 1. Outcome, boundary and direct mapping to the roadmap

**Primary outcome:** An authenticated, authorized Agency Officer, Project Manager or Government Admin can use a **working private Next.js form** to create a real infrastructure project in `DRAFT` through the Step 51 Express endpoint, see a truthful saved result, and navigate to the newly created project's existing read-only overview. The UI is not a static mock, and the browser must not be allowed to choose authority-defining fields.

**Required Step 52 scope** (derived from exact title + locked repository requirements):

1. Implement protected `/projects/new`, linked from `/projects` and relevant private navigation only when warranted by accessible creation rights; allow a directly entered URL to fail safely.
2. Provide a professional, accessible, responsive create-project form: code, title, category, optional description, planned start/end, required budget in LKR, optional descriptive location and optional valid GeoJSON (point/line/polygon as supported by the API). A saved `DRAFT` is permitted **without dates or geometry** by the Step 51 backend; clearly disclose that submission readiness will require them later.
3. Client-side validation aligned exactly with `projectCreateSchema`; canonicalize fields without silently changing meaning; show precise, localized field errors.
4. Call the **existing, live `POST /api/v1/projects`** via the shared in-memory Bearer `apiClient` and typed DTOs. Never create a duplicate backend service or an unprotected Next.js API route.
5. Use authenticated actor as the only server authority for agency, creator, manager, status and all computed/protected fields. Enforce live `project.create` and Step 51 role/scope rules at Express; UI role hints never substitute for server grants.
6. Handle success, duplicate code, invalid payload, expired sign-in, 403, 409, 415, 429 if present, 503, ambiguous network failure and double-click races truthfully. Do not falsely claim a project was saved after a timeout.
7. Invalidate the current identity's project list/detail caches appropriately, clear private drafts on logout or account switch, and navigate to `/projects/[id]/overview` after confirmed creation.
8. Supply actual focused unit/API/regression tests and ONE combined final phase-wide testing/review prompt; all browser limitations must be stated honestly.

**Direct locked-source associations:** `FR-PROJECT-001/002/003` (create DRAFT, duplicate code, valid geometry), `FR-PROJECT-011/012` (read/detail/list integration), `BR-AUTH-001/002/005`, `BR-SCOPE-001..008`, `BR-PRJ-001/002/003/009`, `docs/ux/page-inventory.md` (`/projects/new` form + map sheet *vision*), `docs/architecture/projecttrace-architecture.md` (ProjectTrace owns official lifecycle).

**Do not implement Step 53+**: submission, review/approval/rejection, status transitions, milestone CRUD, full draft-edit workflow, activity timeline, dependent projects, MapLibre/InfraMap full map workspace, RoadSync conflict detection, invoices/payments, contractor self-service, photo/document uploads, AI risk, citizen publishing, role/admin changes or production deployment. The existing thin overview can be improved **only where necessary** to show a newly saved project accurately. No “Submit for approval” action that has no authorized working server path. A create form may explain future submission requirements without performing them.

---

# 2. Verified repository analysis: baseline and constraints

## 2.1 GitHub state actually checked

| Reference | Observed SHA prefix | Meaning |
|---|---|---|
| `development` | `9b339ac628445d` | **Step 51 merged** via PR #87 on 25 October 2026 at 19:39 UTC |
| `feature/projecttrace-foundation` | `148256c3602378` | Step 51 implementation commit |
| `main` | `269cefacf624b6` | Step 50 release; **Step 51 not yet promoted** in this snapshot |

The remote state changed between initial and final checks: **trust the newer snapshot above**. The GitHub connector is read-only for this preparation. Cursor must inspect `git status`, local `HEAD`, refs, untracked files, remote tracking and branch divergence; it must **not** assume the Windows checkout contains merged Step 51 merely because GitHub does. If Step 51 is absent locally, STOP: do not paste a second reimplementation into Step 52, force checkout, reset, stash or overwrite owner files. Request the appropriate owner-approved integration/synchronization process.

## 2.2 Verified Step 51 functionality in `development`

- `apps/api/src/modules/projects/projects.routes.ts` mounted at `/api/v1/projects` by `apps/api/src/routes/v1.ts`. Working isolated-test routes: `GET /`, `GET /:id`, `POST /`, `PATCH /:id`; they use `requireAuthenticated`, then `requirePermission` with current database grants and private response `no-store`. **No submit/approve transition API.**
- `projects.schema.ts`: `projectCreateSchema` is **strict**: `projectCode`, `title`, `projectType`, `budget` required; `description`, `startDate`, `plannedEndDate`, `location`, `geometry` optional. `PROJECT_TYPES` are enforced; `projectCode` matches `/^INF-[A-Z_]+-[0-9]+$/` up to 48 characters. Title max 200, description max 5000. Location fields have their own bounds; unsafe controls/`$` are rejected.
- `startDate`/`plannedEndDate`: accepts a UTC **timestamp string** `YYYY-MM-DDTHH:mm:ss[.sss]Z` (not a naked `YYYY-MM-DD`), and rejects inverted ranges. UI can present date-only input but must encode timestamps deterministically and test timezone behavior.
- Budget: `{ amountMinor: safe nonnegative integer, currency: "LKR" }`. Backend authoritative monetary unit is **LKR cents**, not rupee floating point. No negative/fractional minor amounts or invented currency.
- `validGeometry` supports GeoJSON `Point`, `LineString`, `Polygon`; coordinates are `[longitude, latitude]`. Polygon rings must be closed. Geometry may be omitted for `DRAFT`; never pretend an omitted geometry makes a project ready for submission.
- Step 51 service writes actor-derived `agencyId`, `createdBy`, `status: "DRAFT"`, progress 0, `managerId` only for the current PROJECT_MANAGER actor, and appends a safe audit row transactionally. The client must **never** send role, agencyId, managerId, contractorId, createdBy, status, progress or other server-owned values.
- Read DTO list includes `id`, code, title, type, status, agency id/code, manager id, dates, timestamps, `revision`; detail additionally includes description, location and geometry. Detail contains budget **only if** live role also grants `finance.budget.read`. Do not assume all users can read back the amount they entered.
- Existing web `apps/web/src/app/projects/page.tsx` and `apps/web/src/components/projects/projects-page-client.tsx`: protected scoped server-paginated project table/list; code links to `/projects/[id]/overview`. Existing `apps/web/src/components/projects/project-overview-client.tsx`: sparse, read-only detail. `apps/web/src/lib/projects/api.ts` provides guarded `fetchProjects`/`fetchProject`; no create transport yet. `apps/web/src/lib/projects/types.ts` currently omits detail `location/geometry`—extend correctly if used.
- Existing `StaffWorkspaceShell`, `RouteAccessGuard`, `apiClient`, TanStack Query, shadcn/Radix, RHF+Zod and EN/SI/TA draft conventions should be reused. `apps/web/src/lib/auth/route-access.ts` treats `/projects/*` as private, but verify actual behavior before relying on it. **Do not add `/si/projects/new` or `/ta/projects/new` under public-classified locale routing.**
- Existing `apps/web/src/lib/auth/availability.ts` forces `preview` when `NODE_ENV=production`, regardless of login flag. A `next start` screenshot of a signed-out preview is **NOT** a live staff E2E test.

## 2.3 Step 51 evidence and blockers to carry forward

Committed same-agent handoff reports **291 API tests** and **142 web tests** passing on its *second final full-suite pass*, type-check/lint/build passing, one existing React Table lint warning, and an isolated Mongo/Supertest API foundation. These are **historical, same-agent claims**, not Step 52 results and not independent human signoff.

The same report recommends **BLOCKED** production acceptance: signed-in ProjectTrace browser E2E **NOT RUN**; Atlas/production indexes and auth policy not approved; agency reparent/create and cross-lock permission races not fully proven. Previous Step 50 blockers persist: invitation email, null-agency Super Admin sign-in, signed-in admin browser. Do not silently claim any of these are fixed. `REJECTED` project status is absent, `Project.submittedBy` absent, Contractor↔User trusted link absent. Project submission/approval SoD is not solved by creating a DRAFT.

### Mandatory preflight gate

Read original local `Prompts/Steps.docx` **without moving or modifying it** if present. Read current `docs/reviews/step-51/END-OF-STEP-VERIFICATION.md`, Step 50 report, `docs/planning/{requirements,business-rules,user-workflows}.md`, `docs/security/{permission-matrix,route-access-policy,resource-authorization}.md`, `docs/ux/{page-inventory,project-detail-architecture}.md` and live code. If the Step 51 code is not in local checkout or its dependency is broken, label **BLOCKED** and stop rather than duplicate it or edit against the wrong baseline.

---

# 3. UI/UX product design: create infrastructure project

## 3.1 Route and navigation

**Primary route:** protected `/projects/new`; set metadata `title: "Create Project · INFRAOS"`, `robots: { index:false, follow:false }`. Link from `/projects` to the create route using a normal accessible link/button only for plausible authorized staff; a hidden control is UX only, **direct URL + API still require server RBAC**. If session contains role but not current permissions, don't present it as definitive authorization. It is acceptable to show a create link to staff and then present a server 403 on denied action; improve using an already existing safe capability signal only if available. Never expose cross-agency/project information in SSR HTML.

Page design: compact breadcrumb (`Workspace / Projects / Create project`), heading + truthful explanation (“Creates a draft only”), calm progress/section indicators (not a fake complex wizard), input sections and sticky or bottom action bar. On desktop use legible 2-column form + side summary only where useful; on mobile single-column with no horizontal scrolling. Include Back/Cancel to `/projects`, Save draft, validation messages, submission spinner, accessible success and errors. No Save-as-Submitted or Approve. Keep meaningful unsaved-data warning when navigating away if appropriate, without trapping keyboard users or using disallowed browser APIs in tests.

### Sections and exact field behavior

| Section | Control | API field | Rules |
|---|---|---|---|
| Identity | Project code | `projectCode` | Required. Uppercase normalization with visible preview; strict `INF-[A-Z_]+-[0-9]+`; server handles uniqueness 409. Do **not** invent automatic collision-free sequences unless an approved allocator exists. |
| Identity | Project title | `title` | Required 1–200 after trim; Unicode Sinhala/Tamil allowed, no controls/dollar. |
| Identity | Project category | `projectType` | Required select from **actual** `PROJECT_TYPES` (ROAD, WATER, ELECTRICITY, TELECOM, DRAINAGE, BRIDGE, BUILDING, PUBLIC_FACILITY, MULTI_INFRASTRUCTURE, OTHER). Friendly translated labels, stored unchanged. |
| Description | Description | `description` | Optional ≤5000, safe trim; omit blank values rather than sending unsupported null. |
| Planning | Planned start/end | `startDate`, `plannedEndDate` | Both optional for DRAFT; if both present end ≥ start. UI date-only (`YYYY-MM-DD`) converted to exact UTC midnight ISO with an explicit non-local parser (avoid timezone drift); preserve date-only text in UI. The server expects timestamp `...T00:00:00.000Z` or equivalent valid canonical UTC. |
| Funding | Approved draft budget entry | `budget.amountMinor` | Required numeric **nonnegative, safe integer** in LKR cents. Human-friendly LKR rupees entry optional, parsed with decimal-string arithmetic to exactly 2 fractional digits, no JS floating point rounding; validate overflows. Label this a *draft budget estimate* rather than approval/payment authority. |
| Descriptive location | Province, district, locality, road name, description | `location` | Optional; limits 100/100/160/160/500; never infer official administrative boundaries from free text. |
| Geometry | Geographic location | `geometry` | Optional for DRAFT. Provide a **working accessible longitude/latitude pair entry** to create a valid `Point`. Clearly distinguish lat vs lon and enforce longitude ±180, latitude ±90, finite values. If supporting LineString/Polygon, accept only safe validated GeoJSON paste/structured editor and bound sizes/ring closure—never introduce a full GIS map editor as a hidden future step. |

**Important tension:** UX page inventory envisions a map sheet at `/projects/new`, but InfraMap is a later module. Step 52 must not claim MapLibre drawing or live map placement exists if it does not. A documented, precise coordinate-based point selector is sufficient minimum to create a GeoJSON-backed project; a static map preview may be included only with already-installed, safe assets and without new heavy dependencies. GeoJSON editing must never be necessary to save a minimal DRAFT.

**Server-only values:** Do not render editable agency ownership, creator, role, permissions, manager, contractor, progress, status, riskScore, `financialProgress`, `physicalProgress`, `actualEndDate`, `submittedBy`, `approvedBy`, `_id`, `__v`, `createdAt`, revision or tenant scope. Explain “Your assigned agency will be set automatically” without pretending the account's agency can be changed through form input.

## 3.2 Validation, accessibility, multilingual and visual system

Use React Hook Form + Zod with a **frontend-only adapter that mirrors the current server `projectCreateSchema`**, not direct browser imports from the backend. Use type-safe DTO/client schemas and official const enums from shared types or local inferred constants **only as implemented**. Avoid permissive number coercion: blank numeric input is not 0, `NaN`, `Infinity` and exponent tricks are rejected. Validate date chronology, exact budget cents, lat/lon ordering, GeoJSON before POST. Client input validation is UX; server validation is authoritative.

Full keyboard: correct `<label>`/`htmlFor`, grouped legend for coords/dates, error-to-control association, first invalid input focus, alert/message announcements without flooding screen readers, submission disabled against double clicks, focus on server banner and success navigation, 44px touch targets where feasible, accessible select, reduced-motion consideration, 200%/400% zoom and sensible status states. Maintain draft form values on 400/409/503. Provide appropriate confirmation before discarding dirty fields; do not leak draft via URL, console, telemetry or SSR.

Use existing INFRAOS design tokens and components; palette is institutional **orange `#FF5B00`**, yellow `#FEB600`, maroon `#8C1F28`, green `#279541`, neutrals #F8FAFC/#FFFFFF/#111827/#475569/#64748B/#E2E8F0. Use valid contrast foregrounds, not low-contrast white body text on saturated orange/green. Sora/DM Sans/Noto Sinhala/Noto Tamil where already installed. Premium calm enterprise typography, purposeful sections, responsive 320/360/390/768/1024/1440 widths; do not build an unrelated navigation redesign. Keep the public Connected Future landing **identical**.

Translate form labels, help, button and error messages into **EN/SI/TA draft dictionaries**; distinguish translated visible copy from canonical project type codes and from actual native-speaker certification. Avoid adding public `/si/projects/new` or `/ta/projects/new` routes. Provide in-page language selection on the guarded private path using existing patterns, with local/nonpersistent presentation unless approved persistence exists. Currency remains LKR in all locales; numerals input policy must be documented and tests cover fallback if unsupported native digits.

## 3.3 Error, success and ambiguous network UX

| Case | UI action | Server/source |
|---|---|---|
| Success `201` | Display saved confirmation with returned real project code; navigate to `/projects/{id}/overview`; refetch/invalidate scoped list for current identity | `POST /api/v1/projects` |
| Local invalid fields | Inline error and focused summary, no POST | Zod client |
| Server `400` or `415` | Preserve input, show appropriate failure, do not report saved | Strict Zod / media type |
| Duplicate code / state conflict `409` | Explain project code conflict; allow edit code; never send a second POST automatically | Unique index + server conflict |
| Invalid/expired session `401` | Use existing identity-expired guard/login; do not clear form until intentional auth transition | Existing auth client |
| Missing permission / invalid role `403` | Access-denied state without exposing internal role/agency data | Backend current-role RBAC |
| DB/auth dependency `503` | Keep unsaved inputs and offer manual retry *with warning that an earlier request may have reached server* | Existing errors |
| Offline/timeout/unknown outcome | **Do not auto-retry POST** or show “saved”; offer to check `/projects` for code, then manually retry only after verifying whether one was created | Network uncertain |
| Logout/account switch while POST pending | Suppress stale success and navigation; drop private draft/caches across identity boundary | Auth epoch/token snapshot |

The Step 51 service has limited request-ID-based duplicate handling but the frontend must **not** treat that as unrestricted idempotency: do not blindly replay POST with newly generated request IDs after an ambiguous response. A duplicate-code 409 should remain a clear user-recoverable state. After successful creation, optionally hydrate project detail cache for same identity only, else invalidate and navigate to GET detail. No private SSR content, no localStorage/sessionStorage access token or persistent PII draft.

---

# 4. Backend/API integration contract and safe changes

## 4.1 Reuse existing server, don't rewrite it

**Existing exact endpoint:** `POST /api/v1/projects` with `requireAuthenticated` → live `requirePermission("project.create")` → Step 51 `createProject()` → atomic Mongo Project+Audit mutation. It returns HTTP `201` with the existing success envelope `{ success:true, data:{ project: ... }, requestId }`. Also reuse GET list/detail and their DTOs. Do not add `/api/v1/project/create`, a Next.js server action that bypasses RBAC, a public /register, or an admin-only shortcut.

**Valid minimal example** (synthetic placeholder, not Atlas test record):

```json
{
  "projectCode": "INF-ROAD-05201",
  "title": "Synthetic corridor repair planning",
  "projectType": "ROAD",
  "budget": { "amountMinor": 125000000, "currency": "LKR" }
}
```

**More complete example** for date and point conversion:

```json
{
  "projectCode": "INF-WATER-05202",
  "title": "Synthetic water main upgrade",
  "description": "Demo only, not an official public work order.",
  "projectType": "WATER",
  "startDate": "2027-01-15T00:00:00.000Z",
  "plannedEndDate": "2027-02-28T00:00:00.000Z",
  "location": { "province": "Western", "district": "Colombo", "roadName": "Synthetic corridor" },
  "geometry": { "type": "Point", "coordinates": [79.86, 6.92] },
  "budget": { "amountMinor": 125000000, "currency": "LKR" }
}
```

Do not hardcode these synthetic sample rows in the UI as if they came from Mongo. Use dynamic response data. Current `createProject` has a strict schema and transaction/duplicate controls; only change the server if a confirmed Step 52 form contract mismatch cannot be fixed in the frontend. Any narrowly necessary backend change must preserve all Step 51 security tests and remain within Step 52 create workflow. Never widen the request schema to accept client-owned `agencyId`, `managerId`, role, approval status, progress, risk or payment fields.

## 4.2 Access requirements

| Actor | Expected Step 51 create behavior | Step 52 UI handling |
|---|---|---|
| Agency Officer | Allowed if **live** `project.create`, active account and agency | Can create DRAFT in server-derived own agency |
| Project Manager | Allowed if live permission; new project auto-assigns manager to caller | Form does not choose manager |
| Government Admin | Allowed by Step 51 implementation if live permission; agency bound to caller's own agency | Do not offer cross-ministry agency picker absent secure backend support |
| Super Admin | **Denied operational create**, even with injected `project.create` grant | No privileged bypass or impersonation |
| Contractor, Inspector, Citizen | Create denied by server | Do not expose a functional create action |

The UI can use role-based *hints* to control link visibility; the HTTP API is the only authority. Authentication and permission revocation must be checked server-side at mutation time. No client-supplied agency, author, status or false successful response. Existing `project.read` may be different from `project.create`; if created data is not readable with current role grants, still report a successful creation truthfully and offer appropriate navigation without assuming detail GET succeeds. Avoid automatic transition to `SUBMITTED` after creation.

## 4.3 Model safety, audit and concurrency

- Reuse `Project` model and core enums; never clone projects into a frontend DB or create a `ProjectDraft` collection. A DRAFT can be incomplete with missing coordinates/dates; `BR-PRJ-002` applies when submitting, a future step.
- Unique `projectCode` must be backed by an actual unique index **in the target database**. Step 51 test memory-server had that index; production Atlas verification/index work is still separately gated. **Do not start a test API against Atlas** or run `syncIndexes`/`createIndexes`/`db:seed` there without approval.
- Successful create changes only one project plus safe append-only audit record within the existing transaction. Include `requestId` and actor identity without logging the raw body; failure must roll back. Honor existing `AGENCY_HIERARCHY_LOCK` and Step 51 active agency/live role verification; do not introduce an incompatible lock order.
- Double-click submit protection in UI is essential but not a substitute for unique-code race tests (simultaneous creates: one 201, other 409, unless same request-ID replay deliberately matches Step 51 semantics).
- Prevent user switching/logging out during requests from displaying prior user's project or redirecting to another actor's private resource.
- `finance.budget.read` governs detail budget visibility; do not expose other agencies' project budgets, staff email, tokens or contractor finance fields in confirmation toast.
- Preserve `Project`'s strict Mongoose schema, GeoJSON coordinate ordering, and nonnegative integer minor units. No AI or external geocoding service is needed.

## 4.4 Recommended minimal code footprint

Create/adapt only the files actually needed (paths are suggestions, not commands to create all):

```text
apps/web/src/app/projects/new/page.tsx                   # private create route; noindex
apps/web/src/components/projects/project-create-page-client.tsx
apps/web/src/components/projects/project-create-form.tsx # optional if helps maintainability
apps/web/src/lib/projects/create-schema.ts              # RHF/Zod + strict transformations
apps/web/src/lib/projects/create-transform.ts           # decimal money / UTC / GeoJSON adapters
apps/web/src/lib/projects/api.ts                        # add createProject transport; guard actor epoch
apps/web/src/lib/projects/types.ts                      # typed create/detail response incl. geometry where needed
apps/web/src/lib/projects/messages.ts                   # extend EN/SI/TA create copy
apps/web/src/components/projects/projects-page-client.tsx # minimal create link
apps/web/src/components/projects/project-overview-client.tsx # truthful saved-DRAFT presentation if necessary
apps/web/src/lib/projects/*.test.ts                      # focused form/client/transform tests
apps/api/tests/projects-foundation.test.ts              # extend minimally only for regression
# docs/reviews/step-52/END-OF-STEP-VERIFICATION.md       # one consolidated report
```

Reuse `apps/api/src/modules/projects/projects.schema.ts`, `projects.routes.ts` and `projects.service.ts` unchanged unless a demonstrable integration bug requires a limited fix. Do not add unnecessary dependencies, API keys, cloud storage, Maps credentials or extra private route systems.

---

# 5. Environment variables, local integration and external providers

**Expected necessary existing configuration (verify actual `.env.example` names, never invent values):** `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_AUTH_LOGIN_ENABLED` for safe non-production auth, existing API CORS `FRONTEND_ORIGIN`, JWT access/refresh secrets and **disposable** Mongo test DB replica set used by `mongodb-memory-server`. No new Mapbox, Google Maps, OpenAI, mail vendor, payment gateway, geocoder, R2 bucket, SMS or API key should be needed for Step 52.

**Critical runtime trap:** the existing `apps/web/src/lib/auth/availability.ts` always returns `preview` in `NODE_ENV=production`. A `next start` preview is valid for privacy/no-SSR-data smoke tests, **not** staff sign-in functionality. For a signed-in browser test, use only an approved isolated local API with synthetic users and a disposable replica set; verify effective URI and no indexes/seeds/autoIndex reach Atlas. If no such environment is ready, mark integrated browser **BLOCKED/NOT RUN** and provide manual demonstration steps. Do not weaken auth or set a fake production override to manufacture a pass.

**Security headers and privacy:** no `Authorization` in logs/URLs; no PII/session persisted in localStorage or public HTML; cross-origin API uses existing allowed origins. Only public Connected Future pages are SEO indexed; private create route is noindex. Server 401/403 remains meaningful regardless of client role or navigation.

---

# 6. Efficient single-execution implementation order

These are work items **inside one Cursor execution**, not separate execution prompts:

1. **Read-only preflight:** Git status/branches/worktrees, roadmap exact wording, Step 51 merged source and report, existing code, local database target safety; note blockers, don't override dirty files.
2. **Contract alignment:** map Step 51 strict create schema and DTO into RHF form and transport, clarify date/currency/geometry transforms and role cues; avoid speculative server changes.
3. **Core form/route:** `/projects/new` guarded, real fields + validation, accessible responsive EN/SI/TA display, optional geometry point input, explicit draft-only messaging.
4. **Reliable create integration:** guarded `createProject` using in-memory auth, no mutation retry, handle states, preserve fields, redirect on 201, cache invalidation current subject only, protect epoch races.
5. **Integration touchpoints:** create link on `/projects`, minimal confirmed result on `/projects/[id]/overview` where safe; don't modify unrelated pages.
6. **Focused proof:** test form conversions/validation and transport with synthetic fixture, add a few API regression cases where necessary, fix genuine bugs, rerun only focused tests/type-check relevant scope.
7. **Concise documentation:** update one `docs/reviews/step-52/END-OF-STEP-VERIFICATION.md`, include remaining blockers and manual isolated demo; stop without commit/push/PR/merge or Step 53.
8. **One overall final phase QA:** use the companion file's **single Prompt 2** for complete API/web suites, lint/type/build, browser/accessibility/security/race review and final recommendation, not repeated throughout the implementation.

---

# 7. Test matrix and regression rules

## 7.1 Form/transform tests (required)

| ID | Case | Expected |
|---|---|---|
| UI-52-01 | Required code/title/type/budget omitted | User-friendly errors, no request |
| UI-52-02 | Unicode title (Sinhala/Tamil), trim and max length | Accepted when valid; canonical saved text |
| UI-52-03 | Code lowercase, whitespace, bad shape or duplicate | Visible normalization or rejection; server 409 handled |
| UI-52-04 | LKR input `0`, `0.01`, `1250000.50`, too many decimals, negative, exponent, unsafe overflow | Exact minor-unit conversion or validation; no rounding/floating loss |
| UI-52-05 | Blank/one/both dates; leap date; invalid calendar date; end before start; timezone boundary | Omit blanks; encode valid ISO UTC; reject invalid order/date |
| UI-52-06 | Longitude/latitude valid bounds, swapped-looking values, `NaN`, empty, out-of-range | Correct `[lon,lat]` or field errors; no invalid geometry POST |
| UI-52-07 | Optional location/description blank and max lengths | Optional omitted; overlong rejected |
| UI-52-08 | Do not send agencyId/status/createdBy/managerId/financialProgress/extra fields | Strict body shape asserted |
| UI-52-09 | Submit once, 201 response, project id routing and query-cache invalidation | No false success / double navigation |
| UI-52-10 | 400/401/403/409/503/415/network error | Input retained when appropriate, accessible failure, no accidental retry |
| UI-52-11 | Logout, role revocation or subject switch while response pending | Stale result cannot navigate or contaminate cache |
| UI-52-12 | EN/SI/TA labels and errors, input focus and keyboard | Draft localization renders; valid associations |

## 7.2 API/security regression (disposable Mongo only)

- Existing Step 51 `POST` returns 201 DRAFT only with actor-derived agency/creator/manager; no client `status`, `agencyId`, role, `$set`, `__proto__` or malicious operator allowed; 400 strict validation. Test one valid minimal DRAFT (no dates/geometry), one valid Point and optionally LineString/Polygon fixture.
- Two different requests using same code: one winner and one 409. Verify actual unique index **in disposable Mongo only**. Avoid broad client retries that create ambiguous duplicate workflows.
- Current Role `project.create` removed: 403 on next create. Valid but wrong-agency Government Admin, unverified/inactive staff, Super Admin, Contractor/Inspector/Citizen unauthorized create all fail. Denied creates have no audit/project side effects.
- Simulated audit failure: transaction rollback; simulated DB dependency failure: 503, no leakage.
- Verify `GET /projects`, GET detail and `/projects/[id]/overview` remain restricted and safe. No new project transitions or malicious scheme routes.
- Test that name/email/session/role administration and `/`, `/si`, `/ta`, `/login`, `/dashboard`, `/profile`, `/settings`, `/admin/*` are unaffected.
- Maintain Step 51 lock/race residuals: do not claim to have proven reparent/permission cross-lock races unless new tests actually prove them.

## 7.3 Full suite (run once in the final overall review)

From the repo root:

```powershell
npm run test:api
npm run test:web
npm run type-check
npm run lint
npm run build
git diff --check
git status --short --branch
```

Record actual exit codes, totals, changed/untracked test coverage, and known warnings; **do not copy Step 51's 291 API / 142 web as Step 52 results**. If bugs are fixed, rerun affected tests and full checks invalidated by the fix; do not delete/disable tests. `git diff --check` alone does not inspect untracked files. Full browser UX tests are not covered by a passing Next.js build.

## 7.4 Browser matrix (if a safe isolated API is available)

- Signed-out `/projects/new`: identity guard, no private project data in HTML, appropriate login/preview state.
- Signed-in Agency Officer: navigate from `/projects`, fill required fields, optionally valid coordinate point, save DRAFT, verify route to real persisted overview, refresh and list row.
- Signed-in Project Manager: create DRAFT actor manager assignment, verify no ability to assign arbitrary manager/agency.
- Signed-in Government Admin: own-agency creation only; no cross-ministry chooser.
- Super Admin/contractor/inspector/citizen: no unauthorized create despite manually opening URL and POSTing.
- Duplicate code, incomplete form, network 503/timeout, double click, login expiry/logout/back/new user switch; unknown outcome is not shown as saved.
- Keyboard and screen-reader semantics, 200% zoom, reduced motion; widths 320/360/390/768/1024/1440; view in English/Sinhala/Tamil.
- Verify unchanged `/, /si, /ta, /login, /dashboard, /profile, /settings, /admin/users, /admin/agencies, /admin/roles` and current read-only project overview. Distinguish actual API-backed E2E from fixture/mock/preview only.

---

# 8. Acceptance gates, demonstration, risks and Step 53 handoff

## 8.1 Definition of done

| Acceptance criterion | Required outcome |
|---|---|
| Exact Step 52 title and original doc discrepancy recorded | PASS (or BLOCKED if materially different) |
| Local Step 51 dependency integrated and not corrupted | PASS |
| Working noindex private `/projects/new` route and accessible internal link | PASS |
| All exact Step 51 required and optional fields handled safely | PASS |
| Decimal-string LKR → integer minor unit and deterministic UTC date encoding | PASS |
| Point GeoJSON capture, optional geometry, valid field errors | PASS |
| Real authorized DRAFT POST + success navigation + scoped cache update | PASS |
| Server unchanged or narrowly fixed without auth/role/scope regression | PASS |
| 400/401/403/409/503/network/double-submit/session-race behavior | PASS |
| EN/SI/TA draft strings; premium responsive keyboard-accessible form | PASS |
| No public landing, auth, admin, RoadSync, finance or Atlas changes | PASS |
| Full final QA report with truthful evidence and remaining blockers | PASS |

Use `PASS`, `FAIL`, `BLOCKED` or `NOT RUN` for every relevant test and the final recommendation `APPROVE`, `REVISE` or `BLOCKED`. If a same agent implements and tests, label **SAME-AGENT REVIEW — not independent security signoff**. The user, not Cursor, controls Git integration and production acceptance.

## 8.2 Owner manual demo — only disposable synthetic test data

1. Confirm `development` Step 51 baseline is locally present, no dirty work overwritten. Check the isolated Mongo replica set target; never use Atlas or run `dev:api` if its `.env` points at Atlas.
2. Run safe local API/web processes with synthetic staff and valid isolated JWT/refresh configuration. If the environment is not safely possible, mark browser BLOCKED and use isolated API/unit evidence only.
3. Open `/projects`; follow **Create project** to `/projects/new`. Confirm no status, agency, approval, contractor, role or progress field is writable.
4. Enter `INF-ROAD-05201`, a synthetic Unicode title, `ROAD`, `LKR 1,250,000.00` (minor 125000000), optional date range and point `(79.86,6.92)` in `[lon,lat]` order. Save; verify `201`, DRAFT and server-owned agency on response and Mongo, then navigate to overview. These are examples—choose a unique code in the isolated test DB.
5. Repeat code with distinct request; verify 409, form still populated. Try negative budget, invalid date order, longitude 190 and empty title; verify actionable errors and no POST.
6. Remove `project.create` from the synthetic role and retry; expect 403. Verify Super Admin cannot create; a signed-out browser cannot see private content; no stale success after logout/account swap.
7. Confirm the saved project appears in scoped `/projects`, only staff with `project.read` can view overview, and no submission/approval button exists. Review mobile widths and three draft languages.
8. Run final overall QA. Capture exact command outputs and untracked files. Only propose—do not execute—Git steps until each explicit owner approval.

## 8.3 Outstanding blockers to report

- Original `Steps.docx` fine-grained Step 52 text was not available to this generator; **Cursor must read it locally** and reconcile if different.
- `development` has Step 51, but `main` is still Step 50 in this snapshot. Git integration/promotion are separate owner gates.
- Step 51 signed-in browser E2E and production indexes remain unproved/unapproved; Step 50 invitation delivery, null-agency Super Admin login and some admin browser checks remain outstanding.
- Existing `Project` has no `submittedBy` for later approval SoD, no `REJECTED` status, and no trusted Contractor user linkage. They are not needed to create a DRAFT and **must not be asserted fixed**.
- Step 51's agency hierarchy and permission revocation in-flight races are partially unproven. UI checks cannot close those backend governance gaps.
- UI coordinates are precise data; do not imply geocoding accuracy, official Sri Lankan datasets or a running national map.
- Missing production project-code indexes must block production writes; memory-server autoIndex passing is not equivalent to Atlas approval.
- Locale dictionaries are drafts pending native-speaker review. A synthetic browser test is not live staff onboarding.

**Step 53 handoff:** Its exact title is **not verified by the sources this generator saw**. After Step 52, hand over the real create-form/DTO/test contract and identify the next caption from `Steps.docx`. Do not implement project edit/approval/milestone workflows as a guessed Step 53.

---

# 9. Mandatory Git governance, safe commands and stop rule

**Read-only status/inspection (allowed):**

```powershell
Set-Location 'C:\Users\ASUS\Desktop\InfraOS\InfraOS'
git status --short --branch
git branch -vv
git worktree list --porcelain
git log -1 --oneline
git diff --stat
```

**Conditional branch preparation — only after owner approval and verifying clean/no unowned work:**

```powershell
# Run only when authorized and safe (do not stash/reset/force-switch to obtain a clean state).
git switch development
# Owner approval required before local sync; verify fast-forward safe:
git pull --ff-only origin development
# Reuse an existing approved ProjectTrace group branch if appropriate; otherwise:
git switch -c feature/projecttrace-workflows
```

**No write-side Git action is authorized by this prompt file.** After Step 52 implementation and ONE final overall review, propose scoped staging **only after explicit stage/commit approval**, and customize the paths to actual Step 52 changes (no nonexistent paths):

```powershell
# CONDITIONAL — owner approval required. Inspect changes before staging.
git status --short
git diff --check
# Stage only Step 52 source/tests/docs; adapt to actual changed paths and partial hunks.
git add -- apps/web/src/app/projects/new apps/web/src/components/projects apps/web/src/lib/projects docs/reviews/step-52
# If Step 52 truly required narrow backend/test changes, stage those particular paths separately.
git diff --cached --stat
git diff --cached --check
# Run only after separately approved commit:
git commit -m "feat(projecttrace): add secure infrastructure project creation workflow"
# Only after separate push approval:
git push -u origin feature/projecttrace-workflows
```

**Then separate approvals:** create PR feature→`development`, merge after review, later promote `development`→`main` only at approved release. If an existing shared ProjectTrace branch is reused, substitute the **actual approved branch name**, never hardcode a nonexistent branch on push. Do **not** use `git add .`; keep `.env`, `Prompts/`, `Steps.docx`, secrets, screenshots and unrelated files untracked/unstaged. Never create a second worktree or sibling checkout. Never touch, move or delete `Documents`. Never change public Connected Future `/`, `/si`, `/ta` unless explicitly authorized by a roadmap step (Step 52 does not).

**END — Step 52 development specification only.** No repository code, Git operations or Atlas/database activity is performed by generating this Markdown file.
