# INFRAOS — Steps 48–49 Enhanced Development Prompt

**National Infrastructure Intelligence & Coordination Platform**  
**Vision:** *The Operating System for National Infrastructure*  
**Prepared:** 25 October 2026 · **Roadmap phase:** Identity and institutional administration  
**Repository:** https://github.com/divejikan-yuvarajah/InfraOS  
**Exclusive working folder:** `C:\Users\ASUS\Desktop\InfraOS\InfraOS`  
**Proposed shared feature branch:** `feature/identity-administration` (create only after owner authorization and Step 47 gate)  
**Integration:** `development` only after owner approval; `main` on separate release approval  
**Companion:** `INFRAOS_Steps_48_49_Cursor_Agent_Execution_Prompts.md`

> **Roadmap evidence and limits:** The accessible INFRAOS Steps 15–50 planning index identifies **Step 48 — Admin user management** and **Step 49 — Agency management**. The original `Steps.docx` is not attached or readable here. A Step 47 preflight file says `Steps.docx` exists in the local untracked `Prompts/` folder but had not been parsed. Cursor must compare the exact Step 48/49 wording there, **read-only**, without moving, editing, committing or deleting it, and reconcile discrepancies before implementation. Specific endpoint/UI details below are proposed implementations of the supported titles and locked project policies, not invented verbatim roadmap text.

---

## 1. Current GitHub snapshot, dependency gate and constraints

### 1.1 Verified when this document was generated

| Branch or source | Commit prefix | Verified observation |
|---|---|---|
| `development` | `d8e62de8526943e` | Steps 45–46 merged via PR #77; identity/RBAC/resource-scope foundations on integration branch |
| `main` | `ea7377a1e74509a` | PR #78 integrated Steps 45–46 to stable release |
| `feature/identity-self-service-profile` | `d4db9118d7bb31d` | Step 47 committed as `feat(identity): add secure self-service profile and account settings`, **not merged** into `development` or `main` in this snapshot |
| Open PRs | none returned | Do not infer Step 47 was approved or released |

The Step 47 `END-OF-STEP-VERIFICATION.md` was written before its commit and says “uncommitted” and *same-agent review*. The historical report cites **275 API tests, 133 web tests, type-check, lint and build PASS** at that review, but live authenticated profile browser flow was NOT RUN. GitHub's newer Step 47 feature commit is proof of a commit, **not proof of owner approval, merger, Atlas readiness or a live demonstration**. Cursor must check live Git refs and owner acceptance before starting Step 48.

**Hard gate before implementing Step 48:** verify Step 47 owner acceptance and its approved integration into `development` (or an explicit owner-approved equivalent baseline). If the base is not approved/clean, report `BLOCKED` and do not start new code or branch operations. Preserve all untracked prompt files, existing branches, and any dirty local changes. Do not auto-stash, reset, force-pull, rebase, or discard. Read-only git inspection is permitted; fetch and fast-forward only after explicit owner permission.

**Previous architecture to reuse:**

- `apps/api/src/modules/identity/auth/require-authenticated.ts`: verifies Bearer JWT, current user ACTIVE/verified, current active role/agency, and token `credentialEpoch`; provides DB-verified `req.actor`.
- `apps/api/src/modules/identity/authorization/require-permission.ts`: current `Role.permissions` from MongoDB, explicit catalog codes; JWT/body/seed/list cannot grant. 401 before identity, 403 authenticated missing grant, 503 dependency unavailable.
- `apps/api/src/modules/identity/authorization/resource-scope.ts`: fail-closed agency hierarchy/assignments; active descendants, depth and cycle handling; `MATCH_NONE` unknown relationship. Reuse or carefully extend, never circumvent its denial semantics.
- User Mongoose schema (`models/user.model.ts`): name, email unique, passwordHash select:false, roleId, agencyId, status (PENDING/ACTIVE/etc. per enum), emailVerified, credentialEpoch, lastLoginAt, createdBy, updatedBy. Do not bypass this model with unsafe writes.
- Agency schema (`apps/api/src/modules/agencies/models/agency.model.ts`): uppercase unique code, name, shortName, type, description, contact, address, status, parentAgencyId; existing self-parent check only (not full cycle prevention); established indexes.
- Current **trusted internal** `provisionStaff()` (`registration.service.ts`) requires a `TrustedProvisioningActor` with `source: server-internal`, `capability: identity.provision`; validates roles/agency, hashes password bcrypt cost 12, creates PENDING + emailVerified false, but it has **no admin HTTP endpoint, no production onboarding-email delivery, and no persistent audit write**. Do not turn an untrusted HTTP field into this trusted actor.
- AuditLog model (`modules/audit/models/audit-log.model.ts`) is append-only, supports `USER` and `AGENCY`, safe old/new snapshot fields and requestId. Direct native Mongo writes can bypass Mongoose hooks; avoid broad update/delete rights. No dedicated user/agency admin REST routes on `development` snapshot.
- `apps/web/src/lib/auth/{state,route-access,confirm-identity}.ts`, `apps/web/src/lib/api/client.ts`, route guard, and Step 47 `/profile` and `/settings` on **feature branch only until integrated**.
- `docs/security/{roles-and-permissions,permission-catalog,permission-matrix,resource-authorization,route-access-policy}.md`, `docs/architecture/{authorization-flow,notification-audit-architecture}.md` and `docs/planning/business-rules.md` are locked. Seven roles exactly; one primary role per user; no public staff signup, impersonation or free-form role assignments.

**Established unresolved dependencies:** Atlas index proposals from Steps 40–42 are unapproved; in nonproduction `autoIndex` can mutate Atlas when `dev:api` connects. **Never run against Atlas** without explicit review/permission. Real recovery/invite email provider is unavailable. Step 46 contractor-user ownership association is unapproved; Project `submittedBy` absent. Platform scope authentication has a compatibility tension: existing `requireAuthenticated` requires `user.agencyId`, while `provisionStaff` allows null agency for `PLATFORM` roles; do not silently widen identity rules. Investigate and propose/resolve as an explicit owner/security gate with regression tests before claiming Super Admin live browser proof.

---

## 2. Phase architecture, sequencing and definition of done

**Step 48 = admin management of staff identities and controlled lifecycle** (critical security). **Step 49 = governed agencies/ministry hierarchy and contact data** (high security/data integrity). Implement sequentially on **one approved feature branch**, without separate per-step review prompts; Step 48 must pass essential focused checks before Step 49 edits. Run **one overall phase testing/security/browser review** after both are implemented. Owner acceptance and Git approval remain separate.

```text
Browser: /admin/users and /admin/agencies
  -> Step 43 guarded private Next.js routes, Step 44 verified /auth/me
  -> in-memory bearer JWT via existing apiClient; no replay of POST/PATCH
Express /api/v1/admin/users or /api/v1/admin/agencies
  -> requireAuthenticated (JWT, credential epoch, eligible actor)
  -> requirePermission(user.read/create/update/disable or agency.read/manage)
  -> server-derived actor scope, role/agency relationship and target checks
  -> validated DTO + atomic DB conditional writes / transaction + append-only audit
  -> safe success/failure envelope, no-store, requestId
MongoDB isolated replica set in tests; Atlas changes only after separately approved migration
```

**Separation:** authorization to enter an admin screen ≠ permission for every action ≠ authority over a specific user/agency. All list/count/detail/write queries must enforce scope in MongoDB. Never fetch all identities or agencies then hide unauthorized records in React. Require immutable provenance, current role grants and no self-escalation.

**UI goal:** premium but efficient administration (search, filters, pagination, detail drawer/side panel, clear scope badges and confirm dialogs) without a generic ERP clone. Do not build unrelated project/finance/roles systems in this phase.

---

## 3. Step 48 — Admin user management (implementation-ready specification)

### 3.1 Roles and permissions (source of truth)

| Actor | Allowed actions, subject to current DB permissions | Hard limitations |
|---|---|---|
| `SUPER_ADMIN` | Platform-wide permitted `user.read`, `user.create`, `user.update`, `user.disable`; controlled staff provisioning and governance | **No impersonation**; no unreviewed self-role promotion; never override SoD; cannot disable/remove final viable Super Admin |
| `GOV_ADMIN` | `user.read` within active ministry/organization descendants, create/update/disable *nonprivileged org staff* only if matching current permission and explicit provisioning policy | Never create/assign `SUPER_ADMIN` or another `GOV_ADMIN` by default; no cross-org assignment; cannot grant permissions/roles unless explicitly permitted by the locked role-change policy |
| `AGENCY_OFFICER` | `user.read` only where the locked permission matrix and live grant allow; minimal agency-scoped safe view | No user creation, status change, role or agency assignment by default |
| All others | Self-profile only via Step 47; no admin directory | 403 admin actions; no directory enumeration |

**Important locked rule:** only Super Admin changes roles/role assignments; `role.manage` is **not** a blanket right to impersonate and does not override target scope, server policy or own-account safeguards. `GOV_ADMIN` may create subordinate staff under approved role/agency limits; cannot use `user.update` to self-elevate or edit peer Gov Admin status. Use exact current `Role.permissions`, not inferred from `roleKey` alone.

### 3.2 Minimal REST contracts (proposed; reconcile repo naming)

| Endpoint | Guard | Behavior |
|---|---|---|
| `GET /api/v1/admin/users` | `requireAuthenticated` + `user.read` + server scope | Paginated, safe-projection staff list and constrained counts |
| `GET /api/v1/admin/users/:id` | `user.read` + resource scope | Own-scope safe detail or indistinguishable 404 |
| `POST /api/v1/admin/users` | `user.create` + provisioning policy | Controlled PENDING staff provision, **never** active/unverified auto-login |
| `PATCH /api/v1/admin/users/:id` | `user.update` + field/action scope | Safe staff name or assignment details, strict whitelist and optimistic concurrency |
| `POST /api/v1/admin/users/:id/disable` | `user.disable` + scope | Atomic disable + credentialEpoch increment + all refresh-family/session revoke + audit; idempotent verified status |
| `POST /api/v1/admin/users/:id/enable` | `user.disable` or clearly approved re-enable permission policy | Controlled restore only if verified, role/agency active and policy permits; **never** set emailVerified true or issue session |

Endpoints are a *proposal*, not pre-existing code or a claim about `Steps.docx`. A direct `PATCH status` must not circumvent the audited lifecycle endpoints. A user-management operation is invalid if its target is out of scope even when caller has an action permission. Existing `/auth/me`, `/profile/me`, login/refresh/logout/forgot/reset must remain backward compatible.

### 3.3 Staff creation/onboarding design and email blocker

- Reuse existing `staffProvisionSchema`, `provisionStaff` behavior and bcrypt 12 safely; create PENDING, `emailVerified: false`; never allow public staff registration or citizen staff role through the admin form.
- The existing trusted provisioning capability may be invoked **only after** a verified server-generated authorization decision (`requireAuthenticated`, current `user.create`, scoped role and agency). Do not expose a caller-supplied `source/capability` or trust `createdBy`, `status`, `roleId`, `permissions`, verified flags, `credentialEpoch` from body.
- User-specific email is unique, case-normalized; duplicate attempts return safe 409 with no duplicate account and no email existence disclosure outside authorized admin scope. No plaintext password, generated invitation/reset token, or initial password in logs, audit, response, URL or browser storage.
- **A real invite/activation email service is not configured.** Do **not** invent a delivered invitation. Choose an owner-approved onboarding contract before enabling production creation: either safe admin-controlled nonproduction fixture flow or an approved delivery provider/secure invitation mechanism. The API may support testable PENDING creation and show “Activation delivery unavailable” without pretending that staff can log in. If the required secure distribution method is undecided, mark production activation **BLOCKED**, not a failed implementation nor automatic authority to send live mail.
- Test exact eligible role mappings and `PLATFORM` no-agency login issue. Do not opportunistically amend Step 44's actor logic unless approved and proven safe. Any initial password approach must preserve bcrypt 72-UTF8-byte limit, avoid temporary credentials in responses and be restricted to the approved trust boundary.

### 3.4 Edit and disable/enable security

- **Field-level policy:** name may be edited within scope; agency assignment is a separate privileged action, not a freeform general PATCH; role assignment **Super Admin only**, with active role and explicit exact role-change privilege. Email change requires a separate verification/recovery design; never set `emailVerified` on request. Disable/enable cannot mutate passwords/roles/agency accidentally.
- User list/deep-link 404 for inaccessible private IDs; 400 malformed ID, 401 unauthenticated, 403 missing capability, 409 collision/stale rev/state/last-admin, 503 dependency; 429 global limiter.
- **Session revocation on disable, reassignment, privileged role change:** transactionally persist the status/role/agency update and bump `credentialEpoch` on the same user; close its `RefreshFamily` and revoke `RefreshSession` using Step 42's epoch rules. The access JWT claim `ce` is rejected on protected routes after the commit (Step 44). Concurrent login/refresh must not mint a post-change usable session. Do not claim instant revocation on unrelated logout since an old access JWT can survive ordinary logout until TTL.
- Guard against last active Super Admin loss and self-disable/self-demotion, requiring server-side non-racy decision. If unable to prove safe last-admin concurrency under replica-set transactions, **block the privileged operation** pending owner-approved admin recovery policy instead of guessing.
- Agency assignment must re-check active target and hierarchy, prevent cross-org movement, preserve active credential/session safety, and keep historical audit. No blind mass reassignment.
- Keep list filters server-derived; cap page size, stable sort, index review only, countDocuments on same scope. No public PII export, bulk delete, password reveal, user enumeration API or leaked role permissions.

### 3.5 Audit, transaction and idempotency

Sensitive user provisioning, disable, enable, role or agency assignment changes require append-only audit with actor/target IDs, action (`identity.user.*`), safe old/new snapshots, requestId/timestamp. No password, JWT, refresh tokens, reset challenges, mail secrets or full request body in audit/Pino. Prefer `AuditLog.create([{...}], { session })` in the **same MongoDB transaction** as privileged mutation when correctness requires all-or-nothing. Isolated test Mongo MUST be a replica set. If transaction support is missing, mark test BLOCKED; never substitute independent writes while claiming atomicity. Update provenance via server actor, not request body. Avoid duplicating an audit entry for an idempotent replay; retries after unknown commit result must be studied and tested.

### 3.6 Backend structure / UI

Suggested: `modules/identity/admin-users/{admin-user.routes,schema,service,types}.ts` with minimal `/api/v1` mount, reusing User/Role/Agency, `requireAuthenticated`, `requirePermission`, `resolveResourceScope` or equivalent tested server policy, `AuditLog`, Step 42 refresh models. Add tests under `apps/api/tests/admin-users.test.ts` and dedicated race/auth tests.

Create `/admin/users` guarded by existing private route classifier and confirmed `/auth/me`. Permission-aware navigation uses a safe capability endpoint or authoritative user/action-specific API results; `roleKey` is **display guidance only**, never backend authorization. Include role-aware list, search, pagination, active/pending/disabled badges, safe detail/editor, confirmation for disable/enable, loading/empty/403/404/409/503/retry, status explanation, and visible honest activation-blocked notice. No raw password response or live email claim. EN/SI/TA copy may be a draft pending native review.

### 3.7 Step 48 acceptance gate — pass essentials before Step 49

1. Anonymous/non-admin no private list (401/403); Gov Admin sees org descendants only; Super Admin sees platform safe DTOs; Agency Officer has at most documented read.
2. Authorized PENDING user creation with safe onboarding constraint; denied role/agency escalation, cross-org provisioning and duplicate email.
3. `user.disable` prevents further protected access, closes refresh sessions and resists late login/refresh; another user unaffected. Role/agency privileged update same.
4. No final-Super-Admin removal; no self-demotion/disable; no impersonation, role/permission grant via body.
5. Audit records action once with safe fields; transaction abort rolls back both user change and audit.
6. Step 47 profile auth, previous login/logout/reset and Step 45–46 scope tests pass focused regressions.
7. Real browser admin PENDING creation/suspension and revocation only when isolated API is safe; otherwise honest `BLOCKED`.
8. Concise `docs/reviews/step-48/IMPLEMENTATION-STATUS.md` with focused results, unresolved onboarding/security decisions. **Do not run the final phase testing prompt yet.**

---

## 4. Step 49 — Agency management (implementation-ready specification)

### 4.1 Governed authority and scope

- `SUPER_ADMIN`: `agency.read` platform-wide, `agency.manage` to create/update allowed agency fields and controlled hierarchy, subject to audit and system invariants.
- `GOV_ADMIN`: scoped `agency.read` of own active ministry/organization and active descendants. The locked seed does **not** grant Gov Admin `agency.manage`; they should not create/reparent/disable agencies by default. Do not turn `user.update`, `user.create` or `roleKey` into `agency.manage`.
- Agency Officer / Project Manager may view the own agency only when current `agency.read` exists; no manage by default. Other roles no broad directory.
- The `SUPER_ADMIN` read-only RoadSync conflict policy from Step 46 is unaffected. No user/agency role cross-privilege or operational SoD bypass.

### 4.2 Proposed REST contract

| Endpoint | Required access | Result |
|---|---|---|
| `GET /api/v1/admin/agencies` | `agency.read` + server-derived platform/org/own-agency scope | Paginated list/tree-flat DTO, safe counts/filters |
| `GET /api/v1/admin/agencies/:id` | `agency.read` + resource scope | Safe detail or indistinguishable 404 |
| `POST /api/v1/admin/agencies` | `agency.manage` + Super Admin governance | New valid agency (code immutable, unique), approved active parent |
| `PATCH /api/v1/admin/agencies/:id` | `agency.manage` + server state policy | Strict allowed public admin metadata only, optimistic concurrency |
| `POST /api/v1/admin/agencies/:id/reparent` | `agency.manage` + hierarchy authorization | Cycle-proof, concurrent-safe, **transactional** hierarchy change with explicit dependency review |
| `POST /api/v1/admin/agencies/:id/deactivate` | `agency.manage` + impact policy | Block or perform approved safe deactivation only when dependents are addressed; never silently cascade |

Do not invent a separate ministry collection; `Agency.parentAgencyId` is the existing hierarchy. Distinguish organization/ministry from child agency using existing type and organization scope rules, not an arbitrary client-supplied “organizationId”. No destroy/delete endpoint in V1.

### 4.3 Validation, hierarchy and database invariants

- Reuse existing `AGENCY_TYPES` and `AGENCY_STATUSES`, never invent string constants. `code`: uppercase, unique, immutable, 1–32 chars per schema, regex `[A-Z0-9_]+`. Names/short names/descriptions/email/phone/address reuse current model sizes and validation, Unicode names allowed. Strict allowlist: never accept Mongo operators, actor permissions, timestamps, `_id`, `__v` or unrestricted status/parent fields in ordinary PATCH.
- `parentAgencyId` may be null only where allowed by locked org type/business rules; chosen parent must be ACTIVE, exist, and satisfy institutional hierarchy. Reject direct self-parent **and all transitive cycles**, including attempts to link a root under its grandchild.
- Existing schema prevents *only self-parent*. Implement a full descendants/ancestor cycle check **and concurrency serialization barrier** such that simultaneous A→B and B→A changes cannot each pass separate reads. Mongo transaction alone does not make two independent graph reads and writes serializable automatically; use an approved shared version/lock/conditional write strategy with a race test, or keep reparent operation `BLOCKED` rather than claim safety.
- Before deactivation/reparent, inspect dependencies (`User`, child `Agency`, `Project`, `WorkRequest`, audit history and other existing references). If active users/children/projects still reference the agency, **deny with 409** and a safe impact summary unless an owner-approved migration plan handles reassignment atomically. Never orphan staff, break Step 46 scope or silently broaden ministry visibility. Never hard-delete historic agency IDs.
- No direct agency hierarchy mutation through Step 48 user creation. Step 49 must integrate Step 48's agency selector with active, authorized agencies only; changed hierarchy changes permitted Gov Admin user scopes immediately on subsequent requests.
- Cross-org actors cannot read undisclosed child agencies by guessing IDs. Gov Admin descendant scope cannot traverse inactive parents or cycles. Fail-closed if parent missing, hierarchy inconsistent, over depth bound or database unavailable.
- Use an optimistic revision (`__v` or approved equivalent) for ordinary metadata edits and stale writes. Unique index is **declared** on `code`; no unapproved `syncIndexes`, `createIndexes`, Atlas auto-index side effects. Propose any additional index separately.

### 4.4 Audit / UI and integration

Persist append-only AuditLog USER/AGENCY actions with actor, target, safe before/after, requestId; sensitive structural changes should record history and be transactionally coupled to mutations. Guard against audit write failure turning a supposed successful privileged write unaudited. Do not log raw contact PII where unnecessary.

Create `/admin/agencies` as protected responsive page: search, agency code/name/type/status, parent/children hierarchy display, restricted actions and safe details, clear affected references before attempting reparent/deactivation, confirm dialog, no fake completed migration. Gov Admin gets read-only ministry subtree. Keyboard accessible hierarchy/table and EN/SI/TA draft text; no drag-drop hierarchy mutation without proven backend checks. Display controlled warnings for pending dependencies. Reuse private shell; avoid marketing `/`, `/si`, `/ta` edits.

Suggested files: `apps/api/src/modules/agencies/management/{agency-management.routes,schema,service,types}.ts`; existing `Agency` model only if a scoped schema change is required; minimal V1 mount; `apps/api/tests/agency-management.test.ts`; `apps/web/src/app/admin/agencies/*` and typed client/components. Reuse Steps 45–46 authorization helpers, safe envelope and API client. Avoid adding general-purpose graph/database libraries.

### 4.5 Step 49 acceptance

1. Authorized platform create/list/detail/metadata update; Gov Admin reads only verified ministry descendants; other roles scoped/denied appropriately.
2. Unique immutable normalized codes, strict validation and Unicode text; no mass assignment or raw Mongo operators.
3. Wrong-org/missing agency ID gets identical 404, invalid ID 400, missing grant 403, missing JWT 401.
4. Cycle or missing/inactive parent fails; **parallel opposite reparent attempts cannot create a cycle**. If not implementable safely within this scope, report reparent BLOCKED.
5. Deactivation never leaves active users/children/projects in undefined state, never widens Step 46 scopes; no silent cascades or delete.
6. Audit and metadata writes are coupled correctly; failures roll back and 409 preserves state.
7. Existing Step 48 user pickers respond to agency status/hierarchy changes without security drift.
8. Focused tests pass and `docs/reviews/step-49/IMPLEMENTATION-STATUS.md` records actual completed and blocked operations.

---

## 5. Common API contracts, security, and frontend design standards

**HTTP response vocabulary** (honor existing handlers): `200` GET/update, `201` create, `400 VALIDATION_ERROR`, `401 AUTH_REQUIRED`/`SESSION_EXPIRED`, `403 FORBIDDEN`, `404 NOT_FOUND` for missing/inaccessible private ID, `409 CONFLICT` / duplicate or dependency conflict, `415 UNSUPPORTED_MEDIA`, `429 RATE_LIMITED`, `503 SERVICE_UNAVAILABLE`. `Cache-Control: no-store` for admin PII. Include `requestId` in existing envelope. Do not expose exact existence of out-of-scope users/agencies.

**Identity and authorization:** never accept `req.body.roleKey`, `roleId`, `agencyId`, `permissions`, `organizationId`, or `userId` as an authorization basis. Only explicitly allowed resource fields in strict Zod schemas may be stored after server-side scope checks. Never use `findByIdAndUpdate(req.params.id, req.body)` or `User.find({})` then client filter. Access tokens remain only in memory, refresh in existing HttpOnly cookie (correct path/flags), no localStorage/sessionStorage, no auto-replay of writes on auth refresh. In-flight admin fetches after logout/new login must not display the previous actor's PII.

**Design system:** national Sri Lankan flag-inspired palette — **Orange `#FF5B00`**, **Yellow `#FEB600`**, **Maroon `#8C1F28`**, **Green `#279541`** — used for actions/accent/status purposefully, not as excessive blocks. Use existing tokens, shadcn/ui, React Hook Form, Zod, TanStack Query, typography Manrope/Geist/Noto Sinhala/Noto Tamil already loaded; optional Sora/DM Sans only if already in repo/approved (do not introduce a font dependency or rewrite global styles). Responsive 320–1440px; contrast, accessible focus, labeled dialogs, tables, keyboard-only actions, reduced-motion, status announcements, safe loading/empty/403/404/409/503 states. UI translations drafts until native review. Public landing page unchanged.

**Performance:** page size limits 20 default/100 max (adjust only after source review); cursor or offset with deterministic sort; index inspection read-only. Reuse agency subtree helpers carefully with depth limit and correct status checks. Aggregate counts scoped in Mongo; no full tenant dump. Avoid broad refactors and endpoints not required for the step.

**Out of scope:** Step 50 role & permission **administration** UI (do not write it early), citizen registration Q-005, real email provider, SMS, impersonation, deleting accounts/agencies, project approval, finance, AI/RAG, storage, and public portal changes. This phase can read roles for authorized provisioning but may not edit `Role.permissions` or add an `agency.manage` grant through seed/role bypass.

---

## 6. Testing, review, and owner acceptance — exactly one final phase review

### Focused tests during each execution prompt

**Step 48:** identity 401/403/404/409/503; permission removed from Role mid-session; Super Admin and Government Admin permitted roles and tenant-scope matrix; self-target and last-admin protections; PENDING/verified rules; unsafe status/email/role/agency input; duplicate normalized email; temporary password secrecy; transaction rollback with audit; two concurrent disable/privileged updates; session epoch, login and refresh races; audit safe; Step 47 regression. Record failure as BLOCKED if isolated replica set unavailable.

**Step 49:** exact agency grant, across-ministry scope, parent inactive/missing/cyclic, active descendants, normal metadata update/version, duplicate immutable code, parallel reparent cycle, child/user/project dependencies, 409 deactivation, all-or-nothing audited transactions, update Step 48 selector, unauthorized read IDOR, response projection. No migration of Atlas.

### One final full phase review (not one after each step)

Run `npm run test:api`, `npm run test:web`, `npm run type-check`, `npm run lint`, `npm run build`, `git diff --check`, `git status --short` and focused tests for the two new modules and Steps 39–47 regressions. Review untracked source explicitly (`git diff` omits untracked). Record **actual** exit codes/test counts; no fabricated PASS. Fix verified defects and rerun affected/full suites. Self-review must disclose SAME-AGENT REVIEW; request independent human signoff separately for privileges.

**Browser:** use **only isolated synthetic users and disposable replica-set API**. On `/admin/users` and `/admin/agencies`, test seven-role matrix, 401/403, safe paginated lists, org scoping, create/PENDING, prohibited role escalation, disable revocation, stale edit conflict, hierarchy graph view, cyclic reparent rejection, blocked deactivation, mobile/table accessibility and error/retry. If onboarding email is unavailable, show honest BLOCKED; never pretend invite delivered. Check `/`, `/si`, `/ta`, `/about`, `/login`, `/dashboard`, `/profile`, `/settings`, `/forgot-password`, `/reset-password` for regression. Browser fixture ≠ live API E2E. Atlas authenticated tests remain blocked until a separate approval.

**Manual owner proof:**

1. Verify only one existing work folder and safe isolated API; compare GitHub/Step47 baseline and latest status.
2. Sign in as a synthetic Super Admin and Gov Admin, prove permitted/inaccessible user/agency lists and correct menu visibility; test unauthorized direct HTTP regardless of menu visibility.
3. Create PENDING staff member, show no email or token leaked, and demonstrate blocked activation if no provider.
4. Attempt cross-ministry user creation, promotion to SUPER_ADMIN and self-disable: deny; disable synthetic nonprivileged staff and prove old access/refresh fail after epoch change.
5. Edit agency safe fields; attempt duplicate code, A→B→A cycle, deactivation with active dependents and other-org ID: reject appropriately.
6. Verify audit append-only and safe record projection; display responsive EN/SI/TA drafts and regression public landing without editing it.
7. Owner signs off Step 48 then Step 49 independently, with one combined phase QA report and follow-up Git approval only afterward.

### Acceptance decision vocabulary

| Item | Necessary completion condition |
|---|---|
| Step 48 | Production-safe, RBAC/scoped user list/create/edit/lifecycle + audited revocation; unresolved email delivery honestly BLOCKED |
| Step 49 | Scoped agency read/create/metadata edit + safe hierarchy/deactivation; unsafe graph changes BLOCKED rather than bypassed |
| Regression | Existing authentication, profile, route guards, Steps 45–46 helpers and public pages preserved |
| Infrastructure | No unapproved Atlas index/seed/account mutation; isolated replica-set proof for atomic operations |
| UX | Accessible, responsive, EN/SI/TA draft, honest loading/error and permissions |
| Reporting | Every item PASS/FAIL/BLOCKED/NOT RUN, final APPROVE/REVISE/BLOCKED with residuals |

**A blocked critical operation must not be labeled complete.** A phase can be accepted as a *restricted foundation* only if the owner explicitly accepts those precise limitations.

---

## 7. Governance, Git and handoff

- Single checkout `C:\Users\ASUS\Desktop\InfraOS\InfraOS` only. **Never touch `Documents`**, create extra folders/worktrees, or edit the public Connected Future landing.
- Review `git status`, incoming branch tips and untracked files. New feature branch only if safe and **explicitly approved**; if Step 47 not integrated, stop for its owner gate. Do not assume pushing Step 47 feature equals merging it.
- One branch for Steps **48–49**, with implementation evidence per step and **one overall final testing prompt**. Cursor may use normal incremental edits, focused tests, and concise notes; do not generate dozens of execution prompts.
- No Git stage, commit, push, PR, merge, deletion, index creation, seeding or live production writes without distinct owner approval. After phase approval, *propose* selective staging for each step and commit message `feat(identity): add scoped administrative user management` / `feat(agencies): add governed agency management`, then separately request push approval, PR into `development`, review/merge authorization, and eventual separate promotion to `main`. Preserve `.env`, `Prompts/` and untracked unrelated files.
- Avoid unapproved modifications to a real email provider, `FRONTEND_ORIGIN`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `MONGODB_URI` and index `autoIndex`. Document existing env names by reading repo; never print secrets. No new API keys expected for CRUD; live activation mail needs provider decision.
- Keep docs minimal but complete: `docs/reviews/step-48/IMPLEMENTATION-STATUS.md`, `docs/reviews/step-49/IMPLEMENTATION-STATUS.md`, `docs/reviews/steps-48-49/END-OF-PHASE-VERIFICATION.md` (plus specific architecture note only if a new high-risk transaction or migration needs formal review).
- **Step 50 handoff:** Role and Permission administration. Reuse Step 48 admin/Role read and audit patterns but DO NOT ship role-permission editing in Step 48/49. Ensure no accidental ability to alter Role.permissions or increase a user's scope through agency reparent.

**Result of this request:** this document and its companion Cursor prompts only. No repo, database, Git branch, PR or account action was executed by ChatGPT.
