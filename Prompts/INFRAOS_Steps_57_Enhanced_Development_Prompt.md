# INFRAOS — Step 57 Enhanced Development Prompt

**Project:** INFRAOS — National Infrastructure Intelligence & Coordination Platform  
**Vision:** *The Operating System for National Infrastructure*  
**Roadmap:** 190-step development plan · **Step 57 — Project Approval Workflow**  
**Repository:** https://github.com/divejikan-yuvarajah/InfraOS  
**Artifact type:** Implementation-ready development specification; **not an implementation or a test report**  
**Prepared:** 27 October 2026 (Asia/Colombo)  
**Companion:** `INFRAOS_Steps_57_Cursor_Agent_Execution_Prompts.md`

> **Non-negotiable outcome:** A premium, responsive, accessible **and actually functioning** government project-review experience: authorized reviewers can find scoped submitted projects, begin a review, inspect decision-relevant verified data, make permitted decisions with transaction-safe audit evidence, and see fresh server-confirmed results. No inert buttons, simulated approvals, preview-only success, or claims unsupported by real-browser evidence.

---

## 0. Source-of-truth hierarchy and verification

### 0.1 GitHub read-only verification snapshot

The linked GitHub source was read through the connected GitHub integration, not inferred from a prior chat. As of this verification:

| Source | Verified finding | Interpretation |
|---|---|---|
| `development` HEAD | `f9d7feea50200cfd3051529d9720caa3d4122874` — merge PR #96 from `main` | Integration branch already includes the previously merged implementation. |
| `main` HEAD | `359c0f8c77b194dc2b294a7665b1ab39fe5e76d3` — merge PR #95 from `development` | Steps 55–56 were promoted to stable `main`; do **not** characterize them as only uncommitted remote code. |
| Merge chain | PR #94 merged `feature/projecttrace-edit-lifecycle` → `development`; PR #95 integrated to `main`; PR #96 synced `main` → `development` | Historic review documents still describe an older dirty local checkout. Those are historic records, not current remote branch descriptions. |
| `Prompts/Steps.docx` | Original roadmap document exists on `development`. Its Step 57 title is corroborated by repo handoff: **Project Approval Workflow** | The roadmap title is exact. No additional Step 57 micro-bullets are proven from the DOCX extraction here; functional detail below comes from locked requirements and verified code, not invented roadmap text. |
| `docs/planning/requirements.md` | `FR-PROJECT-006`: Gov Admin / authorized reviewer reviews, approves or rejects projects from `SUBMITTED` / `UNDER_REVIEW`; approval is audited and rejection returns a reason | This is the **binding functional requirement** for Step 57. |
| `docs/planning/requirements.md` §3.1 | `SUBMITTED → UNDER_REVIEW, REJECTED`; `UNDER_REVIEW → APPROVED, REJECTED, DRAFT`; `REJECTED → DRAFT`; no direct `SUBMITTED → APPROVED` | Respect exact graph; separate opening review from approving. |
| `docs/security/permission-matrix.md` | Gov Admin has organization-scoped approval/rejection. Super Admin, Agency Officer, PM, Contractor, Inspector and Citizen are not approval actors. Submitter may not approve own project. | Distinct **review scope** from edit scope. Client hints are never authorization. |
| `docs/security/permission-catalog.md`; `packages/shared-types/src/permissions.ts` | Existing `project.approve` permission covers approve / reject at review. No new permission is necessary by default. | Reuse live role permission, do not invent `project.reject` or assign approval to Super Admin. |
| `apps/api/src/modules/projects/project.constants.ts` | Current enum excludes `REJECTED`: `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `ACTIVE`, `ON_HOLD`, `DELAYED`, `COMPLETED`, `CANCELLED`. | **Locked-policy mismatch**; resolve explicitly before enabling rejection. |
| `apps/api/src/modules/projects/models/project.model.ts` | Project stores status, owner `agencyId`, `managerId`, `createdBy`, optimistic `__v`; no `submittedBy`. | Use trusted audit event for submitter, not `createdBy` and never a client field. |
| `apps/api/src/modules/audit/models/audit-log.model.ts` | Append-only `AuditLog`; project status snapshots support `status`, `agencyId`, etc., **not reason**; existing `{resourceType,resourceId,timestamp}` index | Review reason persistence requires an **explicit minimal schema/policy decision**. Do not claim persistence for a merely validated reason. |
| `apps/api/src/modules/projects/projects.routes.ts` | `GET /api/v1/projects`, `GET /:id`, `POST /`, `PATCH /:id`, `POST /:id/transition` exist. | Add a narrow review endpoint or explicitly approved review action within existing routing conventions; do not replace working endpoints. |
| `apps/api/src/modules/projects/lifecycle.policy.ts` | Step 56 implements `SUBMIT`, `HOLD`, `RESUME`; START/MARK_DELAYED deny 403; COMPLETE/CANCEL fail closed 409. | Step 57 cannot silently unblock unrelated lifecycle actions. |
| `docs/reviews/steps-55-56/END-OF-PHASE-VERIFICATION.md` | Full historical suite: **300 API**, **166 web**, type-check/lint/build green on 26 Oct; browser continuation 27 Oct showed working edit/submit/hold/resume, role and concurrency checks, but focus-ring 2.9:1 visual issue. | Historic, same-agent evidence; not a fresh Step 57 baseline run and not independent acceptance. |
| `apps/web/src/app/projects/[id]/overview`, `apps/web/src/components/projects/`, `apps/web/src/lib/projects/` | Protected project overview, list, draft edit, shared API hooks/cache keys and EN/SI/TA draft strings exist. | Enhance these screens consistently, do not wholesale rebuild. |

**Before writing code** in Cursor: inspect `git status --short --branch`, `git branch -vv`, `git log -5 --oneline`, `git diff --check`, `git diff --stat`, active env **names** (not secret values), and local versions of the files above. Remote source cannot establish whether the user's PC has uncommitted edits, different ports, an approved new policy, or new test results. If local code differs, document it, protect it, and use local verified contracts.

### 0.2 Primary reference inventory

Read only relevant portions; do not waste time rereading the entire repository:

- Roadmap: `Prompts/Steps.docx` → Step 57; next **Step 58 — Milestone Management**.
- Requirement & locked policy: `docs/planning/requirements.md` (`FR-PROJECT-005`, `FR-PROJECT-006`, state table), `docs/planning/business-rules.md` (`BR-PRJ-002`–`010`, `BR-AUTH`, `BR-SCOPE`), `docs/security/permission-matrix.md`, `docs/security/permission-catalog.md`.
- UX: `docs/ux/project-detail-architecture.md`, `docs/design/brand-color-system.md`, `docs/design/design-tokens.md`, `docs/design/component-library.md`, `apps/web/src/styles/tokens.css`, `apps/web/src/styles/auth-access.css`.
- API/model: `apps/api/src/modules/projects/{projects.routes.ts,projects.schema.ts,projects.service.ts,projects.types.ts,lifecycle.policy.ts,project.constants.ts}`, project model, audit model, `resource-scope.ts`, existing auth/session and role modules.
- Web: existing `/projects` and `/projects/[id]/overview`, `project-overview-client.tsx`, `apps/web/src/lib/projects/{api.ts,types.ts,overview-format.ts,messages.ts}` and shared staff shell and TanStack Query config.
- Handoff: `docs/reviews/steps-55-56/END-OF-PHASE-VERIFICATION.md`, step 55/56 implementation reports; inspect any *newer* local update before relying on their historical verdicts.
- Environment: `docs/setup/environment.md`, `apps/{api,web}/.env.example`, `package.json`.

---

## 1. Goals, scope, and explicit non-goals

**User story:** A government reviewer with an active, verified account, a live `project.approve` grant and an agency hierarchy containing a project can open their review queue, begin review of a submitted project, inspect the submitted proposal, and approve/reject/return it only according to authorized transitions. A submitting Agency Officer or PM sees the new state and permitted corrective next step but cannot approve their own project. Every decision is atomic, auditable, and protected against stale revisions.

**Step 57 functional objectives** (grounded in `FR-PROJECT-006`, state graph and permission matrix):

1. Scope **review queue** by organization on the Mongo query itself; support meaningful search, status/filter, sorting, pagination, and accurate empty/total counts, while reusing the Step 53 list infrastructure when practical.
2. Provide review detail, supporting project data, reviewer actions, relevant previous decision/audit summary and a professional status timeline **only to the extent backed by real stored data**.
3. Authorized `SUBMITTED → UNDER_REVIEW` (claim/open/start-review); `UNDER_REVIEW → APPROVED`; policy-approved rejection paths `SUBMITTED/UNDER_REVIEW → REJECTED`; policy-approved return-for-correction `UNDER_REVIEW → DRAFT`. `REJECTED → DRAFT` needs deliberate correction/resubmission policy and cannot be an arbitrary click.
4. Require a bounded, persisted, access-controlled reason for rejection and return-for-changes; approval note optional only if persistence is supported by agreed policy; never display a placeholder reason as a stored event.
5. Prove **submitter != approver**, using immutable server-generated submit audit evidence; deny approval if submitter attribution is absent/ambiguous, or agency hierarchy/permission snapshot cannot be established.
6. Support authentic end-to-end reviewer-to-submitter experience in a real browser, with real isolated API/DB writes, fresh reads and screenshots.
7. Maintain the user's mandatory **modern premium functional UI** standard on every implemented screen: polished and helpful rather than ornamental mockups.

**Not Step 57:** Step 58 milestones; Step 59 physical tracking; Step 60 financial progress; Step 61 timeline feature; Step 62 dependencies; Step 63 complete activity history; RoadSync resolution; inspection verification; project START/delay permission redesign; COMPLETE/CANCEL enablement; AI decision making; public Connected Future landing; deployment/email delivery; production Atlas indexes; new map integration; finance data creation. A **compact review decision timeline** sourced from existing audit rows may be shown as part of approval evidence, but do not implement the full future Project Activity History module.

### 1.1 Decision gates — required before representing all approval paths as implemented

| Gate | Verified conflict | Recommended narrow path | Cursor instruction |
|---|---|---|---|
| **G1 — `REJECTED` status** | Locked requirements include `REJECTED`; current code enum omits it and Step 56 handoff forbids silent addition. | Prefer a documented explicit V1 policy amendment to align project enum/client status dictionaries/model/Zod with requirements; extend **only** the ProjectTrace enum, not unrelated work-request enums. | **Request explicit owner's approval for this locked contract change before making it.** Can implement `BEGIN_REVIEW` and `APPROVE` first. If unresolved, reject remains **BLOCKED** and the complete Step 57 acceptance is **BLOCKED**, not faked. |
| **G2 — reviewer reason storage** | `AuditLog` snapshots strict and cannot store a reason; validation-only is inadequate for FR-PROJECT-006. | Prefer minimal, reviewed, bounded decision-reason field in the existing **append-only audit snapshot**, with restricted project-scoped reader DTO; no arbitrary JSON/body storage or new collection by default. | **Obtain explicit approval for the additive audit schema policy change** before implementing persistence. Do not write to Atlas or create indexes without separate authorization. If unapproved, reject/return are blocked. |
| **G3 — reviewer authority** | `project.approve` exists but approval-scoped service is not implemented. | Only live GOV_ADMIN + permission + organization/ministry scope + current agency/user/role verification. | No `project.update` substitute, no Super Admin shortcut, no frontend-only privilege. |
| **G4 — submitter identity and integrity** | No trusted `Project.submittedBy`; Step 56 writes `AuditLog(action='project.submitted',userId,old/new status)`. | Resolve and validate the authoritative successful submit event **inside transaction**. | If no unambiguous trusted event, refuse to approve; do not fall back to `createdBy` or accept body `submittedBy`. |
| **G5 — background blockers** | Focus-ring under 3:1 in 27 Oct browser review; Step 51 races, Atlas indexes, native translations and other issues open. | Fix only if verified / necessary for new UI; follow separately tracked work for systemic issues. | Do not silently mark external blockers cleared or reconfigure production access. |

**No owner policy approval can be fabricated by this prompt.** Preparation, safe implementation of uncontroversial actions and honest blocked paths are preferable to unauthorized policy/schema changes. Document approved decision date and scope in the actual project; do not invent approval.

---

## 2. Target end-to-end workflows

### 2.1 Government reviewer journey

1. Sign in through existing local live identity flow. Only a role with live `project.read` + `project.approve` and actual organization scope can open **Projects → Review queue**.
2. Review queue shows accurate, paginated, scoped **SUBMITTED** and **UNDER_REVIEW** projects; server sorts, filters, searches and counts; not all-agency array filtering in React. A **Review** action opens a protected detail view.
3. Review detail shows project code/title, agency, manager if authorized, status, submission readiness fields (dates, location, GeoJSON summary), safely permitted budget, submitter display **only if authorized and verified**, actual submission timestamp if derived from trusted audit, and review history when available. Show "Not provided" for absent fields, not invented values.
4. **Begin review** requires confirmation if appropriate; server moves `SUBMITTED → UNDER_REVIEW` with CAS revision and audit, returns canonical server DTO. UI refreshes status and available actions.
5. On `UNDER_REVIEW`, reviewer sees **Approve**, **Reject**, and **Return for corrections** only when policy-approved and backend says actionable. A decision confirmation states irreversible effects. Rejection/return requires a real reason; a typed reason never appears as "saved" until persisted successfully.
6. On success, show status badge, reviewer decision evidence and back-to-queue navigation; invalidate or update account-scoped list/detail queries only after current auth epoch/token validation. Queue row disappears or changes based on active filter.
7. When a second reviewer won, respond with 409, preserve entered reason and show "This project changed. Refresh details before deciding again." Never optimistically claim approval.

### 2.2 Submitter journey

Agency Officer or assigned PM submits a valid draft using existing Step 56 controls, then sees a **SUBMITTED** waiting state (not an approve button). After reviewer decides, fresh project detail reflects `UNDER_REVIEW`, `APPROVED`, `REJECTED`, or returned `DRAFT` as appropriate. If returned to DRAFT, existing edit workflow becomes available again only under existing scope + `project.update`; if rejected status requires a reset-to-draft policy, provide only its permitted server-backed path. Rejection reason must be readable only by an appropriately scoped participant from an approved DTO; reviewers must not expose other ministries' decisions.

### 2.3 Branching decision table

| Current status | Reviewer action | Target | Role / grant | Additional gate |
|---|---|---|---|---|
| `SUBMITTED` | `BEGIN_REVIEW` | `UNDER_REVIEW` | GOV_ADMIN + live `project.approve` + org scope | Valid latest revision, trusted submission audit, current agency/role. |
| `UNDER_REVIEW` | `APPROVE` | `APPROVED` | Same | **approver != trusted submitter**; other agreed approval conditions. |
| `SUBMITTED` or `UNDER_REVIEW` | `REJECT` | `REJECTED` | Same | **G1 and G2 owner decisions**, mandatory persisted reason, trusted audit. |
| `UNDER_REVIEW` | `RETURN_FOR_CHANGES` | `DRAFT` | Same | Mandatory persisted reason, agreed policy, safe edit reactivation. |
| `REJECTED` | `REOPEN_FOR_CORRECTION` | `DRAFT` | Explicitly authorized actor only | Only after documented G1 return policy; don't invent resubmission authority. |
| `DRAFT`, `APPROVED`, `ACTIVE`, `ON_HOLD`, `DELAYED`, `COMPLETED`, `CANCELLED` | Review/approve/reject | None | Any | 409; do not mutate or audit as success. |

**Important:** the requirements graph does *not* permit direct `SUBMITTED → APPROVED`. Do not shortcut with "Approve" immediately after submit. Do not implement implicit approval upon viewing. Do not allow terminal-state reversals.

---

## 3. Backend design and contracts

### 3.1 Boundary and naming recommendation

Use existing Express modular router under `/api/v1/projects`, established `requireAuthenticated`, error envelope, request ID and `Cache-Control: no-store`; do not create a parallel API framework. A **proposed** safe minimal contract:

```http
GET /api/v1/projects/review-queue?page=1&limit=10&status=SUBMITTED&q=...&sortBy=updatedAt&sortDir=desc
GET /api/v1/projects/:id/review
POST /api/v1/projects/:id/review
Content-Type: application/json
Authorization: Bearer <existing short-lived token>

{"action":"BEGIN_REVIEW","revision":2}
{"action":"APPROVE","revision":3}
{"action":"REJECT","revision":3,"reason":"Specific bounded explanation"}
{"action":"RETURN_FOR_CHANGES","revision":3,"reason":"Specific bounded corrections requested"}
```

This is a **recommended implementation contract**, not a claim of existing API endpoints. The agent may choose smaller additions such as reusing `GET /:id` and filtered `GET /` if all required evidence and secure decision hints are available, but must describe its final chosen contract and avoid putting `/review-queue` after a greedy `/:id` route. Do not widen existing Step 56 general `transition` schema with review actions unless reviewer-only authorization is separated and tested in the same transaction.

Recommended read output (field names align with established envelope and DTO conventions after inspecting exact web types):

```json
{
  "data": {
    "project": {"id":"...","projectCode":"...","status":"UNDER_REVIEW","revision":3},
    "review": {
      "submittedAt": "2026-10-27T08:00:00.000Z",
      "reviewStatus": "UNDER_REVIEW",
      "availableActions": ["APPROVE", "RETURN_FOR_CHANGES"],
      "latestDecision": null
    }
  }
}
```

**Illustrative JSON only.** The example date/id/action set is not verified real data. The precise DTO must be role- and scope-filtered, current, and backed by database evidence. Do **not** use a client-supplied `availableActions` list to authorize writes.

### 3.2 Strict validation

- Use Zod `.strict()` with action allowlist; integer `revision` between project contract limits; bounded reason (recommend 1–500 trimmed characters, reject `$`/control characters and unsafe key names; tune to existing safeText conventions). No role, agency, approverId, submitterId, status, budget, permission array, or Mongo operators in the body.
- Non-JSON `415`; invalid/malformed ObjectId or body `400`; missing session `401`; role or grant denial `403`; out-of-scope/unknown resource `404` with generic body; stale revision/illegal transition/SoD failure `409` (or `403` for disallowed actor; choose documented privacy-safe mapping), dependency unavailable `503`, no mutation.
- Enforce allowed per-action fields: no reason on `BEGIN_REVIEW` unless explicitly specified; optional approval note only if actually persisted; no ignored client values. Explicit rejection reason validation and visible user feedback.
- Keep role denial and hidden project data out of logs, exceptions, React caches, telemetry and response text. No full JWT/password/secret in screenshots.

### 3.3 Authorization and organization scope

1. Use server-authenticated actor, live active user + credential epoch + role/grants + active hierarchy checks, not JWT snapshot alone. Reject missing active verified actor.
2. For approval, **do not reuse `projectWriteFilter` blindly**: Step 56's filter allows AO/assigned PM draft edits. Define **Gov Admin approval-scoped filter** with `resolveResourceScope` and `projectReadFilter(scope)` plus explicit `roleKey === 'GOV_ADMIN'` and `project.approve` check. Review list and count must share the same scoped predicate.
3. A Gov Admin only reviews projects in their ministry hierarchy. For out-of-scope resource return generic 404; do not expose project title, code, existence, foreign agency, reason or audit user.
4. Revalidate actor/agency hierarchy and approval grants *inside the transaction* before writing, under the established hierarchy lock. Where known Step 51 hierarchy/grant snapshot races still exist, test them, fail closed when needed, and record the residual risk. Do not claim they are fixed without evidence.
5. Enforce separation of duties for **approval**: read `AuditLog` matching `resourceType='PROJECT'`, project `_id`, `action='project.submitted'`, successful `oldValue.status='DRAFT'`, `newValue.status='SUBMITTED'` and the current submission cycle. Read with restricted projections; use server-generated `AuditLog.userId`, never `createdBy` or `req.body.submittedBy`. Detect missing, conflicting, or superseded submissions (including reopened/rejected/resubmitted) and block until attribution is unambiguous.
6. Super Admin is strictly platform IAM, never operational reviewer. AO/PM may view their own project state but never reviewer-only private decision tools. Contractor/Inspector/Citizen denied per policy.

### 3.4 Transaction, audit and concurrency safety

- Follow `projects.service.ts` patterns: `mongoose.startSession()`, `withTransaction`, hierarchy lock, current role/grant check, scoped query, compare-and-set (`_id`, exact status, `__v`), `$inc: {__v:1}`, audit insert in the **same session**. Abort all on audit failure. Do not leak success before transaction commits.
- Make review action retry-safe: two concurrent approvals/claims on same revision yield one winner and one 409, not duplicate accepted decisions. Avoid duplicate audit writes on client retries; use documented request ID handling or idempotency design only if necessary, without widening scope.
- If requester session changes between click and API response, **do not** update a new user's private React cache; keep auth-epoch/user/role keys consistent with Steps 53–56.
- Only store the **minimum** old/new state, actor, correlation ID and policy-approved reason. Do not include documents, tokens, budget details, full request bodies or raw account identity in audit snapshots.
- Audit records append-only. A decision reason must survive reload / new session after success; if existing AuditLog schema cannot safely carry that text, **stop that path at G2** rather than claim durability.
- No notification/email claims unless the notification module already has a safe, demonstrably integrated workflow; it is not required for this step and invitation email remains an unrelated blocker.

### 3.5 Database compatibility

Current `Project` schema uses `PROJECT_STATUSES` and `__v`; `AuditLog` has strict snapshots and existing indexes. Prefer changes that reuse these structures. **Do not create collections, run `syncIndexes`, run `createIndexes`, or add/change Atlas schema/indexes without a separate owner-authorized change plan.** Document any additive local code-schema change, affected DTOs, data migration implications, backward compatibility with existing documents and rollback. If G1 approved, `REJECTED` change must update **both** server enum and client status validation/rendering safely; ensure old statuses still parse, filter and display. If G2 approved, reason must be safely bounded and returned only via project-scoped read, never the raw audit DTO.

### 3.6 Integration and regression invariants

- Step 53 server search/pagination/sort, agency count narrowing and no budget in list are unchanged; review queue can reuse them with **additional status + Gov Admin grant** checks, never broaden them.
- Step 54 overview cache is keyed by auth epoch/user/role/project; do not destroy list query return URL safety, UTC dates or budget permission checks.
- Step 55 draft edit remains `DRAFT` only and uses `revision`; reviewer `RETURN_FOR_CHANGES` may make it editable again only after a true server status change, not via role-bypass flag.
- Step 56 SUBMIT/HOLD/RESUME remain working, START/MARK_DELAYED remain 403 and COMPLETE/CANCEL remain 409. No approval path may auto-start or auto-complete the project.
- Public Connected Future landing `/`, `/si`, `/ta` must remain byte-for-byte unaffected for intended feature source modifications.

---

## 4. Frontend implementation — premium and fully interactive

### 4.1 User experience blueprint

**Recommended page structure** (reuse existing `StaffWorkspaceShell`, project detail patterns, API hooks and navigation; route names are design proposals, not claims):

```text
Staff workspace / Projects
  ├── Projects list (existing)
  ├── Review queue — /projects/reviews  [NEW only if existing nav lacks an equivalent]
  │     ├── Queue header + precise status summaries
  │     ├── search / filter / sort / page controls
  │     ├── responsive project rows / cards with real status and agency
  │     └── secure Review link
  ├── Project review — /projects/[id]/review  [NEW; reviewer-only]
  │     ├── compact project header: code/title/agency/status
  │     ├── verified submission readiness facts
  │     ├── review timeline (existing backed audit only)
  │     ├── Begin review / Approve / Reject / Return for corrections
  │     └── confirmation dialog, server errors, success and return links
  └── /projects/[id]/overview  [EXISTING]
        └── status, edit/submit hints, reviewer shortcut only when authorized
```

Treat unapproved REJECT, RETURN, REOPEN actions as **disabled with factual explanation** or absent, not decorative click targets. Do not add dead tabs for Timeline, Milestones, Documents, Finance, Inspections or Risks.

### 4.2 Premium professional visual system

- Respect `apps/web/src/styles/tokens.css`, existing CSS/Tailwind v4 and approved identity palette: **orange `#FF5B00`, yellow `#FEB600`, maroon `#8C1F28`, green `#279541`** with neutral canvas/light surfaces. Use semantic tokens for badges and actions. Don't transform national palette into saturated backgrounds, generic SaaS purple/blue, or gradients over data tables.
- Design for a high-end digital government control workspace: balanced sidebar/toolbar, strong editorial headings, understated agency/context chips, readable high-density tables, well-spaced cards, coherent empty and loading states, trust-building audit summary, human-readable dates, properly localized number/currency where applicable. Use meaningful Lucide icons where existing packages support them.
- **Every visible interaction functional:** search sends actual server query; filters affect actual records; sorting and pagination use server ordering/count; buttons hit guarded API actions; refreshed statuses are canonical; download/export controls absent unless implemented; reviewer notes actually persist if UI claims they persist.
- Use finite, meaningful motion: hover/pressed/selection feedback, subtle loading skeletons, short transitions. `prefers-reduced-motion` must visibly remove nonessential animation. No arbitrary third-party icon packs/animations without verified need.
- Modern reviewer decision dialog: explicit target status, project code, legal consequences copy, reason field + count and errors, retry, cancel, busy state; destructive rejection visually differentiated without relying only on color.
- Provide precise loading, empty, 401 signed-out, 403 forbidden, 404 no-leak, 409 stale/SoD, 503 unavailable, and offline/retry states. Preserve typed reason on conflict. Use server truth, not synthetic examples, in production feature views.

### 4.3 Accessibility and multilingual support

- Responsive at **320, 360, 390, 768, 1024 and 1440 CSS px** and **200% zoom**; no clipped buttons/decision dialogs or horizontal scrolling across the whole page. Tables should scroll inside an announced region or become accessible cards at narrow widths.
- Keyboard Tab/Shift+Tab, Enter, Space, modal focus trap/return, skip link, clear focus indicators, screen-reader labels, `aria-invalid` and `aria-describedby`, live alert for errors, table headers with `aria-sort`, and accessible loading/status announcements.
- **Known prior defect:** Step 55–56 report measured `--focus-ring` orange `#FF5B00` at **2.9:1** against `#F4F7FB` (feature verdict REVISE). Before accepting Step 57, inspect actual current local theme; fix/verify appropriately if still present. Existing accessible dark orange `#B63D00` is a candidate, not an asserted fix. Measure against canvas, white, colored/dark controls; maintain forced-colors and min 3:1 non-text contrast for relevant indicator boundaries. Text contrast target 4.5:1 for normal text, 3:1 for large text where applicable.
- Keep EN/SI/TA draft dictionary pattern; provide complete coverage for *new visible* reviewer copy, avoid literal English-only controls mixed into locale selection, and label translations as **draft / native review pending** until native verification. Do not claim Sinhala/Tamil accepted. Full alternate `/si/projects` route architecture is out of scope unless already present.

### 4.4 Client integration and cache safety

- Use existing API client and `ApiError` abstraction; neither direct `fetch` bypassing auth nor localStorage tokens. Extend API wrapper with review calls and corresponding response types only.
- Follow epoch/token guard (`getAuthEpoch`, memory access token) to prevent stale success crossing account switch. TanStack Query keys must retain user, role, epoch and query dimensions; invalidate reviewer queue/project detail and ordinary project listing appropriately on success.
- Do not show a reviewer button until `canReview` / `availableReviewActions` is returned through a **secure server-originated hint** or derived from confirmed role/state without pretending it proves authority. Every API write rechecks everything.
- On 409 show preserved input, refresh prompt and non-mutated status; avoid optimistic approved status. On response 401/403/404 clear private review data as appropriate; no stale sensitive data in a new account's view.

---

## 5. Environment and outside-service needs

**No new third-party service, AI API, payment gateway, OAuth provider, cloud storage, or map key is required to implement Step 57.** Use the already established stack: Next.js/React/TypeScript/Tailwind v4, Express/TypeScript/Zod, MongoDB/Mongoose, existing authentication and TanStack Query. Do not add packages unless demonstrated necessary.

| Configuration | Purpose | Safe treatment |
|---|---|---|
| `apps/web/.env.local` → `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000` | Normal local web/API origin | **Preserve** existing file. Do not permanently change it for browser acceptance. |
| Process-scoped `NEXT_PUBLIC_API_BASE_URL=http://localhost:4011` | Isolated browser verification when harness on port 4011 | Set only in a dedicated clean shell/process for review. Note Next bundles public values at build time; start a separate Next process. |
| `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=1` | Existing dev-only real sign-in enablement | Enable in authorized isolated development only; production preview auth is not an acceptance path. |
| `PORT`, `FRONTEND_ORIGIN`, `API_PREFIX` | Existing Express listener/CORS | For isolated demo use available approved ports; do not assume old PIDs free. |
| `MONGODB_URI`, `MONGODB_DB_NAME` | Mongo replica connection and test DB | Disposable MongoDB replica set only, never live Atlas or prod database; test DB name ending `_test` as enforced when NODE_ENV=test. |
| `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL` | Existing auth | Use real locally generated secrets compliant with existing loader; never print, commit or invent credentials. |
| `NEXT_PUBLIC_MAP_STYLE_URL`, `OPENROUTER_API_KEY`, R2/Qdrant | Optional unrelated services | Not needed; don't request keys or introduce dependencies. |

Earlier Step 55–56 isolated demo used API **4011** and web **3001** while processes on 3000/4000/4010 were preserved. This is historical—not a guarantee those ports remain free. **Preflight ownership** before launching. The repo's `apps/api/src/scripts/step55-isolated-dev.ts` is a *previous-step* test fixture; extend minimally/reuse safely and do not copy the app to another project folder or create worktrees. If running a second Next dev process requires an isolated build directory, do not create an extra project folder outside the one approved worktree; use an approved in-repo supported configuration or serialize processes while preserving unrelated processes and local changes. If isolation cannot be achieved safely, report blocked.

---

## 6. Implementation phases inside ONE roadmap step

These are **engineering activities**, not separate Cursor execution prompts.

| Order | Work | Output/checkpoint |
|---|---|---|
| 0 | Git/worktree, roadmap, Step 55–56 handoff, actual code, port and test-safety preflight | Source-of-truth note, no destructive action. |
| 1 | Freeze review policy, state graph and reason persistence decision | G1/G2 decisions tracked; if unapproved, create no unauthorized enum/schema change. |
| 2 | Build/refactor *minimally* pure review policy predicates: action/edge, actor/role, field/reason requirements, SoD attribution selection | Fast unit tests; no model magic. |
| 3 | Implement authoritative reviewer service, transaction, secure audit, queue/detail DTO and strict API routes | Integration tests with disposable replica and real actors. |
| 4 | Build premium review queue and reviewer detail/decision UX, connect API, i18n, state and cache | No dead controls; mobile-first polish and accessible error handling. |
| 5 | Run essential focused tests/type/lint and an **actual signed-in isolated browser demonstration for Step 57** | Screenshots, local URLs, actor identities (redacted), API response evidence. |
| 6 | Write succinct step implementation status with PASS/FAIL/BLOCKED/NOT RUN, unresolved G1/G2/focus-ring, owner walkthrough and Step 58 handoff | Stop; **one** separate combined/full review prompt (companion artifact) then runs the full phase gates. |

**Efficiency rule:** Inspect repository once, keep notes compact, implement vertical slice, reuse existing code, run focused tests as you go; run full `npm run test:api`, `test:web`, `type-check`, `lint`, `build` at the **final review** stage, not redundantly after every trivial edit.

---

## 7. Testing strategy and expected outcomes

### 7.1 Backend tests — must cover

1. Gov Admin with active `project.approve`, in ministry scope, valid current `revision` can `BEGIN_REVIEW` (200, `UNDER_REVIEW`, revision +1, exactly one audit event).
2. Different authenticated Gov Admin in scope can approve reviewed project (200, `APPROVED`, audit), but original submitter—even if later granted Gov Admin—**cannot approve their own** submitted project.
3. `SUBMITTED → APPROVED` direct and `DRAFT → APPROVED` denied; illegal edge/terminal state rejected with unchanged DB and no success audit.
4. If G1/G2 approved: rejection from permitted statuses with persisted reason; returned `DRAFT` with persisted correction reason; malformed/missing/too-long/control-character reason is 400; evidence survives a fresh scoped read.
5. Missing/corrupt/multiple ambiguous submission audit entries **fail closed** for approval; `createdBy`, client `submittedBy` and forged approverId not used; resubmission cycle properly attributed.
6. AO, PM, Contractor, Inspector, Citizen and Super Admin cannot approve, irrespective of client hints or forged body.
7. Out-of-org Gov Admin gets 404 for resource, zero queue count and no project code/reason/audit leakage; invalid ObjectId 400; no token 401; expired/revoked/disabled user denied; role/grant revoked after token issuance denied.
8. Concurrent reviewer approvals, stale revision and review-vs-return races => one writer, one 409; audit failures roll back DB state; no duplicate approval after retry.
9. Active agency hierarchy changes mid-request, reparented subtree, paused agency, current role/grant changes -> deny or fail closed, do not claim Step 51 race closure if unverified.
10. Existing Step 55 draft PATCH/Step 56 SUBMIT/HOLD/RESUME and 403/409 guarded actions remain unchanged. `project.read` and budget visibility remain scoped.
11. Validation rejects unknown JSON body keys/operators, non-JSON 415, malformed strings; response `Cache-Control: no-store`; no secret in errors/logs.

### 7.2 Web/component/integration checks

- Queue: real scoped results, server-sort and server-pagination, search trim, filter URL sync, back/forward, empty state, correct loading/error/retry, and no unauthorized records.
- Detail: stable links, project/agency/status consistency, sensitive budget only when granted, fresh decision timeline, no fake timestamp, copy coverage EN/SI/TA, user change cache isolation.
- Actions: backend hint/role/state correctness, confirmation and persistent reason, disabled submit state, submit-once, duplicate protection, 400/401/403/404/409/503 messages, preserve reason on stale 409, no success UI on failure.
- Responsiveness and a11y: 320/360/390/768/1024/1440 + 200% zoom, color contrast, visible keyboard focus, real keyboard interaction, modal focus, accessible table/sort, reduced-motion, semantic status not color alone, screen reader dynamic messages.

### 7.3 Mandatory REAL browser acceptance, every step

A source change or a green unit test is **not** a demonstration. Use an authorized isolated disposable replica and **actual signed-in staff** fixture with a real API endpoint. Seed synthetic organizational graph with: ministry Gov Admin, in-scope AO submitter, assigned PM, another ministry Gov Admin, non-reviewer/contractor/inspector/citizen/Super Admin, and projects in `DRAFT`, `SUBMITTED`, `UNDER_REVIEW` and `APPROVED` as required. **Seed fixture states clearly labeled as seeded**, not produced by endpoints.

Required owner-visible walkthrough:

1. Verify API `/ready` is **200** and the database is disposable; confirm authorized local sign-in. Record actual local origins (historically `http://localhost:3001` / `http://localhost:4011`).
2. Submit a draft as AO with existing step 56 UI. Sign out/switch to the separate Gov Admin. Queue should show the real submitted project under the correct ministry only. Capture queue screenshot and actual URL.
3. Begin review: check persisted `UNDER_REVIEW`, record old/new revision and audit actor; reload detail to verify durability. Capture before/after.
4. Approve with **a different** authorized reviewer: `APPROVED`, audit, refreshed list/status. Capture actual browser screenshot and redacted API evidence.
5. Attempt the same approval as the original submitter after role escalation fixture (without mutating real accounts); expect denial and unchanged state, with redacted evidence.
6. If G1/G2 approved: do real **reject with stored reason** on another project, then return-for-changes with stored reason if supported; verify submitter sees the permitted reason on reload. If not approved, explicitly mark these **BLOCKED** and do not demo a pretend button.
7. Test out-of-org reviewer, Super Admin, AO, PM, contractor, inspector and citizen; verify scoped empty list/403 or 404 behavior and no leaked project title/reason. Test signed-out Back and account switch.
8. Open reviewer detail in two browser tabs; make a decision in tab B; attempt stale tab A; show 409 without losing reason. Capture if possible; screenshot failure must be noted honestly.
9. Check queue search/filter/sort/pagination, 320–1440 layouts, zoom, keyboard, focus/contrast measurement and reduced motion. Capture real screenshots and note CSS/device settings.
10. Shut down **only processes started for this run**, leave existing 3000/4000/4010 processes and `.env.local` untouched. Include clean instructions to repeat with new ephemeral project IDs and **no passwords in report**.

Evidence expected: `docs/reviews/step-57/evidence/` under approved worktree, genuine screenshots with descriptive names, redacted request/status/response details, actor-role matrix, actual observed URLs, commands/exits, system/time, fixture provenance and honest not-run reasons. If screenshots cannot be created, record exactly that. **Never claim approval without executing the flow.**

---

## 8. Acceptance criteria — Step 57

| ID | Required criterion | Accept only with |
|---|---|---|
| AC-57-01 | Reviewer queue is live, ministry-scoped and searchable/filterable/sortable with server count/page | Integration test + signed-in list browser walkthrough. |
| AC-57-02 | `SUBMITTED → UNDER_REVIEW` real backend transition | Strict route, CAS/audit and reload evidence. |
| AC-57-03 | `UNDER_REVIEW → APPROVED` truly functional for correct Gov Admin | Authenticated browser and durable audit, not fixture-only. |
| AC-57-04 | Rejection/return paths comply with state graph and actually **persist reasons** | G1/G2 approved and actual reason retrieval evidence; otherwise BLOCKED. |
| AC-57-05 | Submitter/approver SoD and absent-audit fail-closed | Negative integration tests + relevant browser role case. |
| AC-57-06 | Server enforces live grant, ministry hierarchy and no unauthorized data leakage | API RBAC/IDOR + browser account switching. |
| AC-57-07 | Stale/concurrent actions cannot double decide; audit rollback atomic | Two-client integration + real two-tab browser case. |
| AC-57-08 | Premium, responsive, accessible EN/SI/TA draft UI with real controls only | Design review; widths/zoom; keyboard/focus/contrast/reduced-motion; mark native review pending. |
| AC-57-09 | Existing Steps 53–56 behavior remains correct; no public landing edits | Regression suite/diff and 403/409 failure-preservation evidence. |
| AC-57-10 | Safe isolated demo and owner instructions supplied; no Atlas/index/auth bypass | Screenshot/URL/redacted request and environment cleanup evidence. |
| AC-57-11 | Git operations performed only after separate approvals; unrelated dirty files preserved | Before/after `git status`, no unexpected commits, staged diff review. |
| AC-57-12 | Honest blockers, no false signoff and Step 58 handoff | Reports with PASS/FAIL/BLOCKED/NOT RUN and final APPROVE/REVISE/BLOCKED recommendation. |

**Decision standard:** `APPROVE` only for genuinely implemented, fully demonstrated and accepted required Step 57 scope with no high-severity unresolved defect. `REVISE` for fixable code/UI defects. `BLOCKED` for unresolved G1/G2 approval, missing actual browser test, missing safe environment, or another hard dependency. Distinguish Step 57 *feature verdict* from global *production readiness* (Atlas/index, invitation email, native translation, Step 51 races, null-agency Super Admin).

---

## 9. Review files, Git governance and delivery

### 9.1 Expected on-repo outputs (once Cursor implements, NOT produced by this request)

- Working reviewed API policy/service/schema/route and focused tests; no divergent shadow source.
- Working reviewer queue/detail/confirmation UI, constrained typed API hooks, dictionaries and focused tests.
- `docs/reviews/step-57/IMPLEMENTATION-STATUS.md` (concise step checkpoint).
- `docs/reviews/step-57/evidence/` (only genuine artifacts from executed browser run).
- `docs/reviews/step-57/END-OF-STEP-VERIFICATION.md` (one final combined Step 57 phase-wide review, concise acceptance matrix and owner demo). The final review prompt produces this, not the step execution prompt prematurely.
- The Step 57 handoff to **Step 58 — Milestone Management** with schema and view contracts, not implementation.
- A short G1/G2 owner decision record if approved; if pending show exactly which action paths were not implemented.

### 9.2 Mandatory Git rules and approval checkpoints

**Fixed project root only:** `C:\Users\ASUS\Desktop\InfraOS\InfraOS`. Never touch `Documents`, create separate project directories/worktrees or clone anew. Keep `development` integration, `main` approved stable. Do not modify `/`, `/si`, `/ta` Connected Future landing.

**Safe read-only preflight:**

```powershell
Set-Location 'C:\Users\ASUS\Desktop\InfraOS\InfraOS'
git status --short --branch
git branch -vv
git log -5 --oneline
git diff --check
git diff --stat
```

After inspection, **ask for a separate explicit approval to create/switch to one related feature branch**, proposed `feature/projecttrace-approval-workflow`, rather than a step-per-branch strategy. If local changes exist, do not reset, stash, checkout or switch to make them disappear. If already on a suitable approved feature branch, reuse it. The creation command below is **illustration only** and must not be executed without user approval:

```powershell
# CHECKPOINT A — user approved branch creation/switch, worktree safe
git switch -c feature/projecttrace-approval-workflow
```

Before any commit, display **actual** files and diff, decide exact intended paths, prevent accidental inclusion of secrets/seed DB artifacts/prompts/evidence with private info. Never use `git add .`:

```powershell
# CHECKPOINT B — explicit owner approval of exact path list first
# git add -- <reviewed specific relative file paths>
git diff --cached --check
git diff --cached --stat
git diff --cached
# CHECKPOINT C — explicit commit approval first
# git commit -m "feat(projecttrace): implement scoped project approval workflow"
# CHECKPOINT D — explicit push approval first
# git push -u origin feature/projecttrace-approval-workflow
# CHECKPOINT E — separate PR approval; target development, never development→development
# CHECKPOINT F — separate merge approval; only later promote approved development to main
```

No branch, stage, commit, push, PR, or merge in the **prompt-generation** task. Those commands are guarded future instructions only.

---

## 10. Outstanding risks and Step 58 handoff

1. **Locked state-model conflict** (`REJECTED`) and **audit reason schema** are explicit owner decision gates. Complete required review and reject UX cannot receive unconditional PASS before these are resolved.
2. **Submitter attribution**: audit-derived and subject to resubmission/cycle validation; if ambiguity exists, fail closed and recommend narrowly scoped immutable server field only after approval—not a new client field.
3. **Step 51 hierarchy/grant races**: do not claim fixed by merely calling `assertLive`; exercise targeted concurrent cases and document residual risk.
4. **Visual non-text contrast**: prior report found 2.9:1 focus ring. Verify local state (might have changed since report) before Step 57 UI acceptance; fix minimal design token rather than rebrand the interface.
5. **External delivery blockers**: Atlas/index approval, invitation email, null-agency Super Admin, native Sinhala/Tamil review remain separately tracked. They are not to be "solved" by connecting to production Atlas for screenshots.
6. **Unsupported project lifecycle actions**: START/MARK_DELAYED 403, COMPLETE/CANCEL 409 remain by design; Step 57 never bypasses them.
7. **Owner demonstration**: only genuine isolated browser evidence can satisfy completion; reviewer fixtures and seeded `APPROVED` state must be labeled synthetic if not reached via API.
8. **Step 58**: pass the final protected project status, agency/manager/read scope and policy-approved milestones-read permission assumptions; do not create milestone forms/tables/endpoints in Step 57.

**Final instruction to Cursor:** implement one coherent, testable Step 57 vertical slice with modern, premium, fully real functionality. Stop on unauthorized changes. Do not represent absent policies, unavailable service dependencies, prototype-only output or skipped tests as PASS. Then use the companion file's **single final testing/review prompt** for overall acceptance.
