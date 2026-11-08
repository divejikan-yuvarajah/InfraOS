# INFRAOS — PHASE 9 · BATCH 05 (STEPS 95–97)
## Project Finance: Budgets & Revisions · Expenses · Payments · Budget-vs-Verified-Progress Intelligence · Financial Dashboard
### Claude Code implementation prompt — copy everything below into Claude Code from the repository root

---

## 0. ROLE AND MISSION

You are a senior full-stack engineer (Next.js/React, Express/Mongoose/MongoDB), a financial-systems-integrity architect and a premium-UI engineer working inside the existing **INFRAOS** monorepo. Implement **Batch 05 of Phase 9 — Steps 95–97** as one cohesive change set:

| Step | Deliverable |
|---|---|
| 95 | **Budget management**: approved budget, category allocations, **revision workflow with approval**, history, utilization, variance, alerts |
| 96 | **Expense & payment management**: expenses (record → verify), payments (request → approve → mark paid), duplicate prevention, immutable ledger with controlled **reversals**, contractor-linked, CSV export |
| 97 | **Budget vs physical progress intelligence** + **financial dashboard**: spend vs *verified* progress, spend-ahead / overspend / cost-efficiency flags, portfolio and project views |

Batch 04 delivered contractors + assignments + the evidence adapter. Batch 06 (inspections/verification) and Batch 07 (assets/maintenance/coordination scores) come later — **do not build them**, but build clean seams (§4.9).

This is **payment tracking and approval inside InfraOS — not bank transfers or treasury integration.** Nothing here moves money; "PAID" means *an authorized user recorded that payment was made*, with a reference. Say so in the UI (one subtle, permanent line) and never imply otherwise.

Deadline-driven university project: **working functionality and a perfect, modern look beat breadth.** Every button, form, filter, table, chart, approval action and dialog must really work. No placeholder buttons, no fake charts, no mock money shown as real data.

---

## 1. HARD RULES (non-negotiable)

1. **Inspect before you write.** Never invent paths, models, permissions or helpers. §2 is recon at the time of writing — re-verify everything you depend on.
2. **Reuse, don't duplicate.** Extend `ProjectPayment`; reuse `moneySchema`, `summarizeRecordedPayments`/financial-progress service patterns, audit log, notification service, scope helpers, Batch 04 assignments/evidence adapter, shared UI/forms/data-table, i18n, tokens. No second payments model, no second money type.
3. **Money = integer LKR cents** (`amountMinor`, safe integers). All authoritative arithmetic in integers or `BigInt`; ratios in basis points/hundredths via integer math (see the existing `summarizeRecordedPayments`). **No floating-point money**, anywhere — server or client. User-entered amounts are parsed from decimal **strings** to cents (never `parseFloat(x)*100`).
4. **Server-side authorization only**, agency-scoped, permission-checked **inside the transaction**. UI hiding is never security. Financial data never leaks to users without the matching finance permission + project scope.
5. **Approved financial records are never silently edited.** Corrections happen through **revisions (budget) or reversals (expenses/payments)** that preserve the original row, with reason, actor and audit trail.
6. **Maker–checker everywhere:** the person who creates/requests cannot approve/verify/reverse their own item (server-enforced; the existing payment model already validates `createdBy ≠ approvedBy` — extend the rule, keep it).
7. **Verified progress ≠ claimed progress.** Intelligence uses *verified* physical progress where it exists; otherwise it uses reported progress **clearly labelled "reported — not verified"** and downgrades conclusions to "indicative". Never present contractor claims as approved progress.
8. **No new dependencies**, no AI, no unrelated refactors, no package upgrades, no heavy test suites, no extra Markdown reports (≤ 12 lines appended to the existing database doc is fine). Charts are **custom SVG/CSS** (no chart library is installed).
9. **Never touch `main` or `development` directly; never force-push.** See §10.
10. Read `apps/web/CLAUDE.md` / `AGENTS.md` first — this Next.js version has breaking changes; read the relevant guides in `apps/web/node_modules/next/dist/docs/` before writing Next code.
11. Match conventions: Conventional Commits, `success()/failure()` envelopes, `noStore`, strict zod (reject unknown + repeated keys), `requireAuthenticated` + `requirePermission`, `AuditLog.create` with allowlisted snapshots, `strict: "throw"` schemas, `useWorkspaceLocale()` + message dictionaries, `guard()/moved()` API client pattern.

---

## 2. RECON FINDINGS (re-verify against the code)

**Repo:** npm workspaces `apps/web` (Next 16, React 19, Tailwind 4, shadcn/radix, react-hook-form + zod, react-query, react-table), `apps/api` (Express 5, Mongoose 8, zod 4, vitest + mongodb-memory-server), `packages/shared-types`. Flow: feature branch → PR into `development` (squash).

**Finance today (`apps/api/src/modules/finance/`):** only `finance.constants.ts` and `models/project-payment.model.ts`.
- `PAYMENT_TYPES = ADVANCE, INTERIM, FINAL, RETENTION, OTHER`; `PAYMENT_STATUSES = PENDING, APPROVED, REJECTED, PAID, CANCELLED`.
- `ProjectPayment` (collection `projectPayments`, `strict:"throw"`): `projectId`, `contractorId`, `amount` (`moneySchema`), `paymentType`, `status`, `approvedBy?`, `date`, `createdBy`; pre-validate hook rejects `createdBy == approvedBy`; indexes `{projectId,date}`, `{contractorId,date}`, `{status,date}`. **No routes, no payment number, no invoice reference, no rejection reason, no paid timestamp, no assignment link, no reversal.**
- **No budget, budget-revision or expense model.** The only budget is `Project.budget` (required `moneySchema`), plus caches `Project.physicalProgress` (0–100, `percentage()`, from progress reports) and `Project.financialProgress` (comment: "derived from PAID payments / budget by the future Finance service").
- `projects/financial-progress.policy.ts` (`summarizeRecordedPayments`: BigInt math, `availability: "unavailable" | "provisional"`, `ratioPercent` in hundredths, provenance text) + `financial-progress.service.ts` (`GET /projects/:id/financial-progress`, requires **all of** `project.read`, `finance.budget.read`, `finance.payment.read`, scoped by `projectReadFilter`) are **live and consumed** by the web (`lib/projects/finance-api.ts`, `finance-summary.ts`, the dual progress bar on the project overview). **Keep that route and response shape working unchanged** (other code depends on it); new code may reuse its policy functions.
- `identity/authorization/resource-scope.ts` has an **older** `approvePayment()` helper (PENDING→APPROVED, blocks self-approval, SUPER_ADMIN denied: "not granted until a reviewed payment workflow exists"). Check whether anything routes to it; the new payment service **supersedes** it — don't duplicate, either delegate or retire it safely (list what you did).

**Permissions** (`packages/shared-types/src/permissions.ts`): `finance.budget.read|update`, `finance.payment.create|read|update|approve|reject`, `finance.report.export`. Seed grants (`identity/seed/system-role-permissions.ts`; **print and confirm**): GOV_ADMIN = all of them; AGENCY_OFFICER & PROJECT_MANAGER = `budget.read/update`, `payment.create/read/update`, `report.export` (**no approve/reject**); SUPER_ADMIN = `budget.read`, `payment.read`, `report.export` only (platform oversight, no writes); CONTRACTOR/INSPECTOR = none. **There is no "finance officer" role and no expense permissions** — do not invent a role. Scope: `resolveResourceScope` → platform (SUPER_ADMIN) / agencies (GOV_ADMIN own+descendants; AGENCY_OFFICER, PROJECT_MANAGER own agency) / none (CONTRACTOR, INSPECTOR, CITIZEN). `projectReadFilter`, `projectWriteFilter(actor, scope)` are the project helpers; check how/if PROJECT_MANAGER is narrowed to managed projects in `projectWriteFilter`/`readFilter` (roadsync narrows by `managerId`) and mirror exactly.

**Audit:** `AuditLog` snapshot is an **allowlist** (includes `status`, `reason`, `agencyId`, `contractorId`, `physicalProgress`, `financialProgress`, `budget`, `amount`, `cost`; strict). `AUDIT_RESOURCES` includes `PAYMENT` (no `BUDGET`/`EXPENSE` — add minimally to constants **and** whatever mirrors it, deliberately). Action regex `/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/`. Reference transaction+audit pattern: `agencies/management/agency-management.service.ts`, `roadsync/work-requests.service.ts` (`assertLive`, `withTransaction`). Notices: `notifications/notice.service.ts` (`notifyCommittedAudit`) — follow the existing hook usage. Atomic sequence pattern: `RoadsyncCounter` / `nextConflictNo` in roadsync (check whether a generic counter exists; if not, create the smallest generic one — don't reuse a roadsync-named model for finance).

**Projects:** statuses DRAFT, SUBMITTED, UNDER_REVIEW, REJECTED, APPROVED, ACTIVE, ON_HOLD, DELAYED, COMPLETED, CANCELLED; `lifecycle.policy.ts` requires `budget` for submission; `projects.schema.ts` has a `budgetSchema` for create/patch — **check whether PATCH can change `budget` after approval** (see §4.1). Web: `components/projects/project-record-tabs.tsx` (tabs overview/milestones/progress/timeline/activity), `lib/projects/*`.

**Batch 04 (expected merged):** `contractorAssignments` collection (`projectId`, `contractorId`, `role` PRIMARY|ADDITIONAL, `status` ACTIVE|ENDED|REPLACED|TERMINATED, `contractReference?`, `contractValue?`, dates), `Project.contractorId` = current primary, `contractor-evidence.ts` adapter (single extension point), contractor status ACTIVE|SUSPENDED|INACTIVE|ARCHIVED, tiered contractor access, `contractor.*` permissions, insight-strip/filter-bar/status-badge/evidence-drawer UI patterns, LKR formatters in `lib/contractors/format.ts`.

**Inspections (existing thin model, redesigned in Batch 06):** `inspections` has `projectId`, `inspectionDate`, optional `physicalProgress`, `status` (…`VERIFIED`…). Use **only** through the progress-source adapter (§4.6) so Batch 06 can replace it.

> **BATCH 04 FINAL REPORT / HANDOFF NOTES (authoritative if present — else derive from the code):**
> `[PASTE BATCH 04 REPORT HERE]`

---

## 3. PREFLIGHT (≤ 15 lines, then continue unless blocked)

1. `git fetch origin`; `git status` clean; branch + `git log --oneline -5`.
2. **Is Batch 04 merged into `origin/development`?** Look for `modules/contractors/models/contractor-assignment.model.ts` and `contractor-evidence.ts`. **Yes** → branch from `development`. **No** → **STOP and ask me**: (A) I merge Batch 04 first; (B) stack this branch on `feature/contractor-management`; (C) other. Don't guess; don't build payments without assignment linkage.
3. `npm install` if needed; Node ≥ 22; baseline `npm run type-check` + finance/projects/contractors tests; list pre-existing failures (don't fix).
4. Re-verify §2; print the exact role→finance-permission matrix; find every reader/writer of `ProjectPayment`, `Project.budget`, `Project.financialProgress`, `Project.physicalProgress` and the old `approvePayment()`.
5. **Permission propagation check (critical):** how do new permissions reach existing databases/roles — `sync-super-admin-permissions.ts`, `seed-core.ts`, any test asserting catalog ⇄ seed parity? Describe the safe path **before** adding permissions (§4.2). If there is no safe additive path, stop and ask me.
6. Check the Mongo deployment supports transactions in dev/test (existing services use `withTransaction`; mongodb-memory-server replica set in tests) and reuse the same test helper.
7. Check `lib/contractors/format.ts` (Batch 04) and existing money/LKR helpers; check `components/forms/fields.tsx` for an existing money field.

---

## 4. DATA, DOMAIN AND BACKEND

### 4.1 Budget: `projectBudgetRevisions` (append-only ledger) + `Project.budget` as the current approved total

New collection `projectBudgetRevisions` (`strict:"throw"`, append-only hooks like `ProgressReport`'s except the **decision fields** on a PENDING revision):
- `projectId`, `agencyId` (denormalised), `sequence` (1…n per project, unique `{projectId, sequence}`), `kind`: `INITIAL | REVISION`, `status`: `PENDING_APPROVAL | APPROVED | REJECTED | CANCELLED`, `previousTotal` (`moneySchema`), `newTotal` (`moneySchema`, > 0), `allocations[]` (≤ 15): `{ category, amount (moneySchema) }` where **Σ allocations ≤ newTotal** (remainder = "Unallocated", shown, never hidden), unique category per revision; `reason` (≥ 12 chars; required for REVISION), `requestedBy`, `requestedAt`, `decidedBy?`, `decidedAt?`, `decisionNote?` (required on reject), `supersededBy?`.
- **Categories (constant, shared with expenses):** `CIVIL_WORKS, MATERIALS, LABOUR, EQUIPMENT, DESIGN_SUPERVISION, UTILITY_RELOCATION, CONTINGENCY, ADMIN_OVERHEAD, OTHER` (generic project-cost categories; **do not invent government object/account codes**).
- `Project.budget` = latest **APPROVED** `newTotal`, updated **only** by the budget service in the same transaction as approval (also touch `$inc: { financeVersion: 1 }` — new additive Project field — to serialize all budget-affecting writes per project via Mongo write conflicts). 
- **Workflow:** projects not yet APPROVED keep using the existing project create/edit budget field (unchanged). From **APPROVED onward**, the budget changes **only** through revisions: request (`finance.budget.update`) → approve/reject (approver ≠ requester; permission in §4.2) → on approve: new total must be **≥ committed + paid** (approved-but-unpaid payments + paid − reversed) else 409 `BELOW_COMMITMENTS` with the numbers; at most **one PENDING revision per project** (partial unique index). If `PATCH /projects/:id` can currently change `budget` for APPROVED+ projects, **block that in the project service** (409 with message pointing to revisions) — flag this in the report as a behaviour change.
- **Backfill script** `scripts/backfill-finance-batch05.ts` (+ `db:backfill:finance`, dry-run default, `--commit`): for each existing project with `Project.budget`, create `sequence:1 INITIAL APPROVED` revision (allocations empty; `requestedBy` = project `createdBy`; decided by system → store `decidedBy` null with `decisionNote:"Backfilled from project budget"`), idempotent; backfill `paymentNo` for existing payments; set missing new payment fields to documented defaults. Never invents amounts.
- **Impact preview endpoint** (no writes) returns: current vs proposed total, committed, paid, new utilization %, new remaining, allocation sums/unallocated, and any blocking reason — powering the revision dialog's live preview.

### 4.2 Permissions (minimal, additive, explicit)
Add to `permissions.ts` (+ shared constants, seeds, sync script, parity tests): `finance.budget.approve`, `finance.expense.read`, `finance.expense.create`, `finance.expense.verify`. Grants: GOV_ADMIN = all four; AGENCY_OFFICER = `expense.read/create/verify`; PROJECT_MANAGER = `expense.read/create`; SUPER_ADMIN = `expense.read` (oversight); others none. **Maker–checker still applies on top** (a GOV_ADMIN can't verify/approve their own submission). Provide the one-command way to apply grants to an existing database (reuse/extend the existing sync script; idempotent) and document it in the PR. **List the final role→finance matrix in the report and flag it for my approval.** Existing `finance.payment.*` keep their meaning: create/update = request/edit/mark-paid/cancel; approve/reject = decide; `finance.report.export` = CSV export.

### 4.3 Expenses: `projectExpenses`
`strict:"throw"`, timestamps: `expenseNo` (`EXP-YYYY-NNNNNN` atomic counter), `projectId`, `agencyId`, `category` (the shared enum), `description` (≤ 500, required), `expenseDate` (required; not in the future beyond today in Asia/Colombo; not before project `startDate` − 30 days → warn only), `amount` (`moneySchema` > 0), `contractorId?` (must hold an assignment on the project, any status), `assignmentId?`, `supplierName?` (≤ 120), `supportingRef` (invoice/receipt/voucher number, ≤ 80, required), `documentIds[]?` (refs to existing `Document`s only, ≤ 10, validated through the existing document-read scope — **no file upload here**), `status`: `DRAFT | PENDING_VERIFICATION | VERIFIED | REJECTED | REVERSED`, `submittedAt?`, `verifiedBy?`, `verifiedAt?`, `rejectionReason?`, `reversal?` `{ by, at, reason }`, `duplicateKey` (server-owned hash of normalized `projectId|supplier|supportingRef|amountMinor`), `createdBy`.
- **Rules:** edit allowed only in `DRAFT` or `REJECTED` and only by the creator (or GOV_ADMIN of scope); `VERIFIED` rows are immutable → **reverse** (verifier-level permission, reason ≥ 12, `reversal` recorded, row stays; excluded from totals) and re-enter a corrected expense; verify/reject by someone ≠ creator; reject requires reason ≥ 12 → creator can fix and resubmit. 
- **Duplicate prevention:** partial unique index on `duplicateKey` where `status ∈ {PENDING_VERIFICATION, VERIFIED}`; friendly 409 with the existing expense number (only if visible). Expenses in `DRAFT` don't count against budget. Verified expenses count as **recorded expenditure**.
- Indexes: `{projectId:1,status:1,expenseDate:-1}`, `{agencyId:1,status:1}`, `{contractorId:1,expenseDate:-1}`, `{category:1,projectId:1}`.

### 4.4 Payments: extend `ProjectPayment` (same collection)
Add (all additive; `strict:"throw"` stays): `paymentNo` (`PAY-YYYY-NNNNNN`, unique, atomic counter), `agencyId` (denormalised), `assignmentId?`, `invoiceReference` (≤ 80, **required for new**), `description?`, `requestedAt`, `decidedAt?`, `decisionNote?` (required on reject), `paidAt?`, `paidBy?`, `paymentReference?` (manual bank/treasury/cheque reference, ≤ 80, **required** to mark PAID), `cancelledAt?`, `cancelReason?`, `reversal?` `{ by, at, reason }`. Extend `PAYMENT_STATUSES` with **`REVERSED`** (also in shared-types enums). Keep existing `date` as the invoice/payment request date.
- **State machine:** `PENDING → APPROVED | REJECTED | CANCELLED`; `APPROVED → PAID | CANCELLED`; `PAID → REVERSED`; terminal: REJECTED, CANCELLED, REVERSED. Every transition: single atomic `findOneAndUpdate` with the expected current status in the filter **inside** a transaction that also touches the project's `financeVersion`, writes the audit row, recomputes the `Project.financialProgress` cache (§4.6), and emits notices. Illegal transition → 409.
- **Who:** request/edit(PENDING only, own)/cancel(own or approver)/mark-paid → `finance.payment.create|update` in project write scope; approve/reject/reverse → `finance.payment.approve|reject` (approver ≠ `createdBy`; **reverse** also ≠ `paidBy`). SUPER_ADMIN stays read-only (as today).
- **Duplicate prevention:** partial unique on `{projectId, contractorId, invoiceReference}` for statuses ∉ {REJECTED, CANCELLED, REVERSED}; plus identical `{projectId, contractorId, amount, date, paymentType}` PENDING within 24 h → 409 with link to the existing request.
- **Payment Gate Checklist (server-evaluated at *request* time, shown on the detail panel, and **re-evaluated inside the approve transaction**; BLOCK gates make approve/mark-paid impossible, WARN gates are displayed and recorded in the audit `reason`):**

| Gate | Result | Rule |
|---|---|---|
| Project eligible | BLOCK | Project status ∈ APPROVED, ACTIVE, ON_HOLD, DELAYED, COMPLETED (not DRAFT/SUBMITTED/UNDER_REVIEW/REJECTED/CANCELLED); ON_HOLD allows only FINAL/RETENTION/OTHER |
| Contractor eligible | BLOCK | Contractor holds an assignment on the project and is not SUSPENDED/ARCHIVED (Batch 04); INACTIVE → block |
| Budget headroom | BLOCK | paid + approved(unpaid) + this ≤ current approved budget (`BUDGET_EXCEEDED`; resolution = approved budget revision) |
| Contract cap | WARN | cumulative payments to this assignment ≤ its `contractValue` (WARN; BLOCK is not safe because contract values get varied); skipped (shown "n/a — no contract value recorded") if unset |
| Duplicate invoice | BLOCK | §above |
| Progress support | WARN | For INTERIM/FINAL: cumulative (approved+paid)/budget ≤ progress source % + 10 pp; basis label shown ("verified" / "reported — not verified"); FINAL additionally WARN unless project COMPLETED or progress ≥ 95 % |
| Maker–checker | BLOCK | actor ≠ requester |

Gate objects: `{ key, status: PASS|WARN|BLOCK|SKIPPED, message, values }`. Approving with WARN gates requires the approver to tick "I reviewed the warnings" (server requires `acknowledgeWarnings:true` when any WARN exists) and the audit `reason` records the warning keys.

### 4.5 Counters, locking and transactions
- Sequences: `PAY-YYYY-NNNNNN`, `EXP-YYYY-NNNNNN` via a generic atomic counter (`findOneAndUpdate $inc upsert`), never from counts.
- **All multi-document writes** (state change + audit + project cache + notices-after-commit) in one `withTransaction`. Re-check permission + scope + project status **inside** the transaction. Touching `Project.financeVersion` serializes concurrent approvals/payments per project so headroom checks can't race; add a test that two simultaneous approvals that together exceed the budget cannot both succeed.
- Notices (after commit via the existing hook; best-effort, never roll back finance state): payment requested → project agency approvers (holders of `payment.approve` in scope); approved/rejected/paid → requester; budget revision requested → approvers; decided → requester; utilization crossing 80/95/100 % (dedupe per project+threshold).

### 4.6 Intelligence (Step 97) — pure rules + service

`finance-intelligence.rules.ts` (pure, fully unit-tested, `RULE_VERSION = "f1"`, all thresholds in one block) and `physical-progress.source.ts` (adapter).

**Definitions (integers only):**
- `budget` = `Project.budget`. `paid` = Σ PAID. `approvedUnpaid` = Σ APPROVED. `pending` = Σ PENDING. `committed` = approvedUnpaid + paid. `recordedExpenditure` = Σ VERIFIED expenses. `exposure` = committed + pending (shown as "if all pending is approved").
- `utilizationBp` = floor(committed × 10 000 / budget) (basis points); **zero/missing budget ⇒ `unavailable: missing_budget`** (never divide, never 0 %).
- `financialProgressBp` = floor(paid × 10 000 / budget) (matches the existing provisional ratio; keep numbers identical to `summarizeRecordedPayments`).
- **Physical progress source (adapter):** returns `{ valuePct, basis, asOf, sourceRef }` where `basis ∈ VERIFIED_INSPECTION | REPORTED_UNVERIFIED | NONE`. Today: latest `VERIFIED` inspection with `physicalProgress` for the project (by `inspectionDate`) → `VERIFIED_INSPECTION`; else `Project.physicalProgress` (from progress reports) → `REPORTED_UNVERIFIED`; else `NONE`. **Batch 06 replaces the first branch** with the real verification records; everything downstream keeps working. Never use `REPORTED_UNVERIFIED` to raise a "confirmed" conclusion.
- `gapPp` = financial % − physical % (percentage points, 1 dp, integer math) when both available.
- **Cost-efficiency index (CEI)** = physical % ÷ financial % (x.xx), shown **only** when basis is VERIFIED_INSPECTION and financial ≥ 5 % and physical ≥ 5 %; otherwise `INSUFFICIENT_EVIDENCE`.
- **Flags** (code, severity LOW/MEDIUM/HIGH, plain-language reason with the numbers, `confidence: CONFIRMED | INDICATIVE`): `OVER_BUDGET_COMMITMENT` (committed > budget; HIGH), `NEAR_BUDGET` (≥ 95 % MED, ≥ 80 % LOW), `SPEND_AHEAD_OF_PROGRESS` (gap ≥ +10 pp → MED, ≥ +20 pp → HIGH; CONFIRMED only with verified basis, else INDICATIVE), `PAYMENT_WITHOUT_VERIFIED_PROGRESS` (paid > 0 and basis ≠ VERIFIED), `PENDING_PAYMENT_BACKLOG` (pending older than 14 days), `CONTRACT_VALUE_EXCEEDED`, `LARGE_UNALLOCATED_BUDGET` (> 30 % unallocated, info), `PHYSICAL_AHEAD_OF_SPEND` (gap ≤ −20 pp, info — possible unbilled work), `BUDGET_REVISION_PENDING`. Add category-level overspend: **expense category > its allocation** (`CATEGORY_OVERSPEND`) when allocations exist.
- Everything returns `inputs` and `formulaKey` so the UI can explain "How is this calculated?".
- **Cache sync:** after any PAID/REVERSED transition set `Project.financialProgress` = paid/budget % (2 dp, from the same integer math) in the **same transaction**; never write `physicalProgress`.

### 4.7 Endpoints (NEW; mount `/api/v1/finance`; keep `/projects/:id/financial-progress` unchanged)
All: `requireAuthenticated`, permission(s), project scope via `projectReadFilter`/`projectWriteFilter` (out-of-scope id ⇒ **404**), strict zod (unknown/repeated keys → 400), `noStore`, envelopes, rate limits (tighter on mutations/exports), allowlisted responses (no raw documents), audit on every mutation, `maxTimeMS` on aggregates.

| Method + path | Permission | Purpose |
|---|---|---|
| `GET /finance/summary` | `finance.budget.read` | Portfolio KPIs (scoped): total approved budget, committed, paid, pending, remaining, utilization, # projects over/near budget, # flagged, # pending approvals (for the actor), recent transactions (10), top flags. Filters: `agencyId`, `projectStatus`, `dateFrom/dateTo`. |
| `GET /finance/projects` | `finance.budget.read` | Portfolio table + quadrant data per project: budget, committed, paid, pending, utilization, financial %, physical % + basis, gap, flags[], contractor name. Filters: `q`, `agencyId`, `status`, `flag`, `overBudget`, `basis`, `sort`, `page`, `limit` ≤ 50. |
| `GET /finance/projects/:projectId` | `finance.budget.read` | Project finance overview: budget, allocations (+ spent/committed per category), totals, intelligence (§4.6), alerts, pending actions for the actor. |
| `GET /finance/projects/:projectId/ledger` | `finance.payment.read` or `finance.expense.read` | Cursor-paginated chronological ledger merging budget revisions, expenses and payments with **running committed/paid balance**; fields tiered by permission. |
| `GET/POST /finance/projects/:projectId/budget/revisions` · `POST …/preview` · `POST …/:id/approve|reject|cancel` | read: `budget.read`; request/cancel: `budget.update`; decide: `budget.approve` | Budget revisions as §4.1. |
| `GET /finance/expenses` · `GET /finance/expenses/:id` | `finance.expense.read` | List (filters: project, category, status, contractor, date range, amount range, `q`, sort, page) / detail. |
| `POST /finance/projects/:projectId/expenses` · `PATCH /finance/expenses/:id` · `POST …/:id/submit|verify|reject|reverse` | `expense.create` / `expense.verify` | Expense workflow §4.3. |
| `GET /finance/payments` · `GET /finance/payments/:id` | `finance.payment.read` | Queue/list (filters: status, type, project, contractor, agency, date range, `needsMyApproval`) / detail incl. **live gate checklist**, timeline of state changes (from audit), contractor + assignment summary. |
| `POST /finance/projects/:projectId/payments` · `PATCH /finance/payments/:id` · `POST …/:id/approve|reject|cancel|mark-paid|reverse` | create/update/approve/reject per §4.4 | Payment workflow. `mark-paid` body: `paidAt`, `paymentReference`. |
| `GET /finance/payments/preview-gates` | `payment.create` | Gate evaluation for a draft request (no writes) so the request form shows warnings/blocks live. |
| `GET /finance/contractors/:contractorId/summary` | `finance.payment.read` + contractor visibility (Batch 04) | Per-contractor totals (paid, pending, # projects, over-cap assignments) over in-scope projects — consumed by the contractor profile "Finance" card. |
| `GET /finance/export/payments.csv` · `/expenses.csv` | `finance.report.export` | Server-generated CSV (cap 5 000 rows, same filters, scope-safe, **CSV-injection-safe** — prefix `'` to cells starting with `= + - @`; reuse the existing `csvCell` helper if present), export event audited (`finance.exported`, counts only). |

Amounts in requests are **strings** (`"1250000.50"`) or `amountMinor` integers — pick one and validate strictly (max 2 dp, ≤ 15 integer digits, positive); responses carry `amountMinor` + `currency` only (formatting is a client concern).

### 4.8 Audit
Actions: `budget.revision_requested|revision_approved|revision_rejected|revision_cancelled`, `expense.created|updated|submitted|verified|rejected|reversed`, `payment.requested|updated|approved|rejected|cancelled|paid|reversed`, `finance.exported`. Snapshot keys only from the allowlist (`status`, `reason`, `agencyId`, `contractorId`, `amount`, `budget`, `financialProgress`, `physicalProgress`). Add `BUDGET` and `EXPENSE` to `AUDIT_RESOURCES` (and any mirrored list/type) — nothing else. `reason` carries the decision note / warning keys, never free personal data.

### 4.9 Seams for later batches (code comments only)
- `physical-progress.source.ts` is the **only** place Batch 06 plugs verified progress into finance (also exposes `asOf/sourceRef` so verification records can be linked).
- Payment gates are an array of pure functions; Batch 06 can add "inspection hold" gates; Batch 07 can add asset-handover gates.
- Extend Batch 04's `contractor-evidence.ts` with `financeEvidence` (paid totals, over-cap assignments, payments-without-verified-progress count) and add the risk flag `PAID_AHEAD_OF_VERIFIED_PROGRESS` + a read-only **Finance** card on the contractor profile (tier: needs `finance.payment.read`). Don't alter existing indicator semantics.

### 4.10 Seeds (small, clearly synthetic)
Extend the existing demo seeds (idempotent; reuse helpers; `reset-demo`/`verify-demo` updated): initial revision #1 for every demo project with a budget; one **approved revision** and one **pending revision**; allocations on 2 projects; ≥ 8 expenses covering DRAFT/PENDING/VERIFIED/REJECTED/REVERSED; ≥ 8 payments covering PENDING/APPROVED/PAID/REJECTED/CANCELLED/REVERSED across ≥ 2 contractors/assignments; **one project spending ahead of progress** (paid well above physical %), **one near budget (≥ 95 %)**, **one healthy**; at least one **VERIFIED** inspection with `physicalProgress` on a demo project so the verified basis is demonstrable, and another project with only reported progress. Label descriptions "(Synthetic)". No real vendor/people data.

---

## 5. FRONTEND — PERFECT MODERN UI/UX

### 5.1 Routes, navigation, files
`/finance` (portfolio dashboard), `/finance/payments` (payment queue), `/finance/expenses` (expense register), `/projects/[id]/finance` (project finance workspace; add a **Finance** tab to `project-record-tabs.tsx`, shown only to users with `finance.budget.read`; keep the existing dual progress bar on the overview and add a "Open finance →" link). Nav item **Finance** (wallet/landmark icon, `i18n` si/ta) in `components/auth/workspace-nav.ts` gated on `finance.budget.read`; add `finance` to `lib/auth/route-access.ts` + test. Contractor profile: add the read-only **Finance** card (Batch 04 page) wired to `/finance/contractors/:id/summary`.

Suggested files (adapt to conventions): `components/finance/{finance-dashboard,portfolio-table,spend-quadrant,project-finance-workspace,budget-panel,budget-revision-dialog,revision-impact-preview,allocation-editor,expense-register,expense-form,expense-drawer,payment-queue,payment-form,payment-drawer,payment-stepper,gate-checklist,decision-dialogs,reversal-dialog,ledger-timeline,intelligence-panel,progress-compare-chart,category-donut,utilization-ring,money-input,money-text,finance-badges,approval-inbox,export-button}.tsx`; `lib/finance/{api.ts,types.ts,money.ts,list-query.ts,schemas.ts,messages.ts,view.ts}` (+ small tests for pure helpers).

### 5.2 Design language (make it feel like a premium fintech-grade console, in InfraOS tokens)
- **Calm, high-trust surfaces:** off-white/soft-slate canvas, white cards with hairline borders and very soft shadows, generous whitespace, 8-pt rhythm, **tabular numerals** and right-aligned amounts everywhere, restrained accent colour for actions, semantic colours only for state (never colour-only: icon + label always).
- **Money typography:** `money-text` renders `Rs. 12,450,000.00` with muted currency prefix and de-emphasised cents; compact KPI form `Rs. 12.45 Mn` with the exact value in a tooltip; negative/over amounts shown with explicit "over by" wording; locale-aware via `Intl` (en/si/ta) — all from integer cents.
- **Hero KPI row** (skeleton-first): Approved budget · Committed · Paid · Pending approval · Remaining — each with a tiny inline bar, delta chip and click-to-filter behaviour. **Utilization ring** (SVG) with threshold ticks at 80/95/100 %.
- **Status chips with icons** (Pending ⏳, Approved ✔, Paid ₨, Rejected ✖, Cancelled ⊘, Reversed ↩) and the **Payment stepper** (Requested → Approved → Paid) showing who/when, with rejected/cancelled/reversed branches rendered clearly.
- Micro-interactions: 150–200 ms transitions, animated number count-up (disabled under reduced motion), inline row highlight after mutation, optimistic UI **only for non-financial UI state** (financial mutations wait for the server and show a pending state — never fake a committed amount).
- Responsive and accessible: focus rings, aria labels, `aria-live` for totals/filter counts, dialogs trap focus and close on Escape, tables keyboard navigable, contrast checked with the existing helpers, ≥ 44 px mobile targets.

### 5.3 Screens (each must be fully functional with loading/empty/error/forbidden states)

**A. Finance dashboard (`/finance`)**
- Header with scope chip, date-range picker (presets: This month / Quarter / FY-to-date / Custom), agency filter (where permitted), **Export** menu (payments/expenses CSV; visible with `finance.report.export`).
- **Approval inbox** card (only if the viewer holds approve/verify permissions): "N payments · M expenses · K budget revisions waiting for you" with inline Review buttons opening the real drawers/dialogs (excludes the viewer's own submissions, with a note "Your own submissions need another approver").
- KPI row (§5.2), **Spend-vs-Progress Quadrant** (unique function): SVG scatter, x = physical % (verified solid dot / reported hollow dot), y = financial %, diagonal parity line, shaded "spending ahead" zone; hover/focus shows a card; click selects the project → side drawer with its intelligence; legend explains basis; keyboard accessible (arrow keys move between dots); a **data table fallback** toggle for accessibility and mobile.
- **Portfolio table** (existing data-table): project code/title, agency, contractor, budget, committed, paid, utilization bar, financial % vs physical % mini dual-bar with basis icon, flags (max 2 + "+N"), row → project finance workspace. Server-side filters/sort/pagination with chips + URL state.
- **Flags & alerts** list (top items, each linking to the project), **Recent transactions** feed (from the ledger) with status chips.
- **Mobile:** KPI carousel, quadrant replaced by the accessible list view with mini-bars, filters in a bottom sheet, sticky "Review N" bar for approvers.

**B. Project finance workspace (`/projects/[id]/finance`)**
- Sticky summary header: project code/title/status, budget, committed, paid, remaining, utilization ring, **Dual progress bar** (financial vs physical with basis badge "Verified ✔ / Reported — not verified"), alert banner (flags) with plain-language reasons and **"How is this calculated?"** popovers (formula + inputs from the API).
- Segmented tabs: **Overview · Budget · Expenses · Payments · Ledger**.
  - *Overview:* intelligence panel (CEI, gap, flags with CONFIRMED/INDICATIVE tags), **cumulative spend vs progress timeline** (SVG step chart: paid cumulative by `paidAt` vs reported progress history, with verified inspection points marked; drawn only with ≥ 2 data points else an honest empty state), **category donut + bars** (allocation vs verified expense vs committed), contractor/assignment strip (Batch 04) with contract value, paid, cap usage meter.
  - *Budget:* current approved budget + allocations table (allocated / spent / remaining per category, overspend highlighted), **Request revision** button → dialog with allocation editor (add/remove categories, live "unallocated" counter, money inputs), **live Impact Preview** (calls the preview endpoint: before/after total, utilization, blocking messages), reason field, submit. **Revision history timeline** (sequence, requester, approver, reason, delta ±, status chips); pending revision card with Approve/Reject (approver only, ≠ requester; reject requires note) and Cancel (requester).
  - *Expenses:* register table (filters, search, status chips), **Add expense** (form: category, description, date, amount, supplier, supporting reference, contractor/assignment select, optional document references), Save draft / Submit; row drawer with details, status timeline, actions per permission (Verify, Reject with reason, Reverse with reason, Edit when allowed); duplicate warning when the server returns 409.
  - *Payments:* queue/table with **stepper** per row (compact), **Request payment** (form: contractor/assignment (Batch 04 active only), type, amount, invoice reference, date, description) with the **live Gate Checklist** panel (PASS/WARN/BLOCK/SKIPPED rows with explanations; Submit disabled on BLOCK, allowed on WARN with a visible note); payment drawer: header (paymentNo, amount, status), stepper, gate checklist (live), contractor/assignment/contract-cap meter, supporting refs, audit-backed timeline, actions — Approve (acknowledge-warnings checkbox when WARN), Reject (reason ≥ 12), Cancel, **Mark as paid** (paidAt + payment reference; clear note "Recording only — no funds are transferred by InfraOS"), Reverse (reason ≥ 12). All dialogs show pending states, map server errors to fields, and refresh totals/ledger/flags on success with a toast containing the document number.
  - *Ledger:* immutable chronological timeline with running committed/paid balance, filters by type, reversal rows visibly linked to originals, CSV export of the current filter.
- **Mobile:** sticky bottom action bar for the primary action of the active tab, tables become card lists, drawers become bottom sheets (reuse Batch 03/04 sheet patterns if present, else `components/ui/sheet`), forms are single-column with large inputs and numeric keypad (`inputMode="decimal"`).

**C. Payment queue (`/finance/payments`)** — cross-project approvals workspace: status tabs with counts (Needs my approval · Pending · Approved · Paid · Rejected/Cancelled · Reversed), filters (agency, contractor, project, type, date, amount range, search by paymentNo/invoice), bulk-safe actions (**no bulk approve** — approvals are individual, for integrity), drawer as above, export.

**D. Expense register (`/finance/expenses`)** — same pattern for expenses with category chips and a "Needs verification" tab.

**E. Contractor profile Finance card (Batch 04 page)** — paid / pending totals, # projects, over-cap assignments, "payments without verified progress" count, link to the filtered payment queue; hidden for users without `finance.payment.read` (shows a restricted note).

### 5.4 Money input and parsing (build once, reuse)
`money-input.tsx` + `lib/finance/money.ts`: string-only value model; accepts digits, thousands separators and up to 2 decimals; parses to `amountMinor` using integer/string operations (e.g., `"1,250,000.5"` → `125000050`); rejects negatives, > 2 dp, > 15 integer digits, NaN; displays with locale grouping on blur; paste-safe; `aria-describedby` for hints; exports `formatLkr`, `formatLkrCompact`, `parseLkrToMinor`, `percentFromBp`. Unit-test the edge cases (0.1+0.2 style traps, large values, rounding rules = reject, not round).

### 5.5 i18n
Complete `en/si/ta` dictionaries for every string (nav, titles, statuses, categories, payment types, gate names/messages, flag labels/reasons templates, formula tooltips, dialogs, empty/error/forbidden/restricted states, aria-labels, the "recording only — no funds are transferred" notice). Locale-aware dates (`date-fns`) and number/currency (`Intl`). Never translate stored data (payment numbers, invoice refs, supplier/contractor/agency names). Reuse existing Sinhala/Tamil finance terminology from the app; flag uncertain translations in the report. Verify long strings don't clip buttons/chips/tabs.

### 5.6 API client and state
`lib/finance/api.ts` with the `guard()/moved()` epoch pattern; React Query keys include scope-defining inputs (epoch, userId, roleKey) like `financeQueryKey` does; precise invalidation after each mutation (project overview, ledger, queue counts, dashboard, contractor summary, the legacy `financial-progress` key); abortable list queries; no financial data in URLs beyond ids/filters; no logging of amounts client-side.

---

## 6. AUTONOMOUS SELF-HEALING LOOP (applies to this whole batch)

At every ✔ checkpoint in §7 and again before the final push:
1. **Implement** the checkpoint.
2. **Run the essential checks** for what you touched: `npm run type-check`, `npm run lint` (touched workspaces), relevant vitest files (`finance.*`, `projects`, `contractors`, parity tests for permissions), `npm run db:indexes:check` (indexes changed), `npm run db:seed:demo` + `db:seed:verify` (seeds changed), finally `npm run build:web`.
3. **Identify failures** precisely (first error, file:line, root-cause hypothesis); re-run just the failing command to confirm.
4. **Fix the root cause.** Never delete/skip/weaken tests, add `eslint-disable`/`@ts-ignore`/`any`, loosen authorization or integrity checks, or special-case test data. Pre-existing baseline failures: list and work around narrowly.
5. **Re-run.** **Max 3 repair iterations per distinct failure.** If still failing, stop that thread and record it under "Unresolved" (error text, hypotheses tried, what you need) — **never hide or downplay** unresolved errors or flaky behaviour; don't loop further.
6. When critical checks are green, do a final self-review against §9 before committing.
7. Keep a ≤ 10-line check log (command → pass/fail → fix) for the report.

---

## 7. IMPLEMENTATION SEQUENCE (commit at each ✔; don't advance until checks for it are green)

1. Preflight + branch (§3, §10).
2. **Permissions & enums:** new permissions, grants, sync path, parity tests, shared enums (`REVERSED`, categories, audit resources). ✔
3. **Models & indexes:** `projectBudgetRevisions`, `projectExpenses`, `ProjectPayment` extension, generic counter, `Project.financeVersion`, `check-indexes`, backfill script. ✔
4. **Pure rules:** money helpers, gate functions, intelligence rules, progress-source adapter (+ tests). ✔
5. **Budget service + routes** (revisions, preview, approve/reject/cancel, project budget lock-down). ✔
6. **Expense service + routes.** ✔
7. **Payment service + routes** (state machine, gates re-evaluated in transaction, duplicates, mark-paid, reversal, cache sync, notices, supersede old `approvePayment`). ✔
8. **Intelligence/dashboard/ledger/export/contractor-summary endpoints.** ✔
9. **Seeds + reset/verify.** ✔
10. **Frontend foundation:** routes, nav, API client, money helpers/components, messages skeleton, badges, stepper. ✔
11. **Project finance workspace:** overview, budget (revision dialog + impact preview), expenses, payments (form + gates + drawer + dialogs), ledger. ✔
12. **Portfolio dashboard:** KPIs, approval inbox, quadrant, table, flags, recent feed; payment queue and expense register pages; contractor profile Finance card; Finance tab on projects. ✔
13. i18n (si/ta), responsive/a11y/visual polish pass (375/768/1280). ✔
14. Verification (§8), self-healing loop, cleanup, push, PR text. ✔

---

## 8. ESSENTIAL VERIFICATION ONLY

**Automated (small; existing vitest patterns; mongodb-memory-server replica set for API):**
- **Pure:** money parsing/formatting (no float drift), utilization/gap/CEI math incl. zero budget, huge values, BigInt boundaries; every gate pass/warn/block; every flag positive + negative; progress-source basis selection; state-machine transition table (all legal + sample illegal); duplicate keys.
- **API:** budget revision flow (request → approve updates `Project.budget` + creates audit; self-approval blocked; below-commitments blocked; one pending per project; PATCH project budget blocked after APPROVED); expense workflow incl. duplicate 409, verify ≠ creator, immutable VERIFIED, reversal excluded from totals; payment workflow incl. every transition + illegal transitions, maker–checker, gates re-evaluated at approval (budget headroom race: two concurrent approvals exceeding budget → exactly one succeeds), duplicate invoice, contractor suspended → blocked, mark-paid requires reference, reverse restores totals and `Project.financialProgress`, cache sync in same transaction (simulate failure → no partial state); scoping (other agency 404, PROJECT_MANAGER narrowing, SUPER_ADMIN read-only, CONTRACTOR/INSPECTOR denied), permissions per endpoint; unknown/repeated keys → 400; CSV export injection-safe + scoped + audited; allowlisted responses; audit snapshots only allowlisted keys; legacy `/projects/:id/financial-progress` shape unchanged.
- **Web pure:** list-query ⇄ URL round-trip, schemas vs server constraints, money helpers, i18n key parity en/si/ta, quadrant data mapping.
- Run: `npm run type-check`, `npm run lint`, `npm run test:api`, `npm run test:web`, `npm run build:web`, `npm run db:indexes:check`, `npm run db:seed:demo`, `db:seed:verify`, backfill dry-run **and** commit on demo data. List pre-existing failures without fixing them.

**Manual (report outcomes):**
1. Users: platform admin, GOV_ADMIN, AGENCY_OFFICER, PROJECT_MANAGER, CONTRACTOR-role, another agency's user.
2. Budget: request revision with allocations; live impact preview; approve as a different user; self-approve attempt blocked; pending/rejected/cancelled paths; history timeline; `Project.budget` and utilization update everywhere.
3. Expenses: draft → submit → verify; reject → edit → resubmit; reverse; duplicate attempt blocked with clear message.
4. Payments: request with WARN and BLOCK gates visible live; approve (with warning acknowledgement) as another user; mark paid with reference; reverse; stepper, timeline, toasts, totals and dashboard flags update; contractor suspended → blocked; budget headroom exceeded → blocked with resolution hint.
5. Intelligence: the "spending ahead" demo project shows INDICATIVE vs CONFIRMED correctly depending on basis; verified-basis project shows CEI; zero/missing evidence shows "Not enough evidence" (no fabricated numbers); formula popovers match values.
6. Dashboard: KPIs equal table sums; quadrant dots/keyboard/table fallback; filters server-side (check query strings); approval inbox excludes own submissions; CSV exports open correctly and are formula-safe.
7. Mobile (375 px, 768 px): sheets, sticky bars, numeric keypad, no horizontal scroll, 44 px targets; en/si/ta layout; keyboard-only pass through forms and dialogs; reduced-motion.
8. Existing project overview dual bar, RoadSync, contractor module (Batch 04) and (if merged) InfraMap unchanged.

---

## 9. WHAT MUST NOT HAPPEN (self-check before pushing)
- A control that renders but does nothing; a dead link; "coming soon" UI; fake chart data; mock money presented as real.
- Float arithmetic or float parsing on money; rounding user input silently instead of rejecting.
- Editing approved/paid/verified rows in place; non-transactional multi-document writes; budget headroom race.
- Self-approval/self-verification anywhere; SUPER_ADMIN gaining write powers; CONTRACTOR/INSPECTOR seeing finance data.
- Presenting reported progress as verified; zero or default values where evidence is missing.
- Finance data, counts or existence leaking across agency scope; sensitive values in audit snapshots, URLs or logs.
- Implying InfraOS transfers money.
- New dependencies, AI, secrets, real financial data; weakened/skipped tests; hidden unresolved errors.
- Colour-only status; hover-only mobile affordances; tap targets < 44 px.

---

## 10. GITHUB WORKFLOW

- **Base:** `development` once Batch 04 is merged (else §3.2).
- **Branch:** `feature/project-finance` (adapt to repo convention).
- **Commits (Conventional Commits, one per ✔):**
  1. `feat(finance): finance permissions, enums and audit resources (Steps 95-97 foundation)`
  2. `feat(finance): budget revisions, expenses and payment model extension with indexes and backfill`
  3. `feat(finance): money helpers, payment gates and verified-progress intelligence rules`
  4. `feat(finance): budget revision workflow and APIs (Step 95)`
  5. `feat(finance): expense verification workflow and APIs (Step 96)`
  6. `feat(finance): payment request, approval, paid and reversal workflow with transactional integrity (Step 96)`
  7. `feat(finance): intelligence, dashboard, ledger, export and contractor finance summary APIs (Step 97)`
  8. `chore(seed): synthetic finance demo data and verification`
  9. `feat(finance): project finance workspace with budget, expenses, payments and ledger UI`
  10. `feat(finance): portfolio dashboard, spend-vs-progress quadrant, payment queue and expense register`
  11. `feat(finance): si/ta copy, responsive and accessibility polish`
  12. `test(finance): money, gates, state machines, scoping and concurrency essentials`
- Before each commit: type-check + lint touched workspaces. Never commit `.env*`, secrets, real financial data or `node_modules`.
- **Push:** `git push -u origin feature/project-finance` (no force). **Do not merge.** PR into `development` (squash): title `feat(finance): Phase 9 Batch 05 — budgets, expenses, payments and budget-vs-progress intelligence (Steps 95–97)`; body = what shipped per step, endpoints, collections/indexes, permission changes + the **command to apply grants to existing databases**, behaviour changes (project budget lock after approval, old `approvePayment()` handling), backfill instructions, verification results incl. the self-healing check log, known gaps, decisions needed. If you can't open the PR, give me the exact title/body.

---

## 11. COMPLETION CRITERIA (all must be true)

- [ ] **Step 95:** budget with allocations, approval-gated revisions (maker–checker, below-commitment guard, one pending, history, impact preview), utilization/variance/remaining, alerts at 80/95/100 %, project budget lock after approval.
- [ ] **Step 96:** expense workflow (draft → verify, rejection/correction, reversal) and payment workflow (request → approve/reject → mark paid, cancel, reversal) with payment numbers, invoice references, duplicate prevention, contractor/assignment linkage, live gate checklist, immutable ledger, CSV export, notices, audit for every mutation — all transactional with `financeVersion` serialization and the concurrency test passing.
- [ ] **Step 97:** verified-vs-reported progress intelligence with integer math, zero-budget/insufficient-evidence handling, CEI only on verified basis, CONFIRMED/INDICATIVE flags, explanatory popovers; portfolio dashboard with approval inbox, quadrant (with accessible fallback), table, flags, recent feed; project finance workspace with timeline, category donut, ledger.
- [ ] Permissions: new grants applied via the documented idempotent path; role matrix reported; SUPER_ADMIN read-only; CONTRACTOR/INSPECTOR denied; out-of-scope → 404.
- [ ] UI: premium, consistent, responsive (375/768/1280), accessible, en/si/ta complete; **every control functional**; "recording only — no funds are transferred" notice present.
- [ ] Legacy `/projects/:id/financial-progress` and the overview dual bar still work; Batch 04, RoadSync, (InfraMap) unchanged; contractor profile Finance card works.
- [ ] No new dependencies, no AI, no float money, no real data; seeds idempotent with reset/verify; backfill dry-run/commit work.
- [ ] Self-healing loop executed; all critical checks green or explicitly listed as **Unresolved**; branch pushed; PR text ready.

---

## 12. FINAL REPORT (short)

(1) Preflight findings and deviations from §2 (incl. the printed role→finance matrix, permission-propagation approach, readers/writers of the touched fields, fate of the old `approvePayment()`); (2) what shipped per step (95/96/97) incl. unique functions (Payment Gate Checklist, Revision Impact Preview, Spend-vs-Progress Quadrant, immutable ledger with reversals); (3) endpoints, collections, indexes, permissions, enum/audit changes; (4) behaviour changes needing my approval (project budget lock after APPROVED, new permission grants, gate BLOCK/WARN choices, thresholds); (5) verification results + self-healing check log + any **Unresolved**; (6) uncertain translations; (7) **Batch 06 handoff notes**: the `physical-progress.source.ts` contract Batch 06 must satisfy (what a "verified progress" record needs to provide: value, asOf, sourceRef, verifier), where to add inspection-hold payment gates, the payment/assignment/project ids inspections should reference, the evidence-adapter extension points for contractor performance, the permission matrix for `inspection.*`, the shared UI components created here (drawer, stepper, dialogs, money components, status badges) and the document/evidence storage situation you found (Document model, R2/storage env, upload helpers) so Batch 06 can plan file handling.

Stop after the report. Do not start Batch 06.
