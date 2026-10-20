# INFRAOS — COMPLETE ENHANCED DEVELOPMENT PROMPT
## Phase 3 · Step 21 of 190 — Advanced Data Table System

**Project:** INFRAOS — National Infrastructure Intelligence & Coordination Platform  
**Vision:** *The Operating System for National Infrastructure*  
**Lifecycle:** Plan → Coordinate → Approve → Build → Verify → Monitor → Complete → Maintain  
**Current authorized step:** **21 ONLY** — Advanced Data Table System  
**Branch:** `feature/step-21-data-table-system`  
**Integration:** reviewed/approved feature PR → `development` → separate approved release checkpoint → `main`  
**Companion file:** `INFRAOS_Cursor_Execution_Prompt_Step_21.md`

> **Source and implementation disclaimer:** This specification is grounded in the user's 190-step INFRAOS roadmap as discussed earlier and the available Step 20 prompt and architecture handover. The original `Steps.docx` is not available in this runtime; do not claim to have quoted unseen Step 21 bullet points. When executing in Cursor, compare the original roadmap and **actual approved repository state** with this file, report any mismatch, and obtain approval before changing scope. A **prompt created** for Steps 19–20 is NOT proof those steps were implemented or merged. The most recent previously verified source state in conversation was `development` at `239671f` after Step 14; it is historical, not a claim about today's HEAD.

---

# 0. Mandatory Agent Role, Execution Contract, and Quality Gates

Act as **Principal React/Next.js/TypeScript Architect, TanStack Table v8 Specialist, shadcn/Radix Design-System Engineer, API Contract Integrator, Accessibility & Security Engineer, QA Engineer, and INFRAOS Git Integration Lead**.

**Goal:** Build one accessible, strongly typed, composable **data-table foundation** that future ProjectTrace, RoadSync, Finance, Contractor, Inspection, Assets, Document, Citizen Issue, Audit, and Admin modules can use for safe lists and grids. Build real functionality, not a visual mockup, but **do not build feature-specific lists or backend routes prematurely**.

**Mandatory work order:**

1. Inspect repository, requirements, exact dependency versions, Git status, prior steps, shared contracts and available test scripts.
2. Write a **pre-implementation review** with a go/no-go dependency decision; do not modify files if prerequisites fail.
3. Create a dedicated safe feature branch based on current approved `development` (after verifying all branch/working-tree conditions).
4. Prepare implementation plan, file list, typed component public API and tests.
5. Implement in incremental batches, testing each batch.
6. Run lint, type-check, tests, build, browser/responsive/a11y checks where feasible.
7. Perform a thorough code, architecture, security and performance **post-implementation review**.
8. Fix all in-scope failures, rerun focused and broad regressions.
9. Review `git diff`, staged/untracked files, docs, dependencies and secrets.
10. Prepare commit/PR notes and an approval-gated merge plan to `development`; verify integration only if approved and actually performed. Leave `main` untouched without separate approval.
11. Produce final evidence-based report and **STOP after Step 21**.

**Unconditional restrictions:**

- Never overwrite teammate-owned work, run blind `git stash`, `git reset --hard`, force checkout/force push, or delete branches.
- Never automatically commit, push, open/merge a remote PR, or merge `development` into `main` without explicit user/team permission.
- Do not manufacture passing tests, screenshots, live API results, or domain integrations.
- Do not weaken TS strictness, blanket-disable ESLint, remove tests to conceal a bug or build a parallel UI framework.
- Do not touch real production agency data, credentials, `.env`, MongoDB records or deployed services just to test tables.
- Do not implement later feature routes, dashboards, search system, notifications, PDF/CSV exports, auth/RBAC logic, AI or GIS work in this step.

---

# 1. INFRAOS Product, Stack, Team, and Design Constraints

INFRAOS is a Sri Lankan academic GovTech platform for multi-agency infrastructure planning, conflict coordination, project accountability and maintenance. The critical RoadSync scenario involves overlapping road-resurfacing and water-pipeline works in **space and schedule**; conflict analysis is deterministic and auditable. Step 21 creates UI infrastructure for later data presentation but **does not compute RoadSync conflicts**.

## 1.1 Approved architecture (verify actual installed repo)

```text
/apps/web            Next.js App Router + React + TypeScript + Tailwind/shadcn
                     TanStack Query (server data), RHF + Zod (forms)
                     TanStack Table (Step 21 table state/row models)
/apps/api            Node.js / Express / TypeScript modular monolith
                     versioned /api/v1, Zod, Mongoose
/packages/shared-types
                     shared serializable response/DTO/enum/permission types
MongoDB Atlas        Mongoose + GeoJSON and 2dsphere indexes
Future services      MapLibre, FastAPI AI, DocTrace/RAG, secure storage
```

**Current-state caveat:** Prior repository inspection showed a frontend foundation, health/readiness API only and Step 12–14 Mongoose models. Steps 15–20 may have been built since then. **Inspect actual code**, routes, packages and Git history; never assume they exist or do not exist from this document.

**Team boundaries:** Lead owns ProjectTrace/RoadSync, architecture/integration/security; other team members own GIS, AI, DocTrace, finance/assets, citizen portal and supporting work. A shared table library can be used by all; do not alter teammates' feature modules without consent.

## 1.2 Required brand palette

| Semantic intent | Exact approved raw color |
|---|---|
| INFRAOS primary accent | Orange `#FF5B00` |
| Pending, warning, review | Yellow `#FEB600` |
| Severe risk/conflict/rejection | Maroon `#8C1F28` |
| Healthy, approved, resolved/completed | Green `#279541` |
| Canvas | `#F8FAFC` |
| Card/table surface | `#FFFFFF` |
| Primary text | `#111827` |
| Secondary text | `#475569` |
| Muted text | `#64748B` |
| Border | `#E2E8F0` |

Use **Step 17 semantic contrast-safe tokens** (not raw orange/yellow/green as ordinary white-surface text), **Step 18 typography/spacing/focus/motion**, **Step 19 table/button/input/select primitives**, **Step 20 form field/filter controls** when relevant. Operational tables must be calm and neutral; use status accents only where meaningful. Do not reintroduce old navy `#0F172A` / old orange `#F97316` as brand.

## 1.3 Non-negotiable authorization model

Displaying a row, hiding a button or filtering by agency in React never grants/denies server access. Future Express routes enforce JWT/session (when implemented), role permissions, agency/resource scope, state transition rules, requested sort/filter allowlists, and response DTO redaction. **Frontend lists are not a security boundary.** Do not invent backend contracts or make UI-only role filters appear authoritative.

---

# 2. Strict Prerequisite and Dependency Gate

Before implementation, confirm in **actual `development` history/code**:

| Prerequisite | Required evidence | Failure action |
|---|---|---|
| Step 16 | Shared API DTO/envelope/pagination conventions or documented current contract | Do not invent incompatible API shapes; report mismatch |
| Step 17 | Approved semantic palette and contrast-safe foregrounds | Block token-dependent implementation; don't recreate palette |
| Step 18 | Typography, spacing, radius, motion and focus tokens | Block or request approved prerequisite fix |
| Step 19 | Base `Table`, `Button`, `Input`, `Select`, `Badge`, `DropdownMenu` if available, plus providers | **Hard gate**: if not approved/in `development`, STOP |
| Step 20 | Reusable RHF/Zod form/validation primitives or documented actual implementation | **Hard gate**: if Step 20 isn't approved/in `development`, STOP |
| Repository | Safe Git tree, package manager, lockfile and meaningful check scripts | Stop if changes would overwrite teammate work |

**Step 21 does not require actual ProjectTrace/RoadSync REST list routes.** Server-mode integration must be via typed client adapter/contracts and synthetic fixture tests until authorized feature endpoints exist.

### 2.1 Required pre-review report template

```text
INFRAOS STEP 21 — PRE-IMPLEMENTATION REVIEW
Date / analyst / workspace path:
Current branch / HEAD commit / origin tracking:
Working tree: tracked / staged / untracked / ownership:
Step 19 merge evidence (PR/commit/files):
Step 20 merge evidence (PR/commit/files):
Step 16 / API contract actual state:
Installed React / Next.js / TypeScript / Tailwind / shadcn:
Installed @tanstack/react-table version or absence:
Installed @tanstack/react-query version:
Existing base Table/buttons/input/select/checkbox/badge:
Existing table-like components and duplicate risks:
Existing pagination/filter/sort URL conventions:
Existing API response envelope/pagination definitions:
Existing tests / browser preview tooling:
Actual baseline lint/types/tests/build outcomes:
Relevant teammate ownership / integration dependencies:
Planned files and implementation batches:
Risks (a11y, security, perf, time, API drift):
Decision: READY / BLOCKED / NEEDS APPROVAL:
```

**No assumptions:** A generated Step 19/20 Markdown prompt is not evidence of implementation. If the dependency is missing, write `BLOCKED` with evidence and **STOP without creating a Step 21 feature branch or editing app files**.

---

# 3. Safe Git Branch & Team Integration Workflow

After verifying `development` reflects Steps 19–20 and there are no unsafe local changes, use actual repository commands (below are templates only):

```bash
git status --short
git branch --show-current
git remote -v
git fetch origin                       # only if approved network operations and remote exists
git switch development                 # do not discard dirty work
git pull --ff-only origin development  # only if remote/tracking is as expected
git switch -c feature/step-21-data-table-system
git rev-parse --short HEAD
```

If the branch already exists, inspect ancestry before reuse. If `git fetch` or pull cannot run, don't claim to be at latest HEAD. Do not force reset, stash or change `main`.

**Suggested commit for reviewer:** `feat(ui): build typed advanced data table foundation`

**PR:** `feature/step-21-data-table-system` → `development`, after human review and explicit approval. If the team's approved Git policy permits the agent to commit/push, request that permission specifically before acting. A separate stable phase/release checkpoint (normally after Steps 17–24) determines `development` → `main`; not part of Step 21.

---

# 4. Definition of Scope and Core Components

## 4.1 Step 21 must create

1. A reusable, type-safe **generic DataTable** built on TanStack Table and the existing Step 19 shadcn semantic Table primitives.
2. A **column-definition convention** for plain text, date, numeric, money, status and row actions (configurable; no hardcoded business schema).
3. **Client-side sorting**, with sort indicators, stable state changes, clearable sorting, and null/invalid handling.
4. **Column filtering** (text, enum/select, numeric/date as practical) plus an optional clear-filters action.
5. **Global search** over explicitly searchable columns in client mode; clear distinction from future Step 140 cross-module global search.
6. **Pagination** with page size, previous/next, first/last (when known), boundaries, row counts and sensible empty/zero case.
7. **Column visibility** and ordered selection if appropriate, while protecting mandatory/structural columns from accidental hiding.
8. **Row selection** with checkbox and selected count as an optional mode. Never execute bulk mutations in this step.
9. **Row action slot** for menu/links, with semantic buttons and accessible labels; no actual approve/reject/delete APIs.
10. **Server-driven mode** supporting controlled sort/filter/search/page state, typed query adapter and `totalCount`/unknown-total distinctions; no backend endpoint creation.
11. **URL query state** optionally shareable for safe, non-sensitive filter/sort/page settings, with validation of incoming query values and predictable back/forward behavior.
12. **Table-local loading, error, retry, empty and no-filter-results states**, lightweight and compositional. The generalized UI state system still belongs to Step 22.
13. **Responsive layout** including horizontal scroll, stable headers, sane row density, and accessible keyboard/screen-reader behavior.
14. **Focused unit/interaction tests**, one synthetic client-mode test harness and one mocked server-mode adapter test.
15. Documentation, usage examples, acceptance checks, pre/post reviews and Git handoff.

## 4.2 Must NOT create

- CRUD projects/contractors/payments/roles, feature data pages, ProjectTrace dashboard or RoadSync conflicts.
- New list endpoint, Mongo query, Express controller or permissions; those are domain roadmap steps.
- Real global search across collections; that's Step 140/141.
- CSV/PDF exporting of project/payment/citizen data; that's Steps 144/145.
- Generalized state-screen library/error boundaries; Step 22.
- Responsive sidebar/topbar/dashboard shell; Step 23.
- Full accessibility certification; Step 24.
- Virtualization or drag-reordering complexity unless established baseline demonstrates the need and user approves scope.
- New analytics charts, GIS layers, websocket notifications, demo government data or server query execution under UI tests.

---

# 5. Recommended Folder Structure (Adapt to Actual Repo)

```text
apps/web/src/components/
  ui/table.tsx                          # existing Step 19 semantic primitives; REUSE
  data-table/
    data-table.tsx                      # generic presentation + optional state orchestration
    data-table-toolbar.tsx              # search / filters / reset controls
    data-table-column-header.tsx        # sort toggle and aria-sort behavior
    data-table-pagination.tsx           # page size, count, navigation
    data-table-view-options.tsx         # visibility selector
    data-table-row-actions.tsx          # generic accessible action render slot
    data-table-empty.tsx                # minimal table-scoped placeholders
    data-table-selection.tsx            # OPTIONAL helper if selection warranted
    data-table.types.ts                 # public generics and adapters
    data-table.utils.ts                 # pure sorting/filter/URL helpers
apps/web/src/lib/data-table/
  query-state.ts                        # OPTIONAL URL parsing, validation, serialization
  use-server-table.ts                   # OPTIONAL typed query adapter, only if needed
apps/web/src/.../__tests__/             # actual existing test convention

# Docs; follow repo directory conventions rather than duplicating:
docs/design/data-table-system.md
docs/design/data-table-usage.md
docs/design/data-table-accessibility.md
docs/design/step-21-review.md
```

**Do not over-generate.** Prefer 5–9 cohesive source files rather than 20 wrappers. Keep base `Table` untouched where already correct; if it requires a narrow compatibility fix, justify explicitly and run Step 19 regression tests. Avoid a giant monolithic `data-table.tsx` that mixes UI, backend transport, feature roles, and dozens of business-specific switch statements.

---

# 6. TypeScript Public API Design

Define a minimal, strongly typed public surface, adapting exact installed TanStack version:

```ts
// Illustrative design only; adapt to actual installed TanStack Table v8 APIs.
import type {
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  RowSelectionState,
} from '@tanstack/react-table';

type DataTableProps<TData, TValue = unknown> = {
  columns: ColumnDef<TData, TValue>[];
  data: readonly TData[];
  getRowId?: (row: TData, index: number) => string;
  mode?: 'client' | 'server';
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  // Choose controlled/uncontrolled model deliberately; avoid duplicate sources of truth.
};

type TableQuery = {
  pageIndex: number;       // 0-based UI internal
  pageSize: number;
  sorting: SortingState;
  filters: ColumnFiltersState;
  search?: string;
};

type TablePage<T> = {
  rows: T[];
  totalCount?: number;    // undefined if unknown; NEVER misstate totals
  // optional nextCursor if existing backend uses cursor paging
};
```

**Guidance:** Types are *examples*, not mandates to overwrite Step 16's actual DTO signatures. Inspect shared contracts before choosing field names, sorting encodings, pagination envelope and error types. Avoid `any`; prefer unknown and narrow. If `ColumnDef<TData, TValue>[]` overly constrains heterogeneous columns in actual TanStack typings, adopt the library's proven generic approach with a documented rationale—do not silence compiler errors with blanket casts.

### 6.1 Generics and stable references

- Use `TData` generics for rows. `TValue` only if useful; don't force one value type on heterogeneous columns.
- Treat `data` as immutable consumer input; avoid mutating server-cached arrays.
- Stable `getRowId` should be explicit for selectable rows; fallback index IDs are **unsafe across sorting/pagination** for bulk state. If selection enabled and no stable ID available, prevent selection or document safe constraint.
- Memoize expensive column definitions/filter option arrays where genuinely necessary; avoid premature `useMemo` everywhere.
- If server mode, keep query state separate from server result payload; guard stale responses.
- Expose data-independent toolbar and pagination subcomponents only if reuse justifies it.
- Avoid default `unknown[]` data leaks to consuming pages.

---

# 7. TanStack Table Engine: Client Mode

Use **actual installed** `@tanstack/react-table` APIs. Install only if absent and approved under the repo's package/lockfile policy. Prefer existing shadcn DataTable conventions, but customize them to INFRAOS tokens/typed needs instead of copying obsolete snippets.

## 7.1 Core row model and state

- `getCoreRowModel()` always; appropriate optional `getSortedRowModel()`, `getFilteredRowModel()`, `getPaginationRowModel()` for client mode.
- Support controlled state and `on...Change` callbacks where appropriate; choose one source of truth.
- In client mode, sorting/filtering/pagination operates on the *full provided row dataset*, not just the visible page.
- Ensure changes to filters/search/page size move to page 0 (unless preserving index is logically safe). Do not let pageIndex remain invalid after data shrinks.
- Handle `0 rows` without arithmetic errors or `Page 1 of 0`.
- Avoid combining global and column filters in a way that searches non-searchable/sensitive fields.

## 7.2 Sorting

- Sort by allowed column only; no sorting of action/selection columns.
- Support ASC → DESC → unsorted if enabled, and display clear visual/ARIA indication.
- Use deterministic handling of `null`, `undefined`, dates, and case-insensitive text based on explicit column data types. Do not mis-sort ISO timestamps by locale-formatted display strings.
- Financial values sort as integer `amountMinor`, not formatted `LKR 12,345.00` strings.
- Stable sort where TanStack/JS semantics allow; test tied values and undefined values.
- Multi-sort only if an actual requirement; document if supported.

## 7.3 Filters and global search

- Client column filters must declare allowed filter UI and matching predicate, not infer capabilities from arbitrary cell JSX.
- Reuse Step 20 Input/Select controls; input labels and search accessible names required.
- Debounce user-entered server search; client search may be immediate for small arrays.
- String filters handle trim/case/unicode carefully; no HTML regex injection from user text.
- Match only opted-in searchable columns. Private IDs, tokens, emails, payment personal details are not searchable by default unless specifically approved/authorized in feature steps.
- Reset filters supports keyboard and clears only table-owned filter state.

## 7.4 Pagination

- Sensible default page size (e.g., 10) and bounded options (e.g., 10/20/50); make them configurable.
- Prevent 0/negative/NaN/huge page sizes from URL or consumer props.
- Disable previous/next appropriately. If row count is 0, show stable human-readable result.
- Distinguish **total rows** vs **filtered rows** vs **page rows**; display truthful counts.
- Keep one internal page-index convention (`0-based`) and document mapping to any backend convention (`1-based`) explicitly.
- Do not render fictional page counts when server `totalCount` is unavailable.

---

# 8. TanStack Table Engine: Server Mode (Adapter/Contracts Only)

**Important:** Most INFRAOS domain routes may not yet exist. Step 21 creates an adapter and tests using **mocked pages**. It must **not** create new API endpoints nor imply that full live querying is implemented.

## 8.1 Server-mode behavior

- `manualPagination`, `manualSorting`, and `manualFiltering` must be set when the server owns those responsibilities.
- Do not call client-side sorting/filter row models on a single server page as if it represented the whole dataset.
- Controlled `pageIndex`, `pageSize`, sort, filters, search and visibility; clear deterministic reset rules.
- Query keys include all data-affecting state (page, page size, sorting, filters, search, authorized scope indirectly via query/session invalidation in future feature adapters).
- Use TanStack Query only through an **optional integration adapter** if actual installed stack and consumer need it. The generic table itself should not own an API fetch or JWT logic.
- Handle loading, retry, errors, stale results and request cancellation when supported; don't show page A's stale rows as page B's confirmed results without a clear design.
- If total count is known, compute page bounds accurately. If unknown, use reliable `hasNextPage` or cursor semantics only when the actual contract provides them; don't guess.

## 8.2 API query contract (planned, not invented)

Look for actual Step 16 `ApiResponse<T>`, pagination fields, sort enums, errors and filters. Document the design mapping:

```text
UI table state               → authorized API query
pageIndex (0 based)           → existing API page convention
pageSize bounded             → existing API limit convention
sorting [{id,desc}]          → allowlisted sort keys/directions
columnFilters                → allowlisted field-specific filters
search string                → allowlisted searchable fields, normalized
response data                 → permitted, sanitized list-row DTOs only
response page metadata       → count/cursor as actually provided
API errors                    → non-sensitive user-facing error/retry state
```

Do not add `/api/v1/projects` / `/api/v1/work-requests` / `/api/v1/payments` or any real domain endpoint. If contracts are ambiguous, prepare an ADR/question and use a **mock test adapter** without inventing production response shapes.

## 8.3 Security requirements for later backend integrations

- Client column definition never authorizes server sort/filter fields.
- Server must validate sort allowlist, field types, max page size and filter operators; don't pass raw MongoDB operators or arbitrary nested JSON.
- Backend must enforce agency/role/resource scope *before* count and page selection, and redact sensitive fields in list DTOs.
- Prevent user enumeration and cross-agency count leakage; pagination totals can be sensitive.
- Never put PII/tokens/secrets in URL query keys, logs, errors or debug panel; URL query-state allowlist is for nonsensitive settings.
- Inactive/disabled actions for unauthorized roles are only visual hints; backend remains enforcement.

---

# 9. Column Definitions, Cell Rendering and Row Actions

## 9.1 Column contract

Offer a **documented column factory or pattern** (avoid massive domain-specific helpers), with semantic examples:

```text
Project code           → text; sortable; avoid truncating critical identifier
Project name           → text; wrap/truncate with accessible full value
Agency                → text; filterable by authorized public code
Status                → semantic StatusBadge from Step 19, label+color
Planned start          → date-only display; stable original sort value
Progress              → 0–100 typed percentage; clear numeric/label
Financial amount      → integer amountMinor in LKR; formatted at UI edge
Actions               → accessible dropdown slot, no embedded business mutation
Selection (optional)  → checkbox with stable row ID, aria-label
```

**All examples must use synthetic data.** Do not create actual project features or infer statuses not present in shared Step 16 enums.

## 9.2 Localization and formatting

- Use `Intl.NumberFormat` with `LKR` and explicit locale handling for display, while preserving integer minor units for sorting and transport.
- Dates: differentiate `YYYY-MM-DD` date-only from ISO instants; avoid timezone shifts from naive `new Date('YYYY-MM-DD')` conversions when users view schedules.
- Avoid formatting/rounding errors in money display (integers for minor units; avoid unsafe large JS integer overflow).
- Align numeric columns for readability, support `font-variant-numeric: tabular-nums`.
- Plan for long Sri Lankan agency names, English/Tamil/Sinhala fallback fonts; don't claim a full i18n implementation.

## 9.3 Row actions and selection

- Use semantic button/menu primitives; a row action must have accessible name such as `Actions for INF-ROAD-001`.
- Action menus may receive caller-supplied action descriptors but **must not** implement real approve/reject/pay/cancel endpoints.
- No row-wide `onClick` if it conflicts with links, selection checkboxes or nested menu controls. Prefer explicit navigation link/action.
- Ensure stable IDs across pages; in server mode selected items on unseen pages require explicit semantics (e.g., current page only vs persistent selection), documented and tested.
- If bulk selection is included, make `Select all on page` different from `Select all matching results`; **do not claim unseen rows are selected**.
- Selection UI must not expose or infer hidden rows.

---

# 10. Column Visibility, Density, and Responsiveness

- Provide a shadcn dropdown/menu to toggle allowed optional columns.
- Essential primary identity/action columns can be fixed visible when justified; never accidentally show inaccessible private fields through a visibility menu.
- Visibility persists only in local component/URL state by default; no backend profile mutation in Step 21.
- Compact/comfortable density can be a documented optional UI setting if simple; do not build a full personalization engine.
- Use Step 18 spacing tokens and mild row-hover/focus, not all-orange tables.
- Keep native table semantics. Horizontal overflow in a **local wrapper** (`overflow-x-auto`) is preferable to a 320px page-wide overflow.
- Maintain header associations, caption/screen-reader labels, no critical data hidden without a way to recover it.
- Sticky headers only if they do not interfere with focus, scrolling, table captions or container stacking. No blanket sticky header assumption.
- Mobile card transformation is not required unless explicit approved design asks for it; separate responsive app shell belongs to Step 23.

---

# 11. Accessibility and Keyboard Behavior

Target WCAG 2.2 AA relevant rules, while documenting limits rather than claiming whole-site certification.

**Semantics:**

- Use `<table>`, `<thead>`, `<tbody>`, `<th scope="col">`, `<td>` where applicable, a descriptive caption or `aria-label`, and correct associations.
- Sortable column trigger is a semantic `<button>` inside `<th>`; apply `aria-sort` to the `<th>` when sorted, not to random nested elements.
- Tab navigation must reach search, filters, sort, pagination, row actions and selection without trapping focus.
- Status cell must contain an explicit label (Pending/Approved/etc.), not color alone.
- Checkbox row selection must have unique accessible label and announce page selection accurately.
- Pagination has accessible controls and current page indication; next/prev disabled correctly.
- A filter/search change announces relevant result changes politely when appropriate, without spamming screen readers on every keystroke.
- Loading indicator/retry should not steal focus; route not found/unavailable must not silently erase table content.
- A visible focus indicator uses Step 17 token choices and remains clear on headers, menu triggers and colored badges.
- `prefers-reduced-motion` honored for transitions.
- High contrast/forced-colors and browser zoom should remain usable; full audit is Step 24.

**Keyboard manual QA:** Tab/Shift+Tab, Enter/Space on sort/menu, Escape closes menus, Arrow keys in Radix dropdown/select, checkbox toggles, pagination using keyboard. If screen reader testing isn't available, report `NOT RUN`; don't infer success solely from unit tests.

---

# 12. Loading, Empty, Error, and Retry States (Table Scoped)

Step 21 must make the table robust under practical list-page conditions **without taking over Step 22**.

- **Initial loading:** table-level placeholder or semantic loading message with stable layout; no fake empty result while loading.
- **Empty dataset:** message `No records available` with caller-provided alternative copy.
- **Filtered empty:** distinct message `No records match these filters` plus clear-filters action.
- **Error:** safe, non-sensitive summary and caller-provided retry callback. Do not display stack traces, token names or raw server errors.
- **Refreshing:** show whether old data is stale vs current; don't silently treat it as newly fetched.
- **Partial/unavailable count:** never render a fabricated total.
- **No HTML injection:** React-escape user-provided cell values; no unsafe HTML from API error messages.
- **Error handling** should be presentational/reusable; general Next error boundaries and standard app states are Step 22.

---

# 13. URL Query State and Search Interaction

This capability is a scoped table feature, **not** a new search service:

- Optional URL synchronization via existing Next.js App Router router/search-param APIs; don't force all tables to write browser history.
- Define an allowlist for `page`, `pageSize`, sorting keys, filter names/values and maybe `search` only where it is non-sensitive.
- Parse invalid values safely (NaN, negative, huge, unknown column, invalid direction, weird unicode). Clamp or default, never crash/loop.
- Avoid URL-update effects that trigger infinite render/router loops or browser history spam. Decide `replace` for typing and `push` only for meaningful navigation when appropriate.
- Use pure serialization/parser functions with unit tests; treat URL as untrusted input.
- On refresh or back/forward, controlled table state should remain consistent with valid parsed URL state.
- Do not put agency private data, payment identity, personal info or authorization tokens into URLs.
- If URL sync is not justified by current primitives, document interface and defer implementation **only with approval** rather than silently omitting an acceptance item.

---

# 14. Performance, Scalability, and Data-Volume Guardrails

- Client-mode tables are for bounded datasets. Explicitly document the threshold and when to choose server mode rather than silently loading thousands of all rows.
- Server-mode pagination, filtering and sorting are the planned strategy for large nationwide datasets and multi-agency audit lists.
- Avoid expensive per-cell work on every render; format with memoized/inexpensive helpers where justified. Do not over-engineer virtualization.
- `data`/`columns` identity changes must not trigger unnecessary infinite rerenders.
- Debounce server search, cancel/stale-guard requests through established query client when adapter uses it.
- Don't send a request for each keystroke when server mode is configured; test debounce behavior.
- Never fetch unauthorized fields 'for convenience' and hide them in the frontend; request only authorized list DTOs later.
- With slow/failed mock responses, verify that old result metadata isn't presented as accurate for new filters.
- If sorting/filtering 10k synthetic rows is slow, document measured benchmark and propose future optimization; don't fabricate benchmark numbers.

---

# 15. Backend/API Integration Contract: No Premature Endpoints

Step 21 is mainly frontend. **Inspect the actual backend and Step 16 API shape but don't add endpoints**.

If an existing authorized list route has already been independently implemented, allow a tiny opt-in **adapter example** only after code review and explicit scope approval. Otherwise use:

```text
Synthetic typed rows
  → Client-mode DataTable integration fixture

Mocked paging/filter/sort adapter + delayed promises
  → controlled server-mode table integration fixture
```

**Future domain service contract checklist (documentation only):**

1. Validate query DTO (page/limit/filter/sort/search) with Zod on server.
2. Explicit allowlisted sort/filter fields per domain.
3. Enforce caller agency and resource access in backend query before counting.
4. Filter sensitive DTO fields server-side, not merely hide a column.
5. Cap page size and apply stable deterministic tie-break sorting.
6. Return stable pagination metadata and safe errors using actual `/api/v1` envelope.
7. Keep read DTO separate from Mongoose Document (`_id`, Decimal128, internal fields).
8. Index queries as appropriate in later module steps, not now.
9. Test IDOR and cross-agency enumeration when real endpoints exist.

**Do not implement these endpoints or Mongo queries now.** This is a contract readiness checklist only.

---

# 16. Detailed Implementation Batches and Micro-Tasks

## Batch A — Preflight, existing components, and types

A1. Inspect Step 19 base table; preserve its semantic HTML and styles.  
A2. Inspect Step 20 search/select controls.  
A3. Inspect installed TanStack Table version, usage and docs/API.  
A4. Define `DataTable` typed prop contract, exact state ownership and stable row ID policy.  
A5. Decide whether to expose separate client/server wrappers or one explicit mode prop, with reasons.  
A6. Document sorting/filtering/pagination adapter conversion against actual Step 16 types.  
A7. Write first type/build smoke test and API usage example using synthetic project-like records.  
A8. Run focused tests before continuing.

**Batch A gate:** no duplicate base table, correct TS generics, no existing-component regressions.

## Batch B — Core render, sorting and accessibility

B1. Compose TanStack row model with Step 19 `<Table>` primitives.  
B2. Render header, rows, cells with `flexRender` and stable keys.  
B3. Implement typed sort toggle; permit disabling sorting per column.  
B4. Show sort direction and `aria-sort` on proper headers.  
B5. Handle nulls, dates, money and un-sortable action columns.  
B6. Keyboard test and a11y static tests; inspect focus.  
B7. Run focused type/lint/tests.

**Batch B gate:** type-safe generic table and accessible sort controls.

## Batch C — Filters, search and pagination

C1. Implement allowed text/enum column filter controls using Step 20 primitives.  
C2. Implement optional global search only over opted-in columns.  
C3. Add reset/clear filters action.  
C4. Build page-size control, next/prev and known-total first/last navigation.  
C5. Reset invalid page index on search/filter changes and shrinkage.  
C6. Handle zero results and filter-empty states.  
C7. Test query changes, counts, empty and boundary scenarios.

**Batch C gate:** client-mode table works on a synthetic in-memory dataset with sorting/filter/search/page features and no backend calls.

## Batch D — Visibility, row actions and selection

D1. Add visible-column toggle using existing menu primitives.  
D2. Define non-toggleable columns where required.  
D3. Provide accessible typed row-action slot (not domain mutations).  
D4. Add optional selection with stable IDs, select-all-on-visible-page semantics.  
D5. Show correct counts and preserve selection state per documented mode.  
D6. Verify keyboard, screen-reader labels, nested-button correctness.  
D7. Test state changes and accessibility.

**Batch D gate:** no accidental selection of unseen server rows, no UI authorization claims.

## Batch E — Server mode & optional URL sync

E1. Implement controlled `manualPagination`/`manualSorting`/`manualFiltering` server mode.  
E2. Create a typed mock result adapter (not live domain endpoint).  
E3. Implement accurate known/unknown total handling.  
E4. Ensure manual server mode doesn't apply client row-model transformations to one page.  
E5. Add query adapter/decoration suitable for later TanStack Query consumers.  
E6. Ensure debounce/request race handling with tests.  
E7. Add optional safe URL serializer/parser and back-forward tests.  
E8. Validate all query arguments and state transitions.  
E9. Test offline/error/loading/retry and stale data with mocks.

**Batch E gate:** paged mock response is displayed accurately, stale queries aren't misrepresented, URL input cannot crash table.

## Batch F — Docs, security, visual QA, regression

F1. Document all public props, client vs server usage and examples.  
F2. Document typed column patterns, date and `amountMinor` formatting, row action semantics.  
F3. Document future backend allowlists and resource scope requirements.  
F4. Run focused tests and baseline regression.  
F5. Inspect 320/375/768/1280px widths, keyboard-only, high-zoom and browser console as available.  
F6. Inspect contrast, focus, status labels and table role semantics.  
F7. Conduct independent code-review style pass, fix and retest.  
F8. Complete step-review report and Git handoff.

**Batch F gate:** no Step 22/23 or feature-module work leaked into Step 21; verified tests and docs ready.

---

# 17. Detailed Test Matrix

Use current repo test setup. Prefer Vitest/Jest + Testing Library/user-event + Playwright/axe **only if present or justified**. No unnecessary new broad testing framework.

## 17.1 Unit and component tests

| Test ID | Required behavior |
|---|---|
| DT-01 | Generic typed rows/columns compile without `any` or disabled strictness |
| DT-02 | Headers, data cells, caption/labels render semantic table |
| DT-03 | Sort ASC/DESC/clear updates order and aria-sort correctly |
| DT-04 | Sorting null/missing values/dates and `amountMinor` works |
| DT-05 | Sorting disabled for action/selection columns |
| DT-06 | Text/enum filter works; clear resets; global searches only allowed columns |
| DT-07 | Filter and page size changes reset/clamp page index |
| DT-08 | Zero rows/zero filtered rows render distinct outcomes |
| DT-09 | Page navigation boundaries and bounded page size |
| DT-10 | Column visibility cannot conceal required columns via toggle |
| DT-11 | Row action labels and keyboard open/close |
| DT-12 | Stable IDs/checkbox selection and page-only select-all |
| DT-13 | Server sorting/filtering/pagination is manually delegated, not double applied |
| DT-14 | Known count vs unknown count UI is truthful |
| DT-15 | Slow response A after response B is ignored or correctly keyed |
| DT-16 | Debounced server search doesn't spam requests |
| DT-17 | Loading/error/retry and safe error text handling |
| DT-18 | Malformed URL state clamps/rejects without crashes/loops |
| DT-19 | Back/forward URL restoration matches table state (if implemented) |
| DT-20 | No PII/raw secrets included in URL or logged in test fixture |
| DT-21 | Long project names/agency names and numeric cells remain accessible |
| DT-22 | Existing Step 17–20 component/regression tests still pass |

## 17.2 Integration and future-contract tests

- Mocked server adapter verifies `pageIndex` conversion, limit bounds, allowlisted sorting and stable row keys.
- Verify unauthorized columns are never included by a *test fixture's* explicit DTO policy; do not pretend backend authorization was tested without a backend route.
- Verify no network calls occur in client-only table tests.
- If TanStack Query adapter exists, query key changes with filters/sort/page and avoids stale display.
- Verify use of dates and integer-money data isn't changed in transport objects by formatting.

## 17.3 Visual/manual a11y

- Table at 320px, 375px, 768px and 1280px; no page-wide horizontal overflow.
- Keyboard Tab, Shift+Tab, Enter, Space, Esc and menus; visible focus.
- Sort direction announced via `<th aria-sort>`; labels present.
- Screen-reader/axe check if tooling available. Mark `NOT RUN` rather than inventing.
- Text contrast and status badge semantic labels verified under approved theme.
- Zoom to 200%/400% when available; no unrecoverable hidden controls.
- Reduced-motion preference, hover/focus states; no excessive animations.
- Browser console/hydration warnings and app build issues.

## 17.4 Command matrix

Discover package manager and actual package names/scripts, then run applicable commands. Examples **not guaranteed to exist**:

```bash
npm run lint --workspace apps/web
npm run type-check --workspace apps/web
npm run test --workspace apps/web
npm run build --workspace apps/web
# plus root workspace checks if scripts exist
npm run lint
npm run type-check
npm run test
npm run build
```

Use pnpm/yarn/bun if chosen in repo, don't switch managers. If one script is absent: `NOT AVAILABLE`, not `PASS`. If script fails: `FAIL` with actual reason and comparison to baseline. Record exact commands, exit codes and outputs summaries.

---

# 18. Acceptance Criteria — Must Actually Be Verified

Use `PASS` / `FAIL` / `BLOCKED` / `NOT RUN` for every relevant item:

- [ ] Read actual repo + roadmap + approved Steps 16–20 code/docs and produced written pre-review.
- [ ] Step 20 really integrated into latest approved `development`; Step 19 primitives available.
- [ ] Dedicated branch based on the correct integration HEAD; teammates' work safe.
- [ ] Existing shadcn Table/Input/Select/Button/etc. reused, no competing design system.
- [ ] Generic TanStack Table strongly typed; no codegen of domain business table pages.
- [ ] Real client-side sorting, typed filtering, opted-in search and paginated rows.
- [ ] Useful clear/reset controls; zero rows vs filtered empty distinguishable.
- [ ] Optional typed row selection and actions documented, keyboard accessible.
- [ ] Column visibility controlled safely; mandatory columns handled deliberately.
- [ ] Controlled manual server mode with accurate known/unknown count semantics.
- [ ] Mocked paginated adapter tested; no new API endpoint or DB mutation.
- [ ] Query state safely parsed/serialized if enabled; sensitive values never in URL.
- [ ] Correct stable row IDs; no accidental page-crossing selection or action.
- [ ] `LKR` minor units sort numerically and format without mutating actual values.
- [ ] Dates preserve date-only vs timestamp distinctions in sorting/display.
- [ ] Honest table-local loading/error/empty/retry states; no false success data.
- [ ] Keyboard sort/filter/pagination/selection/actions; `aria-sort` correct.
- [ ] Mobile scroll containment, readable data density, tokens, focus and contrast.
- [ ] Security review: no `dangerouslySetInnerHTML`, client-only RBAC, auth bypass or secrets.
- [ ] No Step 22 state framework, Step 23 shell, real CRUD/search/export/dashboard implementation.
- [ ] Focused tests, lint, types and build run with recorded evidence and no unacknowledged blockers.
- [ ] Post-review performed, fixes applied and tests re-run.
- [ ] Docs, usage examples, API integration readiness, Git diff/status reviewed.
- [ ] Commit/PR handoff prepared; unapproved commit/push/merge/main actions not performed.
- [ ] STOP after Step 21.

**Definition of Done:** Step 21 is `COMPLETE` only when core component behavior, typed contracts, interaction/accessibility checks, meaningful tests and build are verified. Missing prerequisites or critical unresolved regression ⇒ `BLOCKED` / `PARTIAL`, never false `COMPLETE`.

---

# 19. Mandatory Post-Implementation Review — Filled with Actual Evidence

```text
INFRAOS STEP 21 — POST-IMPLEMENTATION REVIEW

Git state and safety:
  Feature branch / base development HEAD:
  Working tree / staged / untracked files:
  Unexpected team-owned files / dependencies:

Architecture and compatibility:
  Step 19 semantic primitives reused:
  Step 20 controls reused:
  TanStack version and use of core/optional row models:
  Client mode data/sort/filter/pagination behavior:
  Server manual mode and API contract adapter behavior:
  URL state approach / safety / back-forward:
  Stable row ID and selected-row policy:
  TypeScript generics / server-client boundaries:

Data integrity / security:
  Backend scope/RBAC remains authoritative:
  No real API/endpoints, DB access or secrets:
  Sort/filter allowlist policy documented:
  Sensitive columns/URLs and safe error handling:
  LKR minor-unit precision and date-only behavior:

Accessibility / UI:
  Header/table semantic HTML, aria-sort, labels:
  Keyboard sort/filter/pagination/actions/selection:
  Focus indicators, contrast and status labels:
  Mobile widths / overflow / zoom:
  Loading / error / empty / retry:

Validation:
  Focused unit/interaction test results:
  Web lint:
  Web typecheck:
  Web test:
  Web build:
  Root regression:
  Browser QA:
  Existing Step 17–20 regression:
  Baseline defects vs introduced defects:

Review findings:
  Bugs found:
  Fixes applied:
  Tests re-run and outcomes:
  Remaining limitations:
  Any deferred features with approval:

Documentation and delivery:
  New/changed files:
  Dependency/lockfile changes:
  Documentation updated:
  git diff --check / diff stat:
  Suggested commit:
  PR target = development:
  Post-merge check commands:
  main status (unchanged until release approval):
  Next authorized step: NONE until user approval
```

If tests detect issues, actually perform a **fix → re-review → re-test** loop. A report alone is not implementation.

---

# 20. Git Diff, Review, Commit Proposal, and Integration Verification

### 20.1 Before any authorized commit

```bash
git status --short
git diff --check
git diff --stat
git diff --name-only
git diff --cached --stat
# Inspect untracked files separately; git diff does not show them.
```

**Review all changed file paths**, `package.json`, lockfile, components, tests, docs, and generated assets. Confirm none are unrelated feature modules, `.env`, secrets, uploaded user documents or demo database resets. Stage only reviewed files when explicitly allowed. Avoid `git add .` if unrelated prompts or teammate files are present.

### 20.2 Suggested human-approved commit and PR

```text
Commit: feat(ui): build typed advanced data table foundation
PR: Step 21 — Advanced INFRAOS Data Table System
Base: development
Compare: feature/step-21-data-table-system
```

PR body must include scope, exact exports and file paths, installed TanStack version, test evidence, browser/a11y results, API mock/server adapter behavior, limitations, **confirmation no backend/domain endpoints were created**, and affected peer modules.

### 20.3 Post-merge verification (only after authorized merge)

- Verify Step 21 merge commit/PR actually appears on `development`.
- Re-run frontend lint, type-check, component tests, build; broaden as repo scripts permit.
- Confirm Step 17–20 design tokens/forms/base table remain stable.
- Confirm no unexpectedly changed API model/contract or domain route.
- Perform table keyboard/viewport smoke test where available.
- Report verified integration status; do not claim `main` was released.
- Leave `main` unchanged unless the team explicitly approves a stable release checkpoint (normally after Phase 3, Steps 17–24).

---

# 21. Deliverable Files and Documentation

At minimum, deliver the following, adapted to real repo conventions:

```text
One typed generic DataTable component and reusable subcomponents
Client-mode sortable/filterable/paginated example with synthetic data
Mocked server-mode adapter and tests for controlled table state
Focused table interaction/type/URL/security tests
Documented public API, use cases and anti-patterns
A11y/visual check protocol/results
No new backend/DB endpoints
Documented Git review + handoff
```

Suggested documentation structure (reuse existing files where present):

- `docs/design/data-table-system.md` — architecture, props, states, client/server decision.
- `docs/design/data-table-usage.md` — examples, typed columns, ID/date/money formatting, role/agency-safe future integration.
- `docs/design/data-table-accessibility.md` — keyboard, `aria-sort`, focus, scroll, zoom, responsive.
- `docs/design/step-21-review.md` — written pre/post reviews, actual test results and Git handoff.

**Keep documentation source-of-truth compact:** If the repository already contains a design-system guide, extend and link it rather than cloning it in every directory.

---

# 22. Final Agent Output Template

```text
INFRAOS STEP 21 — IMPLEMENTATION FINAL REPORT

STATUS: COMPLETE / PARTIAL / BLOCKED
Reason and missing prerequisites if not COMPLETE:

GIT BASE / HEAD / REMOTE STATUS:
FEATURE BRANCH: feature/step-21-data-table-system
STARTING WORKTREE SAFETY:
PREREQUISITE VERIFICATION (Steps 19 and 20):

ACTUAL IMPLEMENTATION:
- Components exported:
- Client-mode supported features:
- Server-mode/manual adapter:
- Sorting/filter/search/pagination:
- Column visibility / selection / row action policy:
- URL state implemented / not implemented / approved deferral:
- Table-local loading/error/empty/retry behavior:

ARCHITECTURE AND SECURITY:
- Step 17/18 tokens, Step 19/20 primitives reuse:
- TanStack version:
- Step 16 API contract compatibility:
- Backend auth/RBAC boundary retained:
- Dates, LKR money and sensitive field protection:

TEST EVIDENCE (each actual command + PASS/FAIL/NOT RUN):
- baseline / focused / integration / web lint / web types / web test / web build / root regression / visual keyboard QA:

BUGS FOUND AND FIXED:
LIMITATIONS / DEFERRED WITH APPROVAL:
FILES / DEPENDENCIES / DOCS CHANGED:
GIT DIFF STATUS:
SUGGESTED COMMIT: feat(ui): build typed advanced data table foundation
PR TARGET: development (approval-gated)
POST-MERGE VERIFICATION PLAN:
main RELEASE: NOT PERFORMED
NEXT ROADMAP STEP: Step 22 (NOT STARTED)

STOP.
```

---

# 23. Scope Firewall and Stop Rule

Step 21 ends with a reusable, tested, documented **Advanced Data Table System**, safe for future authorized feature integration. It is **not** complete nationwide project listing, active agency filtering in backend, payment exports, GIS table synchronization or role administration. The next recommended group is **Steps 22–23**, but it must be requested separately and each step reviewed individually.

**STOP after Step 21. Wait for explicit user/team permission for commit/push/merge and for proceeding to the next roadmap step.**
