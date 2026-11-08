# INFRAOS — Enhanced Development Specification
## Roadmap Step 58 of 190 — Milestone Management

**Product:** INFRAOS — National Infrastructure Intelligence & Coordination Platform  
**Vision:** *The Operating System for National Infrastructure*  
**Module:** ProjectTrace · post-approval delivery planning and milestone execution  
**Implementation workspace (the only permitted workspace):** `C:\Users\ASUS\Desktop\InfraOS\InfraOS`  
**Prepared:** 28 October 2026, using read-only connected GitHub review  
**Scope:** Step **58 only**; **no code was modified while preparing this document**.  
**Companion:** `INFRAOS_Steps_58_Cursor_Agent_Execution_Prompts.md`.

> **Mandatory distinction:** Step 58 feature-development readiness is not production-deployment readiness. The production release remains **BLOCKED**. Implement and demonstrate this step only with explicitly authorized, isolated, disposable local/test infrastructure. Do not connect browser demonstrations or automated tests to a live MongoDB Atlas database.

---

## 0. Source-of-truth ledger and confidence boundaries

### 0.1 Verified original roadmap

Read-only inspection of the **actual** GitHub-hosted `Prompts/Steps.docx` at `development` confirmed these consecutive titles:

| Roadmap step | Original title | Boundary |
|---|---|---|
| 57 | Project Approval Workflow | Completed predecessor: review and rejection/return/reopen |
| **58** | **Milestone Management** | **This development specification** |
| 59 | Physical Progress Tracking | **Not Step 58** — independent project-level physical progress submissions |
| 60 | Financial Progress Summary | **Not Step 58** — financial progress derived from finance data |
| 61 | Project Timeline | **Not Step 58** — complete cross-project timeline experience |
| 62 | Project Dependency Management | **Not Step 58** — dependency graph and cycle handling |
| 63 | Project Activity History | **Not Step 58** — full project activity history |
| 64 | ProjectTrace Dashboard & KPIs | **Not Step 58** — broad dashboard metrics |

**Interpretation:** The canonical roadmap supplies the Step 58 title; the detailed behavior is grounded in `docs/planning/requirements.md`, §1.4 and §3.5, `docs/planning/user-workflows.md`, §7, `docs/planning/business-rules.md`, `docs/security/permission-matrix.md`, and the actual source model. The detailed endpoints, UI patterns and transaction design below are **implementation proposals**, not quotes from `Steps.docx`. When executing locally, reread canonical sources and flag discrepancies rather than assuming proposed details are already approved.

### 0.2 Exact functional requirements grounded in repository documentation

| Requirement | Existing source | Step 58 interpretation |
|---|---|---|
| **FR-MS-001** — Create milestones | `requirements.md`, §1.4 | Project Manager; parent project exists and is editable; record has name/title and planned dates; **optional weight is specified in requirements but not supported by current schema**; milestone list complete |
| **FR-MS-002** — Track milestone state | `requirements.md`, §1.4 | Project Manager; server enforces allowed transitions and rejects illegal jumps |
| Canonical state-machine prose | `requirements.md`, §3.5 | `PLANNED → IN_PROGRESS → COMPLETED`; `PLANNED/IN_PROGRESS → DELAYED/BLOCKED`; `DELAYED/BLOCKED → IN_PROGRESS/CANCELLED`; `IN_PROGRESS → CANCELLED` |
| Core user workflow | `user-workflows.md`, §7 | Open **ACTIVE or APPROVED** project, add planned milestones, move through allowed states, reflect changes in timeline, reject invalid transitions |
| **BR-PRJ-010** | `business-rules.md` | Milestone completion **never** automatically completes parent Project |
| Nearby but separate | **FR-PROG-001–003** and Steps 59–60 | Project-level physical progress and financial progress belong to later scope; do not build them here |

### 0.3 Latest *remote* GitHub state, not local assumptions

Verified via the connected GitHub repository:

- Repository: `https://github.com/divejikan-yuvarajah/InfraOS`
- `development`: `596e50648de5e6fad212c5601ff53b6952fa7dad` (PR #100 integrated).
- `main`: `9ca89e9825e7396e0564423923c257ceccd49bd2` (PR #101 subsequently integrated).
- Step 57 Project Approval Workflow: previously merged via PR #97 and verified through `docs/reviews/step-57/END-OF-STEP-VERIFICATION.md`.
- Production auth opt-in and CI quality gates: committed by PR #100. The quality workflow ran successfully in GitHub; **this does not clear production release blockers**.
- The last user-reported local branch had been `feature/production-readiness-phase-1`. Older local `development` was stale; **the GitHub connection cannot verify the current local working tree**, dirty files, services or effective `.env.local`.
- The committed `docs/operations/production-readiness-gates.md` is a **historical local record**: statements such as “workflow uncommitted / NOT RUN” became outdated once PR #100 merged. Do not overwrite history or mistake those statements for current remote CI status.

### 0.4 Architectural source references to inspect before editing

| Existing file | Verified purpose / relevance |
|---|---|
| `apps/api/src/modules/projects/models/milestone.model.ts` | Mongoose milestone fields, timestamps, `strict: "throw"`, `projectId`/`plannedEnd` index |
| `apps/api/src/modules/projects/project.constants.ts` | `MILESTONE_STATUSES`, project statuses |
| `apps/api/src/modules/projects/models/project.model.ts` | Parent project, agency/manager assignments, status and progress |
| `apps/api/src/modules/projects/projects.routes.ts` | Authenticated `projectRouter`, strict JSON validation, envelopes and request correlation |
| `apps/api/src/modules/projects/projects.schema.ts` | Zod patterns and strict-body conventions |
| `apps/api/src/modules/projects/projects.service.ts` | Scope checks, revision/CAS, transactions, audit, fail-closed response patterns |
| `apps/api/src/modules/projects/lifecycle.policy.ts` | Existing parent-project transitions; several deliberately blocked actions |
| `apps/api/src/modules/identity/authorization/resource-scope.ts` | Resource scope and assignment policies; certain assignment joins intentionally unavailable |
| `apps/api/src/modules/identity/authorization/require-permission.ts` | Live permission checks, not JWT-derived grants |
| `apps/api/src/modules/identity/seed/system-role-permissions.ts` | Actual seeded milestone permissions for each role |
| `packages/shared-types/src/permissions.ts` | Locked permission names: `milestone.create/read/update/delete` |
| `apps/api/src/modules/audit/models/audit-log.model.ts` | Append-only bounded snapshots; **does not support arbitrary title/description snapshots** |
| `apps/api/src/modules/audit/audit.constants.ts` | `MILESTONE` already recognized as an audit resource |
| `apps/web/src/components/projects/project-overview-client.tsx` | Current overview layout; **no milestone UI currently present** |
| `apps/web/src/lib/projects/api.ts` | Access-token memory epoch guards, typed API requests, retry rules |
| `apps/web/src/lib/projects/types.ts` | Project details and DTO contracts |
| `apps/web/src/components/auth/staff-workspace-shell.tsx` | Existing authenticated staff layout |
| `apps/web/src/components/data-table/` | Reusable tables, sorting, pagination |
| `apps/web/src/styles/`, design tokens | Established app branding, focus indicators, responsive rules |
| `apps/api/tests/projects-review.test.ts` and `projects-lifecycle.test.ts` | Patterns to replicate for milestone integration/security tests |
| `.github/workflows/quality.yml`, `.nvmrc` | CI, Node 22, isolated tests and production-login-disabled build |
| `docs/reviews/step-57/` | Previous-step handoff, known browser evidence/limitations |
| `docs/operations/production-readiness-gates.md` | Separate unreleased production risks; not a blocker to isolated Step 58 work |

This source review is based on committed remote files. Cursor must check actual local versions and report divergence before implementing.

---

## 1. Product goal and outcome

### 1.1 Problem

Approved government infrastructure projects often have many delivery checkpoints (survey, drainage preparation, road base, paving, inspection handoff). Without an accountable milestone system, staff lose date ownership and cannot distinguish a planned checkpoint from one in progress, delayed, blocked, cancelled or completed. A static timeline is insufficient: users must be able to create and change real persisted records subject to agency scope, role restrictions, project lifecycle rules, and auditability.

### 1.2 Step 58 solution

Deliver a **project-scoped milestone workspace** that:

1. Lists real milestones for the selected project in planned-date order.
2. Lets an appropriately permitted, in-scope actor create milestones for an eligible project.
3. Supports editing permissible milestone fields and explicitly allowed status changes.
4. Shows milestone progress and planned/actual date context **without** pretending to implement Step 59 project physical progress or Step 61 universal timeline.
5. Preserves milestone state in MongoDB and displays it after browser refresh and sign-in change.
6. Produces bounded, append-only audit events and prevents cross-agency reads/writes, stale concurrent edits and invalid transitions.
7. Looks like a **premium, serious, accessible Sri Lankan GovTech/enterprise** product on mobile, tablet and desktop.

**A working feature is not just a screen:** every action presented as available must call the real API, pass permission checks, persist to an isolated DB, provide truthful feedback and refresh the correct cached data.

### 1.3 Measurable successful output

An authenticated assigned Project Manager can open an eligible project, create two milestones, see them in the list/timeline, edit one, advance one through allowed transitions and refresh without losing data. Another in-scope authorized actor sees only capabilities genuinely granted to them; an outsider cannot read or mutate the milestones. Reopening two tabs and submitting the same revision results in a **single successful update and a 409 for the loser**. Parent-project status is unchanged when a milestone completes.

---

## 2. Mandatory decisions and compatibility gates

These are **current inconsistencies or design-policy boundaries**, not license to rewrite established rules. Document decisions before schema changes.

| Gate | Verified mismatch or ambiguity | Recommended Step 58 resolution |
|---|---|---|
| **M1 — initial status** | Requirements call initial status `PLANNED`; `MILESTONE_STATUSES` and model **persist `NOT_STARTED`**. | **Preserve `NOT_STARTED` as the storage/API enum** and label it **“Planned”** in the UI. Implement the canonical transitions by mapping `PLANNED` requirements onto this existing status. Unit-test the mapping; never start storing mixed `PLANNED` and `NOT_STARTED` without explicit owner approval and migration. |
| **M2 — optional weight** | FR-MS-001 mentions optional weight; model has **no `weight` field**. | No fake weight UI. Do not add new fields or indexes by assumption. If the project owner explicitly approves a backward-compatible optional `weight` field, define constraints, indexes/migration impact, validation and tests; otherwise mark **weight BLOCKED / NOT IMPLEMENTED** while delivering the rest. |
| **M3 — milestone progress** | Model has `progress` (0–100), but requirements do not define how status maps to numeric progress. | Persist milestone-local progress only, with clear validation. Define a conservative completion rule (e.g. `COMPLETED` forces 100%, optionally sets `actualEnd` from trusted server time) **as an explicit local design decision** before implementing; never copy progress to `Project.physicalProgress`. |
| **M4 — editing / deleting** | Source model and permission catalog support CRUD permissions, but requirements explicitly prioritize create and state tracking; full deletion semantics unspecified. | Support editing where safe. Deletion, if included, must require `milestone.delete`, obey scope and an **approved soft-deletion/cancellation vs hard-deletion policy**. Prefer state `CANCELLED` for progressed records. Do not silently delete audited milestones or invent a `deletedAt` schema field. |
| **M5 — project eligibility** | Workflow: **ACTIVE or APPROVED** project; FR-MS-001 says “project exists and is editable”. | Restrict milestone mutations to **ACTIVE/APPROVED** initially unless repository-approved policy is more precise. Enforce on server per operation. Never change parent state just to enable milestone creation. |
| **M6 — contractor assignment** | Permission seeds grant Contractor `milestone.read`, but `Contractor.userId` join is not trusted / unavailable in scope policy. | Do not infer assignment via agency alone or a caller-provided ID. Return a fail-closed 403/404 or an explicitly approved trusted assignment adapter; record any unsupported contractor view honestly. |
| **M7 — snapshot content** | Audit snapshot schema supports status, reason, agency, some numeric fields—not raw title or arbitrary milestone date fields. | Audit allowed bounded snapshots (e.g. before/after status, resource id, actor, scope/requestId); avoid claiming full-text history unless safe approved snapshot extensions are implemented. |
| **M8 — broader release risk** | Step 51 race proofs, Atlas index verification, invitation/recovery email, null-agency Super Admin and SI/TA native acceptance remain open. | Continue feature work in isolated environment, **not** production. Preserve existing fail-closed logic. Do not declare the new service deployable or silently remediate unrelated platform-wide risks. |

**Scope gate procedure:** Implement the uncontroversial core behavior first. For an ambiguity requiring a locked model/policy change, mark that subfeature **BLOCKED** pending approval while implementing unaffected Step 58 deliverables; explicitly disclose it in the report. Do not stop all work over optional weight or speculative features.

---

## 3. Detailed functional scope

### 3.1 Milestone index / list

- Accessible from Project Overview via “Milestones” section/link; use a predictable nested project route such as `/projects/[id]/milestones` only if consistent with existing route conventions.
- Fetch by parent `projectId`; never accept caller-supplied `agencyId`, `managerId`, role or MongoDB filter operators.
- Show title, short description, status, **planned start/end**, actual start/end when present, completion/progress, clear overdue marker when justified, and accessible permitted actions.
- Default date order (earliest planned start or end; choose and document); stable secondary sort for deterministic ordering.
- Truly scoped empty states: “No milestones yet”, no-access, unavailable project, no matching results, offline and retry.
- If pagination is useful, use existing DataTable server-mode conventions and bounded `page`, `limit`, whitelist sorting. Avoid arbitrary request parameters or unbounded `find`.
- Keep budget and other sensitive project fields separate and permission guarded; list should not fetch full project documents or unrelated projects.

### 3.2 Milestone creation

- Actor has live `milestone.create` AND sufficient read visibility of the project AND required assignment/agency/project-state eligibility.
- Form fields from verified schema: `title` (required <=200), `description` (optional <=2000), `plannedStart`, `plannedEnd`; optional actual dates and progress only if approved for the create flow, otherwise default server-side to 0/`NOT_STARTED`.
- Trim and reject blank/special-control text, malformed timestamps, impossible date order, oversized payloads and unknown keys. Choose UTC date/time handling and timezone display deliberately; avoid Sri Lanka day-shift bugs.
- Server constructs `projectId`, initial status and zero progress. Do not allow client to set `projectId` independently of nested URL or bypass organization scope.
- Respond with a safe DTO and appropriate `201`, refresh list and cache, show truthful confirmation.
- If weight remains unapproved, do **not** send/accept it or render a nonfunctional field.

### 3.3 Editing milestone details

- Permit edits only on appropriate statuses/project states and only to allowlisted editable fields (title/description and planned dates as governed).
- Include `revision` from the latest server DTO; reject stale change with 409 and tell the user to refresh; never silently overwrite concurrent editors.
- Invalid date modifications, modifications after completion, cross-project milestone IDs and attempts to change audit/system fields are server-side failures.
- Status changes use a separate, explicit action rather than allowing PATCH to accept arbitrary status strings.

### 3.4 Canonical transitions, persisted representation and UI labels

Map documentation `PLANNED` -> persisted `NOT_STARTED`. Do **not** persist `PLANNED` without a separately approved migration.

| From (stored) | Permitted to (stored) | Reject examples |
|---|---|---|
| `NOT_STARTED` | `IN_PROGRESS`, `DELAYED`, `BLOCKED` | `COMPLETED`, `CANCELLED` directly |
| `IN_PROGRESS` | `COMPLETED`, `DELAYED`, `BLOCKED`, `CANCELLED` | `NOT_STARTED` and same status |
| `DELAYED` | `IN_PROGRESS`, `CANCELLED` | `COMPLETED` direct, `BLOCKED` direct |
| `BLOCKED` | `IN_PROGRESS`, `CANCELLED` | `COMPLETED` direct, `DELAYED` direct |
| `COMPLETED` | none | any mutation without controlled correction policy |
| `CANCELLED` | none | any restoration without authorized correction policy |

- Define an explicit `milestone.policy.ts` or equivalent isolated pure policy module; reuse established lifecycle styles.
- No status mutation by merely editing the UI badge. API validates `from`, `action`, parent status, actor role/scope and expected revision.
- Set `actualStart` / `actualEnd` with trusted server timestamps when a milestone genuinely starts/completes; validate existing dates. State-change audit records resource MILESTONE and old/new statuses.
- If completion synchronizes milestone-local `progress=100`, test transaction consistency; `Project.status` and `Project.physicalProgress` must remain unchanged.
- Guard read-only/terminal/cancelled parent project states even if the UI erroneously exposes controls.

### 3.5 Small embedded timeline, *not* future Step 61

- A **milestone-specific** timeline/list is in scope because Step 58 user workflow requires “Timeline reflects changes”. Implement modest timeline bars or a dated sequence (planned windows, current state, actual completion where available).
- No cross-module Gantt engine, global dependency links, geospatial route, cross-project timeline, automated financial summary, risk prediction or full activity-history feature.
- A CSS-based responsive timeline with accessible date labels and status text is sufficient. Prefer useful information density and correctness over heavy libraries.

### 3.6 Data lifecycle & persistence

- Maintain parent references; no orphan milestones, no unauthorized parent rewrites. Always fetch parent and child through matched `projectId` and scope filters.
- Use Mongoose validators (`strict: "throw"`, date order, numeric `percentage()`). Honor the existing `{ projectId: 1, plannedEnd: 1 }` declared index; **do not create or sync indexes on live Atlas**.
- Audit all meaningful creates and state transitions. If editable field changes cannot be fully captured by existing safe audit schema, store at least an event and correlation metadata; document exactly what is/not retained.
- Consider project cancellation/approval changes racing a milestone write: transactional re-read of parent eligibility and existing lock conventions, but **do not claim Step 51 race remedies are complete** unless tested.

---

## 4. API & contract proposal

Use existing `/api/v1` routing conventions and confirm no route collisions. These are **suggested** endpoints, not claims that these routes already exist.

| Method | Proposed route | Permission | Behavior |
|---|---|---|---|
| GET | `/api/v1/projects/:projectId/milestones` | `milestone.read` + parent visibility | Scoped paginated list ordered by planned dates |
| GET | `/api/v1/projects/:projectId/milestones/:milestoneId` | `milestone.read` + parent visibility | Safe detail + current revision + permitted actions |
| POST | `/api/v1/projects/:projectId/milestones` | `milestone.create` + editable assigned project | Create `NOT_STARTED`, progress 0 |
| PATCH | `/api/v1/projects/:projectId/milestones/:milestoneId` | `milestone.update` + editable assigned project | Allowlisted details + expected revision |
| POST | `/api/v1/projects/:projectId/milestones/:milestoneId/transition` | `milestone.update` + assigned project | Action / expected revision + audit, legal edge only |
| DELETE (conditional) | `/api/v1/projects/:projectId/milestones/:milestoneId` | `milestone.delete` and approved deletion policy | Only if deletion semantics explicitly approved; otherwise omit endpoint, explain |

**Example DTO (proposal, review against existing envelopes):**

```ts
interface MilestoneDetailDto {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "DELAYED" | "BLOCKED" | "CANCELLED";
  plannedStart: string;
  plannedEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  progress: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
  availableActions: string[]; // advisory only; API authorization is decisive
}
```

**Body proposal:** Create `{ title, description?, plannedStart, plannedEnd }`; patch `{ title?, description?, plannedStart?, plannedEnd?, revision }`; transition `{ action: "START"|"MARK_DELAYED"|"BLOCK"|"RESUME"|"COMPLETE"|"CANCEL", revision, reason? }`. Map each action to a single verified allowed transition; do not permit arbitrary target status. Optional reasons need explicit allowed action list, min/max and audit strategy. Prefer following established safe `reason` validation; no unsupported freeform snapshots.

**Envelope:** Current API uses `success({ ... }, req.requestId)` / `failure(code, message, req.requestId)`; `Cache-Control: no-store` for private data. Correct status codes: 201 create, 200 GET/mutate, 400 validation/malformed IDs, 401 unauthenticated, 403 missing grants, 404 inaccessible child/parent, 409 version/state/dependency conflict, 415 wrong content type, 503 dependency issues. Do not leak private data through verbose errors.

**API implementation boundaries:**

- Route/controller is thin; Zod strict schema; service enforces current role grants and scope *on every request*.
- Reuse `readProject`, `projectReadFilter`, `projectWriteFilter` or appropriate secure composition, **not** a broad `Project.findById` plus after-the-fact filtering.
- For project-manager writes require `project.managerId === current user ID` and correct agency/assignment.
- `GOV_ADMIN`/`AGENCY_OFFICER` operations must obey the existing permission matrix plus exact scope; `SUPER_ADMIN` remains read-only for this domain even if seeded with read rights.
- Contractors and inspectors must not gain broader milestone access from mere possession of `milestone.read`; fail closed when trusted assignment chain cannot be proven.
- Use MongoDB session transactions with a comparison-and-swap `__v`/revision filter and append-only audit in the **same transaction**. Distinct simultaneous updates must result in one success/one conflict.
- Guard against duplicate creation on rapid double click (disable repeat while pending; consider idempotency if repository convention supports it). Do not invent irreversible uniqueness constraints.
- Validate and bound list sorting, date filters and pagination; index audit/cost should be read-only unless separately approved.
- No mutating calls in GET, no role permissions trusted from client, no reliance on UI-only enforcement.

---

## 5. Frontend, UX & accessibility specification

### 5.1 Design direction

Build a **premium, operational ProjectTrace interface**, not a bare administrative form and not a marketing landing page. Preserve the **Connected Future** public site exactly. Avoid generic neon dashboards or flag-color overload.

Established brand references:

- Bright orange `#FF5B00`: primary brand accents in appropriate contexts.
- Golden yellow `#FEB600`: pending or attention states.
- Deep maroon `#8C1F28`: serious critical/rejected/blocked indicators.
- Green `#279541`: genuine success/completion.
- Practical staff focus accent has used **darker `#B63D00`** against light surfaces; preserve tested, sufficiently contrasting focus patterns.
- White/off-white canvas, dark text and restrained neutral borders; distinguish states with **text and icons**, not color alone.
- Keep existing token files authoritative. Verify foreground/background contrast and 3:1 focus/non-text differentiation in actual browser, including orange filled controls.

### 5.2 Layout and components

- Breadcrumb: Projects › [project code] › Milestones; contextual parent status/agency label.
- Header: human-readable title and one clear “Add milestone” action only when allowed; show read-only explanation otherwise.
- Summary strip: milestone count, not-started, active, delayed/blocked, completed counts; derive from server list and label correctly, do **not** claim weighted project progress.
- Main content: responsive structured list/table with planned dates and state badges, plus a compact milestone-only timeline visualization. Maintain 320, 375, 390, 768, 1024, 1440 and 1920px layouts.
- Create/edit via accessible page, drawer or modal consistent with current app; strong field labels, date help, server-backed validation and a straightforward save/cancel.
- State-change controls provide a confirmation and explanatory sentence, bounded reason field only when supported, distinguish API success from optimistic UI state.
- Keyboard navigation, visible focus, semantic labels, logical heading order, accessible dialogs, Escape/cancel, proper focus restoration, screen-reader error associations, live status messages, disabled/pending states.
- Use existing `StaffWorkspaceShell`, `DataTable`, UI components, TanStack Query and React Hook Form/Zod where useful. Do not add packages merely for simple timeline bars.
- Server-provided `availableActions` can guide visibility; role checks in React are hints only. User must see safe 403/404 guidance and not a blank page.
- Signed-out and expired sessions never display previously cached private milestone data; preserve query-key auth epoch/user segmentation and clear on logout/session changes.
- Ensure dates are interpreted consistently (backend ISO UTC vs UI local Sri Lanka time) and do not shift planned dates unexpectedly.
- Loading skeleton/state, offline message, retry, empty, no-results, 409 stale edit, 503 dependency unavailable, success toast/inline status all required.
- Avoid fake KPI cards, unsupported “auto-delay” predictions, nonfunctional filters, hardcoded counts and static demo-only milestone arrays.

### 5.3 Multilingual scope

- Follow existing EN/SI/TA locale infrastructure and scoped module message dictionaries; translate at least all added labels, validation, statuses, empty states and action confirmations to the extent current architecture supports it.
- Existing SI/TA translations have **not** received independent native review; flag this in evidence. Do not present draft strings as certified translations. Keep accessible English fallback if needed rather than shipping gibberish.
- Date and number formatting must work in each view; no implicit translation of user-generated milestone titles/descriptions.
- Do not modify the locale-specific public landing page to achieve authenticated-workspace translations.

---

## 6. Authentication, authorization, privacy and security

| Role | Milestone permission seed verified | Mandatory additional scope/guard |
|---|---|---|
| `SUPER_ADMIN` | `milestone.read` | Platform operational **read** only; deny milestone writes and any operational approval bypass. Existing null-agency Super Admin sign-in remains separately blocked. |
| `GOV_ADMIN` | `create/read/update/delete` | Organization/ministry scope and active agency. Governed create/update, no cross-ministry reach. |
| `AGENCY_OFFICER` | `create/read/update/delete` | Own agency scope as defined; no broad ministry subtree by assumption. |
| `PROJECT_MANAGER` | `create/read/update/delete` | **Assigned project** for writes; agency-level read only as specifically permitted. |
| `CONTRACTOR` | `read` | Only trusted assigned context. Existing contractor→user linkage is unverified; fail closed without trusted mapping. |
| `INSPECTOR` | `read` | Only confirmed assigned inspection/project context; never general private list. |
| `CITIZEN` | no `milestone.*` | Denied private milestone APIs; public project summaries outside scope. |

- Gate every route with `requireAuthenticated` and `requirePermission` then enforce project+milestone scope in service.
- Reconfirm grants/credential epoch as repository safety patterns require. Parent project status and agency assignments must be validated during transaction.
- Audit with correct `MILESTONE` resource, actor, `projectId` association where safely representable, requestId, agency, and bounded old/new snapshots.
- Do not use untrusted query params to select MongoDB collections or query operators. Zod `.strict()` on mutating payloads, cap input length, reject control characters and `$` where existing text policy requires.
- Avoid passing raw Mongo documents, secret values, staff records or audit private snapshots to the client. Never use raw dangerouslySetInnerHTML for descriptions.
- Do not misuse `project.update` as a blanket grant for `milestone.update`; both permission catalog and action/resource scope are distinct.
- Do not bypass failing role/agency middleware to generate screenshots.
- Important existing unresolved concurrency concern: transactional reads alone do not prove revocation after a snapshot. Use existing locking patterns, test relevant interleavings and leave known Step 51 global race findings open unless truly fixed and independently verified.

---

## 7. Database details, migrations and external services

### 7.1 Existing Mongoose model

Verified fields: `projectId`, `title` (200), `description` (2000), `plannedStart`, `plannedEnd`, `actualStart`, `actualEnd`, `progress` 0–100, `status` (`NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`, `DELAYED`, `BLOCKED`, `CANCELLED`), `createdAt`, `updatedAt`, implicit Mongoose `__v`.

Existing index: `{ projectId: 1, plannedEnd: 1 }`. Existing schema is `strict:"throw"`. This means accepting `weight` without an approved schema update would fail or silently misrepresent functionality; never simply put it in the frontend.

### 7.2 Environment and secrets

Step 58 does **not** need a new API key, SMS/email provider, AI/LLM endpoint, map key, cloud storage or other paid external service. Use existing environment keys only:

| Location | Existing setting | Notes |
|---|---|---|
| Web | `NEXT_PUBLIC_API_BASE_URL` | Public API origin, without `/api/v1` suffix; browser must point to disposable API for demo |
| Web | `NEXT_PUBLIC_AUTH_LOGIN_ENABLED` | **Development-only demo** can enable against isolated auth; production stays preview unless separately approved HTTPS release gate passes |
| API | `PORT`, `FRONTEND_ORIGIN`, `API_PREFIX` | Preserve existing process/environment; distinct disposable ports e.g. API 4011 / web 3001 only if free |
| API | `MONGODB_URI`, `MONGODB_DB_NAME` | No Atlas for demo or tests; prefer in-process disposable memory replica provided by test harness |
| API | `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, TTLs | Existing auth config; ephemeral test values must not be printed/committed |
| Node | `.nvmrc` = `22` | Quality workflow uses Node 22 |

Do **not** modify `apps/web/.env.local` or `apps/api/.env` just to run a demo; prefer process-local overrides or a clearly isolated dedicated harness. Existing dev servers on **3000 / 4000 / 4010** must remain undisturbed. Avoid copying mock/demo credentials into deployment images.

### 7.3 Atlas and indexes

- `db:indexes:check` is read-only but still requires explicit authority and connection context for any live Atlas use; **not** required for Step 58 isolated acceptance.
- No live `syncIndexes`, `createIndexes`, `dropIndexes`, `db:seed:demo`, test writes, production migrations, or index reconciliations.
- If optional weight requires schema changes, get owner policy/schema approval before implementing or applying; check default/backfill compatibility and index impact.

---

## 8. Implementation sequencing — one consolidated Cursor run

**The companion Cursor file contains exactly one complete execution prompt for Step 58.** These are conceptual work stages, not separate prompts.

1. **Preflight (read-only):** confirm real local `git status --short --branch`, HEAD, remote `origin/development`, dirty/untracked files and Step 58 roadmap scope. Identify safe feature-branch path without Git writes until authorized.
2. **Policy and scope:** document M1/M2/M3/M4/M5 decisions and testable state machine. Reuse locked permission matrix and existing auth scope; no invented grants.
3. **Data and validation:** implement policy pure functions, Zod schemas, DTOs, Mongoose model compatibility; no live index changes.
4. **Service and routes:** implement parent-child-scope checks, create/list/detail/edit/transition; CAS revision and transaction-bound audit. Include only approved deletion semantics.
5. **Frontend integration:** typed API client, cache isolation, route, parent Project Overview link, accessible responsive forms and milestone-specific timeline/list.
6. **Focused verification:** unit, integration and security tests; TypeScript and affected lint/build; fix genuine defects.
7. **Actual disposable-browser proof:** signed-in Project Manager scenario, persisted milestone creation and status transitions, forbidden role, stale conflict, mobile and desktop captures.
8. **Handoff:** concise implementation status with modified files, tests, screenshots/URLs, open risks and owner Git approval checkpoints; stop before Step 59.
9. **One phase-final review only:** after implementation, run companion file's **single final overall testing/review prompt**, including full suites, real browser, security and accessibility regression checks.

Be time-efficient: no redundant plans, per-field mini-prompts, exhaustive changelog spam, speculative rearchitecture or recreating tests already covered by reusable helpers.

---

## 9. Test plan and evidence matrix

All API/integration tests must use the existing **disposable in-process Mongo replica** and never rely on Atlas. Reuse Vitest/Supertest patterns, with isolated user/agency/project fixtures and new `milestones.*` focused suite. Cover at least:

### 9.1 Pure unit tests

1. `NOT_STARTED` ⇔ UI “Planned” mapping; all six stored statuses.
2. Every allowed state edge; every forbidden direct jump and terminal-state retry.
3. Planned/actual date validation, ISO timezone handling, `progress` bounds including 0/100.
4. Text length/sanitization and strict unknown-field rejection.
5. Sorting and paging (stable default, bounds, allowed keys).
6. Completion 100% policy (if chosen) never modifies parent project status/physical progress.

### 9.2 Integrated API, security and concurrency tests

7. Assigned PM can create 2 and list only own eligible project milestones.
8. Eligible in-scope GA/AO paths, missing `milestone.create` after revocation denies.
9. Unassigned PM writes fail even with seed permission; same-agency cross-project denial as relevant.
10. Cross-agency/foreign ministry list, child detail and update do not leak data (404 or zero result).
11. Anonymous 401; citizen 403; contractor/inspector fail closed unless a proven assignment adapter exists.
12. Invalid project/milestone ID: 400; valid nonexistent: 404.
13. Parent state `DRAFT`, `SUBMITTED`, `REJECTED`, `CANCELLED`, `COMPLETED` blocks unauthorized milestone mutation.
14. Unknown JSON keys, malicious operators, wrong `Content-Type`, invalid dates, unexpected budget/agency fields fail.
15. Create persists defaults, list/detail DTO exposes no sensitive fields, refresh shows saved data.
16. Concurrent edits on same milestone revision: **one 200, one 409**; correct status and exactly one transition audit.
17. Competing status transition / edit race and parent status/agency change race where feasible.
18. Audit failure rolls back the milestone mutation; DB failure results 503 and no false success.
19. Resubmission or permission revocation during transaction is detected per existing locking policy; if global race proof missing, label **BLOCKED**, don't claim security clearance.
20. Ensure existing Step 57 review/reopen, Step 56 lifecycle, Step 53–54 read/filter and auth regression suites still pass.

### 9.3 Frontend tests

21. Render list, timeline/summary, empty/loading/error/offline/no-access states with mock transport.
22. Create/edit validation, feedback, disable duplicate submit, cache invalidation after mutation.
23. Approved/ACTIVE eligibility and available-action visibility from actual response.
24. Expired session/user-switch clears private data; 409 refresh/retry UX avoids overwrite.
25. EN/SI/TA fallback strings and accessible labels do not break long text layouts.

### 9.4 Browser acceptance matrix

| Scenario | What must be actually demonstrated | Evidence |
|---|---|---|
| Real signed-in assigned PM | Open eligible project, create milestones, edit, transition | URL and `step58-01`–`step58-...` screenshots |
| Persistence | Refresh/new query and read server records | Actual network status and page screenshot |
| Revoked/unassigned actor | Inaccessible project milestones not rendered; HTTP 403/404 | Redacted browser/network evidence |
| Stale second tab | One succeeds, other receives 409 (browser if feasible, API proof mandatory) | Screenshot or explicitly `NOT RUN` browser, test evidence |
| Completion isolation | Milestone completed, project remains its prior state | Two views + API assertions |
| Responsive | 320, 375/390, 768, 1024, 1440, 1920 widths | Actual screenshots and overflow checks |
| Keyboard/accessibility | Create dialog/form tab order, focus contrast, errors/status announcements | Test notes; automated tool output if available |
| Navigation/regressions | Existing Project Overview and Step 57 reviewer unaffected | Links/screenshots or test results |

**Never claim browser PASS from API tests, screenshots from a mockup, or an unstarted server.** If the agent cannot run an authenticated real browser, mark browser acceptance **NOT RUN / BLOCKED** and do not recommend unconditional feature APPROVE.

### 9.5 Command suite

Preflight: `git status --short --branch`, `git log -1 --oneline`, `git fetch origin` (read-only but respects local environment), `git diff --check`. Focused `npm run test -w @infraos/api -- tests/projects-milestones.test.ts` (only after file exists), targeted web tests, followed at phase end by:

```powershell
npm run test:api
npm run test:web
npm run type-check
npm run lint
npm run build
git diff --check
```

When testing web auth behavior under local `.env.local` overrides, set `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=0`, `NEXT_PUBLIC_AUTH_FIXTURE=0` and `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000` for the **test process**, matching `.github/workflows/quality.yml`; this must not edit `.env.local`. Distinguish local test flags from the isolated browser demonstration's correctly configured live dev login.

No test counts are predicted; compare actual outcomes against historical **306 API / 172 web** from the preceding Phase 1 record as background only, not guaranteed current totals.

---

## 10. Actual implementation and browser demonstration — mandatory

Create or reuse a **safe disposable Step 58 browser harness** with an in-process Mongo replica, permitted seed roles and two genuinely distinct users: assigned Project Manager and unauthorized actor (plus GA/AO if needed). Seed an appropriate **APPROVED** project; `ACTIVE` is currently gated by older lifecycle logic, so **do not bypass parent START restrictions merely to prepare a demo**.

1. Confirm effective browser API origin and live-development login conditions; don't edit production auth flags.
2. Start disposable API on a free port (e.g. 4011) and Next web on a free port (e.g. 3001) without stopping unrelated listeners on 3000/4000/4010. Ensure Next build/runtime API origin is explicitly the disposable API, not the stored `.env.local` 4000.
3. Sign in through real UI as assigned PM. Open a seeded `APPROVED` project and its new Milestones view.
4. Add “Site survey completion” and “Drainage channel preparation” with valid planned dates. Record POST status and persisted IDs (redact sensitive data).
5. Edit one title/date, refresh, confirm server persistence and `__v` change.
6. Transition one milestone `NOT_STARTED→IN_PROGRESS→COMPLETED` with correct confirmation and data retention.
7. Verify unchanged parent project `APPROVED` status and no project physical-progress mutation. Preserve existing Step 57 review/approval behavior.
8. Sign in as an out-of-scope actor, attempt same URL and API read/write, record deny behavior.
9. Exercise malformed dates and stale revision conflict; if two-tab UI execution unavailable, cite the API concurrency test and mark browser conflict **NOT RUN**.
10. Capture unaltered browser screenshots at desktop/mobile, view URLs, actual status codes and log excerpts with secrets redacted; owner should be able to repeat the walkthrough.
11. Stop only the disposable listeners the harness started. Leave existing services and `.env.local` unchanged. Discard disposable data automatically on shutdown.

**Expected screenshot location proposal:** `docs/reviews/step-58/evidence/step58-*.png`. Avoid including access tokens, session cookies, passwords, private staff emails or real citizen/project secrets in committed evidence. Include only synthetic data.

---

## 11. Pre-implementation review contract

Before writing feature code, the agent must produce a concise in-terminal or report preflight covering:

- Exact original Step 58 roadmap title and current docs version, dependencies, incoming Step 57 status and source state.
- Current **local** branch/HEAD and dirty worktree vs remote development `596e506` at preparation time (reconfirm at execution time; do not pin checkout to stale SHA).
- Safe branch strategy: feature-based `feature/projecttrace-milestones` **only after owner authorizes creation/switch**. Reuse suitable approved branch if it exists; no per-subtask branches.
- Proposed files; compatibility gates M1–M8; which are straightforward vs require owner policy/schema approval.
- No new services/keys; use disposable Mongo; keep existing Node22/CI.
- Test and browser evidence approach, including access-denial actors.

Do not halt over known production-release blockers that do not prevent safe isolated development. Do halt unsafe Git operations, live Atlas access or required unauthorized migrations.

---

## 12. Expected implementation artifacts (proposals, not preexisting)

Keep file count reasonable and adopt local conventions:

- API: `apps/api/src/modules/projects/milestones.policy.ts`, `milestones.schema.ts`, `milestones.types.ts`, `milestones.service.ts`, `milestones.routes.ts`, and minimal registration under `projects.routes.ts` / main router if appropriate; prefer fewer files if codebase conventions support it.
- Mongoose: existing milestone model remains canonical; **no schema field/index additions** unless approved.
- API tests: `apps/api/tests/projects-milestones.test.ts`, plus focused pure policy tests where useful.
- Web: `apps/web/src/app/projects/[id]/milestones/page.tsx`, `apps/web/src/components/projects/project-milestones-client.tsx` and necessary reusable form/timeline components.
- Typed client/types: `apps/web/src/lib/projects/milestones-api.ts` / `milestones-types.ts` / locale messages; integrate with existing `apiClient`, auth epoch and TanStack Query patterns.
- Project overview: add milestone action/summary/navigation in `project-overview-client.tsx` without redesigning the page or public site.
- Docs/evidence: `docs/reviews/step-58/IMPLEMENTATION-STATUS.md`, and phase-complete `docs/reviews/step-58/END-OF-STEP-VERIFICATION.md`; real synthetic screenshots.

Do not fill the repo with duplicate specifications, new libraries, hardcoded sample data in production UI, unused mock screens or premature Step 59/61 features.

---

## 13. Acceptance criteria — Step 58

| ID | Gate | Acceptance evidence |
|---|---|---|
| AC58-01 | Correct scope | Original Step 58 title and FR-MS requirements traced; Steps 59–64 explicitly excluded |
| AC58-02 | Authorized create | Assigned PM on an eligible project creates a valid milestone; server returns real ID/201; DB persists |
| AC58-03 | Read/list | Properly scoped, stable ordered list/detail; no cross-agency/private leak; safe DTO |
| AC58-04 | Edit | Allowed fields persist with a revision; invalid text/dates and terminal edit rejected |
| AC58-05 | Transitions | Canonical edge matrix works, forbidden transitions fail 409 |
| AC58-06 | Status model safety | Stores `NOT_STARTED` consistently; UI displays “Planned”; no silent `PLANNED` migration |
| AC58-07 | Optional weight truth | Weight either approved and actually implemented/tested or explicitly BLOCKED/not shown |
| AC58-08 | Security | Live grant + scope + PM assignment + denial roles verified by tests |
| AC58-09 | Concurrency & audit | Two writers -> one wins, one conflicts; audit write failure rolls back mutation |
| AC58-10 | Parent isolation | Completing milestone does not complete parent or change `Project.physicalProgress` |
| AC58-11 | Working UI | Integrated Project Overview link, real create/edit/status actions, persisted after reload |
| AC58-12 | UX & i18n | Responsive, keyboard, focus contrast, no broken multilingual fallbacks; native translation signoff pending recorded |
| AC58-13 | Regression | Existing Step 51–57 API/web checks unaffected; full phase suite/type/lint/build results recorded |
| AC58-14 | Browser acceptance | Authenticated disposable end-to-end flow, real screenshots/URLs and network evidence |
| AC58-15 | Handoff | Honest implementation report, open risks, Git approval gates, clear Step 59 boundary |

**Feature verdict:** `APPROVE` only when all **mandatory** ACs have PASS evidence, with optional policy-gated subfeatures clearly excluded and owner scope acknowledged. `REVISE` for repairable Step 58 regressions or missing mandated browser evidence. `BLOCKED` for a non-negotiable authorization/data-integrity dependency. The same agent's APPROVE recommendation is **not** independent owner signoff.

**Production verdict:** stays `BLOCKED` until the separately tracked release gates are independently reviewed; the Step 58 feature verdict must not erase that distinction.

---

## 14. Git workflow and explicit approval checkpoints

**User policy overrides any agent preference:** No Git **branch creation/switching**, stage, commit, push, PR, merge or force operations without *specific* owner approval. Do not `git add .` or stage all dirty changes.

1. **Read-only check:**

   ```powershell
   Set-Location 'C:\Users\ASUS\Desktop\InfraOS\InfraOS'
   git status --short --branch
   git log -1 --oneline
   git fetch origin
   git rev-parse origin/development
   git diff --check
   ```

   `git fetch origin` updates remote-tracking refs but does not switch branches or overwrite the working tree. Existing processes/env stay untouched.

2. **Owner checkpoint GIT-1:** Propose and request explicit approval before `git switch -c feature/projecttrace-milestones origin/development`. If branch exists, do not recreate. With dirty changes, first analyze whether switch is safe; stop if Git refuses. Do not stash/reset/clean/force.
3. Implement, test, screenshot, report **without** staging or committing.
4. **Owner checkpoint GIT-2:** Show exact intended changed-file list and `git diff --check`, then request approval to stage **only** explicit Step 58 paths (not `Prompts/`, historical review dirt, `.env*`, other teammates' work, or demo secrets); show `git diff --cached --stat` and `git diff --cached --check`.
5. **Owner checkpoint GIT-3:** Only after separate approval, commit with proposed `feat(projecttrace): add scoped milestone management`.
6. **Owner checkpoint GIT-4:** Only after separate approval, push feature branch with `git push -u origin feature/projecttrace-milestones`.
7. **Owner checkpoint GIT-5:** Only after separate approval, open PR targeting `development`, check GitHub Actions and independent review.
8. **Owner checkpoint GIT-6:** Only after separate approval and passing checks, merge into `development`. `main` is reserved for separately approved stable releases; do not automatically merge `development` into `main`.

These are **proposed command templates**; do not execute them just because they appear in this document. Recheck branches and remote commits immediately before every actual operation.

---

## 15. Outstanding risks, exclusions and Step 59 handoff

### Existing *production* release blockers (not newly fixed by Step 58)

- Live Atlas indexes and schema: not verified/approved for writes.
- Step 51 project-write vs role/agency revocation/hierarchy race proofs: unresolved.
- Production email invitation/recovery provider: unavailable without provider approval and verified delivery.
- Null-agency Super Admin authentication/authorization policy: unresolved; do not fix by bypassing agency checks.
- Native Sinhala/Tamil review: pending.
- Signed-in staging cookie/origin/refresh/logout checks, branch protections, backup/recovery and monitoring: pending.
- Historical `docs/operations/production-readiness-gates.md` statements about unrun CI may need dated post-merge addendum; this is separate documentation maintenance.
- Step 57 reopen two-tab UI conflict not executed in browser (API stale-revision coverage exists).

### Step 58-specific risks

- Initial status mismatch `PLANNED` vs `NOT_STARTED`; weight missing from schema; terminal milestone edits/deletion policy not fully specified.
- UI date vs UTC timezone drift; document exact display and mutation conventions.
- Contractor assignment join incomplete; no speculative broad read access.
- Milestone writes must honor parent lifecycle and live grants; known Step 51 timing races remain a possible system-level caveat.
- Complete milestone progress does not imply project physical/financial progress; show separate labels.

### Next step (do **not** implement in this scope)

**Step 59 — Physical Progress Tracking.** Handoff should describe the milestone-local progress data and explain what Project-level physical progress **was not** implemented. Future Step 59 must independently authorize Contractor/PM progress submissions, store percentage+notes/history, verify assignment and avoid auto-completing projects. Do not silently roll Step 59 behavior into Step 58.

---

## 16. Final deliverable contract for Cursor

At the end of implementation (before final phase review), provide:

1. Branch/HEAD/worktree scope; explicit statement of Git actions *not* taken.
2. Source changes and exact new API routes with schema/auth rules.
3. M1–M8 decision outcomes, including optional weight and contractor access limitations.
4. Test command outcomes, precise counts, and any known warnings.
5. Actual **working browser** URL(s), synthetic project and milestone code/IDs, walkthrough, screenshot paths and request status evidence; clearly mark anything not executed.
6. Security and negative-test evidence: cross-agency, 401/403/404, 409 conflict, audit rollback.
7. Outstanding release blockers and actual Step 58 feature recommendation separate from production readiness.
8. Proposed explicit Git checkpoints and safe next action; **stop before Step 59**.

Perform one single **comprehensive final Step 58 review** using the companion Cursor Agent file Section B when implementation is complete. Do not repeat the whole test suite after each small coding stage unless a failure requires it; run focused checks during implementation, full suite at the end.
