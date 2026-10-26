# INFRAOS — Step 51 of 190 | Enhanced Development Prompt
## ProjectTrace Database + API Foundation

**Project:** INFRAOS — National Infrastructure Intelligence & Coordination Platform  
**Vision:** *The Operating System for National Infrastructure*  
**Workflow:** Plan → Coordinate → Approve → Build → Verify → Monitor → Complete → Maintain  
**GitHub:** https://github.com/divejikan-yuvarajah/InfraOS  
**Date of source review:** 25 October 2026  
**Sole local project folder:** `C:\Users\ASUS\Desktop\InfraOS\InfraOS`  
**Suggested shared feature branch:** `feature/projecttrace-foundation`  
**Integration:** `development`; **approved stable release:** `main`  
**Companion:** `INFRAOS_Steps_51_Cursor_Agent_Execution_Prompts.md`

> **Source fidelity.** The repository's Step 50 handoff explicitly quotes the local `Steps.docx` title **“Step 51 — ProjectTrace Database + API Foundation.”** The original `Steps.docx` itself was not accessible to this document generator. Its precise prose, if any, has **not** been verified. The contracts and implementation sequence below are an engineering interpretation of that title, reconciled with locked ProjectTrace requirements. Cursor must read the original inside the permitted project folder if present, resolve any discrepancy transparently, and not invent additional roadmap requirements.

---

# 1. Exact available requirements, outcomes, and exclusion boundary

**Verified Step 51 title:** *ProjectTrace Database + API Foundation.*

**Locked supporting requirements** (repository `docs/planning/requirements.md`):

| ID | Existing requirement | Step 51 treatment |
|---|---|---|
| FR-PROJECT-001 | Create a DRAFT project with unique code, owner agency and required core fields | **Implement API foundation** |
| FR-PROJECT-002 | Reject duplicate project codes | **Implement and test** |
| FR-PROJECT-003 | Valid GeoJSON Point/LineString/Polygon and coordinates | **Validate on create/update**, drawing UI later |
| FR-PROJECT-004 | Edit in allowed states | **DRAFT narrow-edit API only** |
| FR-PROJECT-011 | Authorized, field-safe detail view | **Implement minimal GET** |
| FR-PROJECT-012 | Filtered, paginated, tenant-scoped list | **Implement minimal GET** |
| FR-PROJECT-013 | Scope-limited dashboard aggregation | **Future step**; no fake counts in Step 51 |
| FR-PROJECT-005–010 | Submit/review/approve/start/hold/complete/cancel | **Future roadmap steps**, not exposed as functioning endpoints here |
| FR-PROJECT-014–015 | Dependencies, activity history | **Future step**; an append-only audit entry for creation/edit is Step 51 infrastructure |
| FR-MS-001–002 | Milestones creation and workflow | Models exist; **no Milestone CRUD yet** without roadmap authorization |

**Concrete Step 51 definition of done:** At least one API-authorized actor can create a real, schema-valid DRAFT project in isolated MongoDB; the current role and agency scope control private GET list/detail; an authorized actor can perform a narrow, version-checked edit while DRAFT; invalid, out-of-scope, forged and concurrent requests fail closed; creation and changed fields are auditable; a simple, protected ProjectTrace list/overview client demonstrates the integration without pretending to offer full ProjectTrace UI.

**Explicitly not Step 51:** project submission, review queues, approval/rejection, `REJECTED` status schema migration, rescheduling workflow, progress submissions, milestone CRUD, finance edits/payments, contractor onboarding, document uploads, map drawing, RoadSync spatial conflicts, public project publishing, AI risk computation, official dashboard analytics, activity feed, new roles or a full seven-role dashboard suite. These belong to later, separately reviewed steps. Do not make fake controls that claim to perform them.

---

# 2. Verified GitHub repository state and dependency audit

### 2.1 Git refs observed during specification

| Branch | Commit prefix | Evidence |
|---|---|---|
| `development` | `f43afbbde8e2de2d` | Merge PR #86 from `main` on Oct 25 |
| `main` | `269cefacf624b62a` | Merge PR #85, including Step 50 |
| Step 50 feature | `ed5792eb4a9a1b9e` | `feat(identity): add governed role and permission administration` |

No open PR was returned at the check. These are **remote GitHub** facts, not proof about the user's local branch, dirty files, active environment or database indexes. Cursor must re-verify the current Git refs before writing anything.

### 2.2 Verified existing implementation to reuse

**Express API and identity:**

- `apps/api/src/routes/v1.ts`: mounts `/health`, `/ready`, `/auth`, `/profile`, `/admin/users`, `/admin/agencies`, `/admin/roles`, `/admin/permissions`. **No ProjectTrace HTTP routes** on this baseline.
- `apps/api/src/modules/identity/auth/require-authenticated.ts`: verifies current account, role, agency, JWT and credential epoch; produces `req.actor`.
- `apps/api/src/modules/identity/authorization/require-permission.ts`: verifies exact live Mongo `Role.permissions` per request; a JWT, seed or `"*"` does not confer a grant. Use `project.read`, `project.create`, `project.update` as appropriate.
- `apps/api/src/modules/identity/authorization/resource-scope.ts`: `resolveResourceScope()`, `projectReadFilter()`, `projectWriteFilter()`, `readProject()`, `listProjects()` and `updateProjectTitle()` were Step 46 **helper/harness foundations**, not public product route implementations. Reuse/extend safely; do not silently weaken their existing tests.
- Agency hierarchy: active Gov Admin root plus active descendants; depth max eight; disconnected/inactive/cyclic scope denies. An Agency Officer and a Project Manager have own-agency read scope. A Project Manager's project writes additionally require assignment (`managerId`). `SUPER_ADMIN` may read platform project data but may not casually create or edit operations. Contractors have **no trustworthy user↔Contractor link**, so private contractor project access remains deny-default.
- `apps/api/src/modules/identity/admin-users/admin-lifecycle-lock.model.ts` and Step 49 agency hierarchy lock exist for race-sensitive governance; apply compatible lock discipline where scope could change during a mutation, without adding lock collection/index changes.
- `apps/api/src/modules/audit/models/audit-log.model.ts`: immutable audit records, safe snapshots for status/agencyId/budget etc., actor and request ID; no model-wide snapshots/passwords/tokens and no arbitrary data fields.

**Project schemas and indexing:**

- `apps/api/src/modules/projects/models/project.model.ts`: `projectCode`, `title`, `description`, `projectType`, `agencyId`, `managerId` (User), `contractorId` (Contractor), `location` descriptive, `geometry` GeoJSON, `startDate`, `plannedEndDate`, `actualEndDate`, `budget` in LKR *minor units*, physical/financial progress, `status`, risk score, `createdBy`, timestamps. Default `DRAFT`. Mongoose document version `__v` can support optimistic locking.
- `apps/api/src/modules/projects/models/milestone.model.ts`: exists; don't duplicate it.
- `apps/api/src/modules/projects/project.constants.ts`: `PROJECT_TYPES` and `PROJECT_STATUSES`. **Important discrepancy:** the locked review workflow mentions `REJECTED` but `PROJECT_STATUSES` does not include it. Do **not** add it or expose rejection in Step 51; note for later status-workflow step.
- `apps/api/src/shared/database/fields.ts`: `moneySchema` requires `{amountMinor: nonnegative safe integer, currency: "LKR"}`. **Do not send decimal rupee floats.** Existing date-order validation runs on full-document validation, not automatically on every query update.
- `apps/api/src/shared/database/geometry.ts`: `validGeometry` validates GeoJSON Point, LineString or Polygon, WGS84 `[longitude,latitude]`, bounds and closed polygon rings; it does not claim sophisticated topology validation. Invoke server validation on every write.
- Existing schema indexes include unique projectCode, agency/status, manager/status, project type/status and `2dsphere` geometry. **Atlas index proposals from Steps 40–42 remain unapproved**; new/actual Atlas index existence must not be assumed. `autoIndex` in dev mode may cause writes to Atlas.
- Synthetic demo seeds (`apps/api/src/database/seeds/demo/seed-projects.ts`) include real *synthetic* multi-agency fixtures, not official live data, and should be used only in a provably disposable environment.

**Frontend:**

- Next.js App Router + React 19, TypeScript, Tailwind 4 and shadcn/Radix components; TanStack Query and React Hook Form/Zod already in tree.
- `apps/web/src/lib/auth/route-access.ts` already classifies `/projects` as **private**. `RouteAccessGuard` protects page rendering as UX; authorization MUST happen on Express.
- `apps/web/src/components/auth/staff-workspace-shell.tsx` is a shared protected workspace nav; add a compact ProjectTrace link, not an extensive new shell.
- Existing public landing routes `/`, `/si`, `/ta` are outside this step. Do not touch the Connected Future marketing UI.

### 2.3 Step 50 handoff is merged but not fully accepted operationally

`docs/reviews/step-50/END-OF-STEP-VERIFICATION.md` labels its same-agent conclusion **BLOCKED** for release signoff: automated suites **reported** 287 API tests and 141 web tests passing, but signed-in admin browsers NOT RUN, real invitation email BLOCKED, null-agency Super Admin login BLOCKED, Atlas indexes not created, permission-seed inconsistencies still owner decisions. Despite this report, Step 50 is now present on `main` and `development`. **Git integration ≠ human security acceptance.** Step 51 may develop in an isolated test environment while carrying forward these blockers. Never assert live admin or staff onboarding is solved.

### 2.4 Before any file changes

1. Confirm this one working tree and active branch: `git status --short --branch`, `git branch -vv`, `git worktree list --porcelain`, `git log -1 --oneline` and optionally `git fetch` only if owner approved network Git operations. Read existing `AGENTS.md`, Cursor rules and `Steps.docx` when present.
2. Do not overwrite any local tracked, untracked or sibling work; do not stash, reset, clean, force checkout or create extra worktrees.
3. If branch creation is authorized and safe, create or reuse **one feature branch** (`feature/projecttrace-foundation`) in the same directory based on the approved `development` baseline. Reuse that branch for closely related later ProjectTrace work only if owner approves scope.
4. Read current database connection config without printing secrets. **Never start `dev:api` if pointing at Atlas**, and do not run schema/index commands on Atlas.
5. Record a brief preflight status and any original-roadmap mismatch in the final Step 51 note; avoid producing large unnecessary documentation stacks.

---

# 3. Backend domain design: secure minimal ProjectTrace API

## 3.1 Routing and endpoint proposal

**Suggested (confirm current route conventions first):**

| Method | Path | Live RBAC | Purpose | Scope |
|---|---|---|---|---|
| `GET` | `/api/v1/projects` | `project.read` | Paginated, filtered private project summaries | Mongo-filtered actor agency/org/assignment |
| `GET` | `/api/v1/projects/:id` | `project.read` | Explicit safe private detail DTO | IDOR 404 if out-of-scope |
| `POST` | `/api/v1/projects` | `project.create` | Create only DRAFT, server-bound agency | Agency & actor policy; no arbitrary statuses |
| `PATCH` | `/api/v1/projects/:id` | `project.update` | Edit only allowed DRAFT core fields | Atomic actor+scope+state+revision |

No public `/api/v1/projects` without permission; future public map routes must provide separate explicitly approved public-safe DTOs. Do **not** mount submit, approve, reject, transition, delete, arbitrary agency reassignment, budget mutation, milestone, or payment endpoints in this step. Do not implement a generic `PUT` that replaces a project or trusts caller-supplied actor fields.

- Route order: `requireAuthenticated` → `requirePermission(...)` → `project service` (scope, business state, audit) → existing `success()`/`failure()` with `requestId`.
- `Cache-Control: no-store`, no credential cookies, no private data in SSR payload or logs.
- `POST` returns 201; GET 200; valid PATCH 200; JSON body only on writes; the existing error envelope and HTTP style are authoritative.
- Reuse existing error names where available instead of proliferating near-duplicates.

## 3.2 Strict request shape and authoritative metadata

**Create DRAFT** request example (synthetic data only, not official infrastructure records):

```json
{
  "projectCode": "INF-ROAD-101",
  "title": "Example Road Improvement",
  "description": "Academic demonstration proposal",
  "projectType": "ROAD",
  "startDate": "2027-01-15T00:00:00.000Z",
  "plannedEndDate": "2027-04-15T00:00:00.000Z",
  "location": { "district": "Colombo", "province": "Western Province" },
  "geometry": { "type": "LineString", "coordinates": [[79.855, 6.927], [79.862, 6.93]] },
  "budget": { "amountMinor": 2500000000, "currency": "LKR" }
}
```

`geometry` and the dates may be **optional while in DRAFT** (the existing schema permits this); absent data means the project is *not ready for later SUBMITTED*. `budget` is required by the existing schema and must use valid integer LKR minor units; no invented currency provider. Code must match the schema regex `^INF-[A-Z_]+-[0-9]+$`, ≤48 characters; reject invalid codes rather than silently rewrite a user's code. Do not add a counter service to generate globally unique codes unless the roadmap explicitly requires it and concurrency/security tests justify it. Existing unique code index is essential to enforcement when DB writes are authorized.

**Server alone sets:** `agencyId`, `createdBy`, `status = DRAFT`, `physicalProgress = 0`, `financialProgress = 0`, `riskScore = unset`, `actualEndDate = unset`. For `PROJECT_MANAGER` creation, `managerId = actor.userId` so the newly created project is in their assignment scope. For Agency Officer/Gov Admin creation, leave `managerId` unset unless a separate trusted assignment policy is in scope; never accept arbitrary manager, contractor or agency IDs in the initial PATCH. A Gov Admin may create only inside a verified active ministry subtree and with current `project.create`; an Agency Officer only for the current active agency; PM only for own active agency and own manager assignment. **Never infer agency from JSON.** The user's actor role and active agency are read from Mongo-backed auth. Super Admin cannot create even if someone injects `project.create` into the Role; enforce locked role/action matrix as well.

The current `Project` schema requires `agencyId`, `createdBy`, `budget`. New projects must validate the references, role, agency, active account status, code uniqueness, dates and geography before persistence. Avoid an orphan project from an inactive/removed agency or disabled creator. Use Zod `.strict()`, Mongoose validators and **explicit domain validation of the full intended document**, not just client-side inputs. Unicode names and descriptions must remain valid; reject controls, unreasonable lengths and Mongo key/operator injection.

**DRAFT PATCH** allowlist should be deliberately narrow: `title`, `description`, `location` (descriptive fields only), `geometry`, `startDate`, `plannedEndDate`, plus `revision`. Patch is not a bulk object merge; distinguish omission from permitted field clearing. **Do not allow** `status`, `agencyId`, `projectCode`, `createdBy`, `managerId`, `contractorId`, `budget`, `financialProgress`, `physicalProgress`, `actualEndDate`, `riskScore`, `approvedBy`, `submittedBy`, any `$` key, `roleKey`, `permissions` or hidden metadata to be client-controlled. Budget updates are finance-governed future work, not casual Step 51 project PATCH. If the original roadmap requires a different authorized field set, document the discrepancy before widening it.

**Important:** `location` is descriptive. `geometry` is the coordinate source. Validate both `startDate <= plannedEndDate` and geometry validity on the **resulting complete document** because Mongoose `findOneAndUpdate` does not automatically execute existing document `pre("validate")` date checks on the combined state. Reject inverted dates, invalid coordinates, polygon rings, oversized arrays and `null` where the schema forbids it. Never implicitly transition the status when a location or percent changes.

## 3.3 Read and list response DTOs

Return only a deliberately constructed projection. Example:

```ts
type ProjectSummary = {
  id: string; projectCode: string; title: string;
  projectType: string; status: string;
  agencyId: string; managerId: string | null;
  startDate: string | null; plannedEndDate: string | null;
  createdAt: string; updatedAt: string;
  revision: number;
};
```

A detail response can additionally return `description`, safe `location`, and valid `geometry` if `project.read` and resource scope permit it. Consider whether field-level `map.layer.restricted` applies to a specific geometry before exposing sensitive work corridors; the current schema lacks project classification flags, so do not invent public access or show locations anonymously. Budget may be shown only with the **current** `finance.budget.read` permission and correct scope; financial progress is never edited from this service. Do not leak contractor financial data, audit details, role catalog, email or other users' private fields. Do not send raw Mongoose JSON.

Paginated `GET /projects`: whitelist `page` (1–...), `limit` (e.g. 1–25), `status` enum, `projectType` enum, approved textual `q`, and a stable sort (createdAt descending then `_id`); optional date/district filters only when correctly indexed/validated and filtered in Mongo. Escape regex, cap search length and prevent ReDoS; reject unknown query operators and attacker-supplied filters for actor/agency IDs. Combine filters with server-generated scope using `$and` in Mongo, **not** `Model.find({ ...untrustedQuery })`. Use exactly the same scoped predicate for list **and** `countDocuments` and any later aggregations. Handle zero results honestly and cap payload/geometry size.

**IDOR:** Malformed ObjectId → 400. Well-formed out-of-scope/private ObjectId → 404. Authenticated but without action permission → 403. Missing/invalid session → 401. Database availability problem → 503. No unrestricted total count leakage.

## 3.4 Exact tenancy and role handling

Follow locked `docs/security/permission-matrix.md`, `resource-authorization.md` and `ADR-007`:

| Actor | Private read | DRAFT creation | DRAFT edit |
|---|---|---|---|
| Super Admin | Platform **read** only with live `project.read` | **DENY** | **DENY** |
| Government Admin | Active own ministry + active descendants and `project.read` | Allow inside active org when `project.create` granted | Active org, valid state and `project.update` (no approval here) |
| Agency Officer | Exactly their active agency | Own agency with `project.create` | Own agency with `project.update` |
| Project Manager | Agency-level read + live grant | Own agency; assign **self** manager | Only where `managerId = actor.userId` and agency/state/grant permit |
| Contractor | **DENY** until trusted `User↔Contractor` relationship exists | Deny | Deny |
| Inspector | If linked to their **own assigned inspection** and `project.read` | Deny | Deny |
| Citizen | No private internal project access | Deny | Deny |

Do not claim the schema has `Contractor.userId` or `Project.submittedBy`; both remain absent. Do not use an email match as contractor ownership. Do not implement approval SoD without `submittedBy`. Some seed roles possess operational grants absent from an actual role policy; **both live permission and hard resource/business role ceilings apply**. A stored wildcard is never a grant. Gov Admin may not see other ministry projects, even if the caller guesses their ObjectIds.

### Reuse Step 46 helpers correctly

The helpers' `readProject()` and `listProjects()` currently project only a few safe fields, while `projectReadFilter()` and `projectWriteFilter()` provide scope predicates. Build a dedicated `projects` service/router and reuse/extend validated scope logic. Be careful: a generic platform scope is **not** permission to perform operational writes; PM write requires `managerId`, agency filter, status and actor identity. Do not expose the helper's internal test harness on public URLs. Add focused tests showing that your new actual product routes obey the **same** constraints as the old harness.

## 3.5 Consistency, concurrency and audit integrity

- **Create:** If audit is mandatory for `project.create` in the agreed model, wrap project insert and append-only audit in one replica-set transaction. If the audit insert fails, roll back the project. Use concise `project.created` event, resource `PROJECT`, server actor ID, agencyId, requestId and permitted `status`/`agencyId` snapshot; no complete request body, JWT, secrets or geometry copies in audit.
- **Unique code:** existing unique projectCode index is declared in Mongoose but does not prove the remote Atlas index exists. Concurrent duplicate create must yield one success and one 409 under an actually-present unique constraint in disposable test DB. No silent duplication. If target index is not approved/present in Atlas, **BLOCK production write-readiness** rather than creating the index without authorization.
- **Edit:** require a safe nonnegative `revision` (projection from Mongoose `__v`), load/read the full authorized DRAFT state, validate intended merged state, then conditional atomic update filtered by `_id`, scoped agency/manager, `status: "DRAFT"`, `__v` and other relevant version/identity conditions, `$set` only allowlisted fields and `$inc: { __v: 1 }`. No-op is deliberate and tested. Two edits using the same revision produce 200 and 409. Preserve omitted fields; reject last-write-wins races.
- **Authorization race:** recheck actor status, `credentialEpoch`, live role, and permission close to write (inside transaction if using one). Agency deactivation/reparenting must not permit writes based on stale org scope; reuse Step 49 `AGENCY_HIERARCHY_LOCK` where necessary and compatible with its transaction/lock ordering. If the project update cannot safely serialize with a hierarchy change, record that specific race as BLOCKED instead of asserting perfect atomic authorization.
- **Write audit:** sensitive changes (especially geometry and dates) need a structured event with actor, target, timestamp and permitted minimal old/new snapshots. Existing AuditLog snapshot schema cannot hold arbitrary project title or raw geometry; do not silently add unapproved fields. Choose an accepted minimal audit event or explicitly document insufficient before/after trace; do not log raw personal data or full geometry.
- **Failures:** `401 AUTH_REQUIRED` or `SESSION_EXPIRED`; `403 FORBIDDEN`; `404 NOT_FOUND` for private IDOR; `400 VALIDATION_ERROR`; `409 CONFLICT` for stale revision/duplicate; `415 UNSUPPORTED_MEDIA`; `429 RATE_LIMITED`; `503 SERVICE_UNAVAILABLE`. Map known Mongo duplicate errors correctly; avoid 500 stacks or internal errors in client messages. Honor existing middleware error envelopes.
- **Read/write privacy:** No credentials, full raw DB docs, private geometry to unauthenticated clients, cross-agency list totals, or false public statistics. No automatic user JWT changes due to project edits.

---

# 4. Database and integration specifics

1. **Reuse Project/Milestone schemas**; no new collection unless a verified missing function forces it and owner approves. Do not create an unrequested second status model or new tenancy model.
2. Existing Project index declarations and `2dsphere` geometry are part of **schema definitions**. **Do not run `syncIndexes`, `createIndexes`, Atlas migrations, Atlas seed scripts, or use a live Atlas connection for tests.** Record existing index gaps without applying them. Mongoose `autoIndex` risk makes `npm run dev:api` unsafe if `apps/api/.env` points to Atlas.
3. Use `mongodb-memory-server` isolated **replica set** and repository's `apps/api/tests/helpers/mongo-memory.ts`, as prior steps did; verify exact helper export/current options.
4. Build API feature in `apps/api/src/modules/projects/` near models, e.g. `projects.schema.ts`, `projects.service.ts`, `projects.routes.ts`, `projects.types.ts`; minimal mount in `apps/api/src/routes/v1.ts`. Reuse `@infraos/shared-types` only for actual DTOs truly needed by both app packages, not duplicate contracts or disrupt fixed shared enums.
5. Code uniqueness is case-sensitive under current model regex. Use the exact model format and reject conflicting case/punctuation; do not switch to uncontrolled human-facing project ID generation silently.
6. No outside providers required: no LLM API, Geocoding, Google Maps, Mapbox token, email provider, object storage or external analytics. Date/geometry validation can run entirely in Node + current dependencies. GeoJSON geometry here is a backend field, not a demand to launch InfraMap or enable a third-party GIS service.
7. Necessary configuration is limited to existing API base URL/CORS/auth keys in approved test environment and disposable Mongo connection. Do not print or persist actual secrets, `.env`, `NEXT_PUBLIC_*` tokens or test credentials. Browser fixture and real isolated API evidence must be labeled separately.

### Suggested response envelope

Keep repository's existing shape; conceptually:

```json
{
  "success": true,
  "data": {
    "project": {
      "id": "<synthetic-id>",
      "projectCode": "INF-ROAD-101",
      "title": "Example Road Improvement",
      "status": "DRAFT",
      "agencyId": "<actor-agency-id>",
      "revision": 0
    }
  },
  "requestId": "<request-id>"
}
```

This is a **shape example**, not evidence of an implemented endpoint or data record. Use validated actual ObjectIds in tests, not literal angle-bracket placeholders.

---

# 5. Minimal Next.js frontend integration and UI / UX

The roadmap title prioritizes the **database/API foundation**. Build only enough private frontend to show that the API is connected and authorization behaves as intended, without prematurely building the advanced ProjectTrace screens.

**Minimum deliverable:** `/projects` private page mounted behind the existing guard, with a crisp ProjectTrace header, accessible scoped list/table of project code, title, type, status, owner agency and dates; search/filter/pagination options only for filters supported by backend; refresh and empty/error/401/403/503 states; a view link if detail route is implemented. The view may lead to a thin, read-only `/projects/[id]/overview` page using the approved architecture in `docs/ux/project-detail-architecture.md`, but **do not** scaffold empty finance/documents/AI tabs or claim those integrations exist. If the user requests zero frontend for Step 51 after comparing original roadmap, keep only the API and a documented client integration handoff; otherwise ensure one real private browser page is usable.

- Reuse `StaffWorkspaceShell`, `RouteAccessGuard`, `apiClient`, TanStack Query and existing data table components; only add the `/projects` nav link and scoped new files. Avoid global refactor. The existing `route-access.ts` already treats `/projects` as private.
- Use server-issued data, not seeded names or fake totals. UI visibility of button/role is advisory; Express enforces action and resource checks. Do not accidentally show create/edit forms unless the API and rule set actually support them and the original Step 51 requires their UI now. Prefer a read-only catalogue plus proof via Supertest for creation/edit foundation.
- Core responsive sizes 320, 360, 390, 768, 1024, 1440. Dense tables: horizontal-scroll container with clear affordance on narrow screens or stacked label/value card view. No page-level horizontal overflow. Paginated controls keyboard-operable.
- Semantic headings, labeled controls, clear status/error alerts, focus management, text alternatives, `aria-live`, reduced-motion support; readable contrast, visible focus, no color-only status.
- English/Sinhala/Tamil draft copy on protected route via a safe **in-page** locale toggle; **do not create `/si/projects` and `/ta/projects` private routes** without verifying route-access classifier, which currently treats locale-prefixed roots as public. Label translations as drafts when not reviewed by a native speaker.
- **Sri Lankan flag-inspired INFRAOS palette:** orange `#FF5B00` for primary emphasis, yellow `#FEB600` for pending/warning, maroon `#8C1F28` for critical/rejection, green `#279541` for accepted/healthy, paired with neutral slate/white backgrounds and existing Sora/DM Sans/Noto Sinhala/Noto Tamil typography. Test contrasting foreground colors rather than using white automatically on raw bright orange/green.
- Preserve `/`, `/si`, `/ta`, `/about`, `/login`, `/dashboard`, `/profile`, `/settings`, `/admin/users`, `/admin/agencies`, `/admin/roles`. **Never touch public Connected Future landing page or its common components for this step.**
- Production code currently has auth preview gating; do not weaken auth to force a signed-in browser demo. Build a safe disposable DB / local synthetic browser harness only after verifying environment is not Atlas; otherwise label real browser signed-in cases `BLOCKED` or `NOT RUN`.

---

# 6. Implementation order and time-efficient review strategy

**ONE complete Cursor implementation prompt in the companion execution file.** The items below are internal work phases, not separate prompts:

1. **Preflight:** Git/worktree, original roadmap if available, Step 50 handoff/status, locked requirements and code ownership. Preserve local files.
2. **Contract design:** DTOs, actor/agency scope, validators, output fields, error mapping, transaction/index proof decision. Mark scope-changing ambiguities.
3. **Service/API:** Build DRAFT create, list, detail and safe conditional edit. Reuse Step 46 helpers, existing middleware, agency checks, User/Role context, audit model and error envelope.
4. **Focused tests:** Disposable replica set + Supertest for legal and illegal behaviors, duplicate races, edit conflicts, data projection and downstream regression. Fix actual failing tests.
5. **Thin UI:** Protected /projects list, optional read-only detail as scoped above, draft EN/SI/TA labels, premium responsive design; focused UI/guard tests only.
6. **Concise handoff:** Document implemented vs BLOCKED/NOT RUN, source list, actual focused results, index precondition, known security/SoD gaps. **Do not repeatedly run full suites at each subtask.**
7. **One final separate phase QA prompt** once Step 51 is implemented: full API/web suites + types/lint/build + browser/accessibility/security/bugfix + final acceptance report.

**Do not silently fix earlier Step 50 onboarding/release blockers** unless a verified Step 51 integration truly depends on them and the owner authorizes the separate scope. Development in isolated tests is not production signoff.

---

# 7. Comprehensive verification requirements

## 7.1 Focused API + Mongo integration matrix

| ID | Scenario | Expected result |
|---|---|---|
| P51-01 | Anonymous/invalid JWT list/detail/create/update | 401, no data/write |
| P51-02 | Role has no current project.read/create/update grant | Respective 403; changed DB grant applies next request |
| P51-03 | Super Admin GET list/detail vs POST/PATCH | GET in-scope platform read; **write 403** even with forged/injected permission |
| P51-04 | Government Admin list of active ministry descendants | Only current org; another ministry absent, totals correctly scoped |
| P51-05 | Agency Officer list/create/edit | Exactly own active agency |
| P51-06 | Project Manager read own agency and edit assigned DRAFT only | Owner condition `managerId`, no edit on unassigned project |
| P51-07 | Contractor without User↔Contractor link; citizen | Private access denied, no leaked data |
| P51-08 | Inspector with own inspection link | Linked private read only; no private creation/edit |
| P51-09 | Forged role/agency/creator/manager/status/permission/financial fields in body | 400; no elevation or mutation |
| P51-10 | Create valid draft missing optional geometry/dates | 201 DRAFT, no spurious SUBMITTED |
| P51-11 | Concurrent same projectCode inserts | Exactly one 201, one 409 with actual unique constraint; no duplicate rows |
| P51-12 | Invalid schema/projectCode/budget minor units, geometry, polygon closure, longitude/latitude, dates | 400; no row inserted/changed |
| P51-13 | GET filtered list, count and paginated next page | Stable, matching authorized scoped results; no leakage |
| P51-14 | Malformed id; well-formed other agency id; impossible id | 400; 404; 404 |
| P51-15 | Two PATCH requests with same revision and valid actor | One 200; one 409; state remains consistent |
| P51-16 | PATCH in SUBMITTED/ACTIVE/COMPLETED/CANCELLED | 409, no status mutation |
| P51-17 | PATCH forbidden fields (budget, agencyId, projectCode, managerId, progress, status, risk, submittedBy) | 400, DB unchanged |
| P51-18 | Agency disabled/reparented while request in flight | No cross-org writes; lock/race proof or explicit BLOCKED limitation |
| P51-19 | DB/unavailable, audit failure and transaction start failure | 503 and no committed partially audited write |
| P51-20 | No real indexes approved for Atlas | Document production BLOCKED; **do not run migrations/index creations** |
| P51-21 | Role grant removed after token issued | Subsequent call denied; do not trust token grants |
| P51-22 | Existing Steps 39–50 permissions, role editor, admin, profile, login/logout/reset cases | No regressions |

Audit transaction tests must use an **isolated replica set**; do not run against Atlas. Verify Mongoose `autoIndex` configuration for test only. Use public model/DTO projections explicitly; no tokens/PII/private full documents in response or logs. Do not claim deterministic RoadSync conflict algorithm exists merely because geometry was stored.

## 7.2 Focused UI/browser matrix

- Signed out `/projects`: guard blocks private table; production preview shows preview state without data.
- Signed in to **isolated** API: real scoped project list/detail renders, filtering and pagination behave as server controls, own-agency vs other-agency records differ correctly. If that stack is unavailable, mark NOT RUN/BLOCKED and use Supertest for backend proof.
- Empty state and API 400/401/403/404/409/429/503: distinct helpful messages and safe retry/relogin behavior. No PATCH replay on token refresh.
- Narrow widths, longer Sinhala/Tamil strings, keyboard navigation, focus visibility, no page overflow, reduced motion.
- Log out then use Back; no previous project list in private cache or SSR. No sensitive data saved in localStorage/sessionStorage or query strings.
- Public landing and existing identity/admin pages unchanged; compare actual route snapshots where feasible.

## 7.3 Once-at-end phase suite

At repository root (real output and exit codes; historical Step 50 counts are **not Step 51 test results**):

```powershell
npm run test:api
npm run test:web
npm run type-check
npm run lint
npm run build
git diff --check
git status --short
```

`git diff --check` covers tracked edits only; manually inspect untracked code/tests/outputs before staging. Run focused tests during implementation; full suite **once in the final overall phase QA prompt** (rerun after real fixes as needed). A browser run using fixtures is fixture evidence, not proof of live staff login or a production deployment.

---

# 8. Pre/post review, acceptance criteria and manual demo

### Minimum post-review report

Create **one concise** `docs/reviews/step-51/END-OF-STEP-VERIFICATION.md` (a preflight subsection inside is enough; no bloated stack of reports). Include SHA, local branch state, tracked/untracked files, exact implemented endpoints, model assumptions and mismatches, test commands with exit/count, snapshot of secure GET/create/edit tests, current Roadmap alignment, pending indices/Atlas, release blockers, browser result types, and handoff. Mark `SAME-AGENT REVIEW` when agent did both implementation and review. Distinguish code committed on GitHub from tests reported locally.

### Hard acceptance gates

| Gate | Requirement |
|---|---|
| Model reuse | Project/Milestone established models remain authoritative; no unnecessary new schema |
| Routes | Only Step 51 authorized ProjectTrace list/detail/DRAFT create/edit, real mounted Express routes |
| Creation | Unique code, valid role/agency, required LKR minor budget, DRAFT-only, correct creator/manager attribution |
| Read | Current live `project.read` and server-side Mongo scope for every list/count/id |
| Edit | Current live `project.update`, role ceiling, actor+agency+manager/state/revision atomic predicate |
| Data protection | Strict allowlist, controlled projections, no direct status or finance/progress mutation |
| Integrity | Duplicate and stale revision races proved; audited atomic write or honest blocker |
| UI | Minimal useful protected ProjectTrace list, accessibility/responsiveness, EN/SI/TA draft strings |
| Scope | No RoadSync/finance/approval/milestone/AI expansions or public landing changes |
| Environment | No unauthorized Atlas queries, writes, seeds, migrations or index builds |
| QA | Focused tests, one overall QA pass, truthful PASS/FAIL/BLOCKED/NOT RUN |

Overall recommendation `APPROVE`, `REVISE` or `BLOCKED` with evidence. A same-agent recommendation is not an independent signoff and does not authorize Git/release/production Atlas actions. **When the actual unique code index is unverified on target Atlas, production write readiness is BLOCKED** even if isolated tests pass.

### Manual demonstration (isolated, synthetic only)

1. Prove test URI targets an ephemeral disposable replica set, no Atlas, and that necessary unique/geospatial indexes are present **in isolated DB only**. Use existing synthetic users or safe fixtures; never print credential values.
2. As Agency Officer with `project.create`, post a DRAFT project using valid unique code, LKR minor budget and GeoJSON. Confirm `201`, actor/agency correctly assigned, status `DRAFT`, safe audit row.
3. GET `/api/v1/projects`, GET `/:id`, filter status/type, check page count. Same-agency officer sees it; another agency officer cannot see it, and list totals do not leak it.
4. As Project Manager, verify manager-owned DRAFT edit works and unassigned project edit returns private 404; attempt `status: "APPROVED"`, `agencyId`, `financialProgress` in PATCH and confirm validation rejection.
5. Run two same-revision PATCH calls (one 200, one 409) and two same-code POSTs (one 201, one 409). Verify no partial project/audit record on simulated audit failure.
6. Verify Super Admin read allowed and write forbidden, contractor without trusted identity link denied, and Gov Admin cannot see outside active ministry.
7. Open protected `/projects` in a **safe** local integrated browser only if approved isolated API can run. Check EN/SI/TA, responsive 320/390/768/1440, keyboard, 401/403/503, logout/back. If no safe real browser stack, mark signed-in browser tests NOT RUN—not PASS.
8. Confirm `/`, `/si`, `/ta`, `/login`, `/dashboard`, `/profile`, `/settings`, `/admin/*` unchanged and no `Documents` touches.

---

# 9. Git approval checkpoints and safe runbook

**Do not execute the following without separate explicit approval for each stage.** Code implementation instructions are **not** blanket permission to commit or push.

**Inspection only (safe):**

```powershell
Set-Location 'C:\Users\ASUS\Desktop\InfraOS\InfraOS'
git status --short --branch
git branch -vv
git worktree list --porcelain
git log -1 --oneline
```

**Conditional branch setup** after safe verification and owner approval to change local branch (never force if dirty/diverged):

```powershell
git switch development
# Safely synchronize only if approved and no local work would be overwritten:
# git pull --ff-only origin development
git switch -c feature/projecttrace-foundation
```

**Proposed scoped commit** after Step 51 test/review **and separate explicit COMMIT approval** (modify path list to actual changed files; never `git add .`):

```powershell
git add apps/api/src/modules/projects/ apps/api/src/routes/v1.ts apps/api/tests/ \
        apps/web/src/app/projects/ apps/web/src/components/projects/ apps/web/src/lib/projects/ \
        apps/web/src/components/auth/staff-workspace-shell.tsx docs/reviews/step-51/
# Review staged diff carefully: git diff --cached --stat; git diff --cached --check
# git commit -m "feat(projecttrace): establish scoped project database and API foundation"
```

> The multiline sample above is **conceptual**; on Windows PowerShell, use one `git add` line or PowerShell backticks instead of a POSIX backslash. Stage only paths that actually exist and only Step 51 hunks. Keep `Steps.docx`, `Prompts/`, `.env`, tokens, user uploads, screenshot dumps and unrelated work out.

**Next separate approvals:** commit → push `git push -u origin feature/projecttrace-foundation` → create PR feature→`development` → merge that PR → only by another approved stable release PR promote `development`→`main`. Do not add a second worktree or project folder. Do not touch, move or delete `Documents`.

**Step 52 handoff:** The authoritative Step 52 wording has not been verified here. The Step 51 handoff should identify the next actual caption in `Steps.docx`, the delivered API/DTO/authorization contract, UI work still required for project creation/edit, missing Project `submittedBy` for future approval SoD, unapproved Atlas indexes, missing Contractor user linkage and unresolved Step 50 login/onboarding issues. **Never start Step 52 as part of this task.**

---

# 10. Primary source list (verified repository)

- `docs/reviews/step-50/END-OF-STEP-VERIFICATION.md` — merged source handoff and title reference
- `docs/planning/{requirements,business-rules,user-workflows}.md`
- `docs/architecture/projecttrace-architecture.md`; `docs/ux/project-detail-architecture.md`
- `docs/security/{roles-and-permissions,permission-matrix,resource-authorization}.md`
- `docs/adr/ADR-007-rbac-resource-authorization.md`
- `apps/api/src/modules/projects/{models/project.model.ts,models/milestone.model.ts,project.constants.ts}`
- `apps/api/src/modules/identity/authorization/{require-permission,resource-scope}.ts`
- `apps/api/src/modules/identity/auth/require-authenticated.ts`
- `apps/api/src/shared/database/{fields,geometry}.ts`
- `apps/api/src/database/seeds/demo/seed-projects.ts`; `apps/api/tests/resource-scope.test.ts`
- `apps/api/src/routes/v1.ts`; `apps/web/src/lib/auth/route-access.ts`; `apps/web/src/components/auth/staff-workspace-shell.tsx`
- Original local `Steps.docx` **not accessible to this generator**, verify in permitted Cursor workspace before implementation.

**End of development specification. This document generation does not implement project code, create branches or touch any database.**
