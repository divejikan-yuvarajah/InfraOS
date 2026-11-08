# INFRAOS — Enhanced Development Specification
## Roadmap Steps 55–56 of 190 | ProjectTrace: Edit Project & Validation → Project Lifecycle & Status Workflow

**Project:** INFRAOS — National Infrastructure Intelligence & Coordination Platform  
**Vision:** *The Operating System for National Infrastructure*  
**Product:** Sri Lankan university GovTech demonstration using synthetic information; **not** a live government service  
**Scope:** Steps **55 and 56 only**, sequentially, with a real browser demonstration after *each* step and a consolidated end-of-phase review after both  
**Repository:** https://github.com/divejikan-yuvarajah/InfraOS  
**Canonical development workspace:** `C:\Users\ASUS\Desktop\InfraOS\InfraOS`  
**Integration branch:** `development`; **stable branch:** `main`; **recommended shared feature branch:** `feature/projecttrace-edit-lifecycle` (create only if none approved already exists)  
**Prepared:** 26 October 2026, from accessible GitHub repository source. GitHub does **not** reveal uncommitted local work.  
**Companion:** `INFRAOS_Steps_55_56_Cursor_Agent_Execution_Prompts.md`

> **Source fidelity and binding:** The canonical `Prompts/Steps.docx` was actually read from the accessible GitHub `development` branch. The exact roadmap lines are **“Step 55 — Edit Project & Validation”** and **“Step 56 — Project Lifecycle & Status Workflow”**, the latter with the subline **“Planning → approval → active → delayed → completed/cancelled.”** The immediately following entry is **“Step 57 — Project Approval Workflow.”** The roadmap does **not** supply detailed Step 55 sub-bullets. Every technical detail below beyond those exact lines is an *implementation specification inferred from the locked repository architecture*, not an invented quotation. The actual workspace copy and any newer owner-approved directives take precedence after explicit reconciliation.

---

## 1. Verified remote baseline and source-of-truth hierarchy

### 1.1 GitHub snapshot (read-only)

At inspection, `main` HEAD was `8abea58fe376587ef45d4471c082e7c0c7167d26` (PR #93 merge); `development` HEAD was `35edec5d309a067e181b74a27ce85f69eebc9f36` (the Steps 53–54 implementation commit). Both contain the Phase 53–54 changes; the commit ancestry and local working tree must be checked again by Cursor. Source: GitHub REST refs and the repository's Step 54 files. **No claim is made about current local staged, untracked or uncommitted changes, or whether a real browser was successfully tested on the developer computer.**

| Verified existing capability | Evidence / implementation surface | Limitation carried forward |
|---|---|---|
| Project creation (Step 52) | `/projects/new` → `POST /api/v1/projects` creates a scoped `DRAFT` | Form is not a project submission or approval flow |
| Project list (Step 53) | `/projects`, server paginated/filtered/sorted `GET /api/v1/projects` | Signed-in end-to-end browser test previously NOT RUN |
| Project overview (Step 54) | `/projects/[id]/overview`, `GET /api/v1/projects/:id` | Read-only; no Edit / Submit / Approve control |
| Draft PATCH API foundation (Step 51) | `PATCH /api/v1/projects/:id` with `revision`, scoped and `DRAFT` only | No edit page; allowlist limited to title, description, location, geometry, dates |
| Authorization | JWT bearer + live permission, resource scope, agency hierarchy, active/verified account checks | Production authentication deliberately has preview gate; cannot bypass |
| Private account query caching | TanStack Query keys include auth epoch, user id, role and project id; cache cleared on account switch | Must preserve after updates/transitions |
| Transactional writes and audit | Project creation/PATCH use Mongo transactions, audit rows, `__v` optimistic revision | Race on agency reparent / changing grants during snapshot previously BLOCKED |
| Project state vocabulary | `apps/api/src/modules/projects/project.constants.ts`: `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `ACTIVE`, `ON_HOLD`, `DELAYED`, `COMPLETED`, `CANCELLED` | Locked `requirements.md` also mentions `REJECTED`, but the implemented enum does not. **Do not add it silently**. |

### 1.2 Essential locked references to inspect locally before editing

- `Prompts/Steps.docx` (especially 51–58); `docs/reviews/step-54/IMPLEMENTATION-STATUS.md`; `docs/reviews/steps-53-54/END-OF-PHASE-VERIFICATION.md`; `docs/reviews/step-51/END-OF-STEP-VERIFICATION.md`; Step 52 handoff.
- `docs/planning/requirements.md` sections FR-PROJECT-001 through 010 and §3.1 state machine; `docs/planning/business-rules.md` BR-PRJ-001 through 010, BR-INT-001 through 005; `docs/planning/user-workflows.md`.
- `docs/architecture/projecttrace-architecture.md`; `docs/ux/project-detail-architecture.md`; `docs/database/data-model.md`; `docs/security/permission-catalog.md`, `permission-matrix.md`, `segregation-of-duties.md`.
- Frontend: `apps/web/src/app/projects/`, `apps/web/src/components/projects/`, `apps/web/src/lib/projects/`, authentication client/query state, `apps/web/src/styles/auth-access.css`, reusable RHF/Zod/form UI, DataTable and status badge.
- API: `apps/api/src/modules/projects/{project.constants,projects.schema,projects.routes,projects.service,projects.types}.ts`, `models/project.model.ts`; `apps/api/src/modules/identity/authorization/{resource-scope,require-permission}.ts`; audit model and transaction code; `apps/api/tests/projects-foundation.test.ts`.
- `packages/shared-types/src/permissions.ts`, `docs/design/{brand-color-system,design-tokens,semantic-status-colors}.md`, `docs/setup/environment.md`, `.env.example` files; package scripts and installed versions.

**Precedence:** owner-approved newer scope → exact original roadmap wording → locked requirements/security/ADRs → current approved implementation → historical proposed prompts. If these conflict in a consequential way, document the discrepancy and **block the affected action** rather than creating new permissions, statuses, routes or indexes from guesswork.

### 1.3 Explicit unreconciled policy questions (not permission to improvise)

1. `REJECTED` appears in the early project state machine but **not** in the implemented `PROJECT_STATUSES`; Step 57 is the dedicated approval/rejection workflow. Do not add `REJECTED` in Step 56 by assumption; record a Step 57 policy decision.
2. The current Project model has **no `submittedBy` or `submittedAt`** field, while SOD-05 requires a submitter/approver separation for Step 57. Step 56 must establish a trusted submission-actor record for future enforcement. Prefer existing immutable transactionally committed audit evidence if sufficient and proven; otherwise propose a narrowly scoped additive field/data migration with explicit owner approval. Never silently change Atlas schema or indexes.
3. No separate `project.start`/`project.delay` permission exists. Existing grants are `project.update`, `project.submit`, `project.approve`, `project.hold`, `project.cancel`, `project.complete`. Define and test a conservative action-to-existing-permission policy; **do not** create new grants or give Super Admin operational authority by accident. Escalate any permission meaning not supported by the locked role matrix.
4. Project completion/cancellation may depend on RoadSync conflicts and inspection evidence not implemented yet. A missing verifier means **BLOCKED**, not success. Do not claim complete/cancel when integrity predicates cannot be evaluated safely.
5. The Step 53–54 report says Atlas indexes were not approved, signed-in browser testing was NOT RUN, and invitation email, null-agency Super Admin login, grant changes during transactions, and agency reparent races were unresolved. Do not advertise production readiness.

---

## 2. Absolute execution and safety rules

1. Work **only** inside `C:\Users\ASUS\Desktop\InfraOS\InfraOS`. Do not create a second clone, sibling project, Git worktree, or an alternative workspace.
2. **Never touch, move, rename, inspect unnecessarily, or delete the `Documents` folder.** Do not create screenshots there; use a small review evidence directory **inside this repository** and avoid sensitive content.
3. Use **one feature branch for this related pair** (suggest `feature/projecttrace-edit-lifecycle`), reusing an already appropriate owner-approved branch. `development` is integration; `main` is stable-release-only. Do not switch branches when the worktree is dirty without an owner decision.
4. Inspect `git status --short --branch`, `git log -5 --oneline --decorate`, tracking refs and branch ancestry. Never stash/reset/clean/force checkout or overwrite others' work as a shortcut.
5. No `git add .` or broad staging. **Never commit, push, open a PR, merge, or promote to `main` without separately explicit owner authorization.** Commands may be prepared only.
6. Preserve the **Connected Future** public landing page (`/`, `/si`, `/ta`) unchanged. No new public projects or geography disclosures.
7. Preserve existing Next.js 16 App Router, React 19, TypeScript, Tailwind v4, RHF/Zod, TanStack Query, shadcn/Radix, Express 5, Mongoose 8 and existing modular-monolith/API envelope. Install no new package unless essential, verified and approved.
8. Use the existing Sri Lankan flag-inspired design tokens (orange `#FF5B00`, yellow `#FEB600`, maroon `#8C1F28`, green `#279541`, accessible neutrals); use **semantic contrast-safe** token aliases, not raw bright colors for body text. Premium operational UX means restrained layout, legible headings, good empty/loading/error states, not unnecessary decorative UI.
9. Browser and API authorization are distinct: only backend permissions, live actor/session checks, scope and database business rules authorize writes. Never weaken production authentication, use fabricated JWTs in the user-facing app, seed live Atlas, or expose secrets to the frontend.
10. Implement Step 55 then run its **essential focused checks plus real signed-in browser demo**. Only when satisfactory start Step 56. **Run the full-suite, integrated, security and UX review only once after both**; do not introduce separate testing prompts after each step.
11. Documentation should be lean: one step status/review note each, one combined phase acceptance report, real screenshots as evidence when a safe browser actually ran. No duplicate architectural essays or fake pass stamps.
12. Do **not** implement Step 57 approval queues/approver decisions or later milestones, timeline, financial reporting, RoadSync, AI, RAG, DocTrace, asset conversion or public portal under this phase.

---

# PART I — STEP 55: EDIT PROJECT & VALIDATION

## 3. Step 55 objective and boundaries

**Goal:** Convert Step 51's existing revision-checked, audited, `DRAFT`-only PATCH capability into an intuitive, secure and fully integrated real project editing experience, without broadening the server allowlist by accident.

**Expected operational journey:** authorize staff → open `/projects` → select project → `/projects/{id}/overview` → Edit → edit existing DRAFT fields → validate → save exactly once → confirmed server result → updated overview and list → no stale cross-user cache. View-only users and non-DRAFT projects may view permitted details but must not edit them.

### 3.1 Scope of editable fields (verified current PATCH contract)

| Field | Draft edit | Server behavior | UI treatment |
|---|---|---|---|
| `title` | Yes, trimmed 1–200 | Existing strict `safeText` | Required text with character/error feedback |
| `description` | Yes, nullable | 1–5000 when supplied; `null` clears | Multiline, clear optional field |
| `location` | Yes, nullable | Strict nested allowed fields: province, district, locality, roadName, description | Clear labels, explicit blank/clear semantics |
| `geometry` | Yes, nullable | Existing valid GeoJSON only | Reuse point longitude/latitude input; preserve pre-existing LineString/Polygon unless user explicitly edits/removes through a supported UX |
| `startDate`, `plannedEndDate` | Yes, nullable | ISO UTC; end >= start if both | Date-only UI → verified UTC `YYYY-MM-DDT00:00:00.000Z` |
| `revision` | Required precondition | integer `__v` current revision, 0..1,000,000 | Hidden from user, read from detail API, immutable for request |
| `projectCode`, `agencyId`, `managerId`, `createdBy`, `status`, `physicalProgress`, `financialProgress` | **No** | Server-owned/immutable/separate workflows | Read-only context or omitted from body |
| `projectType` | **Not in current PATCH schema** | Preserve existing type; no silent expansion | Display read-only unless a separately approved contract is established |
| `budget` | **Not in current PATCH schema** | Governed by finance.budget.update and audit, not generic project.update | Display only if readable; no generic budget-edit control |
| `contractorId`, `actualEndDate`, risk fields | **No** | Future/privileged domain workflows | Never forge or quietly enable |

**Edit correctness details:** Differentiate `undefined` (leave unchanged), `null` (explicitly clear supported optional field), and nonempty valid values; the UI must not silently clear an existing geometry. Do not flatten a LineString/Polygon to Point. If editing unsupported geometry types, preserve them exactly and show a safe read-only summary with an explicit removal confirmation if removal is supported. A blank location object should be normalized intentionally; no unknown properties. Controlled date transformations must avoid local-time timezone shifts. Do not trust frontend validators as server security.

### 3.2 Frontend design and routing

- Recommended route: `apps/web/src/app/projects/[id]/edit/page.tsx`; this page is **private** and `noindex, nofollow`. Reuse `StaffWorkspaceShell`, Overview header/context, breadcrumbs, React Hook Form + Zod, established app form components, status badge and clean project labels. Do not fork the entire create form merely to edit; extract a small shared field section/transform if this reduces duplication without destabilizing creation.
- Render the Edit action only when **actual edit capability is established** from current user role *and current resource assignment/status*; client UI is advisory. Avoid naive roleKey-only checks: PM may read within agency but only edit their assigned projects.
- Prefill from `GET /api/v1/projects/:id`, with an explicit Loading skeleton, missing/out-of-scope/forbidden/unavailable state; if the project is no longer `DRAFT` or its permission is revoked mid-session, prevent save and show how to return safely.
- Save uses existing `PATCH /api/v1/projects/:id` JSON envelope and the existing request client. Send only allowlisted changed fields plus captured revision. In-flight Save is single-flight (`retry:false`), disabled to prevent double action; display `Saving…`, confirmed `Saved`, network ambiguity guidance, error summary/focus, and a clear Cancel / discard-unsaved confirmation.
- On confirmed 200: update/invalidate the current-account `project.core` query and scoped project-list keys, then navigate to the same project's overview (preserving a sanitized return-to-list filter when possible). Any token/epoch/user change while pending discards response/cache writes/navigation.
- On **409**: retain unsaved values, announce that another edit/state change occurred, load current revision only after deliberate comparison; **no silent resubmit/overwrite**, and no automatic HTTP PATCH retry. Distinguish 400 validation, 401 auth expiry, 403 forbidden, 404 missing/out of scope, 415 unsupported content, 429 rate-limited where applicable, 503 unavailable, offline/network indeterminate outcome.
- Accessible form: linked `<label>` and `aria-describedby`, error descriptions, focus first failing control, screen-reader `role="status"` for save result, keyboard interactions, visible focus, no horizontal scroll at 320/360/390/768/1024/1440 widths, usable 200% zoom/reduced motion. EN first; preserve/extend existing Sinhala and Tamil draft dictionaries and mark native review pending.

### 3.3 Backend/API and persistence

**Prefer using the existing endpoint** rather than duplicating one. Keep current response envelope, `Cache-Control: no-store`, `requireAuthenticated`, live `requirePermission('project.update')`, `projectWriteFilter`, role ceilings, active agency/role/credential checks, content-type/Zod `.strict()` and transaction+audit in `projects.routes.ts`/`projects.service.ts`.

- Preserve `DRAFT`-only writes, 24-hex ObjectId input handling (malformed 400), scope-filtered 404, permission 403, stale `revision`/status conflict 409, failure 503.
- CAS `__v` and `status:DRAFT` must be verified inside the transaction; keep `AuditLog` creation in the *same* transaction and fail/roll back together.
- Run validators, prohibit arbitrary `$set`, operator injection, prototype pollution, unknown request body keys, role/agency/status writes, hidden or privileged fields, and accidentally writable `budget`.
- Validate combined persisted+patch dates, not only the patch fragments. Check geometry coordinates/ring rules using existing validator. Null clearing must map to controlled `$unset`.
- Verify audit values are meaningful but do not expose private budget without permission or write credentials into audit logs. Avoid inventing an activity feed (Step 63).
- Do not create indexes or migrate collection data as part of Step 55. No new `.env` keys or external service/API keys are needed.

### 3.4 Step 55 focused verification / acceptance gate

Run focused API service/Supertest + browser form/transform tests and the relevant local TypeScript/lint subset. Specifically prove: normal valid draft edit; unchanged-field/no-op; explicit clearing; previously stored LineString/Polygon preserved; date ordering; 400/401/403/404/409/415/503; forged fields rejected; disabled user, removed `project.update`, PM not assigned, inactive agency/ministry out of scope, contractor/citizen, Super Admin write denied, non-DRAFT denied; same revision concurrent PATCH has one winner; audit rollback; account-switch cache safety; existing create/list/overview regression.

**Mandatory real output before Step 56:** In a browser using an **authorized disposable local Mongo replica set** and synthetic active, verified staff, demonstrate opening a real DRAFT, visiting its edit form, changing a safe field, saving through actual API, reloading to confirm persistence, then showing one role-denied case and a 409 stale-editor case. Capture real annotated screenshots (redacted, no secrets) and URL/navigation notes. A preview gate or mock screenshot is **NOT RUN / BLOCKED**, not PASS. If browser tooling or disposable auth is unavailable, record blocker, supply manual owner instructions and **do not claim mandatory demonstration complete**; the owner must decide whether to proceed to Step 56 with that acknowledged blocker.

**Completion criterion:** Step 55 is feature-complete only when a real API-backed draft edit works and appropriate failures are safe. Focused automated PASS without browser evidence is an implementation checkpoint, **not** final owner acceptance.

---

# PART II — STEP 56: PROJECT LIFECYCLE & STATUS WORKFLOW

## 4. Scope, state graph and Step 57 boundary

**Exact roadmap:** *Project Lifecycle & Status Workflow* — *Planning → approval → active → delayed → completed/cancelled.*

**Goal:** Centralize *official* project-state legality, validation, authorization, audit and concurrency in ProjectTrace and surface allowed non-approval lifecycle actions in the protected project overview. Do not implement the **Step 57 Project Approval Workflow** (review queue, approve/reject decisions, reviewer assignment and notifications). A reviewer decision is not a cosmetic status dropdown.

### 4.1 Locked state graph and careful reconciliation

`docs/planning/requirements.md` §3.1 defines:

| Current | Canonical next states | Phase-55/56 treatment |
|---|---|---|
| DRAFT | SUBMITTED | **Step 56:** safe human `Submit for review` if complete and authorized |
| SUBMITTED | UNDER_REVIEW, REJECTED | **Step 57 reservation:** no reviewer processing here |
| UNDER_REVIEW | APPROVED, REJECTED, DRAFT | **Step 57 reservation:** no approve/reject/send-back actions here |
| APPROVED | ACTIVE, CANCELLED | **Step 56:** authorized Start / pre-start Cancel subject to policy |
| ACTIVE | ON_HOLD, DELAYED, COMPLETED, CANCELLED | **Step 56:** subject to action-specific permissions and integrity gates |
| ON_HOLD | ACTIVE, CANCELLED | **Step 56:** resume/cancel subject to policy |
| DELAYED | ACTIVE, ON_HOLD, COMPLETED, CANCELLED | **Step 56:** resume/hold/complete/cancel subject to policy |
| REJECTED | DRAFT | **Conflicting unimplemented status:** defer reconciliation to Step 57; do not invent enum |
| COMPLETED | terminal | No casual edits/transitions; correction flow later |
| CANCELLED | terminal | No arbitrary resurrection; dependent conflict/work handling required |

**Critical discrepancy:** Runtime `PROJECT_STATUSES` **omits** `REJECTED` despite legacy requirements. Implement a typed policy only against the existing nine statuses. Clearly flag `REJECTED` and all reviewer actions **reserved/blocked**, and do not implement an ad hoc rejection field or generic status PATCH. Preserve historical records safely if future migration eventually introduces the status after approval.

### 4.2 Authority and action policy (verify against live role grants)

Use a server-side `transitionProject` service (or similarly named single authoritative function), not direct arbitrary writes to `Project.status` in routes or UI. Separate **requested action**, **expected current status**, **record revision**, and **human reason**; never accept `toStatus` as untrusted general-purpose write authority.

| Action / tentative existing grant | Role and scope check | Hard preconditions |
|---|---|---|
| `SUBMIT` → `project.submit` | Agency Officer own agency; Project Manager *assigned* project. Neither Super Admin nor Gov Admin approval privilege substitutes for submission. | `DRAFT` + complete valid project core: title/type/code/budget, planned start/end, valid GeoJSON and required location; no forged submitter identity. |
| `START` → **proposed** `project.update` | Only permitted operational actor within resource write scope, and only if locked policy confirms this interpretation. | `APPROVED` only; never implies implicit approval; recheck current authorization. |
| `HOLD` and `RESUME` → `project.hold` | Allowed Gov Admin / Agency Officer / assigned PM in scope; enforce current live permission. | `ACTIVE`→`ON_HOLD`, `ON_HOLD`→`ACTIVE`; reason for hold required; resume semantics recorded. |
| `MARK_DELAYED` and `RESTORE_ACTIVE` → **proposed** `project.update` (or approved interpretation) | Operational write actor with verified scope and state | `ACTIVE`→`DELAYED`, `DELAYED`→`ACTIVE`; reason required to delay; do not alter planned dates or mark 100% completion automatically. |
| `COMPLETE` → `project.complete` | Gov Admin / Agency Officer / assigned PM in scope where permitted | From ACTIVE/DELAYED only; completion rules BR-PRJ-005, unresolved blocking conflicts, required inspections, required evidence; fail closed if proof unavailable. |
| `CANCEL` → `project.cancel` | Gov Admin / Agency Officer / assigned PM in scope where permitted | From APPROVED/ACTIVE/ON_HOLD/DELAYED only per locked state table; reason required; dependent OPEN RoadSync conflicts/work requests must be handled consistently. |
| `START_REVIEW`, `APPROVE`, `REJECT`, `RETURN_FOR_CHANGES` | Reserved `project.approve` / owner-approved Step 57 policy | **NO HTTP operation or clickable UI action in Step 56**; no direct grant from other permissions |

**Permission mapping is a proposed implementation decision, not a newly approved security policy.** Before exposing `START`, delay, complete or cancel operations, verify the locked role-permission mapping, actual downstream validators and owner-approved operational policy. If not proven, make that action unavailable with a precise reason and an explicit **BLOCKED** acceptance item. Do not create `project.start`, `project.delay`, wildcard privileges or unreviewed role seeding. Preserve the existing Super Admin read-only ceiling for project operations.

### 4.3 Backend lifecycle design

- Add a pure/testable lifecycle policy module inside `apps/api/src/modules/projects/`, e.g. `project-lifecycle.ts`: `ACTION → allowedFrom → nextState → required permission → reason policy → prerequisite validators`. Reuse existing status constants and shared contracts. A simple explicit mapping is preferable to a generic workflow engine.
- Extend `projects.schema.ts` with a strict, **action-discriminated** request schema, containing a literal action, `revision`, optionally expected status and a bounded safe `reason`; no user/agency/role/status/approval fields. Validation errors distinguish malformed ID vs bad action/reason; sanitize length/control characters.
- Suggested single endpoint: `POST /api/v1/projects/:id/transition` using existing envelope. If current route contract mandates a different endpoint, favor compatibility and document the deviation. Place route carefully relative to `/:id` and PATCH. Keep read/detail routes unchanged except additive, sanitized capability metadata if truly needed.
- Authorization flow: verify JWT and live account, live permission (not stale token claims), active agency, role ceiling, scoped **Mongo write filter** (`projectWriteFilter`), PM assignment, state and `__v`, dependency/validation results; reject IDOR/out-of-scope as 404 without disclosing project existence. Authorization must be repeated at mutation time even if UI had displayed the action.
- Transaction: stable hierarchy/role checks consistent with existing pattern; conditional `{_id, status, __v, scopedFilter}` compare-and-set; increment revision exactly once; persist trusted submitter evidence and reason; append immutable `AuditLog` with actor, transition/from→to, timestamp/requestId/agency, safe reason. Any failure rolls back project change plus audit. Concurrency means two racing stale transitions cannot both commit.
- **Submission attribution / SoD handoff:** To enable Step 57's SOD-05, the submitting actor must be reconstructable reliably for each active submission cycle. Evaluate existing append-only audit under transaction; if insufficient, propose `submittedBy/submittedAt` (and possibly submission sequence) as additive server-owned Mongoose fields, with a migration and Atlas impact review, and **obtain owner approval before any live schema/index/database mutation**. No client-supplied submitter ID, and no self-approval path.
- Read-model UI capability: optionally return a small **authorized, sanitized list of available actions** in `GET /api/v1/projects/:id` (or an existing equivalent contract) so UI does not guess assignment/permission from role alone. Treat it as UX hint, **never** sufficient mutation authority. Calculate from live role/actor/current resource state, suppress unsupported or blocked actions, and do not expose private conflict details in denial messages.
- Require complete fields for SUBMIT, even though DRAFT can omit planned dates/geometry. Date ordering remains UTC. Geometry must pass existing server shape/coordinate validator independently of map availability. Budget remains integer minor LKR units; the frontend must not author a new budget or agency as part of transition.
- Terminal integrity: **physicalProgress = 100 does not automatically complete**. Do not silently skip RoadSync conflict and inspection verification; if no safe adapter exists, emit an explicit unavailable/conflict/block response without changing status. Cancellation must not leave newly invalid work/conflicts inconsistently active: use a proven transactional integration or deny the transition until available. Do not mock a dependency check that always returns success.
- Failure contract: 400 invalid shape/ID, 401 expired/invalid actor, 403 live permission role ceiling, 404 absent/out-of-scope, 409 impossible transition/stale revision/precondition conflict, 415 non-JSON, 429 where rate limit applies, 503 DB/downstream unavailability. If required, choose a stable, documented error code for business preconditions *within existing envelope conventions*, rather than leaking Mongo errors or adding a new HTTP status at random.
- Never create/read a project status from AI/RAG recommendations, user-supplied `role`, `userId`, `agencyId`, `toStatus`, `financialProgress`, or `physicalProgress`. Audit reason/actor are immutable official record facts.

### 4.4 Frontend workflow

- Extend protected `/projects/[id]/overview` with a compact **Project Lifecycle** status panel (current stage, previous context if actually available, safe short explanation, next available actions). Reuse semantic `ProjectStatusBadge`, existing copy dictionaries, status colors and account-scoped cache keys. No flashy generic stepper claiming unimplemented reviewer action.
- Make `Submit for review` visible to permitted users on complete `DRAFT` records; if incomplete, show exact missing requirements and link to the Step 55 editor. Enable actions only from server-computed capability when available, and revalidate on backend.
- Use accessible confirmation dialog for material transitions. Require meaningful reason for hold/delay/cancel (and any other action required by approved policy), preserve values on failed submit, prevent double clicks, no automatic retries, show user-facing recovery from 409 (reload current status), 401/403/404/503 and network-unknown outcomes.
- Optimistically updating status is **forbidden** for official actions: show pending, await confirmed response, then invalidate/refetch list/detail/related permitted widgets on the correct auth epoch/user/role. Never redirect a different signed-in account or retain previous session response.
- Show `UNDER_REVIEW`/`APPROVED` as statuses if returned by API; Step 57 actions are **informational, not buttons**. `COMPLETED` and `CANCELLED` render as terminal with no operational action. Clearly label blocked completion/cancel if dependencies are missing, not a fake success.
- For EN/SI/TA, extend existing draft dictionaries with all status descriptions, action labels, confirm dialogs, reason helper text, completion-block copy, stale/conflict messages. Sinhala/Tamil remain **pending native linguistic validation** unless actually reviewed. Accessible to keyboard, screen reader and reduced-motion users.

### 4.5 Step 56 focused verification / acceptance gate

**Policy/unit tests:** cover *every* nine-state row, legal and illegal pair, action-specific permission map, missing reason, no `REJECTED` runtime mismatch acceptance, immutable terminals, allowed/disallowed roles, no fabricated reviewer approvals.

**API/disposable Mongo integration tests:** complete vs incomplete `DRAFT` submission, unauthorized or cross-agency actor, PM read-but-not-assigned, stale/duplicate simultaneous submission, forged actor/status/role, exact live grant withdrawal, disabled/expired sessions, already-approved record cannot skip review, audit+status atomic rollback, budget DTO privacy, deterministic date and GeoJSON validation, correct error envelope, cancellation side-effect blocked, completion without verification blocked, no automatic 100%-progress completion, no writes on failed dependency checks, no secret logging. Exercise valid actions only if permissions and dependencies are genuinely proven; otherwise document *BLOCKED*.

**Mandatory real Step 56 browser output:** With synthetic project(s) in an authorized disposable database, show `DRAFT` completeness failures, valid `Submit for review` changing actual backend status to `SUBMITTED` with a fresh record revision and audit evidence, and that review/approval is **not** implemented in this phase. For operating status states, use authorized fixture setup (not live UI forgery) and demonstrate each implemented allowed transition plus 409 conflict and role-denied path. Record screenshots, exact local URL path, navigation, account role, timestamps and safe API evidence. If the isolated browser cannot run, truthfully mark **NOT RUN/BLOCKED**; do not substitute a production preview page or screenshot mockup.

**Completion criterion:** A tested single authoritative state machine governs every implemented state write, enforces current permission/assignment/preconditions, and leaves reviewer approval to Step 57. A disabled action is not a delivered action: distinguish implemented/working, intentionally reserved, and dependency-blocked.

---

# PART III — INTEGRATION, QUALITY, ACCEPTANCE & HANDOFF

## 5. Shared implementation order (no unnecessary full-suite repetition)

| Order | Activity | Gate |
|---|---|---|
| 0 | Read canonical roadmap + review local repo/status; map Step 51–54 contracts; identify owner policy conflicts | Pre-implementation go/no-go; no dangerous work if blocked |
| 1 | Reuse/test existing PATCH DTO and permission/scope; design field transform and editor | Step 55 implementation |
| 2 | Build and integrate edit form; focused API/web regression; real signed-in edit demo | Step 55 essential PASS or explicit evidence-based blocker |
| 3 | Design typed lifecycle policy and action-permission matrix; document conflicting `REJECTED`/submitter policy | Step 56 pre-gate |
| 4 | Implement strict endpoint, transaction+audit/SoD evidence, downstream precondition adapters | Step 56 implementation; block unsafe transitions |
| 5 | Build lifecycle status panel, confirmation UI, localized draft copy; focused API/web regressions and real browser demo | Step 56 essential PASS or explicit evidence-based blocker |
| 6 | **One** end-of-phase comprehensive testing/review: all suites, TS/lint/build, browser E2E, security, integration, accessibility, concurrency, change review | Final APPROVE / REVISE / BLOCKED recommendation |
| 7 | Owner review of reports/screenshots and **separate** approval for Git operations | Prepare commands; no auto commit/push/PR/merge |
| 8 | Stop before Step 57 | Handoff approval workflow only |

## 6. Architecture/API contract overview

| Operation | HTTP | Expected user result | Authority / invariants |
|---|---|---|---|
| Existing list | `GET /api/v1/projects` | Paginated scoped summaries | `project.read` + scope; no budget on list |
| Existing detail | `GET /api/v1/projects/:id` | Scoped detail plus narrowly additive capabilities if chosen | budget only with `finance.budget.read`; no sensitive actor metadata |
| Existing create | `POST /api/v1/projects` | `201`, owned `DRAFT` | `project.create`; no forgery |
| Existing Step 55 edit | `PATCH /api/v1/projects/:id` | `200` updated DRAFT, `409` stale | `project.update` + role/assignment + revision + transaction/audit |
| Proposed Step 56 lifecycle | `POST /api/v1/projects/:id/transition` | `200` confirmed allowed action; otherwise safe error | action-specific grant + scoped CAS + prerequisites + audit; Step 57 reviewer decisions absent |

**Requests are illustrative where not yet implemented.** At execution, align HTTP shapes, body keys and response envelopes with current code before writing API clients. The client must never `PATCH status` by itself. Protected HTML remains `noindex`.

## 7. Required integration tests and threat model

Test role/actor matrix (SA, GA, AO, PM, Inspector, Contractor, Citizen, anonymous), active/inactive agency and role, cross-ministry IDs, read-only budget privacy, revoked grants, forged JWT/old session, revoked/disabled user, duplicate JSON properties/operators, malicious `list` redirect, control-character and huge reason, request-body `$` operators, duplicate clicks, concurrent `PATCH`/transition on same revision, account switch mid-flight, browser refresh, network timeouts and unknown mutation results. Confirm audit no duplicate official transitions, no split success between project and audit, and no exception leak. Document agency-hierarchy and grant-concurrency limits not fixed; do not infer that passing disposable tests proves full cross-service serializability.

## 8. Local environment / external services

**Actually required:** Node.js 22 LTS, npm 10+, existing Next.js/Express workspace, MongoDB/Mongoose in an authorized **isolated disposable development/test replica set** for transaction tests, and locally provisioned synthetic verified staff with correct role grants. Existing `apps/web/.env.local` normally needs `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000` and, when intentionally running local real login, `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=1`. `NEXT_PUBLIC_AUTH_FIXTURE=1` is not a real-login bypass. Backend secrets (`MONGODB_URI`, `MONGODB_DB_NAME`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, TTLs) reside **only** in `apps/api/.env` or test harness, never browser/client. Do not print env values.

**Not required:** OpenRouter, Qdrant, FastAPI AI, Cloudflare R2, Map tiles for input-only GeoJSON, email provider, SMS gateway, Vercel/Render production deployment, Redis, Kafka or new secret keys. Never introduce one just for these steps. Production `next start` currently returns the private-page preview gate; do **not** change that policy to fabricate live sign-in. A signed-in demo must use a safe non-production environment and intentionally authorized synthetic staff, not the seeded `*@infraos-demo.invalid` non-login fixtures. `npm run db:seed:demo` is **not** permission to write to Atlas.

## 9. Review evidence requirements and manual demonstration

### 9.1 Step-level evidence, mandatory after **each** implemented step

Create concise internal notes `docs/reviews/step-55/IMPLEMENTATION-STATUS.md` and `docs/reviews/step-56/IMPLEMENTATION-STATUS.md`, containing: roadmap scope, baseline Git SHA/branch + dirty-file preservation, code paths changed, APIs and role ceilings, test commands with actual output/exit codes, precise PASS/FAIL/BLOCKED/NOT RUN, open blockers, and **real browser evidence** (browser engine, actual route, visible result, test actor pseudonym, safe screenshot paths and no real-person data). Do not write “PASS” based solely on code inspection or a simulated screenshot. If screenshots cannot be captured, state that clearly and give exact manual instructions; do not invent images.

Suggested evidence paths **inside the repository** (only if authorized, ignore/redact before commit): `docs/reviews/step-55/evidence/` and `docs/reviews/step-56/evidence/`. Never store passwords, tokens, cookies, connection strings, PII, or real confidential coordinates in screenshots/logs. Browser URLs on developer machine are normally `/login`, `/projects`, `/projects/{id}/overview`, `/projects/{id}/edit` (new), with API `/api/v1/health` and `/ready`; verify actual ports instead of presuming.

### 9.2 One combined end-to-end demonstration after the pair

From an authorized synthetic AO/assigned PM session: (a) open the scoped listing; (b) open a DRAFT overview; (c) edit a title/dates/location, save once; (d) show persisted revision and overview/list freshness; (e) validate missing geometry/date submission failure; (f) supply required fields and **submit** to `SUBMITTED` through Step 56; (g) confirm edit is now disabled, revision/audit progressed, a second submit is rejected; (h) show another agency/role cannot read or transition it; (i) demonstrate one safe operational transition on a separately **authorized preset** state if the policy/dependencies actually allow it; (j) logout, switch account and verify no private cache reuse. Show approval actions **not implemented** because they belong to Step 57. Capture a short navigable walkthrough, screenshots, relevant local URLs and safe API response evidence. Mark every unexecuted scenario accurately.

### 9.3 Phase-wide testing (one final review only)

Execute and record exit codes for:

```powershell
npm run test:api
npm run test:web
npm run type-check
npm run lint
npm run build
```

Plus focused browser automation with real, isolated API/database if available, mobile width 320/360/390/768/1024/1440, 200% zoom, keyboard/focus, screen-reader semantics, reduced motion, no cross-account cache, no PII leak. Use automated security/permission test matrix and Mongo race tests. Genuine defects must be fixed, then affected focused tests and the relevant full suite rerun; retain FAIL-to-PASS chronology. Output status matrix with **PASS / FAIL / BLOCKED / NOT RUN** and final recommendation **APPROVE / REVISE / BLOCKED**. Do not recommend APPROVE if mandatory signed-in browser evidence is missing or critical security/integrity checks cannot run.

## 10. Definition of done by step

| Acceptance criterion | Step 55 | Step 56 |
|---|---|---|
| Matches exact roadmap title, no future step leakage | Required | Required |
| Existing audited backend contract reused; correct role+scope checks | Required | Required |
| Actual authorized form/action against backend persisted data | DRAFT editor save | Real safe transition, at minimum validated submit if policy approved |
| Input and server validation, safe errors, no duplicate mutation | Required | Required |
| CAS revision and transactional audit on mutation | Preserve | Enforce all transitions |
| Accurate EN/SI/TA draft copy with native-review label | Required | Required |
| Premium design system, keyboard, responsiveness | Required | Required |
| Focused API/web tests | Required | Required |
| Real signed-in browser, screenshots, URLs, walkthrough | **Mandatory** | **Mandatory** |
| Cross-scope, role-ceiling, budget privacy, account-switch tests | Required | Required |
| Correct prohibition of Step 57 reviewer approvals | No buttons | No reviewer actions |
| Unresolved policy/dependency blockers truthfully recorded | Required | Required |
| Comprehensive phase-wide suite and final acceptance | Once at end | Once at end |

## 11. Proposed file/change inventory (not a mandatory rewrite)

- **Likely Step 55:** `apps/web/src/app/projects/[id]/edit/page.tsx` (new), `apps/web/src/components/projects/project-edit-*.tsx` (new/reused), `apps/web/src/lib/projects/{edit-schema,edit-transform,api,types,messages}.ts`, conditional action on `project-overview-client.tsx`, local CSS; API tests around existing `projectPatchSchema/updateProjectDraft` only when defects found.
- **Likely Step 56:** `apps/api/src/modules/projects/{project-lifecycle,projects.schema,projects.routes,projects.service,projects.types}.ts`; related isolated API tests; optional reviewed Mongoose **additive server-owned attribution** if necessary and approved; `apps/web/src/components/projects/project-lifecycle-*.tsx`, `apps/web/src/lib/projects/{api,types,messages}.ts`, overview integration; lightweight unit tests.
- **Reports only:** `docs/reviews/step-55/IMPLEMENTATION-STATUS.md`, `docs/reviews/step-56/IMPLEMENTATION-STATUS.md`, `docs/reviews/steps-55-56/END-OF-PHASE-VERIFICATION.md` (avoid separate duplicate reports). Add screenshot evidence only from real executed browser runs.

Files above are guidance; inspect current layout before creating new files. Reuse existing code and components instead of copying modules or generating a parallel architecture.

## 12. Git discipline and permission checkpoints

**Read-only first:**

```powershell
Set-Location 'C:\Users\ASUS\Desktop\InfraOS\InfraOS'
git status --short --branch
git branch -vv
git log -5 --oneline --decorate
git diff --check
git diff --stat
git fetch origin --prune  # run only after verifying there is no restrictive network/owner policy
```

Do not checkout a branch on dirty work without approval. If clean and `development` baseline is verified, **propose** a related-step feature branch (`feature/projecttrace-edit-lifecycle`) or reuse an approved existing one. **Branch creation/checkout is a controlled local Git step, not authorization to stage, publish or merge.**

After implementation, **prepare only**, do not run without separately granted approvals:

```powershell
# AFTER owner explicitly authorizes staging; replace placeholders with inspected EXACT paths
# git add -- <specific-reviewed-projecttrace-source-and-test-files> <specific-reviewed-report-files>
# git diff --cached --check
# git diff --cached --stat
# git commit -m "feat(projecttrace): implement draft editing and guarded lifecycle"
# git push -u origin feature/projecttrace-edit-lifecycle
# Open PR: feature/projecttrace-edit-lifecycle -> development (owner-approved action)
# Review and merge only after separate approval; development -> main only at later stable release authorization
```

Never stage `.env`, lockfile from accidental `npm install` drift, `Prompts/`, `Steps.docx`, private screenshots, or teammates' unrelated changes without explicit review. Use exact changed-file paths instead of `git add .`; if test snapshots are generated, review their privacy and source. A PR from `development` into `development` is invalid.

## 13. Risks, limitations, and handoff to Step 57

| Risk / open question | Mitigation and required disposition |
|---|---|
| No signed-in real-world local demo yet | Isolated replica + synthetic staff; otherwise **BLOCKED**, never pretend preview means success |
| Legacy `REJECTED` conflicts with current enum | Reserved for owner-approved Step 57 decision; no silent schema rewrite |
| No trusted submitter field in Project model | Evaluate audit as immutable source; if insufficient, submitter field proposal + authorization, do not write Atlas |
| Operational `START`/delay permissions not explicitly named | Conservative existing-grant mapping + owner policy review; block unclear actions |
| Downstream RoadSync conflict and inspection completion checks not ready | Completion/cancellation fail closed rather than violate integrity |
| Atlas indexes unapproved | No `syncIndexes`/`createIndexes` or shared/production DB connection during tests |
| Step 50 invitation email and SA null-agency sign-in | Existing unrelated blockers retained; do not overexpand scope |
| Agency reparent / live permission changes during a transaction | Races must be tested/reported; don't claim serializability without proof |
| Unreviewed EN/SI/TA copy | Mark as draft and request native language review, not translation PASS |
| Other team branches and dirty files | Inspect status; do not overwrite, rebase or include unrelated changes |

**Next roadmap step:** **Step 57 — Project Approval Workflow**. Handoff a precise API contract, `SUBMITTED`/`UNDER_REVIEW` statuses, submitter identity proof for SOD-05, lack of `REJECTED` policy decision, reviewer authority matrix, audit event design and browser test notes. **Do not build the Step 57 approval queue, approve/reject endpoints or decisions here.**

**Final instruction:** Deliver working, securely authorized implementation only if it is actually executed and verified in the *future Cursor run*. This file itself specifies the work; it does **not** claim Step 55/56 source has been implemented, tested or demonstrated.
