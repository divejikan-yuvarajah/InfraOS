# INFRAOS — Step 66 Enhanced Development Prompt
## RoadSync Work Request Module | Implementation-Ready Specification

**Project:** INFRAOS — National Infrastructure Intelligence & Coordination Platform  
**Vision:** *The Operating System for National Infrastructure*  
**Repository:** https://github.com/divejikan-yuvarajah/InfraOS  
**Authorized workspace:** `C:\Users\ASUS\Desktop\InfraOS\InfraOS`  
**Target roadmap step:** **66 — RoadSync Work Request Module**  
**Development agent:** Claude Code in VS Code (instructions also apply to Cursor Agent)  
**Status:** Design and execution specification only. **No Step 66 code has been implemented by this document.**  
**Primary acceptance:** correct authorized work-request operations + a distinctive Mission Control-aligned UI + an actual owner-accessible local browser demo.  
**Production readiness:** **BLOCKED** until separately signed off.

> **Roadmap source-of-truth distinction.** A previous local Claude assessment, based on `Prompts/Steps.docx`, identified the exact Step 66 title as **“RoadSync Work Request Module.”** I verified the *public GitHub source and requirements* on 2026-10-31, but could not independently extract the full Step 66 body from the DOCX in this preparation environment. Before coding, **read the real local DOCX**, record the exact detailed wording, and reconcile the scope with `FR-ROADSYNC-001`, `FR-ROADSYNC-002`, and the existing model/contracts. If the full roadmap imposes a materially different boundary, stop and report the discrepancy rather than inventing requirements. Nothing below authorizes an unrelated future RoadSync phase.

---

## 1. Verified repository baseline and evidence

The following are **public remote facts** verified from GitHub at document preparation. They are **not claims about the owner's uncommitted local checkout**.

| Item | Verified finding | Implementation consequence |
|---|---|---|
| `origin/development` | `f30c1f1896733de814f94ddd11a87da5c7c4c805` | Fresh baseline **at writing**. Recheck before G1. |
| `origin/main` | `18a7ec4c6dc8f5fb8607956da56b6cdeba1b2610` | Do not alter or deploy. |
| Mission Control UI | PR **#121** merged into `development` on 2026-10-31; required GitHub check runs on merge SHA succeeded | **Reuse new shell/tokens**, not old generic workspace design. |
| Steps 64–65 | PR **#119** merged into `development` on 2026-10-30 | Existing dashboard, notification pages and APIs form integration context. |
| RoadSync source | `apps/api/src/modules/roadsync/models/` and `roadsync.constants.ts`; models exist for WorkRequest, Conflict and CoordinationRequest | **Models only** in verified source; Step 66 needs genuine API and UI. |
| API registration | `apps/api/src/routes/v1.ts` mounts projects and notifications but **not** RoadSync | Add a correctly guarded RoadSync router; preserve existing routes. |
| Web routes | `apps/web/src/app/` does **not yet include** `roadsync` | Add actual Step 66 screens only. |
| Design system | `apps/web/src/styles/tokens.css`, `mission-control.css`, `mission-control-dashboard.css`; shell `components/auth/staff-workspace-shell.tsx`; `workspace-nav.ts`; status badge and connected-network motif | Extend existing premium Mission Control components, never create a conflicting template/theme. |
| Future module guidance | `docs/design/future-module-patterns.md` has RoadSync “Coordination Command Center” as **design-only** | Build truthful work-request portion now; do not imply conflict/coordination system runs. |
| Permissions | Existing permission catalog/seed includes `roadsync.work_request.create`, `.read`, `.update`, `.cancel` | Use **live permission checks**, not role strings alone. |
| Source requirements | `FR-ROADSYNC-001` create work request; `FR-ROADSYNC-002` invalid geometry/dates; `BR-RS-001`; `BR-PRJ-007`; `BR-SCOPE-002` | Define controlled create/read/list workflow, robust geospatial/time validation and project-status safeguards. |

**Source paths to read first (small targeted set):**

- `Prompts/Steps.docx` — Step 66 exact wording; check next Step 67 title only for handoff.
- `docs/planning/requirements.md` (`FR-ROADSYNC-001`, `FR-ROADSYNC-002`, related project and permission rules).
- `docs/planning/business-rules.md` (`BR-RS-001`, `BR-PRJ-007/008/009`, `BR-SCOPE-001/002`, `BR-INT-002/004`).
- `docs/ux/page-inventory.md`, `docs/ux/information-architecture.md`, `docs/ux/navigation-by-role.md`.
- `docs/design/future-module-patterns.md`, `docs/design/brand-color-system.md`, `apps/web/src/styles/tokens.css`.
- `apps/api/src/modules/roadsync/models/work-request.model.ts`, `roadsync.constants.ts`.
- `packages/shared-types/src/domain/dtos.ts` and `packages/shared-types/src/geo/geometry.ts`.
- `apps/api/src/shared/database/geometry.ts`, `apps/api/src/modules/identity/authorization/resource-scope.ts`.
- `apps/api/src/modules/projects/projects.routes.ts`, `projects.service.ts` (read only relevant portions).
- `apps/api/src/routes/v1.ts`, `apps/api/src/modules/audit/audit.constants.ts` and audit-writing patterns.
- `apps/web/src/components/auth/staff-workspace-shell.tsx`, `workspace-nav.ts` and existing project forms.

Avoid reading the entire history, all 190 steps, unrelated modules, or generated folders. Detect and preserve any newer local implementation before writing.

---

## 2. Problem, purpose and precise scope

### 2.1 User problem

Sri Lankan agencies plan road resurfacing, utility excavation, pipeline installation, drainage or other public works at specific locations and times. Without a standard, auditable **work request** record, future spatial conflict detection and inter-agency scheduling have no trustworthy input.

### 2.2 Step 66 outcome

Create the **foundational RoadSync work-request management experience** that captures verified agency/project ownership, geometry, work classification, priority and planned schedule. Authorized staff can create a DRAFT work request, find it, inspect it and—only to the extent confirmed by the actual roadmap—edit/submit it. This is the **input layer for later RoadSync detection**, not the detection engine itself.

**Mandatory grounded deliverables:**

1. Server-side authorized work-request creation with safe validation and persistence.
2. Scoped, bounded work-request listing and detail retrieval to support an actual usable UI.
3. Integration with existing projects, agencies, authenticated users and audit patterns.
4. Appropriate DRAFT edit behavior, if confirmed within the Step 66 source and supported safely; no arbitrary status transitions.
5. Mission Control-aligned, **visually distinctive, polished** RoadSync work-request UI: list, create and detail; `roadsync` hub only if justified by the Step 66 roadmap and no fake widgets.
6. Accessible mobile-first handling for GeoJSON/date input with honest map limitations.
7. Focused authorization, geometry and transaction/concurrency checks.
8. An actual, usable **owner demo**: working local URL, legitimate synthetic credentials, evidence, screenshots and short walkthrough.
9. Concise handoff noting what remains for Step 67 onward.

### 2.3 Explicitly out of scope, unless the local Step 66 roadmap explicitly includes it

- Automatic nearby-work/spatial intersection detection, GeoJSON spatial query engine, scheduling conflict calculations, conflict severity, conflict record creation.
- Coordination messages/inboxes, responses, inter-agency negotiation and conflict resolution.
- InfraMap platform layers or a full external GIS integration.
- LLM/AI risk recommendation, map providers requiring new API keys, realtime sockets, email automation.
- Approval/activation/completion transitions not described by Step 66 and verified in policy.
- Cross-module reporting, national conflict dashboards, contractor/inspector expansion.
- Reworking existing ProjectTrace and Mission Control pages for stylistic experimentation.

**Truthful status:** On a work-request detail screen, a future “Conflict analysis” area may be omitted or show a **plain, accurate “Detection not available in this step” explanation**—never a green “No conflicts” result without detection.

---

## 3. Reuse existing contracts and domain invariants

### 3.1 Verified WorkRequest model shape

`apps/api/src/modules/roadsync/models/work-request.model.ts` currently defines:

| Field | Existing type/constraint | Step 66 implication |
|---|---|---|
| `projectId` | Required Project reference | Link to an **actual authorized project**; do not silently allow projectless work. |
| `agencyId` | Required Agency reference | Derive from authorized project/agency on server; never trust arbitrary client-provided agency. |
| `geometry` | Required `geometryField(true)` | Validate true server-side GeoJSON structure and Mongo 2dsphere compatibility. |
| `workType` | Required enum `WORK_TYPES` | Offer exact enumerated choices, no invented work categories. |
| `plannedStart`, `plannedEnd` | Required Date + `dateOrder` | Reject missing, malformed or reversed dates; use explicit ISO wire policy. |
| `status` | Enum `DRAFT`, `SUBMITTED`, `PLANNED`, `APPROVED`, `ACTIVE`, `COMPLETED`, `CANCELLED`; default `DRAFT` | Create as **DRAFT**. Further transitions require explicit Step 66/roadmap policy. |
| `priority` | Enum `LOW`, `NORMAL`, `HIGH`, `CRITICAL`; default `NORMAL` | Status and priority are different; do not mistake HIGH priority for verified conflict severity. |
| timestamps | `createdAt`, `updatedAt` | Accurate display, list ordering and concurrency checks where relevant. |
| indexes | `{agencyId,status,plannedStart,plannedEnd}` and `{geometry:'2dsphere',status,plannedStart,plannedEnd}` | **No new Atlas indexes** without separate approval. Confirm existing index state in disposable DB only. |

The shared DTO `CreateWorkRequestRequest` defines `projectId`, `workType`, optional `priority`, `plannedStart`, `plannedEnd`, and `geometry`. `WorkRequestDto` also includes server-derived `agencyId`, `status`, timestamps. Respect these types and don't send `agencyId`, `status`, `_id`, `createdBy`, `__v` or authorization claims in the create body.

### 3.2 Verified enum values

**Work types:** `ROAD_RESURFACING`, `ROAD_EXCAVATION`, `PIPELINE_INSTALLATION`, `ELECTRIC_CABLE_WORK`, `TELECOM_CABLE_WORK`, `DRAINAGE_WORK`, `UTILITY_REPAIR`, `BRIDGE_WORK`, `OTHER`.

**Priorities:** `LOW`, `NORMAL`, `HIGH`, `CRITICAL`.

**Statuses:** `DRAFT`, `SUBMITTED`, `PLANNED`, `APPROVED`, `ACTIVE`, `COMPLETED`, `CANCELLED`.

UI labels may be human-readable but API values must remain exact.

### 3.3 Project linking, ownership and lifecycle policy

- The current DTO and schema both require `projectId`. `FR-ROADSYNC-001` uses “linked project **or** agency work context”; **these are not yet the same implementation contract**. Start with project-linked requests, and record “standalone agency-only work” as a policy/design decision requiring approval if the original Step 66 expects it.
- Project must exist, be readable **and writable for the requested action** under current live assignment/agency scope; user must not select a foreign project by manipulating an ObjectId.
- Derive `agencyId` from the linked Project, not from the browser. Reject inconsistent, inactive or missing agency relationships.
- `BR-PRJ-007`: `CANCELLED` project must not start new work requests. Deny it at creation and any submit action; define treatment of other terminal or unapproved statuses explicitly after confirming business rules. Do not allow a work request to bypass project approvals.
- Use active project and agency relationship validation; do not silently select a broader GOV_ADMIN ministry than the project owner.
- Project manager must satisfy current project assignment restrictions; a permission string alone never broadens scope.
- Super Admin is generally read-only on operations; Contractor/Inspector/Citizen do not gain work-request creation through UI choices.
- If uncertain whether APPROVED/ACTIVE projects alone may create requests, record and agree a narrow policy **before** implementation; do not invent status access based on convenience.

---

## 4. Backend architecture and REST API proposal

Reuse Express router/service/Zod and existing response envelope (`success`, `failure`), `requireAuthenticated`, `requirePermission`, live epoch/status and server scope helpers. Register the RoadSync router in `apps/api/src/routes/v1.ts` at `/roadsync`, keeping existing mounts intact.

### 4.1 Planned endpoint contract

These are **recommended concrete route contracts**, to be reconciled with the local roadmap and existing API conventions rather than assumed pre-existing:

| Method & route | Permission | Purpose | Step 66 priority |
|---|---|---|---|
| `GET /api/v1/roadsync/work-requests` | `roadsync.work_request.read` + server-side scope | Bounded list and filters | Required to browse requests |
| `POST /api/v1/roadsync/work-requests` | `roadsync.work_request.create` + project/agency authorization | Create DRAFT | Core required |
| `GET /api/v1/roadsync/work-requests/:id` | `.read` + resource scope | Detail | Required to inspect persisted record |
| `PATCH /api/v1/roadsync/work-requests/:id` | `.update` + DRAFT ownership/revision | Edit permitted draft fields | Only if explicitly confirmed by roadmap/policy |
| `POST /api/v1/roadsync/work-requests/:id/submit` | Verified submit/transition authorization, not just generic create | DRAFT → SUBMITTED | **Conditional** — add only when Step 66 says so and policy can be defined safely |

If edit or submit are out of scope, implement create/list/detail fully, explain their absence and leave accurate disabled-free UI states. Do not implement `approve`, `cancel`, conflict scan or coordination endpoints simply because status enums exist.

### 4.2 Create request schema

Use strict Zod validation with keys in the shared DTO. Reject unknown/mass-assignment keys; avoid accepting Mongo query operators. Strict validation should cover:

- `projectId`: valid ObjectId format and authorized existing Project.
- `workType`: exact enum.
- `priority`: optional exact enum, default NORMAL.
- `plannedStart`, `plannedEnd`: valid explicit ISO date-time strings with timezone; normalized to UTC and `start <= end`.
- `geometry`: Point, LineString or Polygon only, valid coordinates and bounded complexity.
- Reject invalid types, NaN/Infinity, extraneous nested properties, mixed coordinate shapes, empty arrays and malformed dates.
- Reject `agencyId`, `managerId`, `status`, `isConflictFree`, `severity`, `createdBy`, audit data and privilege claims from the client.

### 4.3 GeoJSON correctness

Reuse `apps/api/src/shared/database/geometry.ts` and shared geo contract. Important existing behavior:

- Coordinate order **longitude, latitude**.
- Longitude within `[-180,180]`; latitude within `[-90,90]`.
- Point: one coordinate pair.
- LineString: at least two valid points.
- Polygon: rings closed, at least four positions, bounded ring/vertex counts.
- Existing geometry validation counts at most 10,000 vertices and 100 rings for polygons. Preserve those bounds and confirm Mongo geospatial index acceptance.

Do not confuse **valid bounds** with valid administrative location; do not introduce a Sri Lanka-only bounding box unless an existing requirement expressly specifies one. Do not calculate geometry-to-road conflicts in Step 66.

Avoid a wrong-coordinate-order UI by naming controls “Longitude (E/W)” and “Latitude (N/S)” and showing human-readable coordinate help. For polygon/routing visuals, never claim GIS correctness based solely on a map tile loading.

### 4.4 Scoped list, detail and pagination

- Build the filter **server-side** from current actor + live role grants + agency hierarchy/assignment, using existing resource-scope approaches; fail closed (`match-none`) on unknown relationships.
- Filter by status, work type, project (only if authorized), priority and a bounded date window as needed; allow only explicit query keys. Do not create an unbounded `find({})` for a ministry/user.
- Use a predictable sort (for example `createdAt:-1, _id:-1`) and bounded page size (20 default, up to 100 only if existing pagination policy allows it).
- Return only safe list fields. Project title/code should be attached **only** if actor can read the linked project; do not blindly populate.
- Foreign/unreadable IDs yield generic 404; malformed IDs 400; missing permission 403; missing/expired auth 401; DB dependency failure 503.
- Add `Cache-Control: no-store` for private responses and avoid leaking details through errors.
- Enforce the same scope in counts, filters, detail retrieval and updates; do not let an optional `agencyId` query widen scope.

### 4.5 Transactions, auditing and concurrency

- Audit resource `WORK_REQUEST` already exists in `apps/api/src/modules/audit/audit.constants.ts`; reuse append-only AuditLog and the established approved action format (`roadsync.work_request.created`, etc., subject to existing conventions).
- Persist the work request and required audit event **atomically** when the existing transaction model supports it; fail closed if required audit persistence fails. Never write the full request body, geometry, user email or sensitive values into audit snapshots.
- For edit/submit, apply an atomic compare-and-swap using existing revision or `__v`/`updatedAt` strategy consistent with the repo; avoid silent last-write-wins. Do not add unapproved schema/index changes just to simplify concurrency.
- Never perform database writes in GET routes.
- A repeated POST must not be claimed idempotent unless a legitimate request-key/deduplication mechanism exists. Prevent accidental UI double submission and document exactly what is guaranteed.
- Recover from Mongoose validation and duplicate/transaction errors using the existing envelope, no raw stack or Mongo details.
- Do **not** add Step 66 notifications without verified event/recipient policy. No background worker.

---

## 5. UI/UX: make RoadSync feel original, modern and premium

### 5.1 Design must be visibly better than a basic form

**Design direction:** **“INFRAOS Mission Control / CorridorOps”** — a connected-infrastructure operations workspace. It should feel as refined and usable as a modern startup/business SaaS application, using reference *principles* from **BuiltList.space**, **Linear**, **Stripe**, **Vercel**, and the owner's previous business dashboards; never clone their layouts, source, illustrations or brand identity.

The current verified design is **already modernized** (PR #121). **Extend it**; do not wipe it away to install a new generic sidebar or dashboard template.

Verified reusable assets:

- `components/auth/staff-workspace-shell.tsx`: charcoal/sidebar and header, mobile drawer, authenticated user menu and unread indicator.
- `components/auth/workspace-nav.ts`: role-related live navigation; add RoadSync only when route exists and permission checks are correct.
- `components/common/status-badge.tsx`: semantic icon + text badges.
- `components/motif/connected-motif.tsx`: route lines/junction nodes motif.
- `styles/tokens.css`: semantic brand, soft status tints, Mission Control layout widths and accessible text colors.
- `styles/mission-control.css` and `styles/mission-control-dashboard.css`: spatial hierarchy, KPI card and panel patterns.
- `docs/design/future-module-patterns.md`: RoadSync future styling rules.

### 5.2 Signature RoadSync experience

**A. Work-request command overview** (`/roadsync` if step scope includes a hub; otherwise the list route can serve the overview):

- Condensed editorial header: **“Coordinate the work. Protect the corridor.”** (subject to content review).
- Context eyebrow `OPERATIONS / ROADSYNC`, title **“Work Requests”**, small clear description of what is recorded and what is *not yet analyzed*.
- Up to three compact real-data summary tiles if the list/count endpoint can support them honestly: `Requests in scope`, `Draft`, `Submitted`. Do not add “Conflicts detected” before conflict detection exists.
- Clean search/filter toolbar with status, work type, priority and project link only where supported.
- Premium table/list layout with leading type icon, two-line project identity, planned time window, priority and status chip; crisp responsive density.
- Consistent empty, first-use, permission-limited, loading and retry states; subtle network motif in an empty state only.
- One primary action **New work request**, visible only when authorized.

**B. New work request** (`/roadsync/work-requests/new`):

- **Polished sectioned form** within Mission Control; a three-part logical flow:
  1. **Project & work details:** scoped project picker; work-type icon tiles or radio cards; priority segmented selector.
  2. **Location/geometry:** simple type selector `Point / Line / Polygon`, safe validated GeoJSON input/preview; accessible non-map fallback.
  3. **Planned schedule:** starts/ends with local-time explanation and UTC-safe serialization; inline date validation.
- An unobtrusive **sticky summary panel** on wide screens: selected project, agency (server-derived), work type, priority, planned window and “Saved as DRAFT” explanation; on mobile stack as a compact step summary.
- Clear field help and example-format hints; no distracting full-screen illustrations.
- Sticky or appropriately placed action bar: `Create draft` primary, `Cancel` secondary; submit/approve buttons only when truly implemented and permitted.
- Prevent repeated button clicks during mutation, provide explicit success notification and navigate to created detail.
- Accessible error summary on invalid submit with focus on the first invalid control; preserve input on server errors.

**C. Work request detail** (`/roadsync/work-requests/[id]`):

- Strong metadata header: code/label derived from actual record (do not invent work request code unless schema provides one), work type, current status, priority and authorized project link.
- Use an **operations timeline** card showing *planned start/end* and record creation; do not imply actual on-site activity occurred.
- Large *work geometry* panel with type and valid coordinate summary. A map **preview** is optional only if existing map components and tiles are available without new services; otherwise show an elegant geometry outline/coordinate summary and a truthful “Map preview unavailable” state.
- Activity/audit snippet only if a permission-safe endpoint exists; don't expose raw audit logs or invent a “recent coordination” feed.
- Compact next-step notice: “Conflict detection and agency coordination will be available in later RoadSync steps.” No green “Clear to proceed” status.
- Edit action only if implemented; preserve typed state and correct concurrency feedback.

### 5.3 Beautiful, accurate chart and visual policy

The user explicitly values **modern dashboards with meaningful charts, icons, widgets and polished components**. Make the current Step 66 RoadSync list/dashboard rich enough to be professional, but never stuff it with unsupported charts:

- **Allowed:** small status distribution segmented bar (only if count data is authorized and accurate); compact priority mix **only** if aggregate data exists; planned-window chips; real count tiles.
- **Conditional:** 7-day/30-day timeline **only** if actual stored schedule data is exposed by a safe endpoint, and the series is labelled *planned work*, not observed construction progress.
- **Not allowed:** historical line trends without history; geographic conflict heatmaps; “AI risk”; national totals; fake saved money; green conflict-free indicators; hardcoded chart values.
- Every chart must have exact counts as accessible text or a table; no color-only meaning.
- When there are 0 or 1 records, present a first-use card/one-record summary rather than manufacturing a balanced chart.

### 5.4 Visual implementation standards

| Element | Standard |
|---|---|
| Primary identity | Sri Lankan-inspired orange `#FF5B00`, green `#279541`, gold `#FEB600`, maroon `#8C1F28` using **existing tokens** |
| Surfaces | `--infra-canvas`, `--infra-surface`, Mission Control panel tokens; light-first with restrained charcoal sidebar |
| Desktop composition | Existing 16rem sidebar, 3.5rem topbar, broad content max; 12-column internal layout only if truly useful |
| Typography | Existing font and token scale; descriptive headings, readable 14–16px body, monospaced/tabular number treatment where appropriate |
| Cards | 12–16px corner radius, 1px neutral border, subtle shadow only for hierarchy; no large colored boxes |
| Iconography | Lucide React, consistent size/stroke; distinguish work categories; don't use emoji as system icons |
| Motion | 120–200ms subtle hover/focus with reduced-motion preferences |
| Colors | Orange for primary interaction, yellow pending, maroon critical, green confirmed success; status = label+icon+color |
| Forms | Visibly modern field groups, true labels, contextual help, validation summary, click/keyboard and touch operation |
| Info density | High enough for serious professionals; intentional whitespace, not huge ornamental heroes |
| Navigation | RoadSync visible only for authorized staff **after working route exists**, with active state and mobile drawer entry |

Never replace the public Connected Future landing pages `/`, `/si`, `/ta` or rewrite the existing dashboard for this step.

### 5.5 Screen and interaction acceptance

Check widths **320, 375, 768, 1024, 1440 and 1920**. For a lightweight implementation run, inspect **320, 768 and 1440** in a single browser; record remaining widths for the final phase verification unless a defect appears. The owner must be able to open the exact URL and view the working page, not just see screenshots.

Minimum interaction quality:

- No horizontal page overflow, hidden buttons or clipped menu items.
- Mobile drawer and form remain usable at 320px.
- Tables become cards/adaptive rows on mobile rather than a 900px scrolling-only desktop table.
- Keyboard operability for selector, inputs, dismissible menu and dialogs.
- Accessible focus ring uses existing derived text/focus colors (raw bright orange may fail contrast against light canvas).
- Semantic headings, labels, `aria-describedby`, status messages, reduced-motion support.
- English labels polished; Sinhala/Tamil supported where current locale infrastructure genuinely exists. Native linguistic review must be recorded **NOT RUN** until completed.
- Screen reader equivalents for compact charts and coordinate summaries.

### 5.6 Proposed frontend component map (only if missing; do not create unused files)

```text
apps/web/src/app/roadsync/
  page.tsx                         # optional real hub, only if roadmap scope warrants
  work-requests/
    page.tsx                       # scoped list
    new/page.tsx                   # create DRAFT
    [id]/page.tsx                  # detail

apps/web/src/components/roadsync/
  work-request-list.tsx            # listing + search/filter, responsive table/cards
  work-request-form.tsx            # form using existing fields/form helpers
  work-request-detail.tsx          # truthful detail display
  work-request-geometry-field.tsx  # validated coordinates + optional preview
  work-request-planned-window.tsx  # dates and clarity

apps/web/src/lib/roadsync/
  work-requests-api.ts             # existing apiClient + auth/session semantics
  work-requests-transform.ts       # DTO ↔ form, typed safe
  work-request-messages.ts         # locale copies with draft review notes
```

The exact component boundaries are suggestions; minimize file count and use existing shared primitives before creating each one.

---

## 6. Authentication, RBAC, privacy and security

### 6.1 Permission and role model

Use existing live grants; example seed role coverage was verified:

- `GOV_ADMIN`: `.create`, `.read`, `.update`, `.cancel` work-request permissions (subject to org/project scope).
- `AGENCY_OFFICER`: same basic work-request permission family (own agency scope).
- `PROJECT_MANAGER`: same permission family (assigned project / own agency restrictions).
- `SUPER_ADMIN`: `.read`, **not create**, in the current seed policy.
- `CONTRACTOR`, `INSPECTOR`, `CITIZEN`: no work-request permissions in the current seed policy.

Inspect actual live permission resolution and avoid accidental role-based hardcoding. If `SUPER_ADMIN` platform read handling conflicts with current null-agency policy, report and preserve existing fail-closed behavior—no silent bypass.

### 6.2 Mandatory negative cases

At minimum test:

- Anonymous create/list/detail → 401.
- Authenticated actor lacking a grant → 403.
- Foreign project/foreign work request → generic 404/no title leak.
- Agency officer spoofing `agencyId` → 400/reject; no persisted forged assignment.
- Project manager creating for an unassigned project → denial.
- `CANCELLED` project creation → denied per `BR-PRJ-007`.
- Disabled/epoch-stale actor → 401, no writes.
- Invalid enum, date range, geometry, ObjectId → 400, no DB write/audit.
- Audit persistence failure → no orphan work request if audit atomicity required.
- Query sorting/filters cannot expand scope via `$` operators.
- Concurrent DRAFT mutation (if implemented) → one successful write, one safe conflict or equivalent CAS outcome.

No general full-site security audit after each small change; these **focused cases** are non-negotiable because Step 66 introduces new authenticated persistence and geodata.

### 6.3 Privacy

Response DTOs should omit any internal credential, token, private project metadata, internal audit snapshots and unrelated agency names. Use current `apiClient`, query-key scoping and cache invalidation on logout/account switch. No stale work-request list should appear across role or agency changes.

---

## 7. Environment, external services and operational safety

**Step 66 requires:** existing Next.js runtime, Node/Express runtime, valid local-only signing config for a demo, and **disposable local MongoDB** for tests/owner walkthrough. It **does not require** AWS, an OpenRouter key, Qdrant, Cloudflare R2, SMTP, Mapbox, Google Maps keys, remote GIS, or new external providers.

Canonical existing variables (recheck actual local env catalog):

- API: `NODE_ENV`, `PORT`, `FRONTEND_ORIGIN`, `API_PREFIX`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, optional required TTL values; database environment only for approved local context.
- Web: `NEXT_PUBLIC_API_BASE_URL` (API origin only, no `/api/v1` suffix), `NEXT_PUBLIC_AUTH_LOGIN_ENABLED` when legitimately enabling local live login; map-style key only if already present, not a new requirement.
- Never expose backend credentials in `NEXT_PUBLIC_*` or print secrets to logs/screenshots.
- **Never use production Atlas for tests/demos.** Avoid any Atlas index alteration or `syncIndexes()` against live Atlas.

### Resource-efficient VS Code policy (critical owner requirement)

The owner's Windows laptop can freeze or close VS Code under heavy parallel work. Therefore:

1. Read only directly related source files; no repeated giant repository scans or all-steps audit.
2. Use **one Claude agent**, not parallel subagents; one resource-intensive process at a time.
3. Do not launch tests/build/browser concurrently. No background watchers unless needed.
4. During implementation run focused API tests for work requests and the directly affected web tests, then a relevant type-check; no full API/web regression yet.
5. Run lint only for affected code when supported, not full-site build for a basic UI adjustment.
6. **Full suites/type/lint/build only once at final phase review**, sequentially; rerun targeted failures rather than all commands blindly.
7. Do not start extra Next.js instances or many arbitrary ports; inspect listeners, reuse owner-approved local web/API pair when safe.
8. Use **one actual browser**; first prove the main workflow, then verify representative widths. Keep screens accessible for owner review without spawning another demo server for every screenshot.
9. If CPU/RAM becomes unstable or a test process dies, stop initiating new heavy commands and report resource impact. Never kill unrelated processes to improve performance.
10. Do not claim error-free work or security approval when checks were deferred.

### Local demo safety

- Check whether a suitable existing isolated demo environment exists; reuse only when it is safely disposable and clearly belongs to the agent task.
- If new servers are necessary, select just **one** unused frontend port and **one** unused API port; exact URL is determined at runtime, not invented.
- Bind synthetic demo backend and Mongo to `127.0.0.1` (known demo passwords must not be network-exposed); respect existing production server binding.
- Do not overwrite `.env`, `.env.local` or existing user services. Use session-scoped overrides where possible.
- A demo built on an in-memory database is ephemeral; report it plainly.
- Leave approved owner-demo servers running until the owner instructs shutdown, **only if the user wants to view them**; do not leave useless watchers or ghost servers.

---

## 8. Step 66 implementation sequence, risk-first and design-first

**Phase 0 — light preflight (read-only)**

- Verify local roadmap wording, current branch, dirty files/index/stashes, remote baseline, existing Mission Control merge and available work-request source.
- Ensure G1 branch setup/switch has explicit owner authorization **before doing it**. For Step 66 recommend `feature/roadsync-work-requests`; keep current UI branch if not safe to switch and stop for approval.
- Compare no more than the needed files; reconcile any existing local RoadSync implementation and avoid duplicates.
- Write a brief scope table: required, conditional, deferred.

**Phase 1 — API policy/validation**

- Implement strict Zod create/list/detail schema, safe geometry/date rules and live permission/agency/project scope.
- Unit test geometry and authorization decisions before wide surface expansion.

**Phase 2 — persistence and routes**

- Implement minimal CRUD slice: scoped list, create DRAFT, view detail, and conditional draft update if locally confirmed.
- Integrate atomic audit, standard error envelope, no-store, pagination and safe concurrency.
- Mount router without disturbing ProjectTrace/notifications.

**Phase 3 — premium Mission Control frontend**

- Build work request list, create and detail with high visual quality, reusing existing shell/components.
- Support project selection, exact enum choices, valid geometry entry, date-range UX, real status chips, role-aware actions, mobile responsiveness.
- Add RoadSync sidebar item only once a working authorized route exists; ensure role/active-nav tests.
- Do not change public Connected Future landing.

**Phase 4 — focused implementation verification**

- Focused work-request backend API/security tests, form and route-focused frontend tests, affected app type-check.
- Diff review. Resolve actual bugs within approved scope and rerun only affected checks.
- Avoid 6 full-screen automated test cycles.

**Phase 5 — real owner-accessible demonstration**

- Prepare safe synthetic agency/project staff and an actual work request with real API persistence. Show authorized create → list → detail and foreign-account denial; show valid geometry and date validation.
- Run in one lightweight browser session, record actual URL/screenshot at 1440 and 320 (plus 768 if useful), leave owner URL accessible.
- Clearly distinguish a persisted *work request* from unimplemented *conflict detection*.

**Phase 6 — final phase-wide review + Git integration**

- Use the separate **single final review prompt** in the companion document. Sequentially run complete suites and one combined browser review at owner request.
- Preserve permission and production blockers. G1–G5 only on explicit scoped approval; G6 requires **separate** owner approval after verified PR checks.
- Prepare Step 67 handoff using its **exact local roadmap title** (do not guess).

---

## 9. Detailed acceptance criteria (S66-01 to S66-14)

| ID | Required acceptance evidence |
|---|---|
| **S66-01** | Local `Steps.docx` title/body confirmed; branch and dirty files protected; no unwanted source refactors. |
| **S66-02** | Existing WorkRequest model, shared DTOs, enum values and page inventory reused; no duplicate competing schemas. |
| **S66-03** | Authorized AO/PM/GA can create a **DRAFT**, linked to a real in-scope project, with **server-derived** agency. |
| **S66-04** | Work type, priority, valid ISO dates and correct GeoJSON Point/Line/Polygon validated; reversed/malformed/empty data rejected with zero writes. |
| **S66-05** | Bounded read/list/detail endpoints are live-session, permission- and scope-protected; foreign IDs fail closed. |
| **S66-06** | Project status restrictions (especially CANCELLED) and PM assignment rules verified; no forged agency or privileged fields accepted. |
| **S66-07** | Project/work-request mutation auditing is correctly recorded and safe under failure; GET does not write. |
| **S66-08** | If draft edit/submit is explicitly in the source scope, it has controlled status/revision/concurrency and negative tests; otherwise it is accurately deferred. |
| **S66-09** | Professional **new RoadSync UI** uses merged Mission Control shell, unique infrastructure motif, polished controls, accessible badges, responsive list/form/detail; no generic old-style screen. |
| **S66-10** | No fake conflict score/map result/trend/chart, and only implemented routes appear in navigation; unused RoadSync future panels are omitted or honestly labelled unavailable. |
| **S66-11** | Focused API/web/type checks pass or specific failures are reported; no unnecessary parallel full testing during development. |
| **S66-12** | Real isolated browser walkthrough verified: login → in-scope project → work request DRAFT → list/detail → invalid submission denied → cross-agency inaccessible; screenshots and exact URLs recorded. |
| **S66-13** | 320/375/768/1024/1440/1920 responsive and a11y reviewed in final phase (representative 320/768/1440 during implementation), with draft EN/SI/TA status honestly documented. |
| **S66-14** | One final scope/quality report, real owner demo instructions, security/Atlas limitations, roadmap Step 67 handoff, and Git G1–G6 status; no unapproved Git writes. |

**Acceptance policy:** A security/permission or invalid-geometry persist defect is **BLOCKED**; a noncritical visual nit is **REVISE**. Do not replace reliable tests with green assertions. Visual owner acceptance is separate from same-agent test outcome.

---

## 10. Focused test plan — run proportionally

### 10.1 Implementation-time minimum

Create a focused API test file (example `apps/api/tests/roadsync-work-requests.test.ts`) and targeted frontend form/list tests as needed. Run just those files. Ensure tests cover:

- Valid Point, LineString and Polygon DRAFT creations; stored values and correct server agency.
- Invalid coordinate, malformed rings, coordinate order mistakes if detectable, reversed dates, empty/non-finite geometry, enum failures and unknown keys.
- PM assigned vs unassigned; AO own vs foreign agency; GA in-scope vs cross-org; SA read-only; contractor/inspector/citizen denial.
- `CANCELLED` project and unavailable linked project; correct error code and no leaked project title.
- Empty list and paginated list; detail 404 and filter tampering; bounded query.
- Audit success and rollback failure if transactional; no GET writes.
- Draft edit stale revisions and disallowed state, **only if edit implemented**.
- Frontend project picker scope, validation feedback, permission-aware create CTA, successful navigation and reload.

### 10.2 Final phase only (one consolidated review)

Run sequentially, one at a time:

```powershell
npm run test:api
npm run test:web
npm run type-check
npm run lint
npm run build
git diff --check
```

Record exact exit status, counts, skips and warnings. Do not repeat successful suites after a docs-only edit. On a real failure, inspect and fix the narrow cause, rerun affected tests, and repeat the necessary gate(s) once. Respect CPU/RAM. No parallel test agents or full browser farms.

### 10.3 Negative cases for safety-critical changes

Keep authorization, project/agency scope, geometry, date/priority and atomic-audit negative tests **even in Lightweight Development Mode**. Do **not** turn off critical permission tests to speed up the laptop.

### 10.4 Browser/owner evidence

One browser, one actual synthetic environment, no unrelated services. Required observed URLs (use actual ports): login, work-request list, new, detail, existing linked project overview. Capture screenshot evidence showing the actual API-backed result; note withheld and future-only functionality. Test identity switch in the same browser to ensure no stale private list. Owner must get a usable URL and verified synthetic demo credentials locally, not just a text report.

---

## 11. Git G1–G6 — complete integrated approval workflow

**No Git write is implicitly authorized by this document.** The companion execution and final review prompts also contain all six gates. A single explicitly scoped owner approval can cover **G1–G5**, but **G6 always requires separate explicit approval**.

**Recommended single feature branch:** `feature/roadsync-work-requests`, based on current verified `origin/development` at the time owner authorizes G1. Existing `feature/ui-mission-control` may now be integrated remotely; inspect **local** dirty UI files before switching.

| Gate | Procedure | Owner approval |
|---|---|---|
| **G1 — Safe preflight/branch** | `git status --porcelain=v1 --untracked-files=all`; `git diff --name-only`; `git diff --cached --name-only`; `git branch --show-current`; compare to `origin/development`. After approval, `git fetch origin development` and conditionally `git switch -c feature/roadsync-work-requests origin/development` **only if safe**; reuse existing approved branch where appropriate. | Explicit required for create/switch. |
| **G2 — Scoped stage** | Review changed path set; `git add -- <explicit approved paths>`, **never** `git add .` or `git add -A`; `git diff --cached --stat`/`--check` and inspect staged patch. | Explicit staged-file approval. |
| **G3 — Commit** | After accepted focused + final checks, `git commit -m "feat(roadsync): implement work requests (step 66)"` (adapt to actual files). | Explicit required. |
| **G4 — Push** | Verify branch and remote; `git push -u origin feature/roadsync-work-requests`. No force-push. | Explicit named branch approval. |
| **G5 — PR to development** | Open a **draft** PR `feature/roadsync-work-requests` → `development`, include scope, actual tests, screenshots, limits and safety notes; inspect diff/CI. Use GitHub UI or `gh pr create` only if available and approved. | Explicit required. |
| **G6 — Merge** | Only after separate owner approval **and current-HEAD required CI green**; review merge safety, perform approved merge, confirm `development` SHA, post-merge CI, and handoff. | Separate explicit owner approval required. |

**Do not** reset, clean, stash, rebase, force-push, force-checkout, create another worktree or modify `Documents`, `Prompts/`, unrelated reviews, `.env*`, production data, `main` or the public landing. Never leave secrets or demo login cookies in Git evidence. Production readiness stays BLOCKED.

If the current checkout contains uncommitted Mission Control work and branch switching would risk anything, **STOP G1 and report**, do not hide files in a stash or create a new clone.

---

## 12. Required review artifacts and concise handoff

Keep documentation proportional; **one** short Step 66 implementation note and **one** final phase verification report is enough:

- `docs/reviews/step-66/IMPLEMENTATION-STATUS.md` — actual scope, file list, focused checks, browser proof, limitations and Git gate state.
- `docs/reviews/step-66/END-OF-PHASE-VERIFICATION.md` — only after final review, full sequential gates, security findings, screenshots/URLs and verdict.
- Screenshot files only when truly captured; avoid dumping full browser HAR, cookies or tokens.

Deliver owner-facing walkthrough:

1. Which **actual URL** to open in Chrome on the same Windows PC.
2. Which **verified synthetic account** to use and its role (share demo password locally and only if safe).
3. How to create a Point or LineString work request using an in-scope Project.
4. Where to see stored DRAFT status, priority, project link and planned date window.
5. How to inspect the saved list/detail, log out, and prove a foreign officer cannot access the work.
6. How to restart a disposable demo. Say clearly if it loses data on shutdown.
7. Clarify Step 66 does **not** yet detect cross-agency conflicts; report upcoming exact Step 67 handoff from the roadmap.

### Final status vocabulary

For each S66 requirement: `PASS`, `FAIL`, `BLOCKED`, or `NOT RUN`. Overall feature verdict: **APPROVE / REVISE / BLOCKED**. Differentiate **same-agent recommendation**, **owner UI acceptance**, **Git integration**, and **production readiness**. Do not call demo CI a production signoff.

---

## 13. Sources and design references (for the executing agent)

**Repository:** https://github.com/divejikan-yuvarajah/InfraOS  
**Roadmap:** local `Prompts/Steps.docx` (exact Step 66 text must be read there).  
**Requirements:** `docs/planning/requirements.md`, `docs/planning/business-rules.md`, `docs/ux/page-inventory.md`.  
**Mission Control:** `docs/design/future-module-patterns.md`, `apps/web/src/styles/tokens.css`, `apps/web/src/components/auth/staff-workspace-shell.tsx`.  
**External design inspiration (principles only):** https://builtlist.space/ ; https://linear.app/ ; https://stripe.com/ ; https://vercel.com/ .  
**Verified GitHub merges:** PR #119 (ProjectTrace dashboard and notifications), PR #121 (Mission Control), `development` SHA `f30c1f1896733de814f94ddd11a87da5c7c4c805` at preparation.  

**Owner’s top priorities:** 1) safe and correct scoped functionality; 2) **visibly premium and distinctive UI**, not old-style CRUD; 3) actual owner-visible output; 4) minimal processes/files/testing per Step; 5) rigorous one-time final phase review; 6) G1–G6 authorization discipline.
