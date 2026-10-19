# INFRAOS — Complete Enhanced Development Prompts
## Phase 3 · Steps 17–18 — Brand & Color System → Typography, Spacing & Design Tokens

**Project:** INFRAOS — National Infrastructure Intelligence & Coordination Platform  
**Vision:** The Operating System for National Infrastructure  
**Core lifecycle:** Plan → Coordinate → Approve → Build → Verify → Monitor → Complete → Maintain  
**Product:** Sri Lankan government-oriented infrastructure coordination platform  
**Stack:** Next.js / React / TypeScript / Tailwind CSS / shadcn/ui; Express / TypeScript modular monolith; MongoDB Atlas / Mongoose; future FastAPI AI service  
**Source roadmap:** User-provided `Steps.docx` — Phase 3, Step 17 and Step 18  
**Approved implementation order:** Complete and review Step 17 **before** beginning Step 18  
**Companion file:** `INFRAOS_Cursor_Codex_Execution_Steps_17_to_18.md`

> **Important source clarification.** The original roadmap's Step 17 text proposes Deep Navy `#0F172A` and Infrastructure Orange `#F97316`. **That wording is outdated.** In later INFRAOS decisions, the project owner replaced it with a Sri Lankan national-flag-inspired palette. Maintain the original step numbers and goals, but implement the **newer approved palette** below. Do not silently reintroduce the older navy/orange theme.

---

# 0 · How this document must be used

You are a **Principal Design Systems Architect, Senior Next.js/TypeScript Engineer, Tailwind/shadcn Specialist, Government Enterprise UX Designer, Accessibility Engineer, QA Reviewer, and INFRAOS Integration Lead**.

Use this document as an executable development specification, not a high-level inspiration list. Read it entirely before editing the repository. Implement **Step 17 alone**, review/test/fix, and stop at its handoff. Start **Step 18 only after Step 17 is approved and integrated into the team's selected integration branch**. Step 18 then implements typography, scale, rhythm and remaining tokens on top of Step 17. Do not combine both into an unreviewed mega-commit.

For both steps:

1. Inspect actual repository state and prior Steps 1–16 deliverables; do not assume the prior prompts were actually executed.
2. Preserve working code, packages, styles, documentation, decisions and Git work from other teammates.
3. Perform a written **pre-step review** and create the step's own feature branch.
4. Implement the minimum correct, maintainable, reusable design-token foundation.
5. Review the changed files, test browser and non-browser checks where possible, fix problems, and rerun.
6. Document token source-of-truth, exact files, usage and migration implications.
7. Prepare a reviewed commit/PR handoff to `development`. **Do not automatically push/merge or change `main`** without specific team approval.
8. Report success honestly: `PASS`, `FAIL`, `NOT RUN` or `NOT APPLICABLE`, with evidence.
9. Do not proceed beyond the authorized step.

**What this group DOES:** Establish shared visual foundations so all later INFRAOS pages and modules use the same colors, text hierarchy, spacing, radii, shadows, elevations and motion defaults.  
**What this group DOES NOT:** Build the full component library (Step 19), complete forms (Step 20), data tables (Step 21), application shell (Step 23), accessibility audit (Step 24), or public landing sections (Steps 25–34).

---

# 1 · Product identity and design goals

## 1.1 Product context

INFRAOS coordinates government/public infrastructure planning across road, water, electricity, telecom, drainage and related agencies. Its core demonstration is:

```text
Create Infrastructure Project
  → Map Its Geometry
  → Detect Planned Nearby/Overlapping Work
  → Detect Date/Schedule Conflict
  → Coordinate Affected Agencies
  → Resolve and Approve
  → Track Progress / Finance / Risk
  → Inspector Verifies
  → Complete Project → Asset
  → Maintain Asset / Support Citizen Issue Reporting
```

The visual language must feel like **trusted, legible, efficient government/enterprise infrastructure software**, not a festive flag graphic or generic startup dashboard. Operators will use maps, long data tables, forms, timelines, conflict severity, approval controls and project-status summaries.

## 1.2 Design principles

- **Clarity before decoration.** Information, ownership and state must remain obvious.
- **Neutral first.** White/light backgrounds and slate neutrals dominate. Brand colors are purposeful accents and status signals.
- **Semantic consistency.** Conflict, warning, approval and completion must have consistent meanings across pages.
- **Readable under pressure.** Strong text contrast, legible numbers, sensible density and obvious focus states.
- **Future-proof but small.** Tokens should be flexible without creating hundreds of unused variables.
- **Role- and agency-neutral branding.** Do not give each team member/module a separate incompatible palette.
- **No accidental endorsement.** Sri Lankan national-flag inspiration is an aesthetic direction, not a claim of official government ownership.
- **No visual-only authorization.** UI state/color never replaces server-side role, agency and resource-scope enforcement.

## 1.3 Approved brand palette — exact source hexes

| Token intent | Exact brand hex | Correct usage |
|---|---|---|
| **Primary Orange** | `#FF5B00` | Brand emphasis, primary action backgrounds where accessible, active elements, selected project marker/line |
| **Primary Yellow** | `#FEB600` | Pending, warning, review-required, controlled highlights |
| **Primary Maroon** | `#8C1F28` | High-risk, severe conflict, rejection, blocked/critical states |
| **Primary Green** | `#279541` | Approved, completed, resolved, healthy/success states |

Suggested controlled accent gradient for *limited* brand visuals:

```css
linear-gradient(90deg, #FF5B00 0%, #FEB600 100%)
```

**Do not apply this gradient to all dashboards, sidebars, data rows, modals or KPI cards.**

## 1.4 Approved neutral foundation

| Intent | Hex |
|---|---|
| App canvas / background | `#F8FAFC` |
| Card / panel / surface | `#FFFFFF` |
| Strong text | `#111827` |
| Secondary text | `#475569` |
| Muted text | `#64748B` |
| Default border / divider | `#E2E8F0` |
| Dark surface for specific contexts | `#111827` |

These are starting, approved references. Add narrowly scoped surface/hover/foreground variants only when accessibility or a meaningful state requires them. **Do not invent a new dominant blue/navy design language.**

## 1.5 Exact brand colors vs accessible derived tokens

A required distinction: **brand identity swatches are not automatically suitable as foreground text on white or as white-text button backgrounds**. Use specific semantic tokens that derive from the brand but pass contrast requirements.

Preliminary contrast checks against standard sRGB WCAG contrast formulas (verify again in the codebase):

| Pair | Approximate contrast | Design implication |
|---|---:|---|
| `#FF5B00` on white | **3.11:1** | Insufficient for ordinary 4.5:1 body text |
| `#111827` on `#FF5B00` | **5.70:1** | Viable dark-text treatment on orange |
| White on `#FF5B00` | **3.11:1** | Avoid ordinary-size white button text at this exact shade |
| `#FEB600` on white | **1.76:1** | Warning color must not be standalone ordinary text on white |
| `#111827` on `#FEB600` | **10.06:1** | Strong dark text on yellow |
| White on `#8C1F28` | **8.97:1** | Appropriate text contrast on maroon |
| White on `#279541` | **3.85:1** | Insufficient for ordinary-size white text on exact green |
| `#111827` on `#279541` | **4.61:1** | Dark text can work on exact green (reverify) |

For status text on white/light surfaces, define **accessible dark variants** rather than changing identity swatches. Candidate values for testing, not a license to create a second palette:

```text
--color-brand-orange-foreground-text: #B63D00
--color-status-success-text:        #166B30
--color-status-warning-text:        #6C5311
--color-status-critical-text:       #8C1F28
```

Validate the **actual foreground/background pair** with automated checks and visual review. Use icons and text labels alongside colors. For selected states, add explicit border/shape changes; do not rely solely on hue.

---

# 2 · Shared architecture + dependency boundaries

Read and align with the existing repo, especially:

```text
/docs/planning/
/docs/architecture/
/docs/security/
/docs/ux/
/docs/team/
/docs/database/
/docs/adr/
/docs/design/ (if present)
/apps/web/src/app/globals.css
/apps/web/src/app/layout.tsx
/apps/web/src/components/
/apps/web/src/lib/
/apps/web/tailwind.config.* (if installed)
/apps/web/postcss.config.*
/apps/web/components.json
/apps/web/package.json
/packages/shared-types/
/root package.json and lockfile
```

Step 16 provides transport-level constants/API DTOs. The design tokens from Steps 17–18 should live in the frontend's styling/design layer; do **not** put CSS variables, browser theme logic, Tailwind classes, React code or CSS into `packages/shared-types` if it is shared with the Express API.

**Preferred boundary:**

```text
Source brand + semantic visual tokens
          ↓
apps/web/src/styles/ or apps/web/src/app/globals.css
          ↓
Tailwind token bridge / shadcn semantic mappings
          ↓
Future reusable UI primitives (Step 19)
          ↓
Future ProjectTrace / RoadSync / InfraMap / public pages
```

If there is a preexisting `src/styles/tokens.css`, `theme.css`, `globals.css`, Tailwind config, shadcn config or token package, extend the existing approach rather than create conflicting files or a new theming dependency.

### Compatibility with Tailwind/shadcn versions

- **Discover actual Tailwind version first.** Tailwind v4 CSS-first `@theme` patterns and Tailwind v3 `tailwind.config` patterns are different. Use the one installed, rather than copying incompatible examples.
- **Discover actual shadcn setup first.** Preserve its CSS variables and expected tokens (`background`, `foreground`, `primary`, `secondary`, `accent`, `destructive`, `ring`, etc.) rather than replacing with custom names and silently breaking generated components.
- **Do not break Next.js App Router server/client boundaries.** Global CSS is imported from an appropriate layout entry, with no unnecessary `use client` wrapper.
- **Do not introduce Chakra/MUI/Bootstrap/another CSS framework.** Stick to the chosen stack.
- **Preserve monorepo lockfile and workspace scripts**; add packages only with a concrete demonstrated need.

### Source-of-truth rule

Maintain **one authoritative token definition**, with aliases referencing it. Avoid copy/pasting hex values into 15 files. Any unavoidable mirrored values (CSS tooling constraints, static images, docs) must be explicitly documented and tested for consistency.

### No backend feature implementation

Express, MongoDB, GIS geometry, permission engines and FastAPI logic must remain unchanged unless a **preexisting frontend integration is broken by the exact styling change**, and then report a narrowly justified exception. Do not create new `/api/v1` endpoints for theme/status colors.

---

# 3 · STEP 17 — Final INFRAOS Brand & Color System

**Branch:** `feature/step-17-brand-color-system`  
**Suggested commit:** `feat(design): establish INFRAOS brand and semantic colors`  
**Target integration:** `development` after review and approval

## 3.1 Objective

Create a complete **light-first** brand/color token foundation that all INFRAOS modules can consume without hardcoded hex proliferation. Ensure the chosen Sri Lankan flag-inspired colors are used **semantically**, with accessible foreground variants, clear states, consistent focus/selection treatment and future dark-theme planning.

## 3.2 Step 17 pre-review — mandatory written report

Before any edit, inspect and record:

```text
STEP 17 — PRE-IMPLEMENTATION REVIEW

Git starting branch / commit:
Working-tree status (clean / existing changes):
Installed Next.js version:
Installed Tailwind major version:
shadcn components.json present / absent:
Existing global stylesheet(s):
Current CSS variables / color maps:
Current design/theme libraries (if any):
Old navy/orange hardcoded values found:
Existing layout/components that consume tokens:
Existing light/dark behavior:
Existing button/alert/status styles:
Existing UI state / role semantics from Steps 4 and 16:
Existing visual QA / browser tooling:
Potential conflicts / team-owned files:
Step 17 file change plan:
Step 17 test plan:
Risks / open decisions:
```

Find old palette occurrences (`#0F172A`, `#F97316`) **but never blind-replace all matching strings**. Some may be historical documentation, third-party examples, map palettes or unrelated assets. Only change active INFRAOS app/theme references where appropriate, and document archival references.

If repository has existing dirty changes, do not stash/reset/commit them automatically. Work safely or stop and ask the operator to resolve ownership.

## 3.3 Git branch creation

Typical safe commands (verify actual remote/branch names first):

```bash
git status --short
git branch --show-current
git remote -v
git checkout development
git pull --ff-only origin development
git status --short
git checkout -b feature/step-17-brand-color-system
```

If no `origin`, missing `development`, existing branch, or no network permission, **do not invent success**; adapt only after confirming the intended repo workflow. Record start commit with `git rev-parse --short HEAD`.

## 3.4 Brand identity constants and usage policy

Define the four exact approved colors and neutrals as the single source of truth. Provide semantic aliases for:

```text
brand.primary
brand.warning
brand.critical
brand.success
surface.canvas
surface.panel
surface.subtle
surface.elevated
text.primary
text.secondary
text.muted
border.default
border.strong
focus.ring
selection.surface
selection.text
status.pending
status.warning
status.highRisk
status.blocked
status.approved
status.completed
status.resolved
status.healthy
status.informational (neutral or restrained derived color)
```

Naming may follow the installed shadcn/Tailwind conventions. **Do not create duplicate namespaces with conflicting values.**

Explicitly distinguish:

- `--infra-orange`, `--infra-yellow`, `--infra-maroon`, `--infra-green` = **raw brand values**.
- `--primary`, `--primary-foreground`, `--ring`, `--accent`, `--destructive` = **component-facing semantic mapping** if shadcn needs them.
- `--status-warning-fg`, `--status-warning-bg`, etc. = **accessible semantic status combinations**, not merely raw swatches.
- Map-layer palette usage = controlled visual grammar for future mapping, *not* implemented map logic.

## 3.5 Recommended palette mapping table

| UI purpose | Base treatment | Text & labeling rule |
|---|---|---|
| App background | `#F8FAFC` | Dark high-contrast text |
| Surface/card | `#FFFFFF` | Dark high-contrast text |
| Primary action | Orange brand background | Prefer dark accessible text or a separately validated darker orange background for white text |
| Primary text link on white | Tested darker orange variant | Underline/hover distinguish, do not rely only on color |
| Active navigation (future) | Orange marker/underline/soft tint | Label remains high contrast |
| Pending/review | Yellow soft fill/accent | Dark text + 'Pending'/'Needs review' |
| Warning | Yellow accent + icon | Dark text |
| High-risk/conflict | Maroon accent/tint | Contrasting text + icon/severity label |
| Rejected/blocked | Maroon semantic | Include distinct words/icon, not hue alone |
| Approved/completed/resolved | Green accent/tint | Darker green text + explicit status wording |
| General information | Neutral/slate | Do not force warning/success hues |
| Selected map item (future) | Orange outline + thicker stroke | Stroke/pattern + legend |
| Project risk severity (future) | Ordered severity tokens | Pair numbers/icons/labels and accessible map legend |

**Status meaning must match Step 16 shared contract enums and backend-approved statuses.** Do not invent backend status codes, rename API enums, or conflate project priority with conflict severity.

## 3.6 Build the minimum light theme

- Build one consistent light-theme baseline for `body`, layout surfaces, text, default border, focus ring and selection.
- Use CSS variables where useful, optionally typed for design tooling.
- Map semantic tokens to Tailwind's installed mechanism, preferably through shadcn's existing conventions.
- Preserve legitimate existing CSS and layout structure; do not delete all utility classes or regenerate the entire app.
- Avoid global `!important`, huge selector chains, broad `*` overrides, and accidental link/button restyling that breaks future shadcn primitives.
- Do not hardcode status/role meaning inside Tailwind conditions with impossible-to-maintain switch trees.

**Example conceptual CSS values (adapt to actual project conventions):**

```css
:root {
  --infra-orange: #FF5B00;
  --infra-yellow: #FEB600;
  --infra-maroon: #8C1F28;
  --infra-green: #279541;

  --infra-canvas: #F8FAFC;
  --infra-surface: #FFFFFF;
  --infra-text: #111827;
  --infra-text-secondary: #475569;
  --infra-text-muted: #64748B;
  --infra-border: #E2E8F0;

  /* Separately validated on light backgrounds */
  --infra-orange-text: #B63D00;
  --infra-green-text: #166B30;
  --infra-yellow-text: #6C5311;
  --infra-critical-text: #8C1F28;
}
```

This is a **token example**, not a command to duplicate CSS across `globals.css`, `theme.css`, `tailwind.config.ts`, and a TypeScript file. Select one implementation architecture after repo inspection.

## 3.7 Status/visual variant policy

At minimum specify token combinations for:

```text
neutral / default
primary
pending
warning
critical / severe conflict
approved / success
completed / resolved
info
selected / active
hover
pressed
disabled
focus-visible
```

For each combination, define background/foreground/border/icon contrast and a usage example. Keep initial output at token level: **full Badge/Alert/Button implementations belong to Step 19**.

## 3.8 Focus and selection

- Provide a clear keyboard focus indicator with sufficient visual contrast against both light cards and colored interactive elements.
- Focus must remain apparent, not simply a slight hue shift.
- Define selection via background **plus** outline/indicator when practical.
- Do not remove native focus without a proper replacement.
- Respect system high-contrast/forced-colors behavior; add targeted support if existing focus rules fail.
- Disabled state must not be identified by color alone; use actual disabled/ARIA semantics in future components.

## 3.9 Data visualization and InfraMap semantic rules (policy only)

Write guidance for later chart/map implementation:

- Conflict severity has a visually ordered and **labeled** legend; use more than color (stroke, pattern, icon/label).
- Completed/approved statuses use green; rejected/high-risk use maroon; pending/warning uses yellow; primary emphasis/selection uses orange.
- Multiple unrelated agencies/projects must **not** all be colored as statuses. Use a separate accessible categorical series palette only when chart/map needs several distinguishable categories; do not invent real categories/times/metrics.
- Public vs internal feature visibility is not a color decision; backend API projection and RBAC remain authoritative.
- Ensure map symbol and legend contrast against road/base-map tiles; do not promise compliance before tile-provider testing.

Do **not** implement MapLibre, map layers, charts, conflict simulations or any fake geospatial data in Step 17.

## 3.10 Logo, imagery and graphics

- Preserve existing authorized official INFRAOS logo/assets if present.
- If no logo exists, define spacing/color use policy only; **do not make up an official seal or state insignia**.
- Avoid literal flag collage, watermarking, or government authority claims.
- Do not create or download imagery. Future marketing/landing imagery belongs to later steps.

## 3.11 Dark-mode decision

The uploaded roadmap mentions dark mode, but later INFRAOS scope prioritizes a light-first government/enterprise UI. Treat **complete dark mode as P2** unless a newer approved project ADR explicitly requires it now.

For Step 17:

- Document dark-theme token strategy and naming.
- If existing dark mode already works, keep it from regressing and normalize glaring token issues.
- Do **not** add a new theme switcher, persistence scheme, second design system, or large dark-theme redesign now.
- Do not leave partial dark-mode rules that generate unreadable text.

State clearly what was implemented and what remains deferred.

## 3.12 Minimal token verification surface

To verify tokens, prefer existing page/components or tests; avoid full UI development. A **small, isolated development-only swatch/token verification surface** is allowed if useful, provided:

- it is not publicly accessible in production;
- it does not become a second public landing page;
- it does not create final Step 19 component primitives;
- it uses sample labels such as `Pending`, `High Risk`, `Approved`, `Selected`, and no fake live government metrics;
- it can be removed or retained as documented internal visual QA with no security exposure.

If current app already has a temporary foundation page, visually verify it instead of creating another route unnecessarily.

## 3.13 Accessibility tests

Implement or run a contrast checker (existing dependency preferred, or a small pure TS helper/test) for the **actual token combinations**:

- normal text: target WCAG 2.2 AA **4.5:1**;
- large text: target **3:1**;
- meaningful non-text UI boundaries/status indicators: target **3:1** where applicable;
- test foreground on **exact background**, including status tints, hover and selection;
- verify keyboard focus visible;
- verify status is never conveyed only by color.

**Important:** A ratio passing does not itself establish complete WCAG compliance. Record manual limits and future Step 24 accessibility audit.

## 3.14 Technical checks

Run the actual repo equivalents of:

```bash
npm run lint
npm run type-check
npm run test
npm run build
```

If a script does not exist, report `NOT AVAILABLE`; do not manufacture a passing script. For tests, run the smallest relevant suite first; run broader regression checks once issues are fixed. If browser preview is available, inspect a desktop and narrow viewport and check browser console. If it is not available, report visual checks as `NOT RUN` and give exact manual verification instructions.

## 3.15 Step 17 required deliverables

Adapt paths to actual project conventions; **do not create parallel duplicate files**:

```text
apps/web/src/app/globals.css                # existing global styling entry, updated
apps/web/src/styles/tokens.css              # optional single token source if appropriate
apps/web/tailwind.config.*                 # only if installed Tailwind version requires it
apps/web/components.json                   # only if shadcn mapping needs correction
apps/web/src/lib/design/semantic-colors.*  # optional small, pure semantic lookup

docs/design/brand-color-system.md
docs/design/semantic-status-colors.md
docs/design/color-accessibility.md
docs/design/dark-mode-plan.md              # only if a separate note is useful
```

At least one documented **authoritative token source**, a **status mapping**, a **contrast result log**, and a **team usage guide** must exist, whether in the listed paths or equivalent existing ones.

## 3.16 Step 17 post-implementation review

Deliver a written review and actually fix defects in scope:

```text
STEP 17 — POST-IMPLEMENTATION REVIEW

Approved exact four brand values preserved:
Neutral palette preserved:
Brand text / contrast variants defined:
Tailwind version-compatible token integration:
shadcn variable compatibility:
Semantic status mapping matches shared contracts:
Active/hover/focus/disabled token policy:
Accessible pair test evidence:
Responsive visual check:
Browser console check:
Dark-mode decision + remaining work:
Any older theme values left intentionally (where and why):
Any stale or conflicting token files:
Lint / type-check / tests / build outcomes:
Unexpected changes / regressions:
Defects found and fixed:
Remaining limitations:
Documentation updated:
Git status/diff safety:
```

## 3.17 Step 17 acceptance gate

Mark `COMPLETE` only when:

- [ ] Repo and older docs inspected; Step 16 contract dependencies checked.
- [ ] Dedicated Step 17 branch is correct and preserves other members' changes.
- [ ] Four **exact** approved brand hex values are defined once.
- [ ] Neutral enterprise foundation is defined.
- [ ] Semantic status mappings are accurate and independent of backend authorization.
- [ ] Light theme works in the actual existing frontend; shadcn/Tailwind integration is correct.
- [ ] Accessible text/interactive state pairings are tested; failures fixed or explicitly blocked with clear status.
- [ ] Focus/selected/disabled policy documented; no reliance on color alone.
- [ ] Dark mode is honestly handled as P2 or preserved if already supported.
- [ ] No unauthorized page/component/backend/AI/GIS implementation was added.
- [ ] Relevant lint/type-check/tests/build pass or verified blocker is documented; don't claim complete when critical required checks fail.
- [ ] Documentation, file diff and commit/PR handoff are ready.

**Stop after Step 17.** Step 18 begins only after Step 17's review/approval and latest approved `development` integration.

---

# 4 · STEP 18 — Typography, Spacing & Design Tokens

**Branch:** `feature/step-18-typography-design-tokens`  
**Suggested commit:** `feat(design): establish typography and layout tokens`  
**Target integration:** `development` after review and approval  
**Dependency:** Step 17 must be verified; base this branch on the integration branch containing the approved Step 17 tokens

## 4.1 Objective

Define and implement a reusable design-token system for **typography, spacing, radii, shadows, content widths, elevations/z-index, motion/transitions and layout density**, without prematurely building the full UI component library.

Success means teams can construct consistent ProjectTrace pages, RoadSync maps, government dashboard tables, inspections, document review and citizen portal screens from predictable shared scales.

## 4.2 Step 18 pre-review — mandatory

Confirm Step 17 actual integration and inspect typography/layout conventions already present:

```text
STEP 18 — PRE-IMPLEMENTATION REVIEW

Current branch / start commit:
Step 17 reviewed and integrated into development? Evidence:
Existing fonts (next/font/google, local fonts, CSS imports):
Installed Tailwind/shadcn versions:
Current typography utility classes:
Existing component text sizes/line heights:
Existing spacing/padding/gap conventions:
Current max widths/breakpoints:
Existing radii, shadows, z-index/elevation values:
Existing motion/reduced-motion CSS:
Potential duplicated/magic values:
Current layout routes affected:
Browser/visual testing ability:
Team shared-file ownership considerations:
Planned files / exact changes:
Risks, compatibility decisions, tests:
```

**If Step 17 has not been integrated or required tokens are absent, stop or complete its authorized handoff; do not silently redo Step 17 within Step 18.**

## 4.3 Git branching

Typical commands after review of working tree/remote:

```bash
git status --short
git checkout development
git pull --ff-only origin development
git checkout -b feature/step-18-typography-design-tokens
```

Preserve all teammate work. If branch exists, inspect/reuse safely. No forced checkout, reset, stash, force-push, or unapproved merge.

## 4.4 Typography family decision

The uploaded roadmap lists **Inter / Geist**, and the project previously chose a professional, readable government/enterprise look.

- Use **one primary sans-serif family** for app UI; pick **Inter** or **Geist** based on actual existing repo, not a gratuitous switch.
- Avoid adding multiple downloaded font files or loading unbounded weights/styles.
- Prefer Next.js `next/font` / existing optimized mechanism when supported. If build environment cannot download fonts, use a resilient font fallback strategy and document the limitation; do not claim visual verification if unavailable.
- Preserve Unicode support needed for Sri Lankan names and possible Tamil/Sinhala text; test sample text rendering. Do not claim complete localization, translation or script coverage merely because a font fallback exists.
- Use system fallbacks appropriate to font loading and script rendering.
- Define a separate `font-mono` only if code/identifiers require it; do not use it widely in government UI.

## 4.5 Recommended UI type scale (adapt to existing conventions)

| Semantic role | Suggested desktop size | Weight | Intended use |
|---|---:|---|---|
| `display` | 36–44 px | 700 | Very occasional public hero; not dashboard default |
| `pageTitle` / H1 | 28–32 px | 650–700 | App page heading |
| `sectionTitle` / H2 | 22–24 px | 600–700 | Dashboard section heading |
| `cardTitle` / H3 | 18–20 px | 600 | Card/section headline |
| `body` | 14–16 px | 400–500 | Main paragraphs, rows, forms |
| `bodySmall` | 14 px | 400–500 | Dense dashboard text |
| `label` | 13–14 px | 500–600 | Form/field labels, metadata |
| `caption` | 12–13 px | 400–500 | Supporting detail, *not* core project data |
| `metric` | 24–32 px | 650–700 | KPIs with tabular numerals |

**Guardrails:**

- Do not make necessary body/form data 10–11 px just to fit a dashboard.
- For app use, prefer `16px` baseline body where feasible; allow justified compact 14px table rows/metadata.
- Maintain appropriate line height (e.g. ~1.5–1.65 for paragraph text; compact but legible headlines).
- Use a systematic mobile scale where H1/display scale down; avoid one-off viewport rules everywhere.
- Use real CSS font weights the selected font provides; do not rely on unavailable 650/700 variants if not supported by actual import configuration.
- Support long agency/project names without awkward truncation; truncated text must still be accessible/expandable when material.

## 4.6 Typography semantic tokens

Define names compatible with the project's CSS/Tailwind strategy, conceptually:

```text
font.family.sans
font.family.mono (optional)
font.size.display
font.size.pageTitle
font.size.sectionTitle
font.size.cardTitle
font.size.body
font.size.bodySmall
font.size.label
font.size.caption
font.size.metric
font.weight.regular
font.weight.medium
font.weight.semibold
font.weight.bold
font.lineHeight.body
font.lineHeight.heading
font.lineHeight.compact
font.letterSpacing.heading
font.numeric.tabular
```

Where Tailwind typography utilities already cover the scale, alias meaning in documentation instead of creating redundant CSS variables for every heading. A small set of semantic CSS custom properties is acceptable.

## 4.7 Numerical / government data readability

- Use `font-variant-numeric: tabular-nums` or equivalent for financial figures, risk scores, dates and KPI columns when needed.
- Avoid forced all-caps for long labels, role names, agencies, map legends and workflows.
- Ensure `LKR` amount and unit labels do not overlap with values.
- Differentiate display typography for public marketing from operational interface. The product UI remains compact/clear.
- Verify mixed English and Tamil/Sinhala sample strings do not clip vertically; add safe fallback fonts, but full language localization is future scope.

## 4.8 Spacing scale

Use a coherent **4 px base** scale compatible with Tailwind defaults. Reuse existing utility classes unless a documented exceptional need exists.

Suggested scale:

| Intent | Spacing |
|---|---:|
| `0` | 0 px |
| `0.5` | 2 px |
| `1` | 4 px |
| `2` | 8 px |
| `3` | 12 px |
| `4` | 16 px |
| `5` | 20 px |
| `6` | 24 px |
| `8` | 32 px |
| `10` | 40 px |
| `12` | 48 px |
| `16` | 64 px |

Document semantic patterns for:

- compact icon-to-label gap;
- form label → control → helper/error text;
- input group vertical rhythm;
- card inner padding;
- dense table cells vs detail pages;
- page horizontal gutters;
- between-page-sections spacing;
- dashboard grid gaps;
- map toolbar/control gaps and touch-safe padding;
- public landing section gaps reserved for later implementation.

Do not override Tailwind's entire spacing scale unless necessary. Prefer semantic usage recipes in docs where built-in utilities suffice.

## 4.9 Container and content-width tokens

Plan a small documented set of container behaviors:

```text
full-bleed map/content canvas
readable prose/document view
standard form width
standard content page
wide dashboard/workspace
```

Avoid hardcoded fixed 1200px widths that cause horizontal overflow. Use responsive width, gutters and `max-width`. Maps often need more horizontal space than forms; don't put them in an arbitrarily narrow centered page.

Suggested responsive gutter approach (not prescribed code):

```text
mobile: 16px
small tablet: 20–24px
desktop: 24–32px
```

Adapt to actual shell/pages when implemented. Shell layout comes in Step 23.

## 4.10 Radius tokens

Keep moderate professional radii:

```text
radius.sm   ≈ 6px
radius.md   ≈ 8px
radius.lg   ≈ 12px
radius.xl   ≈ 16px (selectively)
```

Reuse `--radius` and shadcn's derived radius conventions where installed. Do not apply huge `24–36px` radii to every government table, input and card.

## 4.11 Shadow/elevation tokens

Define restrained shadows:

```text
elevation.none
shadow.sm  → subtle card lift when appropriate
shadow.md  → popover/modal separation
shadow.lg  → drawer/dialog overlay only
```

Use border and surface difference for most dashboard cards; do not require drop shadows on every KPI.

Document what actually owns elevation: surface, floating menu, popover, sheet/drawer, dialog/toast. Real components come in Step 19/23.

## 4.12 Z-index/elevation layering policy

Define a small hierarchy to prevent overlays hiding one another:

```text
base content
sticky app header (later)
map canvas controls (later)
popover / dropdown
overlay / sheet
dialog / modal
toast / important notification
```

Pick numerical values that fit existing shadcn/Radix styles; **do not create conflicting competing z-index ladders**. Browser stacking contexts affect actual layering beyond one number; document usage cautions. Avoid gratuitous `z-[99999]` hacks.

## 4.13 Motion / transitions

Create restrained motion tokens:

```text
motion.fast    ≈ 120–160ms
motion.normal  ≈ 180–240ms
motion.slow    ≈ 280–360ms, selective
motion.easing  = standard ease/out
```

Use mainly for hover, focus, dropdown and dialog state changes. **Do not implement GSAP or cinematic animations here** (Step 33). Respect `prefers-reduced-motion: reduce`. Provide a documented no/low-motion fallback; avoid animating essential content visibility in a way that blocks interactions.

## 4.14 Responsive foundations

Rely on installed Tailwind breakpoints unless there is a demonstrated need for change. Document usage patterns for mobile/tablet/desktop but **do not implement final app shell, sidebar, data tables, map controls, or responsive page overhauls here**.

Test tokens with:

- 320px narrow viewport,
- ~375px typical mobile,
- ~768px tablet,
- ~1280px desktop,
- wide screen when relevant.

These are test reference widths, not a demand to add new breakpoints.

## 4.15 Dark-mode compatibility

Use Step 17's decision. Do not create incomplete dark tokens that render invisible text. If an existing functional theme is present, ensure typography, surfaces/shadows remain readable. Otherwise record as deferred P2 and do not add a theme toggle.

## 4.16 Token preview and doc examples

Use a minimal internal preview or existing foundation page to demonstrate:

- page heading, section title, body, label, caption, KPI numerals;
- mobile/desktop text wrapping;
- two card spacing examples;
- warning/critical/success status swatches from Step 17;
- focus marker and overlay/shadow layering if feasible.

This is **a verification fixture**, not the finished component library. Do not ship a public demo route without explicit approval.

## 4.17 Integration with existing styles

Audit existing global `h1`, `p`, `button`, `input`, `table`, `body`, `*` selectors. Avoid global CSS changes that accidentally override shadcn, browser defaults, third-party MapLibre styles or future forms. Prefer token updates and narrowly scoped utilities.

**Step 18 may add a small ergonomic semantic class/utility set**, but should not create parallel utility frameworks or a full component styling DSL.

## 4.18 Step 18 test plan

Run:

- affected unit/contrast/token snapshot tests;
- CSS/Tailwind build compatibility;
- Next.js type-check, lint, tests (when present), build;
- responsive visual verification at reference sizes if browser preview available;
- check keyboard focus and reduced-motion OS emulation if possible;
- inspect mixed-script sample labels; record limitations;
- check no undesirable font-loading warnings/errors;
- check no overflow/clipping for long titles and numbers;
- check no styling regression in existing shadcn primitives or app foundation.

If visual/browser tools are unavailable, provide a short manual test protocol and label outcome `NOT RUN`. Avoid claiming exhaustive accessibility compliance.

## 4.19 Step 18 required deliverables

Adapt to actual repo layout. Do not duplicate existing token files:

```text
apps/web/src/app/layout.tsx                # only if font wiring needed
apps/web/src/app/globals.css               # CSS variables/entry updates
apps/web/src/styles/tokens.css             # only if chosen authoritative token source
apps/web/src/styles/typography.css         # optional; avoid redundant stylesheet
apps/web/tailwind.config.*                # only if version needs it

docs/design/typography.md
docs/design/spacing-layout.md
docs/design/design-tokens.md
docs/design/motion-elevation.md             # combine if more concise
```

Create a short **token dictionary** mapping semantic names, values (when applicable), purpose, usage examples, and **what NOT to use them for**.

## 4.20 Step 18 post-implementation review

```text
STEP 18 — POST-IMPLEMENTATION REVIEW

Step 17 dependency verified:
Typography family chosen and justification:
Font loading + fallback behavior:
Unicode/Tamil/Sinhala clipping check:
Type scale and line-height implemented:
KPI/tabular-number policy:
Spacing scale / layout recipes:
Content widths / responsive gutters:
Radius/shadow/elevation token mapping:
Z-index policy and overlay compatibility:
Motion tokens and reduced-motion behavior:
Tailwind/shadcn compatibility:
Existing pages/components visual regression:
Browser console and build logs:
Narrow/mobile/tablet/desktop overflow:
Security/privacy/no UI-role bypass:
Lint/type-check/tests/build:
Defects found and fixed:
Remaining limitations:
Docs updated:
Git status/diff review:
```

## 4.21 Step 18 acceptance gate

Mark `COMPLETE` only when:

- [ ] Step 17 is truly available in the integration baseline; no theme contradiction.
- [ ] A suitable existing font family is chosen/loaded efficiently with documented fallback.
- [ ] A consistent type hierarchy and numeric display standard is available.
- [ ] Spacing and content-width/layout recipes are documented and integrated.
- [ ] Radii, shadows, elevation and motion tokens are named consistently.
- [ ] No z-index hacks, duplicate theme source, global CSS destructive reset or huge unused dependency.
- [ ] Reduced-motion strategy is present.
- [ ] Existing frontend compiles/builds and meaningful styling regressions are fixed.
- [ ] Responsive overflow and long-content checks are completed or explicitly blocked.
- [ ] Full Step 19 UI components and Step 23 shell were **not** prematurely built.
- [ ] Documentation and reviewed Git handoff are ready.

**Stop after Step 18.** Do not start Step 19 automatically.

---

# 5 · Combined Steps 17–18 integration review

Perform this section **only after each step has passed its individual review and been incorporated into `development` with team approval**.

## 5.1 Integration verification matrix

| Category | Required result |
|---|---|
| Product palette | Exact four brand values, original neutral values, documented accessible variants |
| Old theme | No active unintended navy/orange substitutions; historical docs left transparently identified |
| Semantic states | Accurate against Step 16 statuses; visual-only meaning never overrides API/RBAC |
| Token architecture | Single authoritative source + Tailwind/shadcn-compatible mappings |
| Typography | Readable hierarchy, font loading/fallback, label and KPI treatment |
| Layout | Predictable spacing, content widths, gutters and responsive recipes |
| Elevation | Consistent radii, shadows, overlay z-index rules |
| Accessibility | Contrast tests, visible focus, not color-only, reduced-motion policy |
| Compatibility | No regression in App Router, CSS imports, existing shadcn components |
| Runtime scope | No new API, MongoDB, auth/RBAC, ProjectTrace/RoadSync, GIS or AI features |
| Verification | Lint, type-check, relevant tests, build; browser manual check if available |
| Team workflow | Two reviewed branches and commits/PR handoffs, traceable changes |

## 5.2 Exact acceptance examples

- Project approval/completed visual semantics: green + label/icon.
- Pending coordination: yellow + label/icon.
- Severe RoadSync conflict: maroon + severity label/icon.
- Selected map/project future indicator: orange accent with selected marker/outline.
- Public-facing long text and financial rows: high contrast and predictable density.
- **Do not** treat every dashboard KPI as an excuse for a colored gradient.

## 5.3 Git verification

Target branch history after approval:

```text
feature/step-17-brand-color-system → review → development
feature/step-18-typography-design-tokens → review → development
```

Run the actual available commands for the checked-out post-merge integration workspace:

```bash
git status --short
git log --oneline --decorate -n 12
git diff --check
npm run lint
npm run type-check
npm run test
npm run build
```

Adapt workspace invocation; do not assert scripts are present without checking. Avoid `git diff main...development` as proof of the **current worktree** unless you understand the branch references and intended comparison; inspect the actual merged branch and test outputs.

`development → main` is an **optional, separately approved stable checkpoint**, not an automatic action at the end of these two UI-foundation steps. The broader Phase 3 gate is Steps **17–24**, unless the team explicitly approves an earlier release checkpoint.

## 5.4 Final group report

```text
INFRAOS STEPS 17–18 — DESIGN FOUNDATION REVIEW

Step 17 — Brand & Color: COMPLETE / PARTIAL / BLOCKED
Step 18 — Typography & Tokens: COMPLETE / PARTIAL / BLOCKED

Starting branches/commits:
Feature branch names:
Commit hashes (only if commits actually made):
PR links/status (only if actual):
Integration branch state:
Main release checkpoint: APPROVED / NOT APPROVED / NOT REQUESTED

Exact brand palette:
Accessible semantic foreground variants:
Token source(s):
Tailwind/shadcn integration:
Font choice:
Typography scale:
Spacing/container tokens:
Radii/shadows/z-index/motion tokens:
Dark mode disposition:

Tests:
- Lint:
- Type-check:
- Unit/contrast checks:
- Build:
- Browser responsive visual check:
- Focus/reduced motion:
- Existing pages regression:

Documents created/updated:
Files changed:
Unexpected changes:
Issues fixed:
Unresolved issues:
Security/scope review:

Approved next step:
Step 19 — Reusable UI Component Library
```

---

# 6 · Cross-step quality and security rules

These apply to **both Steps 17 and 18**:

1. **Read actual files**. This prompt does not assert any step has been executed merely because an earlier prompt exists.
2. **Use official brand colors as approved**; never silently swap to the older navy/orange palette.
3. **Version-appropriate integration**. Never mix Tailwind v3 and v4 configuration snippets without inspecting installed dependencies.
4. **Keep web/app concerns separated from backend contracts**. Do not introduce browser-only code into the Step 16 shared TypeScript package.
5. **Maintain accessibility**. WCAG contrast must be tested on actual color pairs; tests are useful evidence but not complete certification.
6. **No new data processing**. These steps should not access privileged agency/project records or any production DB. If a demo fixture is needed, use static synthetic labels only.
7. **No role bypass**. Do not encode authorization in CSS classes, visible state or disabled buttons as a security substitute.
8. **Do not modify secrets or deployment config**. No reason to change `.env`, API keys, JWT handling, cookies, Atlas networking or CORS for design tokens.
9. **Keep components for Step 19**. Avoid building full dialogs/buttons/tables/auth pages/map features in this group.
10. **Preserve sibling modules**. Shared theme files may impact all teammates; inspect effects and communicate breaking visual contracts before integration.
11. **Do not suppress tests**. Do not delete tests, disable lint rules wholesale, set TypeScript `strict: false`, or weaken expectations to turn a failure green.
12. **Respect existing changes**. Never `git reset --hard`, force-checkout, blanket stash, overwrite owned changes or delete branches without permission.
13. **No false success**. Report command exit codes, unavailable tools and visual-review blockers accurately.
14. **Scope-based review**. If unrelated issues already exist, distinguish baseline defects from new changes; do not rewrite broad unrelated code without approval.
15. **No premature main merge**. Only a reviewed, explicitly approved stable release/phase gate goes to `main`.

---

# 7 · Suggested manual verification checklist

Use this checklist in the actual running Next.js app where possible:

- [ ] App loads at normal viewport; background neutral and text is readable.
- [ ] Existing temporary page or internal preview uses four exact brand swatches.
- [ ] Orange as plain text on white is replaced with accessible dark-orange token or another verified treatment.
- [ ] Yellow warning appears with dark text and a 'Pending'/'Warning' label.
- [ ] Maroon critical status appears with meaningful 'Critical Conflict' label/icon.
- [ ] Green success text uses a readable foreground variant or dark text on brand green fill.
- [ ] Keyboard Tab navigation has visible focus; active/selected states are distinct.
- [ ] No meaningful state conveyed only through color.
- [ ] Mobile 320px, 375px; tablet 768px; desktop 1280px show no token-induced overflow/clipping.
- [ ] Large project title, long agency name, `LKR` amount, dates and multi-digit KPIs remain legible.
- [ ] Mixed Unicode/Tamil/Sinhala sample content renders without clipping where a usable fallback is present.
- [ ] Reduced-motion preference does not cause essential content to disappear or animate excessively.
- [ ] App does not load a new unnecessary animation/theme library.
- [ ] No build/runtime hydration errors from font or theme setup.
- [ ] No active CSS hardcoding contradicts the approved palette without an explained exception.
- [ ] No backend routes, MongoDB schemas, auth logic or project features changed.

---

# 8 · Completion discipline

**Step 17 Definition of Done:** A reviewed, accessible, Tailwind/shadcn-compatible **brand/color system**, with light-theme semantic tokens and usage documentation, ready for later component construction.

**Step 18 Definition of Done:** A reviewed **typography/spacing/layout/radius/shadow/motion token system**, verified on top of Step 17, ready for Step 19 components and Step 23 shell.

**Group Definition of Done:** Both are individually verified, tested, documented and safely integrated into `development` after team review. A final combined check passes. Stop and wait for instruction before Step 19.

---

# 9 · Reference note for execution agents

The separate companion file contains ready-to-copy **Cursor Agent** and **Codex** launch prompts for each step, including branch logic, pre-review, implementation, bug fixing, testing, documentation, commit/PR handoff and post-merge verification.

**Files should be placed somewhere discoverable inside the INFRAOS repository, such as:**

```text
docs/prompts/INFRAOS_Development_Prompts_Steps_17_to_18.md
docs/prompts/INFRAOS_Cursor_Codex_Execution_Steps_17_to_18.md
```

Do not assume those files are already in the repository until the operator places them there. No development tool can read a document it has not been given or mounted.
