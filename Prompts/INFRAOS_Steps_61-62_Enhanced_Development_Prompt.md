# INFRAOS — Roadmap Steps 61–62 | Enhanced Development Specification

**Product:** INFRAOS — National Infrastructure Intelligence & Coordination Platform  
**Vision:** *The Operating System for National Infrastructure*  
**Repository:** https://github.com/divejikan-yuvarajah/InfraOS  
**Working directory — the ONLY permitted checkout:** `C:\Users\ASUS\Desktop\InfraOS\InfraOS`  
**Target:** `development`; `main` is for separately approved stable releases  
**Scope:** **Step 61 — Project Timeline** and **Step 62 — Project Dependency Management**  
**Document type:** Implementation-ready instructions, **NOT** evidence that either step has been implemented  
**Verified remote baseline (29 Oct 2026):** `development` = `24a89cf6087fc4d319edcad3fc10850dfb06aa29` (merged PR #106); `main` = `f6233db93938d1bc89cd0611a57bb28c96b34fbd`. Refresh before execution; never assume these SHAs stay current.

> **Scope principle:** Deliver a genuinely usable, permission-scoped, auditable *read-only timeline* (61) and *project-to-project prerequisite management* (62). Do not silently implement Step 63 activity history, Step 64 dashboards, Step 65 notifications, RoadSync conflict management, financial-payment workflows, AI, deployments, or production fixes. Keep original roadmap facts separate from recommended design choices.

---

## 1. Authoritative roadmap and evidence trace

### 1.1 Exact roadmap identification

The committed file `Prompts/Steps.docx` on `development` was inspected. Its Phase 6 entries are:

| Order | Exact original roadmap title | Boundary |
|---|---|---|
| **61** | **Project Timeline** | This phase: project-scoped timeline of *actual authorized* project/milestone/progress data |
| **62** | **Project Dependency Management** | This phase: store and maintain prerequisite links, reject cycles, display link status in the timeline |
| 63 | Project Activity History | **Future**: complete chronological activity/audit reconstruction, not to be built here |
| 64 | ProjectTrace Dashboard & KPIs | Future |
| 65 | ProjectTrace Notifications & Audit Integration | Future |

The original `Steps.docx` provides **titles**, not a complete API/data contract for Steps 61 and 62. The detailed proposals below are **design decisions to verify against repository constraints and obtain owner approval when policy-sensitive**, rather than falsely attributed verbatim roadmap requirements.

### 1.2 Grounded requirements and acceptance mapping

| Source | Exact source-backed requirement | Application |
|---|---|---|
| `docs/planning/requirements.md`, `FR-PROJECT-014` | “Record project dependencies”; Project Manager; projects exist; dependency links stored; circular dependency rejected if detected; timeline can show dependency; **P1** | Required Step 62 capability + Step 61 integration |
| `docs/planning/requirements.md`, `FR-PROJECT-011` | Scoped project details, authorized fields | Both read surfaces |
| `docs/planning/requirements.md`, `FR-PROJECT-015` | Activity history for significant events | **Step 63**, not a mandate to build a full audit/activity feed in Step 61 |
| `docs/planning/user-workflows.md`, Workflow 7 | Milestone timeline reflects valid transitions | Step 61 reads actual Step 58 milestones |
| `FR-MS-001/002` | Milestone records and controlled states | Step 61 uses existing milestones, no new transitions |
| `FR-PROG-001/003` and `BR-PRJ-004/010` | Recorded physical progress; 100% does not complete project; milestone completion does not complete project | Timeline never infers completion from percent or milestones |
| `BR-PRJ-006/008/009` | Completed projects protected; cancelled/soft-deleted references handled safely; no unauthorized agency reassignment | Step 62 safe edit states, read-only cancelled references |
| `BR-INT-001/002/003/005` | Validate IDs, reject stale/concurrent writes, fail closed on DB errors, paginate large reads | Both steps |
| `BR-AUD-001/002` | Sensitive changes attributed/audited; audit logs immutable to normal users | Step 62 write events |
| `docs/security/permission-catalog.md` and seed | `project.timeline.read` **already exists**; `project.read` and `project.update` already exist | Reuse current grants; don't add invented permission names |

**Unresolved roadmap specificity:** no exact Step 61 event taxonomy, dependency direction/type, cross-agency linking policy, completion-blocking semantics, or graph visualization mandate is defined in these sources. Use the conservative MVP below; label deferred policy decisions in handoff. If local roadmap/docs are newer, re-check them *before implementation*.

### 1.3 Evidence from existing GitHub implementation

Verified on the referenced `development` tree:

- **Step 58 / PR #104:** `apps/api/src/modules/projects/milestones.service.ts`, `models/milestone.model.ts`, `apps/web/src/app/projects/[id]/milestones/page.tsx`, `project-milestones-client.tsx`; `NOT_STARTED` is the stored status (display “Planned”), then `IN_PROGRESS`, `COMPLETED`, `DELAYED`, `BLOCKED`, `CANCELLED`. Milestones have planned/actual dates, not weight or hard-delete capability.
- **Steps 59–60 / PR #106:** `models/progress-report.model.ts` stores append-only `projectId`, sequence, reported/previous percent, note, reporter ID, `reportedAt`; `progress.service.ts` enforces assigned Project Manager while ACTIVE; `/progress` page and history exist. Contractor submissions remain **BLOCKED** due to no authenticated User↔Contractor mapping. The `financial-progress` endpoint reads stored `PAID` rows and authorized budget **provisionally**; it does not verify bank disbursement and does **not** write `Project.financialProgress`.
- **Project model:** `apps/api/src/modules/projects/models/project.model.ts` has `agencyId`, `managerId`, `contractorId`, `startDate`, `plannedEndDate`, `actualEndDate`, `physicalProgress`, `financialProgress`, `status`, `createdBy`, timestamps; it **does not currently have a persisted dependency list**. The timeline cannot assume one exists.
- **Audit model:** `apps/api/src/modules/audit/models/audit-log.model.ts` supports append-only `PROJECT`/`MILESTONE` resource types and whitelisted snapshot fields. Its audit actions can inform operational safeguards, but exposing a global audit feed is Step 63 and must not leak private reasons, notes or snapshots.
- **RBAC:** `packages/shared-types/src/permissions.ts` includes `project.timeline.read` and `project.update`; role seed includes `project.timeline.read` on key staff roles but **not every** role. Must re-check live role grants. No `project.dependency.*` permissions currently exist; adding any is a separate catalog/policy change, not an automatic inference.
- **Project routes:** `apps/api/src/modules/projects/projects.routes.ts` contains project detail, milestones, progress/history and financial summary routes; use this existing router and API response/error conventions. Route `/:id/timeline` or `/:id/dependencies` must not accidentally be captured by broad dynamic routes: verify ordering.
- **Existing security patterns:** `resolveResourceScope`, `projectReadFilter`, `projectWriteFilter`, live role/credential checks, Mongo sessions and revision/CAS updates. The source comments explicitly deny contractor ownership because `Contractor` has no `userId`.
- **Lifecycle:** `apps/api/src/modules/projects/lifecycle.policy.ts` currently blocks `START`, `MARK_DELAYED`, `COMPLETE`, `CANCEL` execution unless dependencies/policies are resolved; **do not unlock or alter** those actions for Steps 61–62.
- **Existing UI:** Next.js 16/React 19/TypeScript/Tailwind, TanStack Query, Zod, auth-scoped query keys, `project-overview-client.tsx` links to Milestones and Progress, locale messages, `auth-access.css` patterns. Use existing navigation, loading/error states, toasts, interactive affordances.
- **Observed quality snapshot from preceding phase:** final local full-suite rerun 318 API and 176 web tests, type/lint/build green, PR #106 and its merge CI successful. These are **historical**, not proof Steps 61–62 tests passed. Known two web lint warnings can be tracked separately.
- **Git history versus local checkout:** PR #106 is merged to `development` at `24a89cf`; the user's last reported local branch was `feature/projecttrace-progress-summary` at `743e053`, with unrelated production-readiness and Steps 53/54/58 review edits plus untracked `Prompts/`. Their hashes/worktree must be rechecked locally; GitHub cannot attest to local dirty files. Never discard them.

### 1.4 Outstanding, unclosed blockers (not to be misreported as solved)

Step 51 authorization-grant and agency-hierarchy TOCTOU races; contractor identity association; null-agency `SUPER_ADMIN` policy; native Sinhala/Tamil approval; production email; live Atlas schema/index audit; signed-in staging cookies/origin; backup, alerts, branch protection and release controls; operational payment ingestion/disbursement provenance. The timeline must not imply verified contractor progress or confirmed finance. New dependency graph writes must not worsen these risks. **Production readiness remains BLOCKED.**

---

## 2. Non-negotiable execution and data safety

1. Work **only** inside `C:\Users\ASUS\Desktop\InfraOS\InfraOS`; no second checkout, worktree, arbitrary project folder, or access to Windows Documents folder.
2. Preserve exact dirty/untracked paths, `.env*`, developer ports/processes, existing synthetic fixtures and auth flags. `git fetch origin` may update refs but requires the applicable G1 authorization; safe read-only preflight first.
3. One shared feature branch for this pair, suggested `feature/projecttrace-timeline-dependencies`; use `origin/development` after verifying the current tip, **not** the last feature branch as the integration base.
4. Git **G1–G5 can be bundled under one explicit owner approval naming both steps and the exact actions**; G6 requires a separate post-PR approval. Without consent, perform zero branch/staging/commit/push/PR/merge operations. Do not split prompts by checkpoint.
5. Never `git add .`, force-push, stash, reset, clean, force-checkout, auto-merge, silently delete user changes or use unverified upstream targets. `git push` must name the feature destination explicitly.
6. No live Atlas access, index builds, migrations, data generation or test writes; use `mongodb-memory-server` replica/transactions and an isolated auth/demo fixture. Document required indexes, **do not apply them** to production without owner-approved migration.
7. Do not change Connected Future public landing, global theme arbitrarily, unrelated RoadSync/Finance/Step63+ modules, nor deploy or enable production login.
8. Use current API error envelopes and safe status codes. Return 400 invalid body/ID, 401 expired/missing auth, 403 missing operation grant, 404 out-of-scope/missing resources, 409 stale/cycle/duplicate/illegal-state, 503 real dependency failure. Never reveal existence of invisible related projects.
9. Handle date-only values as date-only (UTC canonical ISO date, Sri Lanka display locale) and timestamps as timestamps. No invented precision or backfilled historical moments.
10. Each step must finish implementation, focused tests **and a real isolated browser walkthrough** before continuing. One combined full-suite/security/browser review follows Step 62.

---

## 3. Shared implementation architecture

### 3.1 Existing module boundaries; recommended new files

**API — prefer existing `apps/api/src/modules/projects/` and its router:**

```text
apps/api/src/modules/projects/
  timeline.schema.ts                   # Step 61 query validation
  timeline.service.ts                  # Step 61: authorized normalized read model
  timeline.policy.ts                   # Step 61 source filtering/order/precision
  dependencies.schema.ts               # Step 62 strict payload/query contracts
  dependencies.service.ts              # Step 62 auth, graph checks, transactions
  dependency.policy.ts                 # Step 62 direction, valid project states, cycle rules
  models/project-dependency.model.ts   # Step 62 persist relationships, no Project schema sprawl
  projects.routes.ts                   # Add narrow routes after checking precedence
```

**Web — within `apps/web`:**

```text
src/app/projects/[id]/timeline/page.tsx
src/components/projects/project-timeline-client.tsx
src/lib/projects/timeline-api.ts
src/lib/projects/timeline-messages.ts
src/components/projects/project-dependency-manager.tsx        # Step 62 only, if appropriate
src/lib/projects/dependencies-api.ts
src/lib/projects/dependency-form.ts
src/lib/projects/dependency-messages.ts
src/components/projects/project-overview-client.tsx          # authorized navigation only
src/styles/auth-access.css                                  # minimal additive extension
```

These are **proposed placements**, not assertions that files already exist. Reuse existing components/functions and naming when more compatible. Avoid duplicate status enums, fetchers, validation libraries, or new charting packages. Frontend may combine timeline and dependencies in a single authorized page to avoid redundant pages. Add focused API and UI tests next to established conventions.

### 3.2 Data flow and trust boundaries

```text
Authenticated actor + live role/credential epoch
                  |
         Project RBAC + agency scope
                  |
      +-----------+-------------+
      |                         |
  Step 61 READ               Step 62 WRITE
  Project metadata           Dependent project in write scope
  Milestones (if readable)   Prerequisite project in read/approved link scope
  Progress reports           Graph invariant: no cycles/duplicates/self-links
  (if readable)              CAS + graph serialization + transaction
      |                         |
  Safe timeline DTO         Dependency record + minimal audit
      |                         |
  Scoped TanStack Query     Invalidate timeline/dependency query cache
      +-----------+-------------+
                  |
       Accessible responsive staff UI
```

Use `Cache-Control: no-store` and authentication-isolated query keys containing auth epoch/user/role/project. Server authorization is always authoritative; a hidden button is not security. Minimize DTO payloads and never return Mongo documents, direct AuditLog snapshots, access tokens or bank-private information.

---

## 4. Step 61 — Project Timeline

### 4.1 Purpose and boundary

Deliver a **working staff-facing project timeline** integrating trusted existing project schedule dates, Step 58 milestone schedule/actual dates, and Step 59 reported physical progress entries. Present these in one accurate chronological experience, distinguish scheduled versus observed records, and handle partial data without fabricating events. Subsequent Step 62 will surface prerequisite relationships on this same experience; Step 63 full activity history is **excluded**.

### 4.2 Recommended timeline source model

| Source | Eligible event(s) | Precision | Visibility/policy |
|---|---|---|---|
| `Project` | record creation (`createdAt`), planned project start (`startDate`), planned end (`plannedEndDate`), recorded actual end (`actualEndDate` **only if non-null**) | `timestamp` or `date` explicit | `project.read` AND `project.timeline.read` + project scope |
| `Milestone` | planned start/end, actual start/end when present, current milestone status as **current snapshot** | date-only | Add `milestone.read` + proper project scope; no historical milestone-transition event unless trusted event history exists |
| `ProgressReport` | submitted reported-percent change with `reportedAt`, optional protected note, sequence | timestamp | Add `progress.read` + proper project scope; must state “reported, not inspected/verified” |
| `ProjectDependency` | **Step 62** prerequisite relationship, rendered as link/badge/edge with its own created time if recorded | timestamp when present | Both endpoints readable and the linked target is authorized; missing/foreign labels redacted |
| `ProjectPayment` | **NOT** a timeline source in this phase | — | Financial/settlement events cannot be implied from provisional `PAID` rows |
| `AuditLog` | **NOT** a general activity feed here | — | Step 63 governs activity-history/secret-reason visibility |

**Mandatory truthfulness:** a current state such as `APPROVED`, `COMPLETED` milestone, or `physicalProgress = 100` is not proof of the *time* that state changed. Display current state separately or use a properly recorded timestamp with explicit source. Don't derive event timestamps from `updatedAt` for a specific action.

### 4.3 Suggested stable, minimal response contract

**Endpoint proposal:** `GET /api/v1/projects/:id/timeline?limit=50&cursor=...&sort=asc|desc&kind=...`. Only implement supported cursor/filter options after validating design against current conventions; conservative page/limit pagination is acceptable if deterministic and bounded.

```ts
// Suggested DTO shape; align exact names with repository conventions.
type ProjectTimelineEntry = {
  id: string; // stable sourceKind + entityId + event-kind composite
  kind: "PROJECT_SCHEDULE" | "PROJECT_CREATED" | "MILESTONE_DATE" | "PROGRESS_REPORTED";
  eventDate: string;        // ISO timestamp OR YYYY-MM-DD, as below
  precision: "timestamp" | "date";
  category: "planned" | "recorded";
  title: string;            // safe, locale-independent message key or approved text
  sourceId: string;
  sourceKind: "project" | "milestone" | "progressReport";
  status?: string;          // current status, not fabricated historical state
  reportedPercent?: number;// only on progress entry
  note?: string;           // only if explicitly authorized for progress.read
};
type ProjectTimelinePayload = {
  projectId: string;
  entries: ProjectTimelineEntry[];
  nextCursor?: string | null;
  hasMore: boolean;
  sourceAvailability: { milestone: "visible" | "restricted" | "unavailable"; progress: "visible" | "restricted" | "unavailable" };
};
```

Do **not** return user emails/names, private inspection text, raw `AuditLog` snapshots, confidential payment data, or actor identifiers unless justified by an existing authorized contract. `sourceAvailability` is illustrative; errors must be unambiguous and must not leak foreign existence. Avoid exposing a count for a resource a role cannot read. `sort`/`kind` use strict allowlists; bounded limit (e.g., default 30–50, max 100), stable tie-break `(eventDate, eventKind, sourceId)` and no unlimited collection scan. For each source, bound queries and paginate in a way that preserves ordering; document any capped-history semantics honestly.

### 4.4 API implementation requirements

1. Re-evaluate current authenticated actor, active user/role grants, credential epoch and active agency; require `project.read` **and** `project.timeline.read`. Scope parent project with existing `projectReadFilter`, plus role-specific assigned inspector handling if supported by existing service policies. Reuse Step 58/59 source read scopes, **never** query all milestones/progress then filter on client.
2. Permission layering: do not silently reveal milestones to roles missing `milestone.read` or reported notes to those missing `progress.read`. Either omit restricted classes with an honest non-sensitive “restricted” label or deny overall endpoint per documented policy. Test both.
3. Fetch bounded `Project`, `Milestone`, `ProgressReport` reads; exclude untrusted/unavailable dates. Build a normalized, deduplicated timeline with stable sorting. Preserve `NOT_STARTED` as stored enum while labeling Planned in UI; do not add `PLANNED` to persistence.
4. Include planned-versus-actual and schedule-versus-reported semantics; use completed milestone actual end only if recorded, not `updatedAt` inference. Avoid N+1 queries.
5. Handle empty projects, no milestones, no reports, date ties, date-only display, day/month boundaries, Sri Lankan timezone, out-of-order reports, delayed/blocked milestones, cancelled status, restricted classes, future scheduled events, leap years and malformed legacy data.
6. Implement bounded reliable server error responses and no-store. If backend dependency fails, report 503 rather than silently showing an empty timeline.
7. Do not mutate Project, Milestone or ProgressReport in timeline reads; do not change lifecycle statuses, project progress or financial summary. Do not import production Atlas indexes/credentials or add new external packages unless unavoidable.

### 4.5 UI/UX and responsive visual design

- Staff route `/projects/[id]/timeline` or reuse an existing staff detail subview. Add an accessible, permission-aware Timeline link from project overview, adjacent to Milestones and Progress. Never edit Connected Future public landing.
- Premium government-tech visual style consistent with INFRAOS Sri Lankan flag inspiration: carefully applied maroon/burgundy, gold/amber, restrained green, white/charcoal surfaces; *not* literal flag art and not a new competing theme. Follow existing tokens and contrast rules. Rich icons (Lucide), clean metric chips, nuanced route/state colors, subtle separators and soft elevation.
- Visualization: time-axis rail with semantic icons/cards, grouping by day/month; an optionally simple schedule-range lane for planned milestones; concise type filters (all, schedule, milestones, reported progress), sort toggle, source legend, readable date labels and “planned/recorded” badges. **No fake Gantt dependency calculations**.
- Key states: loading skeleton, no events, no milestone access, no progress access, service unavailable, stale session, invalid project ID, out-of-scope, responsive overflow, stale records. Never render restricted data in DOM before permission checks resolve.
- Explain “Reported physical progress is not independent inspection verification”; 100% milestone/physical value does not imply project completion. Do not show financial percentage as an event.
- Keyboard-first and mobile friendly: semantic ordered/list structure or `ol`, visible focus, usable touch targets, aria labels, clear heading hierarchy, skip repeated narration, no motion-only encoding. Check 320/375/390/768/1024/1440/1920 widths; horizontal lane may scroll **within its panel only**, not whole page. Meet WCAG AA contrast where feasible; measure focus 3:1 non-text treatment and record if not measured.
- English/Sinhala/Tamil strings via established locale infrastructure; heading, filters, dates, empty/error messages and accessibility labels switch appropriately. Draft translations clearly identified; do not claim native-language signoff.

### 4.6 Step 61 acceptance — required checks

| ID | Acceptance (all tested against actual code) |
|---|---|
| S61-01 | Authorized user with `project.read` + `project.timeline.read` sees real planned project and milestone dates in stable order |
| S61-02 | Actual milestone dates and progress `reportedAt` appear only when present; data source/precision labeled |
| S61-03 | Reported percent is not presented as verified; 100% does not auto-complete parent project |
| S61-04 | Missing/zero data yields truthful empty state, no manufactured timeline events |
| S61-05 | Foreign project 404, anonymous 401, permission denied 403; source-specific grants enforced without leaks |
| S61-06 | Bounded/paginated queries and deterministic sort across tie dates; no N+1 or unlimited bulk exports |
| S61-07 | Responsive, keyboard/accessibility, EN/SI/TA layout; real browser proof and screenshots for eligible and denied actors |
| S61-08 | Existing Step 57/58/59/60 endpoints and tests unaffected; no Step 63 activity feed or project status mutation |

### 4.7 Actual Step 61 demonstration — required BEFORE Step 62

Use a uniquely labeled in-memory Mongo fixture and isolated ports selected after checking availability (e.g. API `4014`, web `3004`, **only if free**). Set the selected web origin and API URL in **process-only** environment. Never touch `.env.local` or existing ports such as 3000/4010; never stop a listener not started by this demonstration. Capture: signed-in assigned Project Manager project overview→timeline, a scheduled start/end + two milestones with different dates, a real reported percent entry + refresh, planned-vs-actual distinction, empty-state project, mobile 390, foreign scope denial; include browser URL, network status and evidence filenames. Call it an *isolated demonstration* using synthetic records, not production proof. Stop only the owned demo listeners and restore any Next-generated incidental tracked diffs without overwriting unrelated edits.

Create concise `docs/reviews/step-61/IMPLEMENTATION-STATUS.md` and real screenshots in its evidence folder (or equivalent established review location). Include `S61-xx` PASS/FAIL/BLOCKED/NOT RUN. If essential S61 criteria fail, fix them or stop; do not proceed to Step 62 merely to save time.

---

## 5. Step 62 — Project Dependency Management

### 5.1 Purpose, direction and safe minimum scope

Implement FR-PROJECT-014 as **project-to-project prerequisite links**. Define consistently:

> `projectId` = the **dependent** project; `prerequisiteProjectId` = a project that must logically precede it. The UI sentence is “Project A depends on Project B.” This relationship **does not itself** enforce START/COMPLETE status, reschedule dates, approve funding, or activate RoadSync coordination.

MVP recommended features: authorized list/read, select another in-scope project as prerequisite, add link, see link direction and statuses, remove (soft-retire) a link with audit, reject self-link/duplicates/cycles, show prerequisites in Step 61 timeline and project overview. A full dependency graph engine, multi-type PDM/CPM solver, automatic dates, cross-agency consent or task/milestone-level dependencies are **not explicitly required** by roadmap sources and require policy decisions; do not claim them.

### 5.2 Policy decisions to make explicit (don't silently invent governance)

| Decision | Conservative default pending owner policy | Test and document |
|---|---|---|
| Eligible writer | Assigned Project Manager of dependent project, with active user+role, `project.update` and project write scope; optionally already-privileged agency/Gov Admin only if original policy explicitly permits | No Super Admin operational write, no contractor/inspector/citizen writes |
| Prerequisite visibility | Require actor authorized to read target project; do not reveal foreign target name/ID | 404 for invisible project, no existence probing |
| Cross-agency links | **Defer** unless a signed-off governance rule defines both-agency consent/read visibility | Exclude from current acceptance or clearly BLOCKED; no bypass via IDs |
| Dependent project edit states | Allow only clearly editable statuses (e.g., DRAFT, APPROVED and/or ACTIVE where source policy permits); always forbid COMPLETED/CANCELLED, and protect SUBMITTED/UNDER_REVIEW | Do not auto-unlock project lifecycle |
| Link type | One explicit `PREREQUISITE`/finish-before-start descriptive relation; no lead/lag/critical-path promises | Label as informational until enforceable policy exists |
| Removing a link | Soft-retire or controlled `removedAt`, never erase audit/history | Current graph excludes removed links |
| Cycle semantics | Directed graph edges `dependent → prerequisite`; reject any path from prospective prerequisite back to dependent | DAG invariant under **concurrent writes** |
| Completion gates | **Do not** let link changes silently toggle project status or mark project COMPLETED | Owner must approve future completion/start policy integration |
| Empty/legacy data | Project with no dependency records displays “No prerequisites”; no automatic data migration | Do not fabricate associations |

If a required chosen policy is genuinely unresolved, implement the noncontroversial safe slice and mark the missing portion BLOCKED/REVISE. Do not invent a security permission name, modify seed roles, or grant `project.update` globally merely to bypass an authorization issue.

### 5.3 Storage and indexes (proposal, subject to repository review)

Use separate Mongoose `ProjectDependency` model to avoid uncontrolled mutation of `Project` and to facilitate append-only audit:

```ts
// Conceptual fields — adjust name and status conventions only after repo inspection.
{
  projectId: ObjectId,                 // dependent project
  prerequisiteProjectId: ObjectId,    // required preceding project
  type: "PREREQUISITE",               // V1 only; no fictional scheduling mechanics
  createdBy: ObjectId,                 // authenticated actor, server-set
  createdAt: Date,
  updatedAt: Date,
  removedAt: Date | null,              // soft removal
  removedBy: ObjectId | null,
  revision: number                     // explicit or Mongoose __v
}
```

Strict schema; reject self-link and unknown keys. Proposed indexes: bounded lookups by `projectId`, by prerequisite ID and active status; **uniqueness of active `(projectId, prerequisiteProjectId)`**. Mongo partial unique index with removal marker/status semantics should be designed/tested carefully, including re-adding a previously removed link; do not rely only on a pre-insert `findOne` for uniqueness. Do not run indexes on Atlas. For test replica indexes, assert duplicate handling; record migration requirement separately.

### 5.4 Proposed API contract (adapt to current envelope)

```http
GET    /api/v1/projects/:id/dependencies?limit=25&cursor=...
POST   /api/v1/projects/:id/dependencies
DELETE /api/v1/projects/:id/dependencies/:dependencyId
```

The `DELETE` example represents an **audited soft removal**, not data destruction. If repo conventions strongly prefer `POST /.../:dependencyId/remove` or a PATCH transition, use that consistently and test. `POST` body example:

```json
{ "prerequisiteProjectId": "<valid ObjectId>", "revision": 4 }
```

Here `revision` refers to an appropriate **parent/graph concurrency token**, not a client authority to pick an agency/owner or override status. Do not permit `agencyId`, `createdBy`, status overrides, title, arbitrary operators or JSON injection. API response should include the new dependency ID, direction and revision but only disclose prerequisite title/status if the actor is authorized for that project.

**GET** requires `project.read` on the dependent and appropriate `project.timeline.read`/project read policy for displaying links. **POST/remove** requires `project.update`, live role checks, dependent project write scope, prerequisite read permission, allowed state, graph invariant and audit. Query endpoints must be paginated, sorted deterministically and deny or redact any link whose target has become invisible; an already-stored foreign link cannot be used as a cross-agency discovery mechanism.

### 5.5 Cycle detection **and concurrency** — critical technical requirement

Simple DFS before insert is **insufficient** when two users add edges concurrently. Example: user1 proposes A→B and user2 proposes B→A; both read a cycle-free snapshot and could commit unless the graph writes serialize.

Implement transactionally:

1. Within a Mongo transaction, re-check live actor permissions, agency status, dependent project writable, target existence/visibility and current revision; fail closed on revocation/conflict.
2. Acquire a **shared database graph-write serialization primitive** (e.g., one dedicated singleton lock document incremented by all dependency-add/remove transactions) in the same replica-set transaction. Seed the lock outside transactions via an authorized in-memory fixture or an idempotent safe initialization; avoid phantom upsert races. A per-project lock alone is not sufficient for arbitrary cycles.
3. Query the authoritative active graph *after obtaining the serialization boundary* and perform bounded reachability: insertion A→B is illegal if B reaches A, or if A=B. Enforce a defined node/edge cap and return safe fail-closed service error if the graph is too large; don't silently skip a potential cycle. In an agency-limited graph, prohibit cross-boundary edges rather than failing to see hidden paths.
4. Insert/update the active link, enforce DB-level unique active pair, create an `AuditLog` resourceType `PROJECT` (or owner-approved audit resource) with safe whitelisted action/snapshot, and update the necessary revision token in **the same transaction**. Do not log full project titles, nested graphs, notes, money or tokens in audit snapshots.
5. On write conflict/duplicate key, safely retry a bounded number of **whole transactions** or return deterministic 409; on audit failure roll back link; on DB unavailable return 503. Invalidate scoped client queries after success only.
6. Apply the same lock and audit approach to soft removal; ensure removed edges do not count for cycle detection. Prevent stale-tab remove/add and double-click duplicates with optimistic concurrency.
7. Test the two-client A→B/B→A race and three-node A→B→C→A cycle with `mongodb-memory-server` replica. Verify the final persisted active graph is acyclic and only a permitted auditable subset committed.

**Important**: an existing `AdminLifecycleLock` protects agency hierarchy in some workflows; do not casually use the hierarchy lock for graph writes without verifying its exact semantics and avoiding deadlocks. Prefer a dedicated clearly named graph lock unless the existing policy explicitly covers both. The Step 51 grant-revocation/hierarchy TOCTOU vulnerability remains a separate release blocker; no claim to solve it via this graph lock.

### 5.6 Step 62 UI/UX

- Integrate with `/projects/[id]/timeline`: clear “Prerequisites” tab/panel and, optionally, a clean dependency list linked from the overview. A link chip/arrow should show **Dependent project ← prerequisite** semantics in accessible text. Keep the graph simple (compact linked cards rather than giant draggable graph) unless an existing component already supports it.
- Add/edit via searchable **server-scoped** project picker; no fetch-all projects or arbitrary ID-only trust. Debounced or manual search, short bounded results, accessible labels. Hide/select only eligible targets. Confirm before removal; state this removes the *relationship*, not projects.
- Display target title, project code and current status **only after server scope check**. Distinguish missing/withdrawn/restricted targets without enumerating hidden names. Filter duplicates; display explicit "Circular dependency is not allowed" for authorized conflicts, and a generic conflict on stale revision.
- Visual distinction for active link, removed history (if shown to authorized staff), planned versus active project, and dependency direction. Color and icon alone are insufficient.
- Use INFRAOS maroon/gold/green tokens sparingly, premium cards, compact microcopy, robust 320–1920 responsiveness. Keyboard navigable picker and confirmation dialog with Escape support, focus restoration, screen-reader errors, reduced-motion support.
- EN/SI/TA locale keys for form labels, direction, duplicates, cycle, removed, restricted, empty and 503; native translation quality **NOT verified until reviewed**. Do not show a cross-agency unavailable option as selectable.

### 5.7 Step 62 acceptance — required checks

| ID | Acceptance |
|---|---|
| S62-01 | Authorized assigned PM can link a visible prerequisite to an eligible dependent project; list persists on refresh |
| S62-02 | Direction unmistakable; Step 61 timeline displays the authorized link without pretending automatic scheduling |
| S62-03 | Self-link, duplicate active link, A→B→A and A→B→C→A cycles rejected with no partial writes |
| S62-04 | Concurrent opposite-edge transactions cannot commit a cycle; only consistent auditable writes survive |
| S62-05 | Stale revision/duplicate click safe 409; soft removal retained as history/audit, may re-add safely per policy |
| S62-06 | No foreign-scope leakage: unknown/invisible target 404; no contractor, inspector, citizen or Super Admin operational mutations |
| S62-07 | Invalid ObjectIds/unknown keys/operators 400; anonymous 401, missing permission 403, service failure 503; audit rollback |
| S62-08 | COMPLETED/CANCELLED states protected; link operations don't change project status, dates, milestones, progress or money |
| S62-09 | Mobile, keyboard, focus, EN/SI/TA layout and actual browser screenshots demonstrate add, display, denial and cycle |
| S62-10 | Step 57–61 regressions pass; no RoadSync, Step 63 Activity History or approval-lifecycle shortcuts |

### 5.8 Actual Step 62 demonstration (mandatory)

Using the same **isolated** in-memory/demo environment if still valid and secure: signed-in assigned Project Manager opens `Project A` timeline, chooses authorized `Project B`, adds A→B, refreshes and sees retained relationship; attempts B→A and receives a real 409; tries duplicate and self-link; opens denied foreign target and observes 404 without title; removes A→B (soft removal), checks timeline absence and then re-adds if supported; shows stale-tab 409; verifies parent projects unchanged; captures desktop/mobile and keyboard screens and network responses. Run the graph concurrency adversarial test on the in-process Mongo replica; don't assert a browser race that wasn't executed. Record URLs, actual statuses, screenshot paths and fixture assumptions.

Create `docs/reviews/step-62/IMPLEMENTATION-STATUS.md` and screenshots/evidence (or align with phase folder); note policy deferrals and test failures honestly.

---

## 6. Phase-wide integration and end-to-end demonstration

After **both** steps satisfy essential checks, execute **one** comprehensive phase review and combined demonstration:

1. User signs in with a real disposable-scoped account and opens an already APPROVED/ACTIVE project; sees truthful Step 61 timeline from existing project dates, two milestones and one reported progress entry.
2. Uses Step 62 to add a prerequisite; the same timeline updates after safe query invalidation, preserving event chronology and providing a readable relationship view.
3. Refreshes and confirms persistence, exact direction and current states; attempts a cycle and sees rejection without a leaked project title.
4. Reaches Step 59 recorded 100% on an eligible ACTIVE fixture: official project status unchanged; Step 60 provisional finance remains a separate permission-scoped calculation. No fabricated payment or verification event appears in timeline.
5. Uses a foreign officer/role-denied actor, checks 401/403/404; restricted milestone/progress classes are not rendered; verifies no cached cross-user contamination after logout/login.
6. Checks keyboard focus, dialogs, date rendering at locale boundaries, EN/SI/TA responsive text, widths 320/375/390/768/1024/1440/1920, and network-error states.
7. Records real browser URLs, steps, HTTP statuses, fixture IDs, screenshots and whether a case is PASS/FAIL/BLOCKED/NOT RUN. Do not claim success from mockups or tests alone.

Final report: `docs/reviews/steps-61-62/END-OF-PHASE-VERIFICATION.md`, with per-step verdict APPROVE/REVISE/BLOCKED, cross-feature verdict, independent owner-acceptance caveat, production readiness separately BLOCKED. Keep documentation lean and use one combined report; no repeated testing prompt per step.

---

## 7. Automated testing and engineering gates

### 7.1 Essential focused checks after each step

Step 61: timeline normalization/order/date precision and source authorization unit tests; API `GET` happy/error paths; web timeline rendering, locale and restrictions; short real browser walkthrough. Step 62: graph policy tests (self, duplicate, 2/3-node cycles), transactional create/remove and audit rollback, concurrent opposite edges, hidden targets, roles, stale revision; UI picker/form/error tests; short real browser walkthrough. Run targeted test workspace commands using actual filenames (example: `npm run test -w @infraos/api -- tests/projects-timeline.test.ts`, if this test path is chosen). Fix affected bugs before starting the next step.

### 7.2 One full-suite phase gate (not per-step repetition)

From repository root, use actual scripts:

```powershell
npm run test:api
# Set CI-safe web env for this process, without rewriting .env.local:
$env:NEXT_PUBLIC_AUTH_LOGIN_ENABLED='0'
$env:NEXT_PUBLIC_AUTH_FIXTURE='0'
$env:NEXT_PUBLIC_API_BASE_URL='http://localhost:4000'
npm run test:web
npm run type-check
npm run lint
npm run build
git diff --check
```

Ensure test process explicitly excludes `MONGODB_URI`, `MONGODB_URL` and `DATABASE_URL` and cannot silently read Atlas from user environment; consult CI `.github/workflows/quality.yml` and API tests. Restore process-only variables after use. The above shell commands are **illustrative**: implement safe environment isolation first; never connect to Atlas simply to make tests green. Type-check and build output must not contain isolated-dev scripts unless expressly in a non-production script path; no demo password in shipped bundle. Report any reproducible intermittent prior API test failure separately, including first failing run and successful rerun, with root cause/NOT RUN if not established.

**Security tests:** stale auth epoch/revoked grant, role inactive, assigned PM versus other PM, foreign agency, Super Admin non-operational, contractor/inspector/citizen denial, hidden dependency endpoint, malformed IDs, operator injection, audit snapshot minimization, transaction rollback, revocation/race limitations, double click, disconnected Mongo 503. Test from API, not only hidden buttons. **Regression tests:** Step 57 review lifecycle, Step 58 milestone states, Step 59 append-only progress and no auto-completion, Step 60 permission-scoped provisional ratio.

### 7.3 Testing matrix/report format

Record for each `S61-xx`, `S62-xx` and each quality gate: `PASS`/`FAIL`/`BLOCKED`/`NOT RUN`, exact command, exit code, test counts, timestamp, environment, evidence file, reviewer, and failure explanation. A passing build or synthetic browser screenshot does not equal production approval or native translation approval. If there is a fatal security violation or an acyclic graph guarantee cannot be proven under concurrency, recommend **BLOCKED**, not a cosmetic pass.

---

## 8. Environment variables, API keys and deployment boundary

**No new external service or API key is inherently required** for Step 61/62. Reuse Node/Next local development env and in-memory Mongo replica. Existing `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_AUTH_LOGIN_ENABLED`, `FRONTEND_ORIGIN`, `PORT`, `INFRAOS_NEXT_DIST_DIR` may be configured *only in disposable process environment* to make browser testing work. Demo scripts can use clearly disposable local tokens/passwords but must have no import path from production modules and be excluded from `tsconfig.build.json`; never hardcode real secrets or leak passwords in screenshots/logs. No AWS requirement, no OpenRouter requirement, no Vercel deployment, no bank API, no email provider, no Maps key needed for these two features. Do not edit `.env.local`, use live Atlas, mutate production indexes, create deployment resources, or expose backend auth secrets to `NEXT_PUBLIC_*`.

**Database support:** `mongodb-memory-server` replica supports transactions; if a transaction fails due to missing replica set, fix the fixture—not by disabling transactions. Live indexes and migrations need separate operational authorization and compatibility review.

---

## 9. Branch strategy and consolidated G1–G6 control

The **Cursor execution file** contains the operational G1–G6 rules inside each complete execution prompt and within the single final review prompt. This section documents the gates without authorizing them. No separate G1/G2/... prompt is needed.

| Gate | Safe intended result | Approval |
|---|---|---|
| G1 | Read-only Git preflight, `git fetch origin`, safely create/reuse `feature/projecttrace-timeline-dependencies` from current `origin/development` | Explicit, may be included in initial scoped G1–G5 approval |
| G2 | Stage **exact** approved Step 61/62 implementation/test/docs/evidence; inspect staged name-status/stat/check | Explicit, may be included in initial scoped G1–G5 approval **after** acceptance criteria pass |
| G3 | Create one meaningful feature commit (or sensible small sequence if owner authorized), verify contents | Explicit, covered by scoped G1–G5 approval only if acceptance passed |
| G4 | Push only the feature ref using `git push -u origin HEAD:refs/heads/feature/projecttrace-timeline-dependencies` | Explicit, covered by scoped G1–G5 approval |
| G5 | Open a **draft** PR into `development`, check changed paths, checks, comments; **do not merge** | Explicit, covered by scoped G1–G5 approval |
| G6 | Make PR ready, obtain required reviews, reconfirm head/base and CI, merge into `development`, check post-merge CI | **Separate explicit owner approval AFTER PR review and passing checks** |

**Suggested read-only preflight commands:** `git status -sb`, `git branch -vv`, `git diff --name-status`, `git diff --check`, `git ls-files --others --exclude-standard`, `git diff --cached --name-status`, `git rev-parse HEAD`, `git rev-parse origin/development`. If preexisting changes might be overwritten by branch checkout, STOP; never stash/reset/clean/force. Preserve unrelated `docs/operations/production-readiness-gates.md`, Step 53/54/58 reviews, historical Step 59/60 review edits and all `Prompts/`, regardless of their tracked/untracked status; protect based on exact current diff, not a hardcoded list.

**G1 example after approval and safety checks:**

```powershell
git fetch origin
git switch --no-track -c feature/projecttrace-timeline-dependencies origin/development
```

Only create if the branch does not exist. If it exists, inspect and ask rather than reset it. **G2 example after approval:** `git add -- <exact-reviewed-paths>` then `git diff --cached --name-status`, `--stat`, `--check`; never `git add .` or `-A`. **G3 after approval:** `git commit -m "feat(projecttrace): add scoped timeline and project dependencies (steps 61-62)"`. **G4 after approval:** explicit destination command above. **G5 after approval:** draft PR with clear risks/quality proof. **G6 only after separate permission:** required reviews, CI, exact head/base, no conflict, no unattended auto-merge; after merge verify development and post-merge checks, leave main untouched.

**Stop conditions:** fatal feature security/error/incomplete essential acceptance, missing exact approval, changed remote base, unexpected staged file, file overwrite threat, unresolved merge conflict, failing CI, missing review requirements or uncertainty about proposed cross-agency semantics. An initial scope approval cannot waive these conditions. Never combine G6 consent with G1–G5.

---

## 10. Expected deliverables and owner handoff

### Step 61 completion package

- Actual route, normalized timeline API, verified permission layers, accessible multi-locale responsive UI, source/precision legend, real project+milestone+progress data and unit/integration tests.
- `docs/reviews/step-61/IMPLEMENTATION-STATUS.md` with S61 acceptance, status, paths and browser evidence.
- Screenshot/URL proof of authorized timeline, planned/actual milestone state, reported progress label, mobile, foreign denial and error handling.

### Step 62 completion package

- Persisted and audited project-to-project prerequisite model and route(s); safe scoped picker/list/add/soft-remove UI; cycle detection protected against concurrent opposite edge transactions; timeline link integration; unit/integration tests.
- `docs/reviews/step-62/IMPLEMENTATION-STATUS.md` with S62 acceptance, policy decisions, blocked cross-agency or completion semantics and browser evidence.
- Screenshot/URL proof of add→refresh→cycle denial→soft-remove and stale/foreign denial; graph-race automated evidence.

### One combined end-of-phase package

- `docs/reviews/steps-61-62/END-OF-PHASE-VERIFICATION.md` with exact commands/counts, security, quality, accessibility, screenshots, demonstration walkthrough, unresolved risks, scope-based verdicts and full G1–G6 activity only if explicitly authorized.
- Clear owner handoff: routes, how to launch/stop only disposable demo processes, which synthetic fixture role can perform which action, what requires live data/policy, what was NOT RUN, and the dependency to **Step 63 — Project Activity History**.
- Record risk backlog: Step 59 contractor identity pending; Step 60 PAID provenance provisional; Step 58 optional weight/delete deferred; Step 51 auth/agency races; Atlas index approval; native translations; staging cookies/email/release controls; cross-agency dependency policy; any graph serialization limits.
- **Acceptance language:** “Feature recommendation” separate from actual owner signoff, and **production readiness BLOCKED** until all deployment gates really pass.

### Ready-for-next-roadmap condition

Do **not** implement Step 63 in this phase. Hand off normalized, scoped sources for later history work, but keep timeline *plan/actual schedule and reported-progress oriented*. Step 63 may later introduce authorized activity feeds, but must not retroactively pretend old events have known timestamps or expose private audit snapshots.

**End of specification. No application code, branch, Git write, database write, PR, merge or deployment is performed by this document.**
