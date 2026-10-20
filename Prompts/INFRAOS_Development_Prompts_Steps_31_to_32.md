# INFRAOS — Complete Enhanced Development Prompts
## Phase 4 · Steps 31–32 — Public Trust, Security Information, FAQ & CTA → Footer and Supporting Public Pages

**Product:** INFRAOS — National Infrastructure Intelligence & Coordination Platform  
**Vision:** *The Operating System for National Infrastructure*  
**Lifecycle:** Plan → Coordinate → Approve → Build → Verify → Monitor → Complete → Maintain  
**Source:** INFRAOS 190-step roadmap and the approved Phase 4 grouping. Roadmap scope for Step 31 = public security/trust, FAQ and call-to-action sections; Step 32 = footer and relevant supporting public pages. Verify exact canonical wording against the repository's roadmap before editing.  
**Architecture:** Next.js App Router / React / TypeScript / Tailwind CSS / shadcn; Express TypeScript REST modular monolith; MongoDB Atlas / Mongoose / GeoJSON; later FastAPI, GIS and identity modules.  
**Scope:** **Public landing pages only**; never modify the internal dashboard, admin app, ProjectTrace/RoadSync operational UI, actual InfraMap, backend domain logic or secured pages.  
**Locales:** English `en`, Sinhala `si`, Tamil `ta` across all actual public routes and meaningful content.  
**Design direction:** Clean, credible Sri Lankan public-sector information portal; authentic properly licensed infrastructure photography where useful; **minimal animation** and no SaaS gimmicks.  
**Shared Git branch:** `feature/public-landing-enhancements` serves **Steps 30–34**, not one branch per step.  
**Step order:** Step 30 approved checkpoint → Step 31 implement/review/fix/test/approval → Step 32 implement/review/fix/test/approval → stop; reserve branch for Steps 33–34.  
**Integration:** after whole approved Steps 30–34 group (or separately authorized checkpoint) PR into `development`; `main` only at separately approved stable release.  
**Companion execution file:** `INFRAOS_Cursor_Execution_Prompts_Steps_31_to_32.md`.

> IMPORTANT — INFRAOS is currently a **Sri Lankan university GovTech project / demonstration** and is **not an officially operated Sri Lankan government website**, public authority, or source of authoritative public works data. Do not use unapproved seals, crests, `gov.lk` styling that implies affiliation, invented government endorsements or misleading service claims.

---

# 0. Operating contract: principal frontend + public-sector UX + localization + QA agent

The coding agent must first **read this entire file**, plus the existing repository's project, architecture, team/Git, security, accessibility, content/claims, localization and landing-page directive documentation. The agent may read source material but should not implement work until prerequisites and safe branch conditions are verified.

The intended deliverable is two focused content/UX implementations—one step at a time—integrated cleanly into the existing landing page. No redesign of internal pages. No creation of functional government services, forms, logins, approval flows or extra APIs.

**For EACH step in this shared branch:**

1. Inspect actual Git state, existing files, prior step status, dependency and content integrity.
2. Produce a written **pre-implementation review** and exact file-change/test plan.
3. Implement only that step's authorized scope; preserve existing functionality and previous step sections.
4. Unit/component/localization/route/security tests + available browser keyboard/responsive/accessibility checks.
5. Produce a written **post-implementation review** mapping every acceptance criterion to evidence.
6. Reproduce and fix in-scope defects, rerun focused and affected regression checks.
7. Inspect staged, unstaged and untracked files, lockfile changes, sensitive data and `git diff --check`.
8. Prepare **a per-step checkpoint commit suggestion** and review notes, but **do not automatically commit, push, open PR, merge or change `main`** without approval.
9. Stop for approval before the next step.

**Branch governance nuance:** No new branch is needed for Step 31 or Step 32 if `feature/public-landing-enhancements` already exists correctly. Step 31 can be followed by Step 32 on the same branch **after explicit step approval**, even though the group branch has not yet merged to `development`. Do not require a PR between these two steps. If Step 30 remains incomplete or unapproved, stop.

**Truth over polish:** Accuracy, right-to-use media, real link destinations, complete trilingual information and accessibility take priority over visual styling. Comprehensive global landing visual refinement remains primarily **Step 34**.

---

# 1. INFRAOS product, module and audience context

## 1.1 What INFRAOS is

INFRAOS is proposed as a unified system to coordinate road, water, telecom, electricity, drainage and other infrastructure work. Major platform concerns include:

| Platform capability | Public-facing interpretation (verify implementation before claiming availability) |
|---|---|
| ProjectTrace | Proposed project oversight, milestones, accountable progress tracking |
| RoadSync | Deterministic geographic + date overlap detection and agency coordination |
| InfraMap | Planned unified map view of works, locations and infrastructure assets |
| Finance/contractors | Future accountability features, not automatically public transactions |
| Inspections/assets | Proposed verification, completion, maintenance continuity |
| Citizen Portal | Future/public-safe reporting only when implemented and authorized |
| AI/DocTrace | Future supporting intelligence; no autonomous approval and no invented results |
| Identity/RBAC/audit | Protected future/current app concerns; not public landing features |

The primary academic demo story: planned road resurfacing and water pipeline work overlap in space and schedule → RoadSync detects candidate conflict deterministically → inter-agency coordination resolves timing → project progress and inspection → asset/maintenance. **Do not imply a live operational conflict detection service is available from the landing page** unless real, approved implementation and endpoint visibility are verified.

## 1.2 All intended visitors are welcome

The public website must be understandable to:
- residents/citizens;
- field officers, inspectors and project staff;
- agency managers and coordinators;
- authorized administrators;
- universities/evaluators/other observers.

The page is **public and unauthenticated** by default. It may direct authorized staff to a **real, existing** login route when one actually exists; it must not display protected agency/project records. Do not fake an application portal or government staff workflow to create a CTA.

## 1.3 Approved colors and visual tone

Exact brand identity colors:

| Use | Value | Public-site policy |
|---|---|---|
| Orange | `#FF5B00` | Identifiable primary accent, restraint for buttons/links |
| Yellow | `#FEB600` | Pending/warning only with sufficient foreground contrast |
| Maroon | `#8C1F28` | Critical/severe warnings, not blanket 'government seal' branding |
| Green | `#279541` | Success/completion, never unsupported 'certified secure' claims |
| Canvas | `#F8FAFC` | Neutral |
| Surface | `#FFFFFF` | Main content surface |
| Primary text | `#111827` | Strong readability |
| Secondary text | `#475569` | Accessible supporting text |
| Muted text | `#64748B` | Metadata where contrast meets criteria |
| Border | `#E2E8F0` | Simple separation |

Use Steps 17–18 semantic tokens; don't paste hexes into individual components. Raw yellow/orange/green alone may not provide acceptable normal-text contrast. Use previously established tested derived variants.

**Public landing design restrictions:** no glassmorphism, massive gradient panels, busy particle backgrounds, scrolling hero ticker, invented charts, auto-playing videos, modal signup funnels or animated government claims. Preserve current system-related pages untouched.

---

# 2. Existing architecture and repository reconnaissance

## 2.1 Read the sources the repository actually contains

Verify paths instead of assuming:

```text
README.md, CONTRIBUTING.md, AGENTS.md / cursor rules (if any)
package.json, lockfile, apps/web/package.json, apps/api/package.json
docs/architecture/, docs/security/, docs/design/, docs/team/, docs/reviews/
docs/marketing/content-claims.md (if present)
Prompts/INFRAOS_Public_Landing_Government_Design_Research_and_Cursor_Directive.md
Prompts/INFRAOS_Development_Prompts_Steps_25_to_26.md
Prompts/INFRAOS_Development_Prompts_Steps_27_to_29.md
Prompts/INFRAOS_Development_Prompt_Step_30.md
Prompts/INFRAOS_Development_Prompts_Steps_31_to_32.md
apps/web/src/app/ and public route segments
apps/web/src/components/landing/
apps/web/src/lib/landing/messages.ts, navigation.ts (where present)
apps/web/public/ and any image-license/attribution manifest
apps/web/src/app/globals.css and approved design token source
```

Also verify Steps 16–24 implementation in actual code; don't infer that a generated Markdown prompt means a feature is implemented. Avoid importing private Step 16 DTOs into static marketing pages just to show fictional data.

Check route architecture empirically: prior reports mention `/`, `/si`, `/ta`, not necessarily `/en`. Use real current behavior; do not silently create conflicting routes or alter existing canonical/hreflang paths.

## 2.2 Mandatory Git / build baseline

Safe read-only commands first:

```bash
git status --short
git branch --show-current
git log -1 --oneline
git remote -v
git branch -a
git diff --check
```

Enumerate existing uncommitted/staged/untracked files (especially prompts, photos and other teammates' work) **without deleting or adding them**. Inspect actual package scripts; run a baseline where useful. If current branch is wrong or Step 30 was never approved, stop and ask permission rather than force switching, rebasing, stashing or resetting.

Expected branch: `feature/public-landing-enhancements`, already containing Step 30. If this is a new working tree, only establish/recover the branch with explicit acknowledgement and safe verification of the latest approved `development` baseline. **Do not create a new Step 31 branch.**

## 2.3 Step 30 must be verified first

Evidence required before Step 31:

- Step 29 group was reviewed/approved and integrated into `development` or a different explicitly approved integration state.
- Step 30's product/GIS preview exists, is clearly synthetic (no real government project simulation presented as live), has en/si/ta copy and tests, and its **review gate has been approved**.
- Preview is not an unauthorized live MapLibre service or public API.
- Current public landing navigation/sections and disclaimer exist.
- New Step 31 sections won't duplicate Step 25–30 material.

If missing, report precise blocker. Existing approved Step 30 work can live in the current **open shared group branch**; it need not be merged separately.

---

# 3. Shared information architecture and content model

## 3.1 Recommended public landing order (adapt to actual implemented sections)

```text
Public identity + trilingual language switcher
Public hero and authentic licensed infrastructure photo (if already approved)
Problem → Solution
Feature/service overview
Infrastructure lifecycle
Audiences / stakeholder benefits
Truthfully labeled illustrative product/GIS preview
STEP 31: Credibility/security approach + FAQ + one restrained next-action block
STEP 32: Footer + relevant truthful public supporting pages
```

This is an intended information order, **not an instruction to refactor all earlier sections**. Avoid duplicate FAQ/CTA if currently present; strengthen rather than rewrite.

## 3.2 Link and content truth registry

Before adding links, build a simple audit table:

```text
Label | Locale | Destination (actual existing pathname/anchor)
      | Public/protected | Implemented? | Claims implied | Proposed action
```

- **Live link**: destination exists and is appropriate for public access.
- **Planned link**: do not make it clickable; if useful, label as upcoming clearly.
- **Protected link**: display as 'Staff Sign In' only when a real, safe sign-in route exists.
- **Anchor link**: ensure target ID exists across all locale route variants and scroll offset accounts for the header.
- **Email/phone link**: use only owner-approved truthful contact details; do not invent a ministry contact or fake support mailbox.

## 3.3 Translation content structure

Reuse actual `en` / `si` / `ta` dictionary architecture, not a new i18n library:

```ts
// Shape illustration only; follow actual repository types.
type LandingInfoSection = {
  title: string;
  intro?: string;
  items: Array<{ id: string; question: string; answer: string }>;
};

type LandingTrustContent = {
  title: string;
  paragraphs: string[];
  disclaimer?: string;
};
```

Use stable **language-independent FAQ IDs**. Localization must cover full body content, link labels, titles, metadata, alt text, mobile menu/footer and headings. Provide parity tests and accurate native-speaker approval status. Never hide untranslated text behind an English-looking locale page without disclosure.

---

# 4. Step 31 — Trust, security information, FAQ and next-action section

**Step boundary:** This step adds public trust/explanation, concise FAQ and meaningful calls to action, plus related content/metadata tests. It **does not yet build all footer/supporting public pages** (Step 32).  
**Branch:** `feature/public-landing-enhancements` — **reuse current branch**.  
**Checkpoint suggested commit (reviewer-approved only):** `feat(landing): add public trust faq and next steps`.

## 4.1 Step 31 specific pre-implementation review

Generate `docs/reviews/step-31-pre-post-review.md` or update the existing review system with:

```text
STEP 31 PRE-IMPLEMENTATION REVIEW
Current branch and HEAD:
Dirty/staged/untracked teammate work:
Step 30 reviewed and approved? Evidence:
Current homepage structure/anchor IDs:
Any existing security/trust copy:
Existing FAQ, accordion, content components:
Current CTA labels and verified destinations:
Live/planned feature truth status:
English/Sinhala/Tamil dictionary key structure:
Native speaker review evidence/status:
Current photo licenses and source manifests:
Accessibility baseline for all current landing sections:
Relevant security/privacy docs actually inspected:
Affected files / components / tests:
Scope exclusions and risk register:
Baseline lint/types/tests/build results:
Decision: PROCEED / BLOCKED:
```

Avoid asserting Step 30 is done merely because a commit or file exists; inspect acceptance/review evidence.

## 4.2 Trust and security explanation — honest, measured, non-legal claims

**Purpose:** A resident or agency officer should know what INFRAOS is, what data it *may* present, what its limitations are, and how internal/public access differs.

Construct a concise institutional information block (not a certification panel) with **2–4 short plain-language points**, for example:

1. **Coordinated planning:** describes why sharing schedules and locations reduces repeated work; proposed capability vs implemented demo clearly stated.
2. **Responsible access:** public information is distinct from protected staff workflows; *planned* role/agency access is not falsely described as already audited.
3. **Traceable process:** describe intended auditability/verification accurately; do not claim real government transactions or approvals.
4. **Prototype notice:** state **university demonstration / synthetic project examples** using calm, visible wording.

**Security wording must be based on implemented evidence:**

| Avoid unsupported assertion | Safe conditional/accurate alternative |
|---|---|
| "Government-approved platform" | "University-developed infrastructure coordination demonstration" |
| "Official government records" | "Illustrative / synthetic records for demonstration" |
| "Guaranteed secure / certified" | "Designed with role-based access and privacy principles" **only when contextualized as design intent** |
| "All information encrypted/audited" | Describe only mechanisms actually implemented and verified |
| "Submit requests now" | Link only to actually functioning authorized service |
| "Track live road projects" | "Explore the proposed infrastructure coordination approach" unless live public data truly exists |
| "Available in all three languages" | State content support; separately track whether translations have been reviewed by native speakers |

Do not copy official insignia, ministry logos, partner icons or independent certifications. Never invent a security certification, public-agency partnership, deployment footprint or quantitative results.

**Design requirements:**

- A compact heading, simple text and a brief "About this demonstration" disclosure in visible flow.
- Neutral white/slate background; orange accent for meaningful brand emphasis only.
- Avoid representing a padlock icon as proof of security; use labels and explanatory copy.
- Make academic/demo status conspicuous, not tiny gray fine print.
- No "government verified" badge, security score or pseudo-official ribbon.

## 4.3 FAQ — useful answers, not marketing filler

Provide a focused list of **approximately 6–10** plain-language Q&A entries, adapted to source truth and existing content. Candidate topics:

1. What is INFRAOS?
2. Is INFRAOS an official government service?
3. Who is the platform intended for?
4. What is ProjectTrace?
5. How is RoadSync intended to identify work conflicts?
6. Can I see actual public infrastructure projects now?
7. Can residents report road or utility issues yet?
8. How are internal records and staff permissions intended to work?
9. Which languages does the public site support?
10. How can someone learn more or access the demonstration?

Use **only answers supported by the actual code and approved design docs**. If capability is planned, say "planned" rather than promising it is available.

**FAQ rendering:**

- Prefer semantic native `<details>/<summary>` if it fits existing design, or existing accessible shadcn/Radix accordion. Avoid a new dependency.
- Interactive answers must be accessible with keyboard, focus, correct expanded/collapsed semantics and suitable screen-reader output.
- Prevent hydration mismatch, nested clickable buttons, misleading chevrons, trapped focus, or collapsing content that cannot be reached via keyboard.
- A static heading list with visible Q&A is acceptable when simpler/more accessible than disclosure widgets.
- One H2 and appropriately structured questions; avoid 10 duplicate H1s.
- Stable translated IDs/keys for consistent order between locales. Do not use translated question strings as keys.
- Long Sinhala/Tamil lines must wrap on mobile and at 200% zoom.
- No FAQ schema.org structured data unless actual text is valid, consistent and the implementation is justified; never use it to imply a government authority.

## 4.4 Call to action — real destinations only

Design **one low-pressure public next-action section**. Prefer 1 prominent actionable path and an optional secondary path. Examples depend on current verified routes:

- "Learn how coordination works" → existing `#workflow`/lifecycle anchor, if present.
- "View platform capabilities" → existing `#features` anchor.
- "See illustrative preview" → existing Step 30 preview anchor.
- "Read about this project" → only if an about page exists (may be added Step 32, but **do not create broken link in Step 31**).
- "Staff Sign In" → only if authentication route is actually implemented.

**Never invent:** working registration, login, issue report, live project map, tender portal, payment, ministry contact, public API, appointment booking, or downloadable report.

Link validation policy:
- `href` must resolve in actual route/anchor graph for `/`, `/si`, `/ta` (or actual locale structure).
- Button vs link semantics must match interaction.
- Localized text and accessible names; external links labeled if opening new window; avoid opening a new window without a reason.
- Do not make "coming soon" a dead link with `href="#"`.
- Respect reduced-motion; no automatic CTA bouncing.

## 4.5 Mobile, trilingual, photo and SEO behavior

- Visual order remains readable at 320/375/768/1024/1280 widths.
- Text remains legible at 200%–400% zoom where applicable; no horizontal overflow.
- Unicode Sinhala/Tamil glyphs render with tested fallback fonts and sensible line heights.
- No fresh images required for Step 31; if adding imagery, use **verified licensed actual infrastructure photography** and preserve the license/attribution manifest. A trust block should not require decorative images.
- Preserve current metadata, title, description, canonical URL and hreflang choices. Add relevant public metadata only if this section warrants it; don't duplicate tags or assert verified translations where not approved.
- No heavy GSAP/new image carousel. Keep Step 33 for restrained motion decisions and Step 34 for full visual refinement.

## 4.6 Step 31 technical implementation boundaries

Potential components and files **only if suitable for the actual repo**:

```text
apps/web/src/components/landing/trust-information-section.tsx
apps/web/src/components/landing/landing-faq-section.tsx
apps/web/src/components/landing/landing-next-steps-section.tsx
apps/web/src/components/landing/public-home.tsx           # integrate existing sections
apps/web/src/lib/landing/messages.ts                    # three-language copy
apps/web/src/lib/landing/navigation.ts                  # only if anchor set updated
apps/web/src/lib/landing/*.test.ts / tests               # use existing convention
docs/marketing/content-claims.md
docs/reviews/step-31-pre-post-review.md
```

Do not create redundant sections if equivalents exist. Keep mostly static server-renderable content; mark a file `"use client"` only when necessary for actual interactive FAQ. Standard accessible native `<details>` should not require extra JS.

No Express API endpoints, MongoDB models, Atlas reads, FastAPI calls, auth cookies, RBAC implementations, real contact form backend, notifications or analytics trackers. No incidental editing of app shell or dashboard styles.

## 4.7 Step 31 test matrix

| Area | Minimum verification |
|---|---|
| Component rendering | Trust/FAQ/CTA appear exactly once, correct section IDs |
| Content claims | No fake official/certified/live feature claim; intended vs available clear |
| FAQ semantics | Heading hierarchy and keyboard disclose/expand; answers associated |
| Locales | en/si/ta key parity and no missing translations; native review status accurately recorded |
| Links | Every CTA and nav anchor resolves across actual locale routes |
| Responsive | 320, 375, 768, 1024, 1280px where browser available; zoom/reflow |
| Accessibility | visible focus, no color-only meaning, screen-reader labels, FAQ state |
| Hydration/client boundary | no runtime errors or unnecessary client bundles |
| Security/privacy | no protected data, no hardcoded private contact, no fictional compliance |
| Regression | Hero/problem/solution/features/lifecycle/stakeholders/Step 30 preview intact |
| Toolchain | Relevant tests + lint, TS typecheck, build |

**Test outcomes:** `PASS`, `FAIL`, `NOT RUN`, `N/A`, with command/output or clear explanation. If browser, axe or native speaker are unavailable, label them `NOT RUN`/`PENDING REVIEW`, not certified.

## 4.8 Step 31 post-review, repairs and acceptance

Produce a filled report:

```text
STEP 31 POST-IMPLEMENTATION REVIEW
Start branch/commit and dirty work state:
Step 30 gate evidence:
Trust/security statements and documentary basis:
FAQ count/topics and source truth:
Next-action links and actual verified targets:
en / si / ta copy coverage and reviewer evidence:
Semantics, keyboard and focus:
Responsive and zoom checks:
Photography/license changes (if any):
Tests/lint/typecheck/build results:
Scope/security/privacy findings:
Broken links/misleading claims fixed:
Regressions found and repaired; rerun outcomes:
Files changed, untracked files:
Git diff --check:
Suggested checkpoint commit:
Outstanding native-language/visual review:
Approval to proceed to Step 32: YES / NO:
```

**Acceptance gate Step 31:**
- [ ] Step 30 actually reviewed; correct shared branch confirmed.
- [ ] Credibility/security section is honest, plain-language, non-official, no unsupported guarantees.
- [ ] Useful FAQ with factually safe en/si/ta answers.
- [ ] Accessible Q&A interaction or semantic static structure.
- [ ] CTA destinations are existing links/anchors; no dead fake services.
- [ ] Locale parity, font wrapping, mobile/zoom reviewed to available extent.
- [ ] Content claims and academic-demo disclosure remain prominent.
- [ ] Earlier landing sections and protected pages unaffected.
- [ ] Relevant tests, lint, type-check, build run with factual results.
- [ ] Post-review, bugfix, re-test, docs, Git diff review complete.
- [ ] Reviewer approves Step 31 checkpoint before Step 32.

**STOP AFTER STEP 31.** Keep `feature/public-landing-enhancements` open. Do not automatically start Step 32.


---

# 5. STEP 32 — Footer and supporting public information pages

**Step boundary:** Add a clear, institutionally credible, trilingual public footer and the **smallest set of truthful, accessible supporting pages required by project decisions and available content**. Do not create new citizen service workflows, privacy collection mechanisms, authenticated dashboards or production-policy claims.

**Branch:** Continue `feature/public-landing-enhancements`; no `feature/step-32-*` branch.  
**Dependency:** Step 31 must be implemented, post-reviewed, bugs fixed and **approved at its independent checkpoint**. It does **not** require Step 31 to have merged alone into `development`.  
**Suggested commit (approval only):** `feat(landing): add trilingual footer and public information pages`.

## 5.1 Mandatory Step 32 pre-review

Read existing footer, legal/help/contact metadata, route graph, code structure, static vs client component boundaries, links, language-switcher behavior and test coverage. Specifically inspect whether some supporting pages already exist in Steps 25–31 or team-owned branches.

Produce:

```text
STEP 32 PRE-IMPLEMENTATION REVIEW
Current branch / HEAD:
Step 31 independent approved review evidence:
Current footer layout / routes / URLs:
Existing public information/legal policy documents:
Which facts can actually be published truthfully:
Existing contact information verified by owner?:
Project governance and academic/demo disclosure:
Privacy behaviors actually implemented (cookies, analytics, telemetry,
  third-party fonts/images, server logs, form collection, embeds):
Public language routing (actual en/si/ta paths):
Current navigation/CTA cross-references:
Pages already implemented (with paths):
Metadata, sitemap, robots, canonical/hreflang status:
Photo credit/attribution obligations:
Existing tests, branch worktree risks, team files:
Exact page inventory and exclusions:
Implementation/testing plan:
Approval or blocked decision:
```

If there is no authoritative owner-approved contact or legal wording, do not fabricate it. Seek approval or create only the safe explanatory structure while **marking content `NEEDS_OWNER_REVIEW` in development documentation**, not presenting placeholders as completed public policies.

## 5.2 Recommended footer information architecture

Use a simple layout, not a multi-column marketing megafooter:

```text
INFRAOS — project/demo identity and one-line purpose
Quick links: About | How coordination works | FAQ | Accessibility | Privacy
Language links: English | සිංහල | தமிழ்
Contact: only real owner-approved channel if provided
Photo credits / Sources: as license obligations require
© / attribution: accurate project/team ownership where verified
Visible note: University project / demonstration; not an official Sri Lankan
government platform, ministry service or live source of government records
```

**Footers must not become misleading pseudo-government chrome.** No faux `gov.lk` footer, national coat of arms, ministry emblems, official stamps, or invented government agency partner logos.

Semantics:
- native `<footer>` landmark on public site;
- logically grouped `<nav aria-label="Footer navigation">`;
- no repeated H1;
- no duplicate language-switch controls that appear selected incorrectly;
- actual `href`s only; keyboard focus visible;
- small but readable text; contrast at least normal text standards for meaningful copy;
- no visual crowding or decorative flag gradient bar across the entire bottom of page.

At mobile widths, links stack naturally with enough target space; at wide widths, no excessive empty region or tiny text.

## 5.3 Required supporting page inventory — conditional on facts

**Preferred minimum pages** if truthfully supportable; do not force fake information pages.

| Page | Suggested purpose | Required caution |
|---|---|---|
| **About INFRAOS** | Mission, academic demonstration status, audience, why coordination matters, high-level intended lifecycle | No fake partners, project outcomes or rollout dates |
| **Accessibility information** | Supported interactions, current accessibility work, known barriers, feedback options when available | Do **not** claim "fully WCAG certified" without independent audit |
| **Privacy and data use** | Public-site actual data handling, cookies/analytics/media, account separation, what demo data is | Require facts; do not invent GDPR/PDPA legal conclusions or promises |
| **Contact / project information** | Owner-approved institutional/team channel or safe non-contact alternative | Do not invent a government helpdesk, phone number or working contact form |
| **Photo credits** (if needed) | Image creators, license URLs, attributions and changes | Requirements depend on verified license manifest |
| **FAQ / help** | Prefer Step 31 homepage FAQ anchor; separate page only if meaningful extra information exists | Avoid duplicate copy or two divergent answer sets |

**Avoid unnecessary pages**: press/media, procurement/tenders, real government news, complaint portal, staff directory, project lookup, service catalog, official partnership list, live status dashboard, downloads and legal policy pages containing guessed compliance claims. Some may be future-roadmap features, not landing obligations.

If Step 32 canonical roadmap lists additional "supporting pages" inspect and reconcile them with source truth, reporting any unavailable facts. Add routes only where substantial, approved content can exist.

## 5.4 Routing architecture / examples (adapt to real locale scheme)

Use Next.js App Router with **existing routing scheme**. Prior reports mention root English `/`, Sinhala `/si`, Tamil `/ta`; other locales may differ. Do not migrate to a new i18n router merely to add pages.

Examples **only if real routing supports them**:

```text
/           /si          /ta             public home
/about      /si/about    /ta/about       About
/accessibility  /si/accessibility  /ta/accessibility
/privacy    /si/privacy  /ta/privacy     factual data-use information
/contact    /si/contact  /ta/contact     ONLY with owner-approved contact facts
```

Prefer reusing a shared page layout and locale dictionaries rather than copying the same markup 3 times for every route. Keep dictionaries typed and translation keys stable; preserve existing locale-switch context so `/si/about` can switch to the corresponding English About page, rather than resetting to homepage unexpectedly.

Check current locale routing, canonical URLs, Next.js metadata and external URL exposure:
- public pages should be server-rendered/static by default;
- avoid unnecessary global `"use client"` and client hydration;
- use actual verified site origin for absolute metadata, or document a configuration blocker;
- generate canonical / hreflang where appropriate and tested, without inventing live production hostnames;
- don't accidentally expose routes under protected application layout;
- ensure public header/footer routes do not import auth/session providers or require login;
- ensure `not-found` and unknown route behavior remains unchanged.

## 5.5 About page — concise, credible, source-backed

Recommended sections:

1. `What INFRAOS is` (university demo; non-official).
2. `Why infrastructure coordination matters` (general problem, no unsupported statistics).
3. `How INFRAOS is designed to work` (ProjectTrace, RoadSync, intended lifecycle and synthetic examples).
4. `Who may use it` (planned citizen/staff use; not a real government-issued account).
5. `Current demo capabilities vs roadmap plans` (inspect real implementation; don't oversell).

Do not publish detailed internal architecture diagrams or security-sensitive route/resource listings simply to fill space. A public conceptual overview is sufficient.

**No marketing claims** such as "nationally deployed", "government endorsed", "millions saved" or "official approval platform" absent verified evidence.

## 5.6 Accessibility information page — evidence, not certification

The actual Step 24 accessibility foundation and any later manual checks support the wording. Content should:

- state the team's intention to follow inclusive design and to support English/Sinhala/Tamil; distinguish translations pending native review;
- explain accessible site use (keyboard, headings, contrast, responsive reflow) based on actual tests;
- state known barriers and review limitations honestly, including any not-yet-performed screen-reader/native-script audits;
- provide a genuine feedback channel only if verified; otherwise avoid a dead form or fake email;
- avoid claims of formal government accreditation, independent WCAG 2.2 AA certification or universal compatibility.

Automated axe scans are **not** certification. Do not invent an accessibility compliance date or review body.

## 5.7 Privacy / data-use information page — implement only verified facts

This is content authoring with a security/privacy review; **do not pretend to provide legal advice or a lawyer-approved privacy policy**.

A project demo may still emit:
- basic web server hosting logs and diagnostics;
- browser or hosting telemetry depending on real configuration;
- Next.js first-party technical cookies when needed;
- external font, analytics, embedded video or image requests if configured;
- staff identity/session information only on protected routes (later features).

Before writing any statement, inspect actual:
- public-site cookies and localStorage/sessionStorage usage;
- third-party analytics or tracking scripts;
- image hotlinks and external embed domains;
- font loading strategy;
- forms, newsletter or contact submission routes;
- deployed platform settings or documented defaults that could affect personal data;
- security docs and actual source code.

**Never claim** "we collect no information" or "we never use cookies" based solely on absence of a user-facing form. Hosting access logs may exist.

Keep content factual, narrow, and mark any unknown operational deployment policy for owner/legal review. If privacy policy claims cannot be validated, **block publication of unverifiable legal text** and document exactly what evidence/approval is missing.

No need to introduce cookie-consent popups when there are **no verified non-essential cookies**; conversely don't suppress a consent/legal need just because the user prefers a simple interface—flag unknowns for owner review.

Do not create tracking/analytics to support this task.

## 5.8 Contact page — no invented agency channel

Permitted patterns:
- project team contact details if **owner approved and safe to publish**;
- verified university/project website or GitHub organization link if owner authorizes;
- a simple public "About / FAQ" assistance route when no contact channel exists (without pretending to provide support).

Do not:
- invent `info@infraos.lk`, fake phone numbers, office addresses, government helplines or press contacts;
- expose private team members' phone/email;
- implement an unsecured contact form or new Express API;
- redirect to a government website as though it is INFRAOS's own support;
- imply that a citizen issue report can be officially submitted through a demo contact page.

A future functional Citizen Portal is beyond Step 32.

## 5.9 Photo credits and legal reuse

Existing earlier authorized images require a verified manifest. Re-inspect all used public-site images and identify:
- actual original URL and specific asset ID;
- creator/rights owner;
- license name/version and link;
- attribution wording and placement;
- modification/derivative requirements;
- image used where;
- source-reuse evidence, including date reviewed when available.

Keep photography in the public page only when right-to-use is documented. Wikimedia Commons entries can require attribution or share-alike; Unsplash/Pexels licenses have conditions. A public image URL is **not permission**.

If licensing cannot be verified, do not use that asset, or propose a replacement after authorization. Protect existing layout with a simple neutral media-free fallback rather than hotlink arbitrary imagery.

Do not claim the university demo photographs depict INFRAOS's actual deployed projects.

## 5.10 Footer / supporting pages multilingual parity

Every meaningful user-facing string should be translated through the current dictionary strategy:

- page title, intro and body content;
- public links, crumb labels, card labels, CTA text;
- header and footer navigational labels;
- metadata title/description, meaningful alt and image credits;
- accessibility feedback text where present;
- demo disclaimers and privacy caveats.

**Native-speaker review status stays evidence-based**: draft translations can be complete in keys and still require proficient Sinhala/Tamil review.

Sinhala and Tamil are both **left-to-right**; don't set `dir="rtl"`. Test glyph shaping, diacritics, line height, narrow viewports, mixed English technical terms and 200–400% zoom. Avoid font fallback that silently renders boxes or clips text. If language-specific legal/privacy terminology is uncertain, mark for human review before public release.

Do not auto-translate legally sensitive privacy claims and then call them approved.

## 5.11 Footer/pages accessibility and usability

Verify:
- one logical H1 per page; subsequent H2/H3 levels ordered;
- main landmark separate from footer navigation landmark;
- skip-to-main and visible focus persist;
- locale links clearly named and current locale announced where appropriate;
- footer links support standard keyboard/screen reader behavior;
- contrast, font sizes, touch target and spacing;
- reflow at 320px viewport, 200% zoom, long Tamil/Sinhala page names;
- external link descriptions where needed;
- consistent page loading and not-found states, no accidental public 500s;
- no focus trap or unnecessary modal;
- reduced-motion preferences respected.

Full visual polish is Step 34; do not introduce a second component framework, giant gradients or animated footer.

## 5.12 Technical file plan — adapt only after inspection

Potential structure, if compatible with existing Next.js paths and aliases:

```text
apps/web/src/components/landing/public-footer.tsx
apps/web/src/components/landing/public-information-layout.tsx
apps/web/src/lib/landing/messages.ts
apps/web/src/lib/landing/routes.ts or existing public route helpers
apps/web/src/app/(public)/about/page.tsx                   # illustrative only
apps/web/src/app/(public)/accessibility/page.tsx           # illustrative only
apps/web/src/app/(public)/privacy/page.tsx                 # illustrative only
apps/web/src/app/(public)/contact/page.tsx                 # only if approved facts
apps/web/src/app/(public)/[locale]/...                      # only if existing scheme
apps/web/src/lib/landing/footer-and-pages.test.ts
docs/marketing/public-page-content.md
docs/marketing/content-claims.md
docs/marketing/image-attribution.md
docs/reviews/step-32-pre-post-review.md
```

**Do not blindly create both `(public)` and `[locale]` alternatives.** Inspect existing app routes and add the minimal compatible structure.

When contact/accessible privacy facts are unresolved, record blockers rather than invent public content merely to check an acceptance box.

---

# 6. Step 32 test and review plan

## 6.1 Route and footer integration matrix

| Area | Required checks |
|---|---|
| Footer structure | footer visible on each intended public route/locale, not duplicated |
| Footer links | all actual hrefs resolve, correct route/anchors, no fake coming-soon links |
| Pages | implemented static public page routes return expected content; no auth dependency |
| Locales | `/`, `/si`, `/ta` and corresponding public pages work per actual route convention |
| Locale persistence | switching language on `/about`/`privacy` preserves page context where possible |
| Metadata | correct titles, descriptions, lang/hreflang/canonicals when configured |
| Demonstration status | prominent academic/non-government disclaimer throughout |
| About content | current-vs-planned distinction, no unsupported government claims |
| Accessibility statement | honest about tests and limitations, no false certification |
| Privacy copy | grounded in actual public data-handling; unknowns flagged |
| Contact | only owner-approved channel/link; no fabricated forms |
| Photo credits | verify attribution/rights manifest for each public image |
| Accessibility | keyboard navigation, focus, landmarks, zoom/reflow, long-language strings |
| Security | no private data, no new cookies/analytics, no unsafe HTML, no secrets |
| Regression | Steps 25–31 preserved; no edits to internal dashboard, auth, GIS/API |
| Toolchain | focused tests, lint, typecheck, build; browser if available |

## 6.2 Security/privacy review questions

- Are there any new JavaScript dependencies, embeds, analytics or trackers? (Prefer no.)
- Do any new public pages accidentally import server-only secrets or user/session data?
- Do any links lead to non-existent or restricted pages without accurate labels?
- Are "Privacy"/"Accessibility" statements fact-checked against implementation rather than generic templates?
- Are all image credits and attribution requirements satisfied?
- Are fake government contact coordinates, logos, ministry names or service statuses present?
- Are cross-locale route handlers and metadata public-safe?
- Could dangerous user-provided HTML render in FAQ/footer/page content? Prefer plain React text and controlled markup.

## 6.3 Step 32 post-implementation review template

```text
STEP 32 POST-IMPLEMENTATION REVIEW
Current branch / starting revision:
Step 31 checkpoint approval evidence:
Footer locations in public route tree:
Supporting page list with URLs:
About page source/truth status:
Accessibility page audit basis and limitations:
Privacy page implementation factual evidence:
Contact owner-approved info or blocked:
Photo manifest and attributions:
Current locale routing scheme:
en / si / ta dictionary parity:
Native-speaker/legal/owner review status:
All links verified vs intentionally omitted:
Metadata/canonical/hreflang evidence:
Keyboard/reflow/contrast results:
Lint/type-check/tests/build (exact commands and outcomes):
Browser checks (actual results or NOT RUN):
Security/public-private separation findings:
Step 25–31 regressions found/fixed/retested:
Files modified, new and untracked:
Git diff --check / unexpected changes:
Documentation updates:
Suggested Step 32 checkpoint commit:
Approval to proceed Step 33: YES / NO:
```

## 6.4 Step 32 acceptance gate

- [ ] Step 31 pre/post review complete and owner approved.
- [ ] Shared `feature/public-landing-enhancements` branch reused without losing teammates' work.
- [ ] Public footer is semantic, restrained, mobile-friendly and actually reusable across current public routes.
- [ ] Supporting pages are created **only for truthful, approved content**; About and accessibility information prioritized; privacy/contact accurate or explicitly blocked pending facts.
- [ ] Actual locale routing is preserved; links work across English/Sinhala/Tamil routes.
- [ ] No invented government seals, partnerships, real project records, security certifications, phone/email or backend services.
- [ ] Privacy and accessibility statements make only evidence-backed claims; content that requires owner/legal review isn't falsely marked approved.
- [ ] Attribution/rights verified for public images used, with manifest updates if needed.
- [ ] Footers and pages are keyboard-accessible, readable, responsive and properly labeled.
- [ ] Tests/lint/typecheck/build and available manual checks run honestly.
- [ ] Previous Steps 25–31 content and internal dashboards remain intact.
- [ ] Security, review, bugfix, retest, documentation and diff/untracked checks completed.
- [ ] Suggested commit/handoff prepared but not executed without permission.
- [ ] Step 33 not begun automatically.

**STOP AFTER STEP 32.** Leave current branch open for Steps 33–34. Do **not** merge `feature/public-landing-enhancements` to `development` before the agreed final group gate unless the team explicitly approves an intermediate PR.

---

# 7. Combined Steps 31–32 acceptance and branch integration policy

## 7.1 Review structure

```text
development (approved Steps 25–29, verified)
  └─ feature/public-landing-enhancements (shared Steps 30–34)
      ├─ Step 30 preview: reviewed and approved before Step 31
      ├─ Step 31 trust + FAQ + CTA: review / tests / fix / owner approval
      ├─ Step 32 footer + public pages: review / tests / fix / owner approval
      ├─ Step 33 animation/minimal interactions: FUTURE
      └─ Step 34 comprehensive public landing refinement: FUTURE
                   ↓
       whole-group visual/security/trilingual/a11y regression
                   ↓
       ONE approval-gated PR into development
                   ↓
       reviewed and tested development
                   ↓
       main only after explicitly approved stable release checkpoint
```

No per-step branches or unnecessary new PRs. Small checkpoint commits are permitted **only after explicit approval**; agent never silently commits.

## 7.2 Cross-step regression after Step 32

- Homepage sections remain correctly ordered with unique anchor IDs.
- Header/hero/problem/solution/features/lifecycle/audiences/GIS preview/trust/FAQ/CTA/footer are coherent and not repetitive.
- Public page routes, metadata and locale switch preserve intended context.
- All main links are correct and truthful.
- All public language dictionaries match across en, si, ta; native review gaps documented.
- Licensed photos remain properly attributed and do not imply project affiliation.
- No private app UI/global styles changed.
- Initial load, image/font performance and React hydration unaffected.
- No API, Atlas, RBAC, authentication, Qdrant, R2 or FastAPI changes.
- Unverified accessibility/privacy/compliance claims clearly identified.

## 7.3 Git commands / safety review

Discover package manager and available scripts; sample only:

```bash
git status --short
git branch --show-current
git diff --check
git diff --stat
git diff --name-only
npm run lint
npm run type-check
npm run test
npm run build
```

Check new/untracked files separately; `git diff` does not include their contents until staged. Review the full privacy text and external links manually. If scripts unavailable, record `NOT AVAILABLE` or `NOT RUN`; never invent PASS.

Checkpoint suggestions (do not execute without explicit permission):

```text
feat(landing): add public trust faq and next steps
feat(landing): add trilingual footer and public information pages
```

Group PR later:

```text
feature/public-landing-enhancements → development
```

Never blindly push, merge to main, delete remote branches, force reset/rebase, or stash teammates' changes.

---

# 8. Documentation, deliverables and ownership

Ensure all required information lives in the repo's approved doc structure, rather than proliferating redundant files:

- Design/content map and updated public-site information architecture;
- content/claims truth register documenting *implemented vs planned*;
- FAQ English/si/ta questions and review status;
- real CTA link audit and footer route/link audit;
- factual privacy/accessibility supporting-page statements and approvals;
- photo source/license and attribution records;
- Step 31 and Step 32 pre/post review reports;
- automated test command matrix and browser QA notes;
- changelog/architecture notes if existing workflows require them.

**Team roles:** public landing content and assets may be developed by the assigned member, but shared route/localization components and design tokens require coordination with the team leader. Do not overwrite user/team changes, reset Git, or merge a group PR without approval.

**No production or legal claim should be treated as verified unless the corresponding evidence is recorded.**

---

# 9. Final completion report template

```text
INFRAOS — STEPS 31–32 EXECUTION REPORT

CURRENT SHARED BRANCH:
Starting commit and known dirty/untracked files:
Prerequisite Step 30 approved:
Current Step 31 checkpoint: COMPLETE / PARTIAL / BLOCKED
Step 31 owner approval to proceed:
Current Step 32 checkpoint: COMPLETE / PARTIAL / BLOCKED
Step 32 owner approval for Step 33:

STEP 31 — DELIVERED
Trust/security explanation and exact claim review:
FAQ inventory/questions:
Working CTA links with locale destinations:
en/si/ta coverage and native-review status:
Files changed:
Unit/localization/link tests:
Keyboard, contrast, responsive checks:
Bug fixes / retest:

STEP 32 — DELIVERED
Footer components and where installed:
Actual supporting pages and route URLs:
About, accessibility, privacy, contact factual sources:
Photo attributions and licenses:
Language-switch context preservation:
Metadata, SEO, landmarks, links:
Security and public-private boundaries:
Files changed:
Tests and manual QA:
Bugs fixed and retest:
Owner/legal/native-language content review outstanding:

COMBINED
Old landing sections preserved:
Dashboard/admin and internal modules untouched:
Changes to dependencies/lockfile:
Git diff/status/untracked audit:
Step 31 suggested commit:
Step 32 suggested commit:
PR: NOT CREATED/MERGED unless separately approved
development merge: NOT PERFORMED without approval
main merge: NOT PERFORMED without stable-release approval
Known issues, blockers and responsible owner:
Next eligible step: Step 33 (NOT STARTED)

STOP.
```

---

# 10. Hard stop conditions

STOP and ask for review when:
- Step 30 is not approved or shared branch ownership is ambiguous.
- Merging/checkout would overwrite other teammates' uncommitted files.
- Genuine link destinations or content facts are unavailable.
- A legal/privacy/accessibility declaration requires evidence not present.
- A photo lacks verifiable reuse rights and replacement is not authorized.
- An implementation would require unplanned authenticated, database, storage, notification, GIS or AI functionality.
- Major test/build failures are introduced and not yet remediated.

**Step 31 independent review/approval precedes Step 32. Step 32 completion does not authorize Step 33, Step 34, a PR merge, or changes to `main`.**
