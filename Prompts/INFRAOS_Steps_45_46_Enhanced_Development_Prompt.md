# INFRAOS — Complete Enhanced Development Prompt
## Roadmap Steps 45–46 of 190 · Permission-Based RBAC and Agency/Resource Authorization

**Project:** INFRAOS — National Infrastructure Intelligence & Coordination Platform  
**Vision:** *The Operating System for National Infrastructure*  
**Repository:** https://github.com/divejikan-yuvarajah/InfraOS  
**Primary workspace:** `C:\Users\ASUS\Desktop\InfraOS\InfraOS` — **no additional worktrees or project folders**  
**Proposed shared feature branch:** `feature/auth-authorization-foundation` (create only after checking local/remote branches and preserving uncommitted work; do not create a branch automatically from this prompt document)  
**Integration:** `feature/*` → `development` → `main`, **each Git action requires explicit owner authorization**  
**Working date:** 2026-10-25 · **GitHub baseline observed:** `origin/development` `08d110881870edd…`; `origin/main` `097de14ba0e7af9…`  
**Workflow:** Step 45 implementation with focused checks → Step 46 implementation with focused checks → **one** independent, phase-wide final test/review → separate Git/release approvals.

> **Roadmap fidelity.** Available project roadmap references describe **Step 45 as the RBAC permission engine** and **Step 46 as agency/resource scope and IDOR enforcement**. The original owner `Steps.docx` was not directly available in this preparation session; Cursor must compare exact wording if present in the authorized `InfraOS` repository, record material differences and avoid guessing. The locked Step 4 security catalog/permission matrix and Step 44 handoff govern implementation. This is a development specification, **not a claim that Step 45 or 46 has already been built**.

---

# 0. Non-negotiable INFRAOS constraints

1. Work only within the existing **`InfraOS`** checkout at `C:\Users\ASUS\Desktop\InfraOS\InfraOS`. Do not create `InfraOS-step45`, `InfraOS-step46`, new Git worktrees, or sibling project directories. Do not modify, inspect unnecessarily, move, or delete `Documents`.
2. Preserve **Connected Future** public landing, `/`, `/si`, `/ta`, public information pages, locale middleware, and existing login/forgot/reset UI and production preview gate. Any necessary UI is confined to internal authenticated experiences.
3. The **Express API is the enforcement boundary**. Next.js route guards/sidebar visibility are UX only. Never treat a frontend role name, JWT permission claim, request payload, or `agencyId` submitted by the caller as authorization.
4. Follow locked product design: seven roles (Super Admin, Gov Admin, Agency Officer, Project Manager, Contractor, Inspector, Citizen); no invented eighth role or generic superuser bypass; permission codes exactly from `@infraos/shared-types` catalog and `Role.permissions` records; assignment + scope + workflow state + segregation of duties (SoD) must still apply.
5. **No speculative implementation of future operational modules.** Most production business route handlers do not exist as of baseline; reusable tested middleware and query filters are the Step 45–46 deliverable, with only safe integration to routes actually implemented or a test-only harness. Do not invent fake public API endpoints, broad CRUD, module dashboards, seeding, or external integrations merely for proof.
6. Never commit, push, open PR, merge, fast-forward, rebase, reset, stash, delete worktrees, modify Atlas schemas/indexes, or seed accounts without separate explicit owner approval; non-mutating Git inspection is allowed. Never run destructive Git commands. Prepare exact commands for later owner-authorized execution.
7. Environment: use existing `apps/api/.env`, `apps/web/.env.local`, `MONGODB_URI`, `MONGODB_DB_NAME`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `FRONTEND_ORIGIN`, `NEXT_PUBLIC_API_BASE_URL`, and existing auth flag. **No new API keys, email provider, AI, R2, Qdrant, maps, or external services** required. Do not introduce redundant secrets or env aliases. Isolated `_test` database only for automated writes; no Atlas development writes/indexes without owner approval.
8. Preserve `credentialEpoch` protection, HS256 issuer/audience/subject/token type checks, host-only HttpOnly Secure refresh cookie rules, login/refresh rotation, per-family logout, reset revocation, one-GET refresh retry, and React auth epoch guard. Do not claim logout revokes an unexpired JWT if no epoch change occurs; do enforce status/role/agency/epoch on protected requests.
9. Report evidence precisely as `PASS`, `FAIL`, `BLOCKED`, or `NOT RUN`, with command, exit code, test count and source SHA. A same-agent re-read is **not** a second-person independent review.
10. Strictly sequence Step 45 then Step 46; essential per-step checks happen inside the implementation pass; **run the comprehensive review once after both**. If Step 45 has a serious unresolved auth bypass, do not proceed to Step 46.

# 1. Repository facts, prerequisites, and entry gate

## 1.1 Verified source and integration facts

| Item | Observed state on 2026-10-25 | Implication |
|---|---|---|
| `development` / `main` | `08d110881870edd…` / `097de14ba0e7af9…`, PR #75 integrated feature, PR #76 promoted | Create new feature branch from latest **verified `origin/development`**, after checking for newer changes; never assume local branch is synchronized |
| Step 43 | Client-only private route guard, `/dashboard` shell; server middleware remains locale-only | Do not move access-control authority into Next.js middleware |
| Step 44 | `requireAuthenticated` and `GET /api/v1/auth/me` | `req.actor` contains `userId`, `roleId`, `roleKey`, `agencyId`, `credentialEpoch`; **no permissions** |
| Step 44 JWT | HS256; `iss=infraos-api`, `aud=infraos-web`, `typ=access`, required integer `ce`, required `sub`/`jti`/times; DB user/role/agency checks | Reuse existing identity layer; no duplicate JWT validator |
| Step 44 tests | Recorded 22 API files/260 tests, 26 web files/128 tests, type-check/lint/build PASS, **same-agent review** | Historical documented evidence, not proof of current new code or independently accepted release |
| Step 43–44 live browser | `/dashboard` 503/retry behavior observed; authenticated real `GET /auth/me` browser not proven | Keep live proof separate from fixtures; no bypass of Atlas approval |
| Atlas migration | Step 40–42 index proposals not authorized/deployed per committed handoff; dev `autoIndex` risk | **Do not start `dev:api` against Atlas** or run `syncIndexes()`/`createIndexes()` there without approval |
| API route tree | Health, ready, identity auth and email verification mounted; most operational endpoints are **not implemented** | Do not promise role-based operational route enforcement that has no route to protect |
| Role model | `Role.permissions` validated against shared `PERMISSION_CATALOG`; `Role.isActive`; single primary role per user | Database role permissions are the live grant source; seed set defines expected defaults, not a substitute for DB lookup |
| Seed | `SYSTEM_ROLE_PERMISSIONS` for seven roles | Preserve locked permission matrix and SoD, especially Super Admin not paying/approving/verifying/resolving |
| Data models | Project, WorkRequest, Conflict, CoordinationRequest, Inspection, Document, Notification, Issue, Payment, Agency, Contractor already exist | Step 46 scope helpers can be tested with realistic isolated records without creating full business APIs |

## 1.2 Authoritative reading order

1. `docs/reviews/step-44/{HANDOFF,END-OF-STEP-VERIFICATION,SECURITY-AND-INDEPENDENT-REVIEW}.md`, Step 43 handoff and residuals.
2. `docs/adr/ADR-007-rbac-resource-authorization.md`, `docs/architecture/authorization-flow.md`, `docs/architecture/security-decisions.md`.
3. `docs/security/{roles-and-permissions,permission-catalog,permission-matrix,route-access-policy,resource-authorization,rbac-test-plan}.md`.
4. `docs/planning/{business-rules,project-scope,assumptions-risks}.md`, especially Q-002/Q-005/Q-003 and SoD requirements.
5. `packages/shared-types/src/permissions.ts`, identity `Role`, `User`, `Agency`, and existing model relationships. `apps/api/src/modules/identity/seed/system-role-permissions.ts`.
6. `apps/api/src/modules/identity/auth/{require-authenticated,jwt,auth.routes}.ts`, `apps/api/src/routes/v1.ts`, request types in `apps/api/src/types/express.d.ts` and test utilities.
7. `apps/web/src/lib/auth/{route-access,confirm-identity,state}.ts`, `apps/web/src/components/auth/route-access-guard.tsx`, existing internal CSS tokens and `apps/web/src/middleware.ts`.

**Required preflight outputs:** branch/HEAD/local dirty-state inventory, current merged/unfinished 43–44 status, route matrix actual-vs-planned, baseline test commands, source-of-truth conflict register. Read only until branch-creation approval is available. Do not overwrite pre-existing local changes. If original `Steps.docx` exists **inside** the allowed repository, inspect; otherwise disclose unverified exact wording.

## 1.3 Gate P0 — Proceed / hold

Proceed with development only if Step 44 identity middleware is present and its tests pass or a small, reviewed prerequisite fix is necessary. Confirm existing `auth/me` retains 401/503 contract, no global `app.use(requireAuthenticated)`, and auth/public endpoints remain public. Do not require Atlas access merely for isolated tests. If gaps are severe, report `BLOCKED` and propose the smallest fix; do not silently weaken access.

---

# 2. Phase architecture and trust model

```text
Browser (untrusted UI, in-memory JWT)
  │ Bearer access JWT on protected requests
  ▼
Express REST route
  ├─ requireAuthenticated         Step 44: verify signature, ce, eligible DB actor
  ├─ requirePermission('x.y')    Step 45: current Role permissions from Mongo
  ├─ buildAuthorizedScope(actor) Step 46: agency/org/assignment/own filters
  ├─ verifyResourceAccess()      Step 46: private 404/field projection/business-state
  ├─ execute scoped query/write  no unscoped fetch with JS filtering
  └─ audit sensitive permitted operation, with redacted fields
```

**Deny by default, fail closed:** missing identity/permission/actor/role/agency data → no access. Invalid or missing access credential → **401** from Step 44. Valid actor missing capability → **403 `FORBIDDEN`**. Auth dependency outage/query failure → **503 `SERVICE_UNAVAILABLE`**, not false 403 or 404. Missing/out-of-scope private resource → **404** indistinguishable to unauthorized observer. Malformed supported ID → **400**. Invalid workflow/SoD transition → **409** (or per existing contract). Public resources must have public-only safe DTOs; no accidental private fallback. Never downgrade unexpected DB errors to empty public result.

**Time-of-check/time-of-use:** Step 44 rechecks `credentialEpoch` and active status; Step 45 must read current role permissions at request time. Step 46 must enforce authorization as part of query/update predicate (including scope and lifecycle conditions), not via a stale UI identity. Test role deactivation/reassignment, changed agencies, and concurrent revoke/permission mutations where appropriate. Avoid unbounded DB calls and unconstrained N+1 permission reads.

---

# 3. STEP 45 — RBAC permission engine (high/critical)

## 3.1 Mission and boundaries

Add **reusable server-side role-permission enforcement** after existing Step 44 `requireAuthenticated`. Permissions are explicit strings, not permissions inferred from `roleKey`, UI state, access JWT, request body, or stale seed mapping. Enforcement must be composable for future module routes but must not prematurely implement Step 46 scope or later role-admin APIs.

**In scope:** pure catalog/permission helpers; `requirePermission` middleware and typed contracts; optional `requireAnyPermission` only if a verified policy needs it; safe error envelope; role DB lookup; deterministic Super Admin deny tests; focused route-wiring/test harness; thin frontend UX alignment only for existing pages; tests, documentation, prerequisite/regression review.

**Out of scope:** adding future ProjectTrace/RoadSync/DocTrace CRUD; user/role management UI (Step 47+); a new permission schema; a novel policy language, wildcard grants, Redis cache, RBAC data migration or mass reseeding; authorizing `/auth/me` by permission instead of authentication; blanket protection of `/api/v1`.

## 3.2 Canonical permission model

| Source | Rule |
|---|---|
| `PERMISSION_CATALOG` / `Permission` | Accepted code set. Unknown, malformed or missing permission required by a route is a programming/configuration error; **never allow**. |
| `Role.permissions` | Actual current database grants for actor's `roleId`. Read through trusted database model on each relevant request unless rigorously proven safe cache invalidation exists (not required in V1). |
| `SYSTEM_ROLE_PERMISSIONS` | Initial default grants and regression oracle. NOT a live fallback for a missing/broken Role row. |
| `req.actor` | Created only after Step 44 proof; `roleId` identifies DB Role; do not accept caller-supplied actor-like objects. |
| Grant evaluation | Exact membership of required catalog permission, **AND** role active, actor aligned with current User role; deny unknown/stale/inactive. |
| Super Admin | Explicit catalog grants, **no** `*`, no automatic platform bypass for `project.approve`, `finance.payment.approve`, `inspection.verify`, `roadsync.conflict.resolve` or other operational duties. |
| Future hierarchy | 'Manage' ≠ all module operations; permission check is necessary but not sufficient for scope, assignment, state or SoD. |

**Recommended API** (names may adapt to repo conventions): `requirePermission(permission: Permission): RequestHandler` and `hasPermission(granted: readonly string[], required: Permission): boolean`; optional typed `requireAnyPermission([...])` for explicit OR paths only, never permissive defaults. Implement under `apps/api/src/modules/identity/authorization/` or equivalent **module source folder inside existing repo** (user bans extra *project/worktree folders*, not logical source folders). Maintain Express request typing as needed: no permission claim accepted from JWT. Favor `requireAuthenticated, requirePermission('project.read')` in route declaration. No stringly typed ad-hoc `'*'` or permission names outside the catalog.

## 3.3 Step 45 response contract

- Actor absent: reject **401** (`AUTH_REQUIRED`) or assert invalid route configuration; do not proceed and never construct actor from raw headers.
- Existing Step 44 401/503 occurs first; do not downgrade an invalid JWT to 403.
- Authenticated actor lacks capability: **403** with `failure('FORBIDDEN', generic message, requestId)`; `Cache-Control: no-store`; log request ID and bounded action/decision, not full tokens/passwords or sensitive resources.
- Current Role missing, inactive, inconsistent with authenticated actor, or DB unavailable: distinguish revoked authorization (401/403 per locked auth convention) vs unavailable dependency (**503**) consistently and test; **never** use seed fallback or assume admin grants.
- Disallowed required permission string/corrupt grants: fail closed and surface safe configuration error; do not leak internal role permission list to unauthenticated callers.
- Optional permission-aware user-facing nav is **advisory UX**, not a substitute for API. Since role/permission administration UI does not exist, avoid adding broad internal navigation.

## 3.4 Implementation details and minimal footprint

1. Read existing role model validation and catalog; avoid duplicate enumerations. Inspect code and tests for `Role` mocks, `requireAuthenticated` and `req.actor` fixtures.
2. Design typed middleware that is secure even when invoked directly or incorrectly ordered; no unguarded `next()` on missing actor.
3. Query role fresh by `actor.roleId`; verify it is active, matches actor's role key if useful, and has required exact permission. Since authentication and permission reads can be separated by a role change, minimize stale-window risk; document it and test any feasible interleaving.
4. Preserve `GET /api/v1/auth/me` as an identity endpoint with **no permission gate**. Keep login, refresh, logout, email, reset, health and ready behavior unchanged.
5. Use a **test-only Express harness** composed of real `requireAuthenticated` + permission middleware to show permitted/denied requests. Do not expose `/api/v1/debug/permissions` or dummy production endpoints.
6. Use isolated temporary MongoDB and nonproduction JWT fixture, never Atlas. No synthetic user creation in `infraos_dev` without owner permission.
7. Keep `api` and `web` tests/typechecks green; minimal internal UX additions only if an already implemented control meaningfully requires them.

## 3.5 Focused Step 45 tests (minimum)

| ID | Case | Expected |
|---|---|---|
| RBAC-01 | Valid actor + current role containing `project.read` | Allowed in test harness |
| RBAC-02 | Valid actor + no `project.read` | 403 `FORBIDDEN` |
| RBAC-03 | Missing/invalid/expired/forged bearer with permission middleware behind auth | 401 `AUTH_REQUIRED` / `SESSION_EXPIRED`, never permission-based 403 |
| RBAC-04 | Missing `req.actor` even when middleware directly invoked | Deny; never `next()` |
| RBAC-05 | Role becomes inactive or is removed | Denied; no stale grants |
| RBAC-06 | Permission removed from Role after initial success | Subsequent request denied |
| RBAC-07 | Permission added to Role by authorized fixture | Subsequent request allowed (if otherwise valid) |
| RBAC-08 | `SUPER_ADMIN` attempts `project.approve`, `finance.payment.approve`, `inspection.verify`, `roadsync.conflict.resolve` | Denied, regardless of privileged role label |
| RBAC-09 | `GOV_ADMIN` has approved operational permission; `CONTRACTOR`/`INSPECTOR` lack finance approve | Exact catalog behavior |
| RBAC-10 | Unknown/malformed or wildcard required code | Fail closed; not accepted as implicit superuser |
| RBAC-11 | Role query rejects/disconnects | 503, no partial privileged data |
| RBAC-12 | Existing `/auth/me`, login/refresh/logout, recovery, health/ready | Remain functional and not accidentally permission-locked |

**Step 45 essential gate:** focused tests + type-check + lint on changed code; obtain a PASS/FAIL summary and validate API scope. Do **not** repeat full phase-wide suite yet unless there is a direct regression concern. Step 46 may begin only after critical Step 45 cases pass.

---

# 4. STEP 46 — Agency, resource, assignment, field and IDOR authorization (critical)

## 4.1 Mission

Implement **reusable server-side resource authorization** that takes an authenticated, permission-qualified actor and applies exact organization/agency/assignment/ownership/visibility constraints for existing INFRAOS models, including secure list filters and one-resource lookups/writes. **No unauthorized agency record, project ID, document metadata, payment amount, citizen PII or restricted map data may be returned.** Step 46 builds on Step 45: `authenticate → grant → scope → resource + business state → service → audit`.

**Important present-day limitation:** existing `User` has `agencyId` and role, but no direct `organizationId`, `projectAssignments[]`, `contractorId`, or multiple roles. `Agency` has `parentAgencyId`. `Project` has `agencyId`, `managerId` (User), `contractorId` (**Contractor model**, not User). `Inspection` has `inspectorId` (User). Therefore **do not invent an implicit User↔Contractor identity mapping or organization scope**. Build queries based on actual relationships only; when identity-to-resource mapping is absent, deny safely and document a deferred model decision. Gov Admin org scoping requires validated parent/child hierarchy; no unbounded cross-ministry access.

## 4.2 Scope vocabulary and scope resolver

| Scope | Actual safe V1 handling |
|---|---|
| `PLATFORM` | Only explicit read/admin operations permitted by Role; no universal mutation bypass; SoD applies. |
| `ORGANIZATION` | Derive a bounded list of active descendant/linked agencies **from trusted stored Agency hierarchy** if relationship is unambiguous. Verify no cycles, parent anomalies, cross-scope confusion, and unknown org; otherwise deny and flag owner/model prerequisite. Never grant all agencies merely because `roleKey=GOV_ADMIN`. |
| `AGENCY` | Exact equality against server-loaded `actor.agencyId`; RoadSync conflict-affecting agency is a separately verified exception, not user-supplied. |
| `ASSIGNED_PROJECT` | For PM, check `Project.managerId = actor.userId` for write; their agency read may be allowed per locked matrix. Contractor project assignment cannot be inferred from `Project.contractorId` without a trusted User↔Contractor linkage. |
| `ASSIGNED_INSPECTION` | Match `Inspection.inspectorId = actor.userId`; linked `Project` only read when justified by assigned inspection. |
| `OWN_RECORD` | Use exact schema owner field, e.g. `Notification.userId`, `CitizenIssue.citizenId`; public anonymous issue tracking is out of scope until its contract is implemented. |
| `PUBLIC` | Explicit `visibility`/public flag and allowlisted DTO; never project raw private record. If public visibility model not implemented, return an intentionally narrow approved public DTO or deny instead of guessing. |

Design a typed `AuthorizationContext` and **pure, testable** functions such as `projectReadFilter(actor)`, `projectWriteFilter(actor)`, `inspectionReadFilter(actor)`, `documentReadFilter(actor)`, `notificationOwnFilter(actor)`, plus `findAuthorizedProjectById(...)` and state/SoD predicates **only where actual model fields support them**. Apply `$and` or a safely composed Mongo predicate with a server-built scope; never merge arbitrary request-supplied Mongo objects or `$or` that can escape tenant filter. Prefer `AND(scopeFilter, validatedSearchFilter)`; treat empty/unknown scope as **match-none**, not `{}`. In TypeScript, distinguish `ScopeDenied` from data absence without leaking which caused a private 404.

## 4.3 Per-resource specifications

### ProjectTrace / Projects and milestones

- `Project.agencyId`, `managerId`, `createdBy`, `status` are available; read/write scopes differ. PM may read own agency project context if matrix permits, but **write only assigned** (`managerId`). AO exact agency; GA verified org scope; SA platform read with explicit `project.read`, not ordinary approval or field editing. Contractor assignments need trusted linkage; deny absent mapping. Inspector read linked to actually assigned inspection.
- `Project._id` and `/:id` requests must validate 24-hex ObjectId; malformed 400; private out-of-scope/missing 404; never `findById` and then trust frontend to hide. `findOne({...scope, _id})` or equivalent.
- `Project.status` and milestone/progress states constrain mutations: DRAFT edits; submitted/review/completed/cancelled changes require exact permitted transition and actor; illegal 409. Creator/submission SoD cannot be fully claimed unless submitter data exists; record missing attribution model blocker instead of fabricating SoD completion.
- List pages use scoped Mongo query with pagination and safe sort; counts/aggregates also scoped. No DB-wide total returned as hidden “metadata”.

### RoadSync (work requests, conflicts, coordination)

- Work request scope flows through `WorkRequest.projectId` and `agencyId`; ensure consistency with parent project. AO may see conflicts where agency is a verified party (trace `Conflict.workRequestA/B` to actual work requests), not any conflict ID from request body. Coordination response must confirm `CoordinationRequest.toAgency` (or permitted fromAgency path) matches server-derived actor agency.
- GA org scopes all involved agencies before viewing restricted conflict details; PM related assigned project. No scope-free query over conflicts and no leakage through counts, map features or search.
- SoD and state transitions: only permitted `roadsync.conflict.resolve`, bounded workflow status and governing business rule; no SA auto-resolve; Q-003 unresolved severity policy must remain a gate and not guessed.

### Inspections, documents and payments

- Inspector work: `Inspection.inspectorId` exact equality for own submitted/verified inspection; joined project context only if appropriate. PM cannot masquerade as inspector.
- `Document.projectId`, `visibility`, `documentType`, `storageKey/storageUrl` sensitivity: require `document.read` + authorized project + classification. Do not allow confidential document access merely because the user has map/project read; no presigned URL/storage key projection. RAG/vector retrieval must reuse the same ACL when such endpoints are implemented later.
- `ProjectPayment.projectId`, `createdBy`, `approvedBy` require `finance.*` + parent project scope + SoD `createdBy != actor.userId` when approving. PAID payment cannot be casually edited. SA cannot pay/approve. Avoid building payment APIs in this step.

### Notifications, issues, audit, map and other lists

- Notification `userId === actor.userId`; no admin impersonation without separately approved, audited flow.
- CitizenIssue `citizenId` for own / `assignedAgency` for agency staff; confidential contact/photos must never leak in list/public output. Anonymous tracking contract not assumed.
- Audit read requires `audit.read` + org/platform scope; append-only remains mandatory, no mutation endpoints. Internal map layers apply both permission `map.view.internal`/`map.layer.restricted` **AND** underlying project/work/asset scope; bbox cannot override.
- Contractors: the `Contractor` entity has no `userId` in current schema; contractor-user ownership cannot be inferred from email or name. **Deny or explicitly mark BLOCKED** for contractor-assigned routes requiring missing linkage.

## 4.4 Secure integration pattern

- Prefer service-layer query-builder helpers used by future real routes; test them on actual Mongoose models with isolated data. Wire into **only actual existing route handlers**, keeping all current public/auth routes on their own contracts. If only `/auth/me` and health/auth endpoints exist, test via non-shipping Express route harness or direct secured service methods; **do not claim that `/projects/:id` is protected live** if it does not exist.
- Keep `req.actor` immutable/trusted; `req.body.userId`, `roleKey`, `agencyId`, `scopeType`, `permissions`, `organizationId`, `projectAssignments` are never accepted as authority. Prevent JSON/Mongo operators and query-smuggling from altering server filters.
- Distinguish authorization decision from safe projection; avoid returning Mongoose full model documents. For private data, `404` for missing **and** out-of-scope. `403` for missing action-level capability. `400` for malformed IDs; `409` for legal actor but illegal state/SoD.
- Where authorization depends on mutable relationship (project manager assignment, agency move), perform scoped read/update with fields in predicate or recheck inside supported transaction. For sensitive writes, log a safe audit event only after a successful authorized operation, with no password/token/document bytes; explicit audit infrastructure must not be silently bypassed.
- No new DB indexes unless measured query path justifies them and owner explicitly approves an additive Atlas migration. Existing indexes on `Project.agencyId`, `managerId`, `Inspection.inspectorId`, `WorkRequest.agencyId`, notifications, etc. may suffice.

## 4.5 Focused Step 46 tests and failure expectations

Construct disposable replica-set fixtures for **Road agency vs Water agency**, optionally a known parent organization, distinct roles/users, two projects (one assigned and one cross-agency), linked inspection, confidential document, payment, work requests/conflict, notification, and citizen issue. No permanent Atlas writes.

| ID | Attack / scenario | Expected |
|---|---|---|
| SCOPE-01 | Anonymous private resource | 401 |
| SCOPE-02 | Valid identity without capability | 403 |
| SCOPE-03 | Agency officer reads/edits own agency vs another | Own allowed by action; foreign **404** |
| SCOPE-04 | PM writes own assigned project vs other same-agency project | Assigned allowed, unassigned **404** even if own-agency read allowed |
| SCOPE-05 | Inspector accesses assigned inspection vs another | Own allowed; other **404** |
| SCOPE-06 | Contractor without persisted link between User and Contractor | **deny safely**, not inferred grant |
| SCOPE-07 | GOV_ADMIN org branch vs sibling unrelated ministry | Verified org only; foreign **404**; unknown hierarchy fail closed |
| SCOPE-08 | SA project read vs SA approve/payment approve/verify/resolve | Approved explicit read; operational actions 403 |
| SCOPE-09 | Restricted document linked to other agency project | 404; no storage key/URL exposed |
| SCOPE-10 | Notification for another user | 404 |
| SCOPE-11 | RoadSync conflict: actual participating agency vs unrelated agency | Party scope only; do not trust user-provided request ID lists |
| SCOPE-12 | Illegal lifecycle transition or submitter==approver | 409/403 per contract; no write |
| SCOPE-13 | Valid 24-hex but nonexistent/private project ID | Same private 404; malformed 400 |
| SCOPE-14 | Body/query `agencyId` or `$or` attempts scope override | No escalation; query remains AND-scoped or request 400 |
| SCOPE-15 | List pagination, count, filter, aggregation | No cross-agency records, counts or totals leak |
| SCOPE-16 | Role permission revoked or agency/assignment changed after previous request | Next request denied; no stale client permission assumption |
| SCOPE-17 | DB exception during scope load | 503, not empty public list or 200 |
| SCOPE-18 | Public safe DTO, private document, map bbox, financial details | Only explicitly authorized fields/layers; no PII/leak |
| SCOPE-19 | Unknown organization linkage / missing schema relationship | Denied or BLOCKED, not fabricated access |
| SCOPE-20 | Existing login, reset, refresh, logout, `auth/me`, landing, locale middleware | No regression |

**Step 46 essential gate:** focused scope tests, type-check and current affected tests PASS; no creation of future feature APIs as shortcuts. Then run the **single full phase-wide test and review**.

---

# 5. Frontend and design-system integration (scope-limited)

**Design constraint:** The Step 43 protected frontend shell exists; Step 45–46 are backend-first. Do not redesign public pages or create unfinished internal module dashboards. Where there is already a reachable internal screen or error state, show permission denial `403`, private resource not-found `404`, and temporary outage `503` with humane accessible copy and a back/retry route. No role-picker impersonation or client override.

Visual system **inside internal authenticated UI only**: Sri Lankan-flag-inspired orange `#FF5B00`, yellow `#FEB600`, maroon `#8C1F28`, green `#279541`; premium neutral surfaces, contrast-safe emphasis (do not use vivid yellow on white for text), consistent borders/shadows/spacing, keyboard focus, meaningful alert semantics, mobile 320/390px through desktop, reduced-motion preference. Reuse existing `apps/web/src/styles/auth-access.css`, auth layout components, typography tokens (`--font-display`, `--font-sans`, Sinhala/Tamil Noto fonts). Do not introduce new font loading or migrate CSS framework just for RBAC.

English/Sinhala/Tamil: existing locale pathways preserved; use existing translation pattern for any **new** error message; mark SI/TA translations unverified draft where not native-reviewed. Never claim reviewed translation without evidence. Respect `noindex` for internal access/error pages and do not leak object IDs/private project titles into a denial.

**Permission-aware UI caveat:** `GET /auth/me` currently returns a safe `user` DTO, **not permission grants**. Do not casually add `permissions[]` to access JWT or public user DTO. UI may hide actions based on server-provided minimal, authenticated capability hints if actually required by an existing internal screen; server still independently verifies action/scope. No broad role-centric UI work now.

---

# 6. Testing, evidence, review and operator demonstration

## 6.1 Execution order optimized for speed

| Gate | Work | Required evidence | Owner action |
|---|---|---|---|
| P0 | Snapshot current repo and 43–44 prerequisites; inspect approved Git state | SHA, diff, dependency table, branch plan | Resolve blocker if severe; no speculative setup |
| P1 | **Step 45 complete execution** in one Cursor run | Middleware, test harness, focused RBAC tests/type-check; status | Satisfactory before 46; formal phase review later |
| P2 | **Step 46 complete execution** in one Cursor run | Scope helpers, authentic model fixture tests, focused checks | Satisfactory before final phase review |
| P3 | **One combined** Steps 45–46 testing/security review and bugfix pass | Full API/web/lint/build/browser if feasible, independent review checklist, attack matrix, demo, verdict | Owner decides acceptance |
| P4 | Git commit → push/PR → development merge → main release | Exact staged diff, permission checks, CI and reviewed SHAs, approvals for each action | **Explicit separate authorization for each** |

**Full suite commands** (from repo root, after confirming package scripts):

```powershell
npm run test:api
npm run test:web
npm run type-check
npm run lint
npm run build
```

Run focused Vitest tests with existing repo/package-supported invocation; do not invent a CLI flag that changes filtering silently. If a test fails, fix root cause and rerun. Test suite counts are evidence, not success criteria hardcoded to old counts.

## 6.2 Final combined review checklist

- [ ] Git diff has only authorization-related files and justified test/docs changes; existing clean baseline and branch verified; no `.env`, secret or personal test data committed.
- [ ] Step 44 identity still verifies `ce`, account status, active role/agency and rejects malformed JWT; 401 vs 503 unchanged.
- [ ] Step 45 DB permission evaluation exact-match, active role, no wildcard/role-name shortcuts, no SA operational bypass.
- [ ] Step 45 test-only route composition proves 200/401/403/503 and role permission mutation handling.
- [ ] Step 46 agency/organization/assignment/own/public decisions correctly distinguish 403 vs private 404 and enforce state/SoD.
- [ ] Step 46 queries constrain data **inside MongoDB**, including count/aggregation and write predicates; no fetch-all-then-filter.
- [ ] Missing linkages and invalid parent hierarchies fail closed; resource DTOs redact restricted fields.
- [ ] Cross-agency/cross-user/role escalation, malicious filters, invalid ObjectIds, stale role changes and concurrent cases tested.
- [ ] `GET /auth/me`, refresh/logout/password reset, health/ready and locale/public UI still work as before.
- [ ] No invented production routes or system-wide auth middleware; note tests executed through harness versus real production routes.
- [ ] All full API and web tests/type-check/lint/build PASS, or identify exact blocked check; no silently skipped/focused-only claim.
- [ ] Browser: existing public pages intact; existing `/dashboard` handles 401 login redirect, 403 (if wired), 503 retry; responsive/keyboard/ARIA; live integrated tests run only against an authorized isolated server. Never pretend fixtures are Atlas/live proof.
- [ ] Atlas schema/index writes not attempted; note any Step 40–42 migration still pending and avoid starting dev API configured to autoIndex against Atlas.
- [ ] Independent security review conducted by a distinct reviewer **if available**; otherwise label same-agent review correctly and request owner/security signoff.
- [ ] Threat model, bounded residuals, acceptance matrix and Step 47 handoff available without bloated repetitive documentation.

## 6.3 Manual owner demo on isolated database

1. Run authorized isolated MongoDB replica-set environment / test harness; confirm DB name ends `_test`. Never expose access JWT in terminal output or screenshots.
2. Sign in with **synthetic** Agency Officer A, Agency Officer B, Gov Admin (one org), PM, Inspector, Contractor, Super Admin; verify 401 for signed-out and expired/stale `ce` for reset-revoked tokens.
3. Through isolated supertest harness, show `requireAuthenticated` → `requirePermission('project.read')` allows eligible permitted actor and denies a Contractor `finance.payment.approve` with 403. Revoke `project.read` in fixture Role and retry; immediately 403. No production-only endpoint required.
4. Create Project Road/Water, assign PM only to Road, create two inspections and notifications, and run **scoped Mongo service queries**: Road officer sees Road, not Water; PM can update assigned Road but not unassigned; Inspector sees only assigned; user sees only own notification. Cross-agency well-formed IDs produce private 404, malformed ID 400, not role-based 403.
5. Test restricted documents (no file bytes) and RoadSync party agencies; confirm confidentiality and tenant filters; note any missing contractor/organization mapping as blocked explicitly.
6. In existing web UI, `/dashboard` signed-out hides workspace; API down returns retry, not authorization success; public pages unchanged. If live auth and indexes are blocked, use explicitly labeled UI/API fixtures and report `NOT RUN` for end-to-end real API.
7. Hand owner source paths, test command receipts, actual status/codes and screenshots with secrets redacted, not a claim of deployed functionality.

## 6.4 Reports (minimal, not bureaucratic)

Prefer **one concise phase report** at `docs/reviews/steps-45-46/END-OF-PHASE-VERIFICATION.md`, plus a short `SECURITY-REVIEW.md` only if security findings justify it. Clearly separate Step 45 and Step 46 acceptance sections within the same report. Avoid a document folder per microtask or repeated duplicate checklists. Repo-local `docs/reviews/` is part of the existing InfraOS project and is **not** a new sibling project folder; never touch desktop `Documents`.

Suggested report fields: HEAD/base/branch, tracked/untracked inventory, implemented files, scope map actual-vs-planned, test commands and exact output, 401/403/404/409/503 matrix, browser fixture/live distinction, migration controls, vulnerability findings, unresolved mapping decisions, owner acceptance verdict, Git integration instructions.

---

# 7. Git integration contract (commands for later approval only)

**No repository mutation authorized by these prompts.** The following is a *conditional runbook* for Cursor after the owner explicitly authorizes each separate action. Never silently run it during prompt generation or implementation.

```powershell
Set-Location 'C:\Users\ASUS\Desktop\InfraOS\InfraOS'
git status --short --branch
git remote -v
git fetch origin                       # only after approval if owner's policy applies to fetch
git switch development                 # only if clean/approved and not discarding local work
git pull --ff-only origin development  # never merge/rebase an unreviewed local state
git switch -c feature/auth-authorization-foundation
```

If a branch already exists, inspect and reuse only if safe. If `development` local is stale and worktree is dirty, stop and present a preservation plan; never `reset --hard`, `clean -fdx`, or force-checkout. Branch creation/checkouts are permitted **only after the user approves that workflow**, and should occur inside existing repo. No automatic commits or pushes.

**Proposed integration sequence after final acceptance, each separately authorized:**

1. **Owner approves staged file list and commit(s)**: `git diff --check`, verify no secret/unintended public landing edits, then stage exact file paths and commit Step 45 and Step 46 changes in reviewable chunks on *one branch*. Owner may authorize a single phase commit if requested; avoid artificial step-by-step Git churn.
2. **Owner separately approves push** of feature branch, then PR from `feature/auth-authorization-foundation` to `development`; inspect CI and reviewer feedback.
3. **Owner separately approves merge** into `development`; verify merge commit and test results on resulting branch. Never self-approve a security-sensitive PR as independent review.
4. **Owner separately approves stable release** from `development` into `main`, then verify new main SHA and smoke results. No automatic branch cleanup/deletion or remote force pushes.

**Rollback:** revert via approved Git revert or disable newly wired authorization path only under security owner instructions; never fail-open to preserve demo. Database has no expected schema/index migrations for Steps 45–46. Any unexpected migration needs separate written approval.

---

# 8. Acceptance criteria and step-by-step outcomes

## Step 45 acceptance

- [ ] Middleware reads **current persisted Role.permissions**, typed by locked catalog, and cannot trust a JWT/body/role name as grants.
- [ ] All deny-by-default and 401/403/503 cases pass; role edits/revocations take effect on next authorization decision.
- [ ] Super Admin cannot operationally approve/pay/verify/resolve without explicit catalog grant; no wildcard bypass or hidden privilege path.
- [ ] Existing Step 44 auth, 41–42 reset, 40 logout and public/auth endpoints pass relevant focused checks.
- [ ] Actual route wiring and test harness are clearly differentiated; no false claim of permission enforcement on nonexistent business endpoints.
- [ ] Owner confirms Step 45 essential check gate before proceeding to Step 46.

## Step 46 acceptance

- [ ] Server-built filters constrain agency/org, PM/inspector assignment, own records and public safe projections, respecting current model reality.
- [ ] Cross-agency and cross-user IDOR is blocked for reads, updates, lists, counts, aggregations, linked documents, map scope and status transitions in tested helpers.
- [ ] Explicit capability deny 403, private scope/missing 404, invalid ID 400, state/SoD conflict 409, infra unavailable 503, unauthenticated 401.
- [ ] Unknown organization/contractor mapping fails closed and is logged as residual blocker for later approved data model work.
- [ ] No unsafe migration, dummy production route, public landing edit, new unauthorized module or secret exposure.
- [ ] Single phase-wide test/review has genuine evidence and owner can reproduce an isolated, nonproduction demonstration.

## Phase decision

**APPROVE** only when security-critical Step 45 and 46 acceptance items PASS, with documented scope gaps for routes not yet implemented and accepted non-release residuals. **REVISE** for fixable incomplete code/tests; **BLOCKED** for unresolved authorization bypass, implicit grants, missing required relationships or unapproved data operations. Step 47 is a handoff only, not implemented here.

**End of Development Prompt — Steps 45–46.**
