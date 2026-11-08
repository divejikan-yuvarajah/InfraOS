# INFRAOS — Enhanced Development Specification and Verification Contract
## Original 190-Step Roadmap · Steps 53–54 · ProjectTrace Listing & Overview

**Project:** INFRAOS — National Infrastructure Intelligence & Coordination Platform  
**Vision:** *The Operating System for National Infrastructure*  
**Product identity:** Sri Lankan university GovTech demonstration; NOT an official government-operated service  
**Roadmap authority:** `Prompts/Steps.docx` in the INFRAOS repository  
**Reference repository:** https://github.com/divejikan-yuvarajah/InfraOS  
**Required workspace:** `C:\Users\ASUS\Desktop\InfraOS\InfraOS` (one existing worktree only)  
**Scope:** Step 53 — **Projects Listing Page**; Step 54 — **Project Details & Overview Page**  
**Downstream handoff:** Step 55 — **Edit Project & Validation** (NOT included)  
**Document purpose:** Full implementation-ready contract AND existing-implementation reconciliation/repair protocol. Do not rebuild already functioning code.  
**Source inspection checkpoint:** 2026-10-26; GitHub remote only, not the owner's uncommitted local files.

> **Critical current-state distinction.** Unlike a greenfield development prompt, these two steps have **already been implemented and merged** on the inspected remote. At this checkpoint `development` is `35edec5d309a067e181b74a27ce85f69eebc9f36`; `main` is `8abea58fe376587ef45d4471c082e7c0c7167d26` (PR #93 merge containing the work). The committed review reports **294 API tests**, **161 web tests**, successful type-check/lint/build *at the time of that review*. They are historical results, not fresh local executions and not browser acceptance. Signed-in project browser E2E was explicitly **NOT RUN**. Inspect `git status`, `git log`, branch ancestry, and actual source before deciding whether ANY additional implementation is necessary. Do not re-implement working features and do not claim local uncommitted edits are present remotely.

---

## 0. Non-negotiable development contract

Act as principal Next.js/React/TypeScript engineer, Express/Mongoose service architect, accessibility and multilingual UX engineer, security/RBAC reviewer, QA automation engineer, and Git integration lead. Optimize for truthful verification and minimal change.

1. Work **only** in `C:\Users\ASUS\Desktop\InfraOS\InfraOS`. Do not create another repository copy, extra project folder, Git worktree, or change/inspect/move/delete the separate `Documents` folder. Do not confuse `docs/` inside the repository with the protected `Documents` folder.
2. `development` is the integration branch; `main` is approved stable. Prefer an existing appropriate **feature-based** branch for needed remediation; if Steps 53–54 already merged and there are no defects, make no new branch or code changes. **Never** create a branch per roadmap step.
3. Inspect tracked/untracked modifications and ownership first; no automatic checkout over dirty changes, stash, reset, clean, rebase, force push, or deletion. Branch operations that could disturb owner changes require approval.
4. **No commit, push, PR, merge, release, or production/deployment changes without separate explicit owner approval for each action.** Prepare exact proposed commands; do not execute them by default.
5. Preserve Steps 01–52 and all existing functionality, including public Connected Future `/`, `/si`, and `/ta`. No redesign of public landing pages, auth, admin, or sibling modules.
6. Existing Next.js App Router + React + TypeScript + Tailwind/shadcn/Radix + TanStack Query/Table, Express `/api/v1` modular monolith, MongoDB/Mongoose/GeoJSON are mandatory. Reuse installed code/libraries and APIs. No speculative services, credentials, or new framework.
7. Never connect to or mutate live MongoDB Atlas merely to demonstrate a page; no unapproved schema/index migrations, seeding, or test writes to Atlas. Use an **isolated disposable local Mongo replica set** or pre-authorized disposable test service and synthetic staff, with credentials handled privately.
8. Every step requires **actual signed-in browser output demonstration** in an authorized isolated development environment: real screenshot(s), precise accessible URL(s), walkthrough, API/test evidence and honest result classification. A screenshot of the production preview gate is **not** the signed-in feature demonstration. If unavailable, mark browser **BLOCKED/NOT RUN** and do not call the step fully accepted.
9. Scope ends at Step 54. No `/projects/[id]/edit`, status transition, submission, approval, milestone CRUD, progress-edit, actual Finance/Inspection/AI/RoadSync feature, or fake future navigation. Step 55 and later remain unimplemented by this specification.
10. Review/fix each step with essential focused checks, advance to Step 54 only once Step 53's minimum gate is satisfactory, and perform **one combined comprehensive full-suite/visual/security review after both**.

### Evidence and review vocabulary

- **VERIFIED SOURCE:** code/file/ref actually inspected at stated branch/SHA.
- **HISTORICAL TEST:** result quoted from committed review, not re-executed.
- **LOCAL VERIFIED:** executed in current workspace with command, exit/status and date.
- **BROWSER VERIFIED:** authenticated, isolated browser session, evidence file, page URL and role.
- **PASS / FAIL / BLOCKED / NOT RUN:** report separately per criterion. Never upgrade preview privacy checks to signed-in UX success.
- **APPROVE / REVISE / BLOCKED:** overall recommendation; independent human sign-off is separate from same-agent self-review.

---

## 1. Exact roadmap source and interpretation

The original `Prompts/Steps.docx` gives the following **verbatim requirements** (titles and included Step 53 line):

| No. | Original roadmap text | Explicit source scope |
|---|---|---|
| **53** | **Projects Listing Page** — “Search, filters, statuses, agencies, pagination and sorting.” | Real authorized list and interactions |
| **54** | **Project Details & Overview Page** | Detail/overview; **no further micro-bullets** in the DOCX |
| **55** | **Edit Project & Validation** | Next step; do not implement |
| **56** | **Project Lifecycle & Status Workflow** | Future step; do not implement |
| **57** | **Project Approval Workflow** | Future step; do not implement |

Step 54's detailed UI/API requirements below are **implementation design requirements derived from committed code and locked architecture documents**, **not** invented quotes from the original roadmap. When executing, compare the actual local `Prompts/Steps.docx` with this table. Report discrepancies and do not silently rewrite scope.

### Outcomes

- **Step 53:** Authenticated staff can find the infrastructure projects they are allowed to see, using search, status/type/agency filters, server-side sorting and pagination; totals and navigation reflect backend truth, with no confidential cross-agency leakage.
- **Step 54:** Authorized staff can open a real project and view trustworthy scoped project identity, descriptive/schedule/place/progress details, and budget **only** if live permission allows it, then return safely to the list.
- **Integration journey:** Login → `/projects` → search/filter/sort/paginate → click project code → `/projects/{realId}/overview` → return to filtered list → account-switch/logout without stale private data.

---

## 2. Repository analysis and current baseline

### 2.1 Verified GitHub state

- `main`: `8abea58fe376587ef45d4471c082e7c0c7167d26`, a merge of PR #93 from `development` (“complete scoped project list and overview”).
- `development`: `35edec5d309a067e181b74a27ce85f69eebc9f36`, commit titled `feat(projecttrace): complete scoped project list and overview`.
- Review artifacts currently accessible: `docs/reviews/step-53/IMPLEMENTATION-STATUS.md`, `docs/reviews/step-54/IMPLEMENTATION-STATUS.md`, `docs/reviews/steps-53-54/END-OF-PHASE-VERIFICATION.md`.
- **Not present** in inspected remote: `Prompts/INFRAOS_Steps_53_54_Enhanced_Development_Prompt.md` (an earlier handoff expressly said that file was absent). This new downloadable prompt is an external prepared artifact; it is not automatically committed.
- The local directory may be ahead/behind or dirty. Remote evidence is **not** a substitute for local `git status`, `git log`, and actual browser testing.

### 2.2 Existing feature implementation and source-of-truth paths

| Concern | Established files and contract |
|---|---|
| List route | `apps/web/src/app/projects/page.tsx`; `apps/web/src/components/projects/projects-page-client.tsx` |
| Overview route | `apps/web/src/app/projects/[id]/overview/page.tsx`; `apps/web/src/components/projects/project-overview-client.tsx` |
| Project fetch / auth boundary | `apps/web/src/lib/projects/api.ts`; `apps/web/src/lib/auth/state.ts`; `apps/web/src/lib/auth/availability.ts` |
| URL state / enum presentation | `apps/web/src/lib/projects/list-query.ts`; `apps/web/src/lib/projects/overview-format.ts` |
| Client DTO and copy | `apps/web/src/lib/projects/types.ts`; `apps/web/src/lib/projects/messages.ts` |
| Create/overview integration | `apps/web/src/components/projects/project-create-page-client.tsx`; `apps/web/src/lib/projects/create-transform.ts` |
| API router | `apps/api/src/modules/projects/projects.routes.ts` |
| API validation | `apps/api/src/modules/projects/projects.schema.ts` |
| API business and scoping | `apps/api/src/modules/projects/projects.service.ts`; `apps/api/src/modules/identity/authorization/resource-scope.ts` |
| DTOs and schema | `apps/api/src/modules/projects/projects.types.ts`; `apps/api/src/modules/projects/models/project.model.ts` |
| Tests | `apps/api/tests/projects-foundation.test.ts`; `apps/web/src/lib/projects/{list-query,overview-format,create-transform}.test.ts`; existing messages and authorization tests |
| Design | `apps/web/src/styles/{tokens,typography-tokens,layout-tokens,auth-access}.css`; `docs/design/brand-color-system.md`; shared `DataTable` and `StatusBadge` |
| Requirements/permissions | `docs/planning/requirements.md`, `docs/planning/business-rules.md`, `docs/security/permission-matrix.md`, `docs/security/segregation-of-duties.md`, `docs/ux/project-detail-architecture.md` |
| Environment | `apps/web/.env.local`, `apps/api/.env`, `docs/setup/environment.md`, `apps/web/.env.example`, `apps/api/.env.example` |

### 2.3 Dependencies to verify, not rewrite

- Steps **35–44** login/session/route protection, especially access JWT in memory, refresh cookie and live role grants.
- Steps **45–46** resource scopes, role ceilings, agency/PM/inspector visibility, least-privilege read.
- Steps **51–52** create DRAFT, strict project query/API, scoped detail, revisioned draft patch, `/projects/new`; must exist and remain passing.
- Step 51 foundation: `GET /api/v1/projects`, `GET /api/v1/projects/:id`, `POST /api/v1/projects`, `PATCH /api/v1/projects/:id` (DRAFT edit is **Step 51 backend foundation**, not Step 55 completed UI).
- Step 53 is a prerequisite for Step 54's list-return UX; Step 54 must re-use the detail fetch and query-cache conventions instead of duplicating another data source.
- Existing admin, public landing, staff shell and list/create UX remain unchanged unless a reproducible scoped defect is found.

### 2.4 Known carry-forward blockers; never mask them

1. **Signed-in project listing/overview in a real browser: NOT RUN** in the committed phase report.
2. Auth availability sets production builds to `preview`, so `next start` in production mode does not prove signed-in private workflow. Do **not** disable this security gating for demos; use a proper authorized local dev mode.
3. Production Mongo/Atlas index migration and deployment auth policy remain **BLOCKED** without separate approval; do not call index routines or connect to Atlas to make a demonstration succeed.
4. Previous Step 51 **agency reparent/create race** and **permission-grant changes after transaction snapshot** are unresolved; do not describe them as proven fixed.
5. Step 50 invitation email and null-agency Super Admin sign-in remain **BLOCKED** in earlier reports; not dependencies to be hacked around.
6. Native Sinhala/Tamil translation review remains outstanding; trilingual draft messages do not equal final verified translations.
7. Step 53 offset pagination can drift if rows are inserted above current page; `_id` sort tie-break does not offer snapshot pagination.
8. No `REJECTED` project status in the current `PROJECT_STATUSES` enum; do not add it here. No `Project.submittedBy` or `Contractor.userId` field; do not fake ownership/approvals.
9. An expired JWT on the specific `GET /:id` endpoint was not separately tested in earlier report. Add focused test if appropriate.
10. README has some old status narrative; do not treat that text as overriding the code/commits/roadmap.

---

## 3. Proposed implementation approach and order

**Primary rule: inspect → identify genuinely missing acceptance → fix only demonstrated defects → verify.** If current behavior is correct, preserve it and spend effort on missing browser evidence, not cosmetic churn.

1. **Preflight / read-only review:** confirm absolute working directory, worktree, `git status --short --branch`, `git branch -vv`, `git log -5 --oneline`, and compare `development`/`main` to local branch without force or checkout. Read roadmap, required files, environment catalog (not secrets), history and current user-specific work.
2. **Step 53 focused reconciliation:** run relevant type/unit/API tests; inspect list behavior and backend scope/DTO; fix only rooted issues; perform true signed-in browser list demonstration; write concise checkpoint.
3. **Step 53 gate:** backend contract + authorization + essential checks satisfactory, or record blocker and do not assert completed demonstration. Next step can be reviewed where safe, but avoid masking prerequisite failures.
4. **Step 54 focused reconciliation:** verify list-to-detail + detail DTO + budget permission + cache separation + return link; repair only observed defects; do true signed-in overview demonstration; write concise checkpoint.
5. **One final combined review:** full web/API suites, TS, lint, build, browser E2E/responsive/a11y/security, regression/races; repair genuine issues, rerun impacted tests; produce one combined evidence-backed phase report.
6. **Git handoff:** provide proposed staging, commit and PR commands **only**; stop for owner authorization. No Step 55 code.

No duplicate design documents or parallel routing stacks. Reuse the committed review folder for brief additive evidence only, and retain the original reports as historical evidence unless a clear correction is warranted.

---

## 4. Step 53 — Projects Listing Page: full specification

### 4.1 Backend API: secure real records

**Route:** `GET /api/v1/projects` using the existing Express router, `requireAuthenticated`, live `requirePermission("project.read")`, live actor/role validation, `resolveResourceScope`, query-level filtering and current JSON success/failure envelope. `Cache-Control: no-store` and `Pragma: no-cache` for private reads.

**Existing allowlisted parameters** (verify rather than reinvent):

| Param | Expected contract |
|---|---|
| `page` | Int 1–1000; API default 1 |
| `limit` | Int 1–25; API default 20; existing frontend offers 10 and 20 |
| `q` | Max 80 characters; normalized trimmed Unicode title/projectCode text; reject prohibited operators/control chars |
| `status` | Existing project status enum, no unrecognized values |
| `type` | Existing project type enum (`projectType` in stored model) |
| `agencyId` | Exactly 24 hexadecimal chars; **additional intersection** against scope, never authority |
| `sortBy` | `createdAt`, `updatedAt`, `projectCode`, `title`, `projectType`, `status`, `startDate`, `plannedEndDate` |
| `sortDir` | `asc` or `desc`; API default `desc` |

Reject unknown, repeated, array/object, unsafe or invalid query keys with standard `400 VALIDATION_ERROR`; do not pass raw keys or `$` operators to Mongo filters/sorts. Use escaped, bounded regex text; monitor performance with allowed data volumes, do not add indexes without approval. `agencyId` filtering MUST be `$and`-composed with the actor's base scope. Use Mongo sort `{ [whitelisted sortField]: direction, _id: 1 }` for deterministic equal sort keys; calculate `total` server-side using the SAME scoped/filter query. Fetch page via `.skip()` / `.limit()` with a bounded limit. Explicitly document offset drift under inserts.

Return standard `success` envelope containing `{projects,page,limit,total,agencies}`. `agencies` must be the scoped, sanitized option set already available under the user's non-agency filters—not a global directory. Every list row must be a minimal `ProjectSummaryDto`: `id`, code, title, type, status, agency id/code, manager id when already safe, dates, creation/update timestamps, revision. **No** budget/`amountMinor`, coordinates/geometry, detailed description, financial progress, raw user, audit log or secrets.

Preserve role/resource ceilings: Gov Admin within active ministry subtree, Agency Officer own agency, Project Manager appropriate agency read but assigned-project write, Inspector only linked assigned inspections where permitted, Super Admin read-only platform scope. Contractors and citizens denied from this **private** API even if a badly configured role contains `project.read`. A known ObjectId never grants access. Changing status, deactivating agency, reparenting or revoking role permissions must affect subsequent reads. User/role/agency state must be read live as current service does.

### 4.2 Frontend interactions and state

**Route:** `/projects` (protected, `noindex`). Use existing `StaffWorkspaceShell`, `DataTable` with **server** mode/manual sorting, TanStack Query, existing API client and locale dictionaries. Avoid a static fixture dressed as live content.

- Clear page title/context and restrained relevant actions. Search by title/code with safe debounce or explicit submit preserving keyboard, correct URL history and no duplicate or runaway requests.
- Filters for status, category/type, **only scoped agencies** returned by API. Filter changes reset to page 1; agency choice cannot leak out-of-scope records.
- Paginate by backend `total`; page sizes 10/20; previous/next with disabled boundaries; communicate current page and total. Preserve URL state (`page`, `limit`, `q`, `status`, `type`, `agencyId`, `sortBy`, `sortDir`) using `parseProjectListParams`, `serializeProjectListParams` and React Router/Next.js navigation conventions already adopted.
- Sorting indicators (`aria-sort`) correspond exactly to the server's sort state; no second client sort contradicting the server; support asc/desc and deterministic refresh.
- Project code is a real link to `/projects/{id}/overview`, with a safely encoded/validated filtered-list return state. Browser Back/Forward/refresh should reflect URL instead of stale component state.
- Create CTA only where legitimately appropriate (existing role hint is UX only); API remains security boundary. Do not add Submit/Edit/Approve.
- Loading skeleton, no accessible projects, no results for active filters, 401 session expired/login, 403 permission denied, 429 if applicable, 503 backend outage, offline/network error and retry; no spurious `0` totals or stale confidential content when current identity changes.
- Avoid showing table with previous staff account data during a login switch. Query keys include auth epoch, **user id**, role and normalized query; clear private cache on account switch/logout, ignore responses from previous token/epoch. No localStorage JWT or persistent private query cache.

### 4.3 Step 53 acceptance matrix

| Criterion | Proof required |
|---|---|
| Authenticated list | Real signed-in role + valid request + actual scoped Mongo results |
| Search | Unicode and Latin title/code, safe query handling, no cross-scope leakage |
| Filters | Status/type/agency options, combinations, reset page, scoped total |
| Pagination | Server total, 10/20 UI, API 1–25, navigation, deterministic sort |
| Sorting | All whitelisted fields only; correct direction; tie behavior; no local contradiction |
| Authorization | Unauthenticated, unauthorized role, out-of-scope agency, role revocation, deactivation/reparent fixtures |
| Privacy | API DTO and DOM do not include budgets, geometry, raw documents or another actor's data |
| UX | Loading/empty/errors/keyboard/locale/responsive/browser history |
| Output | Real browser screenshot + URL + actor role + test run/evidence |

---

## 5. Step 54 — Project Details & Overview Page: full specification

### 5.1 Routing and trustworthy backend data

**Route:** `/projects/[id]/overview` (protected/noindex); **API:** the existing `GET /api/v1/projects/:id` (not a second aggregate endpoint). Request `GET` under `requireAuthenticated`, `project.read` and scoped Mongo filter. Invalid ObjectId: `400`; well-formed missing or out-of-scope project: privacy-safe `404` (do not disclose the code); banned role or revoked privilege: `403`; absent/expired credentials `401`; dependency failure `503`. Return no secrets and set no-store headers.

Only render DTO fields actually authorized by server. Existing `ProjectDetailDto` extends the summary with: `description`, descriptive `location`, GeoJSON `geometry` (authorized details only), `actualEndDate`, `physicalProgress`, `managerName`, and optional `budget`. Do not invent contractor association or `financialProgress` authority. `managerName` may include first/last name only when manager's agency matches project's; never email/password. `budget` is an **optional field**: server includes it only when live `finance.budget.read` is granted and data exists. Do not show a zero budget when omitted, and do not rely on hiding sensitive values only in React.

### 5.2 Premium overview composition

- Persistent identity header: project code, understandable title, status label/badge, type/category and responsible agency; manager if available. Consistent responsive staff shell, breadcrumbs/back-to-results, compact actionable info. Do not render dead future tabs/actions.
- Well-spaced semantic sections: **Description**, **Schedule** (planned start/end, actual end if recorded, UTC-correct updated timestamp), **Place** (descriptive district/province/locality/road; geometry **summary** only, not a fake interactive map), **Recorded Progress** (clearly state physical progress is recorded, not a verification or financial assessment), **Budget** only when authorized.
- Use “Not provided”/translated equivalent for genuinely absent fields, not invented map coordinates, contractor names, monetary amounts, inspector verdicts, status history or work requests.
- Format date-only business data from UTC calendar part to avoid Sri Lanka time-zone day shifts. LKR amount uses safe integer **minor units (cents)** and correct formatting. GeoJSON summary: valid Point longitude/latitude, LineString position count, Polygon ring count; graceful unknown data case.
- Keep the view read-only: Step 55 owns project edit UX, later steps own submission/approval, milestone/timeline, Finance, Inspections, Risks, Documents, RoadSync/InfraMap.
- Show one detail query keyed by auth epoch + user id + role + ID. Reuse existing `projectCoreQueryKey` and Step 52 create-success caching. A stale request must not repopulate another account's view. Verify no sensitive response is cached across logouts/account switches.
- Clicking a code from a filtered listing opens overview and preserves a safely reconstructed **internal** list return. `safeListReturn` must reject external URLs/unsafe/overlong return arguments and fallback to `/projects`.
- Provide skeleton/loading, not found/privacy, forbidden, session expired, offline/503 retry, accessible focus and layout without horizontal overflow. No misleading “live verified” status when merely previewed.

### 5.3 Step 54 acceptance matrix

| Criterion | Proof required |
|---|---|
| Open from listing | Valid scoped project id and real API response; safe back navigation |
| Authorized detail | Current permission + scope checked server-side for every call |
| Fields | Identity, schedule, description, geography, physical progress, manager when valid; truthful null handling |
| Budget privacy | Included only when **live** finance permission grants; absent in raw API response and DOM for denied role |
| Format | UTC dates, LKR cents, point/line/polygon summary; no invented details |
| Security | 400/401/403/404/503, no IDOR/code disclosure, no stale cross-account data |
| UX | EN/SI/TA copy, keyboard, mobile/desktop, zoom/reduced motion, no dead tabs |
| Output | Signed-in screenshot(s) showing real authorized data + real URL, API/test evidence |

---

## 6. Frontend design system, multilingual and accessibility policy

**Use existing semantic tokens** (`tokens.css` and `docs/design/brand-color-system.md`), do not introduce a parallel palette or external visual framework:

| Color | Hex | Purpose |
|---|---|---|
| Orange | `#FF5B00` | Primary brand/action, never low-contrast text on white |
| Yellow | `#FEB600` | Pending/review/warning |
| Maroon | `#8C1F28` | Critical/conflict/rejected states, only when statuses actually exist |
| Green | `#279541` | Success/completed/approved visual states, not authority |
| Canvas / surface | `#F8FAFC` / `#FFFFFF` | Professional neutral surfaces |
| Text | `#111827`, `#475569`, `#64748B` | Accessible hierarchy |
| Border | `#E2E8F0` | Calm separation |

Maintain existing shadcn/Radix input/buttons/badges, typography/layout tokens, table and form conventions. Balanced density, clear metrics, appropriately colored status, no gratuitous gradients, animation or dashboard-like marketing hero. Avoid misleading national seals or claiming an official government portal.

**Responsiveness:** test actual viewport widths **320, 360, 390, 768, 1024, 1440 px** plus 200% browser zoom; table must remain usable by scrolling or an accessible small-screen alternative. Main buttons/touch targets accessible, no clipped fields, no inaccessible menu or horizontal page overflow.

**Accessibility:** semantic headings, `<table>` headers and row scope, labeled search/filter controls, `aria-sort` on sorted headers, meaningful link labels, visible focus, keyboard-only navigation, sensible screen-reader announcements for loading/errors/results, accurate `aria-busy`, contrast in normal/high-contrast contexts, `prefers-reduced-motion`. No hover-only controls.

**Localization:** English, Sinhala and Tamil project UI labels/messages through existing `getProjectCopy`/dictionaries; no separate `/si/projects` or `/ta/projects` unless already required by existing architecture. Test real rendering, wrapping, script fallback fonts and switching. Sinhala/Tamil copy is **draft pending native review**, so present this as a limitation and never claim certified translation. Do not translate project-entered names or normalize away Unicode.

---

## 7. Authentication, authorization, privacy and threats

### 7.1 Trust boundary

- API is the authority, not route guards or UI hints. `requireAuthenticated` validates JWT and live account state; authorization is live permission plus role ceiling plus scoped Mongo predicate. Role permissions may change at runtime.
- Access JWT remains **memory-only**. Refresh remains via HttpOnly cookie with existing origin/CORS restrictions. Never put bearer in browser storage, URL, screenshots or logs. Do not switch auth architecture or fake a staff account with `NEXT_PUBLIC_AUTH_FIXTURE`.
- `getAuthAvailability()` on inspected source forces **production** to preview. Do not patch out that guard merely for screenshots. Use local development (`npm run dev:web`) and existing `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=1` *only when authorized backend/credentials ready*, never claim a production preview page proves signed-in E2E.
- No edit/create elevation for Super Admin simply because they can read. Gov Admin is organizational, not universal. Agency Officers own agency. PM write assignment separate from read. Inspector assigned inspection context; contractor/citizen private deny. Test role-permission mutation after sign-in.
- List DTO must not accidentally expose finance data. Detail's `budget` is server-controlled, optional, stripped for roles without `finance.budget.read`.
- Respect private `noindex` metadata, `no-store` HTTP headers, no secret-bearing error strings; redact tokens/session state, email, Mongo URIs and any sensitive debug logs.
- Untrusted URL params and known ObjectIds do not increase access. No generic `populate` of unrelated users or agencies, no broad collection query on behalf of a narrow role.

### 7.2 Threat-focused regression cases

IDOR/out-of-scope project via guessed ObjectId; out-of-scope `agencyId` filter; operator injection (`$where`/`$gt`) and repeated query keys; unknown sort fields; malformed IDs; expired/rotated/revoked session; staff role or agency change; account switch with in-flight fetch and prior TanStack data; restricted budget leakage via network payload or hydration; 503 Mongo failure; search/pagination drift; one unauthorized list response cannot reveal existence/count of another ministry's projects. Preserve actual API error envelopes and `Cache-Control: no-store`.

---

## 8. Backend, database and cross-module integration constraints

- **MongoDB/Mongoose:** reuse `Project` model, existing indexes and `projects.service.ts`. No `createIndexes`, `syncIndexes`, migration or reset in Atlas. Inspect whether allowed list sorting makes performance tradeoffs; document, do not add an index automatically. Use bounded query, escaped searches, role-filtered `find`, `countDocuments`, `distinct`.
- **Read-only scope:** Steps 53–54 do not alter project documents, change status, generate audits as if there were writes, approve work, or trigger RoadSync/Finance/AI. Existing Step 51 DRAFT writes should remain intact and tested for regressions.
- **APIs:** `GET /api/v1/projects` and `GET /api/v1/projects/:id` only for feature reads; keep POST/PATCH backwards-compatible. No duplicated Next.js API routes. Keep shared error envelope, typed DTO and authorization consistent. Ensure JSON serialization omits unauthorized fields even for user who knows record id.
- **Eventual modules:** list/detail show fields already in model and already scoped; no unseen project activity feed or fake full MapLibre overlay. InfraMap and RoadSync connections are future bounded contexts. AI must not modify official records.
- **Concurrency:** simultaneous read-after-account-switch, role change and hierarchy reparent fixtures; no stale cache for a different user; deterministic equal-sort ties but document mutable-offset behavior. Step 51 create/update transaction races remain a tracked carry-forward risk, not authorization to refactor them here unless directly breaking Steps 53–54.

---

## 9. Environment and external-service requirements (do not invent any)

| Service | Needed for code quality check? | Needed for **real** signed-in browser demo? | Source/notes |
|---|---|---|---|
| Node.js 22, npm 10+ | Yes | Yes | `.nvmrc`, root package scripts |
| Next.js / browser | Yes for build/tests | Yes | Local frontend normally `http://localhost:3000` |
| Express API | API tests | Yes | Local API normally `http://localhost:4000` |
| `NEXT_PUBLIC_API_BASE_URL` | API integration only | Yes | `apps/web/.env.local`, origin only (`http://localhost:4000`) |
| `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=1` | No for isolated unit tests | Yes for supported local live authentication | Existing `getAuthAvailability()`; **do not use in production to bypass preview gate** |
| `NEXT_PUBLIC_AUTH_FIXTURE` | Unit-fixture only if explicitly required | **No**, not real sign-in | Do not use to present fixture as live |
| `FRONTEND_ORIGIN`, `PORT`, `API_PREFIX` | API configuration | Yes, consistent with browser origin | `apps/api/.env`, CORS exact origin |
| `MONGODB_URI`, `MONGODB_DB_NAME` | Disposable integration tests provided by harness | Yes for real data | **Isolated local/disposable Mongo replica set only; NO live Atlas** |
| `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL` | For authenticated integration | Yes | Separate random local secrets; never print/store in Git |
| MapLibre/OSM tile provider | Not required | Not required | Overview has GeoJSON **summary**, not map |
| OpenRouter, FastAPI, Qdrant, R2, email, AWS, payments | Not required | Not required | Do not invent API keys, mock integration or deploy services |

Config guard: the API `/api/v1/health` can return healthy while Mongo is absent; check `/ready` as well (or `/api/v1/ready` if mounted) to confirm database dependency. Use isolated `mongo-memory-server` tests or approved disposable local replica with real, active, email-verified **synthetic** account provisioned through supported paths. Never manually flip production account flags or access Atlas to “just get a screenshot.”

---

## 10. Essential step-level testing and combined phase QA

**Do not run a full suite after every tiny edit.** Each execution step runs only relevant focused checks + necessary type checks. The single combined final review runs all broader suites:

```powershell
# Read-only preflight, in the one canonical workspace
git status --short --branch
git log -5 --oneline

# Combined overall phase QA after BOTH steps are reconciled
npm run test:api
npm run test:web
npm run type-check
npm run lint
npm run build
git diff --check
```

Focused suggestions, inspect actual Vitest scripts first:

```powershell
npm run test -w @infraos/api -- tests/projects-foundation.test.ts
npm run test -w @infraos/web -- src/lib/projects/list-query.test.ts src/lib/projects/overview-format.test.ts src/lib/projects/create-transform.test.ts
```

For final review include, at minimum:

- API and functional: 200 list/detail, pagination count/sort/search/filters, parameter strictness, malformed ObjectId, 400/401/403/404/503, authorization matrix, agency reparent, role change, budget gated, field-level sanitization, indexes/no-store.
- Cache/privacy: account A → logout → B, stale in-flight promise, expired/revoked token, Back/Forward after logout, cache keys including identity and role, private SSR/hydration boundaries.
- Build: no client imports breaking shared-types barrel `.js` specifiers in Turbopack; distinct source of truth preserved and `list-query.test.ts` verifies enum alignment.
- Browser: real signed-in app on disposable Mongo, step-specific screenshots/URLs, search/filter/sort/page, list→overview→list, logout; empty/error states, 320–1440 widths and 200% zoom, keyboard and reduced motion, EN/SI/TA display. Inspect network payload under restricted role to ensure no budget.
- Performance/reliability: bounded page sizes; query/count consistency; no silent fallback to unscoped data; CLI errors truthfully explained. Do not claim latency targets without measurement.
- Security/operations: no production Atlas/schema change, no leaked secrets, no external auth bypass, no owner changes lost, no unapproved dependencies/services.

Historical committed phase report recorded first `npm run build` **FAIL** due to shared-types barrel import/Turbopack resolution, then fix and **PASS**; full API **294**, web **161**, type-check/build **PASS**, lint **0 errors and 2 pre-existing warnings**. These figures **must not be reused as fresh results**. Report actual commands, outputs and statuses from the current execution.

---

## 11. Mandatory actual project output / browser demonstration

**The project owner specifically requires this after EACH step, and again as one combined journey.** Neither a static mockup nor a screenshot of `next start` preview gate qualifies as working signed-in demonstration.

### Demo infrastructure and evidence rules

1. Preflight: confirm browser automation or actual browser available; isolated Mongo is running and API `/ready` healthy; permitted synthetic test identities and scoped project records exist; real sessions issue legitimately. If not, report exact blocker and give safe setup instructions; do not bypass or modify prod settings.
2. Start processes in separate VS Code/Cursor terminals from the **one project folder**: `npm run dev:api`, `npm run dev:web`. Confirm actual ports from stdout. Test `/login`, `/projects`, real `/projects/{id}/overview`; choose an ID from authorized API/list.
3. After Step **53**: signed-in screenshot(s) of default table, filtered/sorted/paginated results including accurate backend total, and empty/permission state where safe; exact URL including query state, role, anonymized synthetic record and test assertions.
4. After Step **54**: signed-in screenshot(s) of actual project header and overview with real synthetic data; permitted budget and denied-budget view for role comparison; back-link preserving list state; exact URL and API privacy evidence.
5. After both: **one** combined end-to-end walkthrough with real navigation and no unimplemented controls; screenshots at desktop/mobile width as available, evidence of session switch/logout privacy.
6. Save evidence **only** in an approved existing `docs/reviews/steps-53-54/` subfolder or existing artifact location in the canonical repo. Creating ordinary review images/files in that folder is fine; do **not** create an extra repository, worktree or outside `Documents` folder. Ensure files/images are sanitized and do not include real identities, tokens, Atlas URLs, server secrets or sensitive data; never auto-stage them.
7. For each screenshot report the browser/tool used, UTC/local date/time, environment, branch/SHA, route, authorized role, width, project source, and screenshot path. If screenshot unavailable, label **NOT RUN** rather than manufacturing an image.

### Manual owner acceptance walkthrough

1. `cd C:\Users\ASUS\Desktop\InfraOS\InfraOS`; check correct branch and no accidentally discarded changes.
2. Verify per-app `.env` setup privately. Frontend `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000`; enable supported local auth if needed. API uses disposable DB, JWT secrets and matching `FRONTEND_ORIGIN=http://localhost:3000`. Do not expose values.
3. Run `npm run dev:api` and `npm run dev:web` in separate terminals. Visit `http://localhost:4000/ready` and `http://localhost:3000/login`.
4. Log in as synthetic verified Agency Officer / Project Manager with scoped `project.read` and, if demonstrating budget, appropriate `finance.budget.read` permission. Open `http://localhost:3000/projects`.
5. Search by project code, filter by status/type/allowed agency, sort code ascending/descending, set 10 or 20 rows, move pages; confirm backend totals and browser Back/Forward.
6. Click a real project code; note its actual `/projects/{id}/overview` URL. Confirm safe header, agency, dates, description, location/geometry summary, physical progress and permitted budget. Return to filtered list.
7. Repeat as user without budget permission; inspect network response AND page. Try an out-of-scope id; expect privacy-safe not found. Logout and switch staff account; previous account's results must disappear.
8. Capture the working browser images and write PASS/FAIL/BLOCKED evidence. If an isolated verified login is impossible, record operational blocker and stop—do not switch to live Atlas.

---

## 12. Error-handling decisions and regression invariants

| Condition | Backend truth | UI behavior |
|---|---|---|
| Unauthenticated / expired access | 401 / session refresh logic per existing auth | Re-authenticate, never show last actor's records |
| Role denied | 403 | Permission explanation, no restricted data |
| Well-formed missing/out-of-scope project | 404 | Same neutral not-found message, no project code leak |
| Invalid project ID / unsafe query | 400 | Safe inline error or fallback; never send untrusted selector |
| DB unavailable | 503 | Retryable failure, no fabricated empty-success list |
| Network offline | Network error | Distinguish from valid empty data |
| Token/actor changes during request | Discard stale response | Clear/partition cache, do not flash private prior user's content |
| Sorting/filtering changed during query | Latest URL state wins | Correct page count/sort and no stale flash |
| No results in scope | 200 `{projects:[],total:0}` | Clear zero-state vs error distinction |
| Optional budget absent | Field **omitted** | No card; never `LKR 0.00` fallback |
| Null manager/location/date | Safe null | Clear “Not provided” copy |

**Regression boundary:** No changes to `Project.status`, permission catalog, admin users, refresh-token semantics, existing POST/PATCH atomicity, public Connected Future homepage, new unapproved database indexes or services. Only amend source when tied to a specific acceptance failure, with focused test that would fail before the fix.

---

## 13. Required pre-/post-implementation reviews and artifacts

### Pre-implementation review — short and factual

Record: roadmap quote; inspected branch/commit; local dirty/untracked status; which requirements already exist; known differences from the historical review; safety/authority boundary; smallest file/test change set; whether safe disposable browser environment is available; decision **NO CHANGE / REPAIR / BLOCKED**. Keep review compact, not a redundant architecture dossier.

### After Step 53

A concise Step 53 checkpoint (update existing `docs/reviews/step-53/IMPLEMENTATION-STATUS.md` or add a clearly dated addendum) with measured focused checks, any changed files, query/scope and design evidence, browser screenshot(s) + URL, honest blockers; do not replace historical data or claim independent signoff.

### After Step 54

A concise Step 54 checkpoint in the existing review location with live detail DTO/privacy/format/cache proof, screenshot(s) + URL and blockers. No Step 55 implementation.

### One final combined phase review

Use `docs/reviews/steps-53-54/END-OF-PHASE-VERIFICATION.md` as an existing source and add a dated **current verification addendum** (or equivalent approved new report within same review folder) rather than erasing previous results. Include:

- Exact roadmap & commits / worktree state;
- implementation completeness, files modified and reason;
- full commands + exit codes/test counts; API/auth/role/privacy and concurrency matrix;
- actual browser screenshot paths, URLs, roles, viewports and end-to-end narrative;
- accessibility, localization and responsive findings;
- blocked production/Atlas/index/auth issues and older unclosed risks;
- PASS/FAIL/BLOCKED/NOT RUN by criterion; and an overall **APPROVE / REVISE / BLOCKED** recommendation, distinguishing owner approval from agent assessment.

---

## 14. Git instructions — approval gates (commands are proposals only)

**Check first (read-only):**

```powershell
Set-Location 'C:\Users\ASUS\Desktop\InfraOS\InfraOS'
pwd
git status --short --branch
git branch -vv
git log -5 --oneline
git diff --check
git diff --stat
```

When verified work is **already merged and nothing needs fixing**, do not branch or commit merely to repeat Steps 53–54. If a **real remedial change** is needed, propose a shared feature-based branch such as `feature/projecttrace-list-overview-hardening`, **only after** checking whether an appropriate branch already exists and obtaining permission for any branch checkout affecting local state. Prefer local `development` only as an integration source; never implement directly on `main`.

**After explicit approval for safe branch creation only**, from a clean approved integration baseline:

```powershell
# PROPOSAL ONLY — do not execute before owner approval
git switch development
git pull --ff-only origin development
git switch -c feature/projecttrace-list-overview-hardening
```

**After separate approval for exact tracked files to stage/commit**, prepare a narrow `git add -- <actual-file1> <actual-file2> ...` with the reviewed real paths only, NOT `git add .`. Never stage `.env*`, secrets, `Prompts/`, `Steps.docx`, unwanted screenshot dumps, or unrelated work. Review `git diff --cached --check`, `git diff --cached --stat`, `git diff --cached`. Then, with explicit commit approval:

```powershell
# PROPOSAL ONLY
git commit -m "fix(projecttrace): verify scoped listing and project overview"
```

**With additional explicit push and PR approvals (separate actions):**

```powershell
# PROPOSAL ONLY
git push -u origin feature/projecttrace-list-overview-hardening
# Owner-approved PR: feature/projecttrace-list-overview-hardening -> development
# After reviewed PR and separate merge approval: merge into development
# main promotion only after a separately authorized stable release checkpoint
```

If local changes differ from GitHub or there is a dirty `development` worktree, **do not** auto-pull/switch/stash/overwrite to force compliance. Report options and ask owner before destructive or integration actions. No worktree creation. No automatic CI/deployment changes.

---

## 15. Completion gates and next-step handoff

### Step 53 Definition of Done

- [ ] Local code/API uses existing scoped backend and correctly displays REAL authorized projects.
- [ ] Search, status/type/scoped agency filters, sort and server pagination work and persist safely in URLs.
- [ ] Negative auth/tenant/DTO tests pass; no budget/location description leak in list.
- [ ] Real signed-in browser demo and screenshots/URLs recorded, OR a precise **BLOCKED/NOT RUN** rationale without claiming visual acceptance.
- [ ] Focused tests pass, no regression or unnecessary changes, concise checkpoint produced.

### Step 54 Definition of Done

- [ ] Real list-to-overview navigation, reliable detail GET/DTO, safe return path.
- [ ] Field/date/money/geometry formatting correct with missing-data fallback and no invented integrations.
- [ ] Budget server-side authorization, safe manager name, 400/401/403/404/503 and scoped query behavior tested.
- [ ] Account switch/logout clears private data; no token persisted in browser storage.
- [ ] Real signed-in browser screenshots/URL recorded, OR precise **BLOCKED/NOT RUN** rationale; focused tests and checkpoint.

### Combined phase acceptance

- [ ] One full API + web suite, TS checks, lint/build run **after** final fixes; statuses recorded.
- [ ] One combined signed-in desktop/mobile end-to-end demonstration, plus a11y/security/negative-role evidence.
- [ ] No unauthorized Atlas index/schema/seed writes, auth bypass, production changes, or repo/worktree churn.
- [ ] Owner sees a single PASS/FAIL/BLOCKED/NOT RUN matrix and **APPROVE/REVISE/BLOCKED** recommendation.
- [ ] All unverified areas explicitly identified, not overwritten with historical passes.

**Step 55 handoff:** *Edit Project & Validation.* The existing `PATCH /api/v1/projects/:id` supports revision-checked **DRAFT-only** edits of a restricted set of fields; Step 55 must create the full authorized editing UX and validation within its own scope. Do **not** pre-build its edit route or future submission/approval in Steps 53–54. Preserve the Step 53 list-state and Step 54 shared project core query contract for that handoff. Production deployment remains gated by independent decisions about security, Atlas indexes and real browser integration.

---

## 16. Source reference list (checked repository paths)

- Roadmap: [`Prompts/Steps.docx`](https://github.com/divejikan-yuvarajah/InfraOS/blob/development/Prompts/Steps.docx) (exact Step 53–54 headings as confirmed in committed reviews).
- [Committed combined 53–54 review](https://github.com/divejikan-yuvarajah/InfraOS/blob/development/docs/reviews/steps-53-54/END-OF-PHASE-VERIFICATION.md).
- [Step 53 report](https://github.com/divejikan-yuvarajah/InfraOS/blob/development/docs/reviews/step-53/IMPLEMENTATION-STATUS.md) and [Step 54 report](https://github.com/divejikan-yuvarajah/InfraOS/blob/development/docs/reviews/step-54/IMPLEMENTATION-STATUS.md).
- [Project API schema](https://github.com/divejikan-yuvarajah/InfraOS/blob/development/apps/api/src/modules/projects/projects.schema.ts), [router](https://github.com/divejikan-yuvarajah/InfraOS/blob/development/apps/api/src/modules/projects/projects.routes.ts), [service](https://github.com/divejikan-yuvarajah/InfraOS/blob/development/apps/api/src/modules/projects/projects.service.ts).
- [Project UX architecture](https://github.com/divejikan-yuvarajah/InfraOS/blob/development/docs/ux/project-detail-architecture.md), [business rules](https://github.com/divejikan-yuvarajah/InfraOS/blob/development/docs/planning/business-rules.md), [permission matrix](https://github.com/divejikan-yuvarajah/InfraOS/blob/development/docs/security/permission-matrix.md), [design tokens](https://github.com/divejikan-yuvarajah/InfraOS/blob/development/docs/design/brand-color-system.md).

**End of specification. This is a document, NOT evidence that implementation, browser checks or changes were executed during preparation.**
