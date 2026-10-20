# INFRAOS — Complete Enhanced Development Prompt
## Phase 3 · Step 24 — Accessibility Foundation & Design-System Accessibility Verification

**Project:** INFRAOS — National Infrastructure Intelligence & Coordination Platform  
**Product vision:** *The Operating System for National Infrastructure*  
**Lifecycle:** Plan → Coordinate → Approve → Build → Verify → Monitor → Complete → Maintain  
**Roadmap position:** Phase 3, **Step 24 only**; proposed next step **Step 25**, first public-landing task  
**Branch:** `feature/step-24-accessibility-foundation`  
**PR target:** `development` after tests/review/explicit approval  
**Main branch:** protected; only update from `development` at a separately approved stable checkpoint  
**Companion:** `INFRAOS_Cursor_Execution_Prompt_Step_24.md`  
**Primary execution agent:** Cursor, whichever approved model is active  
**Quality target:** WCAG **2.2 AA** for **currently implemented, in-scope UI**, using automated checks **plus manual keyboard/assistive-technology review**. A partial audit is not a WCAG certification.

> **Source and reality check:** The previous INFRAOS planning identifies Step 24 as the **Accessibility Foundation** and Steps 22–23 as UI feedback states and responsive application shell. The original `Steps.docx` is not currently mounted in the prompt-authoring workspace; the coding agent must read the repository's canonical roadmap and architecture before implementing, and report discrepancies rather than silently rewriting the roadmap. Previous `.md` prompt preparation does **not** prove that any implementation was merged.

---

# 0. EXECUTION MANDATE — EXACT SCOPE AND NO SKIPPING

You are the **INFRAOS Principal Accessibility Architect, Next.js/React/TypeScript Engineer, shadcn/Radix UI Specialist, Inclusive Government UX Designer, Frontend Security Reviewer, Test Automation Engineer, and Git Integration Reviewer**.

Your task is to establish and verify a **durable accessibility foundation** for the INFRAOS interface already built by the end of Step 23. It includes measuring existing accessibility, fixing defects directly inside approved Step 17–23 components/layouts, building a sustainable accessibility testing and review practice, and documenting any blocked/deferred cases. It does **not** mean implementing complete accessibility for routes or features that do not exist yet.

**Mandatory sequence:**

```text
PRE-STEP AUDIT / GIT + REQUIREMENTS
  → VERIFY STEP 23 IN DEVELOPMENT
  → WRITTEN PLAN / FINDINGS BASELINE
  → SAFE STEP-24 FEATURE BRANCH
  → INCREMENTAL ACCESSIBILITY FIXES
  → AUTOMATED + MANUAL TESTS
  → INDEPENDENT POST-IMPLEMENTATION REVIEW
  → FIX DEFECTS + RETEST
  → SECURITY / SCOPE / DIFF REVIEW
  → DOCS + COMMIT/PR PROPOSAL
  → APPROVAL-GATED INTEGRATION INTO DEVELOPMENT
  → POST-MERGE SMOKE CHECK
  → STOP (DO NOT BUILD STEP 25)
```

**Hard gates:**

1. Check repository instructions (`AGENTS.md`, `.cursor/rules/*`, existing step execution rules), the canonical roadmap and accepted documentation.
2. **Verify Steps 17–23 actually exist and Step 23 is reviewed and integrated into the latest `development`**. If missing, STOP and report the prerequisite; do not claim accessibility foundation is ready on top of nonexistent shell/components.
3. Check Git status/untracked files before switching branches. Preserve teammates' work, `Prompts/` documents and existing uncommitted changes; never run destructive Git commands.
4. Implement Step 24 only. Fix only accessibility bugs in already implemented reusable components, current routes, app shell and state UI. Broader cross-feature remediation requires approval.
5. Use current installed Next.js/Tailwind/shadcn/Radix/testing versions; do not copy code from an incompatible version or upgrade packages gratuitously.
6. **No new Express/MongoDB/FastAPI routes, auth/RBAC, GIS capabilities, RoadSync/ProjectTrace workflows, landing pages, production datasets, payments, notifications, new server infrastructure or new themes.** A frontend-only accessibility fix should not mutate backend business logic.
7. Final status must be **COMPLETE, PARTIAL or BLOCKED**, supported by **PASS / FAIL / NOT RUN / N/A** evidence. Do not claim WCAG compliance or screen-reader verification from an axe scan alone.
8. Do not automatically commit, push, create a remote PR, merge into `development`, merge into `main`, delete branches, reset or force-push. Prepare handoff and await explicit authorization.
9. Do not start Step 25 until Step 24 is reviewed and the user authorizes continuation.

---

# 1. INFRAOS PRODUCT, ARCHITECTURE AND USERS

INFRAOS is a Sri Lankan infrastructure coordination platform unifying **ProjectTrace** (project accountability, milestones, progress), **RoadSync** (deterministic cross-agency geospatial/time conflict discovery and coordination), **InfraMap**, AI Risk, **DocTrace**/RAG, Finance/Contractors, Inspections, Assets/Maintenance, Citizen Issues, Reporting and Audit. The central demo is road resurfacing and water-pipeline works whose geometries and schedules overlap; future users coordinate an explainable resolution.

This design foundation must work for varied users including government officials, agency coordinators, project managers, inspectors, contractors, admins and citizens with different input devices and accessibility needs. It must be a clear professional **government/enterprise** interface rather than a heavily animated marketing UI.

**Architecture boundaries (inspect actual repo):**

```text
apps/web   Next.js App Router / React / TypeScript
           Tailwind + shadcn/ui + Radix primitives
           React Hook Form + Zod (Step 20)
           TanStack Table (Step 21)
           Loading/empty/error/success states (Step 22)
           Responsive app shell/navigation (Step 23)
                  |
                  | typed DTOs; /api/v1 HTTP contracts
                  v
apps/api   Express / TypeScript modular monolith, auth/RBAC in later steps
                  |
                  v
MongoDB Atlas / Mongoose / GeoJSON 2dsphere indexes
                  + future FastAPI AI service
packages/shared-types (if implemented) — API DTO/status enums/permission keys
```

**This step is not an authorization to create login/permissions**. An accessible hidden/disabled button is not a security control. Agencies/roles/resources are checked on the backend when their feature steps arrive. Future routes can be documented but must not masquerade as real accessible flows.

---

# 2. BRAND AND ACCESSIBLE SEMANTIC PALETTE — LOCKED

Approved exact brand identity swatches:

| Meaning | Raw hex | Core usage |
|---|---|---|
| Primary | `#FF5B00` | Brand, selection, primary action emphasis |
| Warning/Pending | `#FEB600` | Needs attention, coordination pending |
| Critical/Conflict | `#8C1F28` | High risk, rejected/blocked, severe conflict |
| Success/Resolved | `#279541` | Approved, completed, resolved, healthy |

Approved neutral reference set:

```text
canvas  #F8FAFC
surface #FFFFFF
text    #111827
secondary text #475569
muted text #64748B
border  #E2E8F0
```

**Accessibility constraints:**

- Maintain exact **raw brand** values as identity colors. Don't darken the source swatches silently or reintroduce older navy `#0F172A` / orange `#F97316` as dominant theme.
- Use existing, **verified high-contrast semantic foreground tokens** from Step 17 for buttons, badges, warnings, links and status descriptions. The raw orange (`#FF5B00`) has only ~3.1:1 contrast against white, yellow (`#FEB600`) ~1.8:1, and raw green (`#279541`) ~3.8:1 with white; these are **not** ordinary-size white-text/white-background pairings that pass 4.5:1. Verify real CSS computations and hover/focus/disabled states, rather than trusting approximate numbers.
- Normal-sized readable text should meet **4.5:1**; large text **3:1**; meaningful UI non-text boundaries, focus indicators and graphic elements **3:1** where WCAG requires it. Treat disabled/inactive controls according to WCAG exceptions while keeping their purpose recognizable.
- Never communicate a government approval, conflict, error, warning or success by hue alone. Include persistent text, icons/patterns, outline or other redundant markers.
- Text links must be distinguishable from surrounding text through more than color alone when needed (e.g., underline). Error messages must say what action is needed; don't rely on a red border.
- Preserve established typography/spacing and restrained motion from Step 18. Full dark-mode design remains deferred unless already implemented and accepted; do not create a second theme framework.

---

# 3. STANDARDS, PRIORITY AND DEFINITION OF COMPLETE

## 3.1 Baseline standard

Target **WCAG 2.2 Level AA** within current Step 17–23 frontend surface, including applicable WCAG 2.0/2.1 requirements. Use the *actual normative success criteria* instead of claiming that every suggested heuristic is a normative requirement. Pay particular attention to:

| WCAG criterion | Concern | What to verify now |
|---|---|---|
| 1.1.1 Non-text Content | Text alternatives | Logo icon/image alt, decorative SVG hidden, icon-only actions named |
| 1.3.1 Info and Relationships | Semantic structure | Headings, form labels, tables, alerts, navigation landmarks |
| 1.3.2 Meaningful Sequence | Correct order | DOM order matches accessible reading/tab order |
| 1.3.4 Orientation | Landscape/portrait | No unjustified forced orientation |
| 1.3.5 Identify Input Purpose | Known personal data fields | `autocomplete` for applicable currently implemented forms |
| 1.4.1 Use of Color | No color-only meaning | Status badges, validation, selected navigation, KPI indicators |
| 1.4.3 Contrast (Minimum) | Text | 4.5:1 normal; 3:1 large text |
| 1.4.4 Resize Text | Scaling | 200% zoom without lost content/functionality |
| 1.4.10 Reflow | 320 CSS-px equivalent | No horizontal page scrolling except permitted 2D content like maps/tables |
| 1.4.11 Non-text Contrast | Visual components | 3:1 for required discernible boundaries/graphics |
| 1.4.12 Text Spacing | User overrides | Test increased line/paragraph/letter/word spacing |
| 1.4.13 Content on Hover/Focus | Tooltips/popovers | Dismissible, hoverable, persistent as applicable |
| 2.1.1 Keyboard | All interactive content | Tab, Enter, Space, Esc, arrow keys per widgets |
| 2.1.2 No Keyboard Trap | Escape reachable | Dialog/drawer trap intentionally bounded and closable |
| 2.1.4 Character Key Shortcuts | Single-char shortcuts | Avoid unexpected shortcuts; allow disable/remap where implemented |
| 2.2.2 Pause, Stop, Hide | Moving content | No uncontrollable nonessential auto-motion |
| 2.4.1 Bypass Blocks | Skip links | App shell skip link targets main content |
| 2.4.2 Page Titled | Document titles | Current routes have meaningful titles |
| 2.4.3 Focus Order | Predictable | Mobile menu, dialog, filters, forms |
| 2.4.4 Link Purpose | Understandable links | Avoid ambiguous “click here” |
| 2.4.6 Headings and Labels | Clear text | Descriptive page titles, inputs, grouped controls |
| 2.4.7 Focus Visible | Visible focus | Buttons, controls, links, tables |
| 2.4.11 Focus Not Obscured (Minimum) | WCAG 2.2 AA | Sticky header/drawers don't entirely obscure focused items |
| 2.5.3 Label in Name | Visible label parity | Accessible names contain visible label |
| 2.5.7 Dragging Movements | Alternative available | If drag interaction exists, provide alternative |
| 2.5.8 Target Size (Minimum) | WCAG 2.2 AA | 24×24 CSS px or relevant spacing/exception; recommend larger touch targets where useful |
| 3.1.1 Language of Page | Document language | Correct `lang` for current content |
| 3.2.1 On Focus | Predictability | Focus doesn't auto-navigate or trigger action |
| 3.2.2 On Input | Predictability | Unannounced changes avoided; appropriate behavior documented |
| 3.3.1 Error Identification | Error message | Field errors named/explained |
| 3.3.2 Labels or Instructions | Inputs | Requiredness and format guidance |
| 3.3.3 Error Suggestion | Actionable fixes | Helpful validation guidance where possible |
| 4.1.2 Name, Role, Value | Custom widgets | Radix/shadcn controls properly announced |
| 4.1.3 Status Messages | Announcements | Loading/error/success changes announced appropriately |

Also inspect applicable **WCAG 2.2 criteria** such as **3.3.7 Redundant Entry** where current forms repeat information, and **3.3.8 Accessible Authentication (Minimum)** if any actual authentication route is already implemented. Do not fabricate an auth screen merely to meet a future criterion. For complex cases consult the official normative criteria and record applicability.

## 3.2 Distinguish tests from certification

- Automated tools (axe, eslint rules) catch **a subset** of violations, not keyboard/focus/order/cognitive barriers reliably.
- Screenshots alone cannot establish assistive-technology usability.
- **Screen-reader results must be marked NOT RUN** unless a human/agent actually used a real tool such as NVDA, VoiceOver or TalkBack, or an equivalent verified assistive-technology test procedure.
- Browser zoom/reflow/text-spacing must be checked in a real browser where available; if not, document a manual follow-up protocol.
- Do not claim “INFRAOS is WCAG 2.2 AA compliant” globally when only existing foundation components/accessible routes were checked.

## 3.3 Severity and fix priority

| Severity | Example | Action |
|---|---|---|
| P0 blocker | Keyboard-inaccessible primary navigation; modal focus trap that prevents escape; inaccessible essential form action | Must fix before `COMPLETE` |
| P1 major | Missing label/accessible name, broken error association, contrast failure on important text, serious 320px reflow | Fix in Step 24 or mark `PARTIAL/BLOCKED` |
| P2 moderate | Inconsistent text spacing, confusing announcement behavior, nonessential decorative alternative | Fix in scope when safe; otherwise file specific follow-up |
| P3 polish | Nonessential aesthetics or low-impact documentation suggestions | Document; do not expand scope |

When a bug affects a future module not yet implemented, record as **future acceptance requirement** instead of creating that module early.

---

# 4. PRE-IMPLEMENTATION REVIEW — BEFORE ANY EDIT

Inspect repository and Git:

```bash
git status --short
git branch --show-current
git remote -v
git log --oneline -n 12
git branch -a
```

Inspect actual current files (paths are indicative, not assumptions):

```text
AGENTS.md, .cursor/rules/*, CURSOR_STEP_EXECUTION_RULES.md, CONTRIBUTING.md
package.json, lockfile, workspaces, web scripts, test configuration
apps/web/package.json
apps/web/src/app/layout.tsx, globals.css, current actual routes
apps/web/src/app/**/layout.tsx, loading.tsx, error.tsx, not-found.tsx
apps/web/src/components/ui/*             Steps 17–19
apps/web/src/components/common/*         shared components
apps/web/src/components/forms/*          Step 20 forms (if actual)
apps/web/src/components/table/*          Step 21 data tables (if actual)
apps/web/src/components/states/*         Step 22 states (if actual)
apps/web/src/components/layout/*         Step 23 shell (if actual)
apps/web/src/providers/*, lib/*, hooks/*
apps/web/components.json, Tailwind v3/v4 configuration
packages/shared-types/*                   DTO/error/status contracts
Prompts/*, docs/design/*, docs/architecture/*, docs/security/*,
docs/ux/*, docs/api/*, docs/team/*, docs/adr/*
```

**Verify exact Step 23 merge** into `development` by looking at integration commit, PR record if available, active shell files and tests. Also verify the chain Steps 17–22; no assumption from prompt documents. Review the existing accessibility suite, dependency versions and shadcn/Radix behavior. Inspect actual implemented routes; do not invent `/dashboard`, `/admin`, `/login`, `/projects`, etc. as working routes if not present.

Perform a **read-only baseline audit** before editing. Capture the currently implemented surfaces, e.g. app root, shell, mobile drawer, forms gallery/test route, data table gallery/test route, state previews and any legitimate public pages. Avoid seeding real data, making auth changes or contacting production systems. If previews require data, use current *synthetic fixtures* in test/dev environment only.

**Required report:**

```text
STEP 24 — PRE-IMPLEMENTATION REVIEW

1. Repo + source:
   Current branch / commit / remotes:
   Dirty/untracked/staged work and ownership:
   Accepted steps 17–23 evidence:
   Step 23 reviewed + merged in development? proof:
   Current Next.js/React/Tailwind/shadcn versions:
   Current test packages and scripts:
   Canonical roadmap Step 24 wording and any mismatch:

2. In-scope implemented surface inventory:
   Actual routes:
   Layout/app shell/navigation:
   UI primitives:
   Form components:
   Tables:
   Feedback state components:
   Theme/font/token source:

3. Accessibility baseline:
   Automated scan results (actual commands + routes):
   Keyboard audit findings:
   Screen reader/manual scan results or NOT RUN:
   Reflow/zoom/text spacing results or NOT RUN:
   Contrast findings with actual token pairs:
   Severity-ranked issue ledger:

4. Plan:
   Scope-limited candidate files:
   Proposed focused fixes by P0/P1/P2:
   Proposed tests + manual browser matrix:
   Dependency/install risks:
   Teammate-owned files coordination:
   Decision: PROCEED / LIMITED SAFE WORK / BLOCKED
```

**Blocking conditions:** Step 23 not verified/merged; dirty work would be overwritten; repo root unclear; automated commands would contact production or leak data; missing required token architecture; security-sensitive route changes outside scope; incompatible dependency upgrade required. If blocked, stop, explain and request approval. Do not invent a “completed” implementation.

---

# 5. DEDICATED BRANCH / SAFE GIT STRATEGY

After pre-review and when safe:

```bash
git switch development
git pull --ff-only origin development
git switch -c feature/step-24-accessibility-foundation
git rev-parse --short HEAD
```

Commands are **templates**: inspect remote, branch protection, existing branch and working tree first. Do **not** auto-stash, reset, force checkout, rebase or overwrite teammate files. If the operator's policy requires approval even for the pull/branch operation, pause and request it. Retain the untracked `Prompts/` files; do not automatically include them in the code PR.

Suggested **commit message**, after explicit user/team approval:

```text
feat(a11y): establish INFRAOS accessibility foundation
```

Target the PR to `development`; `main` is not part of this step's automatic workflow. Since Step 24 finishes Phase 3's design-system foundation, a *separate* `development → main` release checkpoint may be considered **only after approved full-phase regression, review and authorization**.

---

# 6. PHASE A — ACCESSIBILITY INVENTORY AND TEST MATRICES

## 6.1 Create a route/component audit matrix

For each actually implemented route/component, record:

```text
Route / Component | Exists? | User goal | Keyboard | Semantics | Contrast
                  | Reflow/Zoom | Live updates | Automated scan
                  | Manual AT check | Issue(s) | Owner | Status
```

Create an issue ledger with stable IDs (e.g., `A11Y-001`), **actual reproduction steps**, the relevant WCAG criterion(s), severity P0–P3, affected existing files, before/after results, and owner. Don't create low-signal tickets from isolated generic code suggestions without verifying behavior.

## 6.2 Define representative workflows

Test only what exists, including representative current scenarios:

1. Open current app route → skip navigation → land at main content.
2. Navigate desktop sidebar/header with keyboard; verify readable current-page state.
3. Open/close mobile nav drawer; escape, trap and return focus correctly.
4. Navigate tablist, dropdowns/select/calendar, tooltips and dialogs from Step 19.
5. Fill any **existing** Step 20 form preview; trigger and fix validation; submit synthetic fixture and receive truthful result.
6. Operate Step 21 table sorting/filter/pagination/column visibility/selection if implemented; preserve accessible sort announcements and semantic headers.
7. Encounter Step 22 loading/empty/error/success and retry scenarios without premature/fake success announcements.
8. Increase zoom and text spacing; inspect sticky headers, overlays and page content.
9. Toggle reduced motion; verify controls remain usable.
10. Use screen-reader-specific navigation/announcements if a real tool is available.

If some route/component is absent, mark **N/A — not implemented**, not a fabricated PASS.

## 6.3 Baseline artifacts

- `docs/accessibility/step-24-baseline.md` (or existing equivalent): actual tested routes, versions, dates, evidence, gaps.
- `docs/accessibility/findings.md`: prioritized ledger with clear IDs and status.
- `docs/accessibility/test-matrix.md`: automated/manual verification cases.

No need to install a paid audit platform or build a custom dashboard merely to store findings.

---

# 7. PHASE B — DOCUMENT SEMANTICS AND STRUCTURE

Audit/fix **current** root/layout and reusable UI:

- Correct document `lang` for current page content (`en` for English UI; use appropriate language tagging when current content actually mixes languages). Do not claim full Sinhala/Tamil localization implemented.
- Meaningful Next.js `metadata.title`/title templates for actual routes; use accurate project/app labels.
- One clear semantic main landmark, proper `header`, `nav`, `aside` as applicable; avoid duplicate unnamed same-type nav landmarks without labels.
- Functional `<a href="#main-content">Skip to main content</a>` that becomes visible on keyboard focus and targets current main content. Validate target focus/scroll offset where necessary.
- Proper heading hierarchy, descriptive names; no global text-size change in place of semantic headings.
- Real lists for navigation/list content, buttons for actions and anchors for navigation. Avoid click handlers on plain `div`/`span`.
- Meaningful image alternative text and icon-only button accessible names. Pure decoration marked appropriately, rather than noisy duplicate accessible names.
- Correct page/section language when existing multi-script content appears; no hidden “official government” copy invented.
- Preserve server-component rendering where possible; don't convert entire App Router layout to client just to add an aria attribute.

**Scope guard:** Don't implement new route pages, auth screens, public citizen app, full localization or SEO feature redesign.

---

# 8. PHASE C — KEYBOARD NAVIGATION AND FOCUS MANAGEMENT

## 8.1 Keyboard coverage

- Tabbing follows DOM/visual reading order; avoid positive `tabIndex` hacks.
- Every interactive component operates via standard keys or the relevant ARIA Authoring Practices widget pattern (Select, Tabs, Dialog, Menu, Calendar, etc.).
- Dropdown/select/calendar supports open/close, arrow keys and selection; preserve installed Radix keyboard behavior.
- No keyboard trap outside intentional modal containment. Dialog/Sheet return focus to trigger on dismiss or an appropriate new location if the trigger was removed.
- Escape closes dismissible overlays; destructive confirmation still requires explicit choice.
- Focus remains visible during sticky headers/mobile drawer operations; when navigation collapses content, focus is not lost into hidden DOM.
- Explicit mobile drawer close trigger has accessible label and sufficient target size.
- `aria-current="page"` for actual active links, not merely orange color.
- Keyboard users can operate sortable headers, table actions, filter chips and pagination if implemented.

## 8.2 Client-side navigation / focus after route transitions

Review actual Next.js navigation behavior. Where focus remains in a removed sidebar/menu or a dynamically changed route, implement the **least disruptive, version-compatible** pattern to announce route change and position focus sensibly, without focus-stealing on every render or introducing an unnecessary global router library. Prefer existing shell focus/skip-link pattern; document behavior of dynamic segment loading/error screens.

## 8.3 Focus visibility and sticky overlap

- Check `focus-visible` contrast and visible shape on white, slate, orange, yellow, green and maroon surroundings.
- Prevent sticky header/drawer/toolbars from **entirely** obscuring the focused element; consider scroll padding/margin adjustments if appropriate.
- Do not remove outlines globally or replace them with a low-contrast shadow.
- Where target-size criterion applies, verify **24×24 CSS px** minimum or valid spacing/exception. Recommend larger mobile targets (~40–44 CSS px) where practical without treating that recommendation as a universal WCAG 2.2 AA rule.

---

# 9. PHASE D — FORMS, ERRORS AND INSTRUCTIONS

Audit Step 19 base controls and Step 20 RHF/Zod wrappers **as they actually exist**:

- Inputs have stable programmatically associated label; not placeholder-only.
- Required fields communicate requiredness in text/semantics, not just a red asterisk or border.
- Format constraints/instructions visible and associated using `aria-describedby`.
- `aria-invalid` indicates invalid fields only when appropriate; error text IDs remain stable.
- First invalid field can be focused after failed submission, *without preventing users from exploring the full error summary*.
- Group radio/checkbox fields with `fieldset`/`legend` or accessible alternative.
- React Hook Form and Zod resolver do not produce errors that silently disappear for keyboard/screen reader users.
- Form-level error summary (if needed) links to fields, shows safe user-facing messages and does not expose stack traces/private backend details.
- Async submit: distinguish submitting, failure and confirmed success; no fake optimistic approval or duplicate actions.
- Date picker announces selected date and supports keyboard; date-only strings remain separate from UTC timestamp semantics.
- LKR money input reflects exact minor unit validation, not floating point assumptions; actual finance business rules belong to later module.
- Password/auth fields are future Step 35+ work; no login pages or password-validation system here.

Ensure user-friendly error messages maintain backend constraints; frontend validation is not a replacement for authoritative API validation.

---

# 10. PHASE E — TABLES, STATUS, LIVE UPDATES AND FEEDBACK

## 10.1 Step 21 advanced table

- Semantic `<table>` / `<th scope="col">` and accessible captions when needed.
- Sorting controls exposed as buttons, with current sort direction through `aria-sort` on the appropriate header cell or equivalent correct semantics, not color alone.
- Filters, column visibility, pagination and row selection have discernible labels.
- Pagination announces current page and correct available page count without fabricating rows.
- Row actions named contextually (e.g., “Open project INF-ROAD-001”), not an ambiguous series of unlabeled ellipses.
- Virtualized data rows, if implemented, require thoughtful accessibility and may need separate review; do not introduce virtualization here.
- A table requiring two-dimensional layout may legitimately scroll horizontally, but **the surrounding page must not overflow unnecessarily**; provide discoverability of its scroll region.
- Restricted columns/data cannot become accessible merely by hiding their display; server-side projections/RBAC enforce confidentiality.

## 10.2 Step 22 feedback

- Distinguish `Loading`, `No results`, `No data`, `Forbidden`, `Not found`, `Error`, `Retry`, `Confirmed success` with **accurate words and states**; never imply successful API mutation before a confirmed response.
- Avoid blanket `role="alert"` for static benign content.
- Use `role="status"` / `aria-live="polite"` for useful background updates and `role="alert"` for truly urgent actionable failures; avoid duplicate/nested announcements.
- Spinner/skeleton is not the only indication of a long-running request; provide usable text and prevent unnecessary rapid re-announcements.
- Retry actions are true buttons with accessible name, visible focus and clear available behavior.
- Document when focus should move after a major route-level state change vs. when live announcement is less disruptive.
- Status badges use label+icon/shape, not solely orange/yellow/maroon/green.

## 10.3 Current overlays / notifications

- Dialog/Sheet/Popover title and description semantics checked; close/escape/focus restoration verified.
- Tooltip must not contain essential information exclusively and must be dismissible/hoverable/persistent when WCAG 1.4.13 applies.
- Toasts preserve sufficient reading time/dismiss option when needed, no duplicate live regions, safe contents without secret leakage.
- No Socket.IO, Notification Center, audit-log event or push-notification feature implementation in this step.

---

# 11. PHASE F — CONTRAST, RESPONSIVE REFLOW, ZOOM AND MOTION

## 11.1 Test actual computed colors

Check foreground+background pairs in **normal, hover, pressed, focus-visible, invalid, selected, disabled, pending, critical, success and alert** states. Include buttons, text links, sidebar, breadcrumbs, form fields, placeholders where applicable, table headers, empty/error states, toast, dialog and tooltip. Verify what WCAG applies to each element; disabled inactive components may be exempt from some requirements, but still should be understandable.

Do not redefine palette or litter files with hardcoded hexes. Fix values at semantic token or component-class level, preserving exact brand raw colors and the established Step 17/18 source of truth.

## 11.2 Reflow/zoom

Reference checks:

```text
Browser viewport CSS width 320px (or desktop 1280px at 400% zoom)
375px phone
768px tablet
1280px desktop
200% text zoom
400% zoom / 320 CSS px equivalent
Portrait and landscape where device available
User text spacing overrides per WCAG 1.4.12
```

Check:

- Header/sidebar/mobile drawer and skip link remain reachable.
- Sticky headers/footers don't cover focus or validation errors.
- Forms, tables, dialogs, popovers and date pickers do not clip critical controls.
- Body text remains readable when resized; ellipsis doesn't permanently hide needed content.
- No horizontal page scroll in reflow except content requiring two dimensions (data tables/maps/diagrams), according to WCAG exceptions.
- MapLibre is future work; don't build a map solely to audit accessibility.

## 11.3 Motion

- Respect `prefers-reduced-motion: reduce`; avoid essential status changes communicated only by animation.
- Toast/dialog state transitions should not trap user while animating.
- Avoid autoplaying video, motion-heavy decorative backgrounds or unnecessary GSAP here; landing animation is later Step 33.

## 11.4 Forced colors / high contrast

Where environment supports it, test Windows forced-colors or browser simulation. Ensure focus indicators, selected state and form boundaries remain discernible. Don't overwrite system focus colors with invisible CSS. Record unsupported environments as NOT RUN.

---

# 12. PHASE G — TEST TOOLING / AUTOMATION / MANUAL PROTOCOL

## 12.1 Discover existing test stack

Determine installed Vitest/Jest, React Testing Library/user-event, Playwright, `axe-core`/`@axe-core/playwright`, ESLint a11y rules and CI scripts. Prefer reuse. New lightweight packages can be proposed only after version/lockfile compatibility review; avoid installing Storybook or a paid scanner simply to tick a box.

Implement **focused automated accessibility tests** for existing surfaces where possible:

```text
- App shell landmarks + skip navigation link
- Header/sidebar accessible nav names and aria-current
- Mobile Sheet open, focus trap, Esc, close and return focus
- Button/icon label + focus/disabled behavior
- Form label, description/error association, invalid submit focus
- Select, DatePicker, Dialog, Tabs and Tooltip keyboard flow
- TanStack Table semantic headers and accessible sort/pagination
- Step 22 status messages and Retry interaction
- Semantic status badge text and contrast contract
- Portal/z-index access and reduced-motion smoke if tooling permits
```

Use `@axe-core/playwright` on **actually available** routes and relevant component preview/fixtures; handle async stabilization carefully. Never assert 0 violations against an empty page, mocked-out component tree or ignored rules without explanation.

## 12.2 Representative keyboard / manual test script

Provide a reproducible `docs/accessibility/manual-test-protocol.md` including:

1. Open tested route in supported browser; document URL/build and test data.
2. Press Tab from the top; observe skip link, focus visibility and main target.
3. Traverse nav/buttons; verify tab order, `aria-current`, focus not obscured.
4. Open and close mobile drawer with Enter/Space/Escape; verify focus restore.
5. Open a modal, navigate controls, ensure keyboard cannot escape modal unintentionally and returns focus when closed.
6. Test select/calendar/tabs; keys follow widget semantics.
7. Cause synthetic validation failure and verify error summary/field association; retry with valid data.
8. Sort/page/filter a table and verify state is discernible and keyboard operable.
9. Trigger loading/error/retry/success states; verify accurate announcement behavior.
10. Zoom 200% and 400%, test 320px reflow, text-spacing overrides and reduced motion.
11. Test supported screen reader and record OS/browser/AT version and actual observations; if not possible, clearly NOT RUN.

Include a **pass/fail evidence log**; screenshots may help but do not replace testing. No requirement to capture actual private data.

## 12.3 Accessibility regression scripts / CI

Where existing CI allows and tests are stable, add accessibility test execution to the web project's existing test pipeline and document local commands. Prefer scoped Playwright suite over a broad fragile sitewide scan. Do not modify branch protection rules or GitHub Actions CI/deployment workflows without explicit permission; prepare a follow-up recommendation if integration requires those settings.

Run actual available project equivalents of:

```bash
# Discover available workspace commands first; syntax illustrative only
npm run lint
npm run type-check
npm run test
npm run build
# optional existing Playwright/a11y scripts only if present/configured
npm run test:e2e
npm run test:a11y
```

Do not invent or claim scripts, tests, screenshots, AT observations or live URL audits. If a check is blocked by network/dependency issues, record exact blocker and re-run what can be run safely.

---

# 13. FRONTEND/BACKEND INTEGRATION AND SECURITY BOUNDARIES

Step 24 is **frontend accessibility hardening**. Backend/API work is limited to **auditing how existing response error/permission statuses are presented**, not adding endpoints:

- Preserve Step 16 API envelope/error types; display safe accessible error messages without leaking internal debug fields, stack traces, MongoDB IDs or secret values.
- Do not make authorization or agency scope depend on which navigation items are visible. Future Express RBAC remains authoritative.
- A visible accessible 403 message does not grant permission or require creating a new authentication system.
- Do not add new `/api/v1`, auth, payment, audit-log, RoadSync or citizen routes for accessibility tests.
- Never bypass security to make UI testable. Use synthetic fixtures/mocks/test doubles in test environments.
- If accessibility reveals a real contract/backend defect, record a scoped dependency ticket and ask before broad backend changes.
- Do not create official-looking government datasets. Demo records must be explicitly labeled synthetic.
- Avoid XSS: render user-provided labels/messages as safe React text; don't introduce `dangerouslySetInnerHTML` for announcing alerts.
- No sensitive route names or classified project fields hardcoded into public accessibility fixtures.

---

# 14. STEP 24 IMPLEMENTATION BATCHES AND REPAIR ORDER

Work incrementally; finish focused checks before advancing:

| Batch | Main work | Expected evidence |
|---|---|---|
| 1 | Actual route/component inventory, axe baseline, keyboard baseline and issue ledger | Reproducible audit, prioritized findings |
| 2 | Landmark/heading/skip navigation/document language/title corrections | DOM semantics + keyboard tests |
| 3 | Button, form/select/date/dialog/drawer/tabs accessible names, labels, focus and errors | Component interaction tests |
| 4 | Data table semantics, feedback live regions, status/color accessibility | Table/state tests + contrast results |
| 5 | Responsive zoom/reflow, focus obscuration, motion, forced-colors fallback | Browser/manual QA evidence |
| 6 | Regression suite, docs, clean code/security review and fix/retest | CI-compatible tests / final issue ledger |

**Prioritize actual P0/P1 findings; do not change working components just to produce more lines of code.** If shared Step 17–23 fixes touch teammate-owned files, coordinate and keep patches surgical. Do not overwrite accepted styles wholesale.

---

# 15. DOCUMENTATION AND ARTIFACTS

Create/update existing equivalents as useful; prefer fewer authoritative docs to duplicate files:

```text
docs/accessibility/step-24-baseline.md
docs/accessibility/findings.md
docs/accessibility/test-matrix.md
docs/accessibility/manual-test-protocol.md
docs/accessibility/component-guidelines.md
docs/accessibility/step-24-review.md
```

Required documentation details:

1. Actual tested routes/components, scope/boundaries and dependency evidence.
2. Applicable standard WCAG 2.2 AA and clear exceptions/not-yet-built features.
3. Issue ledger (ID, reproduction, expected/actual, severity, affected SC, status, fix evidence and owner).
4. Semantic HTML/ARIA guidance, keyboard patterns, focus restoration, labels/errors, mobile/tables and feedback announcements.
5. Semantic INFRAOS colors, actual checked foreground/background contrast pairings and redundant status labels/icons.
6. Browser, viewport, zoom, OS/screen reader details only for tests actually conducted.
7. Automated test commands, cases added and limitations of automated checks.
8. Remaining P2/P3 issues and future acceptance gates for landing, authentication, RoadSync/InfraMap and citizen portal.
9. Integration implications, performance and dependency changes, known blockers.
10. Complete pre-step/post-step checklists and final Git/PR handoff.

Do not copy hundreds of WCAG paragraphs or use a generic “everything accessible” checklist with no repo evidence. Link to [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) in documentation as the normative standard.

---

# 16. POST-IMPLEMENTATION REVIEW — MANDATORY INDEPENDENT PASS

When code and tests are ready, perform a **separate deliberate review pass**, ideally with a different Cursor model/agent context if team tooling permits. Do not just trust the implementing agent's self-assessment.

```text
INFRAOS STEP 24 — POST-IMPLEMENTATION REVIEW

A. GIT / SCOPE
Start branch+commit:
Current branch:
Full changed/added/untracked files:
Any unrelated/auth/backend/landing changes:
Any teammate changes affected:

B. DEPENDENCY VERIFICATION
Steps 17–23 actual implemented evidence:
Step 23 merged into development evidence:
Installed test/Next/Tailwind/shadcn versions:

C. ACCESSIBILITY FINDINGS
Issues found baseline total by severity:
Issues fixed / verified:
P0/P1 still open and consequences:
WCAG 2.2 AA criteria actually inspected:
Criteria not applicable / not tested and why:

D. SEMANTIC / KEYBOARD
Landmarks/main/skip link/page titles/lang/headings:
Tab order/focus visible/focus not obscured:
Mobile drawer, overlays, tooltip, select/date picker:
Screen-reader labels/ARIA/AT actual test:

E. FORMS / TABLES / FEEDBACK
Form labels, errors, validation focus:
Table semantics, sorting, selection, pagination:
Loading/retry/empty/error/success status announcements:
Status badge meaning not color alone:

F. VISUAL / MOTION
Computed foreground/background contrast evidence:
320px/375px/768px/1280px reflow and 200/400% zoom:
Text spacing overrides and forced colors:
Reduced-motion behavior:

G. SECURITY / INTEGRATION
No data leaks/secrets/XSS/permission bypass:
Shared contracts unchanged unless explicitly approved:
No future roadmap features built:

H. QUALITY / TESTS
Baseline lint/type/tests/build:
Focused accessibility tests + axe findings:
Full relevant web/root regressions:
Manual keyboard / actual assistive technology (or NOT RUN):
Browser console/hydration observations:
Defects fixed → retested:
Unrun checks, reason, ownership:

I. DOCS AND HANDOFF
Issue ledger and docs updated:
Git diff check / dependencies inspected:
Suggested commit / PR target:
Approval status:
Recommended next step:

FINAL STEP 24 STATUS: COMPLETE / PARTIAL / BLOCKED
```

**Review rules:** Fix actual code defects related to Step 24; re-run targeted tests and relevant baseline regressions. If a P0/P1 essential accessibility issue remains, **do not mark complete**. Do not claim independent review if no second pass occurred.

---

# 17. FULL ACCEPTANCE CRITERIA

## 17.1 Prerequisites and Git

- [ ] Repo/roadmap/rules and exact Step 17–23 code state inspected.
- [ ] Step 23 reviewed/merged in `development`, evidenced by actual history/files (or clearly blocked).
- [ ] Working tree safe, preexisting teammate/untracked `Prompts/` files preserved.
- [ ] Dedicated `feature/step-24-accessibility-foundation` created from approved up-to-date `development`.
- [ ] No auto-commit/push/merge/`main` modifications.

## 17.2 Audit and remediation

- [ ] Actual in-scope routes and UI primitive inventory documented.
- [ ] Baseline accessibility audit and reproducible issue ledger with severity/criteria.
- [ ] P0/P1 baseline violations affecting critical existing workflows remediated and individually retested.
- [ ] Landmark/main/skip navigation/document language/current page/title/headings validated.
- [ ] Buttons/links/icon controls have accessible names and keyboard operation.
- [ ] Dialog/Sheet/Popover/Tooltip/Select/DatePicker/Tabs focus and escape semantics verified.
- [ ] Step 20 forms label/error/instructions and focus handling verified.
- [ ] Step 21 tables and row actions have correct semantics; no misleading empty/filtered states.
- [ ] Step 22 feedback changes announce truthfully and without duplicate/noisy aria-live usage.
- [ ] Step 23 shell navigation is mobile/desktop keyboard usable, skip link works and focus not obscured.
- [ ] Color is not sole indicator; actual contrast pairs verified against applicable thresholds.
- [ ] Zoom/reflow/text-spacing checks completed; 2D content exception applied accurately.
- [ ] Reduced-motion behavior and focus indicators checked, forced-colors when supported.
- [ ] Scope-limited security review passed; no permissions, secrets, XSS or business-data exposure.

## 17.3 Test and documentation

- [ ] Existing test tools reused where possible; focused accessibility tests added for regression.
- [ ] Actual automated scans and commands logged; failing findings addressed or transparently blocked.
- [ ] Manual keyboard tests and browser viewport/zoom tests performed where tools support them, otherwise honestly **NOT RUN** with follow-up instructions.
- [ ] Actual AT testing only reported if genuinely conducted; no overall certification claim.
- [ ] Full relevant frontend lint, type-check, tests and build run; regressions fixed or clearly documented blockers.
- [ ] Documentation/findings ledger updated with exact remaining items, owners and future-feature requirements.
- [ ] Post-review, fix and re-test performed; no critical unresolved in-scope violations before declaring COMPLETE.
- [ ] Git status, tracked diff, new untracked files, lockfile and security changes inspected.
- [ ] Suggested commit and PR handoff to `development` prepared, with approval gate.
- [ ] Stop after Step 24; do not implement Step 25.

---

# 18. TEST PLAN — EXPECTED EVIDENCE TABLE

| Area | Automated | Manual | Gate |
|---|---|---|---|
| Semantics/landmarks/title | DOM/component / axe | Reader landmark/navigation inspection if available | P0/P1 missing main/label must be fixed |
| Keyboard actions | user-event/Playwright | Tab, Enter, Space, Esc, arrows | Primary flows must be keyboard operable |
| Focus trap + restore | component/E2E | Modal/drawer mobile/desktop | Never trap keyboard user without exit |
| Error messages | form tests | Invalid submit and focus | Errors must be intelligible |
| Data table | role/aria-sort tests | Filter/sort/page with keyboard | Table semantics and purpose preserved |
| Async states | React/Playwright tests | Trigger loading/error/retry/success | No false success or noisy live status |
| Color contrast | automated color/token checks + axe | Actual rendered states | Applicable AA ratios meet standard |
| Reflow + zoom | Playwright viewport smoke if configured | 320 CSS px, 200–400% zoom, text spacing | No loss of critical operation |
| Target size/focus | geometry check where useful | Visually test focus/obscuration | WCAG 2.2 applicable AA checks |
| Motion/forced colors | reduced-motion CSS tests | OS/browser emulation where available | No essential interaction lost |
| Screen-reader usability | no substitute for true AT | NVDA/VoiceOver/TalkBack if available | Declare NOT RUN otherwise |
| Security | static inspection / tests | Review visible error data | No secrets or bypass |
| Lint/types/build | actual scripts | browser preview when possible | New regressions fixed |

**Do not use arbitrary `aria-label` additions as a substitute for correctly labeled visible content.** Avoid redundant role/ARIA decorations on native HTML; prefer native semantics.

---

# 19. GIT DIFF / APPROVAL / POST-MERGE CHECK

Before handoff:

```bash
git status --short
git diff --check
git diff --stat
git diff --name-only
git diff -- package.json package-lock.json pnpm-lock.yaml yarn.lock
```

Review untracked files **separately** (they do not appear in `git diff`). If files are staged, review `git diff --cached --check` and `git diff --cached --stat`. Confirm no `.env`, private settings, government data, accidental route/endpoint, direct main modification or unrelated generated assets. Proposed approval-gated commit:

```text
feat(a11y): establish INFRAOS accessibility foundation
```

**PR description** must include:

```text
Base and branch revisions:
Scope / route coverage:
Accessibility baseline issue counts by severity:
P0/P1 resolved:
Applicable WCAG 2.2 AA criteria and verification boundaries:
Actual test commands / outcomes:
Keyboard + zoom + AT testing detail (or NOT RUN):
Screenshots/screen recording only if genuinely captured:
Security, performance, and dependency review:
Remaining P2/P3 items / owners:
Step 17–23 regression checks:
Reviewers and required approvals:
Merge target: development
Protected main: unchanged
Post-merge regression checks:
```

**Only after a human-approved merge** into `development`, recheck actual integrated web lint/types/tests/build, affected accessibility suites, app shell/mobile drawer, field errors, table headers/controls and async-state messaging. If integration reveals problems, propose a **new reviewed fix branch**; never secretly overwrite `development` or `main`.

**Optional Phase 3 release checkpoint:** Because Step 24 concludes the UI/UX foundation group (Steps 17–24), the team may **consider** a phase-gate `development → main` PR **after** full regression/security/accessibility review and explicit separate approval. Do not create or merge this automatically.

---

# 20. FINAL REPORT TEMPLATE

```text
INFRAOS — STEP 24 ACCESSIBILITY FOUNDATION DELIVERY

STATUS: COMPLETE / PARTIAL / BLOCKED
WHY:

BASE BRANCH/COMMIT:
STEP 23 INTEGRATION PROOF:
FEATURE BRANCH:
GIT STARTING STATE:

ACTUAL IMPLEMENTED/TESTED ROUTES:
ACTUAL AUDITED COMPONENTS:
WCAG 2.2 AA CRITERIA/APPLICABILITY:
BASELINE VIOLATIONS P0/P1/P2/P3:
RESOLVED ISSUES WITH TEST EVIDENCE:
UNRESOLVED / NOT RUN / NOT APPLICABLE:

SEMANTICS/LANDMARKS/HEADINGS:
KEYBOARD/FOCUS/NAVIGATION:
FORMS/VALIDATION:
TABLES/SORT/FILTER:
LOADING/ERROR/SUCCESS/ARIA-LIVE:
CONTRAST/COLOR REDUNDANCY:
REFLOW/ZOOM/TEXT SPACING:
REDUCED MOTION/FORCED COLORS:
SCREEN READER: ACTUAL RESULTS OR NOT RUN
SECURITY / DATA PROJECTION:

NEW/CHANGED FILES:
DEPENDENCY CHANGES:
DOCUMENTATION:

TEST EVIDENCE (command + PASS/FAIL/NOT RUN):
- Baseline lint/types/tests/build:
- Component tests:
- Axe/browser scans:
- Keyboard interactions:
- Web type-check/lint/tests/build:
- Root regressions:
- Browser console/hydration:

POST-REVIEW PROBLEMS + FIX/RETEST:
GIT DIFF/UNTRACKED REVIEW:
SUGGESTED COMMIT: feat(a11y): establish INFRAOS accessibility foundation
PR TARGET: development (approval required)
POST-MERGE REGRESSION:
MAIN RELEASE: NOT PERFORMED (separate explicit approval)
NEXT ELIGIBLE STEP: Step 25, only after instruction

STOP.
```

---

# 21. FINAL HARD STOP

At the end of Step 24, provide the actual implementation/review report, proposed commit/PR handoff, outstanding accessibility finding list and whether **existing** Phase 3 UI foundation is ready for later features. **Do not:** create the public landing, auth, ProjectTrace, RoadSync, real GIS, AI service, full localization, auto-merge to `main`, or move to Step 25 without the user's approval.

**Definition of Done:** Not “a11y tooling added,” but **actual current UI accessibility issues measured, critical defects repaired, regression tests established, manual limitations disclosed, documentation updated, and reviewable integration prepared**.
