# INFRAOS — Enhanced Development Specification
## Roadmap Steps 59–60: Physical Progress Tracking + Financial Progress Summary

**Project:** INFRAOS — National Infrastructure Intelligence & Coordination Platform  
**Vision:** *The Operating System for National Infrastructure*  
**Repository:** https://github.com/divejikan-yuvarajah/InfraOS  
**Working directory (mandatory):** `C:\Users\ASUS\Desktop\InfraOS\InfraOS`  
**Prepared:** 29 October 2026  
**Verified remote integration baseline:** `development` = `576b1ede3b2a1ac9d0d88ad41ec16140768c9ff5` (merged PR #104, Step 58); `main` = `47398073d769e401813b7af9abd11d3a81d9919a` at inspection. **These are evidence snapshots, not an instruction to use stale refs. Refresh and inspect current `origin/development` before any Git operation.**  
**Document class:** Implementation-ready engineering specification and agent instruction; not code, test evidence, or deployment approval.  
**Companion:** `INFRAOS_Steps_59-60_Cursor_Agent_Execution_Prompts.md`.

---

## 0. Source of truth, verified facts and intentional scope

### 0.1 Original 190-step roadmap

The repository contains `Prompts/Steps.docx`. The roadmap headings, previously read from the original repository document, are:

- **Step 58 — Milestone Management** — merged into `development` through PR #104.
- **Step 59 — Physical Progress Tracking** — **this phase, first**.
- **Step 60 — Financial Progress Summary** — **this phase, second**.
- **Step 61 — Project Timeline** — **next step; out of scope**.

The original roadmap gives these step titles, not a detailed endpoint/schema contract. The following functional acceptance detail comes from *other existing repository specifications* and explicit implementation recommendations. Do not present proposed endpoints or derived formulas as verbatim roadmap requirements. When Cursor executes, re-read `Prompts/Steps.docx` and identify discrepancies before changing scope.

### 0.2 Linked repository requirements and policies (verified)

| Evidence | Relevant requirement / constraint |
|---|---|
| `docs/planning/requirements.md` | **FR-PROG-001:** assigned Contractor/Project Manager reports physical percentage **0–100** with a **note**, latest value visible; **FR-PROG-002:** authorized physical-versus-financial summary; **FR-PROG-003:** progress 100% does **not** complete project. FR-PROG-002 is P1; the others are P0. |
| `docs/planning/user-workflows.md`, workflow 8 | Open an assigned project, enter physical percentage and note, server checks assignment, latest progress displayed, history retained, confirmation; optional later inspection/document evidence. |
| `docs/planning/business-rules.md` | **BR-PRJ-004:** physical 100% ≠ completion. **BR-FIN-003:** financial progress is derived from authorized payment/budget data, never trusted from a client-side percentage. **BR-FIN-001/002:** sensitive money changes audited; PAID is irreversible without governed correction. **BR-INT-001–005:** malformed IDs, conflict protection, fail-closed outages, pagination. |
| `docs/security/permission-catalog.md` and `packages/shared-types/src/permissions.ts` | Existing grants include `progress.read`, `progress.submit`, `finance.budget.read`, `finance.payment.read`; `inspection.verify` is distinct. Do not invent or casually enlarge permission names. |
| `docs/security/permission-matrix.md` | Project Manager assigned progress, Contractor assigned submit, Inspector assigned read, Gov/Agency Admin scoped read. Financial data has stricter permission/scope than physical progress. |
| `docs/reviews/step-58/END-OF-STEP-VERIFICATION.md` | Same-agent feature recommendation APPROVE; 311 API and 174 web tests reported; milestone state machine persisted; parent remains APPROVED with `physicalProgress: 0` after milestone completion; no Step 59/60 work claimed. Historical browser evidence uses disposable Mongo. |
| `docs/operations/production-readiness-gates.md` | Production release still BLOCKED: Atlas index review, Step 51 hierarchy/grant races, email, null-agency Super Admin, native language review, staging cookies, branch controls, operations. Document contains historical pre-merge statements; verify later CI directly rather than quoting stale statements as current. |

### 0.3 Verified implementation baseline (remote `development`)

- npm workspaces; **Next.js / React / TypeScript / Tailwind** web in `apps/web`, **Express / TypeScript / Mongoose** API in `apps/api`, shared types in `packages/shared-types`.
- Project document: `apps/api/src/modules/projects/models/project.model.ts`: `physicalProgress` and `financialProgress` number fields (`0–100`, default `0`), `budget: { amountMinor, currency: 'LKR' }`, `status`, agency and assignment references, Mongoose version, timestamps. **Existing `financialProgress` is documented as a cache for the *future Finance service*, not an authoritative live calculation.**
- `apps/api/src/modules/projects/projects.types.ts` and `apps/web/src/lib/projects/types.ts`: project-detail DTO exposes `physicalProgress` and only conditionally exposes `budget`; **it does not currently expose `financialProgress`**.
- Step 58 milestone API, service, policy, UI, audit transactions and optimistic revision handling are implemented under `apps/api/src/modules/projects/milestones.*`, `projects.routes.ts`, `apps/web/src/components/projects/project-milestones-client.tsx` and `apps/web/src/lib/projects/milestones-api.ts`.
- `apps/api/src/modules/finance/models/project-payment.model.ts`: payment records carry `projectId`, `contractorId`, `{amountMinor, currency}`, status, date, `createdBy`; status enum `PENDING`, `APPROVED`, `REJECTED`, `PAID`, `CANCELLED`; **no complete payment creation/approval/payment-processing API has been verified**. A persisted `PAID` value must not be misrepresented as independently verified bank settlement.
- Money primitive is **safe, nonnegative integer minor units** in LKR (`apps/api/src/shared/database/fields.ts`), not rupee floats. ProjectPayment indexes include `(projectId, date)` and `(status, date)`; do not add Atlas indexes without authorization.
- `apps/api/src/modules/contractors/models/contractor.model.ts` **has no userId**. `apps/api/src/modules/identity/authorization/resource-scope.ts` explicitly says **“Contractor ownership is denied: Contractor has no userId.”** A Contractor role's `progress.submit` grant does **not** establish a secure relation to `project.contractorId`. This is a critical Step 59 dependency; resolve safely or report the Contractor path BLOCKED, never infer from matching email or use a global contractor bypass.
- Existing `projectReadFilter` / `projectWriteFilter` fail closed; `projectWriteFilter` intentionally denies Contractor. Do not use it as a workaround granting Contractor all projects. Design a narrow, authenticated contractor→project assignment adapter only if the model supports it securely and any needed schema/identity changes are approved.
- Existing `AuditLog` supports resource types including `PROJECT` and `MILESTONE`; snapshot properties are **allowlisted** (e.g., status, reason, physicalProgress, financialProgress, budget). Do not put full progress narratives, personal information, documents or financial details into audit snapshots indiscriminately.
- `apps/web/src/components/projects/project-overview-client.tsx` currently displays recorded physical percentage and conditional budget; existing auth-bound Query API, `StaffWorkspaceShell`, EN/SI/TA draft message patterns, no-store API envelopes and premium color tokens must be reused.

### 0.4 Explicit difference between requirement and engineering proposal

**Required:** progress report with note, history, authorization; physical vs financial display from real allowed data; parent lifecycle unaffected.  
**Proposed for review:** an append-only `ProgressUpdate`/equivalent event model, API route names, concurrency strategy, display cards, read-only finance summary endpoint, exact percentage formula and freshness indicators. Align with the actual repository before introducing any new file. Document deviations and seek owner approval for material schema/security policy decisions.

---

## 1. Nonnegotiable project and execution rules

1. Operate **only** inside `C:\Users\ASUS\Desktop\InfraOS\InfraOS`. No additional project directory, worktree or edits to the `Documents` folder.
2. Preserve all existing tracked and untracked changes, especially historically dirty `docs/operations/production-readiness-gates.md`, Step 53–54 reviews and `Prompts/`. No `git reset`, `git clean`, force checkout, unauthorized stash or overwrites.
3. Use **one feature-based branch for the Steps 59–60 group** (suggested `feature/projecttrace-progress-finance-summary` only if free), based on safely verified current `origin/development`; never branch from stale local `development`. **Branch creation/switch requires explicit approval.** If safe checkout is impossible, stop Git operations; continue only once a safe integration path is authorized.
4. `development` is for approved integration; `main` is for separately approved stable release. No commit, push, PR or merge without an independent owner approval for each checkpoint. Never default-push toward `development` with a misleading upstream; use an explicit feature ref.
5. No edits to public **Connected Future** landing page, no unrelated Steps 61+, finance payment lifecycle, bank integration, inspection verification, DocTrace evidence upload or full project completion logic.
6. No production login enablement; do not modify `apps/web/.env.local` or `apps/api/.env`, supply secrets, access/write live Atlas or change live indexes. **Only authorized isolated disposable databases** for automated/browser tests. No code containing fixture credentials in production build/import/deployment paths.
7. Use existing established design tokens and Sri Lankan flag-inspired colors (maroon, gold/yellow, green, and supporting neutrals) with restrained, premium enterprise-GovTech contrast. Don't hardcode an unrelated visual system or install new libraries without justification.
8. Avoid repeated full-suite testing for every micro-change: focused tests after each step; **one full combined quality and browser review after both**. Preserve CI behavior and strict feature versus release-readiness labels.
9. Do not claim local branch state or local services are known from GitHub: Cursor must inspect them. Never terminate pre-existing listeners on `3000`, `4000`, or `4010` without owner approval. Use available isolated ports and unique Next build output, verify origins.
10. Keep every change measurable: file list, typed contracts, route table, guard matrix, tests, screenshots, evidence and reasons for BLOCKED/NOT RUN.

---

## 2. Architecture and dependency plan

### 2.1 Functional sequence

```text
Already integrated: Step 55 draft edits → Step 56 lifecycle guards →
Step 57 approval review → Step 58 milestone CRUD/state machine
                              ↓
Step 59 — append a scoped physical-progress report + update recorded
          project physicalProgress in an auditable, concurrency-safe transaction
                              ↓
Step 60 — read-only authorized financial progress summary from recorded
          budget and eligible PAID payment data; show side-by-side with
          Step 59 physical reports without conflating the two metrics
                              ↓
Future only: Step 61 project timeline; full Finance payment workflow;
inspection verification; project completion dependencies
```

### 2.2 Preflight gate (run once for group)

- Inspect `git status --short --branch`, `git branch -vv`, `git rev-parse HEAD`, `git diff --stat`, `git ls-files --others --exclude-standard`, upstream, `origin/development`; `git fetch origin` only if safe/authorized for repository network reads. Identify existing branch for this group and avoid duplicates.
- Read roadmap Step 59–60, above requirements, security policy, Step 58 audit/verification, actual API route mounting in `apps/api/src/app.ts` / module routers, public auth contract, test helpers, frontend layout and current dependencies.
- Confirm **actual** payment ingestion status, contractor assignment mapping, fiscal data origin and any source-of-truth revisions. If absent, record blockers. Do not silently 'complete' them with demo stubbed functionality.
- Inspect remote development's current head versus baseline. Do not assume the source tree is still at the snapshot SHA.
- Write a concise pre-implementation note: source list, existing functionality, new paths, constraints, regression risks, planned tests and exact owner approvals needed. Reuse the same note for both steps; avoid lengthy redundant reports.

### 2.3 Integration boundaries

| Concern | Contract |
|---|---|
| Project lifecycle | Reuse `Project.status`; Step 59 MUST NOT call or bypass disabled `START`/`COMPLETE` actions. Choose/verify eligible reporting states. Prefer `ACTIVE` for real construction; where existing lifecycle cannot reach ACTIVE, demonstrate using an explicitly **synthetic ACTIVE** record in isolated Mongo and disclose that setup is not a user workflow. `APPROVED` should not silently authorize construction progress merely because Step 58 milestone writes allow it. |
| Milestones | Independent planning/execution evidence. Milestone 100% does not auto-set project physical progress, and physical submissions do not automatically complete milestones. |
| Reported versus verified | Step 59 records **self-reported** project progress, not an `inspection.verify` outcome. Label it “Reported physical progress”; never advertise independent inspection. |
| Finance | Step 60 is **read-only financial summary**. No editing budget, creating/approving/marking payments paid, refunds, actual banking calls or manual financial percentage authority field. |
| Permissions | Scope checks on every API request and every finance amount; hiding UI is defense-in-depth, not authorization. Avoid SA operational mutation and unscoped Contractor access. |
| Audit | Mutation actor + timestamp + request ID + minimal allowed snapshots in transaction. Immutable historical progress records must not be user-editable/deletable by casual API. |
| API | Existing `/api/v1` + `{ success, data, requestId }` / failure envelope, no-store, HTTP 400/401/403/404/409/415/503 and existing error conventions. |
| Web | Existing Query cache keys include auth epoch, user and role; invalidate after mutation; prevent stale/foreign data on logout/account switch. |

---

## 3. STEP 59 — Physical Progress Tracking

### 3.1 Outcomes and acceptance intent

A currently authorized, **project-assigned** reporter enters an overall physical completion percentage between **0 and 100**, a meaningful note and optional reporting date if approved. The server appends a durable report, updates the parent Project's recorded physical percentage **atomically**, makes the latest value and history visible to entitled readers, and never changes project official status. Inspector verification remains a future separate workflow.

**Contractor caveat:** The role has `progress.submit`, but current schema cannot prove which Contractor record belongs to a signed-in user. Either implement an owner-approved minimal, secure association (backward compatible, explicit non-default) plus tests, or fail closed and record the Contractor P0 acceptance case as **BLOCKED / REVISE**. Do not use email matching, `actor.userId = project.contractorId`, or global `projectWriteFilter` bypasses.

### 3.2 Backend/domain model (proposal, subject to preflight)

- Prefer a new `ProjectProgressUpdate`/`ProgressReport` Mongoose collection rather than reusing Milestone progress, Inspection or AuditLog as the only user-facing history. Suggested fields: `projectId`, `reportedPercent` (0–100 finite number; choose integer or precision cap consistently with policy), `note` (trimmed, bounded, safe text), `reportedByUserId`, `reporterRole`, `reportedAt` (server time), `previousPercent`, optional `requestId`, `createdAt`. Include an immutable sequence or reference to project version for deterministic ordering if needed.
- The project remains the latest-value record: existing `physicalProgress`. History is append-only; reject DELETE and casual edit endpoints. A correction is a **new report**, keeping prior reports intact. Do not trust `previousPercent`, `reportedBy`, `agencyId`, project status or timestamps supplied by the client.
- Add Mongoose indexes only to the **model/source** when necessary for project/time pagination and query efficiency. No live Atlas index builds. Test disposable DB index behavior.
- Enforce safe strings (no control chars, Mongo operator objects or untrusted status); strict Zod body, valid 24-hex ObjectId, no unknown request keys, supported `Content-Type`.
- **State policy:** define and test eligibility explicitly. Prefer `ACTIVE` and potentially `DELAYED`/`ON_HOLD` for appropriately labeled reporting if business policy allows; block `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `REJECTED`, `CANCELLED`, `COMPLETED` unless approved correction process. Avoid allowing future-dated self-reports without clear governance. No unauthorized state transitions to make testing easier.
- **Report decreases/corrections:** no roadmap monotonicity rule exists. Recommended policy: allow a lower percentage only as a visible correction with a mandatory explanation and audit; do not silently overwrite. Obtain owner decision if existing product rules disagree.
- Prevent duplicate submissions: disable duplicate UI submission, and consider a narrow idempotency/request key if the existing API supports it. Never count two reports for a single accepted retry.

### 3.3 Security and concurrency

- `GET` history/current requires `progress.read` and **resource-specific project read scope**; `POST` requires `progress.submit`, active verified identity, fresh current role grants, actor-project assignment and eligible project status.
- **PM:** only `Project.managerId` equals actor user and agency/scope valid; **Contractor:** requires verified association between actor and `Project.contractorId` or deny. **Gov Admin / Agency Officer:** existing seed does not grant `progress.submit` by default; do not convert `project.update` into progress submit implicitly. **Inspector:** read-only in assigned inspection scope. **Super Admin:** permitted scoped/platform read as existing auth allows, but no operational submit. **Citizen:** no staff progress read/write.
- Design one transaction: re-read live actor/role and agency scope; enforce a guard against Step 51 hierarchy/grant changes within existing primitives; select scoped parent project; compare client `revision` with current `Project.__v`; atomically append report and CAS update `physicalProgress`/`__v`; create minimal allowed PROJECT audit (and/or progress audit resource only if approved catalog), then commit. **Only if all writes succeed return success**; retry serialization conflicts narrowly and return 409 stale or generic 503 on real dependency errors.
- Distinguish 401 unauthenticated/revoked, 403 missing grant, 404 foreign/missing project (no existence leak), 409 ineligible state/revision, 400 invalid body/ID, 415 wrong media, 503 failed transaction. Use no-store on sensitive reads; never expose other agencies' notes.
- Verify an audit failure rolls back both report and parent project. Verify two simultaneous submissions with same revision yield exactly one accepted new snapshot/report (200/201 + 409), without ghost history.
- Do not claim Step 51 hierarchy/grant races generally solved simply because one Step 59 transaction exists; those are a separate production blocker.

### 3.4 API proposal

Actual naming is a design decision after inspection. Recommended nested resource under existing router:

| Method | Proposed route | Authorization | Contract |
|---|---|---|---|
| `GET` | `/api/v1/projects/:id/progress` | `progress.read` + project scope | Current reported physical progress, latest report metadata, allowed-action hints, optionally counts; avoid exposing budget. |
| `GET` | `/api/v1/projects/:id/progress/history?page=&limit=` | `progress.read` + project scope | Paginated newest-first immutable report DTOs; stable ordering, bounded limit. |
| `POST` | `/api/v1/projects/:id/progress` | `progress.submit` + **assignment**, active state, CAS | Body suggestion `{ percentage, note, revision }`; server assigns actor/date; reply with new recorded progress and revision. |

If the repository already has a suitable route/service or a different canonical naming convention, reuse it and document the final route. No PUT-as-arbitrary-overwrite, route for verification, or user-supplied `financialProgress`.

### 3.5 UI/UX requirements

- From Project Overview, link to a polished, accessible **Progress** workspace/section. Show **Reported physical progress** as a restrained accessible bar, large percentage, last reporter/time if allowed, project code/status, next action, and contextual info that official completion is separate.
- A scoped PM submit form: percentage numeric input / slider **with accessible numeric input fallback**, required note, current revision, focused validation, disabled while pending, cancellation, success toast, 409 reload/compare path. Contractor sees submit only when association genuinely proven; otherwise truthful unavailable state.
- History: chronological accessible table/cards with percentage, note, reporter/date, progress delta (may be negative for corrections), pagination, empty/read denied/data error/retry states; preserve private text ACLs and avoid overly decorative charts.
- Integrate the single current project progress source across Overview, current milestones workspace links, and future Step 60 summary. Do not accidentally aggregate milestone percentages into overall recorded progress.
- Premium INFRAOS visual system: existing maroon/gold/green tokens and accessible contrasts, iconography, high-value microinteractions, no new landing design; viewport 320, 375, 390, 768, 1024, 1440, 1920; keyboard, screen reader labels, semantic forms and `aria-live` responses; no hidden horizontal overflow.
- Existing EN/SI/TA locale architecture with copy in correct slots; any Sinhala/Tamil translated text remains **DRAFT / native review pending** unless actually reviewed. Dates/times displayed with explicit locale/timezone treatment; server times UTC.

### 3.6 Focused tests and per-step gate

- API: valid assigned PM, nonassigned PM same agency, Contractor without valid mapping, mapped contractor if implemented, Gov/Agency Admin grant differences, Inspector assigned/unassigned, SA read/no submit, Citizen, anonymous, revoked grant/epoch, role/agency changes, cross-org and invalid IDs.
- Value and state: `0`, `100`, negative, >100, NaN/infinity, decimal precision, empty/unsafe notes, huge text, duplicate body keys, wrong media type, draft/rejected/cancelled/completed/allowed ACTIVE; downgrade corrections with reason; unchanged value policy.
- Concurrency: stale revision 409, simultaneous writes, transaction audit failure rollback, retry behavior, no partial success, pagination and no sensitive leakage.
- Regression: Step 55 edit, Step 56 lifecycle guards, Step 57 approve/reject and Step 58 milestone completion leave parent unchanged unless explicitly submitted progress. Project 100% **must not** set `COMPLETED`.
- Browser **after Step 59** in isolated env: assigned authorized actor logs in, opens a synthetic eligible project, records 20%, records 65% with notes, refresh confirms latest and history; second tab 409; out-of-scope actor sees no data; screenshot of desktop/mobile/error/history/parent not completed. Include URLs and request results; no fake screenshots. If this cannot be executed, mark NOT RUN and do not declare complete.
- Before Step 60: focused tests and Step 59 browser evidence satisfactory, or stop and mark blockers rather than proceeding blindly. Do **not** execute the full phase-wide test suite yet unless necessary to diagnose a regression.

### 3.7 Step 59 criteria

**Required PASS:** honest reported-percentage writes, history and latest display, atomic concurrency/audit, authorization, correct error states, `100%` not completing parent, browser demonstration. **P0 Contractor path must be safe:** either fully validated with explicit user-contract mapping OR clearly marked **BLOCKED**; do not claim unconditional feature-wide APPROVE when the promised Contractor actor is unimplemented. Never add inspection verification or step 60 computations to Step 59's acceptance tally.

---

## 4. STEP 60 — Financial Progress Summary

### 4.1 Source-verified goal and essential integrity distinction

**FR-PROG-002 / P1:** Authorized user sees **physical versus financial** progress without assuming these figures should match. Finance is **an informational/derived summary**, not a payments engine.

**Critical repository constraint:** There is a `ProjectPayment` model and `Project.budget`, but no end-to-end payment-processing API was verified. Therefore **the status `PAID` in a record is not independent proof that funds were transferred**. UI and API must distinguish *recorded PAID payments*, *actual verified settlement (if independently implemented)* and *unavailable data*. Do not populate real payment amounts or silently set payments to PAID merely for this step. A disposable fixture may seed labeled **synthetic payments** for demonstration only.

### 4.2 Authorized read-only financial data flow

```text
Authorized authenticated actor
  → existing `project.read` + project resource scope
  → `finance.budget.read` AND `finance.payment.read` to expose both money basis and ratio
  → scoped Project budget (`LKR`, integer `amountMinor`)
  → scoped ProjectPayment data for the same project only
  → validate statuses, currency, safe sums, consistency and source availability
  → derive money totals and financial ratio / availability state on server
  → return the minimum summary needed by this authorized viewer
  → show side-by-side with Step 59 current **reported physical** value
```

Do **not** leak budget/payment totals to a `project.read` actor who lacks finance privileges; no blanket Super Admin operational approval; no citizen/contractor money exposure. Re-evaluate live role grants and scope server-side on every read, and clear browser caches on role/account/epoch change.

### 4.3 Calculation contract (proposed, to be locked during preflight)

**If valid, trustworthy *recorded* data is available:**

- `budgetMinor = Project.budget.amountMinor` (currency **LKR**).
- `paidMinor = sum(ProjectPayment.amount.amountMinor WHERE projectId matches AND status === 'PAID' AND currency === 'LKR')`.
- Pending/Approved/Rejected/Cancelled do **not** contribute to paid total. Distinguish `APPROVED` from `PAID`; not all records are actual disbursements.
- `financialRatioPercent = paidMinor / budgetMinor × 100` only if `budgetMinor > 0` and totals are valid. Preserve precision; display sensible rounded percentages without silently clipping the underlying ratio. If >100%, show **over-budget/overrun** explicitly and cap only the visualization fill width at 100, not the numeric ratio.
- `remainingMinor = max(0, budgetMinor - paidMinor)`; also report `overrunMinor = max(0, paidMinor - budgetMinor)` so overspending cannot be hidden by a zero remaining figure. Use safe-integer arithmetic with overflow guard or an exact aggregation scheme; do not rely on floating currency calculations or silently overflow JS safe integers.
- **Missing budget / zero budget / mixed currency / inconsistent or unavailable payment source / unsafe sums / uncertain settlement authority:** return a typed `unavailable` or `provisional` result with reason, not a fabricated `0%` or `100%` score.
- If a functioning, authorized payment source explicitly confirms an empty PAID set, it may show **0 recorded paid**, clearly labeled. If data ingestion is not implemented, label the source provisional or unavailable rather than implying actual spending is zero.
- `Project.financialProgress` is a **future-service cache**, not the source of truth for this step. Do not PATCH or backfill this cache as an expedient workaround. Derive on read or use an explicitly safe read-through cache policy approved by the owner.
- No assumption that financial and physical progress must match; variance is displayed as an informational comparison, **not an automatic fraud flag**. Avoid a risk score, unsupported AI inference or fabricated precision.

### 4.4 API contract (proposed, read-only)

| Method | Proposed route | Security | Response concept |
|---|---|---|---|
| `GET` | `/api/v1/projects/:id/financial-progress` | auth + project scope + finance.budget.read + finance.payment.read | `{ availability, basis, budgetMinor?, paidMinor?, remainingMinor?, overrunMinor?, financialPercent?, paymentRecordCount?, currency?, calculatedAt?, sourceNotes? }` |
| `GET` or safe composed UI read | `/api/v1/projects/:id/progress-comparison` | project progress read plus stricter finance permission for financial fields | `{ reportedPhysicalPercent, financial: { availability, ... } }` with per-field server authorization; if finance denied, return only physical or use 403 depending on route's documented design. |

**Choose the smallest actual route surface.** The second endpoint is optional; a composition of Step 59's scoped physical endpoint and Step 60's scoped finance endpoint is acceptable and may be safer. No POST/PATCH/DELETE for finance from Step 60. Avoid adding amount fields to a broadly accessible project DTO. No public endpoints.

### 4.5 Frontend and visualization

- Add a compact premium **Physical vs Financial Progress** section to the authorized ProjectTrace detail/Progress workspace: clearly separate bars and percentages, distinct labels **Reported physical** and **Recorded financial (PAID payments)**, measured values, source/time annotation, and concise methodology.
- For `unavailable`, render an explicit “Financial progress unavailable” with reason or safe generic explanation; no fake zero bars. For `provisional`, mark the data as synthetic/demo/not independently verified when appropriate. A role with physical-only permission should see no financial numbers or finance inference; UI may show a restricted state without exposing totals.
- Show budget, paid, remaining and overrun **only** where the viewer is entitled to each and monetary units are correct (Sri Lankan LKR / rupee rendering from minor units). Use readable thousand separators; no float errors; no financial values in unguarded HTML, analytics events, client logs or shared cache.
- A difference badge may explain that physical and financial figures are different metrics, not a binary approval/inspection decision. Show neutral explanations even when the ratio is high/low; no rule that project is delayed or corrupt because values differ.
- Responsive min 320px, keyboard accessible tooltips, color-independent labels, contrast, visible focus, accessible numeric summaries, EN/SI/TA draft slots. Keep pages fast and requests bounded; use query loading/failure/empty states and no-store.

### 4.6 Step 60 tests and per-step evidence

- Math: zero/missing budget, exactly paid, zero paid with trustworthy source, multiple PAID, unrelated-project PAID, PENDING/APPROVED/REJECTED/CANCELLED exclusion, overrun >100, huge valid amounts, overflow, mixed currency, failed DB, count pagination and deterministic sorting if applicable.
- Security: finance permission absent but `project.read` allowed, budget.read-only but no payment.read, out-of-scope gov admin, assigned PM, Super Admin read only (if current identity allows), contractor/citizen/inspector no financial leak; auth epoch and revoked permissions; no cache leakage across actor switch.
- Integration: Step 59 current physical reflects recorded submission; milestones may separately reach 100; finance remains independent of physical and official project status; no writes/mutations by read endpoint; no unapproved `financialProgress` cache update.
- Browser **after Step 60**: signed-in authorized actor opens project with Step 59 physical 65%, sees labeled synthetic `PAID` payment fixture and computed ratio; compare alternate project with missing source/budget; verify status/notes, responsive views and foreign finance denial. Use actual isolated Mongo records, real network calls, screenshots and local URLs; differentiate fixture from production data. Stop owned listeners only.
- Step 60 focused checks; defer full suites until the combined final phase review.

### 4.7 Step 60 criteria

**PASS** only if financial figures derive server-side from genuinely available, scope-checked recorded data; formula matches documented dataset and edge cases; permission checks prevent exposure; UI correctly labels provisional/unavailable scenarios; actual browser demonstration executed; and no transaction/payment approval/bank action was introduced. If the underlying payment source cannot support a truthful ratio, **BLOCK financial-percentage acceptance**, ship only an honest unavailable display if approved, and don't claim completed finance functionality.

---

## 5. Cross-step functional design and implementation order

1. **Group preflight and branch safety:** verify latest `origin/development`, actual dirty worktree and architecture; owner approves branch creation if needed; no Git mutation while unresolved. Capture baseline, source/route inventory and Contractor/payment provenance questions.
2. **Step 59:** policy → DTO/validation → append-only history and transaction-safe CAS service → scoped API → web UI integration → focused tests → **real isolated browser demonstration** → concise Step 59 report.
3. **Gate to Step 60:** if Step 59 P0 unsafe, stop/repair or explicitly owner-authorize limited continuation; don't call Step 59 fully approved when Contractor mapping is absent.
4. **Step 60:** authoritative-source assessment → read-only finance math/permissions → API → side-by-side web presentation → focused tests → **real isolated browser demonstration** → concise Step 60 report.
5. **One combined final review only after both steps:** full API/web suites, type-check, lint, build, security/performance/architecture checks, real integrated browser scenario across both, regression and adversarial tests; fix and rerun impacted checks.
6. **Git integration (separately authorized):** staged-file list/diff/secret check → commit → explicit ref push → PR into development → CI + code review → merge. Do not automatically update `main`.
7. **Handoff:** preserve known P0 release blockers; Step 61 timeline gets authorized, immutable progress-event data where available; no Step 61 implementation now.

---

## 6. Concrete security / data privacy test matrix

| Scenario | Expected outcome |
|---|---|
| Anonymous progress / finance read or write | 401; no private data |
| Role revoked, epoch stale, agency inactive | Fail closed; no writes, cache cleared on role switch |
| Same-agency unassigned PM submits | 404 or guarded failure; no report |
| Contractor without validated user–contractor mapping | Denied even if grant `progress.submit` exists |
| Contractor validated/assigned after approved association | Scoped physical submit; never finance read, never inspection verify |
| Inspector assigned to related inspection | Read only as authorized; cannot self-verify progress through Step 59 |
| Foreign ministry/agency resource | 404/no disclosure of titles, notes or money |
| Two matching project revisions | Only one successful progress change and matching history/audit |
| Audit write fails | Full transaction rollback; 503; no orphan report/project percentage |
| 100% reported progress | Project official status unchanged; no forced Milestone complete |
| Project/permission changes mid-transaction | Recheck/lock according to established authorization primitives; fail closed where deterministic safety is unproven |
| Finance user can read project but lacks money permissions | Financial fields entirely absent or explicit 403, no inference via calculated percent |
| Payment record PENDING/APPROVED but not PAID | Excluded from paid total |
| Missing or zero budget | No div-by-zero; clear unavailable state |
| Paid > budget | Overrun visible; bar capped visually only |
| Browser switch user/logout | No stale project notes/finance from old user |
| Database unavailable | Generic 503, no optimistic success, no fabricated zero |

**Test information leakage** in HTML, server logs, error payloads, queries, TanStack cache, screenshots and browser local state. Never log credentials, access tokens, refresh cookies, emails or financial note contents unnecessarily.

---

## 7. Environment and external-service contract

**Required for implementation:** existing Node.js 22/npm workspace toolchain, existing frontend and API packages, TypeScript/Mongoose, **local disposable MongoDB replica** via `mongodb-memory-server` or existing isolated fixture, local test/browser environment. Existing web/API public URL flags for a **local** login-enabled browser test only, using controlled local HTTP origins and isolated processes; no real key added. React Query, React Hook Form, Zod, icons and chart primitives already in repo should be reused where available.

**Not required:** new AWS products, Vercel secrets, OpenRouter tokens, LLMs, FastAPI service, bank API, payments provider, mail provider, production Atlas credentials, GIS keys, billing integration, cloud storage. **Never invent an API key** or create placeholders claimed to be working integrations. A future payment source requires owner procurement/approval separately.

**Browser safety:** prefer isolated web/API ports where free (previous Step 58 used `3001`/`4011`, but inspect before reuse). Use an isolated Next `.next-step59-60` build directory and repo-local disposable script not imported into production. Do not edit existing `.env.local` or `.env`; pass test env to child processes only. Ensure `FRONTEND_ORIGIN` and `NEXT_PUBLIC_API_BASE_URL` match local listeners; no public deployed `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=1`. Do not stop other working services or assume prior port ownership.

**CI:** `.github/workflows/quality.yml` runs web/API tests, types, lint and build with public auth disabled and refuses `MONGODB_URI`, `MONGODB_URL`, `DATABASE_URL`. Preserve this. Full CI passing = code quality signal, **not production approval**.

---

## 8. Review, quality gates and demonstration specification

### 8.1 Pre-implementation / post-implementation

**Pre:** record branch/HEAD, remote head, selected affected files, expected source-of-truth decisions, security dependencies and scope. **Post each step:** summarize implemented versus blocked cases, focused test evidence, one real browser walkthrough, changed files and regression risk. Produce only one group-level comprehensive review after both complete.

### 8.2 Complete final phase review (once)

At the end, run in the correct scoped CI-like test environment:

```powershell
npm run test:api
npm run test:web
npm run type-check
npm run lint
npm run build
git diff --check
```

Ensure web commands use the existing CI auth flags in that PowerShell process, e.g. set `$env:NEXT_PUBLIC_AUTH_LOGIN_ENABLED='0'`, `$env:NEXT_PUBLIC_AUTH_FIXTURE='0'` and `$env:NEXT_PUBLIC_API_BASE_URL='http://localhost:4000'` temporarily (revert in shell; **don't edit local env files**). API test harness must refuse/omit external database URI variables; avoid opening a live connection. Do not reuse prior 311/174 test counts as new results: report actual current counts, warnings and exits.

Test: end-to-end data provenance, physical percent immutable history, absence of verified status, finance authorization, mixed payment statuses, cache invalidation, revenue/overrun math, concurrency, rollback, cross-agency denial, browser 320→1920, keyboard, focus/contrast, EN/SI/TA layout and draft copy, project state invariance, Step 57/58 regressions. Verify any accidental `tsconfig` rewrites by reviewing diffs, not running blind checkout/reset on dirty paths.

### 8.3 Real browser demonstrations — mandatory

**After Step 59:** real signed-in assigned PM, real API POST + persisted report and history, parent status invariant, 409/403/404, screenshots and local URLs. For contractor submission, either demonstrate actual scoped actor or mark BLOCKED.  
**After Step 60:** real scoped finance read, proper authority label for PAID fixture, meaningful side-by-side data, unavailable/overrun scenarios, outsider denial, screenshots and URLs.  
**At combined review:** one continuous demonstration: sign in → authorized project → report physical 20% → report 65% → inspect chronological history → inspect milestone independently → financial summary from explicitly labeled synthetic recorded PAID fixture → show comparison/overrun/unavailable case → switch to outsider → verify inaccessible notes/money → return to project overview; leave parent status unchanged.

The demonstration must use the real source code and running API with **disposable data**, not screenshots of mockups or fabricated HTTP logs. Record ports/origins, user roles, fixture source, sample project code, local routes, response statuses, screenshot paths and test outcomes. If a browser tool is unavailable, mark **NOT RUN** and provide manual steps without claiming it passed. Preserve other running servers; stop only processes started for the demo.

### 8.4 Recommended evidence/report artifacts (minimal)

- `docs/reviews/steps-59-60/IMPLEMENTATION-STATUS.md` — small table for each step: scope, file list, routes, source/provenance decisions, limitations and focused verification.
- `docs/reviews/steps-59-60/END-OF-PHASE-VERIFICATION.md` — combined full gates, actor/scenario matrix, screenshots, browser and security evidence, PASS/FAIL/BLOCKED/NOT RUN, independent-signoff disclaimer.
- `docs/reviews/steps-59-60/evidence/` — actual screenshots from the two step demos + integrated final demo, named meaningfully. No duplicate screenshots or large unrelated artifacts.
- Optional isolated demo setup documented in one file, excluding test assets from production compilation and guarding dev-only execution.

---

## 9. Explicit acceptance matrix

| ID | Success requirement | Status to record |
|---|---|---|
| 59-A | Read current physical value plus immutable, paginated history by authorized scope | PASS / FAIL / BLOCKED / NOT RUN |
| 59-B | Assigned PM submit, valid 0–100 with note, server-generated actor/time and atomic latest update | same |
| 59-C | Contractor assignment proven and submit **or honestly BLOCKED**; no unscoped bypass | same |
| 59-D | Audit rollback, stale 409, ineligible state guard, status not auto-completed | same |
| 59-E | Real browser Step 59 demo, accessible responsive UI, screenshots, links, cross-scope denial | same |
| 60-A | Derived server-only financial ratio from eligible recorded `PAID` payments and budget, no client percent | same |
| 60-B | Dataset authority/provisional status explicit; zero-budget/missing data/overrun/status filtering correct | same |
| 60-C | Finance permissions and project scope prevent numeric or inference leaks | same |
| 60-D | Real browser Step 60 demo with labeled disposable PAID fixture, missing data and outsider case | same |
| BOTH | Combined end-to-end browser scenario, full test suites, type-check, lint, build, regressions and accessibility | same |
| RELEASE | All independent production readiness gates complete | **BLOCKED** until separately verified |

**Feature verdict:** APPROVE only for evidence-backed and completely covered authorized scope; REVISE for fixable missing actor paths/quality issues; BLOCKED for a required security or source-integrity dependency. **Never treat a developer's same-agent APPROVE as independent human signoff.**

---

## 10. Git approval checkpoints and safe integration recipe

**Phase group uses one approved feature branch; do not create one per step.** Local state may include the merged Step 58 feature branch and unrelated dirty files. A safe switch may not be possible without a targeted migration plan; **do not assume or force it**. Request separate explicit approval for:

| Gate | Authorized scope (no automatic next step) |
|---|---|
| G1 | Fetch/inspect remote; create/switch only to the approved new group feature branch from **current** `origin/development`, preserving dirty files. Stop if checkout conflicts; no stash/reset/clean. |
| G2 | Stage exact vetted Steps 59–60 paths using `git add -- <exact paths>` or patch staging; never `git add .`/`-A`; show `git diff --cached --name-status`, `--stat`, `--check` and final diff. Exclude existing dirty unrelated files and all `Prompts/`. |
| G3 | Owner approves *exact staged contents*, then one scoped commit or owner-approved small grouping; e.g. `git commit -m "feat(projecttrace): add physical and financial progress views (steps 59-60)"`. |
| G4 | Owner approves explicit feature-only push: `git push -u origin HEAD:refs/heads/feature/projecttrace-progress-finance-summary` (if branch actually named so). **Never plain `git push` on an upstream pointing to development.** |
| G5 | Owner separately approves PR creation from feature branch **into `development`**; check latest CI, diffs, code-owner review and feature acceptance. |
| G6 | Owner separately approves merge; inspect updated head/status and post-merge CI. `main` requires its **own later stable-release approval**, not implied by this phase. |

**Commands are templates, not instructions to execute now:**

```powershell
# READ-ONLY PREFLIGHT (before owner G1 approval)
git status --short --branch
git branch -vv
git rev-parse HEAD
git diff --stat
git ls-files --others --exclude-standard

# ONLY AFTER EXPLICIT G1 APPROVAL, AND ONLY IF SAFE:
git fetch origin
git switch -c feature/projecttrace-progress-finance-summary origin/development

# ONLY AFTER EXPLICIT G2 APPROVAL, WITH REVIEWED PATHS:
git add -- <exact-approved-Step-59-60-paths>
git diff --cached --name-status
git diff --cached --stat
git diff --cached --check

# ONLY AFTER EXPLICIT G3 APPROVAL:
git commit -m "feat(projecttrace): add physical and financial progress views (steps 59-60)"

# ONLY AFTER EXPLICIT G4 APPROVAL:
git push -u origin HEAD:refs/heads/feature/projecttrace-progress-finance-summary
```

Even `git fetch` does not authorize a branch switch. Do not attempt a duplicate branch. If remote `development` changes, rerun comparisons before approvals. Do not merge `development` into `main` merely for next-step progression.

---

## 11. Open risks, known blockers and Step 61 handoff

### Security and technical blockers needing explicit record

1. **Contractor actor mapping:** current `Contractor` has no authenticated `userId`; no inferred assignment. P0 Contractor reporting cannot be claimed without a proven association or approved minimal relation.
2. **Finance record authority:** recorded PAID status is not proven bank settlement; financial summary must label provenance honestly and avoid authoritative public-spending claims. No payment workflow implementation in Step 60.
3. **Project ACTIVE lifecycle:** Step 56's START action was previously intentionally blocked; Step 59 must not unlock it. Synthetic ACTIVE fixtures are valid solely for isolated demos and must be labeled as such.
4. **Step 51 hierarchy/grant races:** unresolved global authorization concurrency issue; no false security signoff beyond tested Step 59/60 scenarios.
5. **Missing Step 58 weight/hard-delete:** explicitly deferred and out of scope for Steps 59–60.
6. **Operational release blockers:** live Atlas indexes/access, email delivery, null-agency Super Admin, native Sinhala/Tamil acceptance, real staging login cookies, branch protection, monitoring/backups, and overall owner acceptance all remain separate **production BLOCKED** gates.
7. **Historical review text:** Step 58 review was created before later Git PR integration; distinguish historical local branch details from today's verified remote state.

### Handoff to Step 61 — Project Timeline

Persist and type **timestamped, scoped, minimal** Step 59 progress events so Step 61 can render a broader project timeline later; do not implement a global project timeline now. Step 60 should provide a read-only bounded summary compatible with future Finance workflows, without propagating synthetic money into trusted records. Record unresolved actor, calculation and audit semantics for the next step. The final verdict must explicitly separate **Step 59**, **Step 60**, **combined phase**, and **production deployment**.

---

## 12. Final execution output format

At the end of the phase, return the following concise, evidence-based completion summary:

1. Current branch/HEAD and `origin/development` (verified; no guessing).
2. Scope implemented per step; files/routes/data models added or changed, with source vs proposal decisions.
3. Test commands, actual counts/exits and warnings; demo roles, live local URLs, screenshots and request outcomes.
4. Security findings, concurrency/rollback proof, financial source/provenance, excluded functionality and mandatory gates still blocked.
5. Step 59 and Step 60 independent PASS/FAIL/BLOCKED/NOT RUN matrices; overall APPROVE/REVISE/BLOCKED recommendation labeled as same-agent where applicable.
6. Exact Git approval checkpoint reached; **do not stage/commit/push/create PR/merge unless separately authorized**; release state remains BLOCKED.

**Stop before Step 61 implementation.**
