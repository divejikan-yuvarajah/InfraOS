# INFRAOS — Complete Enhanced Development Prompt
## Step 16: Shared Types, Constants & API Contracts

**Project:** INFRAOS — National Infrastructure Intelligence & Coordination Platform  
**Vision:** The Operating System for National Infrastructure  
**Lifecycle:** Plan → Coordinate → Approve → Build → Verify → Monitor → Complete → Maintain  
**Intended tools:** Cursor Agent or VS Code Codex  
**Implementation branch:** `feature/step-16-shared-types-api-contracts`  
**Integration branch:** `development`  
**Release branch:** `main`  
**Suggested commit:** `feat(contracts): establish shared types and API contracts`  
**Next scheduled step:** Step 17 — Final INFRAOS Brand & Color System

> **How to use:** This file contains **one full implementation specification** followed by **two short, ready-to-paste execution prompts** (one for Cursor Agent, one for Codex). Put this `.md` file at a discoverable path in the repository (for example `docs/prompts/INFRAOS_Step_16.md`), then paste either agent prompt at the end of this document into your coding agent. Execute **only Step 16**. The agent should read this entire file, not only the shorter launch prompt.

---

# 0. What Step 16 must accomplish

Act as a **Principal TypeScript Architect, API Contract Designer, Senior Next.js/Express Engineer, Domain Modeling Architect, Security Engineer, Integration Lead, and QA Reviewer**.

Implement a small, reliable, well-documented **shared contract layer** that keeps INFRAOS frontend, backend, feature owners, and future AI integrations consistent.

The goal is **not** to write another version of all database schemas. The goal is to decide and codify the stable shapes exchanged at boundaries:

```text
MongoDB / Mongoose internal models
               ↓
Express services / DTO mappers (later feature steps)
               ↓
REST API request / response contracts  ← source of truth from Step 16
               ↓
Next.js API client, forms and TanStack Query (later steps)

FastAPI AI (later) ↔ Node service → explicitly versioned AI payloads
```

Deliver:

1. A usable `packages/shared-types` TypeScript workspace package (or the **approved** existing equivalent).
2. Reusable **public wire types** and constants for foundational and approved domain entities.
3. Consistent API response, error, filtering, pagination and list contract conventions.
4. Correct separation between **database persistence**, **internal server-only data**, **authenticated DTOs**, and **public/citizen DTOs**.
5. Clear, security-aware **request/response contract documentation** for the future API modules.
6. Representative samples, tests, API/type compatibility checks and a contract drift report.
7. Updated workspace/build/export documentation and a complete post-step review.
8. No premature endpoint, authentication, UI, AI, or business-feature implementation.

**Success means an engineer can build a future ProjectTrace or RoadSync endpoint with an agreed request/response shape, shared status values, documented error handling, correct serialization, and no need to invent a duplicate type system.**

---

# 1. Locked INFRAOS product context

INFRAOS is a Sri Lankan infrastructure coordination platform. It connects government infrastructure projects and agencies with their geographies, plans, utility works, contractors, budgets, documents, inspections and post-completion assets.

Its central demo narrative is:

```text
Road resurfacing proposed
  → Water pipeline work detected on overlapping road / dates
  → RoadSync records a conflict candidate
  → Agencies coordinate and resolve schedules
  → Project proceeds with milestones and financial tracking
  → Risk and documentation are available
  → Inspector verifies progress
  → Completed project becomes maintainable asset
  → Citizen issues support maintenance follow-up
```

**Core modules and contract owners:**

| Module | Conceptual owner | Boundary types needed |
|---|---|---|
| Platform / Identity | Platform integration | users, roles, permissions, agencies, safe session DTOs |
| ProjectTrace | Team leader | projects, milestones, progress, lifecycle, project summaries |
| RoadSync | Team leader | work requests, spatial candidates, conflicts, coordination, resolutions |
| InfraMap | Map module member | GeoJSON, bounding boxes, map layers/features |
| AI Risk | AI module member | risk scores, factors, explanations, structured recommendations |
| DocTrace / RAG | Document/AI member | file metadata, processing states, RAG questions, referenced answers |
| Contractor & Finance | Finance member | contractor profiles, budget/payment summaries |
| Inspection | Assigned/shared owner | inspections, verification state, evidence metadata |
| Assets / Maintenance | Asset/finance owner | infrastructure assets, condition, maintenance |
| Citizen Portal | Citizen module member | safe public projects, issue submissions/statuses |
| Notifications | Shared | user notifications and targets |
| Reports | Shared | authorized filters and export job/result metadata |
| Audit / Governance | Platform integration | audit-safe summaries and access-sensitive internal records |

Seven roles remain **Super Admin, Government Admin, Agency Officer, Project Manager, Contractor, Inspector, Citizen**. Authorization will require server-side role **plus** organization/agency **plus** resource/assignment **plus** state checks. This step must not implement authorization logic or accidentally treat a type assertion as a permission check.

**Approved engineering stack:** Next.js/React/TypeScript, Tailwind/shadcn, Express/TypeScript modular monolith, MongoDB Atlas/Mongoose/GeoJSON, a separate later Python/FastAPI AI service. Use the existing npm workspace setup unless the repo already has an approved alternative.

**Approved brand direction (reference only, NOT a UI implementation task):**

| Semantic purpose | Color |
|---|---|
| Main brand / active action | `#FF5B00` orange |
| Pending / attention / warning | `#FEB600` yellow |
| High-risk / severe conflict | `#8C1F28` maroon |
| Completed / approved / healthy | `#279541` green |
| Neutral backgrounds | `#F8FAFC` and `#FFFFFF` |
| Main text | `#111827` |

Do not reinstate the previous navy/orange theme. Step 17 will build the design system; Step 16 should define **status meaning**, not build buttons, pages or theme tokens.

---

# 2. Non-negotiable scope boundaries

### In scope

- Inspect source of truth and actual code.
- Create/reconcile a minimal typed workspace package.
- Define stable **wire-level** domain types, status keys and permission-name references.
- Define reusable request/list/pagination/sort/error/response contracts.
- Define geospatial coordinate conventions and numeric units.
- Define API endpoint **contract catalog/documentation** for future modules.
- Provide appropriate Zod schemas for **selected shared wire formats only if approved and useful**.
- Establish explicit serialization rules and DTO security policy.
- Compile/test imports from both `apps/web` and `apps/api` where feasible.
- Provide tests for sample contract values, type exports and no-server-dependency boundary.
- Update documentation, review, Git handoff.

### Out of scope

- Real feature route/controller/service/repository implementations.
- Login, registration, refresh-token issuance, or RBAC enforcement middleware.
- Modifying actual MongoDB documents merely to fit a new abstract type.
- Building a second API client/framework or changing existing auth design.
- Implementing ProjectTrace/RoadSync calculations, conflict detection, coordination workflow or GIS page.
- Building React components, landing page, design system or dashboard.
- Implementing AI provider clients, embeddings, vector DB or RAG.
- Creating new Mongoose models or changing existing indexes just to satisfy an ideal contract.
- Running production DB operations, seeding or destructive migrations.
- Migrating to another database or introducing microservices.

If the actual code or earlier architectural decisions contradict a proposed type, **report the conflict, preserve the existing approved implementation**, and require a clear decision for changes that would alter the data/API meaning. Do not silently reconcile by rewriting working models.

---

# 3. Mandatory Git workflow — one branch for Step 16

## 3.1 Pre-branch safety checks

In the actual workspace, inspect first:

```bash
git status
git branch --show-current
git branch --list
git remote -v
git log -5 --oneline
```

If tracked/untracked changes belong to another unfinished task, **stop and report**. Do not stash, reset, commit, discard, or overwrite another person's work without approval.

Use the repository's documented workflow. Typical sequence:

```bash
git checkout development
git pull --ff-only origin development
git status
git checkout -b feature/step-16-shared-types-api-contracts
```

If `development` or `origin` is absent, or the branch already exists, **inspect and explain the situation** rather than forcing these exact commands.

**Do not automatically push, open PR, merge, cherry-pick, delete branches, force-push, or rewrite history.** Prepare the changes and give safe next commands. The user/team approves the merge:

```text
feature/step-16-shared-types-api-contracts
  → reviewed PR
  → development
  → post-merge checks
  → main only at approved stable release/checkpoint
```

## 3.2 Final branch handoff

Before suggesting a commit, run:

```bash
git status
git diff --check
git diff --stat
git diff --name-only
```

Also examine untracked files, staged changes, generated build output and lockfile changes. Compare with the branch base using an appropriate `git diff development...HEAD` **after** any authorized commits.

Suggested commit (after review and with approval):

```bash
git add <reviewed-files>
git commit -m "feat(contracts): establish shared types and API contracts"
```

Do not auto-stage everything with `git add .` if unrelated files are present.

---

# 4. PRE-STEP REVIEW — do this before coding

Read applicable approved documents. Paths are illustrative; follow equivalent actual locations where necessary:

```text
/docs/planning/project-scope.md
/docs/planning/requirements.md
/docs/planning/mvp-priorities.md
/docs/planning/business-rules.md
/docs/planning/user-workflows.md
/docs/architecture/system-architecture.md
/docs/architecture/module-boundaries.md
/docs/architecture/backend-architecture.md
/docs/architecture/frontend-architecture.md
/docs/architecture/roadsync-architecture.md
/docs/architecture/inframap-architecture.md
/docs/architecture/ai-rag-architecture.md
/docs/security/roles-and-permissions.md
/docs/security/permission-catalog.md
/docs/security/permission-matrix.md
/docs/security/resource-authorization.md
/docs/database/core-models.md
/docs/database/data-model.md
/docs/database/indexes.md
/docs/database/geospatial.md
/docs/team/module-ownership.md
/docs/team/git-workflow.md
CONTRIBUTING.md
CURSOR_STEP_EXECUTION_RULES.md (if present)
```

Inspect source code especially:

```text
package.json / lockfile / workspace configuration
packages/shared-types/
apps/api/src/modules/**/models, schemas, constants, types
apps/api/src/config, routes, middleware, shared
apps/web/src/types, services, lib/api, config
any prior Zod schemas or API response helpers
existing tests, tsconfig and package export conventions
```

Inventory **actual** (not imagined):

- Current enum/status values and enum names by module.
- Existing monetary representation: integer minor units, Decimal128, etc.; do not choose a different one without noting it.
- ObjectId serialization and timestamp use.
- Existing GeoJSON shapes and coordinate order.
- Existing route naming and response envelope conventions.
- Step 12 role/permission seed keys and scope rules.
- Any existing public DTO or API types.
- Any package already supplying contracts; do not duplicate it.
- Any existing `packages/shared-types` implementation from Step 7.

### Required pre-step output to the user

```text
STEP 16 — PRE-STEP REVIEW

Current Git branch:
Working tree status:
Latest integrated steps confirmed:
Existing shared package:
Existing web types:
Existing API types:
Existing model enums:
Existing response/error format:
Money representation found:
ObjectId/date serialization found:
GeoJSON representations found:
Permission catalog source:
Known missing docs or dependencies:
Conflicts / questions:
Proposed contract ownership:
Files proposed for change:
Implementation plan:
  1.
  2.
  3.
  ...
```

If previous Steps 13–15 were not actually implemented/integrated, **do not claim they were**. Ask whether to proceed with a documentation-only contract pass or resolve the blocker; do not fabricate models.

---

# 5. Shared package architecture

## 5.1 Preferred location

Use the established workspace package, commonly:

```text
packages/shared-types/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts
│   ├── primitives.ts
│   ├── api/
│   │   ├── responses.ts
│   │   ├── errors.ts
│   │   ├── pagination.ts
│   │   └── index.ts
│   ├── identity/
│   │   ├── roles.ts
│   │   ├── users.ts
│   │   ├── agencies.ts
│   │   └── index.ts
│   ├── projects/
│   │   ├── project.ts
│   │   ├── milestone.ts
│   │   ├── progress.ts
│   │   └── index.ts
│   ├── roadsync/
│   │   ├── work-request.ts
│   │   ├── conflict.ts
│   │   ├── coordination.ts
│   │   └── index.ts
│   ├── geo/
│   │   ├── geojson.ts
│   │   ├── map.ts
│   │   └── index.ts
│   ├── contractors-finance/
│   ├── documents/
│   ├── inspections/
│   ├── assets/
│   ├── citizen-issues/
│   ├── notifications/
│   ├── ai-risk/
│   ├── reports/
│   ├── audit/
│   └── constants/
└── tests/
```

This is a **target design**, not a command to create dozens of empty files or folders. Create only useful files and keep module boundaries intelligible. The exact filename layout may follow already-approved conventions.

## 5.2 Build and exports

- Use the same TypeScript/module strategy already chosen by the monorepo (ESM/CJS, bundler resolution, etc.).
- Ensure exported contracts are resolvable by **both** Next.js and the Node backend without relying on accidental TS path-alias magic.
- Package name should follow existing conventions; if unset, a sensible example is `@infraos/shared-types`.
- Define `types`, `exports` and build scripts correctly for actual runtime/value exports.
- If the package exports runtime constants/Zod schemas, ensure these are built/emitted as JavaScript. A `.d.ts` export alone is insufficient for runtime values.
- If a type-only module is used, prefer `import type` to avoid runtime coupling.
- Avoid importing React, Next.js, Express, Node-only utilities, Mongoose, MongoDB driver, private env config or Python code into the shared package.
- Do not expose private internal path aliases or depend on direct `../../apps/api/src/...` imports.
- Keep tree-shaking and bundling simple; do not introduce a second toolchain without need.
- Add or correct root workspace scripts **only if they actually run**.

## 5.3 Dependency rule

Ideally the shared package depends on **TypeScript only** (and Zod only if the approved design needs actual shared runtime validation). No Mongoose/Express/Next/Node SDKs. Never import database models into the browser.

## 5.4 Barrels and cycles

- Use clear public exports.
- Avoid indiscriminate `export *` collision and circular imports.
- Keep import graph acyclic.
- Do not place every type in a single 2,000-line `types.ts`.
- Add a README showing recommended web/API import statements.

---

# 6. Contract layers — decide and document clearly

There are at least four distinct layers:

| Layer | Example | Shared package? | Can browser receive it? |
|---|---|---|---|
| Persistence/internal | `IProjectDocument`, Mongoose model, token hash | **No** | **No** |
| Server domain | authorization context, internal approval state/evidence | Usually **No** | **No** |
| Authenticated wire DTO | `ProjectDetailDto`, safe user profile | **Yes** | Only after server authorization |
| Public wire DTO | `PublicProjectDto`, permitted citizen issue receipt | **Yes** | Yes, only approved fields |

**Important:** A TypeScript interface never enforces access by itself. The backend must later map from storage/domain objects into safe DTOs and check permissions before responding.

Do not export these sensitive internal fields as ordinary public user DTOs:

```text
passwordHash
refreshSession.tokenHash
reset tokens
email verification secret/token
secret configuration
unredacted audit snapshots
private document storage keys/signed URLs as permanent fields
internal-only financial comments
AI provider keys and confidential model prompts
```

A public project cannot be the full internal Project with optional properties. Define a **distinct** intentionally reduced DTO. Likewise define separate internal/admin views from public/citizen views.

---

# 7. Primitive and serialization contracts

Build small types or schemas for **wire-level** values; keep runtime validation at appropriate boundaries.

## 7.1 Identifiers

For JSON contracts, MongoDB ObjectIds should be represented as **strings**:

```ts
export type EntityId = string;
```

If additional branded string types add complexity, do not use them. Backend must validate incoming ID format later. Never serialize raw Mongoose ObjectId instances across the API.

## 7.2 Dates

- Persistence remains BSON `Date`.
- API JSON uses ISO 8601 date-time strings, preferably UTC `Z`, such as `2026-10-15T08:30:00.000Z`.
- Date-only values (`YYYY-MM-DD`) require a separate explicit type/convention if truly needed.
- Document inclusive/exclusive semantics for timeline overlaps.
- Do not type a JSON timestamp as `Date` in DTOs.

Example illustrative types:

```ts
export type IsoDateTimeString = string;
export type IsoDateString = string;
```

Do not mistake TypeScript aliases for runtime validation.

## 7.3 Monetary values

**Read the actual Step 13 decision first.** Do not assume currency amounts are floating JS numbers.

The wire contract must preserve agreed precision:

- If integer minor units were chosen: encode amount consistently with explicit unit and currency (`LKR`).
- If Mongoose Decimal128 was chosen: define an exact, non-lossy JSON representation (often a decimal string) and conversion rules.
- Document safe transformations; do not stringify once and parse floats elsewhere.
- No negative budgets/payments/maintenance costs unless a separately defined refund/adjustment representation exists.

Example **illustrative only; adapt to actual architecture**:

```ts
export interface MoneyDto {
  amountMinor: number;
  currency: 'LKR';
}
```

Do not implement this example if it contradicts existing models.

## 7.4 Scores and progress

Define consistent meanings and ranges:

```text
physicalProgress: 0–100 percentage
financialProgress: 0–100 percentage
risk score: 0–100 if Step 13 locked it
asset health score: 0–100 if Step 13 locked it
```

Document whether risk is numeric, category or both; no conflicting 0–1 and 0–100 conversions.

## 7.5 Distances and durations

- RoadSync distance units should be explicit, preferably **meters**.
- Schedule overlap should have a named unit (e.g. whole calendar days) with clear inclusive-day policy.
- Do not use `distance: number` without stating units where confusion is likely.

## 7.6 Nullability and omitted values

Decide and document:

- `undefined`/omitted versus `null` for unknown/missing fields.
- `PATCH` partial semantics: omitted means unchanged; explicit `null` only clears nullable fields when authorized.
- No surprise `undefined` values in JSON responses.
- Do not send `passwordHash: undefined` and assume that makes a whole persistence object safe.

---

# 8. Enumerations and constants — **one authoritative source**

## 8.1 Verify before defining

The shared package must match **approved and actually implemented** enum values. The following are prompts for verification, **not permission to overwrite existing accepted enum strings**:

| Domain | Candidate keys to reconcile with code |
|---|---|
| Roles | `SUPER_ADMIN`, `GOVERNMENT_ADMIN`, `AGENCY_OFFICER`, `PROJECT_MANAGER`, `CONTRACTOR`, `INSPECTOR`, `CITIZEN` |
| Projects | `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `ACTIVE`, `ON_HOLD`, `DELAYED`, `COMPLETED`, `CANCELLED` |
| Milestones | `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`, `DELAYED`, `BLOCKED`, `CANCELLED` |
| Work requests | `DRAFT`, `SUBMITTED`, `PLANNED`, `APPROVED`, `ACTIVE`, `COMPLETED`, `CANCELLED` |
| Conflicts | `OPEN`, `COORDINATION_PENDING`, `UNDER_REVIEW`, `RESOLVED`, `CLOSED`, `DISMISSED` |
| Severity | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| Coordination | `PENDING`, `ACCEPTED`, `COUNTER_PROPOSED`, `REJECTED`, `CANCELLED` |
| Document processing | `NOT_STARTED`, `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `UNSUPPORTED` |
| Inspection | `SCHEDULED`, `IN_PROGRESS`, `SUBMITTED`, `VERIFIED`, `REQUIRES_REVIEW`, `REJECTED`, `CANCELLED` |
| Maintenance | `PLANNED`, `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `OVERDUE`, `CANCELLED` |
| Citizen issues | `SUBMITTED`, `ASSIGNED`, `IN_REVIEW`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`, `REJECTED` |
| Payments | `PENDING`, `APPROVED`, `REJECTED`, `PAID`, `CANCELLED` |
| AI risk levels | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` only if consistent with schema |

If existing code differs, produce a **Contract Drift Table** and choose the accepted source of truth. Do not fix a difference merely by hiding it with a type cast.

## 8.2 Runtime constants strategy

For contract-relevant statuses, use a single maintainable typed definition where practical. Example pattern:

```ts
export const PROJECT_STATUSES = [
  'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED',
  'ACTIVE', 'ON_HOLD', 'DELAYED', 'COMPLETED', 'CANCELLED',
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
```

But **adapt to the existing Step 13 enum constants**. Prefer importing the shared constant in models/services later rather than maintaining duplicate disconnected arrays, as long as package dependency boundaries stay clean. If conversion cannot safely happen in this step, document mapping and add a drift test; do not rewrite all models.

## 8.3 Permissions

Use Step 4 permission catalog as authority, e.g. `project.create`, `project.read`, `roadsync.conflict.resolve`, `document.upload`, `inspection.verify`, etc. Do not invent permission keys and seed them as if approved. Shared code can define display-safe permission key names for consuming UI, but **backend checks the user and resource**.

Separate these concepts:

```text
Permission key → may attempt a type of action
Resource scope → may act on this particular record
Workflow state → is the action allowed now
```

No blanket `isAdmin` bypass in shared types.

## 8.4 Maps and statuses

Define semantic status labels for UI use only when truly shared. Status color tokens are Step 17's responsibility. No importing Tailwind or React components here. If a semantic status category is needed, use stable labels/keys without assuming a palette determines permissions.

---

# 9. API response envelope, error contracts and conventions

## 9.1 Base REST path

Existing architectural base:

```text
/api/v1
```

Follow the Step 9 envelope if already implemented. Approved conceptual forms:

```json
{
  "success": true,
  "data": { "id": "507f1f77bcf86cd799439011" }
}
```

```json
{
  "success": false,
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "Project not found",
    "details": null
  }
}
```

Generic TypeScript **illustrative** shape:

```ts
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown | null;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
```

Reconcile with the actual Step 9 code. Do **not** create a second conflicting response helper implementation.

## 9.2 Errors

Define stable public error codes, using existing codes where present:

```text
VALIDATION_ERROR
AUTH_REQUIRED
SESSION_EXPIRED
FORBIDDEN
INSUFFICIENT_PERMISSION
RESOURCE_SCOPE_DENIED
RESOURCE_NOT_ASSIGNED
RESOURCE_NOT_FOUND or MODULE_NOT_FOUND where approved
INVALID_STATE_TRANSITION
DUPLICATE_RESOURCE
CONFLICT_DETECTED (if specific business use requires it)
RATE_LIMITED
SERVICE_UNAVAILABLE
INTERNAL_ERROR
```

Use consistent snake-case or established project naming; do not renumber/rename live codes casually.

Errors must never include stack traces, DB strings, credentials, signed URLs, confidential source text or tokens. Document expected HTTP statuses: 400/401/403/404/409/422/429/500/503 when appropriate; don't force arbitrary changes in this step.

## 9.3 Pagination

Decide a single list convention based on the existing API architecture, e.g.:

```json
{
  "success": true,
  "data": [ { "id": "p1", "title": "Demo Road Upgrade" } ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

This is **an example** and should not be forced if a different format was approved. Clarify:

- one-indexed or zero-indexed `page`
- allowed/default `limit`, hard maximum
- `total`, `totalPages` semantics
- stable sort tie-breaker; `createdAt` plus `_id` when relevant
- empty list representation: `data: []`
- whether cursor pagination is deferred

Use consistent filter query keys rather than inventing a new list structure for every module.

## 9.4 Sorting and filtering

Types should not allow arbitrary MongoDB operators or arbitrary model paths from clients. Document **allowlisted** per-route sort/filter fields later (e.g. project `status`, `agencyId`, `plannedEndDate`; RoadSync conflict `severity`, `status`). The shared contract should represent allowed values, not raw database query objects.

## 9.5 Requests and commands

For future mutation DTOs distinguish:

- `CreateProjectRequest` (permitted user-editable fields)
- `UpdateProjectRequest` (only safely editable subset)
- `ApproveProjectRequest` (command with authorized workflow; not arbitrary `status` write)
- `CreateWorkRequestRequest`
- `ResolveConflictRequest`

**Do not** generate request DTOs with `Partial<ProjectDto>` for sensitive operations. Otherwise clients could submit `approvedBy`, `riskScore`, `budget` or `agencyId` without explicit restrictions.

## 9.6 Idempotency and concurrency

Document considerations for eventual approval/payment/conflict-resolution endpoints:

- transaction-sensitive actions should not double-apply on retry;
- use an idempotency key **only if** design chooses it for specific endpoints;
- use `updatedAt`, version/ETag or other optimistic-concurrency approach only when approved;
- do not invent a message-broker/event store to solve this.

## 9.7 Contract response shape tests

Add tests verifying error and success discriminants (`success: true | false`), samples, pagination, literal statuses, and JSON-only data shapes. Do not mark a sample valid if the exported type differs.

---

# 10. Module-by-module shared contract requirements

Build only the **small, justified wire types** expected by existing approved workflows. Avoid boilerplate for every imaginable future field. Below are coverage requirements; use actual Step 13 model fields as authority.

## 10.1 Identity / Agency

Provide or document:

- `SafeUserDto` (ID, name, email only for authorized self/admin views, role/agency references, status if permitted).
- `CurrentUserDto` / auth summary **without** password hashes, token hashes, refresh session or credentials.
- `PublicRoleKey`/role keys and `PermissionKey` typed to approved permissions.
- `AgencySummaryDto` / internal agency detail DTO.
- `UserStatus`, `AgencyStatus`, `AgencyType` values as actually approved.
- Separate `AdminUserDto` only when required by planned user-management screens; no broad user-data leakage.

**Do not** create sign-in/refresh endpoints or actual auth cookies in Step 16.

## 10.2 ProjectTrace

Provide/update:

- `ProjectSummaryDto` (safe fields for project lists).
- `ProjectDetailDto` (internal, scoped authorized view).
- `PublicProjectDto` (limited public information only).
- `ProjectStatus`, `ProjectType`, `ProjectPriority` if applicable.
- `CreateProjectRequest`, `UpdateProjectRequest` only with client-editable fields.
- `ProjectMilestoneDto`, `CreateMilestoneRequest`, `UpdateMilestoneRequest` as warranted.
- `ProgressSummaryDto`, numeric percentage semantics.
- `ProjectApprovalAction`/request contracts as **planned**, not implemented endpoints.
- Dates, agency/manager/contractor **ID references** and safe descriptive names as explicit DTO fields where needed.
- `ProjectRiskSummaryDto` may be a projection/link to latest assessment; avoid duplicating historical risk data.
- `financialProgress` must align with real money strategy; no uncontrolled derived truth.

Critical invariant: `ProjectDto` is not directly the Mongoose `Project` document.

## 10.3 RoadSync

Types must permit:

- `WorkRequestDto`, `CreateWorkRequestRequest`, work status/priority/type.
- `ConflictDto`, severity/status/type, work-request IDs (and optionally safe summaries).
- `CoordinationRequestDto`, from/to agency references, response/status.
- `ConflictResolutionRequest`, decision, notes and relevant proposed schedule fields.
- `SpatialConflictCandidateDto` **as a proposed internal result** if needed, not a claim that an engine already exists.
- `ConflictAnalysisSummaryDto` listing deterministic factors (distance in meters, spatial relationship and overlap duration).
- `RoadSyncDashboardSummaryDto` only if a genuine planned consumer exists.

Keep **deterministic conflict results** conceptually separate from **AI recommendation DTOs**. A model recommendation is not an authorized resolution.

## 10.4 GeoJSON / InfraMap

Use standard supported forms (match Step 14 code):

```ts
export type LngLat = readonly [longitude: number, latitude: number];

export interface GeoPoint {
  type: 'Point';
  coordinates: LngLat;
}

export interface GeoLineString {
  type: 'LineString';
  coordinates: readonly LngLat[];
}

export interface GeoPolygon {
  type: 'Polygon';
  coordinates: readonly (readonly LngLat[])[];
}

export type InfraGeometry = GeoPoint | GeoLineString | GeoPolygon;
```

**Illustrative:** adapt readonly/mutable structure and exports to actual validator/serializer. Coordinate order is **longitude, latitude**, WGS84. The shared layer should expose safe wire types and optionally focused validators; it must not install a GIS engine or implement the spatial conflict algorithm.

Map contracts to consider:

- `BoundsQuery` or `MapViewportQuery` with explicitly documented order such as `[west, south, east, north]`.
- `MapFeatureDto` with limited feature properties and safe IDs.
- `MapLayerKey` for approved project/work/conflict/asset layers.
- `MapQueryFilters` and clear status restrictions.

No whole-database map payloads or unrestricted internal fields.

## 10.5 Contractors and finance

- `ContractorSummaryDto`, `ContractorDetailDto` (scope-aware).
- `ProjectBudgetSummaryDto`, `PaymentDto`, payment statuses/types.
- `CreatePaymentRequest`, `ApprovePaymentRequest` as separate future command shapes; no client authority to set `approvedBy` freely.
- All monetary types preserve Step 13 precision/currency rules.
- Contractor risk/performance scores are **indicators**, not allegations.
- No payment card/bank credentials or sensitive account details in shared DTOs.

## 10.6 Documents / DocTrace / RAG

- `ProjectDocumentDto` with filename, category, size, MIME where permitted, processing status, creator and timestamps.
- `DocumentProcessingStatus`, `DocumentType`, `DocumentVisibility` only if approved.
- `DocumentUploadMetadataRequest` as a future upload metadata contract; do not expose storage secrets.
- `DocumentChunkReferenceDto` with document/page/chunk/section citation identifiers, where relevant.
- `RagQuestionRequest` (authorized project/document scope + question) and `RagAnswerDto` (answer, cited references, uncertainty/no-answer indicator).
- AI response must be labeled as generated and support no-evidence/no-answer states.
- Never include confidential document text in public schemas.
- Do not choose a vector DB or add embeddings in this step.

## 10.7 Inspections

- `InspectionDto`, `InspectionStatus`, date/progress/notes.
- `InspectionEvidenceDto` as **metadata** (not binary bytes).
- `CreateInspectionRequest`, `SubmitInspectionRequest`, `VerifyInspectionRequest` where planned.
- Representation distinguishes contractor-submitted progress and inspector-verified progress.
- No automatically accepted AI-estimated progress.

## 10.8 Asset lifecycle and maintenance

- `AssetSummaryDto`, `AssetDetailDto` (source project, category, status/condition, permitted location/geometry).
- `MaintenanceRecordDto`, `MaintenanceStatus` and `CreateMaintenanceRequest` where needed.
- Asset health score numeric bounds/uncertainty per accepted data model.
- Completion-to-asset conversion should remain a service/workflow command later, not a request setting `sourceProjectId` without checks.

## 10.9 Citizen issues / public portal

- `PublicProjectDto` and limited public map feature.
- `CitizenIssueCreateRequest`, safe citizen receipt/own-issue DTO.
- `CitizenIssueStatus`, categories, priority.
- Citizen identity and photographs must not be leaked into a general public feed.
- Internal routing/agency assignment fields must be separated from public issue status.

## 10.10 Notifications

- `NotificationDto`, `NotificationType`, `isRead`, optional `readAt`, target resource ref with allowlisted types.
- `MarkNotificationReadRequest` only where needed.
- Never let clients inject arbitrary model names for polymorphic `resourceType`.

## 10.11 Risk intelligence / AI

- `RiskAssessmentSummaryDto`, full authorized `RiskAssessmentDto` where appropriate.
- Consistent score/range fields, factors, recommendations, model version and `assessedAt`/`createdAt`.
- `AiRiskRequest` should carry approved data only and avoid exposing full private entities to clients.
- Explicit AI-service request/response contract **can be internal-only** and documented apart from public browser types.
- A risk recommendation never updates project approval/status automatically.

## 10.12 Reporting and audit

- `ReportFilterDto` / report category keys based on approved reports and authorized visibility.
- A future export contract should not promise files or jobs until implementation details are established.
- `AuditLogSummaryDto` can be restricted to authorized admin/auditor screens; full raw old/new payloads stay internal and redacted.
- Do not put sensitive audit internals into generic public exports.

---

# 11. API endpoint contract catalog — documentation, NOT implementations

Create a maintained inventory for future API surfaces. **Use actual approved route docs first**, and mark all unimplemented routes `PLANNED` rather than claiming they work.

At minimum cover groups:

```text
/api/v1/auth
/api/v1/users
/api/v1/roles
/api/v1/agencies
/api/v1/projects
/api/v1/milestones or /projects/:projectId/milestones
/api/v1/work-requests
/api/v1/conflicts
/api/v1/coordination
/api/v1/map
/api/v1/contractors
/api/v1/payments
/api/v1/documents
/api/v1/inspections
/api/v1/assets
/api/v1/issues
/api/v1/notifications
/api/v1/reports
/api/v1/audit
/api/v1/ai
```

**Important:** A route group listed here does not mean an endpoint exists. Reconcile with Step 3 `/api/v1` route outline and Step 5 route architecture.

For each **actual or planned high-priority endpoint**, document the following without inventing finished code:

| Field | Required definition |
|---|---|
| Contract name | Human-readable purpose |
| Method and path | Exact agreed REST naming where available |
| Implementation state | `IMPLEMENTED` / `PLANNED` / `DEFERRED` |
| Priority | P0 / P1 / P2 / P3 |
| Consumer | Dashboard, project detail, RoadSync etc. |
| Auth requirement | Public / authenticated / internal service |
| Permission key | From Step 4 if available |
| Resource scope | Agency, assigned project, own record, public, etc. |
| Request | Params/query/body references |
| Success | Response DTO + status + pagination if applicable |
| Errors | Error codes + HTTP statuses |
| Validation | Relevant runtime schema needed later |
| Notes | Audit, privacy, idempotency, conflict, versioning |

For P0, give meaningful detail on representative flows:

1. List/create/get/update project.
2. Submit/approve project as separate authorized commands where approved.
3. List/create/update milestone/progress.
4. Create work request and list nearby candidate results (when implemented).
5. List/view conflicts and send coordination responses.
6. Resolve conflict and retrieve coordination history.
7. Fetch scoped map layers by bounding box.
8. Current-user safe profile and agency/role lookup when implemented.

For P1, document shapes at suitable depth without overbuilding: documents, risk, finance, inspections, citizen issues, notifications. Label unimplemented API definitions explicitly.

**No Swagger generator or stub endpoint is mandatory in Step 16.** If OpenAPI 3.x was previously chosen, generate/update a valid **contract-only** document or minimal selected spec; otherwise prefer concise Markdown. Never publish auto-generated docs that falsely list routes as live.

---

# 12. Contract versioning and compatibility

Document:

- API base version `/api/v1`.
- Which changes are **breaking**: renaming required fields, changing enum values, changing money units, changing date serialization, changing success envelope, broadening public exposure.
- Which changes are normally **non-breaking**: optional fields, new distinct endpoints, new error codes only when clients have a safe fallback.
- How to evolve shared package exports without breaking teammates.
- PR review policy for shared contract changes.
- Deprecated keys/paths should be documented; do not silently remove working exports.
- Avoid an elaborate schema registry or event versioning system.

Create a simple contract change checklist:

```text
Contract changed?
→ update types
→ update runtime validation if any
→ update API examples/docs
→ update backend serializer/consumer when actually implemented
→ update frontend consumer when actually implemented
→ add migration note for breaking change
→ run web/API typecheck + tests
→ shared-file owner review
```

If contract changes would require editing unrelated feature work, stop and flag for coordinated PR rather than hiding the change.

---

# 13. Runtime validation boundary — clarify Zod vs types

**Types are erased at runtime.** Define a clear policy:

1. TypeScript shared DTOs: compile-time communication contract.
2. Express request validation (later endpoint steps): authoritative runtime validation, based on Zod or approved equivalent.
3. Mongoose validation: persistence integrity, **not** public request authorization.
4. Frontend form Zod: usability, **not** security.
5. FastAPI responses: untrusted external/service payloads; runtime validate when integrated.

Where a **small subset of public wire schemas** benefits from shared runtime Zod, add it only if it does not drag server dependencies into browser bundles or duplicate existing validation. Reuse existing package policy. Do not put full Mongoose documents, `populate()` logic or database queries into shared Zod schemas.

**Consider** initial shared runtime validators for:

- GeoJSON point/line/polygon payloads (if approved).
- pagination query shape.
- ISO datetime or string format as appropriate.
- discriminated success/failure response **examples**.

Do not reimplement every endpoint schema during this foundational step.

---

# 14. Shared constants must remain small and purposeful

Create/import only constants that need to match across app boundaries:

- role keys (from Step 4/12)
- permission identifiers where approved
- lifecycle statuses and severity keys (from Step 13)
- infrastructure and work types (from Step 13)
- allowed map layer keys / geometry types
- pagination defaults/maximum if locked in architecture
- safe API error code keys
- file processing state/type keys (only where needed)
- ISO currency key/unit only if approved

Do **not** put secrets, API endpoints with production URLs, feature flags, Tailwind tokens or random UI values into the package. UI color palette remains Step 17.

---

# 15. Contract usage examples and compile-time proof

Include a few **short, compiling** examples (in documentation/tests, not unnecessary app features):

1. Backend function declares a `ProjectSummaryDto` return type, maps explicit safe fields, with `_id.toString()` and `Date.toISOString()`.
2. Frontend consumes `ApiResponse<ProjectSummaryDto[]>` with correct success/error narrowing.
3. A RoadSync `WorkRequestDto` accepts `LineString` with `[longitude, latitude]` points.
4. Permission key names are correctly imported but **never interpreted as backend authorization**.
5. An example list response includes valid pagination metadata.

Use demonstrative fixture values; do not copy real government data.

If integration-example code requires importing real backend modules, keep it in suitable tests inside the app instead of polluting the shared package. Avoid making tests depend on live Atlas.

---

# 16. Contract tests, quality gates and drift detection

## 16.1 Static architecture tests

Verify shared package source has **no imports of**:

```text
mongoose
mongodb
express
next
react
node:fs
node:process
private environment modules
backend source outside package
```

The exact ban for Node standard library may be limited to runtime wire modules; allow build/test tooling if appropriate. No secret/credential constants.

## 16.2 Type and runtime tests

At minimum test:

- package builds and exports resolve.
- `apps/web` imports shared type(s) cleanly.
- `apps/api` imports shared runtime constant(s) cleanly (if any exist).
- status literals match the approved database enums.
- role keys/permission names match existing source of truth.
- sample ProjectTrace DTO serialization yields strings/JSON-safe values, not raw ObjectId/Date.
- `ApiResponse<T>` properly narrows success/failure in TS.
- nullability and optional properties make sense for project before contractor assignment.
- representative GeoJSON valid coordinates are accepted by chosen validator if any.
- invalid GeoJSON payloads fail the applicable runtime validation when implemented.
- citizen/public DTO examples have no restricted internal fields.
- money units/score scales are consistent with Step 13.

If a test needs a DB, use approved isolated test DB; ideally Step 16 contract tests require **no DB/network**.

## 16.3 Contract-drift report

Create/update a table (docs or review output) comparing:

```text
Contract symbol / field
Actual model or source
Contract value / type
Match? YES/NO
If mismatch, reason
Required follow-up owner
```

Mandatory drift checks:

- project/work/conflict/coordination statuses
- role keys/permissions
- money representation
- GeoJSON supported geometry
- progress/risk score ranges
- datetime serialization
- public vs internal field exposure
- API success/error envelope

Do not claim a drift check passed unless it was inspected or tested.

## 16.4 Commands

Run existing appropriate commands; use actual script names from the repository rather than inventing working commands:

```bash
npm run lint
npm run type-check
npm run test
npm run build
```

Also run package-specific build/tests as configured, for example:

```bash
npm run build --workspace=@infraos/shared-types
npm run type-check --workspace=@infraos/shared-types
```

These are examples; use the actual package name/scripts. If no tests were configured, create a minimal useful test mechanism consistent with the monorepo instead of reporting fictional success.

When checks fail, distinguish:

```text
Introduced by Step 16
Pre-existing unrelated
Blocked by missing credentials/service
Not configured
```

Fix Step 16 defects; don't hide red builds or refactor unrelated projects without approval.

---

# 17. Security and privacy review — mandatory

Inspect actual exports for leaks, not just design intent.

### Sensitive data prohibitions

- No raw `UserDocument`/Mongoose model type as browser public contract.
- No password or refresh token hashes in `SafeUserDto`.
- No entire confidential contract document data in `PublicProjectDto`.
- No internal agency notes in citizen map/project response.
- No arbitrary `recordId` granting access; backend still checks resource scope.
- No `createdBy`, `approvedBy`, `agencyId` user-supplied values in mutation DTOs unless explicitly permitted.
- No raw `oldValue/newValue` audit data in public/generic DTO.
- No insecure browser access to private signed files.
- No `any` to silence mismatches in critical DTOs.
- No `as unknown as` to make drift tests pass.
- No `JSON.stringify(MongooseDocument)` as an implicit safe serializer.
- No secrets in constants, sample responses, tests or docs.

### Role and scope tests to plan for later

- Project manager: project assigned/scope check.
- Agency officer: own-agency work request.
- Contractor: assigned project only; cannot approve own work/payment.
- Inspector: assigned inspection; not automatic finance access.
- Citizen: public data + own issue only.
- Government admin: organization scope; not universal access.

**This step only defines these contract/security expectations.** Enforcement is implemented/tested in authentication and feature steps.

---

# 18. Documentation deliverables

Create or carefully update appropriate files (match existing repo structure and avoid duplicates):

```text
packages/shared-types/README.md
packages/shared-types/package.json
packages/shared-types/tsconfig.json
packages/shared-types/src/index.ts
packages/shared-types/src/<module files as actually needed>

/docs/api/contract-standards.md
/docs/api/response-and-error-format.md
/docs/api/pagination-and-filters.md
/docs/api/endpoint-contract-catalog.md
/docs/api/contract-examples.md
/docs/database/serialization-boundaries.md
/docs/security/public-vs-internal-data-contracts.md
/docs/architecture/shared-contracts.md
/docs/testing/contract-test-plan.md
```

**These paths are suggested, not a requirement to create duplicate docs.** Use existing approved taxonomy wherever it already exists.

Documentation must answer:

- Which types belong in shared package and which stay backend-only?
- Which module owns each contract?
- How are IDs, dates, money, scores and GeoJSON represented over JSON?
- What is the stable response/error envelope?
- How are pagination and filters structured?
- Which endpoints are merely planned?
- How can the team safely add a new contract?
- How do backend/frontend import the package?
- What happens if Mongoose model enums and shared types diverge?
- Which fields are safe for anonymous citizens?
- How are changes reviewed and integrated?

If the contract table needs human sign-off on a contested field, flag it clearly as `DECISION REQUIRED` and do not invent final values.

---

# 19. Required completion sequence: plan → implement → review → fix

Execute in this order:

### Phase A — Understand

1. Inspect actual repo, docs and Steps 12–15 code.
2. Inventory model enums, API conventions, workspace state, permissions.
3. Check Git status, select branch safely.
4. Produce the PRE-STEP REVIEW and an implementation plan.

### Phase B — Design contracts

5. Define package boundaries, public/private DTO policy and wire primitives.
6. Lock encoding of IDs, dates, money, GeoJSON and statuses based on code.
7. Choose central constants strategy and map existing schemas without silent changes.
8. Document response/error/pagination conventions.

### Phase C — Implement only this step

9. Create/repair `packages/shared-types` exports/build.
10. Implement necessary cross-module contract types/constants.
11. Add representative type/contract tests.
12. Update API contract catalog and examples; mark unbuilt endpoints `PLANNED`.
13. Add documentation and package usage guide.

### Phase D — Self-review and tests

14. Inspect entire changed-file list and import graph.
15. Run package compile, web/API typechecks and existing tests/build.
16. Check contract-vs-schema drift, public DTO leaks, JSON serializability.
17. Fix introduced problems, re-run all relevant checks.
18. Run `git diff --check` and review staged/unstaged/untracked files.

### Phase E — Handoff

19. Prepare a concise final step report with evidence and blockers.
20. Suggest commit and PR into `development` only after successful review.
21. **STOP. Do not begin Step 17 or merge automatically.**

---

# 20. POST-IMPLEMENTATION REVIEW — exact mandatory report

Produce this review **after** coding and before declaring success:

```text
STEP 16 POST-IMPLEMENTATION REVIEW

A. Requirement coverage
- Shared package usable:
- Modules covered:
- API envelope:
- Errors:
- Pagination/filter conventions:
- Endpoint catalog:
- Serialization:
- Security/public-data boundary:
- Documentation:

B. Architecture
- Frontend/Backend dependency separation:
- Package imports/exports:
- Circular dependencies:
- Duplicated source of truth:
- Model/API contract boundaries:

C. Correctness
- Enum and status drift:
- Money representation matches DB:
- ISO datetime handling:
- ObjectId serialization:
- GeoJSON type and coordinate order:
- Nullability/partial-update semantics:

D. Security
- Sensitive fields exported?
- Public DTO leakage?
- Client-supplied privileged fields in request DTOs?
- Server authorization boundary preserved?
- Credentials in code/tests/docs?

E. Integration
- Web can resolve types:
- API can resolve types/constants:
- Existing apps unaffected:
- Existing package scripts still work:

F. Tests and build
- Shared package build:
- Shared package type-check:
- Shared package tests:
- Web type-check:
- API type-check:
- Lint:
- Whole-repo tests:
- Whole-repo build:

G. Git / diff
- Branch name:
- Tracked modifications:
- Untracked files reviewed:
- Unrelated changes:
- Secrets/artifacts:

H. Issues found
- ...

I. Issues fixed and re-tested
- ...

J. Known limitations / unresolved decisions
- ...

K. Contract drift items for later owners
- ...
```

**The review is not a cosmetic report. Fix Step 16 defects first, rerun tests and report accurately.**

---

# 21. Acceptance criteria — Step 16 is complete only if

- [ ] Work done on a dedicated Step 16 feature branch (or branch exception documented).
- [ ] Existing docs/code reviewed, with no false assumption Steps 13–15 are finished.
- [ ] Shared workspace package is resolvable from Next.js and Express projects.
- [ ] Public wire types do not import Mongoose/Express/Next/Node-private modules.
- [ ] Correct model/internal/public DTO boundaries are documented.
- [ ] No sensitive credential or private audit/file content leaks into public DTOs.
- [ ] Identifiers and timestamps use JSON-safe representations.
- [ ] Money, numeric ranges, GeoJSON geometry and units match Step 13/14 decisions.
- [ ] Reusable domain status constants/types are consistent with accepted models.
- [ ] Role/permission names use approved catalog and do not falsely enforce access.
- [ ] ProjectTrace, RoadSync, InfraMap and the supporting domain types are represented at appropriate depth.
- [ ] API success/error/pagination/filter/sort conventions exist and match actual code.
- [ ] Endpoint contract catalog marks planned/unimplemented routes truthfully.
- [ ] Typed request DTOs exclude unauthorized/system-owned fields.
- [ ] Meaningful compile/test fixtures pass with no false test claims.
- [ ] Web/API/package checks pass, or each blocker is specifically documented.
- [ ] Contract drift review completed, mismatches documented or fixed safely.
- [ ] Documentation and usage examples are accurate and runnable.
- [ ] Git diff checked; no unauthorized Git push, merge, deletion or history rewrite.
- [ ] No APIs, auth features, database migrations, AI endpoints or UI pages were implemented out of scope.
- [ ] Agent stops after the completion report; Step 17 is NOT started automatically.

---

# 22. Final agent report — use this structure

```text
STEP 16 COMPLETE — SHARED TYPES, CONSTANTS & API CONTRACTS

Status: COMPLETE / PARTIAL / BLOCKED
Reason if not COMPLETE:

Git branch:
Base commit:

Existing contract sources inspected:
Shared package name:
Shared package entry points:

Implemented contracts:
- Identity & Agency:
- ProjectTrace:
- RoadSync:
- GeoJSON & InfraMap:
- Contractor & Finance:
- Documents & RAG:
- Inspections:
- Assets & Maintenance:
- Citizen Issues:
- Notifications:
- AI Risk:
- Reports & Audit:

API conventions:
- Success/Error:
- Pagination:
- Filters/Sort:
- Dates/IDs/Money/GeoJSON:

Documentation created/updated:
Files created:
Files modified:
Dependencies added:

Security review findings:
Contract drift findings:
Fixes completed:
Known limitations:

Validation results:
- Shared package build:
- Shared package type-check:
- Shared package tests:
- Web lint/type-check/build:
- API lint/type-check/tests/build:
- git diff --check:

Git status:
Suggested commit:
  feat(contracts): establish shared types and API contracts
Merge target:
  development (reviewed PR; only after user/team approval)
Post-merge regression checklist:
  shared package + web/API typecheck + tests/build

Next step:
  Step 17 — Final INFRAOS Brand & Color System

STOP — Step 17 not started.
```

---

# 23. Ready-to-paste CURSOR AGENT execution prompt

**Use this in Cursor Agent chat after adding this Markdown file to the repository. Update only the file path if you saved it elsewhere.**

```text
Act as my Principal TypeScript Architect, INFRAOS Backend/Frontend Integration Lead, API Contract Designer, Security Reviewer, and QA Engineer.

Execute ONLY Step 16 — Shared Types, Constants & API Contracts, following the complete instructions in:

docs/prompts/INFRAOS_Step_16.md

Also follow CURSOR_STEP_EXECUTION_RULES.md if it exists.

IMPORTANT WORKFLOW:
1. FIRST read the ENTIRE Step 16 prompt and the approved architecture, RBAC, API, database, Git/team, and Steps 12–15 documentation.
2. Inspect the existing repository, actual Mongoose models/enums, existing API response helper, packages/shared-types, web/api imports, tests, and Git status. Do not assume previous steps were implemented.
3. Produce a PRE-STEP REVIEW with findings, potential conflicts, files affected, dependency/build impact, security implications and detailed implementation plan BEFORE coding.
4. Start only from the approved integration branch; work in feature/step-16-shared-types-api-contracts. Do not discard other people's local changes.
5. Implement the shared types/constants and API contract standards exactly within Step 16 scope. Match the actual database models, approved statuses, currency strategy, GeoJSON and permission names. Do not invent or silently change accepted field names/statuses.
6. Keep Mongoose/internal objects and sensitive data OUT of public client DTOs. Define proper serialization for ObjectId, Date, money and spatial coordinates.
7. Cover the approved INFRAOS modules: identity/agencies, ProjectTrace, RoadSync, InfraMap, contractor/finance, DocTrace/RAG, inspections, assets, citizen issues, notifications, AI risk, reporting/audit.
8. Use one valid workspace package and consistent imports for Next.js and Express. Do not create duplicate contract systems, broken barrel exports or unnecessary dependencies.
9. Define a consistent API envelope, error codes, pagination/filtering and a planned-vs-implemented API endpoint catalog. Do NOT create unrequested routes or feature logic.
10. Write useful compile/contract tests, check for schema/contract drift and security leaks, then run package build, web/API lint/type-check/tests/build as applicable.
11. Perform a FULL POST-IMPLEMENTATION REVIEW; fix Step 16 defects and rerun checks. Do not pretend a failed or blocked check passed.
12. Update docs, check git diff/status/secret exposure, then give the mandatory Step 16 final report with changed files, test results, drift findings, limitations and safe Git handoff.
13. Do NOT automatically commit, push, merge or start Step 17. Wait for my instruction.

QUALITY RULE: Understand → Review → Plan → Implement → Test → Security/Contract Review → Fix → Re-test → Document → Git Review → Report → STOP.
```

---

# 24. Ready-to-paste CODEX execution prompt

**Use in Codex (VS Code extension or equivalent) after saving this file in the repository.**

```text
TASK: INFRAOS — Execute Step 16 (Shared Types, Constants & API Contracts) ONLY.

Read the entire file docs/prompts/INFRAOS_Step_16.md and follow its detailed implementation requirements, pre-review, post-review, security checks, acceptance criteria, Git policy and final report format. Follow CURSOR_STEP_EXECUTION_RULES.md if it exists.

WORKSPACE RULES:
- Inspect repository and Git status first. Preserve pre-existing uncommitted work; do not stash/reset/discard without my approval.
- Verify the previous Steps 12–15 code and docs actually exist; do not invent types to match imaginary models.
- Base work on current development branch using a dedicated feature branch feature/step-16-shared-types-api-contracts when safe/available.
- Review existing shared package/tsconfigs/exports, frontend API types, Express errors/responses, model enums, approved RBAC permission keys, GeoJSON conventions, exact money representation and tests.
- Give a PRE-STEP REVIEW and execution plan before making edits.

IMPLEMENTATION:
- Build/fix a minimal importable shared TypeScript contract package.
- Add cross-boundary DTOs and domain constants for INFRAOS modules, preserving source-of-truth schemas and names.
- Define JSON-safe ID/date/money/GeoJSON representations; keep internal Mongoose models, token hashes, private audit/document data and secrets out of client-facing exports.
- Define success/error envelopes, list pagination, filter/sort standards, safe mutation-request shapes, planned API endpoint catalog and versioning conventions.
- Add contract/type tests and concise documentation. Do not build real endpoints, RBAC middleware, UI, AI services or DB migrations.
- Check exact package import/build behavior from BOTH web and API. Avoid circular dependencies, duplicate enums, unneeded libraries and unsafe type assertions.

VERIFICATION:
- Run relevant lint, type-check, tests and build.
- Compare exported statuses, money units, permissions and fields with real models/docs; report drift.
- Check public-vs-internal privacy and credential exposure.
- Self-review git diff, fix related defects and rerun checks.
- Report honest PASS/FAIL/NOT RUN results with reasons, files changed, remaining issues and recommended tests.

GIT:
- Suggest commit feat(contracts): establish shared types and API contracts.
- Handoff for reviewed PR into development, not direct main.
- Do not automatically commit/push/merge/delete branches/force-push.

FINAL:
Give the Step 16 final report exactly as specified in the prompt file, then STOP. Do not begin Step 17.
```

---

# 25. Ultra-short universal execution prompt (optional)

If the agent can read workspace files reliably, use this instead of the long launcher **after the Step 16 Markdown is saved to the given path**:

```text
Read docs/prompts/INFRAOS_Step_16.md in full and execute ONLY Step 16.
Follow all scope, pre-review, development, contract-drift, tests, security, Git branch and post-review rules.
Work on feature/step-16-shared-types-api-contracts from development when safe.
Implement shared types/constants/API contracts only, not features.
Review → fix → re-test → document → final report.
Do not commit/push/merge or continue to Step 17 without approval.
```

---

# Final reminder

Step 16 completes the shared **contract foundation**. The **next step is UI design-system work**, not permission to create all pages or feature implementations. Preserve the Sri Lankan flag-inspired INFRAOS colors and the approved module/branch structure when moving to Step 17.
