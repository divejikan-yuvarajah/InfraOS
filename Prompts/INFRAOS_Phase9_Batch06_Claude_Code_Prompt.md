# INFRAOS — PHASE 9 · BATCH 06 (STEPS 98–102)
## Inspections: Scheduling & Calendar · Inspector Assignment · Structured Reports · Site Evidence · Progress Verification · Review & Approval Workflow
### Claude Code implementation prompt — copy everything below into Claude Code from the repository root

---

## 0. ROLE AND MISSION

You are a senior full-stack engineer (Next.js/React, Express/Mongoose/MongoDB), a workflow-integrity architect, and a premium mobile-first UI engineer working inside the existing **INFRAOS** monorepo. Implement **Batch 06 of Phase 9 — Steps 98–102** as one cohesive change set:

| Step | Deliverable |
|---|---|
| 98 | **Inspection scheduling**: create, edit, reschedule, cancel; **calendar** (month/week/agenda) + list; upcoming/overdue; in-app reminders |
| 99 | **Inspector assignment**: inspector picker with workload & availability, reassignment with history, **"My work" dashboard** for inspectors |
| 100 | **Inspection reports**: structured, mobile-first report form (checklist, observations, safety, defects, recommendations), autosaved drafts, submit, history |
| 101 | **Site evidence**: secure photo capture/upload (compressed, validated, integrity-hashed), gallery + lightbox, evidence-to-report/checklist association, optional location metadata, secure serving |
| 102 | **Progress verification & approval**: reviewer console, approve / request revision / reject, **claimed-vs-verified** progress, discrepancy handling, re-verification, and **integration into Finance (Batch 05), Contractors (Batch 04) and ProjectTrace** |

This batch turns Batch 04's coarse inspection evidence and Batch 05's "reported — not verified" progress into **real verified progress**. Batch 07 (assets, maintenance, health, coordination scores) comes later — **do not build it**, keep the seams (§4.11).

Deadline-driven university project: **working functionality and a perfect, modern, mobile-first look beat breadth.** Every button, form, filter, calendar interaction, upload, approval action and dialog must really work. No placeholder buttons, no fake charts, no mock data presented as real.

---

## 1. HARD RULES (non-negotiable)

1. **Inspect before you write.** Never invent paths, models, permissions or helpers. §2 is recon at the time of writing — re-verify everything you depend on.
2. **Reuse, don't duplicate.** Extend the existing `Inspection` model, the existing `Document` model (file identity/scope), `resolveResourceScope`/`projectReadFilter`, `inspectorProjectIds`, audit log, notification service, Batch 04 assignments/evidence adapter, Batch 05 progress-source adapter and UI patterns, shared UI/forms, i18n, tokens. No parallel inspection system, no second file registry.
3. **Server-side authorization only**, scope-checked **inside** transactions. UI hiding is never security. Evidence files are **never public** — no public/presigned URLs; every byte is streamed through an authenticated, scope-checked endpoint.
4. **Verified progress is authoritative only after a reviewer approves.** Nothing an inspector submits changes verified progress until a *different* authorized user approves (maker–checker, server-enforced). Contractor/PM **reported** progress (existing `ProgressReport`, append-only) is never overwritten and never relabelled as verified.
5. **Preserve project lifecycle rules.** Verification never changes project status, never writes `Project.physicalProgress` (the reported cache), never edits milestones. It adds separate verified data.
6. **History is never destroyed.** Reassignments, reschedules, submissions, decisions and removed evidence are recorded; submitted reports are snapshotted; audit rows are written inside the same transaction as the change.
7. **No new dependencies** (no multer/sharp/aws-sdk/calendar libs). Use `express.raw` (built into Express), GridFS (built into the Mongo driver), browser Canvas/Geolocation/File APIs, `components/ui/calendar.tsx` (react-day-picker) for date pickers, custom CSS grid for the calendar, custom SVG for charts. No AI, no unrelated refactors, no package upgrades, no heavy tests, no extra Markdown reports (≤ 12 lines appended to existing database docs is fine).
8. **No complex offline sync.** Provide reliable draft autosave, upload progress, retry with backoff and clear status — not a service-worker sync engine.
9. **Never touch `main` or `development` directly; never force-push.** See §10.
10. Read `apps/web/CLAUDE.md` / `AGENTS.md` first — this Next.js version has breaking changes; read the relevant guides in `apps/web/node_modules/next/dist/docs/` before writing Next code.
11. Match conventions: Conventional Commits, `success()/failure()` envelopes, `noStore`, strict zod (reject unknown + repeated keys), `requireAuthenticated` + `requirePermission`, `AuditLog.create` with allowlisted snapshots, `strict: "throw"` schemas, `useWorkspaceLocale()` + message dictionaries, `guard()/moved()` API client pattern.

---

## 2. RECON FINDINGS (re-verify against the code)

**Repo:** npm workspaces `apps/web` (Next 16, React 19, Tailwind 4, shadcn/radix, react-hook-form + zod, react-query), `apps/api` (Express 5, Mongoose 8, zod 4, vitest + mongodb-memory-server), `packages/shared-types`. Flow: feature branch → PR into `development` (squash).

**Inspections today (`apps/api/src/modules/inspections/`):** only `inspection.constants.ts` + `models/inspection.model.ts` — **no routes, services, schemas, pages.** Model (`inspections`, `strict:"throw"`): `projectId`, `inspectorId` (both required refs), `inspectionDate` (required), optional `physicalProgress` (0–100; "zero is a measured result, not missing"), `status` ∈ `SCHEDULED, IN_PROGRESS, SUBMITTED, VERIFIED, REQUIRES_REVIEW, REJECTED, CANCELLED` (default SCHEDULED), `notes` (≤ 5000), `evidence[]` (refs to `Document`, ≤ 50). Indexes `{projectId,inspectionDate}`, `{inspectorId,status,inspectionDate}`. A few demo inspections exist in `seed-supporting-records.ts`; `reset-demo.ts` deletes them.

**State mapping (keep the existing enum — don't rename):** `SCHEDULED` = scheduled + assigned (an inspector is always assigned; the model requires `inspectorId`), `IN_PROGRESS` = started/drafting, `SUBMITTED` = awaiting review (this is "Under review"; a reviewer decides directly), `VERIFIED` = approved (terminal), `REQUIRES_REVIEW` = **revision required** (inspector edits and resubmits), `REJECTED` = rejected (terminal; follow-up = new inspection with `followUpOfId`), `CANCELLED` (terminal). "Closed" = any terminal state. **Overdue is derived, never stored.** Add no new status values.

**Permissions** (`packages/shared-types/src/permissions.ts`): `inspection.assign|read|submit|verify|reject` already exist. Seed grants (`identity/seed/system-role-permissions.ts`; **print and confirm**): `inspection.assign` → GOV_ADMIN, AGENCY_OFFICER, PROJECT_MANAGER; `inspection.read` → those + SUPER_ADMIN + INSPECTOR; **`inspection.submit`, `inspection.verify`, `inspection.reject` → INSPECTOR only** (so today the inspector could approve their own report). `document.upload/read/download` are held by INSPECTOR, CONTRACTOR (scope none), staff roles. Required grant change (additive, flagged for my approval in the report): add `inspection.verify` + `inspection.reject` to **GOV_ADMIN and AGENCY_OFFICER** (reviewers); keep INSPECTOR's grants but **enforce reviewer ≠ submitter on the server** (so an inspector can only decide *other inspectors'* reports). SUPER_ADMIN stays read-only. Use the same safe, idempotent permission-propagation path you identified for Batch 05 (sync script / seed / parity tests).

**Scope:** `resolveResourceScope` → INSPECTOR, CONTRACTOR, CITIZEN = `none`; **inspectors reach projects through `inspectorProjectIds(actor)`** = projects with an `Inspection` where `inspectorId = user` (used by `readProject`/`listProjects`/document reads in `resource-scope.ts`). Note it includes CANCELLED inspections (access lingers) — tighten to exclude CANCELLED **only if trivially safe**, otherwise leave and list it in the report. Staff scope: `projectReadFilter`/`projectWriteFilter` (PROJECT_MANAGER narrowing — check `projectWriteFilter` and mirror it).

**Documents/storage reality:** `Document` model (`projectId`, `documentType` ∈ CONTRACT, TENDER, BOQ, INVOICE, APPROVAL, PROGRESS_REPORT, INSPECTION_REPORT, DRAWING, OTHER; `fileName`, `storageUrl`/`storageKey` (select:false, comment "optional until storage integration; never persist presigned URLs"), `uploadedBy`, `mimeType`, `sizeBytes`, `visibility` INTERNAL|PROJECT_TEAM|PUBLIC). **There are no document routes and no storage code.** `.env.example` has empty `STORAGE_PROVIDER`, `R2_*` placeholders; **no storage SDK, multer or sharp is installed**; `app.ts` uses `express.json({limit:"1mb"})`. Deployment target of the API: check (`apps/api/README.md`, root docs) — body-size limits matter.

**Progress today:** `submitProgress` (permission `progress.submit`) appends a `ProgressReport` (claimed %), updates the cache `Project.physicalProgress`; accepted only while ACTIVE (`progress.policy.ts`). `Milestone` (progress, planned/actual dates, status).

**Audit:** allowlisted snapshot (`status`, `reason`, `agencyId`, `contractorId`, `physicalProgress`, `financialProgress`, `budget`, `amount`, `cost`, …; strict); `AUDIT_RESOURCES` already includes `INSPECTION`, `DOCUMENT`. Action regex `/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/`. Notices: `notifications/notice.service.ts` (`notifyCommittedAudit`). Transaction patterns: `roadsync/work-requests.service.ts`, Batch 04/05 services. Atomic counters: the generic counter from Batch 05 (reuse for `INS-YYYY-NNNNNN`).

**Web:** `lib/auth/route-access.ts` **already lists `"inspections"`** and `"documents"` (check whether gated by permission); `components/auth/workspace-nav.ts`; `components/projects/project-record-tabs.tsx`; `components/ui/calendar.tsx` (date picker only — **not** a scheduler); Batch 05 shared components: drawers, payment stepper, dialogs, `money-*`, status badges, insight strip, filter bar patterns, `lib/finance/*`.

**Batch 04 / 05 seams you must connect (verify they exist):** `contractor-evidence.ts` (inspection source "inspection.v1"), `contractor-performance.rules.ts` (`RULE_VERSION "c1"`, indicators 5 & 6, deferred rework/quality rows), `physical-progress.source.ts` (VERIFIED_INSPECTION branch currently reads the latest `VERIFIED` inspection with `physicalProgress`), payment gates array, `finance-intelligence.rules.ts`.

> **BATCH 05 FINAL REPORT / HANDOFF NOTES (authoritative if present — else derive from the code):**
> `[PASTE BATCH 05 REPORT HERE]`

---

## 3. PREFLIGHT (≤ 15 lines, then continue unless blocked)

1. `git fetch origin`; `git status` clean; branch + `git log --oneline -5`.
2. **Are Batches 04 and 05 merged into `origin/development`?** (Look for `contractor-assignment.model.ts`, `physical-progress.source.ts`, `projectBudgetRevisions`.) **Yes** → branch from `development`. **No** → **STOP and ask me**: (A) I merge them first; (B) stack on the Batch 05 branch (`feature/project-finance`); (C) other. Don't guess.
3. `npm install` if needed; Node ≥ 22; baseline `npm run type-check` + projects/contractors/finance tests; list pre-existing failures (don't fix).
4. Re-verify §2: print the exact role→inspection/document permission matrix; find every reader/writer of `Inspection`, `inspectorProjectIds`, `Document`, `Project.physicalProgress`; confirm there is truly no document/storage code; locate how rate limiting is applied in existing routers.
5. **Storage decision:** if `STORAGE_PROVIDER`/R2 code already exists, reuse it. Otherwise proceed with §4.5 (GridFS provider behind a small interface). Check that GridFS works with the project's Mongo connection (`mongoose.connection.db`, `mongoose.mongo.GridFSBucket`) in dev, in tests (mongodb-memory-server) and note the Atlas free-tier size limit in the report.
6. Check the permission-propagation path (same as Batch 05) for the new reviewer grants.
7. Inspect the API deployment (serverless vs long-running) and confirm streaming/raw bodies of ≤ 4 MB are viable; if not, tell me before continuing.

---

## 4. DATA, DOMAIN AND BACKEND

### 4.1 Inspection model — additive extension (same collection)

Add to `inspectionSchema` (all optional unless stated; `strict:"throw"`; keep existing fields and semantics):
- `inspectionNo` (`INS-YYYY-NNNNNN`, unique; backfill existing), `agencyId` (denormalised from the project; backfill), `inspectionType`: `PROGRESS_VERIFICATION | QUALITY | SAFETY | MILESTONE | FINAL_HANDOVER | FOLLOW_UP`, `purpose` (≤ 500), `priority`: `LOW | NORMAL | HIGH | URGENT` (default NORMAL), `locationNote` (≤ 300), `sitePoint` (GeoJSON Point via the existing geometry helpers; default = representative point of the project geometry, never invented), `durationMinutes` (15–480, default 120), `milestoneIds[]` (≤ 10), `followUpOfId?`, `claimedProgressAtSchedule?` (0–100, copied from the latest `ProgressReport` when scheduled — read-only context), `scheduledBy`, `assignmentHistory[]` (≤ 20: `{ inspectorId, assignedBy, assignedAt, reason? }`), `rescheduleHistory[]` (≤ 20: `{ from, to, by, at, reason }`), `startedAt?`, `submittedAt?`, `reviewedBy?`, `reviewedAt?`, `completedAt?`, `cancelReason?`, `cancelledBy?`, `contractorIdsAtInspection[]` (snapshot of contractors with an ACTIVE Batch 04 assignment on the project at `inspectionDate`, captured at submit), `version` (optimistic concurrency).
- **`report`** (embedded working copy, ≤ ~60 KB): `revision` (int, optimistic autosave concurrency), `checklist[]` (≤ 40 `{ key, result: PASS|FAIL|NA|NOT_CHECKED, note? (≤ 500) }`), `siteObservations` (≤ 4000), `workCompletionObservations` (≤ 4000), `safetyObservations?` (≤ 3000), `defects[]` (≤ 30 `{ key, title (≤ 160), description?, severity: MINOR|MAJOR|CRITICAL, location? (≤ 200), reworkRequired: boolean, evidenceIds[]? }`), `followUpChecks[]` (for FOLLOW_UP: `{ parentInspectionId, defectKey, resolved: boolean, note? }`), `recommendations` (≤ 3000), `followUpRequired` (bool) + `followUpNote?`, `measuredProgress?` (0–100 integer, **required for PROGRESS_VERIFICATION / MILESTONE / FINAL_HANDOVER at submit**), `milestoneAssessments[]` (≤ 10 `{ milestoneId, verifiedProgress (0–100) , note? }`), `discrepancyNote?` (required when |measured − claimed| > `DISCREPANCY_THRESHOLD_PP` = 10), `inspectorDeclaration` (bool, required true at submit — "I personally inspected the site").
- **`submissions[]`** (append-only snapshots, ≤ 6): `{ no, submittedAt, submittedBy, reportSnapshot, decision?: { decision: APPROVED|REVISION_REQUESTED|REJECTED, by, at, note?, itemComments[] (≤ 40 {itemKey, comment}) } }`. After the 6th submission a further resubmission is refused (409) — the reviewer must reject and a follow-up is scheduled.
- Keep legacy `notes` (map to `report.siteObservations` view for old rows) and `physicalProgress` (**set to `report.measuredProgress` only when the inspection becomes VERIFIED**; it is *the inspector's approved measurement*, not a claim).
- **Checklist templates are code constants** per `inspectionType` (`inspection-checklists.ts`: stable keys, i18n label keys, `mandatory` flag, `group`), e.g. PROGRESS_VERIFICATION: work-matches-plan, quantities-measured, milestone-status-confirmed, materials-on-site…; QUALITY: surface-finish, compaction/thickness-recorded, materials-compliant, drainage-functional, defects-recorded…; SAFETY: signage, barriers/traffic management, PPE, site-hygiene, incident-log…; FINAL_HANDOVER: works-complete, defects-liability-noted, as-built-documents-sighted, site-cleared… (generic, **no invented regulatory clause numbers**). Templates are versioned (`CHECKLIST_VERSION`) and the version used is stored on the report.
- Indexes (add to `check-indexes.ts`): `{agencyId:1,status:1,inspectionDate:1}`, `{projectId:1,status:1,inspectionDate:-1}`, `{inspectorId:1,status:1,inspectionDate:1}` (exists variant), `{status:1,submittedAt:1}`, `{followUpOfId:1}`, `{contractorIdsAtInspection:1,status:1}`.
- **Backfill script** `scripts/backfill-inspections-batch06.ts` (+ `db:backfill:inspections`, dry-run default, `--commit`): numbers + `agencyId` + defaults for existing rows; idempotent; never invents progress.

### 4.2 `inspectionEvidence` (new collection; file identity stays in `Document`)

`inspectionEvidence` (`strict:"throw"`): `inspectionId`, `projectId`, `agencyId`, `documentId` (ref `Document`, documentType **`SITE_EVIDENCE`** — add to `DOCUMENT_TYPES` and shared enums), `thumbDocumentId?`, `caption` (≤ 300), `checklistItemKey?`, `defectKey?`, `capturedAt` (client time, validated: not in the future +5 min, not older than 14 days before the inspection date), `uploadedAt`, `uploadedBy`, `location?` `{ point (GeoJSON), accuracyM (≤ 5000), source: "DEVICE" }` (**optional, user-consented, never required**), `sha256` (of the full image, server-verified), `width`, `height`, `sizeBytes`, `status`: `PENDING_UPLOAD | ACTIVE | REMOVED`, `removedBy?`, `removedAt?`, `removalReason?`, `sitePresence?` (server-computed, §4.7). Indexes `{inspectionId:1,status:1}`, `{projectId:1,uploadedAt:-1}`, `{documentId:1}`; uniqueness `{inspectionId:1, sha256}` (partial: status ≠ REMOVED) to block duplicate photos.
Also append the evidence `documentId`s to `Inspection.evidence[]` for compatibility with existing readers (cap 50 → enforce per-inspection evidence cap **30**).

### 4.3 Verified progress: `progressVerifications` (new, append-only)

Created **only** when a progress-affecting inspection (PROGRESS_VERIFICATION, MILESTONE, FINAL_HANDOVER with `measuredProgress`) is **approved**, inside the same transaction as the approval:
`projectId`, `agencyId`, `inspectionId`, `submissionNo`, `verifiedPercent` (0–100 integer), `claimedPercent` (the latest `ProgressReport.reportedPercent` at decision time, or `null`), `discrepancyPp` (verified − claimed, integer, `null` if no claim), `milestones[]` (`{ milestoneId, claimedProgress (milestone.progress), verifiedProgress }`), `inspectorId`, `reviewerId`, `asOf` (= inspection date), `status`: `ACTIVE | SUPERSEDED`, `supersededBy?`, `note?`, `contractorIds[]`. Append-only hooks like `ProgressReport`; only `status/supersededBy` may change (via a dedicated function) when a newer verification (by `asOf`, then `createdAt`) is created for the same project.
- **Project cache (additive, optional):** `Project.verifiedProgress = { percent, asOf, verificationId }`, written only in that transaction. **Never write `Project.physicalProgress`.**
- **Rules:** allowed when project status ∈ `ACTIVE, DELAYED, ON_HOLD, COMPLETED`; a verification older (by `asOf`) than the current ACTIVE one is stored but **does not** become ACTIVE (it's `SUPERSEDED` at birth) — re-verification is simply a newer approved inspection; verified % may be lower than before (regression is allowed with the inspector's note — it is evidence). Discrepancy |verified − claimed| > 10 pp → inspection requires `discrepancyNote` (inspector) **and** reviewers see a prominent discrepancy panel; an approved large discrepancy emits a notice to the project manager and the agency GOV_ADMIN (reuse the notice hook; best-effort).
- No milestone is edited by verification. The UI shows "Suggested follow-up: review milestone X" with a link to the existing milestone page.

### 4.4 Workflow engine (single pure transition table + service)

`inspection-workflow.ts` (pure; unit-tested) defines allowed transitions, actors and preconditions; the service applies each as **one atomic `findOneAndUpdate` with the expected status (and `version`) in the filter inside a Mongo transaction** that also writes the audit row, the notices (after commit), and any dependent records.

| Transition | Actor / permission | Preconditions | Effects |
|---|---|---|---|
| **Schedule** (create) → SCHEDULED | `inspection.assign`, project write scope | project status ∈ APPROVED, ACTIVE, ON_HOLD, DELAYED, COMPLETED; inspector valid (§4.6); date not in the past (> now − 1 h); type-specific rules (FINAL_HANDOVER requires project ACTIVE/COMPLETED; FOLLOW_UP requires `followUpOfId` terminal inspection of the same project) | number, `claimedProgressAtSchedule`, `assignmentHistory[0]`, notice to inspector |
| **Edit** SCHEDULED | `inspection.assign` | status SCHEDULED, `version` match | audit changed field names |
| **Reschedule** | `inspection.assign` (or the assigned inspector may *request*? **no — assigners only**) | status SCHEDULED or IN_PROGRESS; reason ≥ 12; new date valid; inspector availability warning | history entry, notice |
| **Reassign** | `inspection.assign` | status SCHEDULED/IN_PROGRESS; new inspector valid and ≠ current; reason ≥ 12; if IN_PROGRESS the report draft transfers with an audit note | history entry, notices to both inspectors; previous inspector loses access via `inspectorProjectIds` |
| **Cancel** → CANCELLED | `inspection.assign` | status SCHEDULED/IN_PROGRESS; reason ≥ 12 | evidence bytes of a never-submitted inspection retained 30 days then eligible for cleanup script (don't build the cron; document) |
| **Start** → IN_PROGRESS | assigned inspector (`inspection.submit`) | status SCHEDULED; now ≥ `inspectionDate − 24h` (const `START_WINDOW_HOURS`) | `startedAt` |
| **Save draft** | assigned inspector | status IN_PROGRESS or REQUIRES_REVIEW; `report.revision` match | autosave; no audit row per save (audit only on submit/decisions) |
| **Submit** → SUBMITTED | assigned inspector | all mandatory checklist items answered (PASS/FAIL/NA); every FAIL has a note; ≥ `MIN_EVIDENCE` photos (PROGRESS_VERIFICATION/FINAL_HANDOVER: 2; others: 1; FAIL items or CRITICAL defects must each have ≥ 1 linked photo); `measuredProgress` for progress-affecting types; `discrepancyNote` if over threshold; declaration true; submission count < 6 | snapshot appended to `submissions[]`, `submittedAt`, `contractorIdsAtInspection` computed, notices to reviewers |
| **Approve** → VERIFIED | `inspection.verify`, reviewer ≠ submitter, in scope | status SUBMITTED; `acknowledgeDiscrepancy:true` if discrepancy > threshold | `physicalProgress` set, `progressVerifications` created + `Project.verifiedProgress` (progress-affecting types), decision recorded, `completedAt`, notices (inspector, PM) |
| **Request revision** → REQUIRES_REVIEW | `inspection.verify` **or** `inspection.reject`, reviewer ≠ submitter | SUBMITTED; note ≥ 12; optional item comments | decision recorded; notice to inspector; report editable again |
| **Reject** → REJECTED | `inspection.reject`, reviewer ≠ submitter | SUBMITTED (or REQUIRES_REVIEW at the 6-submission cap); note ≥ 12 | terminal; notices; UI offers "Schedule follow-up inspection" (new FOLLOW_UP/same type with `followUpOfId`) |

Illegal transitions → 409 `CONFLICT` with the current status. All terminal states are read-only; evidence on terminal inspections cannot be added/removed. **Reviewer ≠ submitter** compares against `submissions[last].submittedBy` (and `inspectorId`).

### 4.5 Evidence storage and handling (no new dependencies)

`evidence-storage.ts` — interface `EvidenceStorage { put(key, stream|buffer, meta), openStream(key), delete(key) }`; **default `gridfs` provider** (bucket `inspectionEvidence`, via `mongoose.mongo.GridFSBucket`); `STORAGE_PROVIDER` empty or `gridfs` → GridFS; `r2` → respond 503 `STORAGE_NOT_CONFIGURED` with a clear message (R2 is a future drop-in behind the same interface; say so in a comment). Store only the opaque `storageKey` in `Document` (never URLs/credentials).

**Upload protocol (two steps, retry-safe):**
1. `POST /inspections/:id/evidence` (JSON): `{ caption, checklistItemKey?, defectKey?, capturedAt, location?, sha256, mimeType, width, height, sizeBytes, thumb: { sizeBytes, sha256 } }` → creates `PENDING_UPLOAD` evidence + `Document` rows, returns ids.
2. `PUT /inspections/evidence/:evidenceId/file?variant=full|thumb` with a **raw binary body** (`express.raw({ type: ["image/jpeg","image/png","image/webp"], limit: "4mb" })` scoped to this route only; `express.json` stays 1 MB globally). Server: checks scope + status, **validates magic bytes** (JPEG `FF D8 FF`, PNG, WebP `RIFF…WEBP`) against the declared mime, enforces size caps (full ≤ 4 MB, thumb ≤ 150 KB, dimensions declared ≤ 4096), **recomputes SHA-256 and compares** to the declared hash (mismatch → 422), writes to storage, marks `ACTIVE` once `full` is stored (thumb optional → UI falls back to full), is idempotent on retry (same variant + same hash → 200). Rejects anything else (SVG, GIF, HEIC — client converts via canvas; message tells the user).
3. `GET /inspections/evidence/:evidenceId/file?variant=thumb|full` — authenticated + scope-checked (assigned inspector; staff in project scope with `inspection.read`/`document.read`; 404 otherwise), streams with `Content-Type` from the stored (validated) mime, `Content-Disposition: inline`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, max-age=300`. **No public or presigned URLs.**
4. `PATCH /inspections/evidence/:evidenceId` (caption, checklist/defect link — inspector while IN_PROGRESS/REQUIRES_REVIEW), `DELETE …` → soft `REMOVED` with reason (≥ 5 chars) allowed only while IN_PROGRESS/REQUIRES_REVIEW by the uploader; bytes are deleted only if the inspection has never been submitted, otherwise retained (accountability) but never served after removal except to reviewers viewing snapshots.
- **Limits:** 30 active photos per inspection; per-user upload rate limit (e.g., 60 files / 10 min) with the existing limiter helper; reject duplicate hash within the inspection (409 with the existing evidence id).
- **No EXIF trust:** the client strips EXIF by re-encoding through canvas; the server never reads EXIF; location comes only from the explicit consented field.
- Cleanup of orphaned `PENDING_UPLOAD` rows older than 24 h: provide `scripts/cleanup-evidence.ts` (dry-run default) — don't schedule it.

### 4.6 Inspector assignment support
- `GET /inspections/inspectors?projectId=&from=&to=` (`inspection.assign`, project write scope): active users with role INSPECTOR whose `agencyId` is within the assigner's scope agencies (platform: any), returning **minimal** fields `{ id, name, agencyId, agencyName, openCount, upcoming14dCount, nextSlot?, conflicts[]? }` — name is shown to assigners; no email/phone. `conflicts` = the inspector's other non-terminal inspections overlapping `[from, from+duration]` (WARN in UI, not a block). Never expose users outside scope.
- Validation: inspector must be ACTIVE, role INSPECTOR, in scope; assignment to a project outside the inspector's agency scope is allowed only for platform users (document).
- `GET /inspections/my` (`inspection.read` + role INSPECTOR *or* anyone with `inspection.submit`): the caller's work: today, upcoming, in-progress drafts, revisions requested, recent decisions.

### 4.7 Site Presence Check (unique function, informational only)
When evidence carries `location`, the server computes `sitePresence` = `{ distanceM, status: ON_SITE (≤ 300 m) | NEAR_SITE (≤ 1500 m) | AWAY (> 1500 m), basis: "project_geometry"|"inspection_site_point" }` using a small haversine helper against the inspection `sitePoint` or (for line/polygon projects) the nearest vertex of the project geometry (capped vertex sampling). It is **displayed to reviewers as context** ("Photo taken ~120 m from the site"), never blocks anything, and never shown for evidence without consented location. Thresholds are constants documented once.

### 4.8 Endpoints (NEW; mount `/api/v1/inspections`)
All: `requireAuthenticated`, permission(s), scope (inspector: own `inspectorId`; staff: `projectReadFilter` / `projectWriteFilter`), out-of-scope → **404**, strict zod (unknown/repeated keys → 400), `noStore` (except the evidence file GET), envelopes, rate limits (tighter on mutations/uploads), allowlisted responses, audit on state changes, `maxTimeMS` on aggregates.

| Method + path | Permission | Purpose |
|---|---|---|
| `GET /inspections` | `inspection.read` | List (filters: `q`, `status` CSV, `type`, `priority`, `projectId`, `inspectorId`, `agencyId`, `dateFrom/dateTo`, `overdue`, `needsReview`, `mine`, `sort`, `page`, `limit` ≤ 50) + facet counts. |
| `GET /inspections/calendar` | `inspection.read` | Compact items for a `[from,to]` window ≤ 62 days (id, no., title, project code/title, time, duration, priority, status, inspector name, overdue flag), capped 500, same filters. |
| `GET /inspections/summary` | `inspection.read` | Dashboard: counts (upcoming 7 d, in progress, awaiting review, revision required, overdue, verified last 30 d), review turnaround median with sample size, outcome distribution (90 d), verification-gap list (top 5 projects by |claimed − verified| with basis), items needing the caller's action. |
| `POST /inspections` | `inspection.assign` | Schedule. |
| `GET /inspections/:id` | `inspection.read` | Full detail (report, submissions, history, evidence metadata, claimed vs measured, verification link); tiering: inspector sees own; reviewers see snapshots; **no `assignmentHistory` user emails**. |
| `PATCH /:id` · `POST /:id/reschedule|assign|cancel` | `inspection.assign` | §4.4. |
| `POST /:id/start` · `PUT /:id/report` · `POST /:id/submit` | `inspection.submit` (assigned inspector) | §4.4. |
| `POST /:id/decision` | `inspection.verify` / `inspection.reject` | Body `{ decision: "APPROVE"|"REQUEST_REVISION"|"REJECT", note?, itemComments?, acknowledgeDiscrepancy? }`; permission checked per decision. |
| Evidence routes | `inspection.submit` (write), `inspection.read` (read) | §4.5. |
| `GET /inspections/inspectors` · `GET /inspections/my` | §4.6 | |
| `GET /inspections/:id/checklist` | `inspection.read` | Template + version for the type (so web and API never drift). |
| `GET /projects/:projectId/inspections` | `inspection.read` + project scope | Project inspections tab data (+ open findings, latest verification). |
| `GET /projects/:projectId/verified-progress` | `project.read` + `progress.read` | Claimed vs verified history series (verifications + progress reports) for charts; claims labelled *reported*. |
| `GET /contractors/:id/inspection-outcomes` | `contractor.performance.read` | Powers the contractor profile (also feeds the evidence adapter). |

### 4.9 Notifications & reminders (reuse hook; best-effort, never roll back)
Assigned/reassigned/rescheduled/cancelled → inspector; submitted → reviewers (holders of verify/reject in scope, excluding the submitter); approved/revision/rejected → inspector + project manager; large discrepancy → PM + GOV_ADMIN; **reminders** (due in 24 h, overdue) are **computed on read** for the dashboard/my-work and emitted lazily as notices at most once per inspection per state per 24 h if the notice service supports dedupe — **no cron**; otherwise dashboards only (say which you did).

### 4.10 Audit
Actions: `inspection.scheduled|updated|rescheduled|reassigned|cancelled|started|submitted|approved|revision_requested|rejected|evidence_added|evidence_removed`. Snapshot keys only from the allowlist (`status`, `reason`, `agencyId`, `contractorId`, `physicalProgress`); never store report text, captions, coordinates or hashes in audit rows (they live in the inspection record). Add nothing else to the allowlist unless unavoidable (then minimal + commented).

### 4.11 Integration changes in earlier batches (small, careful, tested)
1. **Batch 05 `physical-progress.source.ts`:** replace the VERIFIED_INSPECTION branch with the **latest ACTIVE `progressVerifications`** (value, `asOf`, `sourceRef = verificationId`); fall back to reported progress (REPORTED_UNVERIFIED) then NONE — same return contract. Add payment gate **`INSPECTION_HOLD`** (WARN): latest concluded inspection of the project is REJECTED, or the latest verified report has an open CRITICAL defect (unresolved by a later follow-up). Update Batch 05 seeds/tests that fabricated a VERIFIED inspection to use a verification record.
2. **Batch 04 `contractor-evidence.ts` + rules:** replace "inspection.v1" with structured evidence attributed through `contractorIdsAtInspection`: outcomes (VERIFIED / REVISION cycles / REJECTED), defects by severity, `reworkRequired` defects, follow-up resolution, claimed-vs-verified discrepancies. Enable the greyed rows: **rework frequency** (inspections with ≥ 1 `reworkRequired` defect ÷ concluded inspections; min sample 3), **outstanding quality findings** (unresolved MAJOR/CRITICAL defects), and make indicator 6 (**unverified progress claims**) computable from `progressVerifications` (claimed − verified > 10 pp). Add risk flags `FAILED_INSPECTIONS` (now real), `UNRESOLVED_QUALITY`, `UNVERIFIED_CLAIMS`, `EXCESSIVE_REWORK`. **Bump `RULE_VERSION` to `"c2"`**, keep thresholds in one place, keep the insufficient-evidence behaviour, update rule tests. Contractor profile "Inspections" section shows outcomes + findings with deep links.
3. **ProjectTrace:** project record gets an **Inspections** tab (gated by `inspection.read`), the overview shows **Reported X % · Verified Y % (as of date, basis)** next to the existing dual bar (don't change the existing bar's semantics), the progress page shows a "Request verification inspection" button (users with `inspection.assign`; opens the schedule dialog prefilled with the current claimed %).
4. **`resource-scope.ts`:** only if needed, adjust `inspectorProjectIds` as noted in §2; don't weaken anything.

### 4.12 Seeds (small, clearly synthetic)
Idempotent; reuse helpers; update `reset-demo.ts`/`verify-demo.ts` (also GridFS evidence + new collections). Create ≥ 10 inspections across all statuses and types (incl. one overdue SCHEDULED, one REQUIRES_REVIEW with item comments, one REJECTED with a FOLLOW_UP scheduled), reports with checklists/defects, ≥ 3 evidence items using a **tiny synthetic placeholder image generated in code** (labelled "(Synthetic placeholder)" in the caption), ≥ 2 `progressVerifications`: one **consistent** with reported progress and one with a **discrepancy** (e.g., claimed 55 % vs verified 40 %), and make the Batch 05 "spending-ahead" project use a real verification so CONFIRMED conclusions are demonstrable. Use existing demo users (inspector, officers). Mark every description "(Synthetic)". No real people/sites.

---

## 5. FRONTEND — PERFECT, MODERN, MOBILE-FIRST UI/UX

### 5.1 Routes, navigation, files
`/inspections` (overview + list/calendar), `/inspections/my` (inspector work dashboard), `/inspections/review` (reviewer queue; can be a tab of the overview), `/inspections/[id]` (workspace), `/inspections/[id]/report` (mobile-first report editor). Add **Inspections** (ClipboardCheck icon, `i18n` si/ta) to `workspace-nav.ts` gated on `inspection.read`; INSPECTOR's default landing = `/inspections/my`; `route-access.ts` already has the segment — add/adjust the permission gate and its test. Project record: **Inspections** tab + overview Reported/Verified chips + progress-page button (§4.11). Contractor profile: Inspections section.

Suggested files (adapt to conventions): `components/inspections/{inspections-dashboard,inspection-insight-strip,inspection-filters,inspection-table,inspection-calendar,calendar-month,calendar-week,calendar-agenda,schedule-dialog,inspector-picker,workload-lens,reschedule-dialog,reassign-dialog,cancel-dialog,my-work-client,inspection-card,inspection-workspace,inspection-timeline,report-editor,report-stepper,checklist-step,observations-step,defects-step,evidence-step,progress-step,review-submit-step,autosave-indicator,evidence-capture,evidence-uploader,evidence-gallery,lightbox,authed-image,review-console,decision-dialog,verification-compare,discrepancy-panel,site-presence-badge,inspection-badges,project-inspections-tab,verified-progress-chip}.tsx`; `lib/inspections/{api.ts,types.ts,checklists.ts (mirror ids only; text from messages),list-query.ts,schemas.ts,messages.ts,view.ts,image-pipeline.ts,upload-queue.ts,calendar-math.ts,use-authed-image.ts}` (+ small tests for pure helpers).

### 5.2 Design language (extend Batch 04/05 tokens and patterns)
- Same calm, high-trust surfaces as Batch 05; status always icon + label: Scheduled 🗓, In progress ▶, Submitted ⬆ (awaiting review), Revision required ↺, Verified ✔, Rejected ✖, Cancelled ⊘, **Overdue** ⚠ (derived badge); priority chips (Urgent/High/Normal/Low) with distinct icons.
- **Inspection stepper** (Scheduled → Started → Submitted → Decision) with actor + time, branches for revision/reject/cancel; used on cards, drawer and workspace.
- Motion ≤ 200 ms, reduced-motion respected; skeletons everywhere; optimistic UI only for local UI state — **workflow transitions wait for the server**.
- Accessibility: focus rings, aria-labels/live regions, trap focus in dialogs/lightbox, Escape closes, keyboard-operable calendar (arrow keys move days, Enter opens), tap targets ≥ 44 px.

### 5.3 Screens (each with loading / empty / error / forbidden states and full functionality)

**A. Inspections overview (`/inspections`)**
- Header: scope chip, **Schedule inspection** (with `inspection.assign`), view toggle **List · Calendar · Review queue**.
- **Insight strip** (click-to-filter): Upcoming 7 d · In progress · Awaiting review · Revision required · Overdue · Verified (30 d).
- **Needs my action** inbox (role-aware: inspectors → start/continue/revise; reviewers → review; assigners → overdue/unassigned issues) with inline buttons that open the real flows.
- Filter bar (search, status chips, type, priority, project select, inspector select, agency, date range, "Overdue", "Mine") with applied-chips + URL state + server-side filtering.
- **List**: table with inspection no., project, type, date/time, inspector, status stepper-mini, priority, evidence count, discrepancy chip; row → workspace; row menu (Open, Reschedule, Reassign, Cancel — only if allowed, each opening a real dialog).
- **Calendar (unique function)**: Month / Week / Agenda; today marker; coloured-by-status chips **with icons**; priority ring; click empty slot → schedule dialog prefilled with that date/time; click event → quick popover (key facts + Open / Reschedule); **overdue** events pinned with warning styling; per-day "+N more" popover; mini-month navigator (existing `calendar.tsx`) + prev/next/today; filters apply; timezone **Asia/Colombo** explicit; keyboard navigation; **mobile = Agenda by default** (day groups, swipe-free, large rows) with a week strip.
- **Insights row (assigners/reviewers):** review turnaround (median + sample size, "not enough data" under 5), outcome donut (Verified/Revision/Rejected, 90 d), **Verification gaps** list (top projects by claimed − verified, basis badges) linking to the compare view.

**B. Schedule / reassign flow**
- Dialog (stepper on mobile): project (scope-limited search-select; shows status + claimed progress + last verification), type (changes checklist preview), purpose, date + time + duration (end time computed), priority, location note (+ "Use project location" reading `sitePoint`), milestones (multi-select from the project), follow-up parent (when type FOLLOW_UP), **Inspector picker with Workload Lens (unique function)**: inspector cards with open-count, next-14-day load bar, nearest free slot, **conflict warnings** for overlapping inspections (WARN, assignable anyway), searchable; submit with pending state; server errors on fields; success toast with inspection number + "View".
- Reschedule/Reassign/Cancel dialogs: reason ≥ 12, impact summary (draft exists? evidence count?), confirm.

**C. Inspector "My work" (`/inspections/my`) — mobile-first**
- Greeting + today's date; **Today** cards (time, project code/title, locationNote, priority, status, distance-free address text, "Start inspection" / "Continue draft" / "Revise" primary button), **Upcoming**, **Revisions requested** (with reviewer comment preview), **Recent decisions**; pull-to-refresh-like Refresh button; empty states ("Nothing scheduled today").
- Offline-aware banner (navigator.onLine) — informational only.

**D. Report editor (`/inspections/[id]/report`) — the premium mobile experience**
- Full-screen stepper with a progress bar and sticky bottom bar (Back · Save status · Next); steps: **1 Overview** (project, claimed progress, milestones to assess, declaration later) → **2 Checklist** (grouped; each item = large segmented control PASS/FAIL/NA with note field appearing on FAIL; "mark all NA in group" helper; counts) → **3 Observations** (site / work completion / safety text areas with character counters) → **4 Defects** (add/edit defect cards: title, severity chips, location, rework toggle, link photos) → **5 Evidence** → **6 Progress assessment** (measured % slider + numeric input, claimed % shown, **live discrepancy meter**, per-milestone verified inputs, discrepancy note required when > 10 pp) → **7 Review & submit** (completeness checklist with jump-to links for missing items, recommendations/follow-up, declaration checkbox, Submit with pending state).
- **Autosave (unique function):** debounced (~1.5 s) `PUT /report` with `revision` token; indicator "Saving… / Saved 14:05 / Couldn't save — retrying" with exponential backoff (max ~6 tries then manual "Retry"); **local draft mirror** in `localStorage` (try/catch, versioned key per inspection, cleared on successful save) offered for recovery if the server copy is older; stale revision (409) → "Updated elsewhere — reload" dialog with a diff-free choice (Keep mine / Load server copy); leaving with unsaved changes warns.
- **Evidence capture & upload (unique function):** `<input type="file" accept="image/*" capture="environment" multiple>` plus gallery pick; client pipeline: decode → orient → resize (max 1600 px long edge) → JPEG ~0.8 (≈ ≤ 500 KB) + 320 px thumb; compute SHA-256 (`crypto.subtle`); optional **"Attach my location"** toggle (explicit consent, shows accuracy, never default-on); caption + link to checklist item/defect; **upload queue** with per-file progress (XMLHttpRequest for upload progress, auth header from the existing token store, `guard()/moved()` semantics), parallelism 2, retry with backoff, cancel, remove; failures stay visible with a Retry button; duplicates detected by hash with a friendly message; HEIC/unsupported → clear message. Never block the form while uploading; Submit is disabled until required evidence is ACTIVE.
- **Evidence gallery:** responsive grid of authed thumbnails (`use-authed-image`: fetch → blob URL with Authorization, IntersectionObserver lazy-load, cache + revoke on unmount), badges (linked checklist item/defect, 📍 site-presence, ✔ integrity hash), **lightbox** (zoom, pan, next/prev, caption edit, metadata panel incl. captured time, size, hash prefix, location + Site Presence badge, remove with reason) — keyboard + swipe friendly.
- Desktop: two-column layout (stepper rail left, content right, sticky summary), same functionality.

**E. Inspection workspace (`/inspections/[id]`)**
- Hero: number, status stepper, project link, type, priority, date/time, inspector (name only), actions by role/state (Start, Continue report, Reschedule, Reassign, Cancel, Review, Schedule follow-up).
- Tabs: **Overview** (purpose, location note, milestones, claimed vs measured) · **Report** (read-only rendering of the current/snapshot report with checklist results, defects, recommendations; submission selector for history) · **Evidence** (gallery) · **Verification** (compare view, only when applicable) · **History** (timeline from audit + embedded histories: scheduled, assigned, rescheduled, submitted #n, decisions with notes).
- **Mobile:** tabs become a segmented scroller; actions in a sticky bar / bottom sheet.

**F. Review console + decision (unique function: Verification Compare)**
- Reviewer sees: report summary with failed items first, defects by severity, evidence gallery filtered by item, **Verification Compare**: dual gauge **Claimed (reported, unverified) vs Measured (inspector)** with discrepancy chip (pp), milestone table (milestone progress vs assessed), "Reported history" sparkline vs verified points (custom SVG; drawn only with ≥ 2 data points), **Site Presence** badges, previous submissions with their decisions, contractor(s) at inspection (names only).
- Decision dialog (focus-trapped): **Approve** (summary of what will happen: "Verified progress will become N % as of date; Finance and Contractor indicators update"; discrepancy acknowledgement checkbox when over threshold), **Request revision** (note ≥ 12 + per-item comments picker), **Reject** (note ≥ 12; offers to schedule a follow-up after). Submitter cannot decide — the buttons show a clear disabled reason ("Another reviewer must decide your own submissions").
- After approval: success state shows the new verified % chip and links ("View project progress", "View finance impact" if permitted).

**G. Project integration UI**
- Project **Inspections** tab (list + open findings card + latest verification); overview chips "Reported 55 % · Verified 40 % (12 Oct, inspection INS-…)" with basis tooltip; Batch 05 finance screens automatically show the verified basis; the Batch 04 contractor profile shows the new rework/quality indicators and outcomes.

### 5.4 i18n
Complete `en/si/ta` dictionaries for every string (nav, statuses, types, priorities, checklist labels per template, defect severities, calendar labels/month/day names via `Intl`/`date-fns` locales, form labels/hints/errors, upload states, autosave states, decision dialogs, empty/error/forbidden/offline states, aria-labels). **Never translate stored data** (inspection numbers, captions, observations, names). Reuse existing Sinhala/Tamil terminology; flag uncertain translations in the report. Check long strings in the mobile stepper/segmented controls (wrap, don't clip).

### 5.5 API client and state
`lib/inspections/api.ts` with `guard()/moved()`; React Query keys include epoch/userId/roleKey; precise invalidation after each mutation (list, calendar window, summary, workspace, project tab, verified-progress, finance intelligence, contractor performance); abortable queries; uploads via the upload queue (XHR), never logging captions/locations/hashes client-side.

---

## 6. AUTONOMOUS SELF-HEALING LOOP (applies to this whole batch)

At every ✔ checkpoint in §7 and again before the final push:
1. **Implement** the checkpoint.
2. **Run the essential checks** for what you touched: `npm run type-check`, `npm run lint` (touched workspaces), relevant vitest files (`inspections.*`, plus `contractors`, `finance`, `projects` when touched; permission parity tests), `npm run db:indexes:check` (indexes changed), `npm run db:seed:demo` + `db:seed:verify` (seeds changed), finally `npm run build:web`.
3. **Identify failures** precisely (first error, file:line, root-cause hypothesis); re-run just the failing command to confirm.
4. **Fix the root cause.** Never delete/skip/weaken tests, add `eslint-disable`/`@ts-ignore`/`any`, loosen authorization, maker–checker, evidence validation or scope checks, or special-case test data. Pre-existing baseline failures: list and work around narrowly.
5. **Re-run.** **Max 3 repair iterations per distinct failure.** If still failing, stop that thread and record it under "Unresolved" (error text, hypotheses tried, what you need) — **never hide or downplay** unresolved errors or flaky behaviour; don't loop further.
6. When critical checks are green, self-review against §9 before committing.
7. Keep a ≤ 10-line check log (command → pass/fail → fix) for the report.

---

## 7. IMPLEMENTATION SEQUENCE (commit at each ✔; don't advance until checks for it are green)

1. Preflight + branch (§3, §10).
2. **Permissions & enums:** reviewer grants (GOV_ADMIN, AGENCY_OFFICER), `SITE_EVIDENCE` document type, shared enums/constants, parity tests, propagation path. ✔
3. **Models, indexes, backfill:** `Inspection` extension, `inspectionEvidence`, `progressVerifications`, `Project.verifiedProgress`, checklist templates, `check-indexes`, backfill script. ✔
4. **Pure logic:** workflow transition table, validation (submit completeness), discrepancy math, site-presence haversine, calendar-window helpers (+ tests). ✔
5. **Inspection service + routes:** schedule/edit/reschedule/reassign/cancel, inspectors lookup, list/calendar/summary, my-work. ✔
6. **Report + evidence:** start/draft/submit, storage interface + GridFS provider, upload/serve/remove endpoints, validations, limits. ✔
7. **Decision + verification:** approve/revision/reject, `progressVerifications`, project cache, notices, audit, follow-up scheduling. ✔
8. **Integrations:** Batch 05 progress-source + `INSPECTION_HOLD` gate, Batch 04 evidence/rules `c2` + risk flags + endpoint, project endpoints. ✔
9. **Seeds + reset/verify** (incl. GridFS items). ✔
10. **Frontend foundation:** routes, nav, API client, messages skeleton, badges, stepper, authed image hook, image pipeline, upload queue. ✔
11. **Overview/list/calendar/summary + schedule/assign dialogs + workload lens.** ✔
12. **My work + mobile report editor + autosave + evidence capture/gallery/lightbox.** ✔
13. **Workspace + review console + verification compare + decision dialogs.** ✔
14. **Project tab/overview chips/progress-page button; contractor profile Inspections section; Batch 05 finance UI verification of the new basis.** ✔
15. i18n (si/ta) completion + responsive/a11y/visual polish (375/768/1280). ✔
16. Verification (§8), self-healing loop, cleanup, push, PR text. ✔

---

## 8. ESSENTIAL VERIFICATION ONLY

**Automated (small; existing vitest patterns; mongodb-memory-server replica set):**
- **Pure:** transition table (all legal + sample illegal); submit-completeness validator (each missing-item case); discrepancy math & threshold; start-window rule; calendar window helpers (month boundaries, Asia/Colombo); haversine/site-presence; magic-byte validator (valid/forged mime/truncated); checklist template integrity (unique keys, i18n key presence in en/si/ta); image-pipeline sizing math (web).
- **API:** scheduling rules per project status/type; inspector scope (cross-agency inspector → rejected; non-inspector role → rejected); reassign/reschedule/cancel history + access change (old inspector loses access); maker–checker (submitter can't approve/revise/reject; another inspector/reviewer can); each decision's effects (APPROVE creates one ACTIVE `progressVerifications`, supersedes the previous, sets `Project.verifiedProgress`, leaves `physicalProgress` and milestones untouched; REVISION → REQUIRES_REVIEW → resubmit → 6th-submission cap; REJECT terminal + follow-up flow); transactional integrity (simulate failure mid-approval → nothing changes); concurrency (two reviewers deciding simultaneously → exactly one wins); evidence upload (happy path, wrong magic bytes, oversize, hash mismatch, duplicate hash, over 30 cap, removal rules before/after submit, serve endpoint scope: inspector/staff/other-agency 404/CONTRACTOR denied, no public URL anywhere, `nosniff`/`private` headers); autosave `revision` conflicts; 400 on unknown/repeated keys; allowlisted responses; audit snapshots contain only allowlisted keys and no report text/coordinates; integration tests: Batch 05 source returns VERIFIED_INSPECTION only from an ACTIVE verification and `INSPECTION_HOLD` warns; Batch 04 rules `c2` indicators (rework/quality/unverified claims) with sufficient and insufficient samples.
- **Web pure:** list-query ⇄ URL round-trip, schemas vs server constraints, calendar-math, upload-queue state machine (retry/backoff/cancel), autosave debounce/backoff logic, i18n key parity en/si/ta.
- Run: `npm run type-check`, `npm run lint`, `npm run test:api`, `npm run test:web`, `npm run build:web`, `npm run db:indexes:check`, `npm run db:seed:demo`, `db:seed:verify`, backfill dry-run **and** commit on demo data. List pre-existing failures without fixing them.

**Manual (report outcomes; use real browser viewports and, if possible, a phone):**
1. Users: INSPECTOR (two different inspectors), PROJECT_MANAGER, AGENCY_OFFICER, GOV_ADMIN, SUPER_ADMIN, CONTRACTOR-role, another agency's user.
2. Schedule from the calendar (click a day), pick an inspector with a conflict warning, reschedule, reassign, cancel; overdue badges; reminders on my-work.
3. Inspector flow on a 375 px viewport: start → checklist → defect → capture/choose photos (check compression sizes in the Network tab: ≤ ~500 KB full, ~20–40 KB thumb) → progress assessment with discrepancy meter → submit; kill the network mid-upload and mid-autosave → retry works, nothing is lost; reload → draft recovered.
4. Evidence security: open an evidence URL as another agency's user / logged-out → 404/401; confirm no public URLs; image requests carry Authorization; removal rules; location consent off by default; Site Presence badge only with consented location.
5. Review: submitter cannot decide own report; second reviewer approves → verified % appears on the project overview, finance screens flip to **Verified** basis (CEI/CONFIRMED flags), contractor profile indicators update (c2), notices arrive; revision request → inspector edits → resubmits; reject → follow-up scheduled.
6. Discrepancy case (claimed 55 vs verified 40): inspector note required, reviewer acknowledgement required, PM/GOV_ADMIN notices.
7. Filters/search/pagination are server-side (check query strings); calendar keyboard navigation; en/si/ta layouts; reduced-motion; keyboard-only through dialogs and lightbox.
8. Existing project pages, progress submission, RoadSync, contractors (Batch 04), finance (Batch 05) and (if merged) InfraMap behave as before apart from the intended basis upgrade.

---

## 9. WHAT MUST NOT HAPPEN (self-check before pushing)
- A control that renders but does nothing; dead links; "coming soon" UI; fake chart data.
- Anyone approving their own submission; SUPER_ADMIN gaining write powers; CONTRACTOR/CITIZEN reaching inspections or evidence.
- Evidence served via public/presigned URLs, without scope checks, or with trusted client mime types; unvalidated uploads; SVG/HTML payloads; EXIF/location stored without consent.
- Verified progress changed by anything other than an approved decision; `Project.physicalProgress` or milestones overwritten; reported progress presented as verified.
- Non-transactional multi-document approval; races on decisions; lost drafts on flaky networks.
- Report text, captions, hashes or coordinates in audit snapshots/logs; inspector contact data exposed to assigners.
- New dependencies, AI, secrets, real photos/people/sites; weakened/skipped tests; hidden unresolved errors.
- Colour-only status; hover-only mobile affordances; tap targets < 44 px; horizontal scroll on phones.

---

## 10. GITHUB WORKFLOW

- **Base:** `development` once Batches 04 and 05 are merged (else §3.2).
- **Branch:** `feature/inspection-workflow` (adapt to repo convention).
- **Commits (Conventional Commits, one per ✔):**
  1. `feat(inspections): reviewer grants, site-evidence document type and shared enums (Steps 98-102 foundation)`
  2. `feat(inspections): extend inspection model, add evidence and verification collections, checklists and backfill`
  3. `feat(inspections): workflow transition table, validators and site-presence logic`
  4. `feat(inspections): scheduling, assignment, calendar and my-work APIs (Steps 98-99)`
  5. `feat(inspections): structured reports and secure site-evidence storage (Steps 100-101)`
  6. `feat(inspections): review decisions and progress verification (Step 102)`
  7. `feat(inspections): connect verified progress to finance gates and contractor performance (rules c2)`
  8. `chore(seed): synthetic inspection, evidence and verification demo data`
  9. `feat(inspections): overview, calendar, scheduling dialogs and inspector workload lens`
  10. `feat(inspections): mobile report editor with autosave and evidence capture`
  11. `feat(inspections): workspace, review console and verification compare`
  12. `feat(inspections): project inspections tab, verified progress chips and contractor inspection outcomes`
  13. `feat(inspections): si/ta copy, responsive and accessibility polish`
  14. `test(inspections): workflow, evidence security, verification integrity and integration essentials`
- Before each commit: type-check + lint touched workspaces. Never commit `.env*`, secrets, real photos or `node_modules`.
- **Push:** `git push -u origin feature/inspection-workflow` (no force). **Do not merge.** PR into `development` (squash): title `feat(inspections): Phase 9 Batch 06 — scheduling, reports, site evidence and progress verification (Steps 98–102)`; body = shipped features per step, endpoints, collections/indexes, permission grant changes + the **command to apply grants to existing databases**, storage approach (GridFS now, R2 later) and Atlas size note, changes to Batch 04/05 behaviour (rules `c2`, progress basis, `INSPECTION_HOLD` gate), backfill instructions, verification results incl. the self-healing check log, known gaps, decisions needed. If you can't open the PR, give me the exact title/body.

---

## 11. COMPLETION CRITERIA (all must be true)

- [ ] **Step 98:** schedule/edit/reschedule/cancel with history; calendar (month/week/agenda) + filtered list; upcoming/overdue derived; reminders/notices; all server-validated and audited.
- [ ] **Step 99:** inspector picker with workload + conflict warnings, scope-safe lookup, reassignment with history and access change, inspector "My work" dashboard.
- [ ] **Step 100:** structured checklist/observations/safety/defects/recommendations report; mobile-first editor with autosave, recovery, revision-conflict handling; submit validation; submission snapshots and history; revision/resubmission loop with cap.
- [ ] **Step 101:** secure evidence capture/upload/serve: compression, magic-byte validation, hash integrity, duplicate blocking, limits, optional consented location, Site Presence, gallery + lightbox, soft-removal rules, no public URLs, authenticated image loading.
- [ ] **Step 102:** reviewer console, approve/revise/reject with maker–checker and concurrency safety, `progressVerifications` + `Project.verifiedProgress` (never touching reported progress or milestones), discrepancy handling, re-verification, notices.
- [ ] **Integration:** Batch 05 now uses real verified progress (+ `INSPECTION_HOLD` warn gate); Batch 04 rules `c2` use structured inspection evidence; project overview/tab/button + contractor profile sections work.
- [ ] Permissions: reviewer grants applied via the documented idempotent path; matrix reported; SUPER_ADMIN read-only; CONTRACTOR/CITIZEN denied; out-of-scope → 404.
- [ ] UI: premium, consistent, mobile-first, responsive (375/768/1280), accessible, en/si/ta complete; **every control functional**.
- [ ] No new dependencies, no AI, no real data; seeds idempotent with reset/verify; backfill works; GridFS cleanup script present (dry-run).
- [ ] Self-healing loop executed; all critical checks green or explicitly listed as **Unresolved**; branch pushed; PR text ready.

---

## 12. FINAL REPORT (short)

(1) Preflight findings and deviations from §2 (printed permission matrix, storage findings/decision, API deployment limits, `inspectorProjectIds` handling); (2) what shipped per step (98/99/100/101/102) incl. unique functions (calendar, Workload Lens, autosave + upload queue, Site Presence, Verification Compare); (3) endpoints, collections, indexes, permission grants, enum/audit changes; (4) behaviour changes needing my approval (reviewer grants, rules `c2`, finance progress basis, `INSPECTION_HOLD` gate, thresholds, Atlas storage size); (5) verification results + self-healing check log + any **Unresolved**; (6) uncertain translations; (7) **Batch 07 handoff notes**: the FINAL_HANDOVER inspection + `progressVerifications` contract for asset-conversion eligibility, the `contractorIdsAtInspection`/`milestoneIds`/defect keys available for asset history, how evidence/GridFS can be referenced from assets and maintenance (evidence reuse rules), the existing `Asset`/`MaintenanceRecord` models' state and what's missing (no routes today), the permission matrix for `asset.*`/`maintenance.*`/`report.*`, reusable UI (calendar components, authed image/lightbox, upload queue, stepper, review/decision dialogs, insight strip), and what Batch 07 must add to InfraMap (the Batch 02 asset layer already reads `assets`).

Stop after the report. Do not start Batch 07.
