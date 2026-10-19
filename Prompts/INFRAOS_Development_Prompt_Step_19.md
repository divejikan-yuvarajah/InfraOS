# INFRAOS — Complete Enhanced Development Prompt
## Phase 3 · Step 19 — Reusable UI Component Library

**Project:** INFRAOS — National Infrastructure Intelligence & Coordination Platform  
**Vision:** The Operating System for National Infrastructure  
**Core lifecycle:** Plan → Coordinate → Approve → Build → Verify → Monitor → Complete → Maintain  
**Roadmap source:** `Steps.docx`, Phase 3, Step 19 — *Reusable UI Component Library*  
**Previous dependency:** Approved and integrated Step 17 (brand/colors) and Step 18 (typography/spacing/design tokens)  
**Current step:** **19 only**  
**Next roadmap steps (do not implement):** Step 20 Forms & Validation UI System; Step 21 Data Table System; Step 22 Loading/Empty/Error/Success States; Step 23 Responsive Application Shell; Step 24 Accessibility Foundation  
**Implementation branch:** `feature/step-19-reusable-ui-components`  
**Integration target:** `development` after review and explicit approval; `main` only at an approved stable release gate  
**Companion:** `INFRAOS_Cursor_Codex_Execution_Step_19.md`

> **Required source reconciliation:** The uploaded original `Steps.docx` describes Step 19 as Buttons, inputs, selects, date pickers, cards, badges, tables, dialogs, drawers, tabs, alerts, tooltips and toasts. Its older Step 17 palette is superseded by the later-approved Sri Lankan national flag-inspired palette. Do **not** reintroduce Deep Navy `#0F172A` / old Orange `#F97316` as the active brand. The approved raw identity colors are Orange `#FF5B00`, Yellow `#FEB600`, Maroon `#8C1F28`, Green `#279541` with neutral canvas `#F8FAFC`, surface `#FFFFFF`, strong text `#111827`, secondary text `#475569`, muted text `#64748B` and border `#E2E8F0`.

---

# 0. EXECUTION DIRECTIVE — READ BEFORE EDITING

You are acting as a **Principal Design Systems Architect, Senior Next.js/React/TypeScript Engineer, shadcn/ui–Radix Specialist, Accessibility Engineer, Frontend Security Reviewer, UI Test Engineer and INFRAOS Integration Lead**.

The job is **not** to create a generic demo dashboard. The job is to establish a small, coherent, accessible, typed, testable, documented **reusable UI component library** for later INFRAOS modules. It must honor the existing repository and Steps 17–18 design foundations.

**Mandatory order:** repository/source review → baseline evidence → dedicated feature branch → incremental components → targeted tests → visual/interactions QA → security/architecture review → fixes → full checks → Git diff review → PR handoff → STOP. If preceding steps are unavailable or unmerged, do **not** invent a green baseline. Explain what can be done safely and what depends on approval.

**Critical agent restrictions**

- Read this **entire** file and any root agent rules before implementation; do not work only from the brief execution prompt.
- Preserve working app, other teammates' files, code, design tokens and existing shadcn primitives. Extend rather than rebuild.
- Do not upgrade Next.js, React, Tailwind, shadcn/Radix or UI framework merely for preference. Identify installed versions, existing APIs and compatible generators.
- Do not add Chakra, MUI, Bootstrap, Ant Design or a second parallel component system.
- No feature pages, ProjectTrace/RoadSync CRUD, map features, auth/RBAC implementation, backend/database edits, FastAPI, AI, production changes or other roadmap steps.
- Do not implement the comprehensive Step 20 form system (React Hook Form + Zod field abstractions), Step 21 advanced data table engine, Step 22 app-level state screens, Step 23 responsive app shell or Step 24 full accessibility audit. Only create **base primitives** needed for reuse.
- Do not create demo role permissions that fake authorization. Server RBAC/resource scope remains authoritative.
- Do not commit, push, open/merge PRs, force-push, reset/stash other changes or delete branches without explicit user/team authorization. Prepare commands and review notes instead.
- **PASS / FAIL / NOT RUN / N/A** must reflect actual executed evidence. Never alter tests to make failures disappear.

---

# 1. PRODUCT CONTEXT AND WHY THESE COMPONENTS MATTER

INFRAOS supports infrastructure projects, agency coordination, approvals, RoadSync conflicts, GIS locations, milestones, finance, documents, inspections, assets and citizen issue reporting. The UI components must be adaptable to government/enterprise workflows:

- An Agency Officer reviews a cross-agency work conflict.
- A Project Manager creates and reviews milestones.
- An Inspector submits verification evidence and sees warnings.
- A Government Administrator filters project records and approves authorized actions.
- A Citizen reads public information without exposure to confidential records.

This step provides reusable primitives for later workflows **without building those workflows now**. Avoid adding fake government badges, live KPIs, current-project data, or government seals.

**Design principles:** neutral-first, clear information hierarchy, strong keyboard behavior, accessible text, restrained visual effects, compact business-data density, semantic status colors with labels, responsive fundamentals, composable APIs, small dependencies and transparent loading/error handling.

---

# 2. PRE-STEP REVIEW — REQUIRED WRITTEN OUTPUT

Before editing, examine the actual repository:

```text
README.md
CONTRIBUTING.md
CURSOR_STEP_EXECUTION_RULES.md (if present)
package.json + single lockfile
apps/web/package.json
apps/web/components.json (if present)
apps/web/src/app/layout.tsx
apps/web/src/app/globals.css
apps/web/src/styles/* (if present)
apps/web/src/components/ui/* (if present)
apps/web/src/components/common/* (if present)
apps/web/src/lib/utils.ts or equivalent
apps/web/tailwind.config.* / postcss.config.* (depending on version)
apps/web/src/app/page.tsx and any existing internal preview route
packages/shared-types/* and Step 16 status definitions
/docs/planning /architecture /security /ux /team /design /adr (as available)
docs/prompts/INFRAOS_Development_Prompts_Steps_17_to_18.md (if placed in repo)
docs/prompts/INFRAOS_Cursor_Codex_Execution_Steps_17_to_18.md (if placed in repo)
```

Check **actual** Steps 17–18 output for: token names; color/foreground mapping; typography scales, spacing, radius/elevation/motion tokens; focus and disabled styling; dark-mode policy; shadcn integration; whether visual verification was completed. Prior prompt files alone do not prove these steps have been executed.

Inspect Git safely:

```bash
git status --short
git branch --show-current
git remote -v
git log -1 --oneline
git branch -a
```

Check dependencies and existing scripts; use installed versions and package manager. Run available baseline lint/type-check/test/build before making relevant edits when practical. Do not treat a missing script as a pass.

**Required PRE-REVIEW:**

```text
STEP 19 PRE-IMPLEMENTATION REVIEW
Repository root / current branch / base commit:
Working tree: clean / preexisting staged / untracked changes:
Remote and development branch status:
Source docs found / missing:
Step 17 brand tokens actually integrated? Evidence:
Step 18 typography/spacing tokens actually integrated? Evidence:
Next.js / React / TypeScript versions:
Tailwind v3 vs v4 setup:
shadcn components.json and Radix dependencies:
Existing components found (with paths):
Conflicting duplicate button/card/input implementations:
Existing test stack and browser preview capability:
Existing lint / type-check / test / build baseline:
Files or areas owned by other teammates:
Missing prerequisites and decisions:
Implementation file plan:
Component implementation order:
Testing and manual QA plan:
Risk / out-of-scope exclusions:
Decision: PROCEED / LIMITED SAFE WORK / BLOCKED:
```

**Do not automatically overwrite conflicting teammate work.** If Step 17 or 18 is absent, stop or obtain approval for a clearly scoped dependency repair; don't silently rebuild the design system inside Step 19.

---

# 3. GIT WORKFLOW — DEDICATED STEP BRANCH

Expected branch:

```text
feature/step-19-reusable-ui-components
```

After ensuring a safe clean working tree and confirming remote/branch:

```bash
git switch development
git pull --ff-only origin development
git switch -c feature/step-19-reusable-ui-components
git rev-parse --short HEAD
```

Adapt to actual Git configuration, Windows shell and existing branch state; do not issue destructive commands if working tree is dirty or branch exists. Do not make an unrequested network/Git action. **Normal flow: feature branch → tested/reviewed PR → development → post-merge regression.** Do not take Step 19 straight to `main`. The approved full Phase 3 gate is later than this step, after subsequent design-system steps and their review.

Suggested commit (prepare only until approved):

```text
feat(ui): establish reusable INFRAOS component primitives
```

---

# 4. COMPONENT ARCHITECTURE & OWNERSHIP

Preferred organization, adjusted to the existing codebase:

```text
apps/web/src/components/
  ui/                # shadcn/Radix-based accessible primitives
    button.tsx
    input.tsx
    textarea.tsx
    select.tsx
    card.tsx
    badge.tsx
    table.tsx
    dialog.tsx
    sheet.tsx       # drawer/sheet semantics if chosen
    tabs.tsx
    alert.tsx
    tooltip.tsx
    sonner.tsx or toast.tsx
    popover.tsx / calendar.tsx only if date picker needs them
  common/            # thin, justified INFRAOS-specific composition only
    status-badge.tsx
    confirm-dialog.tsx (only if justified)
    date-picker.tsx  (if required)
  examples/          # OPTIONAL dev-only visual verification, not production route
apps/web/src/lib/
  utils.ts            # existing cn utility, no duplicates
  design/             # OPTIONAL semantic status mapping, only where needed
  ...
docs/design/
  component-library.md
  component-matrix.md
  component-usage.md
  component-accessibility.md
  step-19-review.md
```

Do not force every path if the repository has an approved structure. Avoid adding unused directories, deep abstractions or unnecessary wrappers. **Import components from consistent paths**, such as `@/components/ui/button` when that is the established project convention. Avoid circular imports and giant barrel exports that unintentionally mark server components as client components.

- Prefer stock **shadcn source ownership + small carefully controlled customization** rather than copying primitive implementations from scratch.
- Use Radix internals through shadcn for accessible overlay primitives; preserve expected `data-state` and DOM semantics.
- Use `class-variance-authority` or installed variant utility rather than dozens of nested class conditionals when variants justify it.
- In Next.js App Router, only mark files `"use client"` when interaction/hooks/browser state require it. Keep static Card/Table primitives server-compatible if possible.
- Preserve ref forwarding and polymorphism/`asChild` behavior where supported by installed versions; do not invent unsupported props.
- Keep `onClick` callbacks and links semantically distinct. Navigation should use links, not `button` + router push unless justified.
- **No backend integration needed in this step:** component props can accept typed DTO display values, but no new API endpoints, auth rules or MongoDB queries.

---

# 5. COMPONENT INVENTORY AND IMPLEMENTATION PRIORITIES

Implement or normalize the following roadmap-required primitives, one small batch at a time. Avoid regenerating a component already working.

| Category | Component(s) | Priority | Step 19 implementation limit |
|---|---|---|---|
| Actions | `Button`, optionally `IconButton` as safe composition | P0 | variants, sizes, focus, disabled, loading, icon + text |
| Text entry | `Input`, `Textarea` | P0 | native type-safe controls; no form business schema |
| Selection | `Select` | P0 | keyboard, accessible option/value labels |
| Dates | `DatePicker` or documented date-picker composition | P0 | selection UI, timezone-aware value policy; no project rules |
| Surfaces | `Card` and slots | P0 | header/title/description/content/footer |
| Status | `Badge`, scoped `StatusBadge` | P0 | semantic status palette and explicit labels |
| Tables | base `Table` elements | P0 | semantic table primitives only |
| Modal | `Dialog`, optional `AlertDialog` confirmation | P0 | controlled/uncontrolled, accessibility, destructive confirmation |
| Drawer | `Sheet`/`Drawer` | P0 | accessible overlay for smaller screens; no app shell |
| Navigation | `Tabs` | P0 | keyboard tabs and panel associations |
| Feedback | `Alert`, minimal toast provider/helpers | P0 | accessible feedback; no global state-screen system |
| Disclosure | `Tooltip` | P0 | hover/focus support, not essential content |
| Supporting | `Label`, `Separator`, `Skeleton` only if existing/needed | Optional | don't implement full Step 22 state experiences |

**Batch order:** (A) Button/Card/Badge, (B) Input/Textarea/Select/DatePicker, (C) Dialog/Sheet/Tabs, (D) Alert/Tooltip/Toast, (E) Table primitives and integration examples. Re-run focused checks after each batch.

---

# 6. COMPONENT CONTRACTS — BUTTON & ICON ACTIONS

**Button variants** (map to established semantic design tokens; variant names may align with shadcn conventions):

- `default` or `primary`: core action using approved **orange** with accessible foreground; do not assume white on raw `#FF5B00` satisfies normal-text contrast.
- `secondary`: white/subtle surface, strong border and text.
- `outline`: clear border, hover/focus affordance.
- `ghost`: quiet secondary actions; focus remains visible.
- `destructive`: **maroon** semantic treatment where appropriate, strong warning and explicit label.
- `link`: visible text/underline/focus.

**Sizes:** minimum useful `sm`, `default`, `lg`, `icon`, with reasonable hit-area and visual density. Avoid giant marketing CTAs in the operational library.

**State behaviors:** normal/hover/active/focus-visible/disabled/loading. If adding `loading`, ensure a true disabled/blocked-repeat-action behavior and accessible announcement; do not use an inert spinner prop. When using `asChild`, maintain correct type/disabled behavior and don't render invalid nested interactive elements.

**Acceptance examples:**

- `<Button>Save draft</Button>` retains readable foreground on orange.
- `<Button variant="outline">Cancel</Button>` has focus and sufficient border distinction.
- `<Button variant="destructive">Reject request</Button>` has appropriately visible critical treatment; confirmation is separate if action is destructive.
- Icon-only button has `aria-label`; tooltip may supplement but not replace accessible name.
- Disabled button is not clickable; loading cannot trigger repeated action.

**Never** use an inactive button to impersonate server authorization. Later feature modules must still enforce permissions server-side.

---

# 7. INPUT / TEXTAREA / LABEL PRIMITIVES

Use native `<input>` / `<textarea>` semantics and established shadcn patterns. Support:

- `name`, `id`, `type`, `autoComplete`, `placeholder`, `disabled`, `required` and ref where appropriate.
- Correct visual sizes, padding and typography from Step 18.
- Default, hover, focus-visible, error/invalid, read-only and disabled **visual** states.
- `aria-invalid`, `aria-describedby` when caller supplies help/error text; do not auto-generate fake IDs without need.
- Clear keyboard text selection, visible caret and correct contrast.
- Password inputs must not have a default plaintext display or accidental logging; no auth functionality implemented.
- `type=number` and date handling must not be silently used for high-stakes LKR money or timezone-sensitive scheduling. Their business validators belong to Step 20 and feature steps.

If a `Label` primitive does not exist, add only the minimal accessible one. Do **not** build RHF Controller wrappers, project registration fields or complex FormProvider patterns in Step 19.

---

# 8. SELECT PRIMITIVE

Use the established shadcn/Radix Select composition rather than an inaccessible custom listbox. Provide typed component export surfaces compatible with installed dependency versions:

- Select trigger, value, content, group, item, label and separator where useful.
- Clear placeholder and selected-state visualization.
- Accessible name via associated label; support `aria-describedby` for help/error.
- Keyboard open/navigate/select/escape; focus restoration and correct portal behavior.
- Disabled state; long agency names and long option labels truncate/wrap appropriately without hiding key content.
- Ensure the options list can scroll on smaller screens.
- When possible keep `value` identifiers distinct from display labels.

**No API-loaded async selects, cross-agency permission filtering or RHF binding in this step**; leave those to Step 20/feature implementation.

---

# 9. DATE PICKER PRIMITIVE

The roadmap explicitly calls for date pickers. Reuse existing shadcn-compatible Calendar + Popover or an existing approved accessible date picker. Do not invent date parsing from scratch or pull a large calendar ecosystem without need.

Requirements:

- Keyboard-accessible date selection, focus management, locale-aware display, clear label, disabled state.
- Support controlled `value` / `onChange` and an explicit empty value (no unintentional `Invalid Date`).
- Define **wire format and timezone policy** in docs (e.g., project date-only calendar choice is `YYYY-MM-DD`, distinct from full UTC timestamps; don't silently convert date-only selection to midnight UTC and shift days).
- Allow optional min/max/disabled dates when supported; don't embed ProjectTrace schedule rules into primitive.
- Distinguish local display from API timestamps.
- Close/popover focus restoration and narrow-screen behavior.
- No `Date.now()`-dependent inaccessible default or fabricated project schedule.

**Stop at the primitive**. Form validation, date-range rules (`end >= start`) and RHF integration are Step 20 / ProjectTrace/RoadSync steps.

If dependency/version incompatibilities prevent a robust accessible date-picker primitive, document a scoped blocker and provide a deliberate fallback rather than introducing an entirely new UI framework.

---

# 10. CARD AND CONTAINER PRIMITIVES

Use shadcn-inspired compositions (e.g., Card/Header/Title/Description/Content/Footer) preserving semantics. Use Step 17–18 surface/border/radius/elevation tokens, not arbitrary hardcoded gradients. Verify:

- Long project/agency headings wrap without overflow.
- Dense content stays legible.
- Headings have appropriate semantic levels when composed; a generic CardTitle doesn't force a single heading level across all pages.
- Action buttons in card headers remain independently accessible.
- Card does not become clickable if it contains nested links/buttons unless interaction structure is correct.
- Do not invent real KPI cards, risk score calculations, progress charts or ProjectTrace dashboards.

---

# 11. BADGE & SEMANTIC STATUS BADGE

Provide base `Badge` and, only if needed, one typed `StatusBadge` adapter consuming approved status types/constants from Step 16. **Do not redefine backend enum/status literals.** Cover real relevant statuses at a minimal foundational level:

- warning/pending → yellow-based accessible foreground/surface, explicit `Pending`/`Needs review`.
- critical/conflict/rejected → maroon-based accessible foreground/surface, explicit label/icon where appropriate.
- approved/completed/resolved → green-based accessible foreground/surface, explicit label.
- generic/draft/neutral → slate/neutral.
- primary/emphasis → restrained orange.

StatusBadge should accept an explicit domain/context or a typed semantic descriptor to avoid collisions (e.g., `APPROVED` is not automatically the same as a work request and payment approval). If mapping is not ready because Step 16 status data is missing, document the gap and keep base Badge, **do not silently invent statuses**.

**Critical contrast:** raw yellow on white fails body-text contrast; white text on raw orange/green should not be assumed safe. Reuse accessible derived Step 17 tokens. Never communicate statuses exclusively by hue.

---

# 12. BASE TABLE PRIMITIVES — NOT STEP 21 DATA GRID

Create shadcn-style semantic building blocks:

```text
Table
TableHeader
TableBody
TableFooter (if useful)
TableRow
TableHead
TableCell
TableCaption
```

Requirements:

- Actual `<table>`, `<thead>`, `<tbody>`, `<th scope=...>`, `<td>` and captions where appropriate.
- Header associations and keyboard-readable row/column structure.
- Consistent padding, readable finance/date text, long identifiers, zebra/hover only where helpful.
- Contained horizontal scroll option for narrow viewports rather than breaking the page.
- Avoid truncating critical amounts/IDs without full accessible text.

**Not in Step 19:** TanStack Table state engine, server pagination, filtering/sorting, bulk selection, row actions, table column controls, sticky virtualized grids or advanced mobile alternative. Those belong to **Step 21**.

---

# 13. DIALOG / ALERTDIALOG / CONFIRMATION

Use accessible Radix/shadcn Dialog. Preserve:

- Proper accessible title; description or deliberate accessible alternative.
- Trigger/content/header/footer/close primitives with stable API.
- Focus trapped when appropriate and returned to triggering control on close.
- Escape-to-close and outside-click behavior appropriate to severity.
- Portal stack/z-index/shadow consistent with Step 18.
- Scrolling for long content without losing close actions.
- No accidental nested dialogs or buttons.
- Controlled and uncontrolled usage if existing primitive supports it.

For destructive confirmations (e.g. future rejecting/archiving a project), prefer `AlertDialog` if genuinely useful and ensure action/cancel are distinguishable, but **do not implement actual project approval endpoints or mutation code**. Avoid using `window.confirm()` for production workflows when an accessible confirmation primitive is required.

Dialog must not promise a server action has succeeded merely because the overlay closed.

---

# 14. DRAWER / SHEET

The roadmap calls for drawers; use the existing shadcn-compatible `Sheet` (side overlay) when practical, or an already-established accessible Drawer. Avoid installing redundant sheet **and** drawer libraries without need.

- Consistent slide-out placement; responsive max width and mobile viewport support.
- Title/description, close control, readable scrolling, focus management, Esc behavior.
- Backdrop layering and scroll-lock (as implemented by the underlying accessible library).
- Enough room for future map detail / mobile filters, but **do not build InfraMap panel or app sidebar**.
- Verify small mobile height with keyboard when available; no clipped Close button.
- Correct portal/z-index relative to Dialog/Tooltip/Toast.

---

# 15. TABS

Use Radix/shadcn Tabs primitives. Requirements:

- TabsList, TabsTrigger, TabsContent with associated labels.
- Arrow-key navigation and appropriate keyboard/focus semantics.
- Distinct selected indicator beyond color alone.
- Long tab labels handle narrow viewport by scroll/wrap policy.
- No hidden panels accidentally remaining focusable.
- Preserve controlled/uncontrolled APIs where available.
- Do not implement route-level ProjectTrace tabs/sidebar/navigation in Step 19.

---

# 16. ALERTS / FEEDBACK

Use `Alert`, `AlertTitle`, `AlertDescription` or existing equivalent. Variants:

- information (neutral), warning (yellow), critical/destructive (maroon), success (green).
- Verified foreground/background contrast with icon or text label.
- Distinguish persistent information alert from ephemeral toast.
- Accessibility: actionable errors should be present in DOM and accessible; `role="alert"` for urgent updates only when appropriate. Avoid announcing every nonurgent static card as an error.
- Do not implement full-page empty/loading/error/success state framework yet (Step 22).

No fake network errors, audit alerts or fabricated live conflict notifications.

---

# 17. TOOLTIPS

Use Radix/shadcn Tooltip with a suitable provider when needed.

- Open on hover **and keyboard focus**.
- Delay sensible for dense enterprise UI.
- Content concise, accessible and not the **only** location for essential information.
- Escape closes; avoids obscuring required focus indicators.
- Do not place full interactive forms/buttons inside a tooltip; use Popover/Dialog instead.
- Icon-only actions still require `aria-label`.
- Support long labels / mobile touch fallback without relying exclusively on hover.

---

# 18. TOAST NOTIFICATIONS

Reuse an installed and supported toast solution (for example Sonner if already selected or shadcn's installed equivalent). Do not install two overlapping libraries. Add a single provider at the existing appropriate client boundary only when the underlying solution requires it.

- Success, info, warning, error styles map to Step 17 tokens.
- Avoid automatically claiming a backend operation succeeded.
- Accessible announcements with sensible live-region behavior; avoid duplicate announcements or flooding.
- Dismiss and timeout behavior should not hide critical errors prematurely.
- Avoid auto firing toasts on page load / rendering; fire from explicit actions.
- Demonstrate via dev-only/manual harness or focused test; do not create fake 'Save project' server action.
- Do not create notification center (Steps 135–136), real-time Socket.IO events (Step 137) or push notifications.

---

# 19. OPTIONAL SUPPORTING PRIMITIVES & EXCLUSIONS

Optional if dependencies require: `Popover`, `Calendar`, `Label`, `Separator`, `Checkbox`/`Switch` only if already in current design or immediately needed for component smoke checks. Do not expand into hundreds of shadcn generated files.

Explicit exclusions:

```text
Step 20 — RHF Controller, Zod form resolver, reusable field error rendering,
          multi-step project registration forms and full form validation UX.
Step 21 — advanced table engine / sortable-filterable-paginated datasets.
Step 22 — full-page skeletons, empty/error/retry experiences, global error boundary system.
Step 23 — sidebar/topbar/breadcrumbs/role-aware app shell.
Step 24 — whole-site accessibility audit and remediations unrelated to Step 19.
Step 25+ — landing pages/animations.
Step 35+ — authentication and admin/role management.
Step 51+ — ProjectTrace features.
Step 66+ — RoadSync and actual geospatial conflict handling.
Step 81+ — maps and layers.
Step 108+ — document/AI features.
```

Avoid premature imports of backend `mongoose`, `mongodb`, `express` or server secrets into `apps/web` UI primitives or `packages/shared-types`.

---

# 20. COMPONENT API CONSISTENCY & TYPE SAFETY

Maintain a small table in `docs/design/component-matrix.md`:

```text
Component | Base shadcn/Radix source | File | Props / variants | Accessibility notes
          | Source tokens | Tests | Future feature users
```

For each primitive:

- Native-like props where reasonable; never drop `aria-*`, `data-*` or standard input attributes.
- Strict TypeScript; no `any`, blanket `@ts-ignore` or broad ESLint disables.
- Stable size/variant naming; don't accidentally use `danger` on one component and `destructive` on another unless documented mapping exists.
- Refs and `asChild` behavior should follow installed library API; no outdated ref patterns copied from different React versions.
- Avoid deeply wrapped components that break Server Component compatibility or bundle unnecessary dependencies.
- Document controlled/uncontrolled behavior and required provider composition.
- No automatic import of app-specific domain services from base UI primitives.

---

# 21. DESIGN TOKEN & VISUAL QUALITY CHECKS

Use Step 17–18 **existing tokens**, rather than adding new raw hex values, spacing and radius literals to each component. Preserve approved colors:

```text
#FF5B00 orange — primary
#FEB600 yellow — warning/pending
#8C1F28 maroon — critical/rejected/conflict
#279541 green — success/approved/completed/resolved
#F8FAFC canvas; #FFFFFF surface; #111827 foreground;
#475569 secondary; #64748B muted; #E2E8F0 border
```

Check actual foreground/background pairs. Target WCAG 2.2 AA normal-text 4.5:1, large-text 3:1 and meaningful non-text boundary/indicator 3:1 where applicable; **don't claim a ratio passes without checking**. Pay special attention to buttons, badges, selected tabs, ghost buttons, disabled controls, alerts, tooltips, overlays, toast messages, and error states.

Use a consistent typography/spacing system to keep layouts calm. Avoid excessive gradients, glows, glassmorphism and animated effects in operational controls. Keep major GSAP effects in later landing experience rather than primitives.

Motion rules: respect `prefers-reduced-motion`; no long nonessential transitions; no entrance animation that hides important controls.

---

# 22. RESPONSIVE / OVERLAY / THEME INTEGRATION

Check at small mobile (approx. 320 / 375 CSS px), tablet (768) and desktop (1280):

- Button labels wrap/truncate appropriately; icon-only controls have touch/focus target.
- Input/select/date picker fit available width.
- Dialog/sheet max height supports internal scrolling.
- Table can scroll in its container without forcing overall page overflow.
- Long status labels and agency names remain readable.
- Tooltip/popover portals don't clip under containers.
- Overlay stack (`dialog`, `sheet`, `popover`, `tooltip`, `toast`) is ordered consistently with Step 18 z-index tokens.
- Body scroll and focus restore after overlay closes.

Full responsive app-shell work is Step 23; here validate **individual components and overlay mechanics only**. Dark mode remains P2 unless an accepted later decision changes it; preserve existing dark functionality without redesigning it.

---

# 23. DEVELOPMENT-ONLY COMPONENT VERIFICATION SURFACE

If a visual harness already exists, reuse it. Otherwise, **optional** minimal internal-only preview/test surface may display every primitive and state:

```text
Buttons: default/secondary/outline/ghost/destructive, sm/default/lg, disabled/loading
Input/Textarea: default/focus/invalid/disabled/read-only
Select: default/selected/disabled, long labels
DatePicker: blank/selected/clear/disabled
Card: normal, long title, header action
Badge/StatusBadge: pending/approved/high-risk/draft
Table: header, rows, long text, numeric alignment, narrow viewport
Dialog/AlertDialog: open, close, cancel/confirm, focus restore
Sheet: mobile drawer, close, scroll
Tabs: keyboard select and active indicator
Alerts: neutral/warning/critical/success
Tooltip: hover/focus, escape
Toast: manual trigger and dismiss
```

The preview must use **clearly synthetic labels and data** only. **Do not expose development-only diagnostics in a production public route.** Prefer Storybook only if already installed; adding Storybook just for this step is unnecessary. If a small temporary route is used, gate it out of production and document its removal/retention approach.

No fake project metrics, government endorsements, passwords or real user data.

---

# 24. TEST STRATEGY — UNIT, INTERACTION, ACCESSIBILITY

Inspect actual existing test tools first (e.g., Vitest/Jest + React Testing Library + user-event, Playwright, axe). Do not install entire alternative testing ecosystems without need. Introduce a **small justified set** only when essential and compatible with existing repo.

**Automated checks (minimum meaningful cases):**

1. Button variants render their expected accessible name and states; disabled/loading block action.
2. Icon action requires/has an accessible name.
3. Inputs render associated labels and honor `aria-invalid` and disabled/readonly.
4. Select supports keyboard navigation/value change (test with installed Radix environment; do not fake tests that cannot simulate overlays).
5. DatePicker handles empty/selected/clear and preserves date-only semantics.
6. Card slots render long content without invalid nested elements (manual layout test supplements unit).
7. Badges map semantic labels/status correctly; no color-only meaning.
8. Table renders semantic headers/cells/caption; narrow scroll wrapper manual test.
9. Dialog opens/closes, Esc/focus restoration, accessible title; destructive confirm separates cancel/action.
10. Sheet opens/closes and restores focus; mobile overflow manual test.
11. Tabs support keyboard selection and correct panel semantics.
12. Alert renders clear text and suitable ARIA role.
13. Tooltip is not the sole accessible label, keyboard focus support.
14. Toast can be triggered/dismissed by a user event; no toast fired simply on render.
15. Existing relevant `Step 17/18` contrast/token tests still pass.
16. No unexpected React hydration errors/warnings in browser preview when available.

Where useful, add axe scans on preview components; **do not claim full site WCAG compliance** from isolated axe results. Test with actual installed React/Next versions, not screenshots alone.

Record per test: command, suite/assertion, pass/fail, reason if unrun. Do not modify configured tests just to report green.

---

# 25. SECURITY & DATA-BOUNDARY REVIEW

This step is frontend-only, but still verify:

- No app secret or `process.env` private credentials in component code or client bundle.
- No HTML injection via unsafe `dangerouslySetInnerHTML`; render labels, badges, table cells and toast messages safely as React text by default.
- Do not use uncontrolled `href="javascript:..."` or make links that hide external destinations.
- Do not log passwords, token-like values or confidential sample data.
- Components do not interpret role/permission strings to authorize API actions; that's server responsibility.
- A disabled/hide action is usability, **not security**.
- Dialog/toast do not claim business success without a successful future backend response.
- No external network needed to demonstrate UI components; only install packages after inspection and with normal project policy.
- Component examples use dummy/synthetic content and not official-looking records.

**Backend integration:** No Express routes, database migrations, MongoDB schema changes or AI services required. Check web imports of Step 16 DTO/status constants if used and ensure they do not import server-only code.

---

# 26. DOCUMENTATION DELIVERABLES

Create or update concise existing equivalents (do not duplicate docs):

```text
docs/design/component-library.md
docs/design/component-matrix.md
docs/design/component-usage.md
docs/design/component-accessibility.md
docs/design/step-19-review.md
```

Document:

- Exact primitive inventory and file paths; reused/generated/custom status.
- Versions/generator commands actually used, and reason for dependencies.
- How to import, compose and theme components using Step 17/18 tokens.
- Compact code examples for Button, Input+Label, Select, DatePicker, StatusBadge, Table, Dialog, Sheet, Tabs, Alert, Tooltip and Toast.
- When overlays need providers and which layout owns them.
- Controlled/uncontrolled props, ref/`asChild` caveats.
- Accessible naming/focus/keyboard requirements.
- Semantic color mapping and tested contrast pairs.
- Browser/manual review notes, available screenshot references if actually captured (do not invent them).
- Step 20 Form wrapper extension points and Step 21 Data Table enhancement boundaries.
- Known limitations, deferred fixes and acceptance table.

---

# 27. VALIDATION ORDER

Run actual scripts discovered in the repo. Typical npm workspaces (adapt):

```bash
npm run lint --workspace apps/web
npm run type-check --workspace apps/web
npm run test --workspace apps/web
npm run build --workspace apps/web
```

If the app's package name differs, use `npm run lint -w <actual-package-name>` or the established root scripts. Do not use literal examples if they do not apply. Run relevant component tests first; then broad project regression:

```bash
npm run lint
npm run type-check
npm run test
npm run build
```

If a script/DB/network/browser is unavailable, mark `NOT RUN` or `BLOCKED` and explain, **not PASS**. Use mock/synthetic fixture props rather than connecting Atlas to test UI primitives.

Inspect browser when available (component harness or existing page). Cover: small mobile, tablet, desktop, keyboard-only; focus restore; selected tabs; modal/drawer overflow; date picker; toast; no console/hydration error; visible status labels; normal text/foreground color contrast. Distinguish automated vs manual checks.

**Fix/retest cycle:** reproduce → identify root cause → smallest appropriate fix → re-run focused case → re-run broader impacted regressions. Do not hide warnings with disabling rules.

---

# 28. POST-IMPLEMENTATION CODE REVIEW — MANDATORY

Return the following **filled in with observed evidence** and act on findings:

```text
STEP 19 POST-IMPLEMENTATION REVIEW

A. SCOPE & GIT
Current feature branch / start commit:
Dirty work preserved? Details:
Files created / modified / removed:
Any unrelated changes? Why:

B. ARCHITECTURE
Existing shadcn/Radix primitives reused vs generated:
Installed dependency compatibility:
App Router server/client boundaries:
Props, refs, variants, controlled state, import consistency:
Any duplicate or overabstracted components:

C. COMPLETE COMPONENT INVENTORY
Button / Icon action:
Input / Textarea / Label:
Select:
DatePicker:
Card:
Badge / StatusBadge:
Table base:
Dialog / AlertDialog:
Sheet / Drawer:
Tabs:
Alert:
Tooltip:
Toast:

D. DESIGN SYSTEM
Step 17 approved palette reused without overrides:
Step 18 tokens reused:
State semantics mapped accurately:
Contrast pair evidence:
Reduced-motion / focus policy:

E. ACCESSIBILITY & RESPONSIVE
Keyboard Tab / arrows / Esc / Enter / Space:
Focus trap / restoration for overlays:
Accessible names / roles / labels:
320px / 375px / 768px / 1280px:
Screen-reader / axe checks, if actually run:

F. SECURITY & BOUNDARIES
No exposed secrets / unsafe HTML / role-enforcement claims:
No APIs / DB / auth / dashboard app shell:
No Step 20/21/22 implementations:

G. TEST EVIDENCE
Baseline results:
Focused tests:
Web lint:
Web type-check:
Web test:
Web build:
Root regressions:
Browser preview / console:

H. ISSUES
Problems found and reproduction:
Fixes applied:
Re-tested commands and results:
Known limitations / ownership:

I. DOCS & HANDOFF
Component inventory and usage docs:
Review notes:
Suggested commit:
PR target:
Post-merge checks:
Approval pending:
```

**No cosmetic pass:** If critical overlay accessibility, runtime, type-check or build problems remain, Step 19 is `PARTIAL` or `BLOCKED`.

---

# 29. GIT DIFF REVIEW & INTEGRATION

Run:

```bash
git status --short
git diff --check
git diff --stat
git diff --name-only
git diff -- apps/web/src/components apps/web/src/app apps/web/src/styles
```

Review any untracked new files separately because `git diff` does not show them. Inspect dependency/lockfile changes and `components.json`. Ensure there is no accidental `public` government badge/image, `.env`, new endpoint, database model or unrelated route.

Suggested commit (manual after approval):

```text
feat(ui): establish reusable INFRAOS component primitives
```

Prepare PR handoff to `development`: summary, exact components, screenshots/manual evidence if real, test matrix, known limitations, integration risk, required reviewers, post-merge verification commands. Do **not** automatically push, merge or delete the branch.

After user/team-approved feature merge into `development`, re-run impacted web lint/types/tests/build and relevant design token tests; inspect component imports from existing pages and any hydration/portal issue. Do not merge `development` to `main` just because Step 19 is done; later Phase 3 design-system steps remain.

---

# 30. ACCEPTANCE CRITERIA — STEP 19

Mark COMPLETE only when every applicable item is satisfied, or accurately report a clearly justified deferred/nonapplicable item. **Missing critical primitives are not silently optional.**

- [ ] Written pre-step review with actual source/docs/code/Git/dependency baseline.
- [ ] Dedicated feature branch based on approved up-to-date `development`, or a documented blocker.
- [ ] Steps 17/18 tokens are confirmed integrated; no legacy active navy/orange palette reintroduced.
- [ ] All roadmap-listed component categories implemented or normalized: button, input, select, date picker, card, badge, base table, dialog, drawer/sheet, tabs, alert, tooltip and toast.
- [ ] Reuses compatible shadcn/Radix primitives rather than duplicating systems.
- [ ] Components are strongly typed, reusable, documented and compose without invalid DOM nesting.
- [ ] Consistent semantic palette, typography, spacing/radius/elevation/motion/focus tokens are reused.
- [ ] Raw brand colors have accessible foreground variants; meaningful status never color-only.
- [ ] Icon-only controls have accessible names; labels, disabled/invalid states and focus are correct.
- [ ] Select, date picker, tabs, dialog, sheet, tooltip and toast interaction behavior verified.
- [ ] Dialog/sheet accessibility (title, focus, Esc, return focus, scroll) verified.
- [ ] Base table preserves semantic HTML and narrow-viewport scroll.
- [ ] Toast provider integration is singleton where appropriate and doesn't fake backend success.
- [ ] Strict TypeScript and App Router server/client boundaries respected.
- [ ] Focused tests run, Step 17/18 regressions run and outcomes accurately recorded.
- [ ] Lint/type-check/build and available relevant tests pass; unresolved failures disclosed.
- [ ] Manual responsive and keyboard review run when preview available, or explicitly marked NOT RUN.
- [ ] Documentation and component matrix complete and aligned with code.
- [ ] Security review: no secrets, unsafe HTML, backend auth changes or fake permissions.
- [ ] No Step 20/21/22/23+ implementation or unrelated feature-page development.
- [ ] Git diff/untracked files inspected, safe commit/PR proposal prepared.
- [ ] Integration into `development` and `main` remains approval-gated.
- [ ] Final report contains actual evidence and stops after Step 19.

---

# 31. FINAL HANDOFF REPORT TEMPLATE

```text
INFRAOS — STEP 19 IMPLEMENTATION REPORT

STATUS: COMPLETE / PARTIAL / BLOCKED
Reason if not COMPLETE:

BASE: development @ <commit>
FEATURE BRANCH: feature/step-19-reusable-ui-components
WORKTREE / STARTING CONDITIONS:

IMPLEMENTED / REUSED PRIMITIVES:
1. Button / optional IconButton:
2. Input / Textarea:
3. Select:
4. DatePicker:
5. Card:
6. Badge / StatusBadge:
7. Table primitives:
8. Dialog / AlertDialog:
9. Sheet / Drawer:
10. Tabs:
11. Alert:
12. Tooltip:
13. Toast:

FILE CHANGES:
DEPENDENCIES INSTALLED / WHY:
DESIGN TOKENS REUSED:
STATUS/CONTRAST REVIEW:
APP ROUTER CLIENT/SERVER REVIEW:
ACCESSIBILITY & KEYBOARD RESULTS:
RESPONSIVE / OVERLAY REVIEW:
SECURITY / DATA BOUNDARIES:

CHECKS (PASS / FAIL / NOT RUN / N/A + commands):
Baseline lint/types/tests/build:
Focused component tests:
Web lint:
Web type-check:
Web tests:
Web build:
Root regression:
Browser visual/keyboard QA:

ISSUES FOUND AND FIXED:
REMAINING BLOCKERS / LIMITATIONS:
DOCS UPDATED:
GIT DIFF STATUS:
SUGGESTED COMMIT: feat(ui): establish reusable INFRAOS component primitives
PROPOSED MERGE: feature/step-19-reusable-ui-components → development
POST-MERGE VERIFICATION:
MAIN MERGE: NOT AUTHORIZED / NOT DONE
NEXT ELIGIBLE ROADMAP STEP: Step 20 — Forms & Validation UI System

STOP. Do not begin Step 20 automatically.
```

---

# FINAL HARD STOP

**Do not proceed to Step 20, 21, 22, 23 or any later steps.** Do not auto-commit/push/merge/delete branches, alter `main`, change MongoDB/Express/FastAPI, or claim tests or UI previews ran when they did not. Wait for explicit user/team review and authorization.
