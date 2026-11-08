# INFRAOS — PHASE 9 · BATCH 07 (STEPS 103–107) — FINAL BATCH OF PHASE 9
## Infrastructure Asset Lifecycle: Project→Asset Conversion · Asset Management · Condition Monitoring · Maintenance · Explainable Health Indicators · Agency Coordination Insights · Final Integration Review
### Claude Code implementation prompt — copy everything below into Claude Code from the repository root

---

## 0. ROLE AND MISSION

You are a senior full-stack engineer (Next.js/React, Express/Mongoose/MongoDB), an infrastructure-asset-management domain engineer and a premium-UI engineer working inside the existing **INFRAOS** monorepo. Implement **Batch 07 of Phase 9 — Steps 103–107** and then run the **Phase 9 Final Integration Review**:

| Step | Deliverable |
|---|---|
| 103 | **Project → asset conversion**: eligibility gates, handover capture, maker–checker approval, asset registration with full traceability, duplicate-conversion prevention |
| 104 | **Asset management**: directory, asset passport/profile, ownership, operational status, lifecycle timeline, agency scope, **InfraMap integration** |
| 105 | **Condition monitoring + maintenance**: periodic condition assessments (inspection-verified or manual), history, deterioration/critical flags; maintenance request → plan → schedule → execute → complete, preventive recurrence, overdue monitoring, evidence, cost |
| 106 | **Infrastructure health indicators**: transparent, rule-based, evidence-gated (no score without evidence) with component breakdown |
| 107 | **Agency coordination insights**: a fair, explainable presentation of the **existing RoadSync agency scorecards** (not a new scoring engine) |

This closes the lifecycle: **Contractor → Finance → Inspection → Verified Progress → Approval → Asset → Condition → Maintenance → Health → Coordination.** Batches 04–06 already built contractors, finance and inspections/verification. **Reuse their outputs; do not duplicate them.** After the build, run the **Final Integration Review (§9)** across all of Phase 9.

Deadline-driven university project: **working functionality and a perfect, modern look beat breadth.** Every button, form, filter, table, chart, wizard step, approval and dialog must really work. No placeholder buttons, no fake charts, no mock data presented as real, no fabricated scores.

---

## 1. HARD RULES (non-negotiable)

1. **Inspect before you write.** Never invent paths, models, permissions or helpers. §2 is recon at the time of writing — re-verify everything you depend on.
2. **Reuse, don't duplicate.** Extend the existing `Asset` and `MaintenanceRecord` models; reuse Batch 06 inspections/evidence/calendar/upload/gallery, Batch 05 money helpers/gates/dialogs, Batch 04 contractors/assignments, Phase 8 InfraMap asset layer + access policy, RoadSync dashboard scorecards, audit log, notices, scope helpers, shared UI/forms/data-table, i18n, tokens. No second asset registry, no second evidence system, no new coordination-scoring engine.
3. **Server-side authorization only**, agency-scoped, permission-checked **inside** transactions. UI hiding is never security.
4. **Preserve the project.** Conversion never replaces, edits or re-states the project: it creates linked asset records and a conversion record; the project stays COMPLETED with all history intact.
5. **No score without evidence.** Health, trend and coordination values are computed only from recorded evidence with stated minimum samples; otherwise the UI says "Not enough evidence". Legacy unverified fields are never presented as verified facts.
6. **Maintenance does not auto-improve condition.** Completing maintenance records work done and may *reduce* "outstanding maintenance" penalties; **condition changes only through a condition assessment.**
7. **Coordination scores are decision support, not rankings or judgments.** Reuse RoadSync's own definitions, minimum-case rules and cohort-size rules; never rank agencies that lack sufficient data; never show a number where RoadSync returns "insufficient".
8. **History is never destroyed:** append-only assessments/verifications, soft statuses, audit rows inside the same transaction as each change, snapshots for decisions.
9. **No new dependencies**, no AI, no unrelated refactors, no package upgrades, no heavy tests, no extra Markdown reports (≤ 12 lines appended to the existing database doc is fine). Charts are custom SVG/CSS.
10. **Never touch `main` or `development` directly; never force-push.** See §11.
11. Read `apps/web/CLAUDE.md` / `AGENTS.md` first — this Next.js version has breaking changes; read the relevant guides in `apps/web/node_modules/next/dist/docs/` before writing Next code.
12. Match conventions: Conventional Commits, `success()/failure()` envelopes, `noStore`, strict zod (reject unknown + repeated keys), `requireAuthenticated` + `requirePermission`, `AuditLog.create` with allowlisted snapshots, `strict: "throw"` schemas, `useWorkspaceLocale()` + message dictionaries, `guard()/moved()` API client pattern.

---

## 2. RECON FINDINGS (re-verify against the code)

**Repo:** npm workspaces `apps/web` (Next 16, React 19, Tailwind 4, shadcn/radix, react-hook-form + zod, react-query), `apps/api` (Express 5, Mongoose 8, zod 4, vitest + mongodb-memory-server), `packages/shared-types`. Flow: feature branch → PR into `development` (squash).

**Assets today (`apps/api/src/modules/assets/`):** only `asset.constants.ts` and two models — **no routes, services, pages.**
- `Asset` (`assets`, `strict:"throw"`): `sourceProjectId` (required ref Project), `assetType` ∈ ROAD, WATER, ELECTRICITY, TELECOM, DRAINAGE, BRIDGE, BUILDING, PUBLIC_FACILITY, OTHER; `name` (≤200); `location` (district, province, locality, roadName, description); `geometry` (optional GeoJSON, `2dsphere`); `agencyId` (comment: "InfraMap geometry and agency ownership after handover"); `condition` ∈ EXCELLENT, GOOD, FAIR, POOR, CRITICAL, UNKNOWN (default UNKNOWN); `healthScore` (0–100, optional); `commissionedAt` (required); `lastInspectionAt?`; `nextMaintenanceAt?`. Indexes `{agencyId,condition}`, `{nextMaintenanceAt}`, `{geometry:"2dsphere"}`.
- `MaintenanceRecord` (`maintenanceRecords`): `assetId`, `maintenanceType` ∈ PREVENTIVE, CORRECTIVE, EMERGENCY, ROUTINE, OTHER; `scheduledDate` (required); `completedDate?` (≥ scheduled); `cost?` (`moneySchema`, "unset until estimated/recorded"); `status` ∈ PLANNED, SCHEDULED, IN_PROGRESS, COMPLETED, OVERDUE, CANCELLED (default PLANNED). Indexes `{assetId,scheduledDate}`, `{status,scheduledDate}`.
- Demo seed (`seeds/demo/seed-supporting-records.ts`) creates "Demo Riverside Bridge Asset" (+ maintenance records). `reset-demo.ts` deletes demo assets/maintenance.
- **Existing readers:** Phase 8 InfraMap (Batch 02/03 branches `feature/phase8-inframap-assets-utilities-risks` / `…advanced-gis`) reads `assets` for the asset/utility layers (type, condition, `healthScore`, `lastInspectionAt`, `nextMaintenanceAt`, optional `sensitivity` (STANDARD|RESTRICTED, utility types restricted by default via `effectiveSensitivity`), needs-attention rule). **Those caches (`condition`, `healthScore`, `lastInspectionAt`, `nextMaintenanceAt`) must stay correct and keep their meaning.** Check whether Phase 8 is merged into your base; if yes integrate (§4.10), if not make no Phase 8 assumptions beyond keeping the fields compatible.

**Permissions** (`packages/shared-types/src/permissions.ts`): `asset.read|create|update|health.read`, `maintenance.create|update`, `report.view|export` exist. Seed grants (**print & confirm**): SUPER_ADMIN and GOV_ADMIN = all of them; AGENCY_OFFICER = `asset.read/create/update`, `maintenance.create/update`, `report.*` (**no `asset.health.read`**); PROJECT_MANAGER = `asset.read`, `maintenance.create`, `report.*` (no create/update/health); INSPECTOR = `asset.read`; CONTRACTOR/CITIZEN = none. Scope: `resolveResourceScope` (platform / agencies / none), `projectReadFilter`, `projectWriteFilter(actor, scope)` (PROJECT_MANAGER narrowing).

**Project lifecycle:** statuses DRAFT … ACTIVE, ON_HOLD, DELAYED, COMPLETED, CANCELLED; `COMPLETE: ACTIVE → COMPLETED`. **There is no HANDOVER state** — handover is captured by the conversion workflow, not by a new project status (do not add one).

**RoadSync (Steps 74–80 live on branch `feature/phase7-roadsync-step-80`; verify they're on your base):** `roadsync/dashboard.metrics.ts` + `dashboard.rules.ts` + `dashboard.read.ts` + `dashboard.routes.ts` already implement **agency scorecards**: `scorecard(d, agencyId, range, now)`, `benchmark(cards)`, `health(components, cases, minCases)` with `HEALTH_WEIGHTS` {ackTimeliness 25, responseTimeliness 25, resolutionProgress 20, backlogHealth 15, commitmentCompletion 15}, `GRADES` (excellent ≥ 85, good ≥ 70, needs_attention ≥ 50, at_risk), `DASH.MIN_CASES_FOR_SCORE = 5`, `MIN_COHORT_FOR_BENCHMARK = 3`; every metric returns `{key, value|null, numerator, denominator, unit, definitionKey, drilldown}`; endpoint `GET /roadsync/dashboard/agencies` (permission `roadsync.conflict.read`, scope via `Who`; national level vs own-agency level; `benchmarkUnavailable: "cohort_too_small"`). **Step 107 must consume this, not recompute it.** Web RoadSync pages live under `app/roadsync/*` (dashboard/brief, conflicts, coordination, approvals, history).

**Batch 04/05/06 seams (verify on your base):** `contractorAssignments` + `contractor-evidence.ts` + rules `c2`; Finance `projectPayments`/`projectExpenses`/budget revisions, `physical-progress.source.ts`, payment gates, money components (`lib/finance/money.ts`, `money-text`); Inspections: extended `Inspection` (types PROGRESS_VERIFICATION, QUALITY, SAFETY, MILESTONE, FINAL_HANDOVER, FOLLOW_UP), `inspectionEvidence`, `progressVerifications`, `Project.verifiedProgress`, GridFS `evidence-storage.ts`, workflow table, reviewer grants, calendar/lightbox/upload-queue/authed-image components.

**Audit:** allowlisted snapshot keys (`status` (`/^[A-Z_]+$/`), `reason`, `agencyId`, `contractorId`, `amount`, `cost`, …; strict). `AUDIT_RESOURCES` already includes `ASSET`, `MAINTENANCE_RECORD`. Use `status` to carry a condition/operational value; never put free text or coordinates in snapshots.

> **BATCH 06 FINAL REPORT / HANDOFF NOTES (authoritative if present — else derive from the code):**
> `[PASTE BATCH 06 REPORT HERE]`

---

## 3. PREFLIGHT (≤ 15 lines, then continue unless blocked)

1. `git fetch origin`; `git status` clean; branch + `git log --oneline -5`.
2. **Required on your base branch** (`origin/development`): Batch 04 (`contractor-assignment.model.ts`), Batch 05 (`projectBudgetRevisions`, `physical-progress.source.ts`), Batch 06 (`inspectionEvidence`, `progressVerifications`, `evidence-storage.ts`, FINAL_HANDOVER type), RoadSync Step 78 (`roadsync/dashboard.metrics.ts`). **If any is missing → STOP and ask me**: (A) I merge them first; (B) stack this branch on the latest unmerged feature branch; (C) skip only the part that depends on the missing piece (state exactly which). Don't guess.
3. Detect Phase 8: is `modules/inframap/` + the asset layer on your base? Note the answer; it decides §4.10.
4. `npm install` if needed; Node ≥ 22; baseline `npm run type-check` + assets/inspections/finance/roadsync tests; list pre-existing failures (don't fix).
5. Re-verify §2: print the role→asset/maintenance/inspection/report permission matrix; find every reader/writer of `Asset`, `MaintenanceRecord`, `Asset.condition/healthScore/lastInspectionAt/nextMaintenanceAt` (InfraMap, seeds, dashboards).
6. Check the permission-propagation path used in Batches 05/06 (sync script, seed-core, parity tests) before adding grants/permissions (§4.2).
7. Read the RoadSync scorecard code (`scorecard`, `benchmark`, `dashboardAgencies`, `Who` building in `dashboard.routes.ts`) and the existing RoadSync dashboard UI components; decide the reuse approach (import the read function vs. call the existing endpoint). Check the Batch 06 calendar/lightbox/upload components' props to see what must be generalised (§4.9).

---

## 4. DATA, DOMAIN AND BACKEND

### 4.1 Asset model — additive extension (same collection)
Add (optional unless stated; `strict:"throw"`; keep all existing fields/semantics):
- `assetNo` (`AST-YYYY-NNNNNN`, unique; atomic counter from Batch 05), `origin`: `CONVERSION | ADDITION | LEGACY`, `conversionId?`, `constructionAgencyId?` (project's agency at conversion; `agencyId` = **owning/responsible agency after handover**), `operationalStatus`: `IN_SERVICE | UNDER_MAINTENANCE | OUT_OF_SERVICE | DECOMMISSIONED` (default IN_SERVICE), `handoverAt?`, `defectsLiabilityEndsOn?` (date entered at handover — **never computed from invented statutory periods**), `description?`, `designLifeYears?` (1–150), `monitoringIntervalDays` (default by type from one constants table, e.g. BRIDGE 180, ROAD 365, others 365; editable within 30–1825), `version`.
- Keep `condition/healthScore/lastInspectionAt/nextMaintenanceAt` as **server-maintained caches** (derived in §4.6/§4.7, written only by the asset services in the same transaction as their cause). `healthScore` is **unset** (not 0) when evidence is insufficient.
- Indexes: `{agencyId:1,operationalStatus:1}`, `{constructionAgencyId:1}`, `{sourceProjectId:1}`, `{assetType:1,condition:1}`, `{assetNo:1}` unique. Add to `check-indexes.ts`; run `npm run db:indexes:check`.
- **Visibility for the asset module:** `agencyId ∈ scope` **or** `constructionAgencyId ∈ scope`; platform = all with an agency. Out-of-scope id → **404**. (InfraMap keeps its own tiered cross-agency awareness policy; don't change it.) Utility-type assets keep `sensitivity` semantics from Phase 8 if present (`effectiveSensitivity`); the asset module itself is agency-scoped, and any map/geometry exposure still goes through InfraMap's policy.
- **Backfill** `scripts/backfill-assets-batch07.ts` (+ `db:backfill:assets`, dry-run default, `--commit`): numbers, `origin:"LEGACY"`, `operationalStatus:"IN_SERVICE"`, `constructionAgencyId` from the source project, `monitoringIntervalDays` default. **Legacy `condition` values stay but are labelled "legacy — no assessment recorded"; no assessment rows are invented.**

### 4.2 Permissions (minimal, additive, explicit)
Add **`asset.conversion.approve`** (GOV_ADMIN only). Additive grants for the workflow (flag all for my approval in the report): `asset.health.read` → AGENCY_OFFICER, PROJECT_MANAGER; `asset.create` → PROJECT_MANAGER (request conversions for projects they manage — project-write-scope-limited — cannot approve); `maintenance.update` stays with AGENCY_OFFICER/GOV_ADMIN/SUPER_ADMIN (PROJECT_MANAGER can only *request*). SUPER_ADMIN holds the same asset/maintenance grants today — apply the platform write rule **exactly like `projectWriteFilter`** (only records that have an owning agency); don't widen. Use the same idempotent propagation path as Batches 05/06; list the final matrix in the report. **Maker–checker everywhere:** conversion approver ≠ requester; maintenance approver ≠ requester; inspection reviewer ≠ submitter (Batch 06).

### 4.3 Conversion (Step 103): `assetConversions` (new collection)
`strict:"throw"`, timestamps: `conversionNo` (`CNV-YYYY-NNNNNN`), `projectId`, `agencyId` (project agency), `status`: `PENDING_APPROVAL | APPROVED | REJECTED | CANCELLED`, `requestedBy`, `requestedAt`, `decidedBy?`, `decidedAt?`, `decisionNote?` (≥ 12 chars on reject), `receivingAgencyId` (default = project agency; must be an ACTIVE agency; if different from the requester's scope, approver must be platform-level or GOV_ADMIN of an ancestor — mirror agency-scope rules), `handover` `{ handoverDate (required, ≥ project start, ≤ today + 30 d), handoverNote? (≤ 2000), defectsLiabilityEndsOn?, documentIds[] (≤ 20, existing `Document` refs validated through existing document-read scope — **references only, no upload here**), conditionAtHandover? (one of the known conditions, default UNKNOWN) }`, `proposedAssets[]` (1–10): `{ key, assetType, name (≤ 200), description?, location? (existing locationSchema), geometrySource: "PROJECT" | "NONE", commissionedAt (default handoverDate), designLifeYears?, monitoringIntervalDays? }`, `gateResults[]` (snapshot of the checklist at request and at decision), `createdAssetIds[]` (set on approval), `version`.
- **One active conversion per project:** partial unique `{projectId:1}` where `status ∈ {PENDING_APPROVAL, APPROVED}`; REJECTED/CANCELLED allow a new request. A project with an APPROVED conversion cannot be converted again (409 `ALREADY_CONVERTED` with the existing conversion/asset links). Later additions for the same project use the **Add asset** flow (§4.4) with `origin:"ADDITION"`, allowed only when the project has an APPROVED conversion.
- **Eligibility gates** (pure `conversion-gates.ts`, evaluated live at request, shown in the wizard, and **re-evaluated inside the approve transaction**; BLOCK prevents request/approve, WARN is shown and recorded):

| Gate | Result | Rule |
|---|---|---|
| Project completed | BLOCK | Project status = COMPLETED (lifecycle untouched) |
| Verified completion | BLOCK | ACTIVE `progressVerifications.verifiedPercent = 100` **or** a `VERIFIED` `FINAL_HANDOVER` inspection for the project (Batch 06); label which one satisfied it |
| Geometry | WARN | Project has valid geometry; if not, assets will not appear on InfraMap |
| Open findings | WARN | Unresolved CRITICAL/MAJOR defects from the latest verified inspection chain |
| Financial closure | WARN | Payments still PENDING/APPROVED (unpaid), or unresolved expenses awaiting verification (Batch 05); "retention payments outstanding" note |
| Contractor handover | WARN | ACTIVE contractor assignments still open (Batch 04) — recommend ending them |
| Receiving agency | BLOCK | Receiving agency exists, ACTIVE |
| Duplicate | BLOCK | No active/approved conversion exists |
| Maker–checker | BLOCK (approve) | Approver ≠ requester |
| Documents | WARN | No completion documents referenced |

- **Workflow:** request (`asset.create`, project write scope) → approve/reject (`asset.conversion.approve`, project/receiving-agency scope) → on approve (one transaction): create assets (valid geometry copied from the project only when `geometrySource:"PROJECT"` and `validGeometry` passes, `origin:"CONVERSION"`, `conversionId`, `constructionAgencyId`, `agencyId = receivingAgencyId`, `handoverAt`, `condition` from `conditionAtHandover` **flagged as `UNKNOWN` unless provided**), set `createdAssetIds`, write audit rows, bump caches, notices after commit. Requester can **cancel** while PENDING. Project record is not modified except for a read-only back-link computed at read time (no new project field).
- Asset names default to the project title; each proposed asset needs a unique key and name within the request.

### 4.4 Asset services/routes (Step 104) — mount `/api/v1/assets`
All: `requireAuthenticated` + permission, scope-checked (404 out of scope), strict zod, `noStore`, envelopes, rate limits, allowlisted responses, audit on mutations.

| Method + path | Permission | Purpose |
|---|---|---|
| `GET /assets` | `asset.read` | Directory: filters `q`, `assetType`, `condition`, `operationalStatus`, `agencyId`, `district`, `attention`, `healthBand` (needs health perm), `hasOpenMaintenance`, `dlp=1` (within defects liability), `sort`, `page`, `limit` ≤ 50 + facet counts. |
| `GET /assets/summary` | `asset.read` | Dashboard numbers: counts by type/condition/operational status; attention count; overdue maintenance; open requests; assessments due/overdue; health coverage ("health available for N of M assets") and distribution (health perm); pending conversions (for approvers); upcoming maintenance 30 d. |
| `GET /assets/:id` | `asset.read` | Passport (tier: health fields need `asset.health.read`; financial lines need finance perms; contractor names need `contractor.read`). |
| `PATCH /assets/:id` | `asset.update` | Edit name/description/location text/designLife/monitoringInterval/operationalStatus (with reason for OUT_OF_SERVICE/DECOMMISSIONED); `version` precondition; DECOMMISSIONED requires no open maintenance. |
| `POST /assets/:id/status` | `asset.update` | Operational status transitions with reason (`IN_SERVICE ⇄ UNDER_MAINTENANCE/OUT_OF_SERVICE`, `→ DECOMMISSIONED` terminal). `UNDER_MAINTENANCE` is also set/cleared automatically by maintenance start/complete (§4.7) only if the asset was IN_SERVICE. |
| `POST /assets` | `asset.create` + project write scope | **Add asset** to an already-converted project (`origin:"ADDITION"`, reason ≥ 12). |
| `GET /assets/:id/timeline` | `asset.read` | **End-to-end lifecycle timeline** (project key milestones/completion, contractors at handover, inspections incl. FINAL_HANDOVER and ASSET_CONDITION, verification, conversion request/approval, assessments, maintenance events, status changes) merged from the existing sources with per-source permission tiering; cursor-paginated. |
| `GET /assets/conversions` · `GET /assets/conversions/:id` | `asset.read` | Conversion queue/list (filters status, project, agency) and detail incl. gate results. |
| `GET /assets/conversions/preview?projectId=` | `asset.create` | Live gate evaluation + prefill suggestions (name, type guess from `projectType`, geometry availability) — no writes. |
| `POST /assets/conversions` · `POST /assets/conversions/:id/cancel` | `asset.create` | Request/cancel. |
| `POST /assets/conversions/:id/approve|reject` | `asset.conversion.approve` | Decide (gates re-evaluated; approve idempotent; reject needs note). |
| `GET /assets/export.csv` | `report.export` | Register export (scope-safe, cap 5 000, CSV-injection-safe, audited count only). |

Asset type guess from project type: ROAD→ROAD, BRIDGE→BRIDGE, WATER→WATER, ELECTRICITY→ELECTRICITY, TELECOM→TELECOM, DRAINAGE→DRAINAGE, BUILDING/PUBLIC_FACILITY→same, MULTI_INFRASTRUCTURE/OTHER→OTHER (user can change/split).

### 4.5 Condition monitoring (Step 105a): `assetConditionAssessments` (new, append-only) + inspection reuse
- **Condition scale** constant `CONDITION_SCORE = { EXCELLENT: 95, GOOD: 80, FAIR: 60, POOR: 35, CRITICAL: 10 }` (UNKNOWN has no score). Ordinal steps for trend: EXCELLENT=5 … CRITICAL=1.
- **Two ways to record an assessment, both explicit about basis:**
  1. **Inspection-verified (preferred):** extend Batch 06's `Inspection` additively with `assetId?` and a new type **`ASSET_CONDITION`** (checklist template in code: structural integrity, surface/wear, drainage/water ingress, safety features, functionality — generic, no invented standards; `CHECKLIST_VERSION`), allowed for projects with an APPROVED conversion/asset; the existing Batch 06 workflow (inspector submits with evidence, **another** reviewer approves) applies unchanged. Report gets `conditionRating` (EXCELLENT…CRITICAL) and `issues[]` (reuse defect structure). **On approval** (same transaction): create an assessment `basis:"INSPECTION_VERIFIED"` and refresh asset caches. No `progressVerifications` are created for this type.
  2. **Manual entry (lower confidence):** `POST /assets/:id/assessments` (`asset.update`, asset scope): condition + observations (≥ 20 chars) + issues + optional evidence references; `basis:"MANUAL_ENTRY"`; labelled "not inspection-verified" in the UI; maker–checker not required but audited with reason. 
- `assetConditionAssessments`: `assetId`, `agencyId`, `assessedAt` (date; ≤ today), `condition`, `basis` (`INSPECTION_VERIFIED | MANUAL_ENTRY`), `inspectionId?`, `observations` (≤ 2000), `issues[]` (≤ 20 `{ key, title (≤ 160), severity: MINOR|MAJOR|CRITICAL, status: OPEN|RESOLVED, location? }`), `previousCondition?`, `assessedBy`, `reviewedBy?`, `status`: `ACTIVE | SUPERSEDED` (latest by `assessedAt` then `createdAt` is ACTIVE), `maintenanceRefs[]?` (ids of completed maintenance that the assessor says resolved issues). Append-only hooks (only `status`/`supersededBy` mutable via a dedicated function). Indexes `{assetId:1,assessedAt:-1}`, `{agencyId:1,assessedAt:-1}`.
- **Issues carry-forward:** the assessment form pre-fills the previous ACTIVE assessment's open issues; the assessor must mark each *still open* or *resolved* (so "unresolved quality findings" are derived from the latest assessment only).
- **Cache refresh** (`refreshAssetCaches(assetId, session)`, one function used by every writer): `condition` = latest ACTIVE assessment's condition (else keep legacy value flagged); `lastInspectionAt` = latest ACTIVE assessment's `assessedAt`; `nextMaintenanceAt` = earliest non-terminal maintenance `scheduledDate` (else unset); `healthScore` = §4.8 result (unset when insufficient). Called inside the same transaction as each assessment/maintenance/status change.
- **Deterioration & critical flags (pure, explainable, `CONDITION_RULES_VERSION "k1"`):** `trend` from the last up-to-3 assessments: `DETERIORATING` (dropped ≥ 1 step between the last two, or ≥ 2 steps over the last three), `IMPROVING`, `STABLE`, else `INSUFFICIENT_HISTORY` (< 2 assessments). Annualised decline rate shown only with ≥ 3 assessments spanning ≥ 180 days. Flags: `CONDITION_CRITICAL`, `OPEN_CRITICAL_ISSUE`, `ASSESSMENT_OVERDUE` (> 100 % of interval), `ASSESSMENT_DUE_SOON` (≥ 85 %), `NO_ASSESSMENT_RECORDED`, `WITHIN_DEFECTS_LIABILITY` (info) combined with a drop → `DLP_DETERIORATION` (**Defects Liability Watch**: "Condition dropped during the defects-liability period ending {date} — consider notifying {contractor}"), `OUT_OF_SERVICE`.
- Notices (best-effort after commit): CRITICAL condition recorded → agency GOV_ADMIN + asset owner officers; DLP deterioration → the asset owner officers and the project manager.

### 4.6 Maintenance (Step 105b): extend `MaintenanceRecord` + `maintenanceEvidence` (thin new collection)
- **Model additions** (additive; `strict:"throw"`): `maintenanceNo` (`MNT-YYYY-NNNNNN`, unique; backfill), `agencyId` (asset's owner, denormalised), `title` (≤ 160, required for new), `description?` (≤ 3000), `priority`: `LOW|NORMAL|HIGH|URGENT`, `origin`: `REQUEST | PLANNED | CONDITION_TRIGGER | INSPECTION_FINDING | RECURRENCE`, `requestedBy`, `requestedAt`, `decidedBy?`, `decidedAt?`, `decisionNote?`, `responsibleAgencyId?`, `assignedTeam?` (≤ 120, free text), `contractorId?` (optional Batch 04 contractor; must be ACTIVE), `tasks[]` (≤ 20 `{ key, title (≤ 160), done }`), `estimatedCost?` (`moneySchema`), keep existing `cost` as **actual cost**, `startedAt?`, `completionNotes?` (≥ 20 chars on complete), `outcome?`: `RESOLVED | PARTIAL | NOT_RESOLVED`, `completedBy?`, `cancelReason?`, `recurrenceDays?` (30–1825, PREVENTIVE/ROUTINE only), `previousRecordId?` (unique partial index → recurrence idempotency), `linkedIssueKeys[]?` (from the latest assessment), `version`.
- **Statuses:** add `REQUESTED` and `REJECTED` to `MAINTENANCE_STATUSES` (+ shared enums). **`OVERDUE` stays in the enum for compatibility but is never written — it is derived** (`PLANNED|SCHEDULED|IN_PROGRESS` past `scheduledDate`). Existing demo rows with stored OVERDUE are normalised by the backfill (→ SCHEDULED).
- **Workflow (pure table + atomic transitions, audited, transactional, maker–checker):** `REQUESTED →(approve) PLANNED →(set date/team) SCHEDULED →(start) IN_PROGRESS →(complete) COMPLETED`; `REQUESTED →(reject, note ≥ 12) REJECTED`; `PLANNED|SCHEDULED|IN_PROGRESS →(cancel, reason ≥ 12) CANCELLED`. Planned work created directly by `maintenance.update` holders (preventive plans, corrective after an assessment) starts at `PLANNED` (`origin: PLANNED|CONDITION_TRIGGER|INSPECTION_FINDING`). **Request** = `maintenance.create` (PROJECT_MANAGER, AGENCY_OFFICER, GOV_ADMIN, SUPER_ADMIN within scope); **approve/plan/schedule/start/complete/cancel** = `maintenance.update`; approver ≠ requester; EMERGENCY type may be requested and approved by the same GOV_ADMIN **only if** `acknowledgeEmergency:true` and the audit reason says so (document this single exception in code; flag in the report).
- **Completion** (one transaction): requires `completionNotes`, `outcome`, `completedDate` (≥ scheduled, ≤ today), optional actual `cost` (integer cents) and all tasks either done or explicitly skipped with note; clears `UNDER_MAINTENANCE` if this was the only active work; **does not change `condition`** — the response contains `suggestAssessment: true` and the UI offers "Record a condition assessment now"; recomputes caches; if `recurrenceDays` set and none exists for `previousRecordId`, creates the next PLANNED record at `completedDate + recurrenceDays` (origin RECURRENCE).
- **Monitoring:** overdue (derived), due in 7/30 d, requested-awaiting-approval age, repeated corrective on the same asset (≥ 3 CORRECTIVE/EMERGENCY in 12 months → flag `REPEAT_FAILURES`), cost tracking (estimated vs actual sums with integer math, Batch 05 money helpers).
- **Evidence:** `maintenanceEvidence` (`maintenanceId`, `assetId`, `agencyId`, `documentId` (`Document` type `SITE_EVIDENCE`), `thumbDocumentId?`, caption, `capturedAt`, `sha256`, size/dimensions, `status` ACTIVE|PENDING_UPLOAD|REMOVED, removal fields) reusing **Batch 06's** `EvidenceStorage`, magic-byte validator, size limits, two-step upload protocol and authed streaming (extract the shared parts into a small shared module only if it is a clean, low-risk move — otherwise import from the inspections module; do **not** copy-paste the validators). Limits: 20 photos per maintenance record; add/remove allowed while IN_PROGRESS (and at completion); no location capture required.
- **Routes** (`/api/v1/maintenance`): `GET /maintenance` (filters status CSV, type, priority, assetId, agencyId, date range, `overdue`, `mine`, `q`, sort, page), `GET /maintenance/calendar?from&to` (≤ 62 days, cap 500), `GET /maintenance/summary`, `GET /maintenance/:id`, `POST /assets/:assetId/maintenance` (request/plan), `PATCH /maintenance/:id` (editable until IN_PROGRESS; `version`), `POST /maintenance/:id/approve|reject|schedule|start|complete|cancel`, tasks toggle `PATCH /maintenance/:id/tasks/:key`, evidence routes mirroring Batch 06. Permissions per §4.6; scope via the asset's agency (404 out of scope); strict zod; `noStore` (except streamed files); audit actions `maintenance.requested|approved|rejected|scheduled|started|completed|cancelled|updated|evidence_added|evidence_removed`.
- **Notices:** requested → approvers; decided/scheduled/started/completed → requester; assigned team contractor (if any) not notified (no contractor portal); overdue maintenance computed on read with lazy once-a-day notices if dedupe exists (else dashboard-only — say which).

### 4.7 Operational status coupling (single place)
`UNDER_MAINTENANCE` ⇄ `IN_SERVICE` flips automatically **only** from maintenance start/complete/cancel and only when the asset is `IN_SERVICE`/`UNDER_MAINTENANCE`; `OUT_OF_SERVICE`/`DECOMMISSIONED` are manual decisions and never auto-overridden. All via `refreshAssetCaches`.

### 4.8 Infrastructure health indicator (Step 106) — pure, explainable, evidence-gated
`asset-health.rules.ts` (pure, fully unit-tested, `HEALTH_RULES_VERSION = "h1"`, every threshold in one block) + `asset-health.service.ts`.

**Components and weights (sum 100):**
| Component | Weight | Score 0–100 | Available when |
|---|---|---|---|
| `condition` | 45 | `CONDITION_SCORE[latest ACTIVE assessment]`, **age-adjusted**: if the assessment is older than 1× interval, subtract 10; older than 2× interval → component **unavailable** (stale) | an ACTIVE assessment exists and is ≤ 2× interval old |
| `openIssues` | 20 | 100 − 40·CRITICAL − 20·MAJOR − 5·MINOR (floor 0) from the **latest assessment's OPEN issues** | an assessment exists |
| `maintenance` | 20 | 100 minus: 30 per overdue URGENT/HIGH, 15 per overdue NORMAL/LOW (+10 if overdue > 30 d), 10 per request waiting > 30 d; floor 0; **completed maintenance never adds points** (it only removes a prior penalty) | always available (no work = 100, with a note "no maintenance recorded" shown) |
| `assessmentTimeliness` | 10 | 100 within interval; linear down to 0 at 2× interval | an assessment exists |
| `hazardExposure` | 5 | VERY_HIGH 20 / HIGH 40 / MEDIUM 70 / LOW 90 / none 100, from `hazardZones` intersecting the asset geometry (**only if** the Phase 8 `hazardZones` model exists and the asset has valid geometry) | else **skipped** (weight redistributed) |

- **Rule:** a numeric score exists **only if `condition` is available** (a fresh-enough assessment). Otherwise `{ availability: "INSUFFICIENT_EVIDENCE", reasons: [...] }` — no score, no band, `Asset.healthScore` **unset**. When some other components are skipped, weights are renormalised over the available ones and the response states which were used (`weightsUsed`). Score = integer rounded from integer-weighted math (no float drift: compute in hundredths).
- **Band:** `GOOD ≥ 75`, `WATCH 50–74`, `POOR 25–49`, `CRITICAL < 25`; **caps:** latest condition CRITICAL ⇒ band ≤ `CRITICAL`... define explicitly: condition CRITICAL ⇒ band = CRITICAL; condition POOR ⇒ band ≤ POOR; any OPEN CRITICAL issue ⇒ band ≤ POOR. Document in the rules file and show "capped by rule X" in the UI.
- **Evidence level:** `LOW` (condition only), `MODERATE`, `GOOD` (all components); shown beside every score. Basis chip: "Inspection-verified" vs "Manual entry" (from the latest assessment) — manual-basis scores cap the evidence level at `MODERATE`.
- **Explanations:** each component returns `{ key, score|null, weight, weightUsed, inputs, reasonKey }` so the UI can render "How is this calculated?"; **rule-based improvement hints** (not predictions): `RECORD_ASSESSMENT`, `CLOSE_OVERDUE_MAINTENANCE`, `REVIEW_OPEN_CRITICAL_ISSUE`, `APPROVE_WAITING_REQUESTS`.
- **Update behaviour:** recomputed inside `refreshAssetCaches` on every assessment/maintenance/status/asset-edit event; also on read (cheap, pure) so staleness-by-time is always current; `scripts/recompute-asset-health.ts` (dry-run default) refreshes the persisted cache for time-driven changes — **no cron**.
- Visible only with `asset.health.read` (otherwise "Health indicators are restricted for your role"); the cached `healthScore` field already feeds InfraMap under its own tier rules.

### 4.9 Coordination insights (Step 107) — thin facade over RoadSync
- Create `modules/agencies/coordination-insights.service.ts` (or the repo-appropriate home) exposing `GET /api/v1/insights/coordination` that **delegates to the existing RoadSync `dashboardAgencies` read function** (same `Who`/scope building as `dashboard.routes.ts`, same permission `roadsync.conflict.read`, same range handling) and adds only presentation metadata: **indicator mapping table** (blueprint indicator → existing RoadSync metric key/`definitionKey`), `minCases`/`minCohort` constants echoed, and `availability` per card. **Do not add new scoring math.** If a blueprint indicator has **no** RoadSync source (e.g., "repeated scheduling conflicts", "approval turnaround"), list it as **"Not available from current records"** in the UI and the report rather than inventing it. If the mapping reveals a one-line missing export from RoadSync, export it; otherwise leave RoadSync untouched.
- **Fairness rules enforced in the facade/UI (copy RoadSync's own rules, don't weaken them):** a score card renders a number only if RoadSync returns one (≥ `MIN_CASES_FOR_SCORE` cases); below that → "Not enough cases (n of 5)"; **no ordering by score among agencies lacking sufficient data** — default sort is alphabetical, optional "sort by health" only reorders agencies with sufficient data and keeps the rest below a divider; benchmark medians only when the cohort ≥ `MIN_COHORT_FOR_BENCHMARK` (else the RoadSync `cohort_too_small` message); display `numerator/denominator`, caseload, range and definitions beside every metric; a visible banner: "Operational decision-support indicators from RoadSync records — not a performance ranking."
- **Visibility:** exactly as RoadSync returns (national level for platform/ancestor-agency roles; own-agency level otherwise). The facade adds no wider visibility. Contractors/inspectors/citizens denied.

### 4.10 InfraMap integration (only if Phase 8 is on your base)
- Assets created by conversion/addition appear automatically in the Phase 8 asset/utility layers (they read `assets`; confirm `sensitivity`, geometry validity and the `needsAttention` rule behave with the new fields — add tests, don't change InfraMap's policy).
- Update the InfraMap asset **quick view/drawer "Open full record" link** to `/assets/[id]` when the viewer holds `asset.read` and the asset is in their module scope; add **"View on map"** on the asset page → `/inframap` with the asset selected (use the Batch 03 URL state `sel=assets:<id>` + view params if present; otherwise just `/inframap`).
- The Phase 8 attention rule (condition POOR/CRITICAL, overdue `nextMaintenanceAt`, stale `lastInspectionAt`) keeps working through the caches; don't duplicate it — the Batch 07 attention filter reuses the same pure function if exported, else a thin shared helper both import.

### 4.11 Audit and notifications
Audit actions: `asset.conversion_requested|conversion_approved|conversion_rejected|conversion_cancelled`, `asset.registered|updated|status_changed|assessment_recorded|exported`, `maintenance.*` (above). Snapshot keys only from the allowlist (`status` for conditions/operational status, `reason`, `agencyId`, `contractorId`, `cost`); no free text/coordinates. Add nothing to the allowlist unless unavoidable (then minimal + commented). Notices follow §4.5/§4.6.

### 4.12 Seeds (small, clearly synthetic; idempotent; update `reset-demo`/`verify-demo`)
Design the demo so **the full lifecycle story can be demonstrated live**:
1. **Project A (COMPLETED)** with a VERIFIED FINAL_HANDOVER inspection + 100 % verification (Batch 06 seed) and **no conversion yet** → shows the wizard (with WARN gates: one unpaid retention payment, one open MAJOR defect).
2. **Project B** already converted (approved conversion) → 2 assets (a ROAD and a DRAINAGE asset) with handover data and a `defectsLiabilityEndsOn` in the future.
3. The existing "Demo Riverside Bridge Asset": add 3 assessments over time (EXCELLENT → GOOD → POOR, one inspection-verified via a seeded ASSET_CONDITION inspection, two manual) with open issues, an overdue PREVENTIVE maintenance (recurrence 180 d), a REQUESTED corrective, a COMPLETED corrective with actual cost, and a tiny synthetic evidence placeholder.
4. One asset with **no assessments** (health = "Not enough evidence") and one stale-assessment asset (condition component unavailable).
5. One PENDING conversion request waiting for a GOV_ADMIN (not the requester).
All descriptions end with "(Synthetic)". Don't override real demo rows. Provide a **health/scorecard sanity** line in `verify-demo` (counts only).

---

## 5. FRONTEND — PERFECT, MODERN UI/UX

### 5.1 Routes, navigation, files
`/assets` (dashboard + directory), `/assets/[id]` (passport), `/assets/convert` (wizard; also reachable from a COMPLETED project's page via **Convert to assets** for `asset.create` holders), `/assets/conversions` (approvals queue), `/maintenance` (queue + calendar), `/insights/coordination` (Step 107 page; also linked from RoadSync's dashboard and the agency admin area). Nav items **Assets** (Building/Landmark icon), **Maintenance** (Wrench), **Agency insights** (Gauge/Network) with `i18n` si/ta, each gated by its permission (`asset.read`, `asset.read`/`maintenance.create`, `roadsync.conflict.read`); add the segments to `lib/auth/route-access.ts` (+ test). Project page: **Convert to assets** CTA (COMPLETED + permission) and a read-only "Assets" card listing converted assets with links. Contractor profile and Finance pages unchanged except optional links.

Suggested files (adapt to conventions): `components/assets/{assets-dashboard,asset-insight-strip,asset-filters,asset-directory-table,asset-card-list,asset-passport,asset-hero,lifecycle-timeline,condition-panel,condition-chart,assessment-dialog,issue-carryforward,health-panel,health-breakdown,health-badge,dlp-watch,asset-projects-panel,conversion-wizard,handover-readiness,gate-checklist,proposed-assets-editor,conversion-queue,conversion-decision-dialog,asset-badges,asset-passport-print}.tsx`; `components/maintenance/{maintenance-dashboard,maintenance-queue,maintenance-calendar,maintenance-request-dialog,maintenance-drawer,maintenance-stepper,task-checklist,complete-dialog,decision-dialogs,maintenance-evidence,cost-summary}.tsx`; `components/insights/{coordination-insights,agency-scorecard,indicator-card,benchmark-strip,insufficient-data-state,indicator-mapping}.tsx`; `lib/assets/*`, `lib/maintenance/*`, `lib/insights/*` (`api.ts`, `types.ts`, `list-query.ts`, `schemas.ts`, `messages.ts`, `view.ts`; small tests for pure helpers).

### 5.2 Design language (consistent with Batches 04–06)
Calm high-trust surfaces, tabular numerals, status never colour-only (icon + label), skeleton-first loading, ≤ 200 ms motion with reduced-motion respected, 44 px mobile targets, focus rings, aria-live for counts. Asset-specific visuals: **type icons** matching Phase 8 sprites; **condition chips** with the same 5-step ring/badge language as InfraMap (EXCELLENT/GOOD plain, FAIR half-ring, POOR dashed + "!", CRITICAL double ring, UNKNOWN hollow "?"); **health gauge** (semi-circle SVG with band segments, "Not enough evidence" empty gauge when unavailable); **evidence-level pips**; **basis chips** (Inspection-verified / Manual entry / Legacy).

### 5.3 Screens (all with loading/empty/error/forbidden/restricted states; every control functional)

**A. Assets dashboard + directory (`/assets`)**
- Header with scope chip, **Convert completed project** (approvers/requesters), **Add asset** (for converted projects), Export (with `report.export`).
- **Insight strip** (click-to-filter): Total assets · Needs attention · Assessments due/overdue · Overdue maintenance · Open requests · Pending conversions (approvers).
- **Charts (custom SVG):** condition distribution donut (with "legacy/unassessed" slice labelled), maintenance workload by month (stacked bars: planned/completed), health distribution histogram **with coverage note** ("Health available for 18 of 42 assets"), "Assets needing attention" list with reasons.
- Filter bar (search, type, condition, operational status, agency, district, health band, "Needs attention", "Within defects liability", "Has open maintenance") with applied chips + URL state, server-side. **Directory table** (type icon, name + assetNo, owner agency, district, condition chip + basis, health badge or "—", operational status, next assessment due, next maintenance, row menu: Open, Request maintenance, Record assessment, View on map). **Mobile:** card list + bottom-sheet filters + FAB.

**B. Asset passport (`/assets/[id]`) — the flagship screen**
- **Hero:** assetNo, name, type icon, owner agency, operational status chip (with change-status dialog), condition chip + basis, **health gauge**, DLP watch banner (if applicable), primary actions: Record assessment · Request maintenance · View on map · Print passport.
- **Tabs:** *Overview* (details, location, handover info, design life, monitoring interval, source project card with link, conversion record link) · *Condition* (condition timeline chart with assessment points coloured by condition + shapes, maintenance markers on the same axis; assessments list with basis chips and evidence link to the inspection; open-issues table with severity; trend + flags with explanations; **Record assessment** dialog = manual entry with issue carry-forward, and a **Request verified assessment** button that opens the Batch 06 schedule dialog prefilled with type ASSET_CONDITION) · *Maintenance* (timeline + upcoming + history, cost summary with estimated vs actual, **Request maintenance** dialog, repeat-failure flag) · *Health* (component breakdown bars with weights/weightsUsed, caps applied, evidence level, "How is this calculated?" popover per component, improvement hints with action buttons that open the real dialogs; **"Not enough evidence" state lists exactly what's missing and offers the action**) · *Lifecycle* (the end-to-end timeline: milestones → inspections → verification → conversion → assessments → maintenance, filters by source, per-source permission tiers) · *Construction history* (source project summary, contractors at handover with links (tiered), contract refs, finance totals only with finance permission, inspections outcomes, documents references with existing document access) · *Activity* (audit-backed).
- **Asset Passport print view** (unique function): `@media print`-optimised single page (header, details, condition history, health breakdown, last 5 maintenance, QR-free), generated client-side from fetched data; **Print** button works; no PDF library.
- **Mobile:** tabs as a scrollable segmented control, sticky action bar.

**C. Conversion wizard (`/assets/convert`)**
Stepper: **1 Select project** (search-select of in-scope COMPLETED projects without active conversion; shows verified-completion basis) → **2 Eligibility ("Handover Readiness" unique function)**: live **Gate Checklist** (PASS/WARN/BLOCK, explanations, deep links to fix: e.g., open defects → inspection, unpaid retention → finance); BLOCK stops the wizard with clear next actions; WARN requires an explicit "I understand" tick → **3 Assets** (proposed assets editor: add/split up to 10, type, name, location text, geometry source "Use project location"/"No map location" with an InfraMap-visibility hint, commissioned date, design life, monitoring interval) → **4 Handover** (date, receiving agency select, note, defects-liability end date, completion document references picker from the project's documents) → **5 Review & submit** (summary, gate snapshot) → success screen with conversion number and "Waiting for approval by …" (or approve inline if the viewer is an approver *and not the requester*).
**Approvals queue (`/assets/conversions`):** status tabs, table, detail drawer (gates re-evaluated live, proposed assets, handover, project links), **Approve / Reject** dialogs (note ≥ 12 for reject; approve summary "N assets will be created and appear on InfraMap"), disabled reasons ("Another approver must decide your own request"), post-approve success with links to the new assets.

**D. Maintenance (`/maintenance`)**
- Insight strip (Requested · Scheduled next 7 d · In progress · Overdue · Completed 30 d); tabs **Queue · Calendar · My requests**; filters (status, type, priority, asset, agency, date, overdue) with chips + URL state.
- **Queue/table** with stepper-mini, priority chips, asset link, cost estimate; **drawer**: stepper (Requested → Planned → Scheduled → In progress → Completed with branches), details, **task checklist** (toggle works, progress bar), responsible agency/team/contractor, estimated vs actual cost (LKR via Batch 05 money components), evidence gallery + upload (Batch 06 queue/lightbox), decision/schedule/start/complete/cancel dialogs by permission (complete dialog: notes, outcome, date, actual cost, tasks reconciliation; after success shows the **"Record a condition assessment now"** prompt — explicitly stating maintenance does not change condition automatically).
- **Calendar:** month/week/agenda reusing Batch 06's components (generalise props or adapter; overdue items flagged; click empty day → request/plan dialog; keyboard accessible; mobile agenda).
- **Request dialog:** asset picker (scope-limited), type, priority, title/description, desired date, link existing open issues from the latest assessment, optional recurrence (preventive/routine), estimated cost.

**E. Agency coordination insights (`/insights/coordination`)**
- Header with range selector (7d/30d/90d/12m/custom — same as RoadSync), banner "Operational decision-support indicators — not a ranking".
- **National view** (where permitted): agency cards (alphabetical by default) with health score ring **only when sufficient**, grade chip, component mini-bars (ack timeliness, response timeliness, resolution progress, backlog, commitments) each with `n/d`, case count; "Not enough cases (n of 5)" state; optional "Sort by health" that keeps insufficient agencies below a divider; benchmark strip (median of cohort) or the "cohort too small" message; click a card → agency scorecard drawer with definitions ("How is this calculated?" from `definitionKey`) and **drill-down links into the existing RoadSync pages** (conflicts, coordination, approvals, history).
- **Own-agency view** for agency roles: own card + benchmark (if cohort ≥ 3) + backlog/commitments lists via RoadSync links.
- **Indicator mapping panel** (collapsible): blueprint indicators ↔ RoadSync metrics, and "Not available from current records" rows (shown honestly).
- Mobile: card list, drawer → bottom sheet.

### 5.4 i18n
Complete `en/si/ta` dictionaries for every string (nav, asset types/conditions/operational statuses, maintenance types/priorities/statuses, gate names/messages, health components/bands/hints/reasons, flags, wizard copy, empty/error/forbidden/restricted/insufficient-evidence states, aria-labels, print view). Locale-aware dates/numbers/currency via `Intl`/`date-fns`. **Never translate stored data** (names, asset/maintenance/conversion numbers, notes, agency names). Reuse existing Sinhala/Tamil terminology (asset/maintenance/inspection terms already in the app); flag uncertain translations. Long-string checks in wizard stepper, chips, tabs.

### 5.5 API client and state
`lib/assets|maintenance|insights/api.ts` with `guard()/moved()`; React Query keys include epoch/userId/roleKey; precise invalidation (asset passport, directory, summary, maintenance lists/calendar, conversions queue, project asset card, InfraMap asset caches irrelevant client-side); uploads via the Batch 06 queue; abortable queries; no sensitive values in URLs/logs.

---

## 6. AUTONOMOUS SELF-HEALING LOOP (applies to this whole batch and the final review)

At every ✔ checkpoint in §8 and before each push:
1. **Implement** the checkpoint.
2. **Run the essential checks** for what you touched: `npm run type-check`, `npm run lint` (touched workspaces), relevant vitest files (`assets.*`, `maintenance.*`, `inspections`, `finance`, `contractors`, `inframap` (if present), `roadsync` dashboard, permission parity tests), `npm run db:indexes:check`, `npm run db:seed:demo` + `db:seed:verify` (seeds changed), finally `npm run build:web`.
3. **Identify failures** precisely (first error, file:line, root-cause hypothesis); re-run just the failing command to confirm.
4. **Fix the root cause.** Never delete/skip/weaken tests, add `eslint-disable`/`@ts-ignore`/`any`, loosen authorization, maker–checker or gate rules, special-case test data, or invent scores to satisfy a test. Pre-existing baseline failures: list and work around narrowly.
5. **Re-run.** **Max 3 repair iterations per distinct failure.** If still failing, stop that thread and record it under "Unresolved" (error text, hypotheses tried, what you need) — **never hide or downplay** unresolved errors or flaky behaviour; don't loop further.
6. When critical checks are green, self-review against §10 before committing.
7. Keep a ≤ 12-line check log (command → pass/fail → fix) for the report.

---

## 7. (reserved — merged into §8)

---

## 8. IMPLEMENTATION SEQUENCE (commit at each ✔; don't advance until checks for it are green)

1. Preflight + branch (§3, §11).
2. **Permissions & enums:** `asset.conversion.approve`, grants, new enums/statuses (operational status, origin, maintenance statuses/priority/origin, inspection type `ASSET_CONDITION`), parity tests, propagation path. ✔
3. **Models, indexes, backfill:** `Asset` extension, `assetConversions`, `assetConditionAssessments`, `MaintenanceRecord` extension, `maintenanceEvidence`, `Inspection.assetId` + ASSET_CONDITION template, `check-indexes`, backfill scripts. ✔
4. **Pure logic (+ tests):** conversion gates, maintenance transition table, condition rules `k1`, health rules `h1`, cache refresher contract, coordination mapping table. ✔
5. **Conversion service + routes** (preview, request, cancel, approve/reject with in-transaction gate re-check, asset creation, add-asset). ✔
6. **Asset services + routes** (directory, summary, passport, edit/status, timeline, export, manual assessments). ✔
7. **Inspection integration:** ASSET_CONDITION approval → assessment + cache refresh (Batch 06 workflow untouched otherwise). ✔
8. **Maintenance service + routes + evidence + recurrence + status coupling.** ✔
9. **Health service + cache refresh script + coordination facade endpoint.** ✔
10. **Phase 8 integration** (links/selection, attention rule check) — only if Phase 8 is on the base. ✔
11. **Seeds + reset/verify.** ✔
12. **Frontend foundation:** routes, nav, API clients, messages skeleton, badges/chips, gauge, stepper, timeline components. ✔
13. **Assets dashboard/directory + passport (all tabs) + print view.** ✔
14. **Conversion wizard + approvals queue + project page CTA/asset card.** ✔
15. **Maintenance UI (queue, calendar reuse, drawer, dialogs, evidence).** ✔
16. **Coordination insights page.** ✔
17. i18n (si/ta) completion + responsive/a11y/visual polish (375/768/1280). ✔
18. **Final Integration Review (§9)**, self-healing loop, cleanup, push, PR text. ✔

---

## 9. FINAL INTEGRATION REVIEW — PHASE 9 (do this after Step 17; report results)

Run and record a pass/fail with notes for each (fix root causes via the self-healing loop; list unresolved items):
1. **End-to-end lifecycle on seeded demo data**, as the right roles, in the browser: register contractor (Batch 04) → assign → budget/payment with verified-progress gate (Batch 05) → schedule inspection → report with photos on a 375 px viewport → reviewer approves → verified progress appears on project + finance + contractor indicators (Batch 06) → complete project → **convert to assets** → approval by a different GOV_ADMIN → assets visible on InfraMap (if Phase 8 present) → ASSET_CONDITION inspection verified → health score appears → maintenance request → approve → schedule → start → complete (note: condition unchanged until a new assessment) → coordination insights page shows RoadSync scorecards with fairness states.
2. **Permission matrix consolidation:** print one table of role × {contractor, finance, inspection, asset, maintenance, insights} actions actually enforced by the routers (derive from route guards + seeds, not from memory); verify SUPER_ADMIN is read-only where intended, CONTRACTOR/CITIZEN denied everywhere, inspectors limited to their work; every grant change made in Batches 04–07 listed once.
3. **Cross-module consistency:** `Project.contractorId` ⇄ assignments; `Project.financialProgress` cache; `Project.verifiedProgress`; `Asset` caches vs latest assessment/maintenance; no orphaned evidence/documents; index check green; seeds idempotent twice in a row; reset-demo leaves nothing behind (GridFS included).
4. **Security review:** scope/404 behaviour for each new router (spot-check with two agencies), no sensitive fields in list endpoints, evidence only via authenticated streaming, CSV injection safe, rate limits present on mutations/exports, audit snapshots allowlist-only, no secrets/real data committed.
5. **Integrity review:** money paths use integers only; all multi-document writes transactional; concurrency tests (approvals/decisions) present and green; no endpoint that writes `Project.physicalProgress` outside progress submission; no path that edits approved/verified/paid records in place.
6. **UX review:** nav items per role, no dead links, consistent status chips/steppers/dialogs across Batches 04–07, i18n key parity (en/si/ta) across all four batches' dictionaries, 375/768/1280 screenshots-by-inspection of: contractors directory, finance project workspace, inspections calendar + report editor, asset passport, conversion wizard, maintenance drawer, coordination insights; keyboard-only pass through two dialogs per module; reduced-motion.
7. **Regression:** RoadSync, ProjectTrace, Phase 8 InfraMap (if present) behave as before; run the full `npm run test:api`, `npm run test:web`, `npm run build:web`, `npm run lint`, `npm run type-check`; list pre-existing failures separately from new ones.

---

## 10. WHAT MUST NOT HAPPEN (self-check before pushing)
- A control that renders but does nothing; dead links; "coming soon" UI; fake chart data; mock values presented as real.
- A health/trend/coordination number where evidence is insufficient; legacy condition presented as verified; ranking of agencies with insufficient data; new scoring math in the coordination facade.
- Maintenance completion silently changing condition; assessments edited in place; conversions that edit/replace the project; duplicate conversions; assets created without a transaction.
- Self-approval (conversion, maintenance, inspection decisions); SUPER_ADMIN gaining new write powers; CONTRACTOR/CITIZEN access.
- Evidence outside authenticated streaming; duplicated validators/storage code; unvalidated uploads.
- Float money; cross-agency leakage; sensitive values in audit snapshots/URLs/logs.
- New dependencies, AI, secrets, real data; weakened/skipped tests; hidden unresolved errors.
- Colour-only status; hover-only mobile affordances; tap targets < 44 px; horizontal scroll on phones.

---

## 11. GITHUB WORKFLOW

- **Base:** `development` once Batches 04, 05, 06 (and RoadSync Steps 74–80) are merged (else §3.2).
- **Branch:** `feature/infrastructure-asset-lifecycle` (adapt to repo convention).
- **Commits (Conventional Commits, one per ✔):**
  1. `feat(assets): asset-lifecycle permissions, enums and parity tests (Steps 103-107 foundation)`
  2. `feat(assets): extend asset and maintenance models, add conversions, assessments and maintenance evidence with backfill`
  3. `feat(assets): conversion gates, condition rules, health rules and maintenance workflow logic`
  4. `feat(assets): project-to-asset conversion with approval workflow (Step 103)`
  5. `feat(assets): asset directory, passport, timeline and manual assessments (Step 104)`
  6. `feat(assets): inspection-verified condition assessments (Step 105)`
  7. `feat(maintenance): maintenance workflow, evidence, recurrence and operational status coupling (Step 105)`
  8. `feat(assets): explainable health indicators and cache refresh (Step 106)`
  9. `feat(insights): coordination insights facade over RoadSync scorecards (Step 107)`
  10. `feat(inframap): link assets to full records and map selection`  *(only if Phase 8 is present)*
  11. `chore(seed): synthetic asset lifecycle demo data and verification`
  12. `feat(assets): dashboard, directory, passport and print view UI`
  13. `feat(assets): conversion wizard, handover readiness and approvals queue UI`
  14. `feat(maintenance): queue, calendar, drawer and completion UI`
  15. `feat(insights): agency coordination insights page`
  16. `feat(assets): si/ta copy, responsive and accessibility polish`
  17. `test(assets): gates, workflows, health rules, scoping and integration essentials`
  18. `chore(phase9): final integration review fixes`
- Before each commit: type-check + lint touched workspaces. Never commit `.env*`, secrets, real data or `node_modules`.
- **Push:** `git push -u origin feature/infrastructure-asset-lifecycle` (no force). **Do not merge.** PR into `development` (squash): title `feat(assets): Phase 9 Batch 07 — asset conversion, condition, maintenance, health and coordination insights (Steps 103–107)`; body = shipped features per step, endpoints, collections/indexes, permission grant changes + the **command to apply grants to existing databases**, behaviour changes (maintenance statuses, inspection type, asset caches), backfill/recompute instructions, the Final Integration Review table, verification results incl. the self-healing check log, known gaps, decisions needed. If you can't open the PR, give me the exact title/body.

---

## 12. COMPLETION CRITERIA (all must be true)

- [ ] **Step 103:** conversion wizard with live gates, handover capture, maker–checker approval, transactional asset creation with traceability, duplicate prevention, project preserved; additions only for converted projects.
- [ ] **Step 104:** directory, passport (all tabs), lifecycle timeline, ownership/operational status, scope-safe, export, print view, InfraMap links (if Phase 8 present) with caches coherent.
- [ ] **Step 105:** condition assessments (inspection-verified + manual) append-only with issue carry-forward, trend/critical/DLP flags; maintenance request→plan→schedule→execute→complete with evidence, cost, recurrence, derived overdue, repeat-failure flag; maintenance never auto-changes condition.
- [ ] **Step 106:** health indicator with components/weights/caps/evidence level/basis, renormalisation, **no score without a fresh assessment**, explanations and improvement hints, cache + recompute script.
- [ ] **Step 107:** coordination insights page strictly reusing RoadSync scorecards, fairness/min-data states, honest "not available" mapping, correct visibility.
- [ ] Permissions applied via the documented idempotent path; consolidated matrix reported; out-of-scope → 404.
- [ ] UI premium, consistent with Batches 04–06, responsive (375/768/1280), accessible, en/si/ta complete; **every control functional**.
- [ ] No new dependencies, no AI, no real data, no duplicated systems; seeds idempotent with reset/verify; backfills/recompute scripts work.
- [ ] **Final Integration Review (§9) completed and reported.** Self-healing loop executed; all critical checks green or explicitly **Unresolved**; branch pushed; PR text ready.

---

## 13. FINAL REPORT (short — Phase 9 wrap-up)

(1) Preflight findings and deviations from §2 (printed permission matrix, which prerequisites were on the base, Phase 8 presence); (2) what shipped per step (103/104/105/106/107) incl. unique functions (Handover Readiness gates, Asset Passport + print, Lifecycle timeline, Defects Liability Watch, Health breakdown with hints, coordination fairness states); (3) endpoints, collections, indexes, permissions, enum/audit changes; (4) behaviour changes needing my approval (new/changed grants, maintenance statuses, ASSET_CONDITION inspections, emergency self-approval exception, weights/thresholds `h1`/`k1`); (5) coordination indicator mapping table incl. "not available" rows; (6) verification results + self-healing check log + the **Final Integration Review** table + any **Unresolved**; (7) uncertain translations; (8) a **consolidated Phase 9 permission matrix**; (9) a **Phase 9 demo-day script** (≤ 15 steps, ~8 minutes) following the full lifecycle story; (10) known gaps and sensible future work (R2 storage provider, scheduled recomputation, contractor portal, treasury integration).

Stop after the report. Phase 9 ends here.
