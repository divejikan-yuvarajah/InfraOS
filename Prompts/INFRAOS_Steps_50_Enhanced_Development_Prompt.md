# INFRAOS — Step 50 of 190: Role & Permission Administration
## Enhanced Development Specification · 25 October 2026

**Platform:** INFRAOS — National Infrastructure Intelligence & Coordination Platform  
**Vision:** *The Operating System for National Infrastructure*  
**Scope:** **Step 50 only**, closing the Identity/RBAC administrative foundation  
**Source:** `divejikan-yuvarajah/InfraOS`; latest verified `development` `9d3ef4ef8b824`, `main` `fa542147e8c93` (recheck before Cursor runs)  
**Only local checkout:** `C:\Users\ASUS\Desktop\InfraOS\InfraOS`  
**Candidate shared feature branch:** `feature/identity-governance` (reuse an already-approved compatible branch if present; never make extra worktrees)  
**Review:** Security-critical. Suggested Cursor model: **Grok 4.7** for implementation and final review; a different human/agent reviewer is preferable to a same-agent re-read.

> **Roadmap provenance:** The INFRAOS Steps 15–50 planning index identifies **Step 50 — Role & permission administration**. The original `Steps.docx` is not mounted in this session; earlier Cursor handoffs found a local untracked copy in `Prompts/`. Cursor must read that file **read-only** if available, record any discrepancy, and never move/edit/add it to Git. The detailed API/UI proposals below are implementation design, **not claimed verbatim roadmap wording**. If the original requirement contradicts a locked Step 4 authorization policy, stop and request an explicit owner policy decision before expanding authority.

---

## 1. Verified repository baseline and previous-step gate

### 1.1 What is on GitHub now

| Reference | Verified snapshot | Implication |
|---|---|---|
| `development` | `9d3ef4ef8b824` — merge PR #83 from `main` | Contains merged Steps 47–49 |
| `main` | `fa542147e8c93` — merge PR #82 from `development` | Contains Steps 47–49 stable snapshot |
| Steps 48–49 commits | `02f0b62` admin users; `32b193f` agency governance | Reuse, do not rebuild |
| Open PRs | None observed when checked | Not evidence of a clean Windows checkout |

Read current Git state and compare with the remote. The GitHub observations above are a **point-in-time snapshot**, not a directive to checkout or reset.

### 1.2 Previous implementation contract

- **Steps 35–44:** login/refresh/logout/password recovery, active verified user checks, live-role and agency checks, `credentialEpoch`-bound access-token validation, private Next.js guard.
- **Step 45:** `apps/api/src/modules/identity/authorization/require-permission.ts` checks *current MongoDB `Role.permissions`* for exact permission code; JWT, body, role name and seed defaults confer no grants. `['*']` confers none. Role lookup unavailable → 503.
- **Step 46:** `resource-scope.ts` applies server-owned scope/assignment/IDOR filters. Super Admin is not an operational approval bypass; platform operational **read** only where locked policy grants it.
- **Step 47:** `/profile` and `/settings`, protected self-service name edits; not an admin permission editor.
- **Step 48:** `/api/v1/admin/users` list/detail/provision/name updates/disable-enable/assignment with explicit role constraints, `AdminLifecycleLock`, atomic session revocation and append-only audit. Roles are **one primary role per user**. No public staff registration.
- **Step 49:** `/api/v1/admin/agencies` directory/governance, parent-cycle checks, hierarchy lock, mutation audits. Agency governance is still Super Admin only in endpoints even though the original `GOV_ADMIN` seed contains `agency.manage`.
- **Steps 48–49 completion note:** `docs/reviews/steps-48-49/END-OF-PHASE-VERIFICATION.md` is a **SAME-AGENT REVIEW** and a **LIMITED FOUNDATION**, not human signoff. At that snapshot: API 283 tests, web 137 tests, types/lint/build PASS; signed-in browser administration NOT RUN; staff activation email BLOCKED; null-agency Super Admin login BLOCKED. The report was written before the later Git integration. Verify its current status, do not mislabel gaps as resolved.

### 1.3 Actual code and locked documents to inspect

- `packages/shared-types/src/permissions.ts`: locked `PERMISSION_CATALOG`, `isPermission`, `Permission`.
- `apps/api/src/modules/identity/models/role.model.ts`: `key` immutable, one of seven `SYSTEM_ROLE_KEYS`; `permissions` unique catalog array, `scopeType`, `isSystem`, `isActive`; timestamps and internal `__v`.
- `apps/api/src/modules/identity/seed/system-role-permissions.ts`: explicit seed grants; **seed is a bootstrap reference, not request-time authority nor an unconditional safe-to-grant list**.
- `apps/api/src/modules/identity/admin-users/{admin-user.service,admin-lifecycle-lock.model}.ts`: existing privilege checks and `USER_LIFECYCLE_LOCK`.
- `apps/api/src/modules/agencies/management/agency-management.service.ts`: transaction, hierarchy safeguards, append-only audit pattern.
- `apps/api/src/modules/audit/models/audit-log.model.ts`: append-only `USER`, `ROLE`, `AGENCY` event types, redacted `permissions` snapshot support, request ID; no audit write bypass.
- `apps/api/src/modules/identity/auth/require-authenticated.ts`, `authorization/require-permission.ts`, `apps/api/src/routes/v1.ts`.
- `apps/web/src/components/auth/{route-access-guard,staff-workspace-shell}.tsx`, `apps/web/src/app/admin/{users,agencies}`, admin API client/state/copy.
- **Locked policy:** `docs/security/{roles-and-permissions,permission-catalog,permission-matrix,resource-authorization,route-access-policy}.md`; `docs/adr/ADR-007-rbac-resource-authorization.md`, `docs/planning/business-rules.md`.

**Important discrepancy to preserve/resolve, not hide:** A seed can list a capability whose product route is intentionally role-denied (e.g. `GOV_ADMIN` has `agency.manage`, but Step 49 management routes still restrict writes to `SUPER_ADMIN`; `SUPER_ADMIN` seed includes an operational `citizen_issue.close` grant). Step 50 must not assume every seed key is safe for every role/action. Role, scope, business-state and segregation-of-duties protections remain cumulative. Record disagreements as a policy-discrepancy register; do **not** silently rewrite locked policy or convert seed grants into overrides.

---

## 2. Product scope and non-goals

**Deliver a functioning role and permission governance workspace** where approved administrators can inspect the seven fixed roles, examine the locked catalog and **safely edit permitted role grant subsets** with transaction-safe audit and concurrent-write protection.

### Step 50 includes

1. Read-only catalog of exactly the established, typed `resource.action` permission codes with human-readable module groups and descriptions.
2. Role list/detail showing code, display name, description, scope, system/active status, **safe current grant list**, role revision and optional current user count. Avoid showing staff PII or agency records unnecessarily.
3. Super Admin-only role metadata update (name, description; code immutable).
4. Super Admin-only controlled role-permission update, using the *current Mongo row* and a **server-enforced maximum permission policy** that cannot expand into forbidden authority. For high-risk policy ambiguities, implement read-only display and report a blocked mutation instead of granting powers.
5. Immediate next-request permission enforcement through the existing Step 45 middleware; confirm live role reads rather than JWT/session claims.
6. Safe update validation, optimistic concurrency/versioning, append-only audit in one replica-set transaction, read-only user interface for Government Admin if granted, private app navigation and EN/SI/TA accessible copy.
7. Focused API, concurrency, security, UI and phase regression tests; one final combined review.

### Strict non-goals

- **No creation of an eighth role**, custom roles, free-text permission definitions, deleting a locked role, role-key rename, changing `scopeType`/`isSystem`/`isActive` through public admin APIs, or public permission-catalog mutation.
- **No self-service** role/permission change or automatic promotion; Step 48 alone handles staff role assignment and its credential/session revocation.
- No user impersonation, silent privilege recovery, blanket wildcard `*`, `*.*`, elevation via body/JWT/seed, per-user permissions, multi-role accounts, cross-ministry access expansion or live Atlas changes.
- No new vendor, queues, second auth stack, Redis, custom policy engine (Cedar/Zanzibar), or rewrite of Step 48/49 endpoints.
- No creation of RoadSync, GIS, ProjectTrace or future admin system-settings APIs merely to demonstrate a permission checkbox.

---

## 3. Security governance policy — authoritative decisions

### 3.1 Roles and actions

Existing seven roles: `SUPER_ADMIN`, `GOV_ADMIN`, `AGENCY_OFFICER`, `PROJECT_MANAGER`, `CONTRACTOR`, `INSPECTOR`, `CITIZEN`; **one primary role per user**.

| Actor | Roles list/detail | Catalog read | Metadata edit | Grant edit | Add/delete role or permission code |
|---|---|---|---|---|---|
| SUPER_ADMIN | Requires live `role.read` | Requires live `permission.read` | Live `role.manage` + exact role key check | **Both** live `role.manage` and `permission.manage`; policy ceiling and lock | **Denied** |
| GOV_ADMIN | Requires live `role.read`, limited public-safe DTO | Requires live `permission.read` | Denied even if injected grants | Denied even if injected grants | Denied |
| All other roles | Denied even if caller/role has forged or injected catalog grant | Denied | Denied | Denied | Denied |

If owner interprets `permission.manage` differently, record the decision before implementing any catalog mutations; this step's **safe default** uses it to govern *assignments of existing catalog permissions only*, not adding/removing catalog keys.

`requireAuthenticated` must precede the exact permission middleware. Also perform role-key/eligibility checks and a live permission re-read **inside** the mutation's Mongo transaction, preventing a stale outer-middleware grant from being accepted unchecked. Backend decisions alone govern; frontend hiding is not authorization.

### 3.2 Server-authoritative permitted grant ceiling

Build an **explicit, typed, reviewable policy** mapping each system role to permissions it may hold, aligned with Step 4 matrix and business rules. Do not infer authority from the editing Super Admin's own grant list; do not allow a non-privileged role to obtain IAM/approval powers just because the string exists in `PERMISSION_CATALOG`. Ensure at minimum:

- `SUPER_ADMIN`: IAM/governance, audit, platform read/support; **not** project approval, payment approval, inspection verification, conflict resolve, user impersonation or normal operational acts forbidden by locked policy.
- `GOV_ADMIN`: operational approvals and organization governance **only within valid ministry scope and SoD checks**; never platform role/permission mutation.
- `AGENCY_OFFICER`, `PROJECT_MANAGER`: agency/assigned-project constraints; no cross-ministry role/security admin or financial payment approval.
- `CONTRACTOR`, `INSPECTOR`, `CITIZEN`: no elevation to admin or unrelated agency, project or finance actions.

The **locked** `SYSTEM_ROLE_PERMISSIONS` can be used to flag pre-existing expected permissions, but is **not sufficient by itself** as a safe ceiling because some seeded entries and route semantics diverge. Define a mechanically testable role-specific maximum by reconciling the locked permission matrix and business rules, and document any exceptions. If reconciliation would change locked policy, record it as **BLOCKED** and only expose a read-only editor for the affected role; do not guess or silently change permission seeds/docs. When a current role has grants outside a proposed ceiling, never normalize/purge them as an incidental side effect; report them for an explicit remediation decision.

Do not allow a request to edit `permissions` and also change `scopeType`, `key`, `isActive`, `isSystem`, role ownership or user assignment. Reject entire invalid payload, never silently strip fields. Strict validation should reject malformed/unrecognized codes, duplicates, wildcards, proto pollution, oversized arrays and unauthorized extensions.

### 3.3 Preserve governance continuity and concurrency

Permission edits can immediately lock out administrators. **Never** approve changes that would remove required governance grants from the last operable Super Admin; also protect against two concurrent admins independently removing each other's effective governance capability. Use the existing `USER_LIFECYCLE_LOCK` or a clearly reconciled shared governance lock **inside a replica-set transaction**, consistent with Step 48 user disable/assignment, and check a **real, eligible, active, verified, sign-in-capable Super Admin** remains able to administer roles after commit.

**Critical existing blocker:** a platform `SUPER_ADMIN` with `agencyId=null` is not eligible for current `requireAuthenticated`; Step 48 notes that a new such account cannot sign in. Counting an unloginable Super Admin as a safety anchor is invalid. Do not silently change Step 44's sign-in or Step 48 provisioning policy; use a valid currently eligible fixture for tests, record the remaining bootstrap policy gap.

Guard concurrent role updates with `revision` (Mongoose `__v`/version) compare-and-swap **and** governance lock. One of two writes with the same version should return 409; no partial audit; demonstrate a failed audit write rolls back the changed role. Model or lifecycle-lock new indexes are **not** permitted on Atlas without separate approval. If transactions are unavailable, **BLOCKED**; no fallback that changes grants without atomic audit and safety checks.

Check `isActive`, `scopeType`, `roleKey`, caller eligibility and current grants again in the transaction. Role permission change takes effect on following requests because Step 45 fetches the role for each request; do not claim invalidation of an already in-flight action unless that service also revalidates permission in its transaction. Test this boundary and disclose honestly. Whether to revoke all member sessions for grant changes is an **explicit policy decision**; don't gratuitously change `credentialEpoch` for every role without the owner's approval and an atomic revocation plan. At minimum, require live role reads to reject the next protected request after grant removal.

### 3.4 Audit guarantees

Append-only `AuditLog` entries for role metadata/grant mutation, with actor ID, role resource ID, action, request ID and **redacted, catalog-valid old/new permission code snapshots** and safe metadata where supported. `AUDIT_RESOURCES` already includes `ROLE`. Avoid storing secrets/headers, passwords, tokens, arbitrary request bodies, raw user lists or unbounded arrays. Choose action names compatible with existing `auditLogSchema` and confirm length/match rules.

**Role update and corresponding audit must commit in the same transaction**; audit failure aborts the role change. Never rely on a Pino log as proof of a durable audit. Check that read endpoints do not leak audit internal snapshots or other tenants' data.

---

## 4. Detailed backend/API contract

### 4.1 Proposed routes (adapt paths to inspected source, do not duplicate existing routes)

Mount one `adminRoleRouter` at `/api/v1/admin` or narrower verified path from `apps/api/src/routes/v1.ts`:

| Method | Path | Middleware/actor guard | Response |
|---|---|---|---|
| `GET` | `/api/v1/admin/roles` | Auth + live `role.read`; allow only Super/Gov Admin | 200 list of seven known roles (or active existing rows, report anomalies) |
| `GET` | `/api/v1/admin/roles/:id` | Auth + `role.read`; Super/Gov | 200 safe role DTO |
| `GET` | `/api/v1/admin/permissions` | Auth + `permission.read`; Super/Gov | 200 readonly catalog, grouped |
| `PATCH` | `/api/v1/admin/roles/:id` | Auth + `role.manage`; Super only; live in-txn check | 200 updated safe role DTO |
| `PUT` | `/api/v1/admin/roles/:id/permissions` | Auth + **both** `role.manage` and `permission.manage`; Super only | 200 safe role DTO after audited CAS |

Avoid `POST /roles`, DELETE role, public catalog PATCH, wildcard route, or arbitrary `/:id/users` update. Other clients/roles receive correct 401/403/404, no data leak. Existing auth/agency/user routes remain unchanged.

### 4.2 Safe DTOs and example bodies

```ts
type RoleSummaryDto = {
  id: string;
  key: SystemRoleKey;
  name: string;
  description: string;
  scopeType: ScopeType;
  isSystem: true;
  isActive: boolean;
  permissions: Permission[]; // ONLY via authorized role.read read DTO
  revision: number;
  assignedUserCount?: number;
};
```

`GET /admin/permissions` returns only catalog keys and neutral descriptions/groups from trusted code, not current secret settings or any user's grants. Do not return all Role DB rows with internal identifiers unfiltered; validate `key` and known system roles.

Metadata body: `{ "name": "Agency Officer", "description": "...", "revision": 4 }` (strict). Grant body: `{ "permissions": ["profile.read", "project.read"], "revision": 4, "reason": "Approved access adjustment" }` (strict; reason length bounded and safe to audit, do not include free-text secrets). **These examples are illustrative, not a requested policy change.** Test safe deny case: an actor cannot set a lower role to `role.manage`, `permission.manage`, `finance.payment.approve`, `inspection.verify` or other out-of-role capabilities. Restoring valid previously removed grants is permissible only within the reviewed role ceiling.

Server should validate `reason` when material privilege changes and show a human-impact warning; optional read-only preview of add/remove diff in the UI. A no-op should not create fake audit “changed” events; define exact no-op behavior and test it. Unknown/missing system-role rows, inactive roles, malformed ids, revision mismatch must have predictable non-leaking responses.

### 4.3 Error contracts

- `401` unauthenticated, stale credential epoch, disabled/unverified/ineligible identity.
- `403` valid actor lacks a required live grant, role is not allowed, or proposed grant violates locked safety policy. Avoid revealing other role details.
- `400` invalid id/body, unsupported permission name, duplicate codes, wildcard, unauthorized field, unsupported role revision or invalid reason.
- `404` well-formed unknown role id; do not enumerate private resources to disallowed users.
- `409` stale revision, governance lock/contention/last-admin violation, forbidden governance-state transition, or policy conflict (document exact mapping).
- `415` non-JSON update content.
- `429` reasonable mutation rate limit under established middleware where available; do not invent API infrastructure if no compatible limiter.
- `503` DB/transaction/auth dependency unavailable; **no write**.

Follow `success(data, req.requestId)` / `failure(code, safeMessage, req.requestId)` and `Cache-Control: no-store`. Use Mongoose validated updates, allowed fields only and robust body size limits. Never trust `actor` copied from body or query. List/pagination (max size) and sort by fixed known fields to avoid unbounded scans; seven roles don't need a heavy search engine.

### 4.4 Suggested implementation structure

```text
apps/api/src/modules/identity/admin-roles/
  admin-role.schema.ts
  admin-role.types.ts
  admin-role.policy.ts
  admin-role.service.ts
  admin-role.routes.ts
apps/api/src/routes/v1.ts                     // single minimal mount
apps/api/tests/admin-roles.test.ts            // isolated Supertest + Mongo replica set
apps/web/src/app/admin/roles/page.tsx         // private page, no SSR PII
apps/web/src/components/admin/admin-roles-page-client.tsx
apps/web/src/lib/admin-roles/{api,types,schema,messages}.ts
apps/web/src/components/auth/staff-workspace-shell.tsx // minimal nav link
apps/web/src/styles/auth-access.css            // private styles only as required
docs/reviews/step-50/{PRE-IMPLEMENTATION-AUDIT,END-OF-STEP-VERIFICATION}.md
```

Do **not** add indexes, collections or third-party libraries for this step unless specifically justified and approved. Prefer reusing `AdminLifecycleLock` and append-only audit. Recheck Mongo version behavior when calling transactions on isolated tests.

---

## 5. Frontend specification — premium but truthful admin UX

Build `/admin/roles` under the existing private `RouteAccessGuard` and staff workspace shell, not a new authentication or sidebar framework. The page must show **real API-backed** role and permission data. Provide list/detail, permission matrix grouped by domain, clear read-only vs editing state, revision/conflict affordance, semantic statuses and review-before-save of additions/removals. No phantom frontend permission grants; role edits go through live protected backend only.

- **Super Admin:** editable permitted fields only, gated by server and UI; explicit consequences, confirmation and reason for grant changes; 409 conflict reload; 503 retry, invalid selection explanation, save success only after real 200.
- **Government Admin:** read-only role/catalog views when live `role.read` or `permission.read` allows; no edit controls even if a malformed role grant appears. Avoid tenant-specific user counts beyond scope; prefer omit counts unless secure scoping is implemented.
- **Others:** 403 access denied, not a blank/unprotected role listing.
- **Keyboard/mobile:** search or filter groups, semantically labeled checkboxes, group headings, focus-visible states, no color-only indicators, clear disabled explanations, safe confirmation modal, screen reader updates, cancel/reload path, good 320/360/390/768/1024/1440 behavior.
- **EN/SI/TA:** draft localized copy for labels, group descriptions, warnings, error/success/empty/loading states; no claim of native-speaker signoff. Use current language-selection idiom; **don't invent `/si/admin/roles` or `/ta/admin/roles` until route guard protects them**.
- **Theme:** institutional neutrals plus `#FF5B00` primary orange, `#FEB600` pending yellow, `#8C1F28` critical maroon, `#279541` success green. Accessible contrast, Sora/DM Sans/Noto Sinhala/Tamil established fonts and tested focus styling; use existing Tailwind/shadcn.
- **Private data:** don't expose actual role permissions/calls in initial SSR HTML when unauthenticated. Access JWT remains in memory, no localStorage/sessionStorage. Clear stale data on logout or user switch, and do not auto-replay role PATCH/PUT mutations after 401. Safe GET may refresh once as existing `apiClient` already permits.

Only update `staff-workspace-shell.tsx` and internal styles when needed. Public Connected Future homepage and `/si` `/ta` public content are OUT OF SCOPE, including their pre-existing mobile overflow concerns. Never touch `Documents`.

---

## 6. Build order, dependency gate and efficient workflow

This is **one complete implementation prompt**, followed by **one final overall test/review prompt** — no per-subtask Cursor execution prompts.

1. **Preflight:** Inspect original `Steps.docx` read-only if locally available, latest Git branch/status and untracked changes, merged Step 48/49 code/docs, current tests, permission-policy inconsistencies, and authorized isolated Mongo environment. No Git mutation without owner approval. If checkout is dirty, stop unsafe checkout/reset/stash.
2. **Design policy first:** produce concise current grant-versus-ceiling matrix and explicit blocked/dangerous combinations, explain `role.manage` and `permission.manage`, sign-in eligibility of any counted Super Admin, lock strategy and audited commit guarantee. Don't broaden immutable roles or role scopes.
3. **Implement backend:** safe read endpoints, governed mutation endpoints, current DB permission double-check, role-key allowlist, strict Zod, CAS/lock, atomic role+audit, no insecure fallback. Add focused tests as part of same step.
4. **Implement frontend:** real role/permission UI and read-only governance states, reused shell and current auth/API client, responsive/accessible EN/SI/TA draft copy, error/loading/409 handling.
5. **Essential checks during build:** focused new API/web tests, targeted type-check/lint, repair real defects; do not run repeated full-suite passes after every small edit.
6. **Handoff:** concise Step 50 preflight/implementation status with evidence, deviations/blockers; wait for **one** end-of-step phase testing/review prompt.

A single feature-based branch for Step 50 is appropriate (`feature/identity-governance`); do not create step directories outside existing checkout, worktrees or extra branches. No cherry-picking, commits, pushes, PRs, merges, destructive Git operations or Atlas changes without **separate explicit owner approval**. Development → main requires new release approval after integration.

---

## 7. Testing matrix: automated, security, concurrency, UI

### Backend / isolation

| ID | Case | Required outcome |
|---|---|---|
| S50-01 | No/invalid/expired/stale-epoch token | 401; no governance data |
| S50-02 | Super Admin has current `role.read`, `permission.read` | Authorized exact catalog/role DTOs |
| S50-03 | Gov Admin read-only with live grants | 200 reads, 403 any mutation |
| S50-04 | Officer/PM/Contractor/Inspector/Citizen with injected role grants | Denied by explicit actor-role check |
| S50-05 | Remove `role.manage` or `permission.manage` live | Mutation immediately denied on next request |
| S50-06 | Missing one of two grants for changing role permissions | 403, no mutation |
| S50-07 | Non-catalog/duplicate/wildcard/invalid payload | 400; no stored effect |
| S50-08 | Attempt to add role, change key/scope/isSystem/isActive, delete or change catalog | 400/404/405 as appropriate; none changed |
| S50-09 | Attempt grant `finance.payment.approve` to Contractor or `project.approve` to Super Admin | 403/409; no elevation |
| S50-10 | Valid permitted metadata update with current revision | 200 + updated role DTO, audit |
| S50-11 | Valid constrained permission grant adjustment | 200 + exact set, append-only audit |
| S50-12 | Two concurrent PATCH/PUT same role revision | Exactly one 200; one 409; one durable audit |
| S50-13 | Last effective Super Admin loses governance grants / two admins race | Block or serialize so >=1 valid admin remains |
| S50-14 | Audit hook throws within transaction | Role grant and audit rolled back, not partially changed |
| S50-15 | Mongo not replica set / transaction disabled | BLOCKED/503; no unsafe nontransactional write |
| S50-16 | Existing users' role permission read after grant revoked | Next protected request sees removal; no auth bypass |
| S50-17 | Deactivate/disable/assign concurrent with role mutation (Step48 lock) | No last-admin or stale-authority bypass |
| S50-18 | Read-only user counts (if present) | No cross-ministry personnel leakage |
| S50-19 | Absent/corrupt/inactive Role row | Fail closed; no silent seeding/backfill |
| S50-20 | Existing Steps 39–49 API routes and grant/scoping rules | Regression PASS |

### Frontend / accessibility / privacy

Check signed-out `/admin/roles` SSR/guard, Super Admin edit and save, Gov Admin readonly, forbidden-role 403, loading/empty/error/503, stale 409/refresh, permission removal while editing, logout/account switch with outstanding reads and writes, form injection, mobile width sweep, keyboard-only checkbox/table/confirm interactions, EN/SI/TA copy, focus/error announcements and reduced-motion. An in-memory fixture is not a live API/browser demonstration. Ensure no JWT or permission list is persisted in Web Storage, or emitted in public SSR HTML.

### Full phase verification commands (only once after implementation; rerun on fixes)

```powershell
npm run test:api
npm run test:web
npm run type-check
npm run lint
npm run build
git diff --check
git status --short
```

`git diff --check` misses new untracked files, so audit them explicitly. Record real counts, exit status, pre-existing warnings and any BLOCKED/NOT RUN steps. Use disposable local Mongo **replica set**, not Atlas, and never start an API pointed at Atlas while index proposals are unapproved.

---

## 8. Acceptance and owner demonstration

### Definitive acceptance criteria

- The seven role keys, their `scopeType` and the catalog remain locked/immutable; no extra role or permission code can be added through the product.
- Legitimate administrators can read actual Role grants and catalog, with current DB grants and actor role gating; Government Admin can only read.
- Super Admin can edit only reviewable permitted role metadata and **safe, locked-policy-compliant** grant sets; disallowed privilege escalation is blocked even if an API caller forges headers/body or reuses stale tokens.
- Last effective Super Admin and governance continuity protected under concurrency; role update and audit atomic; stale revision 409.
- Existing login, refresh, logout, profile, user/agency admin and authorization behavior unaffected.
- Real UI works on private route with EN/SI/TA draft copy, responsive/a11y/error UX, and safe auth client cache and mutations.
- Tests and final report disclose known limitations, including no live email, null-agency platform login constraint, and policy inconsistencies; no Atlas migration or unapproved Git changes.

### Owner demo (isolated test environment only)

1. Confirm database host is disposable isolated Mongo replica set; do not start `dev:api` against Atlas.
2. Synthetic eligible Super Admin signs in and opens `/admin/roles`, sees exactly seven fixed roles and the current grant list, plus readonly catalog.
3. Make a permitted role-description change; verify save/audit and page refresh persistence.
4. Remove a **permitted, noncritical** permission from a synthetic role; verify the next protected request returns 403. Restore it only under allowed ceiling and audit; do not use an unreviewed privileged grant as an example.
5. Attempt `project.approve` on Super Admin and `role.manage` on a Contractor; verify rejected. Attempt `key`, `scopeType`, `isActive`, catalog injection; verify denied.
6. Submit two revisions concurrently; expect only one success. Induce audit failure; expect complete rollback. Try removing all effective Super Admin governance grants; expect fail closed.
7. Gov Admin sees readonly role/catalog; officer cannot enumerate roles. Logout/back reveals no cached grants, and signed-in replacement user cannot see previous data.
8. Mobile 320/390/768/1440, EN/SI/TA and keyboard walkthrough. Confirm landing `/`, `/si`, `/ta` remains unchanged.

**Honesty of evidence:** if a signed-in synthetic isolated API session cannot be run safely, mark browser demonstration **NOT RUN/BLOCKED**, not PASS. A same-agent re-read must say **SAME-AGENT REVIEW**, not independent human signoff.

---

## 9. Required review artifacts, release gates and Step 51 handoff

Create only concise, meaningful documentation in `docs/reviews/step-50/`:

- `PRE-IMPLEMENTATION-AUDIT.md`: repo state, original-roadmap reconciliation, previously approved dependencies and policy discrepancy table.
- `END-OF-STEP-VERIFICATION.md`: changed/untracked file manifest, API contract, role policy matrix, test results/counters, audit/transaction proof, browser/manual evidence and statuses, risks, reviewer attribution and decision `APPROVE` / `REVISE` / `BLOCKED`.

Do not create redundant per-phase execution files or verbose duplicate reports. Update API contract docs only for real new endpoints. Never edit source of original `Steps.docx` or the `Documents` folder.

**Git gate:** after owner signs off, propose explicit scoped `git add` of Step 50 files (never `git add .`), a single `feat(identity): add governed role and permission administration` commit (only if separately approved), then **separate** approvals for push, PR into `development`, PR merge, and later promotion of `development` to `main`. Prompt files, `.env`, `Steps.docx`, private fixture credentials and unrelated work are excluded. No branch/commit/push/PR/merge done merely because tests pass.

**Step 51 handoff:** Only after Step 50 approval and integration, begin subsequent ProjectTrace roadmap steps. RBAC grant changes must never bypass project owner/agency scope, workflow state, or SoD; do not implement Step 51 here.

**End of development specification. This document does not authorize or perform code or Git changes.**
