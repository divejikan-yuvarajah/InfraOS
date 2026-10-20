# INFRAOS — Complete Enhanced Development Prompts
## Phase 3 · Steps 22–23: UI Feedback/Async States → Responsive Application Shell

**Project:** INFRAOS — National Infrastructure Intelligence & Coordination Platform  
**Vision:** *The Operating System for National Infrastructure*  
**Lifecycle:** Plan → Coordinate → Approve → Build → Verify → Monitor → Complete → Maintain  
**Roadmap grouping:** Step **22** + Step **23** in one development specification, but **two independent implementation gates and feature branches**.  
**Next step (out of scope):** Step 24 — Accessibility Foundation.  
**Companion:** `INFRAOS_Cursor_Execution_Prompts_Steps_22_to_23.md`

> **Source caveat:** This specification follows the Step 22/23 scope previously established in the conversation: **Loading, Empty, Error & Success States**, followed by a **Responsive Application Shell**. The original `Steps.docx` is not available in the current file set. At execution, read the actual canonical roadmap and approved architecture documents, report any mismatch, and reconcile scope with the user before changing code. Previous Markdown prompts existing does **not** establish that their implementations were merged.

---

# 0. EXECUTION CONTRACT, ORDER, AND NON-NEGOTIABLE RULES

You are the **INFRAOS Principal Next.js/React/TypeScript Frontend Architect, shadcn/Radix Design-System Engineer, Responsive UX Designer, Accessibility Engineer, API Integration and Security Reviewer, Quality Engineer and Git Integration Lead**.

**Step-by-step order:**

1. Inspect actual repository, Git, previous implementations and approved documentation.
2. Verify Step 21 is merged/reviewed in `development` before Step 22. Verify Steps 16–20 dependencies as used.
3. Complete **Step 22 only** on `feature/step-22-ui-feedback-states`.
4. Review code/security/accessibility, run tests, fix and retest, document and prepare a reviewed PR to `development`.
5. **STOP** until the user/team authorizes the Step 22 commit/PR/merge and actual integration is confirmed.
6. Reinspect updated `development`; complete **Step 23 only** on `feature/step-23-responsive-app-shell`.
7. Review, test, fix/retest, document and prepare a reviewed PR to `development`; STOP for approval.
8. After both separate approvals and integrations, run combined regression and report Step 24 readiness. **Do not implement Step 24.**

**Never** force-push, reset hard, stash unowned files, overwrite untracked `Prompts/` files, auto-commit, auto-push, auto-merge, silently change `main`, modify deployments/secrets or invent successful tests. Only execute commits and remote operations when specifically authorized. Preserve any shared-files ownership and no unrelated changes.

**Quality language:** every check must be recorded as `PASS`, `FAIL`, `NOT RUN` or `N/A` with commands/evidence. `NO REGRESSION` is a conclusion only after actual tests.

---

# 1. PRODUCT, ARCHITECTURE, AND DESIGN BASELINE

INFRAOS is a Sri Lankan university GovTech platform integrating:

- **Platform/Identity** and role/agency/resource authorization.
- **ProjectTrace**: projects, milestones, progress and official state transitions.
- **RoadSync**: deterministic geospatial + time-window overlapping infrastructure work and cross-agency coordination. Not LLM-dependent.
- **InfraMap**: MapLibre/OSM geospatial visualization.
- **AI Risk**, **DocTrace/RAG**, **Finance/Contractors**, **Inspections**, **Assets/Maintenance**, **Citizen Portal/Issues**, **Notifications**, **Reporting**, and **Audit/Governance**.

**Main scenario:** synthetic road resurfacing overlaps spatially and temporally with planned water-pipeline work → future deterministic RoadSync conflict → agency coordination → project tracking/verification → asset and maintenance.

## 1.1 Locked stack; inspect actual versions

```text
apps/web:       Next.js App Router + React + TypeScript
                Tailwind CSS + shadcn/ui/Radix
                React Hook Form + Zod (Step 20)
                TanStack Query, TanStack Table (Step 21)
apps/api:       Express TypeScript modular monolith, REST /api/v1
packages/:     @infraos/shared-types or actual repo package
MongoDB Atlas:  Mongoose 8, GeoJSON, 2dsphere (earlier schema/index steps)
Future:         MapLibre/OSM, FastAPI AI, document storage, notifications
```

Earlier inspected repository had Next.js 16 / React 19 and an API with only health/readiness routes after Step 14. **That is historical**, not an assertion about the latest checkout. Verify actual versions/files/routes/scripts before editing. Preserve existing middleware, packages and App Router boundaries.

## 1.2 Approved palette and contrast

| Role | Approved raw value | Usage | Accessibility note |
|---|---|---|---|
| Orange | `#FF5B00` | Primary/selection | Use approved accessible foreground aliases, not white normal-size text by default |
| Yellow | `#FEB600` | Pending/warning | Not suitable as body text directly on white |
| Maroon | `#8C1F28` | Critical/error/rejected | Critical text/background through semantic tokens |
| Green | `#279541` | Success/approved/resolved | Use contrast-safe derived variants |
| Canvas | `#F8FAFC` | App backdrop | Light-first enterprise |
| Surface | `#FFFFFF` | Cards/panels/dialogs | Neutral-first |
| Primary text | `#111827` | Labels/body/headers | High contrast |
| Secondary text | `#475569` | Secondary copy | Legible |
| Muted text | `#64748B` | Metadata | Not essential error text if contrast fails |
| Border | `#E2E8F0` | Delineation | Stronger token as required for interactive boundaries |

Use **actual Step 17 semantic tokens** and **Step 18 typography, spacing, radius, z-index, focus, and motion**. Avoid a rainbow dashboard or flag-shaped visuals. Respect reduced motion. Do not reconstruct design tokens as a parallel framework.

## 1.3 Existing components to reuse

- Step 19: Card, Button, Badge, Table base, Dialog, Sheet/Drawer, Tabs, Alert, Tooltip, Toast, and compatible supporting primitives.
- Step 20: typed accessible form controls, form validation, submission handling.
- Step 21: generic typed TanStack data tables including **table-local** loading/error/empty states. Step 22 provides reusable **cross-application** presentation/state primitives; **do not replace working table-local behavior**.
- Step 16: API status/error DTO and envelope contracts (where implemented). Do not invent incompatible transport envelopes.

A prior spec file is not completion evidence; inspect code/merged commit, real exports and test outcomes.

## 1.4 Security and public/private boundaries

- **Backend** is the sole authority for JWT/session, RBAC, agency membership, resource assignment, IDOR protection and state transitions when those features exist.
- A status illustration, disabled action, hidden nav link or client-side route guard is **never** an authorization boundary.
- Don't reveal private project names, agencies, document titles, financial amounts or internal routes in public states or navigation.
- Do not fabricate production API data, toast successes, government integrations, audit logs or real government project records.
- **No authentication implementation** now: Steps 35–50 are later. Step 23 may establish **future-ready interface seams**, not a fake login/session system.

---

# 2. PRE-STEP DISCOVERY: COMMON REPOSITORY AUDIT

Inspect actual files as applicable:

```text
package.json / workspace config / lockfile
apps/web/package.json
apps/web/src/app/layout.tsx
apps/web/src/app/globals.css
apps/web/src/app/**/layout.tsx
apps/web/src/app/**/loading.tsx
apps/web/src/app/**/error.tsx
apps/web/src/app/**/not-found.tsx
apps/web/src/components/ui/*
apps/web/src/components/common/*
apps/web/src/components/layout/*
apps/web/src/lib/*
apps/web/src/hooks/*
apps/web/src/providers/*
apps/web/components.json
apps/web/tailwind.config.* or CSS-first Tailwind files
packages/shared-types/*
Prompts/* and approved docs/design, docs/architecture, docs/security,
docs/ux, docs/team, docs/adr, docs/api, docs/database
```

Also inspect real routes/navigation links and status enums; do not assume all 190 roadmap features exist. Check `AGENTS.md`, `.cursor/rules/`, contributor instructions, team ownership, current branches and open work. **Preserve untracked prompt docs.**

Git diagnostics (read-only first):

```bash
git status --short
git branch --show-current
git remote -v
git branch -a
git log --oneline -n 12
git diff --check
```

Run baseline scripts actually present: web lint/typecheck/test/build and relevant root checks; record `NOT AVAILABLE` for absent scripts and `NOT RUN` for unavailable browser/CI. Identify any preexisting errors separately.

---

# PART A — STEP 22: LOADING, EMPTY, ERROR & SUCCESS STATES

**Branch:** `feature/step-22-ui-feedback-states`  
**Dependency gate:** Step 21 (and required Steps 16–20 foundations) approved and actually in `development`.  
**Target:** reviewed/approved PR into `development`.  
**Scope:** cross-application **presentation and reusable async feedback primitives**, not full app flows.

## 3. Step 22 objective and user experience

Operators must never confuse:

- **Initial loading** vs **refreshing** vs **submitting**.
- **Zero records** vs **no filter matches** vs **permission denied** vs **server/network failure**.
- **Temporary connection errors** vs **permanent `NOT_FOUND`** vs **expected validation errors**.
- **Saved successfully** vs **request merely sent** vs **action awaiting approval**.

Build accessible, predictable states for page sections, cards, lists and future API-backed views. Avoid replacing all content with spinners during refetch; preserve useful prior content and show an unobtrusive updating indicator where appropriate.

## 3.1 Step 22 pre-implementation review template

```text
STEP 22 — PRE-IMPLEMENTATION REVIEW
Repo root/current branch/base SHA/working tree/untracked docs:
Step 21 merged? Commit/PR/code evidence:
Steps 17–20 available? Real tokens/components/contexts:
Actual Next.js/React/Tailwind/shadcn versions:
Existing skeletons, alerts, async boundaries, error pages/toasts:
TanStack Query version, query defaults and mutation patterns:
Step 16 error/envelope/DTO contract evidence:
Existing test runner and browser/manual QA capability:
Existing component accessibility/contrast issues:
Known ownership/conflicts and blockers:
Proposed Step 22 exact files, components, tests:
Scope exclusions + error mapping plan:
Go / No Go:
```

If Step 21 isn't integrated or essential UI primitives are missing, **stop**, report blocker and request approval. Do not silently implement Step 19–21 again.

## 3.2 Branch creation safety

After checking branch, clean tree, remotes and permission:

```bash
git switch development
git pull --ff-only origin development
git switch -c feature/step-22-ui-feedback-states
git rev-parse --short HEAD
```

If no `origin`, no branch, existing local feature branch or unrelated dirty work, **inspect rather than force/reset/stash**. Do not create a branch unless the dependency gate passed. Preserve untracked `Prompts/` and teammate-owned assets.

## 3.3 Architecture and proposed components

Adapt paths to existing folder conventions; don't create duplicate shadcn primitives:

```text
apps/web/src/components/feedback/
  feedback-state.tsx        # optional shared layout for icon/title/description/actions
  loading-state.tsx         # labeled spinner/compact loading feedback
  content-skeleton.tsx     # page section, card or list skeletal structures
  empty-state.tsx          # true empty and no-results variants
  error-state.tsx          # recoverable, unavailable, unavailable/denied variants
  success-state.tsx        # action/operation acknowledged, optional CTA
  async-content.tsx        # optional small typed composition, not giant state machine
apps/web/src/lib/api/
  error-presentation.ts     # ONLY if canonical client/API error mapping needs a pure adapter
docs/design/
  feedback-and-async-states.md
  step-22-review.md
```

Actual directory/filenames may differ. Keep shared components **presentation-focused**, with caller-supplied callbacks, labels, data and typed state information. Never import Mongoose, Express, private JWT tokens or privileged dataset. Server-compatible components should not use `use client` merely because a sibling needs event handlers. Client wrappers remain narrow.

## 3.4 Typed state vocabulary and boundaries

Define a stable **visual state taxonomy** (not new backend enums):

```ts
// Illustrative only. Reuse real repo types/style.
type AsyncViewState =
  | { kind: 'loading'; label?: string }
  | { kind: 'empty'; title: string; description?: string }
  | { kind: 'no-results'; title: string; description?: string }
  | { kind: 'error'; title: string; description?: string; retry?: () => void }
  | { kind: 'success'; title: string; description?: string }
  | { kind: 'content' };
```

Do **not** implement a global mandatory wrapper that forces all pages to carry union state. If one `AsyncContent` helper makes usage simpler, it must be *optional*, explicit and testable; no hidden fetches/effects. ProjectTrace/RoadSync feature-specific use belongs to their later roadmap steps.

## 3.5 Loading states — requirements

**Required forms:**

1. Lightweight spinner or progress indicator for known indeterminate waits, with an accessible visible/ARIA label where meaningful.
2. Skeleton placeholders for `Card` details and generic page/list sections, respecting Step 18 spacing. Exact shapes may be generic; avoid pretending content is available.
3. Inline updating/refetch indicator that **does not wipe existing results**.
4. Form submit loading state reuses Step 20 `isSubmitting` and Step 19 Button semantics (no double submits); **do not rebuild form system**.
5. Table-specific state may reuse Step 21; add adapters/example, not a replacement data grid.

**Behavior:**

- Pending status must be tied to actual caller state, not arbitrary animation timers.
- Avoid layout shift; placeholder geometry should approximate content, without large fake blocks.
- Make skeletons decorative to screen readers (`aria-hidden`) and give region an accessible loading announcement (`aria-busy`/meaningful text) without repeated announcement spam.
- Keep focus stable and remove `aria-busy` once data is ready.
- Respect `prefers-reduced-motion`; pulse shimmer must be subtle/disabled when reduced motion applies.
- No full-screen overlay for normal background refetches.
- Critical action waits may use an explicit progress label; do not claim indefinite operations completed.

## 3.6 Empty vs no-results states

| State | Condition | UI treatment | Action |
|---|---|---|---|
| Empty dataset | Successful fetch, no records at all | Neutral icon/title, short explanation | Optional caller-supplied create CTA if authorized and route truly exists |
| Filtered no-results | Dataset/query applied, zero matches | Say "No matching results" | Optional clear-filters callback from caller |
| Not yet configured | Feature/configuration absent | Neutral setup message | Link only to existing authorized configuration route |
| No access | Authoritative API returns forbidden | Generic "You do not have access" | Optional navigate/back; never disclose confidential existence/details |
| Not found | Genuine 404 or unavailable record | Neutral, privacy-safe text | Optional back action; Step 161 owns dedicated route-level pages |

Never infer a resource does not exist simply because the client returned an empty list; distinguish `204`/empty payload/error contracts correctly per actual API. Do not add mock "Create Project" actions targeting non-existent routes.

## 3.7 Error presentation and API integration

If a typed API client/error adapter exists, consume it. If not, create only a thin, local **presentation adapter** supported by actual Step 16 response/error shape; if mismatch report it. States should distinguish:

- Network/offline/timeout: retry when appropriate.
- 429 rate limit: neutral feedback, optional server-provided retry guidance only when validated.
- 400/422 field validation: **Step 20 form messages** retain responsibility; avoid generic replacement when field errors exist.
- 401 unauthenticated: do not auto-redirect or manufacture auth; later Step 35+ establishes session flows.
- 403 forbidden: do not reveal sensitive resource identity; no permission bypass hints.
- 404: generic not-found state without enumeration leaks.
- 409: concurrency/conflict, caller-supplied contextual message. Don't confuse HTTP 409 with RoadSync spatial conflict severity.
- 5xx/unexpected: safe user-facing fallback and retry where sensible.
- Unknown/malformed response: safe fallback, no raw stack traces.

**Error display safety:** no raw stack, connection string, token, Mongo URI, query text with secrets, internal request body, user email or agency-private IDs in browser. Correlation/request ID may appear only if non-sensitive and sanctioned by the actual envelope; use `meta.requestId` only when it truly exists. Detailed errors/logs remain server-side. Don't call `dangerouslySetInnerHTML` for API messages. UI retry button must call caller's genuine retry, not perform unapproved mutation.

**Mutation vs query:** never auto-retry mutation blindly; query retry policy follows existing TanStack Query defaults. A failure must not be overwritten with optimistic 'Saved' success. Avoid duplicate toasts and failure panels for same event unless UX calls for both.

## 3.8 Success states and messaging

- Support compact inline success acknowledgement plus optional distinct full-section success feedback for a completed caller-confirmed operation.
- Differentiate **created**, **saved**, **submitted for review**, **approved** and **completed**, using exact caller-provided event description; do not conflate.
- Green is a semantic accent; use accessible text/contrast-safe variants and a text label/icon; color must not be the only signal.
- Success view must not be triggered merely by clicking button or resolving a mock timeout; tie to verified operation result.
- Reuse Step 19 Toast for transient acknowledgment; avoid a second toast provider/library.
- Maintain focus and/or a sensible status announcement when state changes; no focus hijacking unless necessary.

## 3.9 Visual system / component APIs

Reusable API patterns (adjust to repo):

```tsx
<LoadingState label="Loading projects" variant="section" />
<EmptyState title="No projects yet" description="Projects will appear here once added." />
<EmptyState variant="no-results" title="No matching projects" onClearFilters={clearFilters} />
<ErrorState title="Unable to load projects" onRetry={refetch} />
<SuccessState title="Request submitted" description="Waiting for authorized review." />
```

These are **illustrations**, not instructions to create demo project pages or fake API calls. Ensure icon-only controls get accessible names, actions use actual callbacks/links, slots do not nest invalid interactive elements, and labels align with status semantics.

## 3.10 Next.js App Router integration (limited)

Inspect existing `loading.tsx`, `error.tsx`, Suspense boundaries, `not-found.tsx`, TanStack Query loading states. This step may **update limited existing boundaries** or add *one* reusable route-level pattern if warranted, but do **not** create dedicated 403/404/500/maintenance pages now (Step 161) or overhaul the app's route map.

- Next.js segment-level `error.tsx` must follow App Router client-boundary requirements when introduced and accept its actual `error/reset` signature.
- Do not leak raw error.message or stack to end users; log responsibly.
- Avoid adding a global catch-all boundary that swallows framework behavior and makes debugging impossible.
- `loading.tsx` must not render fake data or change route-level auth semantics.
- Do not wrap the entire app in a client component solely to provide feedback states.
- Keep deterministic SSR/RSC output to avoid hydration mismatches; avoid `Math.random()`/`Date.now()` in rendered markup.

## 3.11 Required Step 22 focused tests

- Loading component announces state and skeleton does not spam screen reader; reduced motion policy verified.
- Pending vs refreshing: previous content preserved where caller supplies it.
- Empty vs filtered no-results are distinguishable and clear-filters action invokes only provided callback.
- 401/403/404/429/5xx/timeout safe-mapped without internal details; generic fallback for unknown response.
- Retry user action invokes correct callback once; no automatic mutation retries.
- Form validation error stays in field context where appropriate, not overwritten.
- Success state only appears on caller-confirmed success; no fake green banner on failed promises.
- Focus, keyboard, role/live-announcement behavior; icon and text, not hue alone.
- Existing Step 19 Alert/Toast/Button + Step 20 forms + Step 21 DataTable remain working.
- Mobile 320/375 px, tablet 768 and desktop 1280 when browser available; no overflow.
- React/Next compatibility, no hydration warnings/console errors if browser available.
- Unit/contract mapping tests with synthetic payloads only. No Atlas connection needed.

## 3.12 Step 22 documentation and acceptance

Create or update (align with established paths):

```text
docs/design/feedback-and-async-states.md
docs/design/step-22-review.md
```

Document state taxonomy, APIs/examples, icons/semantic colors, screen-reader strategy, error presentation rules, `401`/`403`/`404` behaviors, retry/no-retry policy, Next route boundaries and actual tests.

**Step 22 acceptance checklist:**

- [ ] Step 21 verified in `development` before any Step 22 edits.
- [ ] Separate safe feature branch; teammate changes preserved.
- [ ] Existing UI components reused; no duplicate global state/toast framework.
- [ ] Loading, refreshing, skeleton, empty, no-results, error, success primitives implemented and exercised.
- [ ] Accurate transport-error mapping with no secret/raw-stack disclosure.
- [ ] No premature authentication/session, backend endpoints or real feature CRUD added.
- [ ] Keyboard/focus/ARIA/reduced motion and responsive behavior checked.
- [ ] Targeted and applicable regression lint/types/tests/build pass or blocker is explicitly reported.
- [ ] Documentation, pre/post reviews and Git diff completed.
- [ ] Commit/PR **prepared**, `development` merge gated by approval.
- [ ] Stop and **wait** before Step 23.

## 3.13 Step 22 post-review template

```text
STEP 22 — POST-IMPLEMENTATION REVIEW
Starting branch/SHA / actual feature branch:
Preexisting work preserved / untracked prompts:
Components created/modified and public props:
API/client error mapping and unexpected response behavior:
Loading vs refreshing vs submitting:
Empty vs no-results vs forbidden vs not-found:
Success handling and toast integration:
Client/Server boundary and hydration:
Contrast/icon/labels/reduced motion/focus/ARIA:
Responsive verification (320/375/768/1280):
Security/PII/stack leakage review:
Tests with commands and PASS/FAIL/NOT RUN:
Regression findings, fixes and retests:
Docs updated:
Git diff/status/untracked files review:
Suggested commit / PR target:
Known limitations and integration gate:
STEP 22 STATUS: COMPLETE / PARTIAL / BLOCKED
STOP, WAIT FOR APPROVED INTEGRATION.
```

---

# PART B — STEP 23: RESPONSIVE APPLICATION SHELL

**Branch:** `feature/step-23-responsive-app-shell`  
**Prerequisite:** approved Step 22 changes really merged into **updated** `development`.  
**Target:** reviewed/approved PR to `development`; no automatic `main` merge.  
**Scope:** the shared *application layout and navigation foundation*; no auth/backend modules or full feature dashboards.

## 4. Step 23 objective and intended shell

Build a professional, responsive, consistent **authenticated-area-oriented shell** that later holds ProjectTrace/RoadSync/InfraMap etc. Because authentication is not implemented until Steps 35–50, shell structure must not pretend to be a functioning secure authenticated app now.

Layout should conceptually support:

```text
Desktop:
┌──────────────────────────────────────────────────────────────────┐
│ INFRAOS | Header: location/context, search placeholder* | actions │
├──────────────────┬───────────────────────────────────────────────┤
│ Primary Sidebar  │ Breadcrumbs / Page heading / optional actions │
│ Overview*        │                                               │
│ ProjectTrace*    │             Main page content                  │
│ RoadSync*        │                                               │
│ InfraMap*        │                                               │
│ …future modules* │                                               │
└──────────────────┴───────────────────────────────────────────────┘

Mobile:
┌───────────────────────────────────┐
│ Menu │ INFRAOS │ minimal actions │
├───────────────────────────────────┤
│ Breadcrumbs / heading             │
│ Content (no sideways body scroll) │
└───────────────────────────────────┘
```

`*` = only links/routes actually implemented. For future modules, hide or visibly mark as unavailable/coming later in non-production preview; do not link to false functional pages. Search and notifications are **future integration slots** only; Step 140+ / Step 135+ implements real functionality.

## 4.1 Step 23 pre-review — mandatory

```text
STEP 23 — PRE-IMPLEMENTATION REVIEW
Development HEAD and Step 22 PR/merge proof:
Working tree / teammate files / untracked prompts:
Existing root/route layouts, public landing and app route groups:
Next.js App Router current conventions and actual route manifest:
Current shadcn Sidebar/Sheet/Tooltip/Button availability:
Existing topbar/sidebar/breadcrumbs components:
Existing auth/session status (do NOT assume auth exists):
Existing route/role/permissions source-of-truth (Steps 4, 5, 16):
Existing user/agency context if real; otherwise explicit placeholder contract:
Step 17–18 tokens and Step 19–22 components:
Responsive widths and mobile/desktop testing tools:
Potential performance/hydration/portal issues:
Proposed shell architecture, routes, files and test plan:
Ownership/conflicts and GO / NO GO:
```

If Step 22 has not been reviewed/integrated, stop before branch creation. If a real shell already exists, **audit and improve** rather than create a second `AppShell`. If canonical route map is missing, don't invent implemented URLs: derive current actual route manifest and document future contracts separately.

## 4.2 Branch and verification

When safe:

```bash
git switch development
git pull --ff-only origin development
git switch -c feature/step-23-responsive-app-shell
git rev-parse --short HEAD
```

If conflicts, missing remote, existing branch or dirty work: pause, inspect, report. Preserve existing `Prompts/` files. A feature branch for Step 22 is not reused for Step 23.

## 4.3 Shell component architecture

Adjust to actual repository and reuse existing shadcn primitives:

```text
apps/web/src/components/layout/
  app-shell.tsx          # semantic structural layout; server compatible if possible
  app-header.tsx         # brand, menu toggle, context slots
  app-sidebar.tsx        # nav list and links, collapsible desktop behavior
  mobile-navigation.tsx  # Sheet/Drawer with focus restoration
  breadcrumbs.tsx       # accessible current route context
  page-container.tsx    # width/gutter variants, map vs regular vs form layout
  page-header.tsx       # title, optional description/actions
  navigation-config.ts  # typed route/label/icon/availability descriptors
  nav-access.ts         # OPTIONAL UI projection of already authorized server data;
                        # no locally invented permissions or bypass
apps/web/src/app/
  (app)/layout.tsx      # only if existing route map/conventions justify an app group
  ...                   # do not invent full feature pages

docs/design/responsive-app-shell.md
docs/architecture/navigation-integration.md
docs/design/step-23-review.md
```

**Do not create duplicate root layouts** or change existing marketing/public landing layout accidentally. Existing public vs internal route groups must be preserved. Keep most of shell structural rendering a Server Component when feasible; isolate interactive mobile drawer/collapse state into small Client Components. Do not wrap the entire app in `use client` as a shortcut.

## 4.4 Semantic layout, responsive widths and density

- Header with recognizable INFRAOS wordmark/text (no fabricated official government crest).
- Left sidebar navigation on desktop; optional desktop collapse/expand state if existing shadcn Sidebar supports it. Avoid overengineering state persistence.
- Mobile `Sheet`/drawer navigation with real button, keyboard focus, Escape close, backdrop, scroll lock and return focus.
- Content `<main id="main-content">` landmark and a visible-on-focus **Skip to main content** link.
- Optional breadcrumbs with `<nav aria-label="Breadcrumb">`, current location `aria-current="page"`, accessible list semantics and no phantom pages.
- Page header supports title, description, actions and slots, but does not invent data or run API queries.
- Page container variants: standard dashboard, readable form/content, full-width map/workspace; respect Step 18 spacing and future InfraMap needs.
- Header/sidebar mobile controls have appropriate min touch target and visible focus, not only hover.
- Preserve meaningful document order and one logical primary `<main>` landmark; avoid duplicate heading H1 for header and page.
- Content minimum widths: use `min-w-0`, overflow containment where appropriate, and avoid forcing global horizontal body scroll. Allow nested Step 21 table to scroll locally.
- Prefer predictable CSS grid/flex with breakpoints already installed. Don't install a new layout framework.
- Sidebar scroll independent of content where needed; sticky headers only if tested with overlay stacking contexts and accessible zoom.
- No heavy dashboard graphics, auto-animated drawers or GSAP in the shell.

### Responsive QA reference viewports

```text
320 px: minimum narrow viewport, no body horizontal scroll
375 px: common mobile
768 px: tablet; shell navigation adapts consistently
1024 px: laptop/sidebar transition
1280 px: desktop
1920 px: wide viewport; content max-width vs map full bleed
```

Also test 200%/400% zoom/reflow when tooling permits; don't claim full WCAG from a couple viewports. Ensure user-adjusted large text does not cause clipping or overlap.

## 4.5 Navigation configuration, routes and truthfulness

**Navigation model must follow real route architecture**. Recommended shape (conceptual):

```ts
type NavigationItem = {
  id: string;
  label: string;
  href?: string;            // only for real reachable routes
  icon?: unknown;           // use actual icon type
  group?: string;
  isAvailable: boolean;     // honest implementation state
  // Visibility may be based on backend-authorized context in later auth steps.
};
```

Do **not** hardcode claimed `Super Admin` privileges, fake agency names, or frontend-only authorization. An unimplemented module link must not navigate to a non-existent route. Options:

- Include only existing routes in live navigation; document reserved items for later implementation.
- In a strictly development-only shell preview, show upcoming modules as disabled with explicit `Coming later`; never represent them as live features.

Avoid broken links, circular redirects, guessed route params or inaccessible nested menus. Active states use actual path (and tested exact/segment matching) plus an indicator beyond orange alone. Do not treat a route matching a prefix like `/projects` as proof of permission; backend guards come later.

## 4.6 Future role- and agency-aware behavior (interface seam only)

Roadmap asks for role/agency-aware access eventually, but auth/RBAC feature work is Steps 35–50. Step 23 must provide a **well-defined integration seam** without creating fake authentication:

- Use an optional typed `viewer` / `authorizedNavigation` input when a real server-authorized session projection eventually exists; otherwise default to generic/non-privileged available links.
- Do not read/decode JWT, parse cookies in client-side nav, add auth middleware, create user switches or invent permission strings.
- Agency labels/avatars display **only** if a real authorized value is passed; no default 'Ministry Admin' actor.
- Future topbar notification button/search/user menu may be **slots**, not wired features. Avoid fake counters/unread counts.
- Menu visibility is a UX projection only. It does not replace Express RBAC or resource authorization.
- Public Citizen Portal navigation must use a separate public layout/links according to actual route map, not inherit privileged app shell by default.

## 4.7 Header, brand identity and activity slots

Header should have:

- Logo text and brand accent; no national emblem imitation.
- Mobile menu toggle with accessible name, `aria-expanded` where supported and correct focus behavior.
- User/agency context slot, absent if data unavailable.
- Notification/search/help/account slots only as pluggable affordances **if implemented**; avoid inert buttons. Where not built, omit entirely or dev preview label only.
- Consistent height/touch targets, focus and high contrast.

## 4.8 Sidebar and mobile menu

- Group nav items by actual information architecture (e.g. Overview, Coordination, Management) **only** if confirmed by current route map; don't fabricate live routes.
- Active marker orange + text/shape/`aria-current` for current location.
- Desktop sidebar collapse persists only in a safe optional local UI preference if existing patterns support it; no need for user settings API or localStorage unless reviewed.
- Mobile Sheet closes after valid navigation, supports Esc/close button, and returns focus correctly when appropriate.
- Long agency/project title and translated text fit; no cut-off nav labels without accessible text.
- Hover tooltip for collapsed icon label only complements, not replaces icon's accessible name.
- Do not create new global menu state in Zustand unless justified over local state.

## 4.9 Breadcrumbs and page content consistency

- Prefer authored route metadata or typed breadcrumb descriptors, not blindly exposing raw route segments/slugs/IDs in UI.
- Dynamic route labels must be passed from authorized backend data when available; otherwise generic safe label such as `Project details`.
- Hide breadcrumb for root or use single current page item based on route map; do not generate 'undefined' path.
- Never reveal internal document IDs or confidential project names to unauthorized viewers.
- Content headers and actions follow shared design tokens, with correct heading order.
- Full-width GIS page variant reserves room for later MapLibre but does **not** load tiles/map or implement InfraMap.

## 4.10 Integrate Step 22 states into shell without fake data

- Provide layout slots for route segment loading/error/empty states from Step 22; do not wrap app with a giant new loading overlay.
- Route-level `loading.tsx`/error boundaries are added only where justified in the actual route map; preserve Next.js semantics.
- On 403/401 from future API, do not display privileged sidebar content; no invented auth redirect.
- Responsive shell must support a Step 21 table overflowing **within content region** rather than breaking header/sidebar.
- Avoid route changes that break existing public landing page, root layout providers, APIs or component previews.

## 4.11 Server/client boundaries and performance

- Server Components for stable static layout and route metadata where possible; isolate `usePathname`, open/close state and other hooks in small Client Components.
- Avoid hydration mismatch from browser width rendering: use CSS media queries for responsive structure rather than `window.innerWidth` during SSR.
- Any persisted collapse state must be loaded without flash/hydration mismatch, or simply omit persistence.
- Avoid global heavy UI libraries, rerendering all pages on nav state, duplicate providers and wide client bundles.
- Audit shadcn Sheet z-index/provider stacking (dialog/toast/tooltip) and focus restoration.
- Ensure routes, fonts, token styles and Step 17–21 primitives still work.

## 4.12 Step 23 focused tests

**Unit/component:**

- `AppShell` renders one main landmark and skip link target.
- Actual nav descriptors render only verified available routes; future routes not falsely clickable.
- Desktop sidebar labels and active indicator/`aria-current` correct for path.
- Mobile drawer open/close via keyboard, Esc, focus restore, and closes on valid navigation.
- Breadcrumbs have proper list and current-page semantics; unknown dynamic labels are safe.
- PageContainer variants respect max width/full-bleed and `min-w-0`.
- Empty/loading/error states from Step 22 can render inside shell slots without overlap.
- No fake user/agency/notification count present when context absent.
- Public landing remains outside privileged shell if actual routing separates it.
- No new permissions/roles/auth endpoints introduced.

**Browser/manual:**

- 320/375/768/1024/1280/1920 widths; scroll/reflow and 200–400% zoom if possible.
- Keyboard-only navigation: skip link, Tab, Enter, Esc, active focus, mobile close/restore.
- Screen reader landmarks/heading order if available; automated axe checks on shell fixtures helpful but not full compliance.
- Long nav titles and large text; optional mixed English/Sinhala/Tamil display with reasonable fallback; record limitations.
- Overlay portal stacking and toast/focus compatibility.
- Deep links and refresh on existing routes; no new broken routes.
- No React hydration warnings, CSS/layout shift or new console errors.

## 4.13 Step 23 documentation and acceptance

Deliver docs under existing conventions:

```text
docs/design/responsive-app-shell.md
docs/architecture/navigation-integration.md
docs/design/step-23-review.md
```

Document actual component API and path, shell variants, route/availability policy, public/private separation, role/agency context seam, keyboard/mobile behavior, hydration/performance choices, future Step 35+ integration, test evidence and deferred enhancements.

**Step 23 acceptance checklist:**

- [ ] Step 22 merge into updated `development` verified; Step 23 branch created safely.
- [ ] One coherent app shell reusing Step 17–22 primitives; no second styling framework.
- [ ] Desktop header/sidebar + responsive mobile drawer functional.
- [ ] One main landmark and skip link; headings, breadcrumb semantics and focus visible.
- [ ] Live nav links point only to real existing routes; no counterfeit functionality.
- [ ] Active state accessible; overflow/resizing properly contained.
- [ ] No auth/RBAC bypass, fake logged-in user, agency, notice count or app metrics.
- [ ] No auth backend/session, ProjectTrace/RoadSync features, InfraMap, public landing rework.
- [ ] CSS and RSC/Client Component boundaries correct; no hydration/client bundle regression.
- [ ] Focus/keyboard/mobile/zoom testing performed where possible or recorded as NOT RUN.
- [ ] Lint/types/tests/build and Step 17–22 regressions completed or blockers recorded.
- [ ] Documentation, post-review, changed/untracked files and Git approval gate complete.
- [ ] Step 24 NOT implemented.

## 4.14 Step 23 post-review template

```text
STEP 23 — POST-IMPLEMENTATION REVIEW
Starting development commit/approved Step 22 merge evidence:
Feature branch/worktree and teammate changes:
App shell, header, sidebar, mobile menu components:
Actual routes/availability map and broken-link check:
Future auth/agency context seam, no auth simulation:
Public/private route groups and layout isolation:
Breadcrumbs, PageContainer, full-width GIS readiness:
Main/skip link/header/landmarks/heading semantics:
Focus, keyboard, drawer/overlay behavior:
Responsive widths, overflow, zoom/reflow and large text:
Next.js App Router/RSC/Client boundary/hydration/performance:
Step 22 states + Step 21 data tables integration:
Accessibility, status palette and contrast:
Security/PII/unavailable routes review:
Focused + regression checks and commands:
Defects found, fixed, rerun tests:
Files/lockfile/docs changed:
Git diff/status/untracked/secret review:
Suggested commit, PR target, approval status:
Remaining blockers:
STEP 23 STATUS: COMPLETE / PARTIAL / BLOCKED
STOP. DO NOT IMPLEMENT STEP 24.
```

---

# 5. SHARED VERIFICATION, TESTING AND REVIEW PROCESS

## 5.1 Testing command discovery — do not guess scripts

Use actual workspace/package-manager conventions. Examples **only**:

```bash
# Repo scripts may differ; inspect package.json before execution.
npm run lint
npm run type-check
npm run test
npm run build
# or workspace-specific commands after inspecting scripts:
npm run lint -w apps/web
npm run type-check -w apps/web
npm run test -w apps/web
npm run build -w apps/web
```

If a script doesn't exist, say so (`NOT AVAILABLE`), rather than fabricating output. If tests run against a mock fixture, label the test as such; never claim MongoDB/Atlas was accessed. Run focused tests after each implementation batch, then broader relevant regression on completion.

**Fix loop:** reproduce → root cause → minimal scoped fix → targeted rerun → existing Step 19–21 (and Step 22 for Step 23) regression → build/browser smoke if available → record.

## 5.2 Cross-cutting acceptance: design, security and accessibility

| Area | Required standard |
|---|---|
| Design | Exact new brand raw hexes; contrast-safe semantic variants, neutral-first operational UI |
| Color status | Text/icon + color; don't rely on color alone |
| Text | Normal text WCAG 2.2 AA target ≥4.5:1, large text ≥3:1; meaningful non-text focus/indicator ≥3:1 where applicable |
| Keyboard | Tab, Enter/Space, Esc, focus visible and return focus after drawer/dialog |
| Reduced motion | Skeleton, spinner, drawer and hover transitions respect user preference |
| Responsive | 320, 375, 768, 1024, 1280, 1920 test widths where available |
| Privacy | No raw internal errors, stack, tokens, resource enumeration or private labels |
| Authorization | Backend RBAC/resource scope is sole authority; don't fake client permission |
| Future feature scope | No Step 24 audit, auth Step 35+, domain modules, GIS, notification system or new endpoints |
| Git | Separate Step 22/23 branches, approved `development` PRs, protected `main` |

## 5.3 Diff, dependency, secret and ownership review

```bash
git status --short
git diff --check
git diff --stat
git diff --name-only
```

Also inspect untracked files (which `git diff` omits). Compare lockfile/package changes and generated shadcn source. Review for `.env`, credentials, new backend models, auth logic, new API routes, live Mongo changes and public features accidentally added. Check no unrelated pages were restyled beyond approved shell integration. Make sure teammate work and prompt documents remain untouched/untracked unless explicitly added with approval.

**Suggested commits (only after explicit authorization):**

```text
Step 22: feat(ui): add reusable loading empty error and success states
Step 23: feat(layout): add responsive INFRAOS application shell
```

PR merge target: `development`, with reviewers/CI as defined by actual repo. `development → main` **only** at an explicitly approved stable checkpoint; Phase 3 is not complete until Step 24 passes, unless the team deliberately approves an earlier release.

## 5.4 Safe stopped-state behavior

If missing Step 21 integration, missing Step 22 integration for Step 23, dirty tree conflict, uncertain canonical navigation routes, critical failing checks, or unavailable package manager means implementation would be unsafe: **STOP**, summarize findings, provide safe options and ask for approval. Do not assume success, invent routes, auto-repair unrelated systems or delete code.

---

# 6. COMBINED STEPS 22–23 POST-MERGE REVIEW

Run **only after** each step was independently approved and *actually merged into `development`*. Verify commits/PR evidence; don't simply infer from branch names.

```text
INFRAOS STEPS 22–23 — INTEGRATED DESIGN-SYSTEM GATE

A. BASELINE
Current development HEAD / PR/commit evidence for Step 22:
Current development HEAD / PR/commit evidence for Step 23:
Working-tree status / unrelated/untracked work:

B. STEP 22
Loading/refreshing/skeletons/form/table reuse:
Empty vs no-results/forbidden/not-found:
Error mapping: network, validation, 401, 403, 404, 409, 429, 5xx:
Success feedback is truthful and accessible:
Contrast/focus/reduced-motion/ARIA:

C. STEP 23
Header/sidebar/mobile Sheet and breadcrumbs:
Route availability and public/private separation:
Responsive variants and wide GIS readiness:
Auth/agency context seam without fake session:
No unauthorized navigation or client-only RBAC:
RSC/Client boundaries and hydration:

D. REGRESSION
Step 17/18 tokens:
Step 19 UI components:
Step 20 forms:
Step 21 tables:
Step 22 states inside Step 23 shell:
Tests/build/lint/type-check/browser results:
Bugs found/fixed/retested or follow-up branch needed:

E. GIT
Exact files and docs:
Both approved feature merge proofs:
Main merge: NOT DONE unless expressly approved:
Outstanding approvals/blockers:

STEP 22 STATUS: COMPLETE / PARTIAL / BLOCKED
STEP 23 STATUS: COMPLETE / PARTIAL / BLOCKED
READY FOR STEP 24? YES / NO, WITH REASON
STOP; WAIT FOR STEP 24 REQUEST.
```

## 6.1 Final reporting checklist

For **each separate step**, return:

- Scope completion and actual changed files/exports.
- Git starting SHA, branch name, worktree safety.
- Dependency/prerequisite evidence.
- Design/security/accessibility findings.
- All tests and commands with recorded outcomes.
- Bugs found, fixed, retested; remaining limitations.
- Documentation and screenshots only if actually created.
- Proposed commit/PR description, target `development`, approval still required.
- Explicit note that `main` is unchanged until release authorization.
- Explicit next step and **STOP**.

---

# 7. ACCEPTANCE CRITERIA — BOTH STEPS TOGETHER

- [ ] Step 21 dependency verified before Step 22; Step 22 actually integrated before Step 23.
- [ ] Separate safe feature branches and independent review/PR gates.
- [ ] Step 22 provides accurate loading, empty, error and success semantics with tested ARIA/keyboard/retry behavior.
- [ ] Step 22 states never leak errors/private data or fabricate backend results.
- [ ] Step 23 provides real responsive shell layout, navigation, breadcrumbs and mobile drawer behavior.
- [ ] Step 23 does not invent implemented routes, authenticated viewers or authoritative permission enforcement.
- [ ] Component architecture reuses Step 17–22 primitives and preserves Next.js server/client boundaries.
- [ ] Correct new INFRAOS flag-inspired palette, accessible foregrounds and appropriate typography/spacing.
- [ ] Applicable lint, type-check, unit/integration, build and browser checks have evidence; blockers are honest.
- [ ] Review/fix/retest cycle completed for each step.
- [ ] Docs updated, Git diffs/lockfiles/untracked files reviewed, no unintended module edits.
- [ ] Each approved PR targets `development`; `main` merge requires separate release approval.
- [ ] Step 24 is not implemented or claimed completed.

**Stop condition:** The two individual steps and optional combined review are complete. Wait for the user to ask for Step 24 — Accessibility Foundation.
