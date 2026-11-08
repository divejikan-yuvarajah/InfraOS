# INFRAOS — PHASE 9 · BATCH 04 (STEPS 92–94)
## Contractor Management · Profiles & Project History · Performance & Risk Indicators
### Claude Code implementation prompt — copy everything below into Claude Code from the repository root

---

## 0. ROLE AND MISSION

You are a senior full-stack engineer (Next.js/React, Express/Mongoose/MongoDB), financial-integrity-minded backend architect and UI/UX engineer working inside the existing **INFRAOS** monorepo. Implement **Batch 04 of Phase 9 — Steps 92–94** as one cohesive, production-quality change set:

| Step | Deliverable |
|---|---|
| 92 | **Contractor management**: registry/directory, registration, profile editing, status controls (activate / suspend / archive), duplicate detection, search + filters, certifications, regions, document references |
| 93 | **Contractor profiles & project association**: profile page, project assignment (primary/additional), reassignment/removal with preserved history, **project-history timeline** |
| 94 | **Performance & risk indicators**: explainable, evidence-based, rule-driven (no invented scores, no AI) |

This batch is the first of four in Phase 9 (Batch 05 finance, Batch 06 inspections/verification, Batch 07 assets/maintenance/coordination scores). **Do not build those now**, but build clean seams (§4.8) so they plug in without rewrites. Preserve the Batch 04–07 naming.

Deadline-driven university project: working functionality and a premium look beat breadth. **Every button, form, filter, table, chart, dialog and workflow action you render must really work.** No placeholder buttons, no fake charts, no mock figures presented as real data.

---

## 1. HARD RULES (non-negotiable)

1. **Inspect before you write.** Never invent paths, models, permissions, env vars or helpers. §2 is recon from the repo at the time of writing — re-verify everything you depend on.
2. **Reuse, don't duplicate.** One contractor model (extend it), one project model (extend only via the assignment seam), existing auth/RBAC/scope helpers, audit log, notification service, shared UI/forms/data-table, i18n, design tokens. No parallel registries.
3. **Server-side authorization only.** Every endpoint authenticated + permission-checked + agency-scoped. UI hiding is never security. Sensitive fields (contact, registration docs, contract values) are excluded **in the service projection**, not by the browser.
4. **Explainable, evidence-based indicators only.** If evidence is insufficient the UI says "Not enough evidence" — never a placeholder score, never a default "3.0 stars". Legacy cached fields (`rating`, `riskLevel`, `activeProjects`, `completedProjects`) are **not trusted** (§2) and are not displayed as facts.
5. **Money = integer LKR cents** via the existing `moneySchema` (`amountMinor`). No floats for authoritative amounts. Format with `Intl.NumberFormat` (LKR, locale-aware) for display only.
6. **History is never destroyed.** Assignments are ended/replaced, not deleted. Audit rows are written for every state change inside the same Mongo transaction as the change.
7. **No new dependencies**, no AI, no unrelated refactors, no package upgrades, no heavy test suites, no extra Markdown reports (≤ 12 lines appended to the existing `docs/database` page for the new collection is fine).
8. **Never touch `main` or `development` directly; never force-push.** Follow §10.
9. Read `apps/web/CLAUDE.md` / `AGENTS.md` first — this Next.js version has breaking changes; read the relevant guides in `apps/web/node_modules/next/dist/docs/` before writing Next code.
10. Match conventions: Conventional Commits, `success()/failure()` envelopes, `noStore`, strict zod query/body parsing (reject unknown + repeated keys), `requireAuthenticated` + `requirePermission`, `AuditLog.create` with safe snapshots, mongoose `strict: "throw"`, `useWorkspaceLocale()` + message dictionaries, `guard()/moved()` API client pattern.

---

## 2. RECON FINDINGS (state of the repo when this prompt was written — re-verify)

**Repo:** npm workspaces `apps/web` (Next 16, React 19, Tailwind 4, shadcn/radix, react-hook-form + zod, @tanstack/react-query, react-table, `next build --webpack`), `apps/api` (Express 5, Mongoose 8, zod 4, vitest + mongodb-memory-server), `packages/shared-types`. Node ≥ 22. Branch flow: feature branch → PR into `development` (squash) → `main` only for releases.

**Contractor today (`apps/api/src/modules/contractors/`):** only `contractor.constants.ts` + `models/contractor.model.ts` — **no routes, services, schemas, tests or web pages.**
- Model fields: `name` (≤200), `registrationNumber` (unique, uppercase, `/^[A-Z0-9][A-Z0-9/-]*$/`, ≤80), `contact {email, phone, address}`, `rating` (0–5), `activeProjects`, `completedProjects`, `riskLevel` (LOW|MEDIUM|HIGH), `status` (**only `ACTIVE | INACTIVE`**). `strict: "throw"`, timestamps, collection `contractors`.
- **No owning/registering agency, no specializations, regions, certifications, document refs, suspension reason, or normalized duplicate keys.** The model comments say the counters/rating are "optional caches… missing means unknown" — treat them as **legacy/unverified**.
- Enums are mirrored in `packages/shared-types/src/domain/enums.ts` (`CONTRACTOR_RISK_LEVELS`, `CONTRACTOR_STATUSES`) — update both.
- Demo seed `database/seeds/demo/seed-contractors.ts` creates 3 synthetic contractors (`SYNTH/ALPHA-001`, `…BETA…`, `…GAMMA…`) with hard-coded `rating/riskLevel/activeProjects/completedProjects`. Seeds run via `npm run db:seed:core|demo|verify|reset-demo`.

**Project link:** `Project.contractorId` (optional, single ref, index `{contractorId, status}`), `projectCode`, `title`, `agencyId`, `managerId`, `projectType`, `status` (DRAFT, SUBMITTED, UNDER_REVIEW, REJECTED, APPROVED, ACTIVE, ON_HOLD, DELAYED, COMPLETED, CANCELLED), `startDate`, `plannedEndDate`, `actualEndDate`, `budget` (moneySchema), `physicalProgress`, `financialProgress` (cache), `location`, `geometry`. There is a `projects/progress.policy.ts` (progress only accepted while ACTIVE), append-only `ProgressReport`, `Milestone` (statuses NOT_STARTED, IN_PROGRESS, COMPLETED, DELAYED, BLOCKED, CANCELLED), project lifecycle/transition services.

**Inspections (existing model, will be redesigned in Batch 06):** `inspections` collection: `projectId`, `inspectorId`, `inspectionDate`, optional `physicalProgress`, `status` (SCHEDULED, IN_PROGRESS, SUBMITTED, VERIFIED, REQUIRES_REVIEW, REJECTED, CANCELLED), `notes`, `evidence[]`. There are **no inspection routes/services yet**. Seeds may contain a few. Use this only through the evidence adapter (§4.6) so Batch 06 can swap/extend it.

**RBAC:** permissions already exist in `packages/shared-types/src/permissions.ts`: `contractor.read`, `contractor.manage`, `contractor.performance.read` (plus `project.read`, `project.update`, `finance.*`, `inspection.*`). Seed grants in `identity/seed/system-role-permissions.ts`: `contractor.manage` + `contractor.performance.read` → SUPER_ADMIN and GOV_ADMIN; `contractor.read` → also AGENCY_OFFICER, PROJECT_MANAGER, INSPECTOR, CONTRACTOR (verify each line). **Scope rules** in `identity/authorization/resource-scope.ts`: `resolveResourceScope(actor)` → `platform` (SUPER_ADMIN) | `agencies` (GOV_ADMIN = own agency + descendants; AGENCY_OFFICER/PROJECT_MANAGER = own agency) | `none` (CONTRACTOR, INSPECTOR, CITIZEN → denied; note "Contractor has no userId"). `projectReadFilter(scope)` / `projectWriteFilter(actor, scope)` are the project scope helpers. **There is no contractor portal and no user↔contractor link — do not invent one.** CONTRACTOR-role users stay denied on all new endpoints.

**Audit:** `modules/audit/models/audit-log.model.ts`; `AUDIT_RESOURCES` already includes `CONTRACTOR`; `action` must match `/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/`; snapshot sub-schema is an **allowlist** (`status`, `reason`, `agencyId`, `contractorId`, `amount`, `cost`, …) with `strict:"throw"` — use only allowed keys or extend the allowlist minimally and deliberately. Reference write pattern: `agencies/management/agency-management.service.ts` (`AuditLog.create([...], {session})`, `auditRequestId`, `mapMongoDuplicateField`, lifecycle lock model). Notifications: `modules/notifications/notice.service.ts` (`notifyCommittedAudit`) — read how other modules trigger notices after a committed audit and follow it.

**Web:** staff nav `components/auth/workspace-nav.ts` (items with `i18n:{si,ta}`); protected route segments `lib/auth/route-access.ts` — **`"contractors"` is already listed** (verify whether the segment is permission-gated or merely authenticated); UI primitives `components/ui` (badge, button, card, dialog, alert-dialog, select, sheet, tabs, tooltip, popover, table, form, input…), `components/forms/{fields,form-actions,form-error-summary}`, `components/data-table/*`, `components/feedback/*`, `components/layout/{page-container,page-header,breadcrumbs}`, `components/projects/*` and `lib/projects/*` (list-query, messages, create-schema patterns, `finance-summary.ts`), admin CRUD references `components/admin/admin-agencies-page-client.tsx` + `lib/admin-agencies/*`. No charting library is installed — **use small custom SVG/CSS visuals**.

**Phase 8 (InfraMap) may or may not be merged** at the time you run this. Batch 04 does not depend on it; link to `/inframap` only if the route exists (§5.9).

---

## 3. PREFLIGHT (report in ≤ 15 lines, then continue unless blocked)

1. `git fetch origin`; `git status` clean; show branch + `git log --oneline -5`; confirm `origin/development` exists (create it from `main` only if the repo's documented workflow says to).
2. `npm install` if needed; Node ≥ 22. Run the targeted baseline: `npm run type-check`, `npm run test:api -- projects` (or equivalent) and note **pre-existing** failures (list, don't fix).
3. Re-verify §2: open the contractor model, the project model, `resource-scope.ts`, `system-role-permissions.ts` (print the exact roles holding each contractor permission), `audit-log.model.ts` snapshot allowlist, the agency-management service (write pattern), `notice.service.ts` hook pattern, `workspace-nav.ts`, `route-access.ts`.
4. Read how existing project pages gate by permission and how list pages use `data-table` + `list-query` (copy the pattern for contractors).
5. Find every place that reads `Contractor.rating/riskLevel/activeProjects/completedProjects` or `Project.contractorId` (`grep`) so you don't break them; list them in the report.
6. Inspect demo seeds for projects that reference contractors; decide the backfill approach in §4.2.
7. Check for an existing form-field/`money` input helper and `Intl` LKR formatting helper in `lib/` (reuse).

---

## 4. DATA, DOMAIN AND BACKEND

### 4.1 Contractor model — minimal additive extension (same collection)

Edit `contractor.model.ts` / `contractor.constants.ts` / shared enums:
- `status`: **`ACTIVE | SUSPENDED | INACTIVE | ARCHIVED`** (keep `ACTIVE`/`INACTIVE`; add the two; update shared-types).
- `registeredByAgencyId` (ref Agency, **required for new records**, backfilled for existing ones — see below): the agency that registered/owns the record.
- `category` enum: `ROAD_CONSTRUCTION | BRIDGE_STRUCTURAL | WATER_SEWERAGE | ELECTRICAL | TELECOM | DRAINAGE | BUILDING | GENERAL | OTHER`; `specializations` (array of enums/short strings, ≤ 12); `operatingDistricts` (array of canonical Sri Lankan district names, ≤ 25 — validate against a small shared constant; reuse a district list if the repo has one, else add a minimal constant in shared-types and tell me).
- `contact` (extend): `contactPersonName`, `email`, `phone`, `address` (all optional, ≤ existing limits).
- `business`: `legalName?`, `taxId?` (optional, free text ≤ 40, **sensitive**), `registrationAuthority?` (e.g. "CIDA"), `cidaGrade?` (free text ≤ 20 — **do not invent grade lists**), `registeredOn?`.
- `certifications[]` (≤ 20): `{ _id, name, issuer?, referenceNumber?, issuedOn?, expiresOn?, status: "VALID"|"EXPIRED"|"REVOKED" (derived on read for VALID→EXPIRED; REVOKED set manually) }`.
- `documentRefs[]` (≤ 30): **references only, no files in this batch**: `{ _id, type (REGISTRATION|TAX|CERTIFICATE|CONTRACT|OTHER), title, referenceNumber?, documentId? (ref Document, optional), notes? }`. File upload is Batch 06's storage work; if `documentId` links to an existing `Document`, show only its title unless the viewer passes the existing document-read check — reuse `document.read` + document scope helpers, don't re-implement.
- `statusReason` (≤ 500), `statusChangedAt`, `statusChangedBy`, `archivedAt`.
- **Duplicate keys (server-owned):** `registrationNumberKey` (existing normalized value — keep the unique index on `registrationNumber`), `nameKey` (lowercase, punctuation/whitespace-collapsed, strip common suffix tokens like "pvt", "ltd", "(pvt) ltd", "limited", "co", "company"), `taxIdKey?`, `emailKey?`. Sparse unique index on `taxIdKey`; non-unique indexes on `nameKey` and `emailKey` used for **warnings**, not hard blocks.
- Keep the legacy `rating`, `riskLevel`, `activeProjects`, `completedProjects` fields **defined but unused by new code** (mark `@deprecated legacy cache` in a comment). Do **not** write to them. UI never displays them.
- Indexes: `{registeredByAgencyId:1,status:1}`, `{category:1,status:1}`, `{operatingDistricts:1}`, `{nameKey:1}`, `{"certifications.expiresOn":1}`; add to `scripts/check-indexes.ts`; run `npm run db:indexes:check`.
- **Backfill (idempotent script `scripts/backfill-contractors-batch04.ts` + npm script `db:backfill:contractors`):** for existing contractors set `registeredByAgencyId` = the agency of the earliest project referencing them (else leave unset and treat as **platform-registered**, visible per §4.3), compute keys. Dry-run by default; `--commit` to write. Never invents data.

### 4.2 `contractorAssignments` — the only new collection (project↔contractor association)

`apps/api/src/modules/contractors/models/contractor-assignment.model.ts`, collection `contractorAssignments`, `strict:"throw"`, timestamps:
- `projectId`, `contractorId`, `agencyId` (denormalised from project for scoping/indexing), `role`: `PRIMARY | ADDITIONAL`, `status`: `ACTIVE | ENDED | REPLACED | TERMINATED`, `contractReference?` (≤ 80), `contractValue?` (`moneySchema`), `startDate` (required), `endDate?` (≥ start, via `dateOrder`), `endReason?` (required when leaving ACTIVE), `assignedBy`, `endedBy?`, `replacedByAssignmentId?`, `notes?`.
- **Rules:** at most **one ACTIVE PRIMARY per project** (partial unique index `{projectId:1}` where `role:"PRIMARY", status:"ACTIVE"`); a contractor can't have two ACTIVE assignments on the same project (partial unique `{projectId:1, contractorId:1}` where `status:"ACTIVE"`); ADDITIONAL contractors allowed (subcontractor/joint partner) — **do not assume one contractor per project**. Indexes: `{contractorId:1,status:1,startDate:-1}`, `{agencyId:1,status:1}`.
- **`Project.contractorId` stays** as a denormalised pointer to the **current ACTIVE PRIMARY** contractor. It is updated **only** by the assignment service, inside the same transaction. Existing readers keep working.
- **Backfill (same script):** for each project with `contractorId` and no assignment → create an `ACTIVE` (or `ENDED` if project is COMPLETED/CANCELLED) PRIMARY assignment (`startDate` = project `startDate` ?? `createdAt`; `contractReference`/`contractValue` unset — never invented), idempotent.

### 4.3 Visibility and field-level access (implement as pure, unit-tested functions in `contractor.access.ts`)

- **Who can see a contractor record:** platform scope → all. Agency scopes → contractors where `registeredByAgencyId ∈ scope agencies` **OR** the contractor has an assignment (any status) on a project in scope (so an agency can see contractors working on its projects even if another agency registered them). Platform-registered (no agency) contractors are visible to anyone with `contractor.read` **only if** assigned in scope, or to platform. CONTRACTOR / INSPECTOR / CITIZEN scope `none` ⇒ deny (inspectors may later see assigned-inspection contractors via Batch 06 — not now).
- **Field tiers** (single function `projectContractor(viewer, doc)`): 
  - *Directory tier* (anyone with `contractor.read` in visibility): name, registrationNumber, status, category, specializations, operating districts, agency name, certification **status counts** (valid/expiring/expired), no contact, no tax ID, no contract values, no documentRefs.
  - *Manage tier* (`contractor.manage` **and** the contractor is registered by an in-scope agency, or platform): + full contact, business details, certifications, documentRefs, status reason/history.
  - *Performance tier* (`contractor.performance.read`): + performance/risk indicators (§4.6) and the evidence behind them.
  - *Contract values* in assignments are shown only to holders of `contractor.manage` **or** `finance.budget.read` within project scope.
- Projects listed in history/assignments are filtered with `projectReadFilter(scope)` — an out-of-scope project never appears (not even its title); aggregate counts are computed **only** over in-scope projects and the UI says so ("Based on projects you can access").
- Out-of-scope contractor id → **404** (never 403) to avoid existence leaks.

### 4.4 Endpoints (NEW; mount at `/api/v1/contractors` in `routes/v1.ts`)

All: `requireAuthenticated` + permission check; strict zod (unknown/repeated keys → 400); `noStore`; envelopes; rate limiters like neighbouring routers (tighter on mutations); mutations run in a Mongo transaction with the `AuditLog` row and (where it makes sense) a notice via the established hook; never return stack traces.

| Method + path | Permission | Purpose |
|---|---|---|
| `GET /contractors` | `contractor.read` | Directory list. Query: `q`, `status` (CSV), `category`, `district`, `agencyId`, `riskBand` (needs performance perm), `certExpiringDays` (30/60/90), `hasActiveProjects`, `sort` (`name|registeredAt|activeProjects|risk`), `page`, `limit` (≤ 50). Returns rows (directory tier) + facet counts for status/category. |
| `GET /contractors/summary` | `contractor.read` | Dashboard numbers: counts by status/category, expiring certifications (≤ 30 days / expired), contractors without evidence, top-5 attention list (performance perm only). All scoped. |
| `GET /contractors/duplicate-check` | `contractor.manage` | Live pre-check: `registrationNumber?`, `name?`, `taxId?`, `email?`, `excludeId?` → `{ exact: [...], possible: [...] }` (directory-tier projection of matches **within visibility**; plus a boolean `existsOutsideScope` when an exact registration number belongs to an invisible record, **without revealing any detail**). |
| `POST /contractors` | `contractor.manage` | Register. Server computes keys, sets `registeredByAgencyId` from the actor's agency (platform admin may pass `agencyId`). Exact registration-number duplicate → 409 `CONFLICT` via `mapMongoDuplicateField`; "possible duplicate" (same `nameKey` or `taxIdKey`/`emailKey` hit) → require `confirmNotDuplicate: true` + a `duplicateAcknowledgement` note (≥ 12 chars) else 409 with the match list. Audit `contractor.registered`. |
| `GET /contractors/:id` | `contractor.read` | Profile (tier-projected). |
| `PATCH /contractors/:id` | `contractor.manage` | Edit profile fields (allowlist; `registrationNumber` immutable after first assignment unless platform admin with reason). Optimistic concurrency via `version`/`updatedAt` precondition (`If-Match` or body `expectedUpdatedAt`) → 409 on stale. Audit `contractor.updated` with changed-field **names** only (no values for sensitive fields). |
| `POST /contractors/:id/status` | `contractor.manage` | Transition `ACTIVE ⇄ SUSPENDED`, `ACTIVE/SUSPENDED → INACTIVE`, `INACTIVE → ACTIVE`, `* → ARCHIVED` (archive requires **no ACTIVE assignments**; suspension/inactivation with ACTIVE assignments is allowed but returns an `impact` list and requires `acknowledgeImpact:true`); `reason` (≥ 12 chars) required for SUSPENDED/INACTIVE/ARCHIVED; ARCHIVED → ACTIVE only by platform admin. Audit `contractor.status_changed`. A SUSPENDED/INACTIVE/ARCHIVED contractor **cannot receive new assignments**. |
| `POST /contractors/:id/certifications` · `PATCH/DELETE …/:certId` | `contractor.manage` | Manage certifications (delete = soft: mark REVOKED requires reason; hard delete not allowed once referenced by audit). |
| `POST /contractors/:id/documents` · `DELETE …/:refId` | `contractor.manage` | Manage document **references** (not files). |
| `GET /contractors/:id/assignments` | `contractor.read` | Assignment history (in-scope projects only), paginated; each row: project code/title/status/agency/location text, role, status, dates, contract ref, contract value (tiered), end reason. |
| `POST /projects/:projectId/contractors` | `contractor.manage` **+** `projectWriteFilter` scope on the project | Assign contractor (role PRIMARY|ADDITIONAL, startDate, contractReference?, contractValue?, notes?). Preconditions: contractor `ACTIVE` and visible; project in a state that allows assignment (**verify against `lifecycle.policy.ts`; default: not COMPLETED/CANCELLED/REJECTED**); no duplicate ACTIVE pair; assigning PRIMARY when one exists → 409 with `requiresReassignment:true` (the UI then offers the reassign flow). Updates `Project.contractorId` for PRIMARY. Audit `contractor.assigned` (+ `project` context). |
| `POST /projects/:projectId/contractors/:assignmentId/end` | same | End assignment: `status` (`ENDED|TERMINATED`), `endDate`, `endReason` (≥ 12 chars). If it was PRIMARY → `Project.contractorId` cleared (or promoted only if the caller explicitly names a new primary in the same request). Audit `contractor.assignment_ended`. |
| `POST /projects/:projectId/contractors/:assignmentId/reassign` | same | Atomic replace: ends current as `REPLACED` (with reason + `replacedByAssignmentId`) and creates the new assignment (same role) — one transaction; preserves history. Audit `contractor.reassigned`. |
| `GET /projects/:projectId/contractors` | `project.read` (project scope) + `contractor.read` | Contractors on a project (directory tier; values tiered). Used by the project overview page. |
| `GET /contractors/:id/performance` | `contractor.performance.read` | Indicators + risk flags + **evidence list** (§4.6). |
| `GET /contractors/:id/timeline` | `contractor.read` | Merged chronological events (registered, status changes, certifications added/expiring/expired, assignments start/end/reassign, project completions/delays, inspection outcomes if any) from `AuditLog` + assignments + evidence adapter, cursor-paginated. |

Mutation-hardening: all writes re-check permission + live scope inside the transaction (see `assertLive` in `roadsync/work-requests.service.ts` and the agency-management lifecycle lock for reference); idempotency via the unique/partial indexes; duplicate-key → friendly 409.

**Project integration (small, additive):** extend the existing project detail response/overview to include a read-only `contractors` summary (names + roles + status) **only by calling the new service** (don't copy logic). Keep `PATCH /projects/:id` unable to set `contractorId` directly (verify; if it currently can, route that through the assignment service or reject it — flag this in the report).

### 4.5 Notifications (reuse, minimal)
Emit in-app notices through the existing notification service for: contractor suspended/archived (to agency admins with assignments), assignment created/ended (to the project manager), certification expiring within 30 days (computed on read in `/summary`; **no cron** — surface as a dashboard alert and a notice created lazily at most once per certification per 7 days if the existing notice dedupe supports it; otherwise skip notices and keep the dashboard alert only — say which you did).

### 4.6 Performance & risk indicators (Step 94) — the core of this batch

Create `contractor-performance.service.ts` + `contractor-evidence.ts` (adapter) + `contractor-performance.rules.ts` (pure, fully unit-tested, constants in one place).

**Evidence adapter** returns plain, typed rows for a contractor over in-scope projects only; Batch 05/06/07 will extend it (add financial and verified-inspection sources) without touching the rules:
- `assignments` (this batch) → completed vs ended/terminated vs active.
- `projects` via assignments: `status`, `plannedEndDate`, `actualEndDate`, `startDate`, `physicalProgress` (cached), `financialProgress` (cache — **not used now**).
- `milestones`: statuses, planned vs actual dates (check the milestone model for fields) → delayed/blocked counts.
- `inspections`: counts by status for the contractor's projects **within the assignment window** — currently the model lacks a result/defect structure, so only coarse outcomes are usable (VERIFIED, REJECTED, REQUIRES_REVIEW). Mark `source:"inspection.v1"`; Batch 06 replaces it.
- `progressReports`: **claimed** progress history (append-only); used only for the "unverified progress claims" rule and clearly labelled *claimed*, never *verified*.

**Indicators (each returns `{ key, value|null, unit, sampleSize, minSample, status: "OK"|"INSUFFICIENT_EVIDENCE", formulaKey, inputs }`):**
1. **Completion reliability** = completed ÷ (completed + terminated) over assignments that have ended (`COMPLETED` project status counts as completed; `TERMINATED`/project `CANCELLED` due to contractor-terminated assignment counts as not completed). Min sample: 3.
2. **Schedule adherence** = share of **completed** projects with `actualEndDate ≤ plannedEndDate` (+ average delay days among late ones). Min sample: 3 completed projects with both dates.
3. **Current delay exposure** = number of ACTIVE assignments whose project status is `DELAYED` or whose `plannedEndDate` has passed while not COMPLETED. (Not a ratio; a count with the project list.)
4. **Milestone timeliness** = completed milestones on or before planned date ÷ completed milestones with planned date (in-scope projects). Min sample: 5.
5. **Inspection outcome rate** = VERIFIED ÷ (VERIFIED + REJECTED + REQUIRES_REVIEW) on concluded inspections. Min sample: 3. Until Batch 06 lands the label is "Coarse (v1)".
6. **Unverified progress claims** = ACTIVE-project reports where claimed physical progress exceeds the latest *inspection-verified* progress by > 10 percentage points. **Insufficient evidence until verified inspection progress exists** — this will usually render "Not enough evidence" in Batch 04; that is correct.
7. **Contract data completeness** = proportion of ACTIVE assignments with `contractReference` + `contractValue` present, and profile completeness (certifications present, contact present, registration authority present).
8. Outputs **never** include a single magic "overall score". Instead an **Evidence Level** (`NONE | LOW | MODERATE | GOOD`) based on how many indicators have sufficient samples, shown beside every card ("Based on 6 projects · 14 milestones"). An optional **Reliability band** (`STRONG | MIXED | WEAK`) is shown **only when ≥ 3 of indicators 1–5 have sufficient evidence**, computed by transparent thresholds in the rules file (e.g. STRONG if all available ≥ 85%, WEAK if any available < 60% or ≥ 2 below 70%; document thresholds in one comment) and always accompanied by the "why" breakdown. Otherwise band = `NOT_ENOUGH_EVIDENCE`.

**Risk flags (rule-based, each with code, severity, human-readable reason, evidence refs, `since`):**
`REPEATED_DELAYS` (≥ 2 delayed/late projects in the last 24 months), `ACTIVE_DELAY` (any active delayed assignment), `FAILED_INSPECTIONS` (≥ 2 REJECTED in 12 months, or the latest concluded is REJECTED), `UNRESOLVED_QUALITY` (REQUIRES_REVIEW older than 30 days), `UNVERIFIED_CLAIMS` (rule 6 hit), `CERT_EXPIRED` / `CERT_EXPIRING_30D`, `INCOMPLETE_CONTRACT_DATA` (ACTIVE assignment without reference/value, or missing required profile fields), `SUSPENDED_WITH_ACTIVE_WORK`, `TERMINATED_ASSIGNMENT_RECENT` (< 12 months). Severity LOW/MEDIUM/HIGH defined in the rules file. **Rework frequency** and **quality findings counts** are explicitly **deferred to Batch 06** (no data yet): show them as greyed "Available after inspections are recorded" rows — not as zeros.

**Computation strategy:** compute **on read** (bounded: assignments ≤ 500, `maxTimeMS`), with a small in-memory TTL cache (60 s, keyed by contractor + scope signature — never share across scopes). No writes to legacy cache fields. A `GET /contractors/summary` risk distribution must reuse the same pure rules over a capped batch (≤ 200 contractors) and state when it's truncated.

### 4.7 Audit snapshots and actions
Use only allowlisted snapshot keys (`status`, `reason`, `agencyId`, `contractorId`, `cost`/`amount` for contract value). If you must add keys, extend the allowlist **minimally** with a clear comment. Never store contact data, tax IDs or request bodies in audit rows. Actions: `contractor.registered|updated|status_changed|certification_added|certification_updated|certification_revoked|document_ref_added|document_ref_removed|assigned|assignment_ended|reassigned`.

### 4.8 Seams for later batches (document in code comments only)
- `contractor-evidence.ts` is the single place where finance (Batch 05: payments, overspend), inspections (Batch 06: results, defects, rework) and asset handover (Batch 07) evidence is added.
- `ContractorAssignment` is the join other batches reference (payments → `assignmentId`; inspections → `projectId` + assignment window).
- The performance rules file exports `RULE_VERSION` ("c1") so future rule changes are traceable.

### 4.9 Seeds (small, clearly synthetic)
Extend `seed-contractors.ts`: keep the 3 synthetic contractors (names remain "(Synthetic)"), **remove hard-coded `rating/riskLevel/activeProjects/completedProjects` from the seed** (or leave undefined) and add `registeredByAgencyId`, `category`, districts, 1–2 certifications each (one **expiring in ~20 days**, one expired for demo), and a few **assignments** against existing demo projects (≥ 1 ACTIVE PRIMARY, ≥ 1 ENDED, one ADDITIONAL, one REPLACED chain) so the timeline and indicators have real inputs. Don't fabricate inspections/milestones — if the demo data lacks enough evidence the UI shows "Not enough evidence", which is a valid demo of honesty. If a minimal, plainly-labelled demo set of completed projects is needed to showcase indicators, add **at most 4** `[DEMO]` completed projects with planned/actual dates **through existing seed helpers**, never touching real records. Extend `reset-demo.ts` and `verify-demo.ts` for assignments. Seeds idempotent.

---

## 5. FRONTEND

### 5.1 Routes and navigation
`apps/web/src/app/contractors/{page.tsx, new/page.tsx, [id]/page.tsx, [id]/edit/page.tsx}` (server wrappers with metadata + client components under `components/contractors/`). Add **Contractors** (Building2/HardHat icon, `i18n` si/ta) to `components/auth/workspace-nav.ts`, visible only when the viewer holds `contractor.read` (follow how other items gate); active-state handling; `route-access.ts` already has the segment — add/adjust the permission gate and its test. Project record pages get a **Contractors** panel in the overview (read-only list + "Assign contractor" button for permitted users) and a `Contractors` tab only if the existing `project-record-tabs` pattern makes that natural.

Files (adapt names to conventions): `components/contractors/{contractors-page-client,contractor-directory-table,contractor-filters,contractor-dashboard-strip,contractor-form,contractor-profile-client,contractor-status-dialog,duplicate-check-panel,certifications-panel,document-refs-panel,assign-contractor-dialog,reassign-wizard,end-assignment-dialog,assignment-timeline,project-history-table,performance-cards,risk-flags-panel,evidence-drawer,contractor-badges}.tsx`; `lib/contractors/{api.ts,types.ts,list-query.ts,schema.ts,messages.ts,view.ts,format.ts}` (+ small `*.test.ts` for pure helpers).

### 5.2 Premium UI/UX specification

**Contractors dashboard + directory (`/contractors`):**
- Header (`page-header`): title, scope chip ("Your agency & sub-agencies" / "National"), primary **Register contractor** button (only with `contractor.manage`).
- **Insight strip** (4 cards, skeleton while loading, from `/summary`): *Active contractors* · *Suspended / inactive* · *Certifications expiring ≤ 30 d / expired* (click applies the filter) · *Needs attention* (risk flags HIGH; hidden without performance permission). Each card is a working filter shortcut.
- **Filter bar:** search (debounced), status multi-select chips, category, district (searchable), agency (platform/GOV_ADMIN), "Has active projects", certification-expiry select, risk band (performance perm). Applied-chips row with Clear all; URL query-string state (shareable, `router.replace`); server-side filtering/sorting/pagination.
- **Directory table** (existing `data-table`): avatar-initials tile, name + registration no. (copy button), category + specializations (+N tooltip), districts, **status badge** (icon + text, not colour-only), active projects count, certification health chip (✔ valid / ⏳ expiring / ✖ expired), **evidence meter** (4-segment bar + label) and **reliability band** chip (performance perm only; "Not enough evidence" otherwise), row actions menu (View, Edit, Assign to project, Suspend/Activate, Archive — each only if allowed and each opening a real dialog/page). Row click opens profile. Empty state ("No contractors match" + Clear filters / Register), error state with Retry.
- **Mobile (<640 px):** table becomes a **card list** (name, status, category, cert chip, actions sheet); filters in a bottom `sheet`; sticky FAB "Register" for managers; 44 px targets.

**Register / edit form (`/contractors/new`, `/[id]/edit`) — multi-step (Basics → Contact & business → Certifications & documents → Review):**
- react-hook-form + zod schema mirrored from the server; inline validation; step indicator; draft kept in-memory while navigating steps; unsaved-changes guard.
- **Live duplicate panel** (the "unique function" for Step 92): as the user types registration number / name / tax ID / email (debounced ~400 ms), call `/duplicate-check`; show **Exact match** (blocks submit with a link to the existing record if visible, or "A contractor with this registration number already exists outside your access" if not) and **Possible matches** (cards with similarity reason; requires ticking "These are different companies" + a note to proceed). Fully functional end-to-end with the server rule in §4.4.
- Registration number helper (auto-uppercase, pattern hint), district multi-select with "Select all in province" (use canonical list), certification rows (add/remove, date validation), document-reference rows. Review step shows a clean summary; Submit shows pending/disabled state; success → toast + navigate to the profile; server field errors map onto fields.
- Edit form uses optimistic-concurrency token; stale → friendly "This record changed — reload" dialog with a Reload action.

**Contractor profile (`/contractors/[id]`):**
- **Hero header:** initials tile, name, registration no., status badge, category, agency, district chips; action buttons (Edit, Assign to project, Suspend/Reactivate, Archive — real dialogs; reason ≥ 12 chars; impact list for suspension with active work; focus-trapped; Escape closes).
- **Tabs:** *Overview · Projects · Performance · Compliance · Activity*.
  - **Overview:** business details, contact (manage tier only; others see "Contact details are restricted"), operating regions, specializations, registration/CIDA info, completeness meter.
  - **Projects (project history):** segmented control Active / Completed / All; **timeline** (vertical, grouped by year) *and* table toggle; each item: project code + title (links to `/projects/[id]/overview`), responsible agency, location text (+ "View on map" link to `/inframap?...` **only if that route exists**), role badge (Primary/Additional), dates (start → planned/actual), delay days chip, project status, contract reference/value (tiered, formatted LKR), end reason, inspection outcome chip (coarse). Replaced/terminated assignments show a connector to their successor. Out-of-scope projects aren't listed and a footnote says counts reflect accessible projects only.
  - **Performance:** indicator cards (value, sample size, "Not enough evidence" empty-meter state when `INSUFFICIENT_EVIDENCE`, formula tooltip "How is this calculated?"), **Evidence Level** gauge, optional **Reliability band** with "Why this band" breakdown, small custom **SVG sparkline/bars** for schedule adherence over time and a **delay-days distribution** (only when ≥ 3 data points; else nothing is drawn). A greyed "Available after inspections (Batch 06)" strip for rework/quality counts. Only visible with `contractor.performance.read`.
  - **Compliance:** certifications table (status badges, expiry countdown, add/edit/revoke dialogs), document references (add/remove), **Risk flags panel** — each flag card: severity icon + label (not colour-only), plain-language reason, "Evidence" button opening the **Evidence drawer** (list of the underlying projects/milestones/inspections with deep links), `since` date.
  - **Activity:** audit-backed timeline (registered, edits (field names), status changes with reasons, assignments, reassignments, certifications) with actor name, relative + absolute time (locale-aware), cursor "Load more".
- **Assignment dialogs:** *Assign* (project search-select limited to in-scope assignable projects, role, start date, contract ref, contract value in LKR with cents-safe input, notes; blocks inactive contractors; PRIMARY conflict → switches to the reassign wizard); *Reassign wizard* (3 steps: choose assignment → choose replacement contractor (directory search, active only) with **impact preview** (open milestones, active payments placeholder removed—show only existing data) → reason + effective date → confirm); *End assignment* (reason, date, ended vs terminated).
- **Project overview integration:** "Contractors" card on the project page with real Assign/Reassign/End actions per permission.

**Visual language:** reuse tokens (`lib/design`), clean surfaces, 8-pt rhythm, tabular numerals for money/counts, subtle transitions (≤ 200 ms, respect `prefers-reduced-motion`), skeletons for every async region, status never by colour alone (icon + label), visible focus rings, `aria-label`s, `aria-live` for filter result counts, dialogs trap focus, tables keyboard accessible, contrast verified with the existing contrast helpers.

### 5.3 i18n
Complete `en/si/ta` dictionaries for **every** new string (nav, titles, statuses, categories, specializations, regions UI, form labels/hints/errors, indicators + formula tooltips, risk flag labels/reasons templates, empty/error/forbidden states, aria-labels, dialog copy). Use `useWorkspaceLocale()`; locale-aware dates (`date-fns` locales) and LKR via `Intl`. **Never translate stored data** (names, registration numbers, agency names). Reuse existing Sinhala/Tamil terminology already in the app; flag uncertain translations in the report. Verify long Sinhala/Tamil strings wrap/truncate with tooltips (no clipped buttons/chips).

### 5.4 API client
`lib/contractors/api.ts` follows the `guard()/moved()` epoch pattern; React Query keys include filters; mutations invalidate precisely (directory, summary, profile, assignments, project contractors). Stable error mapping to field errors/toasts. No secrets, no sensitive data in query strings/logs.

---

## 6. AUTONOMOUS SELF-HEALING LOOP (applies to this whole batch)

Run this loop at every ✔ checkpoint in §7 and again before the final push:

1. **Implement** the checkpoint.
2. **Run the essential checks** for what you touched: `npm run type-check` (api/web), `npm run lint` (touched workspaces), the relevant vitest files (`contractors.*`, plus projects/roadsync tests if you touched shared code), `npm run db:indexes:check` (when indexes changed), `npm run db:seed:demo` + `db:seed:verify` (when seeds changed), and at the end `npm run build:web`.
3. **Identify failures** precisely (first error, file:line, root-cause hypothesis). Re-run only the failing command to confirm.
4. **Fix the root cause** — never by deleting/skipping/weakening tests, adding `eslint-disable`/`@ts-ignore`/`any` to silence errors, loosening security checks, or special-casing test data. If a *pre-existing* failure (present at baseline) blocks you, list it and work around it narrowly.
5. **Re-run** the checks. **Max 3 repair iterations per distinct failure.** If still failing, **stop that thread**, record it under "Unresolved" with the error text, the hypotheses tried and what you need from me — do not loop further and **never hide or downplay** unresolved errors or flaky behaviour.
6. After all critical checks are green, do a final **self-review pass** against §9 (what must not happen) before committing.
7. Keep a running ≤ 10-line "check log" for the final report (command → pass/fail → fix applied).

---

## 7. IMPLEMENTATION SEQUENCE (commit at each ✔; don't advance until the checks for it are green)

1. Preflight + branch (§3, §10).
2. **Data layer:** contractor model/enums extension, shared-types, `contractorAssignments` model, indexes (+ `check-indexes`), pure `contractor.access.ts` + `contractor-performance.rules.ts` skeletons, backfill script. ✔
3. **Contractor service + routes** (directory, summary, duplicate-check, register, profile, patch, status, certifications, document refs) with transactions, audit and field tiers; mount in `v1.ts`. ✔
4. **Assignment service + routes** (assign, end, reassign, project contractors list, assignments history, timeline), project pointer sync, lifecycle guards. ✔
5. **Performance service**: evidence adapter, rules, `/performance`, summary risk distribution, TTL cache. ✔
6. **Seeds + reset/verify** updates. ✔
7. **Frontend foundation:** routes, nav, API client, types, messages (en/si/ta skeleton), list-query, shared badges/formatters. ✔
8. **Directory + dashboard strip + filters** (Step 92 UI), mobile card list. ✔
9. **Register/edit multi-step form** with live duplicate panel and status dialogs. ✔
10. **Profile page**: overview, compliance (certifications, documents), activity, assignment dialogs + reassign wizard, project overview "Contractors" card. ✔
11. **Projects tab/timeline** (Step 93 UI) and **performance tab + risk flags + evidence drawer** (Step 94 UI). ✔
12. i18n completion (si/ta), responsive + a11y pass (375/768/1280), visual polish. ✔
13. Final verification (§8), self-healing loop, cleanup, push, PR text. ✔

---

## 8. ESSENTIAL VERIFICATION ONLY

**Automated (small; existing vitest patterns; mongodb-memory-server for API):**
- **Access/tier pure tests:** visibility matrix (platform / GOV_ADMIN with descendants / AGENCY_OFFICER / PROJECT_MANAGER / CONTRACTOR / INSPECTOR / CITIZEN); directory vs manage vs performance tier projections strip contact/taxId/documentRefs/contract values as specified; out-of-scope id → 404.
- **API:** register happy path + audit row; exact registration-number duplicate → 409; possible-duplicate requires acknowledgement; duplicate-check never leaks out-of-scope detail; status transitions (illegal ones rejected; archive blocked with ACTIVE assignments; suspended contractor can't be assigned); assign PRIMARY → `Project.contractorId` set; second PRIMARY → 409 `requiresReassignment`; reassign is atomic (simulate failure mid-transaction → nothing changes); end assignment preserves history; stale `expectedUpdatedAt` → 409; cross-agency user cannot assign on another agency's project; unknown/repeated query keys → 400; sensitive fields absent from list responses; audit snapshots contain only allowlisted keys.
- **Rules (pure):** each indicator with sufficient/insufficient samples (zero-sample → `INSUFFICIENT_EVIDENCE`, never 0%); thresholds boundary cases; reliability band only when ≥ 3 indicators sufficient; every risk flag has a positive and negative case; cache keyed per scope (no cross-scope leakage).
- **Web pure tests:** list-query ⇄ URL round-trip; zod schema vs server constraints; formatters (LKR cents → display, no float drift: e.g. 1 999 999 cents); i18n dictionaries have identical key sets for en/si/ta.
- Run: `npm run type-check`, `npm run lint`, `npm run test:api`, `npm run test:web`, `npm run build:web`, `npm run db:indexes:check`, `npm run db:seed:demo`, `npm run db:seed:verify`, backfill script in dry-run **and** commit modes on demo data. List pre-existing failures without fixing them.

**Manual (state outcomes in the report):**
1. Sign in as platform admin, GOV_ADMIN, AGENCY_OFFICER, PROJECT_MANAGER, CONTRACTOR-role user, and a user from a different agency.
2. Directory: filters/search/sort/pagination are server-side (check query strings); insight cards act as filters; empty/error states; mobile card list at 375 px.
3. Register: live duplicate panel (exact, possible, outside-scope message); step navigation; field errors; success redirect; audit entry visible in Activity.
4. Profile: restricted vs manage-tier fields for different users; status dialogs (suspension impact list, reason validation); certifications add/edit/revoke; document references.
5. Assignments: assign primary, add additional, attempt second primary (reassign flow), end, reassign — timeline and project overview update; `Project.contractorId` stays consistent; history preserved.
6. Performance: with seed evidence indicators show values + sample sizes; low-evidence contractors show "Not enough evidence" (no fabricated numbers); formula tooltips; evidence drawer rows deep-link to projects; risk flags appear/disappear according to rules (e.g. expiring certification flag).
7. en/si/ta switch; keyboard-only pass through form, dialogs, tabs; reduced-motion respected.
8. Existing project pages, RoadSync and (if merged) InfraMap behave exactly as before.

---

## 9. WHAT MUST NOT HAPPEN (self-check before pushing)
- A control that renders but does nothing, a dead link, or "coming soon" UI.
- Contact details, tax IDs, document refs, contract values or out-of-scope projects reaching a user without the right permission/scope.
- A made-up rating/score/zero where evidence is missing; legacy `rating`/`riskLevel` shown as truth.
- Direct edits to `Project.contractorId` outside the assignment service; deleted assignments; non-transactional multi-document writes.
- Float arithmetic on money; money shown without LKR formatting.
- New dependencies, AI features, secrets, committed real contractor data.
- Weakened/skipped tests or lint rules to get green; hidden unresolved errors.
- Colour-only status; hover-only mobile affordances; tap targets < 44 px on phones.

---

## 10. GITHUB WORKFLOW

- **Base:** `development` (per `CONTRIBUTING.md`). If Phase 8 branches/PRs are still unmerged this batch does **not** depend on them — branch from `development` regardless, and tell me in the preflight whether `/inframap` exists.
- **Branch:** `feature/contractor-management` (adapt to repo convention; recent examples: `feature/phase7-roadsync-steps-72-73`).
- **Commits (Conventional Commits, one per ✔):**
  1. `feat(contractors): extend contractor model, add assignments collection, access rules and backfill (Steps 92-93 data)`
  2. `feat(contractors): registry, duplicate detection, profile, status and certification APIs (Step 92)`
  3. `feat(contractors): project assignment, reassignment and history APIs (Step 93)`
  4. `feat(contractors): explainable performance and risk indicators (Step 94)`
  5. `chore(seed): contractor demo data, assignments and verification`
  6. `feat(contractors): directory, dashboard strip, filters and mobile card list (Step 92 UI)`
  7. `feat(contractors): multi-step registration form with live duplicate check and status dialogs`
  8. `feat(contractors): profile, assignment dialogs, reassign wizard and project overview card (Step 93 UI)`
  9. `feat(contractors): project history timeline, performance cards, risk flags and evidence drawer (Steps 93-94 UI)`
  10. `feat(contractors): si/ta copy, responsive and accessibility polish`
  11. `test(contractors): access tiers, assignment integrity and performance rules`
- Before each commit: type-check + lint touched workspaces. Never commit `.env*`, secrets, real contractor data or `node_modules`.
- **Push:** `git push -u origin feature/contractor-management` (no force). **Do not merge.** Open a PR into `development` (squash expected): title `feat(contractors): Phase 9 Batch 04 — contractor management, project history, performance & risk (Steps 92–94)`; body = what shipped per step, new endpoints, new collection + indexes, permissions used, tier/visibility rules, backfill instructions, verification results (incl. the self-healing check log), known gaps, items needing my decision. If you can't open the PR, give me the exact title/body.

---

## 11. COMPLETION CRITERIA (all must be true)

- [ ] **Step 92:** contractor registry with registration, edit, status management (activate/suspend/inactivate/archive with reasons + impact checks), search + server-side filters, certifications, regions, specializations, document references, **duplicate detection (exact block + possible-match acknowledgement + live panel)**; contact/tax/documents restricted by tier.
- [ ] **Step 93:** profile page; assign primary/additional contractors with contract reference/value; end/terminate/reassign atomically; **history preserved**; `Project.contractorId` kept consistent by the assignment service only; project-history timeline + table with in-scope-only data; project overview contractors card.
- [ ] **Step 94:** indicators 1–7 implemented per §4.6 with sample sizes, `INSUFFICIENT_EVIDENCE` handling, Evidence Level, optional reliability band, risk flags with plain-language reasons + evidence drawer; **no fabricated scores**; rework/quality counts honestly marked as deferred to Batch 06.
- [ ] All endpoints: authenticated, permission-checked, scope-checked in the transaction, strictly validated, rate-limited, `no-store`, audited, 404 for invisible records; no sensitive field leaks.
- [ ] UI: premium dashboard/directory/profile, multi-step form, dialogs, timeline, SVG visuals — **all functional**; responsive at 375/768/1280; keyboard + reduced-motion handled; en/si/ta complete.
- [ ] Seeds idempotent with reset/verify support; backfill script dry-run/commit works; legacy cache fields unused.
- [ ] No new dependencies, no duplicate registries, RoadSync/ProjectTrace/(InfraMap) behaviour unchanged.
- [ ] Self-healing loop executed; all critical checks green or explicitly listed as **Unresolved** with details; branch pushed; PR text ready.

---

## 12. FINAL REPORT (short)

(1) Preflight findings and deviations from §2 (incl. who holds each contractor permission, whether `/inframap` exists, and every place that reads legacy contractor cache fields or `Project.contractorId`); (2) what shipped per step (92/93/94) incl. the unique functions (live duplicate panel, reassign wizard with impact preview, explainable evidence drawer, certification-expiry watch); (3) endpoints, collection, indexes, enum/permission/allowlist changes; (4) decisions I need to confirm: contractor visibility rule (registering agency **or** assigned-in-scope), whether `PATCH /projects/:id` could previously set `contractorId`, project states allowed for assignment, reliability thresholds; (5) verification results + the self-healing check log + any **Unresolved** items; (6) uncertain translations; (7) **Batch 05 handoff notes**: assignment model + ids to reference from payments, the money helpers/formatters to reuse, the evidence adapter extension points for finance, the audit snapshot keys available for finance (`amount`, `cost`, `budget`), permission grants for `finance.*` per role (print the matrix), the project `financialProgress`/`physicalProgress` cache semantics, and the UI patterns/components (insight strip, filter bar, status badges, dialogs, evidence drawer) the finance module should reuse for consistent UX.

Stop after the report. Do not start Batch 05.
