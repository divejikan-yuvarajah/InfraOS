# INFRAOS — Roadmap Steps 64–65
## Enhanced Development Prompt & Implementation Specification

**Platform:** INFRAOS — National Infrastructure Intelligence & Coordination Platform  
**Vision:** *The Operating System for National Infrastructure*  
**Repository:** https://github.com/divejikan-yuvarajah/InfraOS  
**Authorized workspace:** `C:\Users\ASUS\Desktop\InfraOS\InfraOS`  
**Development baseline observed:** `origin/development = 1fe75e8f43906a3352f2a8d2648b9d275f8a1943` (2026-10-30 check; refresh before work).  
**Related branch:** proposed `feature/projecttrace-dashboard-notifications`, **one branch for both steps**, only if owner authorizes branch setup.  
**Phase scope:** Step 64 — **ProjectTrace Dashboard & KPIs**; Step 65 — **ProjectTrace Notifications & Audit Integration**.  
**No execution or production authorization is conferred by this document.**

---

## 0. Evidence, roadmap provenance, and non-negotiable truthfulness

### 0.1 Confirmed GitHub integration baseline

At preparation time, GitHub confirms:

- Steps 61–62 merged in PR #109; Step 63 activity history merged in PR #112; the **seven-file Step 63 privacy correction** merged in PR #117, merge SHA **`1fe75e8f43906a3352f2a8d2648b9d275f8a1943`**. Two post-merge `development` CI checks completed successfully for this SHA.
- `main` was observed at `5d7391a0df2025bd11e88d08603256d82fad889e`. Its state must be refreshed; never assume that merging `development` into `main` is approved.
- The repository has an existing `/dashboard` Next.js route, but it currently renders a generic `WorkspaceHome` rather than a live ProjectTrace KPI dashboard. `apps/api/src/routes/v1.ts` mounts the projects router but **does not mount a notification or portfolio dashboard router**.
- An `apps/api/src/modules/notifications/models/notification.model.ts` schema exists, together with notification constants, **but there is no verified notification delivery service, read/unread API or notification center UI**. A persisted model is not a completed workflow.
- The `AuditLog` model is existing, append-only through Mongoose hooks, with sensitive snapshots `select:false`; Step 63's `/projects/:id/activity` is a **scoped, bounded, privacy-safe activity view, not a general audit-log export**.
- GitHub source inspection does not prove the present local branch, dirty working tree, environment values, Atlas indexes, manually launched services or functional browser behavior. The agent must inspect them locally before work.

### 0.2 Exact requirement evidence versus implementation proposals

The repository contains `Prompts/Steps.docx`, a binary original roadmap file. Its existence was confirmed, but its **exact Step 64/65 paragraphs were not readable through the available text inspection**. The step labels above are from the previously verified project handoff; they must be re-read from the *local* `Prompts/Steps.docx` at Cursor preflight. **Do not pretend any detailed requirement below is a verbatim quote from that file.** If the local wording materially differs, stop and ask for an owner scope decision before implementing conflicting functionality.

The following *exact repository planning requirements* are independently confirmed from `docs/planning/requirements.md` and the locked `docs/ux/dashboard-information-architecture.md`:

| Requirement | Verified intent | Scope interpretation for these steps |
|---|---|---|
| **FR-PROJECT-013 (P0)** | Authorized project dashboard aggregates counts and recent items **in scope**; empty/error states | **Primary Step 64** |
| **FR-PROJECT-008** | Authorized ON_HOLD/DELAYED status must be reflected on dashboard | Step 64 reads recorded status only |
| **FR-PROG-002 (P1)** | Physical versus financial progress summary; neither implies the other | Step 64: only where already trustworthy, permissioned and suitably sourced |
| **FR-PROG-003 (P0)** | Physical progress 100% must not auto-complete project | Dashboard and notification wording must honor this |
| **FR-NOTIF-001 (P1)** | Critical events create in-app notifications, unread by default; recipient can see them in center | **Primary Step 65** project-related subset; no false cross-module claims |
| **FR-NOTIF-002 (P1)** | Recipient can mark read/unread, updating counts | Step 65 in-app UI and endpoints |
| **FR-NOTIF-003 (P2)** | Optional socket/realtime; REST remains functional when offline | **Deferred**, optional only with owner approval |
| **FR-NOTIF-004 (P2)** | Optional email; delivery failure must not roll back business action | **Deferred**; no SMTP/Resend key invented |
| **FR-AUDIT-002–005 (P0)** | Critical mutation logs, dedicated action types, no user update/delete, no secrets | Step 65 integration maintains/extends *approved* audit evidence, not an indiscriminate export |

**Locked dashboard UX roles** in `docs/ux/dashboard-information-architecture.md`:

- **Super Admin:** platform health/governance, optional **read-only** project counts; no approve/pay shortcuts.
- **Government Admin:** scoped project statuses, delayed/high-risk **when supported**, budget only with permission, pending approvals, recent activity.
- **Agency Officer:** own-agency projects and authorized work areas; no unrestricted cross-agency counts.
- **Project Manager:** assigned projects, milestones, reported physical progress, actionable project links.
- **Contractor:** only appropriately linked/authorized assigned projects and dates; no organization-wide dashboard. Linkage remains a known blocker; do not invent it.
- **Inspector:** assigned inspections and related authorized projects only; do not imply a full inspection workflow exists.
- **Citizen:** **no authenticated staff dashboard**. Public landing remains separate.
- Each widget has loading, genuinely empty and error/retry states; a single failed widget must not blank the whole dashboard.

These locked requirements outrank speculative KPI or notification designs.

### 0.3 Source of truth at implementation time

Read, in this order: (1) actual local `Prompts/Steps.docx` Step 64 and Step 65 wording; (2) `docs/planning/requirements.md`, `docs/planning/business-rules.md`, `docs/ux/dashboard-information-architecture.md`, `docs/ux/page-inventory.md`, `docs/ux/route-map.md`; (3) `docs/security/{permission-catalog,permission-matrix,resource-authorization}.md`; (4) current integration baseline and Step 63 verification; (5) relevant implementation files, tests and design tokens. Record any discrepancy succinctly. Do not read or refactor the full 190 steps repeatedly.

---

## 1. Repository architecture map and compatibility constraints

| Existing verified asset | Path / behavior | Required reuse |
|---|---|---|
| Next.js web route | `apps/web/src/app/dashboard/page.tsx` renders `WorkspaceHome` | Enhance the authenticated workspace **without removing** existing profile, settings and staff functionality |
| Web shell | `apps/web/src/components/auth/staff-workspace-shell.tsx` | Preserve auth navigation, keyboard behavior and existing shell conventions |
| Web auth/client | `apps/web/src/lib/auth`, `apps/web/src/lib/api`, project query modules | Memory access-token + refresh-cookie flow; scope/epoch-aware React Query keys; prevent cross-session caching |
| Express V1 router | `apps/api/src/routes/v1.ts` | Mount only intentional new API router(s) under `API_PREFIX`; structured success/failure envelope |
| Projects router | `apps/api/src/modules/projects/projects.routes.ts` | If adding `GET /projects/dashboard`, register **before** generic `/:id` to avoid route capture |
| Project model | `apps/api/src/modules/projects/models/project.model.ts` | Source recorded `status`, `agencyId`, `managerId`, `plannedEndDate`, `physicalProgress`, `createdAt`, `updatedAt` |
| Milestones | `.../models/milestone.model.ts` | Existing planned/actual dates, milestone status, projectId only |
| Progress source | `.../models/progress-report.model.ts` | Recorded reports; 100% is *reported*, not certified completion |
| Finance | `apps/api/src/modules/finance/models/project-payment.model.ts` | `PAID` is an **application-stored status**, not independently bank-verified settlement; only show with finance authorization |
| Dependencies | `.../models/project-dependency.model.ts` | Same-agency **informational** prerequisites; no automatic schedule prediction |
| Step 63 activity | `.../activity.{policy,service,schema}.ts`, `/projects/[id]/activity` | Reuse scoped display/links; never leak raw snapshots or assume full historical coverage |
| Notification foundation | `apps/api/src/modules/notifications/{models/notification.model.ts,notification.constants.ts}` | `Notification` has `userId`, `type`, `title`, `message`, `resourceType/Id`, `isRead`, `createdAt`; existing user/unread index |
| Audit foundation | `apps/api/src/modules/audit/models/audit-log.model.ts` | No update/delete; `oldValue/newValue/ipAddress/userAgent` hidden; use allowlisted event snapshots |
| Permission catalog | `apps/api/src/modules/identity/seed/system-role-permissions.ts` | Existing `project.dashboard.read`, `project.read`, `notification.read`, `notification.update`, `audit.read` permissions; verify live grants and role scopes |
| Existing colors | `apps/web/src/styles/tokens.css`; `docs/design/brand-color-system.md` | Use token colors, no new competing palette |
| CI | `.github/workflows/quality.yml` | `npm run test:web`, `test:api`, `type-check`, `lint`, `build`; disposable in-process Mongo only |

Important nuance: generic `project.dashboard.read` and `notification.*` permissions exist in the role-permission catalog, but their **runtime consumers are not thereby implemented**. Check every role's grant list instead of assuming each role has notification permissions. `audit.read` does **not** automatically allow exposing `AuditLog` snapshots via a general dashboard/notification API.

### 1.1 Must remain unchanged

Do not modify `/`, `/si`, `/ta` Connected Future public landing, public gallery, or public marketing features. No new root applications, databases, cloud infrastructure, React framework replacement, AWS services, WebSocket stack, SMTP provider, AI model, external chart vendor or analytics service to implement these two steps. Prefer existing UI primitives and CSS/tokens. Avoid unrelated RoadSync, InfraMap, Finance, risk ML, citizen or inspection automation.

---

## 2. Step 64 — ProjectTrace Dashboard & KPIs

### 2.1 User problem and objective

A permitted officer or manager should land on a credible operational overview of **their own visible projects**, see actionable status/milestone information, and navigate to existing project details. A dashboard is **not a list of fictional charts**; it is an honest, scoped server-derived projection of persisted records.

Minimum Step 64 outcome:

1. **Authenticated** `/dashboard` (existing) displays a polished **ProjectTrace portfolio section**, or a clearly navigated ` /projects/dashboard` only if UX source supports it; prefer existing `/dashboard` and avoid duplicate homepage routes.
2. **Server-calculated, consistent counts** for authorized project populations (total, ACTIVE, DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, ON_HOLD, DELAYED, COMPLETED, CANCELLED, REJECTED as actually in schema). Expose a compact, meaningful subset of cards and a complete legend/count breakdown; avoid unsupported state transitions or mixing statuses.
3. **Recent authorized projects** (e.g., up to 5–10) with projectCode, title, recorded status, last update, and link, no extra agency/project leak.
4. **Actionable milestone snapshot** (upcoming, overdue, completed) only for visible projects and with a clear UTC / Asia-Colombo date boundary and current recorded statuses. If denied/missing, hide widget or show restricted state, never fabricate a metric.
5. **Overdue project/delayed indicators** only when backed by actual `plannedEndDate`, status and an explicit eligibility rule; never equate "overdue" with an officially `DELAYED` status.
6. **Pending-review count**, only to actors permitted for the relevant project approvals and truly within approval scope; do not compute from all SUBMITTED projects if narrower policy applies.
7. **Physical/financial progress comparison** as a **permission-aware optional module**: physical percentage reported, stored-finance derived from authorized payment data; display monetary/financial information only after specific live finance-grant checks. Never label a budget-only percentage or `PAID` status as bank verified.
8. Loading, zero results, partial-widget failure/retry, stale-session, 401, 403 and 503 states. No mock data in authenticated production-like mode.

### 2.2 Exact KPI semantics and source contract

| Proposed KPI | Source of truth | Formula / label | Guardrail |
|---|---|---|---|
| Total projects | `Project` scoped query | `countDocuments(authorizedFilter)` | Same filter for all widgets |
| Active projects | `Project.status === ACTIVE` | Count | Do not treat `physicalProgress=100` as complete |
| Delayed projects | `Project.status === DELAYED` | Count of recorded DELAYED | Distinct from due-date indicator |
| On hold | `Project.status === ON_HOLD` | Count | Do not combine with DELAYED |
| Pending review | `SUBMITTED/UNDER_REVIEW` AND reviewer-specific authorization filter | Count of eligible records | No unreviewable project exposure |
| Recently updated | `Project.updatedAt` | Sort `-updatedAt, -_id`; bounded 5–10 | No full dataset return |
| Milestones due | `Milestone.plannedEnd` for projects in caller scope | Date window, exclude completed/cancelled as defined | Never call planned date an activity event |
| Overdue milestones | `plannedEnd < now` and eligible status | Recorded date comparison | Date-only display; timezone explicit |
| Reported physical progress | `Project.physicalProgress` or latest `ProgressReport` | Label **reported** | Does not imply inspected |
| Provisional finance | existing Step 60 server-side financial summary, **if** full grants | Label provisional/stored `PAID` | No bank settlement claim |
| Risk/high risk | Only from a validated existing recorded risk source | Hide/mark not available if absent | Never infer ML risk from delay percentage |

Define any average/denominator precisely: count-based percentages = matching count / **scoped total**; when total=0 return `null`/N/A not false 0% certainty. Finance/budget and average progress must not mix currencies/sources. Do not compute expensive portfolio finance totals in Step 64 unless there is an existing validated scoped summary.

### 2.3 Proposed read API (validate against actual route map)

**Preferred endpoint:** `GET /api/v1/projects/dashboard` under existing project router **before `/:id`**; if code architecture favors dedicated `/api/v1/projecttrace/dashboard`, choose that deliberately and update typed client/tests. Neither route is already verified as live. Requirements:

- Authentication via existing middleware, `project.dashboard.read` **and** `project.read`, live user/role validity/credential epoch checks. `SUPER_ADMIN` read-only and null-agency edge cases obey existing policy, not a new shortcut.
- Server-side `resolveResourceScope`, `projectReadFilter` and assigned-project restrictions. Confirm exact role-specific filters instead of trusting client-sent agency or role.
- Strict query schema (optional `recentLimit` bounded 1–10; no arbitrary Mongo selectors, raw projection, agency override, sort injection, unbounded pagination).
- A stable typed response with `scopeLabel` (generic, no unauthorized agency name), `asOf`, `coverage`, `metrics` (known numbers with provenance), `recentProjects`, optional `milestones`, `permissions/availableWidgets` from live authorization. Do **not** include raw project, audit or financial document objects.
- Status `200`, `401` unauthenticated/epoch invalid, `403` permission denied, `503` safe infrastructure fail-closed; scope-hidden/nonexistent project detail links remain 404. Consistent envelope with `requestId` and `Cache-Control: no-store` for all authenticated success and failure responses where appropriate.
- Use server-side aggregation with an identical `$match` authorization predicate before `$group` / `$sort` / `$limit`. For milestones, restrict to the **same authorized project IDs** or `$lookup` with early project scope; do not inadvertently enumerate cross-agency milestone titles.
- Bound recent results and scope-sensitive lists; use index-aware queries, no per-project N+1 for entire portfolio; validate performance with modest and large disposable fixtures. Do not create new Atlas indexes as part of this step without approval.
- Protect disabled roles, withdrawn permissions, changed agency grant, role changes and sign-out; avoid caching leaked counts/rows across identities.

**Response example is illustrative, not an established contract:**

```json
{
  "success": true,
  "data": {
    "asOf": "2026-10-30T00:00:00.000Z",
    "coverage": "recorded_authorized_projects",
    "metrics": {
      "total": 0,
      "byStatus": { "ACTIVE": 0, "DELAYED": 0, "ON_HOLD": 0 },
      "overdueMilestoneCount": 0
    },
    "recentProjects": [],
    "milestones": [],
    "availableWidgets": { "financial": false, "pendingApprovals": false }
  },
  "requestId": "illustrative-only"
}
```

Do not copy fabricated sample counts into demo UI. Preserve actual envelope convention (`success(...)`) rather than implementing a divergent serializer.

### 2.4 Dashboard UX: professional and credible

**Design direction:** leadership-grade public infrastructure intelligence console—calm, premium, approachable, serious; not a neon analytics toy. Build from existing `StaffWorkspaceShell`, shared cards/data tables/badges, design tokens and mobile navigation. Improve the **private dashboard** only, not the public Connected Future landing.

Suggested content order: clear identity/scope heading and small "Recorded data as of …" provenance → four to six metric cards (e.g. total, active, delayed, on hold, pending approvals only when authorized) → one compact **status distribution** chart with accessible underlying textual/HTML tabular counts → recent project list → deadline/milestone insights → optional financial widget behind privileges → linked navigation to existing `/projects`, `/projects/reviews`, `/projects/[id]/overview`, `/projects/[id]/timeline`, `/projects/[id]/activity`. Each link must be actually live and scoped; otherwise render non-clickable explanation.

- Use `#FF5B00` orange for selected/brand, `#FEB600` yellow for warnings, `#8C1F28` maroon for critical, `#279541` green for completed/approved; **consume CSS tokens**, not repeated raw hex in new components. Surface `#FFFFFF`, canvas `#F8FAFC`, charcoal `#111827`. Color never conveys a status alone; include text and icons.
- Avoid stacked empty tiles. Show 0 as a valid count, **N/A** for withheld or unavailable, avoid charts whose denominator is zero.
- Responsive at 320/375/390/768/1024/1280/1440/1920; no horizontal page overflow. Dashboard cards single-column mobile, desktop 2–4 columns as space permits, long labels wrap. Keyboard focus visible, skip links, alt/screen-reader text and visible chart data tables.
- Charting: inspect installed dependencies first. Prefer minimal CSS/SVG or existing chart primitives if adequate; **do not add recharts/chart.js** as a default just for one visual.
- Role variants: Gov Admin / Agency Officer / PM have useful scoped cards; Super Admin governance/read only; contractor/inspector only as supported by current access policy; citizens redirected to public home. Never render controls that are presentational but imply a working backend.
- Loading skeleton/aria-busy, genuine empty state ("No projects in your authorized scope"), widget-level retry, last-updated label; failure of financial widget must not hide counts.
- EN first, SI/TA drafts consistent with existing project locale conventions. Review translated labels for true meaning; mark native reviewer status honestly. Dates in `Asia/Colombo`; store/query timestamps in UTC.

### 2.5 Step 64 tests

Focused API tests: role-permission × scope matrix (Gov Admin, Agency Officer, PM, Super Admin, inspector, contractor, citizen), unauthorized/disabled/credential epoch, agency hierarchy & cross-ministry, project counts with multiple statuses, pending-review overlap, due-window boundary and timezone, capped recent list, unknown selectors, large result performance, database outage 503/noStore. Verify `100% physicalProgress` remains ACTIVE, budget not exposed without finance grants, no mutation/audit writes by GET, no fake risk source. Web unit tests: KPI denominators, empty/partial/error states, role-aware conditional widgets, accessible chart data and session switch cache reset. Actual browser demonstration is mandatory after Step 64 and again in combined final review (section 5).

### 2.6 Step 64 acceptance (S64)

| ID | Objective | Evidence required |
|---|---|---|
| S64-01 | Authorized `/dashboard` loads actual scoped data | 200 API + manager browser screenshot |
| S64-02 | Accurate by-status counts / denominator | API fixture assertions + sample arithmetic |
| S64-03 | Cross-agency and assigned-project scope isolation | 403/404/omitted rows and counts, zero leaked titles |
| S64-04 | Conditional approvals, milestone and finance | Live grant tests and authoritative labels |
| S64-05 | 100% reported does not imply completion; `PAID` not bank settlement | Regression fixtures and visible copy |
| S64-06 | Read-only, fail-closed, bounded performance | no mutation, 401/403/503, no-store, limits |
| S64-07 | Premium responsive EN/SI/TA, keyboard/contrast | Real viewport and screen-reader/keyboard evidence; translation limitation disclosed |
| S64-08 | Real browser, real API, screenshots + local URLs | Disposable isolated demo walkthrough and artifacts |

---

## 3. Step 65 — ProjectTrace Notifications & Audit Integration

### 3.1 Objective and defensible scope

Connect the already persisted, authorized ProjectTrace mutations to a minimal **in-app** notification workflow with an auditable explanation of the originating event. Authorized recipients can see **their** notices, an unread count, and mark a notice read/unread. Business events remain the source of truth; a notification is an operational message, not a status transition or proof of verified inspection/payment.

**In Step 65**: project-related approvals/submissions/status changes and selected milestone events, with a narrow event-to-recipient policy and safe links. Integrate with Step 63 activity by referencing applicable event category, but do **not** widen the ordinary project-user API into general audit access. No RoadSync-wide notification platform, email, SMS, push, websocket, payment alerts, live risk engine, citizen issue dispatch or future Step 66 features unless original roadmap explicitly demands and owner approves them.

### 3.2 Existing notification model, limitations and proposed additions

Confirmed `Notification` fields: `userId` (recipient), `type` (one of `CONFLICT|COORDINATION|RISK|APPROVAL|MILESTONE|INSPECTION|CITIZEN_ISSUE|SYSTEM`), `title`, `message`, optional `resourceType/resourceId` pair, `isRead` default false, `createdAt`; index `{userId:1,isRead:1,createdAt:-1}`. It has **no verified delivery service, deduplication key, sourceAuditId, read endpoint, event emitter or notification center route**. `AuditLog` has unique semantics and sensitive `oldValue/newValue`; do not simply return it.

Proposed smallest viable model extension, **only if justified and authorized after checking migrations**:

- `sourceAuditId` or `eventId` as the stable evidence pointer; `eventKey` + recipient to prevent duplicate notifications; `readAt` optional for meaningful read state; sparse/partial unique index `(eventKey,userId)` **requires a documented, explicitly approved Atlas migration before live deployment**.
- If the product requires no persisted new field and a reliable existing idempotency mechanism is available, prefer that. If uniqueness cannot be enforced safely under retries/concurrency, record it as a release blocker rather than pretending `.findOne()` then `.create()` is race-safe.
- Expose only `id`, `type`, safe UI title/message key or predefined text, `createdAt`, `isRead`, safe link metadata, optional `sourceCategory`, `readAt` as approved. Avoid raw actor user ID, actor email, notes, reasons, payment details, internal event snapshots, private issue text, hidden prerequisite labels and internal URLs.
- **Do not add new indexes to live Atlas** via application startup or tests. Existing model fields are not permission to mutate production storage. Database migrations are separately reviewed and applied through approved procedure.

### 3.3 Delivery policy: narrow, verifiable, and consent to operational facts

Create an explicit **event → recipient → reason → link → status** policy table in code/tests, and confirm actual existing business mutations/subjects before wiring. Suggested *proposed* policy (adjust to locked original roadmap and source of truth):

| Recorded event | Possible recipient | Notice text (no secrets) | Safe link |
|---|---|---|---|
| `project.submitted` | In-scope authorized project reviewer(s) | "A project has been submitted for review" | `/projects/[id]/review` only after permission check |
| `project.review_started` | Assigned project manager, if valid/authorized | "Project review has started" | project overview/activity |
| `project.approved` / `project.rejected` / `project.returned` | Assigned project manager (or other explicitly authorized participant) | "Project review decision recorded" | project overview/activity |
| `project.status_changed` | Authorized owner/manager with durable project assignment | "Project status changed" | project overview |
| `milestone.status_changed` | Assigned project manager if explicitly appropriate | "A project milestone status changed" | existing timeline / milestone route |

**Do not manufacture** recipients by broadcasting to all Gov Admins, all agency users or an entire ministry. Reviewer determination must honor the *actual* approval scope and live grants. If actor and recipient are the same, define duplicate/self-notify policy. For unavailable assignee, disabled user, missing agency, unsupported contractor linkage or no qualified reviewer, **do not send**; log safe operational result and document scope gap. Link targets must be access-checked again **at click time**; a notice must not grant access to a resource whose authorization has since changed.

- Each notice must refer to a **committed** business event; never issue a success notice for failed/rolled-back approval/status change. Prefer joining existing Mongo transactions or explicit transactional outbox if the code supports it. Do not add a custom unreliable best-effort asynchronous queue. If a notification insert cannot be safely attached to an existing transaction, specify the chosen failure policy and demonstrate recoverability; avoid falsely reporting eventual delivery.
- Audit records must remain immutable; **notification read/unread** may require their own minimal separate audit event only if business rules require it and it can be emitted without raw content/secrets. Do not write audit events for ordinary GETs.
- Deduplicate retries and duplicate event triggers with stable committed audit/event identity where available; test races, replay and job retry. Prefer finite explicit event subscriptions in existing project service; do not refactor all modules into event bus just for Step 65.
- A delayed or failed notification must **not** rewrite the underlying project status, physical progress, timeline, approval outcome or audit truth. For atomic required writes, a failure may abort the transaction, but must then leave *both* business action and notice uncommitted; document the precise policy. Email-specific nonrollback requirement applies only to later email extension.

### 3.4 API design (proposed; reconcile route convention)

- `GET /api/v1/notifications?limit=20&cursor=...&state=all|unread|read` — `requireAuthenticated`, `notification.read`, live grant, `userId === current authenticated actor.userId` enforced by server, ascending/descending stable pagination documented; strict query validation, cap at 50, `no-store`.
- `GET /api/v1/notifications/unread-count` — same recipient live permission, count only the user's rows; never global count.
- `PATCH /api/v1/notifications/:id/read` — current recipient only, `notification.update`, mark read; choose `isRead=true` and optional readAt; idempotent under repeated requests; 404 for nonexistent/other-recipient ID. No action for other user's rows.
- `PATCH /api/v1/notifications/:id/unread` — same rules, mark unread; idempotent; reflect count immediately. Prefer simple empty JSON body with existing content-type convention, requestId correlation and noStore.
- Add `notificationRouter` to `apps/api/src/routes/v1.ts` only after scoped service + tests; keep item routes below `/unread-count` route to avoid captures. No arbitrary recipientId path, recipient query override, bulk "mark all" endpoint, unsafe link redirect or raw `AuditLog` export.
- Failure semantics: 401 session revoked, 403 missing notification grant, 404 other-recipient/nonexistent (indistinguishable), 400 malformed ID/filter/cursor, 503 dependency unavailable. Rate limits per existing Express middleware and appropriate replay protection if write endpoints accept retried requests.
- Return safe content even for an old notification if the referenced project becomes restricted: either suppress/neutralize specific title/link, or omit the notice based on a documented policy. **Never** expose a previously authorized project title after scope revocation. Plain notification row ownership alone does not imply ongoing permission to see a referenced resource.
- Recheck stale role/agency changes at read and action, do not rely on token claims alone. Super Admin null-agency and disabled/unverified user semantics are inherited from existing identity policy.

### 3.5 Frontend implementation and user experience

**Proposed route:** `/notifications` as locked `docs/ux/route-map.md`; existing file not verified as live. Add minimal, verified navigation from `StaffWorkspaceShell` and a small unread indicator only for authenticated roles that have notification permissions. Do not show the citizen public page or unimplemented preview route.

- Premium compact notification center: page title, unread count, All/Unread/Read segmented controls, dated, screen-readable notification cards, safe category icon, clear new/seen state, `Mark read`, `Mark unread`, `Load more`, empty/error states, links to *currently* permitted project pages.
- UI displays **notification was recorded**, not "recipient definitely read" or "email delivered". An unread count is derived from server rows, not a client constant.
- Reuse session-aware API client and query cache keys including authenticated `userId`, role and epoch; **clear all prior pages and notice data on sign-out/user switch/role or project permission change**, as learned from Step 63's privacy correction. Abort/ignore stale pending responses before rendering.
- Keyboard operable card actions, focus indicators, accessible live unread count changes, button labels distinguish actions. Do not hijack `Enter`/space. No alert auto-dismiss for required information.
- EN/SI/TA UI chrome using established locale patterns. Event keys translated only if safe and reviewed; don't claim native review. Colombo-local date formatting with UTC data.
- Distinguish system-generated, recorded and pending delivery evidence. No endless polling; a manual Refresh or moderate polling may be used if proven needed. Realtime/email explicitly out of scope.

### 3.6 Step 65 integration and security tests

- Project event transaction: created notification only for actual committed event, failed audit/business transaction creates none, cancellation/rejection not confused, no false completion at physical 100, no notification for a read-only GET.
- Recipient scope: test PM, Gov Admin reviewer, Agency Officer, foreign agency, inspector, disabled/revoked staff, unlinked contractor and citizen; ensure no broad broadcasts and no hidden project titles.
- Notification read/update: 401, 403, 404, 400, 503; own-user reads/unreads update counts; other user's ID always hidden; duplicate mutation is idempotent; simultaneous toggles have deterministic documented last-write/order semantics, or an explicit version/concurrency control if required.
- Deduplication/replay: exact event id once per recipient; two legitimate events close in time remain two notices; concurrent retries do not duplicate if a unique constraint is part of an authorized migration.
- Audit: source action identity, allowlisted snapshot mapping, no secrets, no mutations to `AuditLog` existing rows; only approved service inserts. Verify Step 63 still shows correct bounded history and remains read-only.
- UI: page navigation, notification count, view filter, mark read/unread, stale-session no residue, responsive real-browser demonstration and screen reader labels.

### 3.7 Step 65 acceptance (S65)

| ID | Objective | Evidence required |
|---|---|---|
| S65-01 | Critical **supported ProjectTrace** committed events create recipient-scoped in-app notices | Real event → stored notice → browser center |
| S65-02 | Notification rows initially unread and count accurate | API test + UI state |
| S65-03 | Mark read/unread only for recipient; idempotent | 200/401/403/404 + concurrency test |
| S65-04 | No cross-agency, hidden project, actor or snapshot leak | Two-agency and role-change browser/API tests |
| S65-05 | No phantom notices for rolled-back/failed writes; dedupe/retries | Mongo transactional/edge tests |
| S65-06 | Existing immutable audit and Step 63 activity unchanged | Regression suite + GET read-only tests |
| S65-07 | UI accessible, responsive, EN/SI/TA appropriately labeled | 320–1920 and keyboard checks; native language gap disclosed |
| S65-08 | No unapproved new infrastructure, email, realtime or Atlas index | Diff + env/migration review |
| S65-09 | Working browser demonstration with screenshot/URLs/evidence | Isolated manager + reviewer roles |

---

## 4. Implementation order: one branch, two independently verified steps

### Preflight (once)

1. `git fetch origin` (read remote refs; do not mutate local work); `git status --short`, `git status --porcelain=v1`, `git branch -vv`, `git log -1 --oneline`, `git diff --name-status`, `git diff --cached --name-status`, `git ls-files --others --exclude-standard`.
2. Verify Step 63 correction merge `1fe75e8` is an ancestor of **current** `origin/development` and its CI is genuinely successful. Check for newer integrations on `development`/`main`; never build on stale SHA automatically.
3. Inspect existing dirty review files, `Prompts/` files and local services. Check whether switching branches would overwrite tracked/untracked files. Never force checkout, reset, stash, clean, delete, move documents, spawn worktrees or create extra repository folders. **Stop if safe branch creation impossible**; request explicit owner reconciliation plan.
4. Validate actual roadmap paragraphs via local `Prompts/Steps.docx`, available configs, source, and already implemented endpoints. Briefly report any scope conflict or missing permission.
5. With explicit branch-setup permission and safe tree, create/reuse exactly one `feature/projecttrace-dashboard-notifications` branch from verified `origin/development`. **Branch creation is not authorization to commit/push/PR/merge.**

### Implement Step 64 first

- Design scoped read service and typed DTO → focused API tests with two-agency fixtures → web API hooks, role-aware KPI cards, recent/due snapshots → localization/a11y/responsiveness → focused local checks → real isolated browser demo with screenshots and URL/evidence → concise Step 64 status doc.
- **Gate:** do not start Step 65 until S64-01 through S64-08 have substantive PASS or clearly accepted limited scope; stop for unresolved security failure. No phase-wide full suite duplication at this point.

### Implement Step 65 second

- Verify actual event writers and permission/notification model → implement bounded event-to-recipient policy and idempotency design → in-app notification write/read API → focused audit/event/API tests → notification UI, counter/actions and session privacy → focused local checks → real isolated browser demonstration → concise Step 65 status doc.
- **Gate:** if a safe event delivery mechanism requires an unauthorized Atlas index/migration or speculative recipient, isolate/hide that feature and report BLOCKED rather than silently broadening scope.

### One final phase-wide verification

- Run complete test suites, type-check, lint, build; independent cross-step security and UI review; combined real browser demonstration showing dashboard → project activity → recorded event → recipient notification → mark read/unread → dashboard unchanged; produce one `docs/reviews/steps-64-65/END-OF-PHASE-VERIFICATION.md` with per-criterion PASS/FAIL/BLOCKED/NOT RUN and APPROVE/REVISE/BLOCKED recommendation.

---

## 5. Mandatory **actual project output** and real-browser demonstration

**Not optional. Do after each step and again as combined demonstration; screenshots must show actual running frontend attached to a disposable backend.** No Figma-only mockup, static story, screenshot from old steps, console log or invented route counts qualifies.

1. Use the real repo and existing demo toolchain; start **isolated** API/web ports that do not collide with existing 3000/4010 or other listeners. Example only: `4019` API and `3019` web if free. Keep any previously running services untouched. The new environment must be configured explicitly for **disposable in-process Mongo fixtures**, never Atlas.
2. Log active role/scopes (generic identifiers only), actual seed/fixture provenance, URL and API origin. Do not disclose tokens, passwords, refresh cookies, email identities, database URIs or secrets.
3. **After Step 64:** sign in as authorized Gov Admin, Agency Officer or PM; open `/dashboard`; show scoped KPI cards, status chart and source table, recent projects, approved links, overdue milestone/empty/partial state. Demonstrate an outsider sees no titles/counts and a 100%-reported project still ACTIVE. Take 320px, 768px and 1440px screenshots and record viewport coverage including 1920px.
4. **After Step 65:** generate a legitimate permitted project event with the API/UI in the disposable database, verify the corresponding notice for the correct recipient; show `/notifications`, unread badge/count, read/unread toggle, page filter, no access for foreign user, and no previous user's rows after sign-out/switch. Never bypass real authorization just for demo. Screenshot 320px and desktop plus relevant accessible controls.
5. **Combined:** demonstrate the dashboard before/after a committed event, Step 63 activity record, newly generated notice, recipient read/unread, and cross-scope denial. Record raw HTTP statuses 200/401/403/404/503 where genuinely exercised; do not claim test evidence for unexecuted cases.
6. Collect evidence under step-specific review paths, e.g. `docs/reviews/step-64/evidence/`, `docs/reviews/step-65/evidence/` and `docs/reviews/steps-64-65/evidence/` (do not create duplicate images unnecessarily). Provide a clear screenshot index, URLs, role, date, function, observed result, stopped demo port status, test commands and caveats. Screenshots may be from a browser automation driver or manually captured **only if actually executed**.
7. No secrets, personally identifying fixture data or confidential budget snapshots visible. Do not change login security, auth cookies, CSP, production secrets or consent gates to make a demo possible.

**Manual owner walkthrough:** browse exact local URL; sign in using approved demo fixtures (credentials handed over securely, not in Git); inspect role-specific dashboard; compare totals to disposable Mongo fixture; open recent project → timeline/activity; trigger permitted event; switch recipient → notification center and read/unread; sign out → verify previous data disappears; check narrow viewports; inspect `evidence/` and the phase verification report.

---

## 6. Cross-cutting quality, governance and regression prevention

### Security and privacy

- Server is the authorization boundary. React hides UI for UX only. No client-provided agency/actor/recipient filters as authority. Every aggregate, nested milestone or notification query is scoped at MongoDB level before returning values.
- Strict Zod schemas for query/body; bound pagination, length, date and ObjectId validation; safe errors; `no-store` for authenticated endpoints. Avoid expensive `$lookup` of unauthorized sources and HTML-injected notification titles.
- Defend unauthorized access on sign-in/out, epoch, role/permission/agency change and a user's reassignment; React Query keys include identity and epoch, clear pages on transitions. Refresh responses may not reintroduce old data.
- RequestId and safe operational logs. Never expose full audit snapshots (reasons/email/IP/user-agent) or finance data without finance role permission. No credentials in screenshots, docs or test logs.
- Audit append-only Mongoose behavior is not proof of database-level tamper-proofing; DB privileges and production controls remain outstanding. No incident response/monitoring falsely declared complete.

### Concurrency and correctness

- Read-only dashboard must not mutate DB or auto-transition projects. Handle rapid filter changes, unmount/stale response and duplicated requests without stale counts appearing.
- Notification generation has at-least-once/retry implications. Explicitly design dedupe key, commit boundary and integrity tests before wiring to mutation services. Avoid partial successes or duplicate messages. Mark read/unread updates must be owner-filtered and idempotent.
- Guard known Step 51 grant/agency hierarchy race and do not broaden access while it is still unresolved. If race cannot be removed within permitted scope, report it as a blocker, not a reason to disable auth.
- Performance: bounded recent projects, count using indexes/proper matches, no unbounded app-side aggregation. Document query cost and any needed index proposal separately; do not auto-create on Atlas.

### Accessibility and multilingual

- WCAG-oriented landmarks, logical h1–h3, visible focused control, minimum contrast especially orange, proper tables/headers, chart equivalents, keyboard interaction, semantic notices/status regions, reduced motion. No color-only KPI signaling.
- English, Sinhala and Tamil UI chrome; native review explicitly marked NOT RUN if not performed. Do not silently replace untranslated strings with invented terminology or imply professional translation.

### Environment and dependencies

- **No new keys normally required for either step.** Reuse existing MongoDB connection, JWT/HTTP-only refresh, API prefix, frontend API origin, in-process disposable Mongo helpers, npm workspaces and already installed packages.
- No need for OpenRouter, external LLM, AWS, R2, SMS, push service, SMTP provider or websocket infrastructure for these scopes.
- Isolated demo may set **temporary ports and explicit local API origin**; use existing env schema, never commit demo secrets or modify `.env.local` used by existing user services.
- New notification index or `sourceAuditId/eventKey` schema is **not a live Atlas migration authorization**. Record migration plan and approval requirement; if no safe race behavior without it, block operational readiness.

### Full phase test matrix

1. `npm run test:api` — all existing modules and new scope/idempotency tests.
2. `npm run test:web` — full workspace, auth, Step 63 privacy regression, dashboard and notifications.
3. `npm run type-check` — both packages; no `any` or broken shared contract.
4. `npm run lint` — track existing warnings separately from new ones.
5. `npm run build` — real Next.js + Express production builds, without changing production auth gate.
6. `git diff --check`; inspect only approved changed files and unexpected lockfile/landing-page changes.
7. API failure-mode tests: 400/401/403/404/409 (where applicable)/429/503, revoked role/epoch/agency, cross-agency, partial availability, 100% reported no completion, no bank-settlement claim, audit append-only, notification duplicate retries.
8. Browser actual E2E: multiple staff roles, multi-agency fixtures, 320–1920, keyboard, no overflow, no unauthorized leak, 2-session switch, no auth bypass, profile/admin/navigation unchanged.
9. Real CI is verified **only after** an authorized push/PR and must be checked on the *current feature SHA*; local green does not imply GitHub green.

---

## 7. Documentation and acceptance package

Produce **minimal, accurate** documentation, not repeated proposals:

- `docs/reviews/step-64/IMPLEMENTATION-STATUS.md`: exact requirements, touched files, endpoint/DTO, role/scope policy, S64 criteria, focused tests, screenshots/URLs, limitations.
- `docs/reviews/step-65/IMPLEMENTATION-STATUS.md`: event taxonomy, eligible recipients, audit/notification consistency/dedupe, model/index caveats, S65 criteria, focused tests, screenshots/URLs.
- `docs/reviews/steps-64-65/END-OF-PHASE-VERIFICATION.md`: full test command counts+exit codes, per-step PASS/FAIL/BLOCKED/NOT RUN, real combined demo with screenshots and stop status, security/a11y/translation caveats, final APPROVE/REVISE/BLOCKED, production readiness explicitly BLOCKED.
- Only add/update API/UX documentation where contracts actually change; do not rewrite previous review history or public-facing marketing docs.
- Handoff to **Step 66** as an *unverified next roadmap step*; agent must inspect exact title in `Prompts/Steps.docx` before naming a product feature. Never pre-implement Step 66.

### Final phase acceptance threshold

Recommendation `APPROVE` for **the limited 64–65 feature scope** only when both steps' applicable criteria pass, actual scoped browser demonstrations are recorded, privacy/concurrency tests pass, and no unaddressed high-severity issue remains. A same-agent APPROVE **is not independent owner acceptance**, Git integration authority or production readiness.

`REVISE` if there are narrow fixable UI/translation/CI/test gaps; `BLOCKED` if unsafe scope, incomplete authentication, absent actual demo, unapproved database requirement or source-of-truth contradiction prevents honest acceptance. Item-level status uses exactly **PASS / FAIL / BLOCKED / NOT RUN**.

---

## 8. Consolidated Git integration gates G1–G6 (authorization separated)

**These gates belong in BOTH Cursor Agent execution prompts and the single final review prompt. A prompt document does not authorize them.**

| Gate | Action | Required stop / owner control |
|---|---|---|
| **G1** | Verify repo path, current/ref heads, `origin/development`, ancestry, dirty/untracked/index, overlap, secrets, running services; safely create/reuse ONE phase feature branch if explicitly authorized | Stop on risky checkout or untracked overwrite; never force, stash, reset, clean, rebase |
| **G2** | After phase acceptance, stage *only* owner-approved Steps 64–65 code/tests/docs/evidence by explicit path | Verify `git diff --cached --name-status`, `--stat`, `--check` and actual patch; no `git add .` |
| **G3** | With explicit owner commit approval, create meaningful scoped commit, e.g. `feat(projecttrace): dashboard KPIs and in-app notifications (steps 64-65)` | Verify SHA, parent(s), staged list, index and preserved unrelated changes |
| **G4** | With explicit owner push approval, push `HEAD:refs/heads/feature/projecttrace-dashboard-notifications` only, fast-forward; no force-push | Verify remote ref, no development/main writes |
| **G5** | With explicit owner PR approval, open draft PR **base `development`**, check diff, required reviews, mergeability, CI for latest head, migrations and blockers | Don't report CI passed until run completion; no auto-merge |
| **G6** | **Separate explicit owner approval** after successful required PR CI, acceptance and review; merge into `development` only, confirm merge SHA, ancestry and post-merge CI | Not included in G1–G5 approval; no `main`, deploy, branch deletion or Atlas writes |

**One explicit scoped approval may authorize G1–G5 together** once the relevant acceptance evidence is ready. Before then, the agent prepares Git commands and STOPs; it may perform owner-authorized branch setup independently if safe. Any acceptance failure stops G2 onward until corrected and reverified.

**Illustrative commands, not automatically authorized:**

```powershell
# Read-only and fetch preflight
Get-Location
git status --short
git branch -vv
git fetch origin
git rev-parse origin/development
git merge-base --is-ancestor 1fe75e8f43906a3352f2a8d2648b9d275f8a1943 origin/development

# ONLY after permission and a verified safe checkout; do NOT run if dirty paths conflict
# git switch -c feature/projecttrace-dashboard-notifications origin/development

# G2 example: enumerate exact approved paths from git status, then one explicit path-limited add
# git add -- <approved-step64-step65-paths-only>
# git diff --cached --name-status
# git diff --cached --check

# G3–G4 only after owner authorization
# git commit -m "feat(projecttrace): dashboard KPIs and in-app notifications (steps 64-65)"
# git push -u origin HEAD:refs/heads/feature/projecttrace-dashboard-notifications

# G5: create draft PR via authorized GitHub UI/CLI; base development only
# G6: separate written owner approval, no automatic merge
```

### Hard boundaries

Only `C:\Users\ASUS\Desktop\InfraOS\InfraOS`. Never touch/move/delete `Documents`, create additional project folders/worktrees, force-checkout/force-push, reset/clean/stash, alter live Atlas data/indexes, deploy, or modify `main` without independent explicit authorization. Preserve dirty files under `docs/operations`, earlier reviews and `Prompts/` (including untracked items). Do not stage unrelated `.env`, secrets, lockfiles, landing page or accidental formatting churn. Existing services on other ports must remain running.

---

## 9. Final handoff report format

```text
INFRAOS Steps 64–65 — Phase Handoff
Roadmap source: local Steps.docx inspected? YES/NO; text differences: ...
Base development SHA / latest SHA: ...
Branch and dirty-tree preservation: ...
Step 64: S64-01..08 PASS/FAIL/BLOCKED/NOT RUN with evidence
Step 65: S65-01..09 PASS/FAIL/BLOCKED/NOT RUN with evidence
API routes implemented and source-of-truth provenance: ...
Demo: real web/API ports, role fixtures, URLs, screenshots, status and limitations
Full API tests / web tests / TS / lint / build: counts, exit codes, reruns
Security / permission / concurrency / audit findings: ...
Localization/native review: ...
Production readiness: BLOCKED (independent of feature acceptance)
Same-agent recommendation: APPROVE | REVISE | BLOCKED
Git G1–G6: exact status per gate; do not infer approval
Remaining caveats and migration approvals: ...
Step 66 title/scope: verify from original roadmap before future planning
```

**Definition of done:** working, secure, scope-limited *ProjectTrace* dashboard and notifications; honest measured KPIs; recipient-owned in-app notices linked to actual committed events; a successful disposable real-browser demonstration and full phase-wide test results; preservation of all existing work and separate owner-controlled Git integration. No code is implemented by this prompt-generation task itself.
