# INFRAOS — Complete Enhanced Development Prompts
## Phase 4 · Steps 25–26 — Public Landing Navigation & Hero → Problem & Solution Story

**Project:** INFRAOS — National Infrastructure Intelligence & Coordination Platform  
**Vision:** *The Operating System for National Infrastructure*  
**Lifecycle:** Plan → Coordinate → Approve → Build → Verify → Monitor → Complete → Maintain  
**Product framing:** Sri Lankan university GovTech/infrastructure coordination platform; real public services/integrations are not implied  
**Roadmap grouping:** Steps **25 and 26** (sequential step-level review) within public landing core group **25–29**  
**Primary feature branch:** `feature/public-landing-core` — SHARED for Steps **25–29**, not one new branch per step  
**Target:** `development` after approved group PR; `development → main` only at a separately authorized stable checkpoint  
**Companion:** `INFRAOS_Cursor_Execution_Prompts_Steps_25_to_26.md`  
**Implementation agent:** Cursor Agent (any approved capable model), using the actual repository for truth

> **Scope/source note.** Previous INFRAOS planning treats Step 25 as the public-site navigation/hero foundation and Step 26 as the problem/solution narrative. The original `Steps.docx` is not available in this file-creation environment. Cursor MUST read the canonical roadmap in the repository before coding and report any difference in exact step wording, rather than silently rewriting or renumbering the roadmap. The implementation specifications below preserve the established intent and adjacent Steps 27–34 boundaries.

---

# 0. Mandatory execution contract

Act as **INFRAOS Principal Frontend Architect, Government/Enterprise UX Designer, Next.js App Router Engineer, shadcn/Tailwind Design-System Specialist, Accessibility and Performance Engineer, QA Lead, Security Reviewer, and Git Integration Mentor**.

You will build the **first coherent public-facing marketing experience** using the already-approved frontend design system, without touching operational workflows or representing a real government service. The aim is a polished, credible entry point that explains INFRAOS and leads into the later lifecycle/features section and product preview.

## Strict step order and review gates

```text
READ-ONLY PRE-FLIGHT + REQUIREMENTS RECONCILIATION
   → verify Step 24 integrated into development
   → inspect Git, repo, current public/app routes and all design tokens
   → establish shared group branch `feature/public-landing-core` safely
   → STEP 25: header/navigation + hero only
   → Step 25 post-review + tests + fixes + checkpoint
   → explicit approval to proceed within same feature branch
   → STEP 26: problem + solution sections and connected anchors/CTAs
   → Step 26 post-review + tests + fixes + checkpoint
   → optional group interim review, WITHOUT claiming Steps 27–29 complete
   → STOP; retain same feature branch for Steps 27–29
   → only after Steps 25–29 complete: approved group PR → development
   → approved stable checkpoint only: development → main
```

**If Step 24 is not actually approved/integrated:** STOP and report the blocker; earlier `.md` prompt documents alone do not establish implementation. **Do not automatically commit/push/merge/rebase/reset/stash/create PR** without explicit approval. Prepare proposed commands and a review handoff instead.

**Branch policy update (overrides older per-step-branch prompts):** One shared branch `feature/public-landing-core` serves **Steps 25–29**, with meaningful step checkpoint commits **only after approval**. Do NOT create `feature/step-26-*` if Step 25 work is already on the shared group branch. Keep the branch open for next grouped prompts. A single PR to `development` is expected when 25–29 is complete and verified, or earlier only if the team explicitly approves an intermediate integration change.

---

# 1. INFRAOS architecture and public-site boundaries

## 1.1 Product in one paragraph

INFRAOS coordinates infrastructure planning across road, water, electricity, telecom, drainage and other agencies; ProjectTrace supports delivery/progress accountability, RoadSync identifies explainable **geographic and scheduled-work conflicts** deterministically before construction, and InfraMap/inspections/assets/citizen functions support a shared infrastructure lifecycle. The public landing must communicate this value **without inventing live infrastructure statistics, real agency partnerships, or functioning government integrations**. It is an academic prototype until otherwise documented and authorized.

## 1.2 Existing locked stack (verify actual versions)

```text
apps/web                  Next.js App Router, React, TypeScript, Tailwind, shadcn/Radix
                         Step 17: brand and semantic color tokens
                         Step 18: typography, spacing, radii, shadows and motion tokens
                         Step 19: UI primitives
                         Step 20: RHF + Zod form infrastructure
                         Step 21: TanStack Data Table infrastructure
                         Step 22: reusable feedback states
                         Step 23: responsive operational application shell
                         Step 24: accessibility foundation

apps/api                  Express TypeScript modular monolith, REST /api/v1
MongoDB Atlas/Mongoose   GeoJSON, 2dsphere indexes, demo records, future domain APIs
packages/shared-types    API/DTO/role/status contracts where actually implemented
Python FastAPI           Later optional AI risk / DocTrace service
MapLibre + OSM            Later InfraMap and landing GIS product preview (Step 30)
```

**The public landing is frontend-only in Steps 25–26.** Do not add HTTP endpoints, DB queries, login, new roles, session cookies, analytic tracking, real-time RoadSync, official GIS layers, PDF/reporting, artificial AI functionality, or payments. The public copy should explain **intended** capabilities accurately and distinguish prototype from operational deployment.

## 1.3 Route/layout separation

Inspect the actual `apps/web/src/app` structure and existing route groups, layouts, auth placeholders and shell. Prefer the project's existing public-site route/location. If justified by the existing App Router architecture, use a route group like:

```text
apps/web/src/app/
  (public)/
    layout.tsx            # optional small PUBLIC layout only, if repo uses route groups
    page.tsx              # '/' marketing homepage, if '/' is approved public entry
  (app)/                  # EXISTING private/operational shell — don't regenerate
  layout.tsx              # existing global providers/fonts/tokens; minimal change only
```

**Illustration only — not a demand to reorganize existing routes.** Route groups do not change URL paths, and two App Router routes mapping to `/` conflict. Inspect current `app/page.tsx` and route groups first. Preserve existing protected/dashboard architecture; never accidentally wrap a public homepage with the Step 23 operational sidebar or remove an existing functioning entry page without team approval.

## 1.4 Ownership boundaries

- This is **public marketing/frontend content**, not a new team-owned ProjectTrace/RoadSync feature.
- Global theme token changes require strong justification; prefer consumption over modification.
- Coordinate on changed shared navbar/layout/header files to avoid collisions with Step 23 shell and teammates.
- If `/` already functions as an operational routing entry, present options in pre-review instead of overriding it without approval.

---

# 2. Locked brand, semantics and visual direction

## 2.1 Exact approved identity palette

| Intent | Raw identity color | Correct public use |
|---|---|---|
| Primary orange | `#FF5B00` | INFRAOS brand mark emphasis, CTAs, active accents, narrative geometry |
| Yellow | `#FEB600` | Illustrative coordinated/pending work; small accent, not mandatory text color |
| Maroon | `#8C1F28` | Conflicts/critical infrastructure problems — with labels |
| Green | `#279541` | Resolved/approved/intended beneficial outcomes — with text or icon |
| Canvas | `#F8FAFC` | Main page background |
| Surface | `#FFFFFF` | Cards/panels/nav surface |
| Foreground | `#111827` | Headings/body |
| Secondary | `#475569` | Supporting text |
| Muted | `#64748B` | Subtle but still legible metadata |
| Border | `#E2E8F0` | Cards/nav/section dividers |

The original navy `#0F172A` / old orange `#F97316` are **not** the active INFRAOS brand. Preserve approved Step 17–18 CSS semantic variables; do not scatter repeated raw hex values across JSX. Orange/yellow/green raw fills do not automatically permit white body text; verify text/background pair contrast, and use accessible derived foreground variants (such as dark ink on orange) approved in Step 17.

## 2.2 Art direction

**Professional GovTech / GIS / infrastructure intelligence:** predominantly neutral/light enterprise surface; large but not oversized typography; restrained orange highlights; precise road/polyline/map-grid cues; intentional whitespace; readable source labels. A premium modern product, not a flag collage, official state portal imitation, or overly colorful SaaS template.

- Avoid national flags, agency insignia, coats of arms, official-looking certificates/seals unless verified authorized assets already exist.
- No generic stock imagery required. If an existing appropriate approved asset is available, optimize it; otherwise use a lightweight, **original frontend CSS/SVG decorative illustration** rather than making up screenshots of real systems.
- Avoid large animated background canvases, particle effects, autoplay video, massive Lottie bundles, and parallax. Motion/GSAP is later **Step 33**.
- Visualize infrastructure **coordination** rather than an ungrounded claim of AI omniscience: two lines/projects, date overlap and a labeled coordination outcome, with clearly illustrative/mock data.

## 2.3 Typography, responsive behavior and accessibility

Reuse Step 18 type/spacing/containers and Step 24 focus/a11y patterns. Target responsive reading hierarchy at 320px, 375px, 768px, 1024px, 1280px and wide desktop. Keep readable line length, no forced horizontal page scroll, one H1 on page, visible focus, proper landmarks, reduced-motion support, 200%/400% browser zoom and meaningful image alternatives. Decorative-only SVG must be hidden from assistive tech.

---

# 3. STEP 25 — Public Header, Navigation and Hero Foundation

**Step intent:** Deliver the first credible above-the-fold marketing experience with a reusable **public-only** header/mobile navigation and hero. Future nav destinations must never appear as working if those sections/routes do not exist.

**Branch:** `feature/public-landing-core` — **create once** from latest approved `development` after Step 24.  
**Commit checkpoint (approval-gated):** `feat(landing): add INFRAOS public navigation and hero`  
**Review gate:** Complete Step 25 quality checks **before** writing Step 26.

## 3.1 Step 25 pre-implementation audit (required deliverable)

Read and inspect actual sources:

```text
AGENTS.md / .cursor/rules/* / CURSOR_STEP_EXECUTION_RULES.md (if present)
README.md and docs/planning, docs/architecture, docs/ux, docs/design, docs/adr
canonical Steps.docx or repository roadmap
apps/web/package.json + lockfile
apps/web/src/app/layout.tsx
apps/web/src/app/page.tsx and route groups
apps/web/src/components/ui/*
apps/web/src/components/common/* and existing public components
apps/web/src/app/globals.css and existing token CSS/Tailwind/shadcn config
existing operational shell/header/sidebar from Step 23
accessibility standards/tests established by Step 24
actual Next.js installed version + npm/pnpm/yarn scripts
existing app-router metadata and images/fonts
Git state and untracked prompt files
```

**Written Step 25 PRE-REVIEW:**

```text
Repository branch / base SHA / clean or dirty state:
Step 24 merged/approved? Evidence (commit/PR + actual code):
Current root path '/' behavior:
Current public page/layout routes:
Existing operational app shell and route protection:
Header/nav components reusable vs separate:
Existing brand/logo assets and copyright/permission:
Tailwind/shadcn version and token source:
Existing typography/spacing/a11y rules:
Existing public assets and image-loading constraints:
Current test, lint, type-check and build baseline:
Potential teammate changes or untracked files:
Step 25 file-by-file plan:
Proposed CTA destinations verified to exist:
Manual browser testing plan:
Risks and proceed/blocked decision:
```

If Step 24 has not been integrated, or replacing root would damage an existing operational route, **stop and ask for approval** rather than guessing.

## 3.2 Shared feature branch (once for group)

Suggested safe commands only after reading Git state:

```bash
git status --short
git branch --show-current
git remote -v
git log -1 --oneline
git switch development
git pull --ff-only origin development
git switch -c feature/public-landing-core
```

Never force-reset/stash/delete branches. If `feature/public-landing-core` already exists for this group, inspect and continue on it—**do not create a duplicate branch** or start Step 26 on a separate branch. If the workspace has unrelated dirty/untracked work, preserve it and choose a safe path with explicit operator guidance.

## 3.3 Header/public navigation requirements

Build or adapt an independent **PublicSiteHeader** with:

1. **Brand**: text or approved INFRAOS logo; clickable home link; visually restrained orange accent; accessible link name `INFRAOS — Home`.
2. **Primary nav**: links only to **verified existing** public routes/anchors. Keep a small data-driven config (typed if justified) in public layer; don't render future nonfunctional anchors.
3. **Actions**: CTA link only to a real destination. Login/Gov Dashboard links should NOT be enabled before actual auth routes exist; if existing dashboard route is deliberately public as a demo, inspect its privacy/auth behavior before linking and label it clearly.
4. **Responsive desktop/mobile**: desktop inline navigation; accessible mobile toggle using existing shadcn Sheet/Drawer or an approved accessible dropdown, never roll an inaccessible menu from scratch.
5. **Mobile menu**: unique label and `aria-expanded`/aria-controls or the established Radix semantics; keyboard focus, Escape close, outside click as appropriate, route-click close, focus restoration, backdrop scroll management where applicable.
6. **Skip navigation link**: focus-visible `Skip to main content`, targeting the actual page `<main id="main-content">`.
7. **Sticky vs static**: choose by product/user research and actual design; if sticky, avoid content occlusion, focus-hidden anchor targets, animation-induced layout shift and intrusive shadow.
8. **Accessibility**: semantic `<header>`, `<nav aria-label="Primary">`, `<a href>` for navigation, hover and focus styles, 3:1 meaningful non-text outlines, 4.5:1 ordinary text.
9. **Resilience**: no hydration errors, mobile offscreen trapping, broken links, duplicate nav landmarks without distinct labels, or reliance on client auth provider.
10. **Extension point**: nav data can gain anchors for Step 26/27/28/29 as the sections are actually created.

Suggested component ownership (adapt, do not create duplicates):

```text
apps/web/src/components/landing/public-site-header.tsx
apps/web/src/components/landing/public-mobile-nav.tsx  # only if needed
apps/web/src/lib/landing/navigation.ts               # optional typed config
```

The public header should be independent of the Step 23 **operational** sidebar and its future permission gates. Do not delete the operational shell.

## 3.4 Hero content and hierarchy

The hero must quickly answer: **What is INFRAOS? Who is it for? Why does it matter? What should a visitor do next?**

Recommended editorial structure (content suggestions, not unsupported statistics):

- Small contextual eyebrow: `National Infrastructure Intelligence & Coordination` or `Infrastructure Coordination Platform`.
- H1 containing clear value: `One shared view of infrastructure. Better coordination before construction.`
- Supporting one to two sentences referencing ProjectTrace and RoadSync: `INFRAOS connects infrastructure plans, location and timelines, helping teams spot overlapping works early and coordinate with greater clarity.`
- Small trust/clarity note: `University prototype • Demonstration workflows use synthetic data` or equivalent wording appropriate to actual deployment.
- Working hero CTA(s): implement only if they resolve to an existing public route/section at the current checkpoint. As Step 26 adds `#problem`/`#solution`, wire `Explore the approach` to the **implemented** anchor during Step 26; do not ship a broken anchor in Step 25. No fake "Get Started" to absent login page.
- Optional **static illustrative infrastructure coordination diagram**: two planned works on a simplified road segment with a conflict indicator and an intent to coordinate; clearly not an actual map/confirmed detected result.

**Hero constraints:** one H1, logical content order, marketing copy grounded in actual roadmap capabilities, visually legible against approved light surfaces, no statistics such as `40% saved` without verified source/data, no "AI automatically approves" wording, no official/real-time public-platform claim.

## 3.5 Layout/composition

- Preferred hero structure: semantic `section` with accessible heading, centered or split copy/illustration design depending on existing patterns.
- Use Step 18 spacing/container scale. On wide screens, optional two-column copy+illustration; on narrow screens stack content logically.
- Keep initial viewport readable; avoid enormous whitespace that hides purpose.
- Artwork should have limited DOM/SVG complexity. If hero illustration conveys unique information, provide informative alt/accessible description; otherwise mark as decorative and repeat the key value in text.
- CTA layout must adapt to 320px without clipping and without insufficient focus ring contrast.
- Respect `prefers-reduced-motion`, and do **not** add GSAP/Framer Motion now just to animate a hero; Step 33 covers brand animation.
- Ensure no server/client mismatch from random values, locale dates, window access or generated hydration-time text.

## 3.6 SEO/metadata (scope-limited)

Use existing Next.js Metadata API conventions to supply truthful page title and description. Example:

```text
Title: INFRAOS | National Infrastructure Intelligence & Coordination
Description: INFRAOS is a platform concept for coordinating infrastructure projects, schedules, agencies and project progress through a shared workflow.
```

- Do not fabricate official endorsements, uptime, live integration, rankings or deployment status.
- Add semantic Open Graph metadata only with valid preexisting approved image/canonical URL; don't invent a live production domain or claim final launch.
- Ensure heading hierarchy and visible branding are consistent with metadata.
- `lang` should follow actual app language decision. Do not falsely claim Sinhala/Tamil full localization.
- Avoid adding analytics/tracking, cookie banners or new SEO tooling absent requirement/approval.

## 3.7 Step 25 integration and testing

**Frontend:** compile with existing App Router and design system. **Backend:** no API interaction or new endpoint; CTAs to absent feature routes must not exist. **Database:** none. **Security:** no auth client import, no privileged data, no insecure external links or raw HTML.

Focused checks:

```text
[ ] Public homepage loads without operational shell leaking into marketing page
[ ] INFRAOS home link resolves and is not a duplicate pathname conflict
[ ] Desktop header renders and remains readable
[ ] Mobile drawer keyboard works: open, Tab/Shift+Tab, Escape, close and focus restore
[ ] Skip-to-main works for keyboard and screen reader
[ ] No broken CTA or dangling #anchor
[ ] Heading hierarchy includes one useful H1
[ ] No fake govt endorsement / official logo / invented live metrics
[ ] Responsive at 320/375/768/1024/1280 px and 200% zoom
[ ] Brand+foreground colors pass applicable contrast tests
[ ] No unexpected layout shift/hydration/console error
[ ] Next.js lint, type-check, focused tests, build work as available
```

When existing Playwright/Vitest/RTL tools are available, add focused tests for actual behavior; do not introduce a new end-to-end testing framework just for two sections if existing tools suffice. Record `PASS`, `FAIL`, `NOT RUN`, `N/A` accurately.

## 3.8 Step 25 post-implementation review (must be filled)

```text
STEP 25 — POST-IMPLEMENTATION REVIEW
Prior Step 24 integration proof:
Current shared branch and start commit:
Files created/changed:
Public route/layout integrity:
Existing operational shell preserved:
Desktop/mobile navigation review:
Keyboard, skip link and focus return:
Hero copy truthfulness and clarity:
CTA destinations verified:
One H1 and valid headings/landmarks:
Responsive/screens/zoom checked:
Token/contrast checks:
Next metadata and hydration/performance:
Sensitive data/auth/GIS/AI scope inspection:
Lint / type-check / tests / build results:
Bugs found and fixed:
Tests rerun after fixes:
Documentation updated:
Git diff/staged/untracked review:
Approval for Step 26 in SAME branch: Pending/Granted
```

**Hard stop:** finish Step 25 review and **wait for approval to begin Step 26**. Do not create a second branch. Do not open a premature group-completion PR just for Step 25 unless separately authorized.

---

# 4. STEP 26 — Problem Framing and INFRAOS Solution Narrative

**Step intent:** Build the next meaningful public-site section(s) communicating the real coordination problem and **how INFRAOS proposes to solve it**, while preserving honest prototype wording and explaining RoadSync vs ProjectTrace without implementing either domain workflow here.

**Shared branch:** `feature/public-landing-core` (continuation from Step 25, **not a fresh branch**)  
**Suggested checkpoint commit (approval-gated):** `feat(landing): explain infrastructure coordination problem and solution`  
**Prerequisite:** Step 25 implemented, reviewed and checkpoint approved on the shared branch  
**Review gate:** complete Step 26, then STOP. Steps 27–29 continue later on same branch.

## 4.1 Step 26 pre-step review — independent even within shared branch

- Inspect current branch/working tree and Step 25 checkpoint, modified/untracked teammate docs and pending PR state.
- Verify header/H1/main markup and Step 25 CTA behavior in actual app.
- Read any canonical roadmap copy/storyboard, audience/positioning docs and approved UX language; do not substitute unsupported claims.
- Identify what is already built under root page. Avoid duplicate `id="problem"` or `id="solution"` anchors.
- Audit mobile nav anchor handling and sticky header offset; decide what links to update **only when target sections exist**.
- Confirm reuse of Step 19 Card/Badge/Alert etc. where relevant, without turning story cards into app-only controls.
- Record intended file changes, content outline, QA cases and remaining scope for Step 27.

**Written Step 26 PRE-REVIEW:**

```text
Branch and commit checkpoint from Step 25:
Step 25 review approval evidence:
Working-tree status and untracked files:
Existing hero and nav route/anchor behavior:
Public content tone and unsupported claims to avoid:
Problem/solution story map:
Cards/illustrations reusable vs custom:
Files to modify:
Accessibility/SEO/performance concerns:
Proposed tests and visual checks:
Proceed / blocked:
```

## 4.2 Problem section — why coordinating infrastructure is hard

Write a clear accessible section with a unique ID, e.g. `id="problem"`, h2, intro, 3–4 **specific problem patterns**, and a transition to the solution. Suggestions:

| Problem story | Concrete explanation | Avoid |
|---|---|---|
| Repeated excavation | One utility repairs a road shortly after resurfacing because planning is disconnected | Claiming an actual agency did this unless supported |
| Schedule blind spots | Separate teams cannot easily see work windows on the same corridor | Unsupported national numeric impact |
| Fragmented project progress | Project milestones, spending and progress are tracked across separate views | Implying real integrations already exist |
| Limited verification and continuity | Evidence/inspections and later asset maintenance aren't in one traceable lifecycle | Claiming all features are complete and deployed |

**Copy suggestion:**

- Eyebrow: `The coordination gap`
- H2: `When infrastructure plans live separately, avoidable conflicts follow.`
- Body: `A resurfaced road and a planned pipeline can share the same location and work window without a common view. INFRAOS is designed to make those overlaps visible before teams start work.`

Use human-centered explanations for citizens/officers, not vague phrases like “revolutionize everything” or “100% accuracy”. No fake impact counts, fake quotes/testimonials, unaudited cost savings, or actual road status claims.

## 4.3 Solution section — credible, explainable workflow

Add `id="solution"`, h2, concise description and a short **how-the-solution-works** narrative that remains distinct from the **full Step 28 lifecycle workflow showcase**. The story needs to make ProjectTrace and RoadSync understandable, without duplicating future marketing features.

Suggested limited 3-part conceptual flow:

```text
SHARE PLAN  →  DETECT OVERLAP  →  COORDINATE EARLY
project and work schedule    location + overlapping dates    agency review + resolution path
```

- ProjectTrace: project creation, accountability, milestones and progress, described as intended platform capabilities (reflect actual implementation if already present).
- RoadSync: deterministic spatial/time overlap detection and cross-agency coordination. **Not AI-generated conflict truth**.
- InfraMap: shared map-based visibility as an intended module; full product preview is Step 30.
- Follow-through: inspection, risk and asset maintenance are downstream components, **not full content showcases** until later steps.

**Copy suggestion:**

- Eyebrow: `A shared infrastructure view`
- H2: `Plan together. Coordinate earlier. Build with fewer surprises.`
- Body: `INFRAOS brings project schedules, locations and responsibilities into one coordinated workflow. RoadSync can identify planned-work overlaps using geography and dates, while ProjectTrace organizes delivery and progress.`

**Do not imply:** the platform has government approval authority, makes unilateral operational decisions, predicts actual conflicts through a generative model, provides verified nationwide map data, or is a production public-service portal.

## 4.4 Problem → solution visual treatment

- Prefer a layout that makes relationship obvious (e.g., **Before: fragmented plans / After: coordinated view**) without deceptively claiming quantified impact.
- At most 3–4 compact problem cards plus one restrained solution panel; use existing Card primitives if installed.
- If using simple SVG road work lines, provide labels and a textual explanation; do not draw an official-looking, unlabeled geographic map.
- Conflict uses maroon + label; pending coordination yellow + label; resolved green + label. Use primary orange for highlighted shared workflow, not as a universal error color.
- Avoid confusing visually simultaneous "before/after" example as real live data; caption `Illustrative scenario` if concrete dates/projects are shown.
- All informative images have meaningful alt or adjacent explanation; purely decorative icons are `aria-hidden`.
- Avoid animations that convey sequence only via motion. Step 33 owns GSAP choreography.

## 4.5 Anchor/CTA/header integration

Once section IDs are physically rendered and tested:

- Update `PublicSiteHeader` nav config to include the actual `#problem` and `#solution` links if desired; use fully valid same-page links from current route and test mobile close on navigation.
- Wire hero CTA to the existing `#solution` anchor (or other real destination). Choose clear copy, e.g., `Explore how INFRAOS works`.
- Ensure native anchor scroll works with keyboard navigation, reduced motion, sticky-header offset (`scroll-margin-top` when necessary), and correct focus/reading order.
- If header also appears on additional public pages, cross-page anchor links must use `/#solution` rather than `#solution` pointing at nonexistent content on that page.
- Anchor target content must be reachable if JavaScript is disabled when feasible; avoid JS-only smooth scroll as the sole path.
- Remove dangling placeholder links; do not add future `#features`, `#lifecycle`, `#product`, `#faq` links before their sections exist.

## 4.6 Frontend/backend/security boundaries

Step 26 only renders informational content based on roadmap decisions. No API calls, MongoDB/Atlas reads, new schema, auth, permissions, document uploads or third-party marketing analytics. All data/examples must be clearly fictional or general. If showing an illustration of RoadSync conflict, label it conceptual and not a live detected conflict.

Avoid dangerous HTML injection and unnecessary user input; no form fields are needed. Preserve real href destinations; external links (if any) need trusted URLs and safe semantics. Don't leak private routes/session state in public HTML.

## 4.7 Step 26 testing matrix

```text
[ ] Problem and solution sections appear once, with unique IDs and h2 hierarchy
[ ] Messaging explains repeated road work and uncoordinated schedules correctly
[ ] Distinguishes ProjectTrace and deterministic RoadSync responsibilities
[ ] Does not claim actual government affiliation/live analytics/production capabilities
[ ] Header links and hero CTA resolve to actual anchors/routes
[ ] Mobile nav closes reliably after selecting in-page anchor
[ ] Keyboard focus/reading order and native anchor behavior are correct
[ ] No fabricated impact statistics/testimonials/agency data
[ ] Color status examples include labels and tested contrast
[ ] 320/375/768/1024/1280 widths and 200% zoom/reflow
[ ] Reduced-motion/forced-colors behavior where applicable
[ ] No jumpy scroll, CLS, excessive client JS or console warnings
[ ] Existing app shell and Step 17–24 components remain unaffected
[ ] Focused tests plus lint/typecheck/tests/build outcomes documented
```

Where tests must be adapted to actual framework, verify rendered section anchors, CTA links, absence of placeholder hrefs, accessible headings, responsive/keyboard behavior, and copy without unsupported claims.

## 4.8 Step 26 post-implementation review

```text
STEP 26 — POST-IMPLEMENTATION REVIEW
Current branch / Step 25 approved checkpoint:
Problem/solution copy and information accuracy:
Distinct ProjectTrace vs RoadSync descriptions:
Section headings and unique IDs:
Actual rendered CTA/navigation anchor checks:
Accessibility (keyboard, alt/labels, focus, contrast, reduced motion):
Responsive and 200% zoom results:
No fake govt endorsements/data/metrics:
Existing Step 25 hero/header regressions:
Backend/security boundaries:
File changes and dependencies:
Lint/type-check/tests/build/browser outcomes:
Bugs found, fixed and re-tested:
Documentation and copy decision register:
Git diff/untracked changes reviewed:
Next task Step 27 within SAME branch only after approval:
```

**Hard stop:** Do not start Steps 27–29 automatically, do not merge group branch yet, and do not switch to an unrelated new branch. Wait for authorization and continue later using `feature/public-landing-core`.

---

# 5. Cross-step component design contracts

## 5.1 Suggested conceptual component tree

Only adapt to actual repo structure and route ownership:

```text
PublicHomePage (server-rendered when possible)
  ├── PublicSiteHeader         # Step 25
  │    └── PublicMobileNav     # client component only if interactive
  └── main#main-content
       ├── LandingHero         # Step 25
       │    └── HeroCoordinationIllustration (optional static accessible SVG/CSS)
       ├── InfrastructureProblem  # Step 26
       │    └── ProblemCard(s)
       └── InfraosSolution        # Step 26
            └── ShortCoordinationFlow (simple static conceptual flow)
```

- Do not create a global `use client` homepage to accommodate just the mobile menu.
- Avoid duplicate `PublicSiteHeader` and app-shell header exports; separate roles clearly.
- Prefer Next.js `<Link>` for internal navigation when appropriate; pure `#section` anchors work via `<a>`.
- Components should accept narrow props or content data only where there is a meaningful reuse need; don't build a general CMS system.
- Avoid 150-line nested conditional JSX for a handful of story cards; keep content easy to edit and translate later.
- No global CSS/side effects unless necessary; follow existing class-variance or Tailwind conventions.

## 5.2 Server Components and performance

- Header's desktop links, homepage content and static problem/solution sections can remain Server Components.
- Only interactive mobile drawer/nav trigger needs client JS if using Radix.
- No client-only random IDs, `new Date()` in hydration path, or fake statistics.
- No unapproved new image library. For real images use existing `next/image` patterns and meaningful alt; no external image hotlinking by default.
- Prevent layout shift by sizing hero visual and reserving dimensions; check LCP and JS chunk weight using available tooling.
- Do not install GSAP/Framer Motion/complex animation toolkit; animation belongs to Step 33.
- Don't introduce a second CSS framework or arbitrary icon system when Lucide/shadcn already exists.

## 5.3 Localization readiness

English is the working UI language unless existing requirements specify otherwise. Don't claim translated Sinhala/Tamil pages or add an internationalization framework here. Layout must handle longer copy and Sinhala/Tamil example strings with font fallbacks when available. Translation keys and localization architecture are future decisions, not Step 25–26 scope.

## 5.4 Honest demo/marketing content standard

Create a short `docs/marketing/content-claims.md` or integrate with existing docs listing **Claim**, **Evidence**, **Allowed wording**, **Deferred/blocked wording**. Examples:

| Claim | Allowed wording | Prohibited without proof |
|---|---|---|
| Product | INFRAOS is a university prototype/concept for infrastructure coordination | Official national government system |
| RoadSync | Designed to identify proposed infrastructure work overlaps using geometry/dates | All real-time Sri Lankan roadworks are automatically tracked |
| Agencies | Supports coordination across different agency types | Government departments have onboarded |
| Results | May reduce avoidable scheduling conflicts when used as intended | `70% cheaper` / `20,000 projects monitored` without data |
| AI | AI may assist risk/document review in future | AI autonomously authorizes public construction |

Review any visible microcopy and alt text, not just headings. Mark synthetic illustrations as illustrative rather than live demonstrations.

---

# 6. Accessibility, responsive and visual QA acceptance

These steps inherit the Step 24 accessibility baseline, targeting relevant **WCAG 2.2 AA** criteria (without claiming third-party certification):

1. **Landmarks**: one main content landmark, distinguishable public navigation label, accessible skip link.
2. **Headings**: page H1 only in hero, problem/solution H2; heading level progression must reflect actual DOM.
3. **Navigation**: all links real/reachable, visible focus, keyboard mobile menu, proper focus return and Esc.
4. **Contrast**: actual text vs background pairs checked for ordinary **4.5:1**; large text **3:1**; meaningful non-text UI indicators **3:1** as applicable.
5. **Use of color**: conflict/resolution messages text-labeled; no flags/colors as sole meaning.
6. **Reflow**: no horizontal body scroll at ~320 CSS px, except legitimate two-dimensional visual elements with accessible text alternative.
7. **Zoom**: 200%/400% workflows and mobile menu functional within available browser tools.
8. **Target sizes**: follow relevant WCAG 2.2 pointer target requirements, with sensible public nav tappable area.
9. **Reduced motion**: no important content gated by movement; no automatic animation dependencies.
10. **Focus order**: hero CTA reachable after meaningful introduction; drawer trap only when open.
11. **Accessible SVG**: decorative `aria-hidden`; meaningful graphic accessible descriptive label or nearby explanation.
12. **No fake accessibility sign-off**: axe is a useful automated screen, not the entire audit.

### Device/browser matrix

| Viewport/condition | Header/navigation | Hero | Problem/Solution | Relevant notes |
|---|---|---|---|---|
| 320 px mobile | Drawer trigger usable | H1 + CTA fully visible, no overflow | Cards stack correctly | No horizontal body scrolling |
| 375 px mobile | Drawer close/return focus | Comfortable wrapping | Legible rows/cards | Touch targets |
| 768 px tablet | Right-sized nav | Layout switch sensible | Section hierarchy | No odd blank columns |
| 1024 px laptop | Full menu or justified breakpoint | Balanced hero | Adequate whitespace | No content jump |
| 1280 px desktop | Aligned max-width nav | Two-column possible | Readable content width | No artificial giant margins |
| 200% zoom | Controls reachable | Headline reflows | Anchors scroll | No clipped text |
| Keyboard only | Tab/Esc/Enter | CTA accessible | Anchor correct | Visible focus |
| Reduced motion | No required animations | Static presentation good | Static flow understandable | Prefers-reduced-motion |

Test browser console and hydration warnings if browser preview is available. If any manual QA tool is unavailable, mark it **NOT RUN** with the exact reason and verification instructions.

---

# 7. Mandatory test plan (real tooling only)

Inspect the actual installed test setup and use existing scripts. Do not copy `npm` examples blindly if the repo uses another package manager.

## 7.1 Step 25 focused test cases

- Public route responds and renders intended landmarks without redirect or operational-shell leakage.
- Brand/home link points to a valid path.
- Header nav renders only real routes and currently implemented anchors.
- Mobile menu trigger has accessible name; keyboard opens/closes; focus restore and Escape.
- Skip-to-main works.
- Hero has one H1 and truthful, readable copy.
- CTA destination valid **at time of Step 25** (or CTA correctly deferred until Step 26).
- Design tokens reused; statuses not expressed solely via hue.
- No broken imports, hydration mismatch, or type error.

## 7.2 Step 26 focused test cases

- `#problem` and `#solution` exist exactly once and are keyboard reachable.
- Hero CTA target becomes valid and navigable.
- Header nav links updated only after anchors are live.
- Mobile menu closes after selecting anchors and focus isn't stranded.
- Problem cards and solution flow have appropriate semantic headings/text.
- Illustrative data appropriately labeled; no invented real metrics/government claims.
- No regression to Step 25 public header/hero or Step 23 operational app shell.

## 7.3 Overall checks

Run real commands for **lint, TypeScript, component tests, Next build, and available browser/e2e checks**. For monorepo, discover package scripts and use project patterns. Distinguish baseline failures from new failures. Run affected tests after each bug fix and broad checks at both Step 25 and Step 26 review gates, as feasible.

Typical commands **only if repo supports them**:

```bash
npm run lint
npm run type-check
npm run test
npm run build
# or scoped equivalents for apps/web from the actual package manager

git diff --check
git status --short
```

If scripts are absent, report `NOT AVAILABLE` rather than inventing new passing commands. No snapshot-only tests that prove nothing, no blanket TypeScript/ESLint suppressions, no disabling a11y lint, and no fake screenshot evidence.

---

# 8. Security, privacy, branding and content review

Even frontend-only public pages have important safety boundaries:

- **Do not expose** internal/private API paths, session state, JWTs, secrets, backend diagnostics or live user data in public rendering.
- Don't use `dangerouslySetInnerHTML` to inject editorial content; render React text and trusted structured markup.
- Don't imply logged-in roles or accessible restricted dashboards before actual auth features exist.
- No unapproved analytics scripts, consent cookies, tracking pixels, signup forms or external marketing data collection.
- External links must be valid and semantically identified; `target="_blank"` requires security-conscious handling appropriate to existing standards.
- No official government seal, implied partnership, source-less numeric impact claims, fake agency logos or live project statuses.
- Don't pull Atlas/synthetic seed records into public copy to claim they represent government evidence.
- Stop if there is a discrepancy between a product claim and documented project scope; include a copy decision question rather than fabricate.
- `RoadSync` spatial and temporal overlap detection is deterministic; never present AI risk as the conflict authority.
- API/server/domain routes unchanged; check Git diff for accidental scope expansion.

---

# 9. Deliverables and documentation

Adapt proposed files to actual existing structure (do not create duplicate route/pages):

```text
apps/web/src/app/(public)/page.tsx                       # or the existing appropriate '/' page
apps/web/src/app/(public)/layout.tsx                     # optional if current routing pattern requires
apps/web/src/components/landing/public-site-header.tsx  # Step 25
apps/web/src/components/landing/public-mobile-nav.tsx   # Step 25, only if needed
apps/web/src/components/landing/landing-hero.tsx        # Step 25
apps/web/src/components/landing/hero-illustration.tsx   # optional static graphic
apps/web/src/components/landing/problem-section.tsx    # Step 26
apps/web/src/components/landing/solution-section.tsx   # Step 26
apps/web/src/lib/landing/navigation.ts                  # optional minimal config
apps/web/src/app/...metadata...                        # only if already using layout/page Metadata API

# Documentation (or equivalent existing docs):
docs/marketing/public-site-content.md
docs/marketing/content-claims.md
docs/design/public-landing-style-guidelines.md
docs/reviews/step-25-pre-post-review.md
docs/reviews/step-26-pre-post-review.md
docs/reviews/public-landing-core-progress.md
```

Documentation must record actual file paths, visible copy, links/destinations, responsive behavior, content-claim truthfulness, brand token usage, test evidence, out-of-scope sections still missing, and remaining review tasks for Steps 27–29. Don't generate unused boilerplate documents if the existing repo already maintains an equivalent set.

---

# 10. Step 25 acceptance checklist (independent gate)

- [ ] Actual canonical roadmap, Git and Step 24 acceptance baseline inspected.
- [ ] Step 24 verified merged in `development`, not inferred from a prompt file.
- [ ] `feature/public-landing-core` created/reused safely; untracked/teammate files preserved.
- [ ] Public route and App Router route-group mapping chosen without collisions or broken app shell.
- [ ] Public header with approved branding and real, working nav links.
- [ ] Keyboard-accessible mobile menu, correct focus return and skip link.
- [ ] Clear hero/H1 describing platform, audience and coordination value.
- [ ] Correct prototype positioning and no fake government endorsement/metrics.
- [ ] CTA real/reachable, or deliberately deferred until valid anchor in Step 26.
- [ ] Brand/semantic tokens, typography and responsive layout used.
- [ ] No GSAP, real GIS, auth/dashboard/domain API or extra marketing sections added.
- [ ] Relevant automated tests, manual viewport, accessibility and build checks honestly documented.
- [ ] Scoped defects fixed, affected tests rerun, documentation complete.
- [ ] Git diff/untracked changes reviewed; Step 25 checkpoint proposal prepared.
- [ ] Step 26 has not started without checkpoint approval.

---

# 11. Step 26 acceptance checklist (independent gate)

- [ ] Approved Step 25 checkpoint exists on **same** branch.
- [ ] Step 26 pre-review, content/story map and scope plan recorded.
- [ ] Problem cards/section accurately describe roadwork coordination issues.
- [ ] Solution explains ProjectTrace, deterministic RoadSync and shared planning accurately.
- [ ] No unsupported government/live/AI automation/numerical claims.
- [ ] `#problem`, `#solution` anchors unique and working; hero/header links verified.
- [ ] Accessible semantic headings, icons, card text, focus and contrast.
- [ ] Mobile/tablet/desktop layouts, sticky-header anchor offset, zoom/reduced motion tested as available.
- [ ] No invented MapLibre/GIS product preview (Step 30) or feature/lifecycle sections (Steps 27–29).
- [ ] Existing app shell and Step 17–25 code remain functional.
- [ ] Relevant automated tests, lint, type-check, build and browser checks honestly documented.
- [ ] Post-review/fixes/retests done; no critical new warnings/regressions left unaddressed.
- [ ] Docs and Git diff updated; Step 26 checkpoint proposal prepared.
- [ ] **No group-complete claim** and no automatic merge to `development` or `main`.

---

# 12. Shared branch lifecycle, approval gates and group continuation

## 12.1 Git policy for the public landing core

```text
approved development (Step 24 already merged)
        └── feature/public-landing-core
                 ├── Step 25 implement → test → review → approved checkpoint commit
                 ├── Step 26 implement → test → review → approved checkpoint commit
                 ├── Step 27 ... later with separate step-level review
                 ├── Step 28 ... later with separate step-level review
                 └── Step 29 ... later with separate step-level review
                          ↓
                    entire group regression
                          ↓
                    approved PR → development
                          ↓
                    post-merge checks
                          ↓
                    main only at separately approved stable release gate
```

Do not auto-commit/push/merge or reset/rebase teammates' changes. Commits are **checkpoint proposals pending approval**. A later team decision may approve earlier integration of a stable subset; do not presume it. If `development` advances during work, discuss how to integrate upstream changes safely with the group branch; no destructive surprise rebase.

## 12.2 Git safety and diffs

```bash
git status --short
git branch --show-current
git log --oneline --decorate -n 10
git diff --check
git diff --stat
git diff --name-only
# Inspect untracked files separately: git diff doesn't list them.
```

Review lockfile additions, route changes, `layout.tsx`, global styling, metadata, `public/` assets, and excluded `.env`/secrets. If the old Step 24 branch or `main` is checked out, **do not modify them as a shortcut**. Never include five or more unrelated prompt files in a commit by running `git add .` without reviewing them.

## 12.3 PR strategy

At end of Step 26 produce an **interim readiness handoff**, not a PR implying Steps 25–29 are finished. Use one group PR after Steps 25–29 have all passed reviews. Keep the existing shared branch for 27–29. State `main: unchanged` unless explicitly approved release event happens independently.

---

# 13. Mandatory combined interim review after Step 26

Review the two completed steps together:

| Topic | Required evidence |
|---|---|
| Routing | Working public root / no duplicate routes / shell isolated |
| Nav | Desktop/mobile/skip link/focus and link integrity |
| Hero | H1, product value, accurate demo framing |
| Problem | Realistic but not falsely sourced road/utility planning issues |
| Solution | Accurate ProjectTrace and deterministic RoadSync story |
| CTA | Working anchors/routes only, target exists |
| Styling | Four raw brand colors + neutrals, semantic accessible variants |
| Accessibility | WCAG-relevant keyboard, labels, contrast, reduced motion, zoom/reflow checks |
| Performance | No heavy animation/GIS dependencies, no image layout shift |
| Privacy/security | No fake agency affiliation, production access, secrets, private data |
| Tests | Focused suites, lint, type-check, build, browser checks where available |
| Collaboration | No teammate-owned file overwrite, safe shared feature branch history |
| Scope | Steps 27–34 and all operational features untouched |

If any critical failure remains, Step 25 and/or Step 26 must be `PARTIAL` or `BLOCKED`, not marked complete. Don't conceal baseline failures; mark what pre-existed and what these steps introduced.

---

# 14. Final implementation report template (populate with real evidence)

```text
INFRAOS — PUBLIC LANDING CORE: STEPS 25–26 CHECKPOINT

Status Step 25: COMPLETE / PARTIAL / BLOCKED
Status Step 26: COMPLETE / PARTIAL / BLOCKED
Overall group Steps 25–29: IN PROGRESS (NOT COMPLETE)

Canonical roadmap read? yes/no, discrepancies:
Step 24 approved in development? commit/PR evidence:
Git base branch/commit:
Shared feature branch: feature/public-landing-core
Working tree/teammate changes preserved:
Step 25 approved checkpoint evidence:
Step 26 approved checkpoint evidence:

Files created/modified/deleted:
Public route and app-shell separation:
Desktop/mobile navigation components:
Hero content and CTA destinations:
Problem section copy and structure:
Solution story and RoadSync/ProjectTrace accuracy:
Brand/design tokens used:
Metadata and SEO decisions:
Accessibility/keyboard/zoom testing:
Responsive viewport checks:
Performance/lighthouse/runtime console where available:
Security/content claims/privacy review:

Tests (command + PASS/FAIL/NOT RUN/N/A):
- Initial baseline:
- Step 25 focused tests:
- Step 25 lint/types/build:
- Step 26 focused tests:
- Step 26 lint/types/build:
- Step 17–24 regression:
- Browser manual checks:

Defects discovered and fixed:
Regressions remaining:
Documentation updated:
Git status and full diff summary:
Proposed checkpoint commits (approval required):
Suggested continuation: Step 27 on SAME branch
PR: NOT READY for full 25–29 group
Merge development: NOT PERFORMED unless expressly approved
Merge main: NOT PERFORMED unless separately approved

STOP. Await user's approval for Step 27.
```

---

# 15. Final stop rule

Step 25: stop after its own review and approval request before Step 26.  
Step 26: stop after its own review and combined interim review.  
**The feature branch continues through Step 29. Do not start Step 27, push/merge the group, implement GIS marketing preview (Step 30), GSAP (Step 33), authentication (Step 35+) or any operational domain functionality without a separate approved request.**
