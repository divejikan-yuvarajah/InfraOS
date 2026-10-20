# INFRAOS — Complete Enhanced Development Prompts
## Phase 4 · Steps 27–29 — Public Feature/Service Overview → Infrastructure Lifecycle → Audiences & Benefits

**Project:** INFRAOS — National Infrastructure Intelligence & Coordination Platform  
**Vision:** *The Operating System for National Infrastructure*  
**Product identity:** Sri Lankan university GovTech demonstration; **not** an official government service  
**Core lifecycle:** Plan → Coordinate → Approve → Build → Verify → Monitor → Complete → Maintain  
**Scope:** PUBLIC INFORMATION / LANDING WEBSITE ONLY; no dashboard, GIS workspace, private feature pages or backend domain features  
**Current owner-reported checkpoint:** Step 26 finished (must verify actual implementation, approved review and branch state)  
**Source dependencies:** Original 190-step roadmap, earlier Step 25–26 implementation specification, and the latest `INFRAOS_Public_Landing_Government_Design_Research_and_Cursor_Directive.md`  
**Shared branch for Steps 25–29:** `feature/public-landing-core` — **REUSE, DO NOT CREATE ONE BRANCH PER STEP**  
**Review gates:** Step 27 reviewed before Step 28; Step 28 reviewed before Step 29; final group review before any PR to `development`  
**Companion Cursor playbook:** `INFRAOS_Cursor_Execution_Prompts_Steps_27_to_29.md`

> **Roadmap note:** The original `Steps.docx` is the canonical numbered roadmap. This document follows the previously agreed interpretation: **Step 27 feature showcase**, **Step 28 infrastructure lifecycle presentation**, **Step 29 public audiences, stakeholder roles and benefits**. If the actual repository copy of the roadmap assigns different exact titles/details, inspect it, state the discrepancy and ask for an explicit scope decision rather than silently renaming steps.

---

# 0. Executive implementation contract

You are operating as **Principal Government Digital Service UX Designer, Senior Next.js/React/TypeScript Engineer, Trilingual Content Architecture Specialist, Public-Site Accessibility Engineer, Security & Privacy Reviewer, Frontend QA Engineer, and INFRAOS Git Integration Lead**.

Implement **only the authorized step** in sequence on the already-established public landing group branch. These three steps share one Markdown specification and one Git feature branch, but **each step needs its own pre-review, implementation, tests, post-review, defect repair, documentation and explicit next-step gate**.

**Mandatory order:**

```text
A. Read requirements + inspect actual repository + inspect Git state
B. Verify previously completed Step 25–26 and public-style alignment
C. Confirm/reuse feature/public-landing-core safely
D. Step 27: pre-review → implement → test → post-review → fix → re-test → checkpoint
E. ONLY after Step 27 approval: Step 28 with independent review gate
F. ONLY after Step 28 approval: Step 29 with independent review gate
G. Combined Steps 25–29 group regression + copy/translation/image review
H. Human-approved commit(s) / PR into development; verify merged code
I. development → main only at separately authorized stable phase/release checkpoint
J. STOP before Step 30
```

**Do NOT**:

- Rebuild completed Steps 25–26 from scratch or broaden them without identifying a concrete defect.
- Add a new branch for Step 27, 28 or 29 while the approved shared feature branch remains valid.
- Assume a branch still exists or is unmerged: inspect local/remotes/PR status first.
- Change internal dashboards, authenticated routes, ProjectTrace/RoadSync workspaces, admin pages, shell or GIS designs.
- Add carousel heroes, autoplay videos, parallax, animated statistics, complex GSAP scenes, decorative particle backgrounds or dashboard-like marketing cards.
- Claim government ownership, public agency endorsement, production connection, real public data or live impact metrics.
- Create fake functioning Staff Sign In, Public Project Search, Complaints, Notices, Project Map or other later features.
- Build or modify Express endpoints, MongoDB models, FastAPI, Qdrant, R2, authentication, RBAC or AI services for a public landing content task.
- Expose protected data through HTML, RSC payloads, static generation, client-side fetches or links.
- Copy copyrighted government photography, logos, seals or copy without rights.
- Automatically commit, push, open PRs, merge, rewrite Git history, stash/reset teammate changes, or touch `main` without specific authorization.

**When Step 26 is not actually complete or the public landing revision is pending:** report a blocker or a limited, explicitly authorized correction plan. Owner-reported completion is not proof of code or merge status. Ask for approval before extensive realignment.

---

# 1. INFRAOS architecture that these steps must preserve

## 1.1 Technology and boundaries

- **Frontend:** Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui; React Hook Form/Zod/TanStack Query only where already necessary, **not needed for purely informational sections**.
- **APIs:** Express modular monolith with `/api/v1` planned domain APIs; do not create endpoints or public access exceptions during this step.
- **Data:** MongoDB Atlas/Mongoose GeoJSON and 2dsphere infrastructure; do not query, expose or synthesize backend records for marketing copy.
- **Later AI:** Python FastAPI/RAG/risk; do not suggest public AI functionality exists unless verified.
- **Map:** MapLibre/OSM planned operational GIS; Step 30 preview later and only when honest. These steps do **not** render a live map.
- **Identity:** Later actual authentication, RBAC, agency/resource-scope restrictions and audit; never implement auth through CSS/nav choices.
- **Step 17–24 foundation:** approved colors, type/rhythm tokens, primitives, forms, data tables, state components, app shell and accessibility patterns already introduced; **reuse, don't duplicate**.

## 1.2 Modules you may truthfully describe, not necessarily link

- ProjectTrace — project oversight, milestones, progress and accountability.
- RoadSync — planned road/utility work location **and time** overlap candidates using deterministic rules, plus inter-agency coordination workflow.
- InfraMap — GIS infrastructure visibility (real feature later; informational description only now).
- Inspection, assets/maintenance, finance/contractors, DocTrace, risk intelligence and citizen issue reporting — **planned or future unless actual code proves otherwise**.

The public site must distinguish **platform intent**, **actually implemented demos**, and **planned roadmap capabilities**. Do not turn planned module names into fake clickable app features. Never claim RoadSync currently performs live detection in production.

## 1.3 User audiences

Public landing is freely readable by citizens, local communities, students, visitors, officers, administrators, inspectors, contractors and staff. No visitor must choose a role before reading basic information. Public access and protected platform authorization are separate.

## 1.4 Approved Sri Lankan flag-inspired identity — restrained usage

| Token | Raw value | Appropriate public use |
|---|---|---|
| Orange | `#FF5B00` | Brand mark/underline, selected navigation, primary visual emphasis |
| Yellow | `#FEB600` | Limited warning/highlight where meaningful |
| Maroon | `#8C1F28` | Institutional accent, meaningful severe notice only |
| Green | `#279541` | Verified success/positive state, not generic decorative badge |
| Canvas | `#F8FAFC` | Light background |
| Surface | `#FFFFFF` | Standard information surface |
| Main text | `#111827` | Headings and readable body |
| Secondary | `#475569` | Supporting body |
| Muted | `#64748B` | Nonessential metadata |
| Border | `#E2E8F0` | Subtle separators |

Use accessible **semantic foreground variants** from Steps 17–18: ordinary white text on raw orange or green and yellow text on white may fail WCAG normal-text contrast. Verify actual pair. Government-inspired means calm, understandable and trustworthy, **not** an official government seal or rainbow layout.

---

# 2. Public design direction — OVERRIDES old SaaS concepts

## 2.1 What to aim for

A user should immediately understand the site's purpose, how inter-agency coordination works, whether information is a demo, where to get further information, and how staff will eventually access authenticated systems.

Preferred site character:

- Plain, informative headings and short introductory paragraphs.
- Clear separation between **About**, **What INFRAOS Does**, **How It Works**, **For Citizens**, **For Agencies**, **Contact/Help**, and **Staff/Officer Sign In** (only when real).
- One hero photo and at most a small number of supporting images when licensed and relevant.
- Simple section layout, ample whitespace, restrained cards/dividers/iconography.
- Little or no animation. Standard hover/focus transitions only, honoring `prefers-reduced-motion`.
- Fully localized English `en`, Sinhala `si`, Tamil `ta` with correct fonts, text wrapping, metadata, footer, image alt/captions and demo disclosure.
- Real, honest project status and public data claims. Any fixtures explicitly marked synthetic.

## 2.2 What not to build

No excessively large text gradients, fake phone mockups, dashboards pasted inside hero, floating KPI strips, animated risk charts, giant carousels, auto-rotating feature tiles, map demos before Step 30, or made-up 'X million LKR saved' statistics.

These rules apply **only to the public landing**. Preserve the approved polished enterprise dashboards and operational screens elsewhere.

## 2.3 Government design references to use as *patterns*, not intellectual property

Research brief references: Sri Lanka Government Portal, RDA, NWSDB, CEB, Immigration, Ministry of Health, ICTA, GOV.UK, GOV.UK Design System, USWDS and Singapore gov.sg. Use simple navigation, government-information hierarchy, service/task orientation, language selection and relevant documentary photography. Do not import another design system or copy official brands/assets.

---

# 3. Mandatory common pre-review, regardless of step

Review in the actual repo (paths are suggestions; discover correct ones):

```text
README.md, package.json, lockfile, workspace scripts
Prompts/INFRAOS_Development_Prompts_Steps_25_to_26.md
Prompts/INFRAOS_Cursor_Execution_Prompts_Steps_25_to_26.md
Prompts/INFRAOS_Development_Prompts_Steps_27_to_29.md
Prompts/INFRAOS_Public_Landing_Government_Design_Research_and_Cursor_Directive.md
or docs/design/INFRAOS_Public_Landing_Government_Design_Research_and_Cursor_Directive.md
current 190-step roadmap / docs/roadmap where available
apps/web/src/app layout and route groups
actual public root or locale routes (/en /si /ta if selected)
public header/footer/hero/problem/solution components
locale dictionaries, content schemas, fonts, metadata and language switch
reusable design-system components, tokens and accessibility checks
approved image manifest and assets
link destinations and current route manifest
existing unit/RTL/browser accessibility testing infrastructure
Git branch, commits, remotes, PR/checkpoint notes and working tree
```

**Do not assume those files or locale routes exist.** Detect the current conventions. If the cited brief is not present in repo, stop and ask for it unless the necessary requirements are supplied in the prompt with explicit approval to use those. Never claim to have read a missing file.

Suggested **read-only** Git inspection:

```bash
git status --short
git branch --show-current
git remote -v
git log -5 --oneline
git branch -a
```

Confirm whether `feature/public-landing-core` is local/remote, still open, rebased, merged or deleted. If the shared branch is open, continue on it. If merged/closed, don't blindly recreate branch or rewrite history; report the proper scoped follow-up branch/PR strategy for approval. If user has uncommitted or untracked work, leave it intact and reconcile ownership before checkout.

**Required pre-review report per step:**

```text
STEP XX PRE-IMPLEMENTATION REVIEW
Actual branch / HEAD / comparison base:
Dirty/staged/untracked items and owners:
Step 25–26 status + proof (files, tests, approved checkpoint):
Existing public landing root/layout/anchors:
Current locale strategy and dictionary coverage:
Verified image assets, rights/manifest:
Internal app shell isolation:
Existing components/dependencies/tests:
Existing public links with implemented destinations:
Baseline checks run/results:
Files to modify, constraints and integration risk:
Exact step scope / exclusions:
Decision: PROCEED / BLOCKED / NEED APPROVAL:
```

---

# 4. GIT STRATEGY — ONE BRANCH, THREE STEP REVIEWS

```text
development
    └── feature/public-landing-core
         ├── Steps 25–26: completed/reviewed earlier (verify)
         ├── Step 27: feature/service overview → separate test/review/checkpoint
         ├── Step 28: lifecycle explanation → separate test/review/checkpoint
         └── Step 29: audience/benefits → separate test/review/checkpoint
                  ↓
             final Step 25–29 integration review
                  ↓
             PR to development (only after permission)
                  ↓
             tested development
                  ↓
             main (only separate stable release approval)
```

- **Never create `feature/step-27-*`, `feature/step-28-*`, `feature/step-29-*` in the normal open-group workflow.**
- Do not merge this shared branch mid-group just because one step is finished unless user explicitly approves a smaller PR.
- After each step: review exact Git diff, propose an optional checkpoint commit; **do not execute commit/push without authorization**.
- If checkpoint commits are approved, choose focused conventional messages:
  - `feat(landing): add multilingual public feature overview`
  - `feat(landing): explain infrastructure coordination lifecycle`
  - `feat(landing): add public audience and benefits guidance`
- Never `git add .` blindly where unrelated prompt/docs/teammate files exist.
- No `git reset --hard`, force checkout, branch deletion or forced push.

---

# 5. STEP 27 — Accessible Public Features / Service Overview

**Objective:** Give a plain-language, credible description of what INFRAOS helps with, separating currently implemented functions from planned platform capabilities. Feature/service content must be understandable by citizens without deep software knowledge while also informative for officers.

**Branch:** Continue `feature/public-landing-core`.  
**Prerequisite:** Step 26 + public-style correction checkpoint approved and inspected.  
**Stop:** after Step 27 test/review/fix and explicit approval to proceed to Step 28.

## 5.1 Step 27 pre-review specifics

Inspect existing landing sections, status of functionality claims, public route/component hierarchy, responsive patterns, translation keys, CTA anchors and any feature tiles already present. Decide whether to **extend** existing explanation or add a compact new feature section. Avoid duplicate headline/benefit blocks created in Step 26.

Inventory which of these capabilities is currently truly implemented vs roadmap-only:

```text
ProjectTrace (project creation/status/progress)          actual / partial / planned
RoadSync (deterministic candidate/conflict logic)         actual / partial / planned
InfraMap (interactive GIS)                               actual / partial / planned
Inspections & Asset Maintenance                          actual / partial / planned
Citizen Issues & Public Projects                         actual / partial / planned
AI Risk / DocTrace / Finance                             actual / partial / planned
```

Do not add marketing links to endpoints/sections that don't exist.

## 5.2 Recommended content structure

A heading such as **"What INFRAOS helps coordinate"** / **"Platform functions"** (editorial wording may be adjusted), then a **brief 3–5-item service summary** grouped around user tasks, not an exhaustive 13-feature product grid. Suggested groups:

1. **Shared Project Oversight (ProjectTrace):** public-friendly summary of project tracking, milestones and responsibility; do not show private records.
2. **Infrastructure Work Coordination (RoadSync):** potential work-location and schedule overlap; explain deterministic rules, not AI magic.
3. **Geographic Information (InfraMap):** proposed spatial view, clearly labeled as preview/planned unless built.
4. **Verification and Long-Term Care:** inspections, completion and maintenance as roadmap capabilities if not implemented.
5. **Public Information and Feedback:** citizen/public perspective, only a real action when public portal exists.

A three-item presentation may be better if content would otherwise become crowded. Preserve canonical module names where used; translate descriptions, not internal identifiers in code.

## 5.3 Implementation details

- Use one accessible section (`<section id="features" aria-labelledby="...">`) or the existing equivalent ID if established; do not break existing `#features`, `#solution` or navigation anchors.
- Prefer a calm stacked section or 2-column responsive layout with small neutral panels/separators. 3–5 items maximum initially; don't make a giant colorful tile gallery.
- Small icons allowed **only where they convey meaning**; decorative icons hidden from assistive tech; headings and text must be sufficient without them.
- One optional support photo is allowed only if there is a verified suitable local licensed asset. It is not required to complete the code foundation.
- Keep headings scannable, roughly one short phrase; descriptions ideally 1–3 sentences each, not marketing buzzwords.
- Add no counters, ROI percentages, fake map screenshot, client-side animation state machine or external API calls.
- Text links only when destinations actually exist; otherwise use neutral informational copy such as "Planned as part of the demonstration" or do not include CTA.
- Reuse existing Step 19 Card/Link and typography tokens where appropriate; don't fork another design system.
- Build a typed/localized content map if consistent with existing i18n architecture. Do not create three independent page copies that drift.

## 5.4 Status-of-function disclosure

If the site presents an unbuilt capability, it should be described as a **planned feature of the demonstration**, not "currently available". If some modules are already implemented in an isolated project branch, do not claim they are live on this public deployment. "The platform is designed to..." is safe only if it accurately describes plans. Include disclosure near or after the feature overview where helpful; keep the overall university demo notice visible in footer/about section from Steps 25–26.

## 5.5 English source copy suggestions (not preapproved translations)

```text
Section title: Coordinating the information behind infrastructure work
Introduction: INFRAOS is a university-developed demonstration of how projects,
planned utility work and agency responsibilities can be viewed together.

Project oversight: Keep key project details and milestones organized for review.
Work coordination: Highlight locations and planned dates where road and utility work may conflict.
Location awareness: Explore how geographic information can support project planning.
Inspection & maintenance: Demonstrate the relationship between completed work, verification and long-term upkeep.
Public information: Explain projects and issues in a way residents can understand.
```

Edit this copy for truth relative to implementation. No real-world savings or government impact claims.

## 5.6 Step 27 technical & accessibility checks

- All implemented locales show **actual localized text**, not remaining English placeholders silently presented as final.
- `aria-labelledby` resolves to a real unique heading ID; heading order stays logical after the hero/problem/solution.
- Internal links have implemented targets; navigation accessible and locale-preserving.
- Mobile reading order sensible and no card overflow at 320/375px.
- Semantic status note is readable and not conveyed by muted color alone.
- No unnecessary new dependencies or hydration/client-state code.
- No unexpected change to internal dashboard CSS or API usage.

## 5.7 Step 27 acceptance checklist

- [ ] Completed Step 26 and latest public design directive verified, with approval evidence.
- [ ] Shared branch safe and reused; teammate/untracked changes preserved.
- [ ] Feature/service presentation concise, accurate, accessible and task-oriented.
- [ ] ProjectTrace/RoadSync explained faithfully; module status not overstated.
- [ ] Three locale versions populated and reviewed or explicitly marked translation-blocked.
- [ ] No fake CTA/live data/government partnership claims.
- [ ] Images licensed if included; no mandatory unlicensed placeholder.
- [ ] Responsive/focus/heading/contrast tested when tools available.
- [ ] Focused tests plus lint/type-check/build performed with actual outcomes.
- [ ] Post-review completed; bugs fixed and retested.
- [ ] Diff, docs and optional approved checkpoint ready.
- [ ] Step 28 **not started**.

## 5.8 Step 27 mandatory post-review

```text
STEP 27 POST-REVIEW
Feature inventory (implemented vs planned):
UI section/component path(s):
English/Sinhala/Tamil content and reviewer status:
Accuracy of ProjectTrace and RoadSync descriptions:
Any unsupported claims/links removed:
Semantics, keyboard, responsive, photo license:
Tests executed, failures, fixes and retests:
Differences from Step 26 baseline:
Changed/untracked files and diff inspection:
Approval required for Step 28:
Step 27 result: COMPLETE / PARTIAL / BLOCKED
```

---

# 6. STEP 28 — Infrastructure Lifecycle / How Coordination Works

**Objective:** Explain the lifecycle in a short, human-readable sequence so a citizen or officer understands what happens from planning to maintenance. No elaborate animated timeline or implied automated legal approvals.

**Branch:** Same `feature/public-landing-core`.  
**Prerequisite:** Step 27 written review + user/team approval.  
**Stop:** after Step 28 independent review and explicit approval to begin Step 29.

## 6.1 Step 28 pre-review specifics

Inspect Step 27's finished feature section, Step 26 solution overview, original lifecycle statement, existing `#how-it-works` / `#workflow` anchors and navigation. Ensure this section **adds clarity** rather than duplicating Step 26's introduction.

The **canonical INFRAOS lifecycle remains:**

```text
Plan → Coordinate → Approve → Build → Verify → Monitor → Complete → Maintain
```

Do not swap stage order or remove verification. For public readability, you may visually group these eight stages into **four paired short blocks** as long as all eight named stages remain clearly discoverable:

```text
Plan + Coordinate  |  Approve + Build  |  Verify + Monitor  |  Complete + Maintain
```

This grouping does **not** change domain state machines or the actual backend lifecycle.

## 6.2 Presentation architecture

- A simple **ordered list**, numbered steps or compact line diagram is preferable. On narrow mobile, display vertically without horizontal overflow.
- Each stage has a short role-neutral explanation; use accessible text labels, not color-only nodes or icons.
- Optional decorative thin connecting line is okay, but do not require GSAP or a complex SVG interaction to understand the flow.
- A short contextual example makes the story concrete: planned road resurfacing and water-pipeline work on the same road segment, with overlapping dates; coordinated rescheduling may prevent repeated work. **Explicitly synthetic illustrative scenario**, not an actual government project.
- Clarify approvals are made by authorized human officials according to policies, never automatically by AI.
- The difference between **detect candidate conflicts** and **resolve after human coordination** must be clear. GIS/time overlap alone does not mean an actual emergency or automatic cancellation.
- Use clear wording for inspection and maintenance; no invented real inspection records.
- No fake interactive progress tracker representing an actual project.

## 6.3 Example stage copy (English draft only)

| Stage | Clear public explanation |
|---|---|
| **Plan** | Agencies propose the work, location and intended schedule. |
| **Coordinate** | Potential overlaps in work areas and timing are identified for discussion. |
| **Approve** | Authorized reviewers consider the required decisions and approvals. |
| **Build** | Approved work is carried out and progress can be recorded. |
| **Verify** | Inspections and evidence help confirm work quality and completion. |
| **Monitor** | Schedules, progress and possible risks are followed during delivery. |
| **Complete** | Completion and relevant project records can be finalized. |
| **Maintain** | Completed infrastructure can be tracked for future upkeep and issues. |

This is presentation copy, not the implemented approval/workflow contract. Align claims with actual roadmap implementation maturity.

## 6.4 Localization specifics

- Keep the eight canonical identifiers stable in code (e.g., `plan`, `coordinate`, `approve`, `build`, `verify`, `monitor`, `complete`, `maintain`) while storing real translated display labels and descriptions in locale dictionaries.
- Ensure Sinhala/Tamil font fallback accommodates glyph shaping and stacked diacritics, especially with small timeline badges.
- Avoid translating abbreviations in code or breaking anchor names; translation affects display content, not stable route IDs.
- Don't force a direction change to RTL: **Sinhala and Tamil are left-to-right scripts**. Use correct Unicode, not romanized placeholder text.
- A native-fluent reviewer should validate terminology for government planning, approvals and maintenance. Machine-produced text may be draft, not a verified official translation.

## 6.5 Step 28 interaction and accessibility

- A semantic `<ol>` or comparable accessible structure with stage count available to screen readers.
- If using paired groups visually, keep logical DOM stage order exactly as eight stages.
- No animation required; CSS transitions, if any, disabled/reduced under `prefers-reduced-motion`.
- Focus indicator for actual links/actions only; don't make noninteractive stages focusable.
- At 320px, 200% zoom and text enlargement, stages remain legible without clipped lines.
- Section heading and supporting copy accessible in each locale, and photo (if used) has documented permission.
- No charting library, dependency-heavy timeline, new GSAP or full dashboard workflow component.

## 6.6 Step 28 testing scenarios

1. Validate **exactly eight** stages in canonical order, regardless of locale.
2. Every stage has a translated label/description key in `en`, `si`, `ta`.
3. Mobile stage presentation reads in correct order and has no horizontal page scroll.
4. Anchor from header/hero lands on correct section with focus/scroll offset handled.
5. All examples explicitly identify synthetic scenario if used.
6. The page does not claim AI approves projects or RoadSync automatically blocks work.
7. Step 27 features and Step 25–26 anchors remain unaffected.

## 6.7 Step 28 acceptance checklist

- [ ] Step 27 review approved, same shared group branch reused.
- [ ] Accurate eight-stage canonical lifecycle represented simply and legibly.
- [ ] Accessible reading order, list semantics and good narrow-width wrapping.
- [ ] English/Sinhala/Tamil public explanations provided and checked/review-labeled.
- [ ] Illustrative example clearly synthetic and does not imply real government records.
- [ ] Avoids heavy animation and premature Step 30 map preview.
- [ ] No changes to domain status/approval logic.
- [ ] Tests, lint, types, build and available visual/a11y checks performed.
- [ ] Review/fix/re-test completed, Git diff checked and docs updated.
- [ ] Step 29 not started without approval.

## 6.8 Step 28 mandatory post-review

```text
STEP 28 POST-REVIEW
Step 27 approval evidence:
Lifecycle order and source-of-truth:
How eight stages are represented (DOM semantics):
Sample scenario label correctness:
Three-locale translation status:
Keyboard/reflow/reduced-motion findings:
Tests/build and regressions:
Actual files changed, docs and git status:
Defects fixed and retests:
Step 28 result: COMPLETE / PARTIAL / BLOCKED
Permission to proceed to Step 29: granted / waiting
```

---

# 7. STEP 29 — Public Audiences, Stakeholder Access & Credible Benefits

**Objective:** Help different visitors see the **relevant next safe action** and the potential benefits of coordination, without placing authentication or private workflow inside the public site.

**Branch:** same `feature/public-landing-core`.  
**Prerequisite:** Step 28 reviewed and explicitly approved.  
**Stop:** Step 29 completed, then full group 25–29 regression and PR preparation — NOT automatic merge.

## 7.1 Step 29 pre-review

Inspect actual route manifest, later Citizen/auth phases, implemented public pages, Step 25 CTAs and nav targets, existing locale dictionaries, footer/contact instructions and Step 26–28 content. Identify actual **working public destinations**, whether staff sign-in exists, and whether any government agency partnership/contact has verified authorization.

Avoid duplicating Step 27's feature list. Step 29 is about **who benefits and how visitors navigate**, not another 13-module grid.

## 7.2 Audience groups and truthful actions

| Audience | Value proposition | Safe next action now | Prohibited false promise |
|---|---|---|---|
| **Residents / citizens / local communities** | More understandable planning and future public information | Read How It Works and public-service information; real project/issues routes only once built | Live complaint submission or local-project updates when absent |
| **Government / utility agency officers** | Shared view of plans and proposed works, better coordination | Learn coordination approach; sign in **only if genuine route/auth flow exists** | Access road/water schedules from public landing |
| **Government administrators / agency managers** | Better oversight of approvals, responsibilities and project states | Review platform purpose; verified staff portal only | Public administrative controls, fake privileged portal |
| **Inspectors / contractors / technical staff** | Clearer inspection, delivery and record workflows | Read lifecycle; genuine staff access only when ready | Upload inspection evidence without auth/backing API |
| **General visitors / university evaluators** | Understand project objectives and demonstrated innovation | About / How It Works / synthetic demo explanation | Official ministry endorsement, invented national savings |

Cards are optional: prefer a simple audience list or small 2-column group of 3–4 entries, merging related officer/admin/staff groups if too crowded. Avoid a complex role selector as homepage gate.

## 7.3 Benefits content — cautious, nonquantified

Possible **intended benefits** (not proven outcomes):

- **Better coordination:** agencies can identify plans that may overlap in geography/time earlier.
- **Clearer accountability:** milestones, approvals and responsibilities can be documented.
- **Less avoidable disruption:** early coordination *may help* reduce repeated work and inconvenience; no unsupported claims that it already has.
- **More understandable public information:** a future safe public view can help residents follow infrastructure information.
- **More consistent maintenance planning:** project and asset records may support longer-term upkeep.

Use cautious terms such as "designed to support", "can help", "aims to" as appropriate. Avoid all unverified outcomes like "70% fewer road closures", "Rs. 1 billion saved", "10,000 real projects coordinated". A visually prominent number must be backed by approved documented evidence **and disclose the source**; Step 29 does not need metrics at all.

## 7.4 Honest CTA and route behavior

- Real links only to implemented public routes, anchor sections or an actually functioning auth entry. Use `<Link>` and preserve locale across routes.
- A **nonexistent sign-in route must not be a clickable `href="#"` or a link to a hidden admin route**; instead use explanatory wording (e.g., "Staff access is part of the demonstration roadmap") until authentic flow exists.
- Similarly, citizen issue reporting, public project explorer and public GIS are future phases. No fake buttons or security-bypassing demo shortcut.
- If some public route truly exists, verify its authentication/public projection and actual route before exposing it.
- Do not treat a link guard or disabled control as permission enforcement.

## 7.5 Institutional trust / photography / footer

- Preserve existing visible university-demo disclosure, safe verified contact details and privacy notes.
- One optional contextual approved photograph (e.g. authentic Sri Lankan road or utility maintenance) only with manifest and rights; do not replicate the hero in every audience card.
- Don't use real agency seals, government officer headshots, or institution logos without rights; do not imply a particular department sponsors the project.
- No fake press/news/testimonials, contractor ratings, ministry announcements or real staff quotes.
- Do not build public notices section without implemented public-safe content (later landing step / appropriate module).

## 7.6 Step 29 technical & localization requirements

- Single data structure for audience group keys; translations of audience names, benefits and action text in all three locales.
- Test fallback behavior; don't silently mark English fallback as finished Sinhala/Tamil translations.
- Screen-reader users hear headings and link names indicating destinations.
- Language switch preserves section anchor and audience context where existing system supports it.
- No user-type state or cookies required for selecting audience; content visible to all.
- Keep the section readable in mobile LTR layouts, 200–400% zoom, longer localized strings.
- Reuse existing fonts, semantic tokens and components; no new dependency without justification.

## 7.7 Step 29 acceptance checklist

- [ ] Step 28 reviewed/approved; existing shared branch reused safely.
- [ ] Intended audiences represented accurately without role-gating public reading.
- [ ] Benefits honestly qualified, no made-up metrics or official endorsement.
- [ ] Every CTA has a real target, or isn't presented as a working link.
- [ ] No protected agency/project data or route authorization bypass.
- [ ] Trilingual audience descriptions and benefit text provided and language reviewed/labeled.
- [ ] Privacy, contact and university-demo notice remain accurate.
- [ ] Responsive, semantic, keyboard, focus and contrast checks performed.
- [ ] Scope limited to landing; no backend/auth/citizen portals created.
- [ ] Tests/build/regression pass or specific blockers documented.
- [ ] Post-review, bug fixes, re-tests, documentation and Git handoff completed.

## 7.8 Step 29 mandatory post-review

```text
STEP 29 POST-REVIEW
Step 28 approval proof:
Audience content groups and real action destinations:
Benefits/claims and evidence review:
Trilingual keys + native review status:
Route correctness and authentication boundaries:
Photo manifest and demo disclosure:
Keyboard/responsive/zoom/contrast verification:
Files/commits/diff/security scan:
Tests, defects fixed, retests and remaining blockers:
Step 29 result: COMPLETE / PARTIAL / BLOCKED
Steps 25–29 GROUP PR readiness: YES / NO / CONDITIONAL
```

---

# 8. Complete trilingual public-content architecture (applies to all 3 steps)

**Languages:** English (`en`), Sinhala (`si`), Tamil (`ta`) — **equal product requirement**.

## 8.1 Keep one canonical page structure

Follow the actual existing routing solution rather than installing a second framework. `/en`, `/si`, `/ta` are acceptable when already implemented; use current public paths and preserve the app/public layout separation. A dictionary model could conceptually be:

```ts
export type LandingLocale = 'en' | 'si' | 'ta';

export const publicContentKeys = {
  features: ['title', 'intro', 'projectTrace', 'roadSync', 'infraMap', 'publicInfo'],
  lifecycle: ['title', 'intro', 'plan', 'coordinate', 'approve', 'build', 'verify', 'monitor', 'complete', 'maintain'],
  audiences: ['title', 'citizens', 'officers', 'administrators', 'staff', 'benefits'],
} as const;
```

This is **illustrative**. Respect actual translation conventions; no new source of truth if dictionary/translation types already exist. Store translation strings in content data, not server DTOs. Do not independently fork full pages per locale. Avoid dangerous `dangerouslySetInnerHTML` or string-to-HTML renderers for translations.

## 8.2 Language completeness

For each of the three steps, the content matrix must include:

```text
Locale | section title | intro | feature/step/audience labels | descriptions
       | CTA/link text | accessible names | alt/captions where used
       | metadata/description when changed | status/disclaimer if applicable
       | native-speaker review status
```

All new visible text and screen-reader labels should exist in `en/si/ta`. If translations are drafted by an AI or bilingual tool, mark them as **unverified translations pending fluent speaker review** and don't claim certified accuracy. A code test for missing keys ≠ language correctness.

## 8.3 HTML and route correctness

- Correct `lang` per document/locale (or semantic subsections when embedded multilingual text); don't write `dir="rtl"` for Sinhala/Tamil.
- Visible and keyboard-accessible language switch; preserve present page/anchor wherever feasible.
- Avoid locale loops or server/client hydration mismatch from determining language incorrectly.
- Keep page title, description, OG metadata and `hreflang`/canonical consistent with the site's actual public URL strategy.
- No geo/IP-determined forced language.
- Test text expansion and native shaping: Sinhala, Tamil, 320px mobile, 200–400% zoom.

## 8.4 Copy quality gate

Maintain an editorial review matrix recording **English source approved? Sinhala reviewer approved? Tamil reviewer approved?**. If reviewers have not signed off, mark copy ready for review, not publicly verified or guaranteed. Do not insert fabricated official translations just to meet a checkbox.

---

# 9. Photography: real, licensed, relevant — but no requirement to scrape images

Step 25/26 had primary imagery. Steps 27–29 should not flood the page with more images. Prefer **at most two or three supporting images across the entire public landing**, and add none if they do not add meaning.

Required image asset manifest (when adding/changing photos):

```text
file / original source URL / owner / photographer
license or written permission / attribution requirement
obtained date / reuse/crop permission / location and subject confidence
alt text en / si / ta / exact page section
image dimensions, Next Image sizes, file performance checks
```

Never assume images from `.gov.lk` or internet search can be copied. If approved imagery not available, preserve legitimate existing photo or use no new photo and log sourcing blocker. Do not generate photorealistic "actual Sri Lankan road crew" images and imply they document real construction; do not use official badges, seals, fake press photos or identifying images without permission. Use stable local assets/approved storage and Next.js `<Image>` when appropriate, width/height, responsive sizes, lazy loading below fold and descriptive alt; decorative images use `alt=""`.

---

# 10. Security, privacy, analytics and backend integration

- These steps are **frontend-only**, using static reviewed public content. **No new `/api/v1` endpoint or MongoDB connection** is needed.
- Do not fetch protected ProjectTrace/RoadSync/finance/inspection records from a public Server Component or Client Component just to populate cards.
- No PII, citizen issue data, JWT, role/agency assignment, upload preview, private document or access tokens in page HTML/metadata/props/asset paths.
- Links must not act as access control; future auth enforces permissions on backend.
- No analytics pixels/third-party tracking introduced without approved policy/consent, no license-unknown external image embeds.
- Avoid unsafe HTML interpolation for translations and user input; plain strings and React text.
- Check that the canonical README/demo disclaimer clearly identifies synthetic data and lack of official operations.
- Do not create contact forms unless there is a real reviewed submission endpoint/policy and roadmap authorization.

---

# 11. Responsive, accessible and performance verification

**Baseline:** WCAG 2.2 AA oriented; manual review remains necessary. Existing Step 24 accessibility work is a dependency, not an excuse to declare all new sections accessible by default.

| Test area | Concrete verification |
|---|---|
| Document semantics | Main landmark, ordered H1/H2/H3, unique section IDs, logical DOM order |
| Keyboard | Tab/Shift-Tab across actual links, visible focus, skip link, language switch, mobile navigation |
| Language | `lang` attribute, readable font fallback for Sinhala/Tamil and associated descriptions |
| WCAG contrast | Normal text target 4.5:1, applicable UI indicator target 3:1, tested on real foreground/background pair |
| Reflow | 320, 375, 768, 1024, 1280 CSS px; 200%/400% zoom and long Tamil/Sinhala strings |
| Motion | `prefers-reduced-motion`, no autoplay, no parallax or required animation |
| Photos | actual permission, alt or decorative empty alt, caption accuracy and responsive loading |
| Links | actual route or existing anchor, not `href="#"` fake action; locale-preserving navigation |
| Runtime | no hydration errors, console errors, broken image requests or server/client mismatches |
| Security | no privileged API calls, production secrets, private data or official endorsements |
| Performance | no new heavy motion library, limited photos, reasonable bundle change and images optimized |
| Regression | public Step 25–26 and internal dashboard/app shell remain unchanged |

Use axe/browser auditing if installed. Automated checks do not prove full compliance. If manual browser/assistive-tech/native-speaker review is unavailable, report `NOT RUN` and explicitly identify the blocker; **do not claim a completed multilingual accessibility verification**.

---

# 12. Exact testing strategy for Step 27–29

Reuse the actual test stack. Typical test expectations:

### 12.1 Step 27 feature overview tests

- Renders the same number/order of feature groups in all locales.
- Section is discoverable by heading and current public nav anchor if linked.
- Links exist only when real destinations are implemented.
- A planned-only module has no live-route CTA.
- Strings and translated accessible names exist in all three locale dictionaries.
- No mock API call or external image URL introduced.

### 12.2 Step 28 lifecycle tests

- Exactly eight stable lifecycle IDs in canonical order.
- Eight labels and accessible descriptions in `en`, `si`, `ta`.
- Road+water overlap example is clearly marked synthetic when used.
- Ordered/paired layout preserves DOM order and all stages at mobile/zoom.
- The section does not fire animation/timer requests.

### 12.3 Step 29 audience/benefit tests

- All audience groups exist and are readable without authentication.
- Role links point to real routes/anchors, or are not clickable if feature absent.
- Public links cannot expose internal data/API responses.
- Benefit copy contains no unsupported numbers / fabricated partner claims.
- All labels/descriptions/actions exist across locales.

### 12.4 Group-level checks

- Test old public Step 25/26 anchors/header/mobile menu and page metadata.
- Check all three localized URLs and language switching; no missing keys or English-only sections.
- Check image manifest and license records for any newly added photo.
- Inspect internal protected app CSS/layout snapshots or route smoke where possible.
- Run the repo's available commands for lint, typecheck, component tests and build; detect correct package manager and workspace names first. Example only:

```bash
# Run only scripts that actually exist, from the appropriate directory/workspace.
npm run lint
npm run type-check
npm run test
npm run build
```

Command absent → `NOT AVAILABLE`, not PASS. Browser unavailable → `NOT RUN`, not PASS. Step-related failures → fix and rerun; unrelated preexisting failures → disclose with baseline proof.

---

# 13. Suggested files — adapt to actual architecture

Do not build duplicate locale frameworks/route groups. Possible **existing** locations:

```text
apps/web/src/app/(public)/[locale]/page.tsx           # if chosen routing exists
apps/web/src/app/(public)/[locale]/layout.tsx         # existing if any
apps/web/src/components/public/feature-overview.tsx
apps/web/src/components/public/infrastructure-lifecycle.tsx
apps/web/src/components/public/audience-benefits.tsx
apps/web/src/content/public/en.* / si.* / ta.*        # if dictionary convention exists
apps/web/src/lib/i18n/*                                # existing only
apps/web/public/images/infraos/*                       # only approved assets
apps/web/src/components/public/public-section.tsx     # optional if genuine reuse

docs/design/public-landing-steps-27-to-29.md
docs/design/public-landing-content-status.md
docs/design/public-landing-localization-review.md
docs/design/public-imagery-manifest.md                 # if assets added
docs/design/public-landing-step-reviews.md
```

If current public routes use `src/app/page.tsx` or another locale mechanism, extend **that**, not arbitrary duplicate `[locale]` pages. Keep modules static/server-renderable when no interactive hooks required. Do not add `use client` to the whole homepage just for content. Prefer CSS layout over JS resize observers and heavy runtime dependencies.

---

# 14. Pre- and post-review documentation per step

Each step needs a short durable record in existing docs or equivalent:

```text
Step number/title
Approved start branch/base commit
Previous step's approval evidence
Requested vs implemented scope
Files changed (including tests and locale content)
Feature/route/functionality truthfulness
English/Sinhala/Tamil key coverage and review status
Image source/rights changes
Accessibility/responsive manual and automated checks
Lint/typecheck/test/build actual commands and results
Defects + fix/retest evidence
Unexpected changes / scope exclusions
Git diff and untracked file review
Optional suggested commit and approval status
STOP confirmation for next step
```

**No self-approval:** Agent can report "ready for review", not claim human approval. User/team decides when next step is authorized.

---

# 15. Final Steps 25–29 combined review — after Step 29 only

Review all group changes together, including earlier Step 25–26 work:

## 15.1 Experience and language coverage

- One calm government-style information homepage, not a SaaS animation demo.
- Public header and hero, Problem/Solution, Features, Lifecycle, Audiences/Benefits compose without repetitive sections or excessive scrolling.
- `en`, `si`, `ta` complete for all implemented landing content (or explicitly block release when copy requires human review).
- Accurate `html lang`, accessible language switch, locale routes, metadata, anchors and cross-page navigation.
- Representative genuine licensed photo(s) only, correct attribution and alt; no fake government seal.
- Honest university-demo disclosure visible in all three languages.

## 15.2 Implementation and security

- No unimplemented route exposed as active CTA.
- No role/agency/resource-protected data in public payload or page source.
- Nothing altered in operational dashboard, ProjectTrace, RoadSync, InfraMap or protected app design unless the very limited diff was explicitly authorized.
- No new dependency just for illustrations, dashboards, counters or animations.
- Responsive and keyboard use verified in all 3 locales.
- Motion minimal and reduced-motion honored.
- No claimed official ministry deployment or fake local government quotes.

## 15.3 Test and Git readiness

- Each of Steps 27, 28, 29 has its own pre/post review record, test evidence and checkpoint approval.
- Step 25–26 behavior regression checked.
- Group lint/type-check/tests/build run with truthful command logs.
- Changed/untracked files, lockfiles and public imagery permissions reviewed.
- Suggested reviewed commit(s) are small and scoped.
- Complete group PR draft targeting **`development`**, no automatic push/merge.
- `development → main` deferred until separate stable checkpoint authorization.

**Only after human approval:** merge group branch into `development`, then run post-merge web checks and review test output. Stop and report any regression. Don't automatically implement Step 30.

---

# 16. Git diff, commit and PR procedure (operator-approved only)

Read-only checks safe in ordinary circumstances:

```bash
git status --short
git branch --show-current
git log --oneline -6
git diff --check
git diff --stat
git diff --name-only
# New untracked files are NOT included in git diff; inspect separately.
```

Prepare **proposed** commit messages as above. Do not auto stage, commit or push; never silently include unrelated user documents or the previously reported untracked prompt files. If and only if authorized, stage exact reviewed paths, inspect staged diff and create step-level commits. Final PR target `development` after 25–29 combined approval. If the branch has already been merged, follow verified current integration state and request approval before any rebranch/correction.

---

# 17. Final group handoff report template

```text
INFRAOS PHASE 4 — STEPS 27–29 FINAL HANDOFF

Current repo base & feature branch:
Step 25 previous result verified:
Step 26 previous result verified:
Public landing style-correction status:

Step 27 feature overview: COMPLETE / PARTIAL / BLOCKED
- Feature statements with implemented/planned classification:
- Locale content and reviewed status:
- Component(s) / files changed:
- Tests, review, bug fixes:
- Checkpoint approval:

Step 28 lifecycle: COMPLETE / PARTIAL / BLOCKED
- Eight stages/order:
- Mobile/semantic/translated presentation:
- Scenario/synthetic disclosure:
- Tests, review, bug fixes:
- Checkpoint approval:

Step 29 audiences/benefits: COMPLETE / PARTIAL / BLOCKED
- Audiences and service paths:
- Truthfulness of links and benefits:
- Locale review status:
- Tests, review, bug fixes:
- Checkpoint approval:

Public UI government-style conformance:
Licensed images and alt/captions:
English/Sinhala/Tamil matrix and outstanding native review:
WCAG 2.2 AA-oriented checks / 320–1280 viewports / zoom:
Actual lint, typecheck, tests and build results:
No dashboard/back-end/security regressions:
All changed files incl. untracked and lockfile review:
Remaining issues and ownership:

Group PR to development: READY / NOT READY / NEED APPROVAL
Suggested grouped/step commit messages:
Post-merge regression steps:
main merge: NOT AUTHORIZED / NOT PERFORMED
Next step: Step 30, separate group/approval required

STOP.
```

---

# 18. Definition of done and explicit stop rules

**Step 27 done:** truthful, concise, translated feature/service overview, responsive/a11y and tests reviewed; no Step 28 implementation.

**Step 28 done:** faithful 8-stage accessible lifecycle explanation, trilingual review state and test evidence; no Step 29 implementation.

**Step 29 done:** audience-oriented credible benefits and safe routes, translated/tested, reviewed, followed by group regression and PR preparation; no Step 30 implementation.

**Group done:** Approved Step 25–29 public landing implementation under **one coherent branch**, safe group PR into `development`, no automatic action on `main`. Actual merge and native translation approval are human/team decisions. When a required gate has not passed, stop and report rather than continue.
