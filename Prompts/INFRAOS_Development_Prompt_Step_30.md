# INFRAOS — Complete Enhanced Development Prompt
## Phase 4 · Step 30 — Public Product Preview & GIS Visualization (Landing Page Only)

**Project:** INFRAOS — National Infrastructure Intelligence & Coordination Platform  
**Vision:** The Operating System for National Infrastructure  
**Core lifecycle:** Plan → Coordinate → Approve → Build → Verify → Monitor → Complete → Maintain  
**Roadmap position:** Step **30** of the agreed 190-step roadmap / Phase 4 public website  
**Previously agreed title interpretation:** *Public Product / GIS Preview* (confirm wording against original `Steps.docx` if available in the repository)  
**Scope:** Public information landing page **only**; no operational GIS workspace or protected dashboard changes  
**Branch grouping:** **one shared branch** `feature/public-landing-enhancements` for **Steps 30–34**, not one branch per step  
**Integration:** reviewed group PR into `development`; `development` to `main` **only** after independent stable-checkpoint approval  
**Companion:** `INFRAOS_Cursor_Execution_Prompt_Step_30.md`

> **Dependency warning:** The user has not provided evidence that Steps 28–29 are fully reviewed and the **Steps 25–29 public-landing-core group** is merged into `development`. Creating this Step 30 prompt is not authorization to bypass them. Before edits, the coding agent must verify Steps 25–29 are completed, their public-government-style corrections are addressed or tracked, and the approved baseline is available. If not, STOP and request a decision. Do not invent an integration result.

> **Design direction override:** The public site must resemble a **clear, trustworthy Sri Lankan government information portal**—accessible to citizens, officers, administrators and staff—not a visually crowded SaaS product advertisement. All public copy is in **English, Sinhala and Tamil**; translations drafted by an AI remain **pending native-speaker approval** until reviewed. Use relevant real, licensed infrastructure photography judiciously; never imply official government ownership of the university demonstration. **Internal dashboards and existing feature pages must remain unchanged.**

---

# 0. Agent responsibility and mandatory execution rules

You are acting as **Principal Public-Sector UX Architect, Senior Next.js/React/TypeScript Frontend Engineer, Accessibility and Localization Specialist, GIS Visualization Reviewer, Application Security Engineer, QA Engineer, and INFRAOS Technical Integration Lead**.

Your single goal is to build a **truthful, fast, static-first, accessible public-facing product/GIS preview** as one section of the already implemented INFRAOS landing page. It should help visitors understand the *idea* of cross-agency infrastructure visibility and road/utility conflict coordination. It is **not** the GIS product, an interactive project tracking application, a live RoadSync engine, or a government production map.

**Work order:**

```text
Read canonical documents + inspect actual Git/repo state
  → Verify approved Steps 25–29 baseline and real route/content structure
  → Produce Step 30 PRE-IMPLEMENTATION REVIEW & exact file plan
  → Continue on shared Step 30–34 branch (create once, safely)
  → Build static-first product/GIS preview only
  → Unit/integration/a11y/locale and visual/browser checks
  → Independent implementation review, fix and retest
  → Documentation + full changed/untracked files & security inspection
  → Human-reviewed Step 30 checkpoint; branch remains open for Steps 31–34
  → STOP; do not auto-start Step 31
```

Never assume a previous prompt was implemented because the `.md` file exists. Do not automatically create commits, push, merge, open a remote PR, change `main`, reset, stash, discard colleague edits, or rewrite history. Preserve untracked prompt files.

---

# 1. Source of truth and existing architecture

## 1.1 Read these repository sources before touching code

The paths below are **examples**; discover actual names and read all matching approved files:

```text
Prompts/INFRAOS_Development_Prompts_Steps_27_to_29.md
Prompts/INFRAOS_Cursor_Execution_Prompts_Steps_27_to_29.md
Prompts/INFRAOS_Public_Landing_Government_Design_Research_and_Cursor_Directive.md
Prompts/INFRAOS_Development_Prompts_Steps_25_to_26.md
Steps.docx or the canonical roadmap if present
README.md; CONTRIBUTING.md; any Cursor/AGENTS instructions
apps/web/package.json; root package.json; lockfile
apps/web/src/app/** layout, pages, route metadata
apps/web/src/components/landing/**
apps/web/src/lib/landing/** locale dictionaries, navigation, content claims
apps/web/src/styles/** and globals.css
apps/web/src/components/ui/**; common/**
docs/architecture/**; docs/design/**; docs/marketing/**; docs/reviews/**
docs/security/**; docs/team/**
apps/api/src/routes/v1.ts; packages/shared-types/** (READ ONLY, if needed for truthful claims)
```

Check actual code names, not assumptions. Earlier user-observed landing structure includes `/`, `/si`, `/ta`; `public-home.tsx`, `navigation.ts`, `messages.ts`, `platform-features-section.tsx`; and homepage anchors `#problem`, `#solution`, `#features`. **Verify these still exist**. Do not create a second public-home component or duplicate the entire landing route.

## 1.2 Locked technical stack

- **Public frontend:** Next.js App Router + React + TypeScript + Tailwind CSS + shadcn/ui; reuse Step 17–24 semantic design tokens, typography, components and accessibility patterns.
- **App data/API:** Express 5 TypeScript `/api/v1` modular monolith; currently existing features must be verified from real repo. Do **not** add an API or change CORS/cookies/auth to supply public visual content.
- **Database:** MongoDB Atlas / Mongoose / GeoJSON `2dsphere` foundation; no live DB read, Atlas credentials, project location disclosure or file uploads required here.
- **GIS:** MapLibre / OpenStreetMap are intended for the actual InfraMap module **at Steps 81–91**. Step 30 implements a **controlled public preview** and must not secretly introduce the mapping app.
- **RoadSync:** Real scheduled location and date overlap detection is deterministic in the planned later domain module, not driven by an LLM and not proven implemented by a public illustration.
- **Future platform:** ProjectTrace, approval workflows, risk, DocTrace, finance, inspection, assets, citizen portal and audit should be described as current/preview/planned according to **verified** repo capability. Do not import those modules or create public endpoints.

## 1.3 Domain truth, not marketing fiction

The project's key demonstrative scenario is **road resurfacing planned over a segment where water pipeline work is also scheduled within an overlapping date window**. For the public preview, show a **clearly marked simulated example**, using synthetic content only. Do not claim a live GIS query, real conflict alert, actual government road closures, a citizen-facing live project map, an AI-verified risk score, or official inter-agency connection.

If the dataset already has a verified synthetic demo fixture for such a scenario, you may reuse its **non-sensitive, explicitly public, hardcoded display facts** (or a static, documented projection), but do **not** import seeded Mongoose data into the public web bundle, query actual database records or expose precise restricted coordinates.

---

# 2. Step 30 completion prerequisites and baseline verification

**Hard prerequisite:** Steps 25–29 approved together and safely integrated or an **explicit user-approved stacked-branch strategy** documented. Do not assume the Step 29 prompt means Step 29 was completed; last explicit status previously reported was Step 27 partial and Step 28 starting.

Before work, inspect:

```bash
git status --short
git branch --show-current
git remote -v
git log -8 --oneline --decorate
git branch -a
```

Use read-only local Git inspection first; network operations only if available and explicitly appropriate. Check PR/merge evidence for `feature/public-landing-core` and confirm `development` includes the approved public landing before branching from it.

### If Steps 25–29 are not merged

1. Report **BLOCKED: preceding landing-core group not on approved baseline**.
2. Offer: (A) finish/review group and merge to `development`, recommended; or (B) an explicit stacked follow-on branch/PR from `feature/public-landing-core`, if the team consciously chooses that workflow.
3. Do **not** silently create `feature/public-landing-enhancements` from an older `development` or cherry-pick someone else's unfinished changes.
4. Existing uncommitted, untracked or staged changes must remain intact.

### Mandatory PRE-IMPLEMENTATION REVIEW

```text
STEP 30 PRE-REVIEW
Repository / branch / commit / remotes:
Git clean? tracked, staged and untracked inventory:
Steps 25–29 completion/approval/merge evidence:
Government-style public landing corrections completed or tracked:
Existing public routes/locales (/ and/or /en, /si, /ta):
Existing hero/problem/solution/features/lifecycle/audience sections:
Photo library and image permission/attribution manifest:
Existing implementation/current disclosure of prototype/demo:
Actual production/public APIs that exist (if any):
Existing GeoJSON/demo records relevant to concept (metadata only):
Installed Next/React/Tailwind/shadcn versions:
Step 17–24 color, typography, a11y token implementation:
Existing preview components / visual assets / maps, if any:
Current test, lint, typecheck, build and browser tooling:
What Step 30 will change:
What Step 30 will NOT change:
Risks, conflicts, and missing source decisions:
Proposed static-first visualization:
Proposed a11y/locale/image/test plan:
READY / BLOCKED:
```

If the original `Steps.docx` is accessible, verify exact Step 30 title and scope. If not, use this previously agreed *Public Product & GIS Preview* interpretation, disclose source limitation in report, and proceed only when no contradiction appears in the repository.

---

# 3. Git branch policy — reduced-branch strategy

**One shared branch for Steps 30–34:**

```text
development (approved Steps 25–29 present)
   └── feature/public-landing-enhancements
          ├── Step 30 · product/GIS preview — independent check/review
          ├── Step 31 · supporting public sections — future
          ├── Step 32 · footer/supporting pages — future
          ├── Step 33 · minimal public interactions — future
          └── Step 34 · final landing responsive/a11y/visual polish — future
                 └── one reviewed group PR → development
```

If `feature/public-landing-enhancements` already exists, confirm its base, ownership, commits and files and **reuse rather than creating duplicates**. If it does not, and `development` is current, approved and worktree safe, create it from the existing team procedure. Example only, not a blind command sequence:

```bash
git switch development
git pull --ff-only origin development
git switch -c feature/public-landing-enhancements
```

Do not run destructive Git operations. If source branch is not ready or remote unavailable, report the limitation. Separate review checkpoint **per step**, not necessarily separate branches/PRs/commits; individual commits only on user approval. `development → main` stays a separately approved release gate.

---

# 4. Product preview design: calm, realistic public-sector presentation

## 4.1 Purpose, audience and information architecture

The section should answer four simple questions for visitors (citizens, officials, inspectors, administrators, staff, students):

1. What information could an integrated infrastructure map bring together?
2. Why does planned road work benefit from coordinating with water/electricity/telecom work?
3. What does a *simulated* geographic-plus-schedule overlap look like?
4. What is a live public service versus a project demonstration or future capability?

**Do not** make the landing page a complex interactive dashboard. Use one concise titled public section, a simple static visual preview, a short explanatory caption and a few supporting plain-language points. Avoid big stat tiles, glassmorphism, parallax, 3D maps, rotating carousels, animated route tracing and fake realtime notifications.

### Recommended section composition

```text
[Section heading: Infrastructure coordination preview]
[One-sentence purpose + visible "Illustrative demo / Prototype" status]

[Contained static schematic / approved real UI screenshot]
  Planned resurfacing segment — orange line
  Planned water utility work — contrasting dashed blue/neutral pattern
  Shared road section / schedule overlap — maroon highlight + label
  Small accessible legend + no reliance on color alone

[Below/alongside visual]
  Location overlap + planned dates + agency coordination concept
  Clear "Illustrative scenario, not live government data" statement

[Optional concise note about InfraMap + RoadSync being in development]
```

**A neutral/blue secondary utility line may be used for *categorical distinction* only when it improves legibility; it must not override approved brand semantics.** Orange remains branded emphasis; maroon remains conflict/critical; yellow pending review; green resolved/approved only when actual status is clearly explained.

Where an existing landing section already does this well, **improve it rather than duplicate**. Do not add more than one large preview to the landing page.

## 4.2 Choose preview implementation based on truthful available evidence

Pick one approach and document why:

**Option A (preferred for current maturity): Accessible static schematic** drawn as a small semantic diagram (SVG plus HTML legend, or lightweight local image) using **synthetic** lines and intervals. The goal is comprehension, not geographic precision. If geometry does not correspond to verified data, call it *conceptual, not to scale*. Do not overlay it over a real basemap suggesting factual Colombo roadwork.

**Option B: Screenshot of a real existing, owner-approved, synthetic-data-only prototype.** Use only if the screenshot comes from the actual repo/app and you have reviewed it for private information, map licensing and domain accuracy. Label clearly as prototype; update screenshot if it becomes stale.

**Option C: Tiny non-production interactive illustrative preview** only if existing components already support it and A/B are inadequate, *with documented user approval*. Limit interaction to a small tabs/details toggle and keep a working no-JS fallback. Do not introduce MapLibre, WebGL/geolocation, tile services, map layers, spatial APIs or conflict detection in this Step 30 preview merely to impress visitors.

**Decision guardrail:** If the team wants full interactive GIS/map search, route that work to InfraMap Steps 81–91 and the Citizen public map Step 130, not to Step 30.

---

# 5. Required Step 30 UI features and sub-features

## 5.1 Semantic section structure

- One `<section id="preview">` or another verified, stable anchor (avoid duplicate IDs) with a meaningful translated `<h2>`.
- A concise introductory paragraph, clear standalone demo/prototype qualifier, legend and accessible caption.
- Sensible sequence in existing public home, likely after features/lifecycle/audiences, **but inspect current hierarchy** before choosing placement. Step 30 must not reorder/hide completed Steps 25–29.
- Use existing `PageContainer`, landing spacing and typography rather than constructing a second design token system.
- Prefer server-renderable/static content. Add `"use client"` only to actual interactive child if a justified interaction is approved.
- Ensure jump navigation anchor/active nav configuration is added only if meaningful and does not overcrowd the header; preserve language and focus navigation.

## 5.2 Illustration content & legend

Use a coherent and **clearly synthetic** example:

```text
Illustrative case: Road resurfacing + water pipeline work
Work A: Road agency — road resurfacing — planned dates [synthetic fixed range]
Work B: Water agency — pipeline work — planned dates [synthetic overlapping range]
Concept shown: shared segment and overlapping dates
Coordination outcome: future workflow, not simulated approval result
Status: Sample / conceptual; NOT an active RoadSync conflict
```

- Source any chosen fixed demo dates from the existing approved demo scenario where possible; otherwise create clearly labeled illustrative dates and avoid a claim that a backend generated them.
- Encode a visually obvious **common segment** and **overlapping schedule**. Do not accidentally show nonoverlapping dates or confuse `NEARBY_WORK` with an actual line intersection.
- The diagram may include *approximate* route lines and utilities, but no real geo assertion, live marker or precise sensitive coordinates.
- Provide textual equivalence of the logic, not just colored lines: “Road work and water work share a section and occur in the same date period.”
- Mark visually and in accessible copy: *Illustrative product concept — not live government project information.*
- Legend has distinguishable line patterns/labels (e.g., solid road, dashed utility, outlined/maroon potential issue) and meaningful text. Don't use orange/yellow/maroon/green in arbitrary role assignments.
- Avoid displaying financial savings, hours saved, live agency names, actual government project IDs, approvals, data sources or confidence metrics without evidence.

## 5.3 Real photographic imagery

The user's public-style directive asks for **real, relevant infrastructure photos**, not synthetic photorealistic illustrations masquerading as events. Step 30 is a GIS/product preview; do **not** require another large photo if the hero/earlier sections already use approved licensed imagery. An optional documentary supporting photo is acceptable if it materially improves clarity and a source/creator/license review is completed.

- Use existing properly licensed local photographs if possible.
- For new material, verify **each specific asset**, original source URL, copyright holder/creator, license or written permission, attribution wording, modification rights, date checked and exact usage. Avoid assuming `.gov.lk` images are reusable.
- Do not scrape tiles, Google Maps screenshots or proprietary GIS apps. Do not copy government emblems/seals or imagery suggesting official sponsorship.
- Use `next/image` when appropriate, properly sized, optimized and lazy-loaded below fold. No unnecessary third-party runtime image hosts/tracking.
- If no licensed photo is available, use the static schematic alone and report photo sourcing as an optional outstanding item.
- Update the existing asset attribution manifest (if one exists) rather than creating a conflicting duplicate.

## 5.4 Fully trilingual public content

All visitor-visible material must exist in **English (`en`), Sinhala (`si`), Tamil (`ta`)**, matching the real repo locale routing. Translate **all** of:

- section heading and description;
- preview-status disclosure, figure caption and legend labels;
- road/water sample labels and date explanation;
- alternative text (or empty `alt` if the image is only decorative) and any accessible SVG title/description;
- route/anchor/navigation link if added;
- fallback/error explanation (if a relevant state exists);
- page/section metadata where affected.

Use typed locale dictionaries / current message schema; don't invent parallel i18n systems. Ensure `lang`/`dir` matches rendered locale, correct Sinhala/Tamil font fallback, Unicode/long word wrapping and translations preserve **meaning** rather than word-for-word UI character limits.

**Human-language verification status:** An AI draft is not native-speaker-reviewed. Maintain precise status per locale (e.g., *draft / pending qualified review*). Do not claim fully localized/professionally translated or certified government terminology based solely on all keys existing.

## 5.5 Public claims and feature-status truthfulness

The section must not silently conflict with already completed Step 27 feature cards, Step 28 lifecycle descriptions or Step 29 audience/benefits.

- Distinguish “platform vision”, “illustrative preview”, “prototype built”, and “deployed service” based on **verified implementation**.
- If only health/readiness API exists, do not write “View live infrastructure conflicts”, “Real-time national map” or “Search every government project”.
- No fake button to a nonexistent `/projects`, `/map`, `/staff/login` or citizen portal route.
- A CTA to `#how-it-works`/`#features` is acceptable only when the current translated route actually has that anchor; if an existing public info page is available, use a tested link.
- Update `docs/marketing/content-claims.md` or canonical claims registry with status/justification for new statements.

---

# 6. Component/API architecture (frontend-only)

## 6.1 Suggested file boundaries — inspect before using

```text
apps/web/src/components/landing/product-gis-preview-section.tsx
apps/web/src/components/landing/coordination-preview-figure.tsx
apps/web/src/components/landing/public-home.tsx          # integrate section only
apps/web/src/lib/landing/messages.ts                   # en/si/ta texts in existing schema
apps/web/src/lib/landing/navigation.ts                 # optional anchor, existing pattern
apps/web/src/lib/landing/preview-data.ts               # OPTIONAL static typed synthetic fixture
apps/web/src/lib/landing/preview-data.test.ts          # if fixture logic meaningful
apps/web/src/lib/landing/landing-preview.test.tsx      # or actual existing test location
apps/web/public/images/landing/...                    # only verified rights/asset

docs/marketing/content-claims.md                       # factual claim inventory
docs/design/public-product-preview.md                  # decisions / diagram semantics
docs/marketing/image-licenses.md                       # existing manifest where applicable
docs/reviews/step-30-pre-post-review.md               # review evidence
```

These are **suggested**, not assertions about your repository. Reuse existing names and folder layout. Avoid an unnecessary new shared package just for a one-section figure. No domain/service state, provider, API route or DB seed just for preview.

## 6.2 Data shape for a purely illustrative sample

Use a **strictly local, typed const** if necessary:

```ts
// Conceptual illustration only; no API or real government records.
type PreviewWork = {
  id: "road" | "water";
  labelKey: string; // points to existing locale dictionaries
  schedule: { startDate: string; endDate: string }; // date-only YYYY-MM-DD
  pathKind: "solid" | "dashed";
};
```

No precise GeoJSON coordinates necessary for a conceptual figure. If using approved **synthetic GeoJSON**, ensure `[longitude, latitude]`, correct format, and ensure no actual project/agency authority is implied. Do not imply that drawing SVG paths executes spatial logic. Dates must be chronologically valid and actually overlap. Financial data does not belong in this section. Do not use backend `mongoose`, `ObjectId`, auth tokens or server secrets in client code.

## 6.3 Avoid dependencies by default

For a static-first illustration and figure, use React, semantic HTML, CSS and minimal local SVG rather than install MapLibre (or another GIS library), a map tile account, chart package, GSAP or analytics solely for Step 30.

If packages are needed for an explicit approved requirement, document size, license, SSR/CSR implications and alternatives before installing.

---

# 7. Frontend state, routing, and graceful degradation

The preferred implementation is static and works with JavaScript disabled. No unnecessary loading spinners, empty states, network requests or retry toasts. If a tiny approved interaction exists, it must have:

- a keyboard-accessible control with name/state;
- state that preserves accessible text description;
- a deterministic initial state (no hydration mismatch);
- a no-JS explanation / equivalent static content;
- no fake network activity or “Live” status;
- no heavy motion.

Route and anchors must remain working across `/`, `/si`, `/ta` or the **actual** approved locale structure. Language switching from the preview should retain the visitor's section when existing architecture supports it. Do not alter App Router static generation strategy or middleware routing without explicit reason.

---

# 8. Accessibility — WCAG 2.2 AA-oriented controls

A compliant preview must include the following verifiable properties:

- semantic heading structure (one page `<h1>`, Step 30 subsection `<h2>` at correct hierarchy);
- figure with `<figcaption>` or equivalent semantic association;
- textual equivalent of roadmap overlap rather than image-only meaning;
- meaningful alternative text when informative, decorative assets use `alt=""`;
- if using raw SVG, an appropriate `role="img"` and localized title/description, or `aria-hidden="true"` if nearby equivalent text fully explains it;
- line patterns and distinct labels, not color-only conflict meaning;
- contrast verified for text, legend and map/diagram stroke boundaries where meaningful;
- no fine-print demo notice so small/low-contrast that citizens miss it;
- logical reading order, visible keyboard focus, no keyboard trap;
- minimum zoom/reflow review at 200% and 400% (as feasible), widths 320, 375, 768, 1280;
- Sinhala/Tamil glyph and line-height review including long terms;
- prefers-reduced-motion honored; avoid animation altogether by default;
- no unapproved embedded third-party map viewer causing inaccessible iframe/tab stops;
- optional zoom/control actions keyboard and touch accessible if they exist (not required).

Automated axe may identify some issues but does **not** prove screen-reader usability or native language quality. Log actual tool coverage and unperformed manual checks.

---

# 9. Privacy, security and trust boundaries

1. **No backend changes:** No Express endpoint, storage bucket, MongoDB schema/index, seed, role/permission rule, AI service or citizen API is necessary.
2. **No real infrastructure exposure:** Do not read nonpublic Atlas project coordinates, documents, contracts, citizen issues or work requests into the public page/RSC payload. Public GIS transparency needs an approved scoped projection in future roadmap steps, not implicit access here.
3. **No invented agency endorsement:** Site is a Sri Lankan university GovTech demonstration, not a government-operated service; don't use seals/identifiers suggesting otherwise.
4. **No external embed surprises:** Avoid live tiles, analytics, image CDNs or Google map embeds unless separately approved, correctly attributed/licensed and covered by privacy/security policy.
5. **No unsafe HTML injection:** Render all translated copy/legend data as text or sanitized approved content; avoid `dangerouslySetInnerHTML` and user-generated SVG/HTML.
6. **No fake authorization:** No UI-only staff privilege or “sign in” link to an unimplemented backend.
7. **License compliance:** If imagery or map data attribution is applicable, document exact scope and ensure visible credits where license requires it. OpenStreetMap attribution requirements apply if actually using OSM-derived map data/tiles; do not falsely imply OSM backing when only showing a conceptual diagram.
8. **No personal data:** Avoid identifiable workers/license plates where not needed and any real citizen photos without permission.
9. **Public performance/privacy:** Favor self-hosted, approved assets and avoid unnecessary third-party runtime requests.

---

# 10. Exact implementation stages

### Stage A — Audit and baseline

Read Step 30 sources and actual code, reconcile Step 29 integration state, inspect real landing DOM order and current locale dictionaries. Run baseline available tests or record blockers. Produce pre-review. No edits before safe branch determination.

### Stage B — Plan UX and asset scope

Propose one calm section, placement, figure option A/B/C, exact synthetic story, localization keys and claims. Check photography manifest and existing hero images. Identify all touched files and test cases. Do not accept “interactive live map” without scoped authorization.

### Stage C — Implement static-first preview

Build existing-site-compatible section and visual. Prefer meaningful explanatory copy and simple comparison of two planned work types. No new page unless unavoidable; don't produce a separate prototype app. Keep all details static/typed, annotated as examples.

### Stage D — Integrate across locales and routes

Add `en/si/ta` content/semantic labels, optional nav anchor if existing pattern, respect current locale route structure and header menu. Ensure image/figure and claims remain the same truth across languages.

### Stage E — Focused automated tests

Test rendering, locale parity, expected demo labels/disclaimer, date overlap truthfulness if fixtures have dates, SVG/figure accessibility, stable section anchor and absence of broken links. Review server output for private data and no new network dependencies.

### Stage F — Manual verification + a11y

At minimum attempt (or document `NOT RUN` with reason): 320/375/768/1280 viewport, keyboard navigation, mobile menu and language switching, 200% zoom/reflow, images, readability, axe, console/hydration, No-JS fallback and native reviewer follow-up for Sinhala/Tamil.

### Stage G — Review, fix, re-test

Independently inspect architecture, claims, translation keys, trust/image licenses, no dashboard changes and performance. Fix Step 30-related issues and rerun relevant tests plus wider landing regression.

### Stage H — Documentation and Git handoff

Update claims/diagram/design/license documentation and independent review. Inspect actual staged/unstaged/untracked files and `git diff --check`; prepare human-approved checkpoint (suggestion below). Keep the shared branch open for later enhancements.

---

# 11. Detailed testing matrix

| Area | Test | Evidence / expected outcome |
|---|---|---|
| Section integration | Renders once on each public locale | No duplicate ID; correct DOM section order |
| Content | Honest preview/vision disclaimer | “Illustrative/not live” meaning present in all 3 languages |
| Story | Road and water overlap in space **and** time | Text/visual internally consistent; no inference that detector actually ran |
| Static data | If dates used, ranges valid | Start <= End for each; intersection if stated |
| Visual | Legend lines/labels | Solid/dashed and explicit conflict label; not hue alone |
| Locale | en/si/ta dictionary parity | No missing keys, English fallbacks only if justified and visible |
| Language | Cross-locale navigation | Anchor preserved when existing switch supports it |
| Accessibility | Heading/figure semantics | Meaningful h2 + caption/description; labels/contrast |
| Keyboard | All actual interactive elements | Tab/Shift Tab/Enter/Escape and focus, if applicable |
| Responsive | 320/375/768/1280 | No horizontal overflow, overlapping labels, tiny unreadable disclaimers |
| Zoom | 200/400% where possible | Reading and scroll without loss of info |
| Image rights | Every added asset reviewed | Manifest + attribution visible when required; don't assume rights |
| Security | Client/server bundle | No private data, real location records, tokens, secrets, unsafe html |
| Performance | Avoid giant bundles | No new WebGL/map/tile/animation dependency without approval |
| SEO | Public route titles intact | Existing metadata/canonicals/hreflang unchanged or improved narrowly |
| Regression | Existing Steps 25–29 landing content | No broken links, mobile menu, hero/section anchors or locale copy |
| Boundary | App shell/dashboard/GIS modules | No unapproved changes |
| Tooling | Lint, type-check, tests, build | Real exit codes, results PASS/FAIL/NOT RUN |

Do not weaken baseline tests, suppress TypeScript, remove lint rules or claim a11y certification from an automated scanner.

## 11.1 Typical commands (adapt to actual workspace)

```bash
# Inspect available scripts first
npm run test
npm run type-check
npm run lint
npm run build

git diff --check
git status --short
```

Use the repository's actual package manager, names and flags. Do not run Atlas, DB seed/migration or backend production operations for the preview. If a particular check cannot run (e.g., browser), mark `NOT RUN` with reason and suggested human verification; treat any blocker correctly.

---

# 12. Mandatory POST-IMPLEMENTATION REVIEW

Deliver the following with actual evidence, and **fix** all in-scope critical defects:

```text
STEP 30 POST-IMPLEMENTATION REVIEW

BASELINE / GIT
Current feature branch and start commit:
Steps 25–29 merged+approved? Evidence:
Dirty/staged/untracked files before and after:
Changed files; newly added assets and their rights:

ARCHITECTURE
Section location and imports:
Why static schematic / approved screenshot / other:
Server/Client boundary correct:
No new APIs, DB queries, auth, AI or real GIS:
No internal dashboard changes:

CONTENT AND TRUST
Demo/prototype disclosure visible:
Illustrative work example true in both space+dates:
Claims consistent with Step 27–29 and actual repo:
No official endorsement suggested:
License & attribution source logs:

DESIGN AND LOCALES
Colors, typography and calm government style:
en/si/ta key parity:
Translation review status per locale:
Responsive and zoom results:
Figure equivalent meaning for screen readers:
Keyboard/focus/contrast/a11y findings:

TESTS
Preexisting baseline test state:
Focused component/locale/diagram tests:
Web lint/type-check/tests/build:
Full affected landing regression:
Browser & axe/manual QA:

FIXES AND HANDOFF
Defects found with severity:
Changes made to fix them:
Retest evidence:
Remaining blockers or review actions:
Docs/claims/image manifest updates:
Security/privacy & performance review:
Diff status and safe commit proposal:
Approval checkpoint for Step 31:
```

If critical required work is unverified (e.g., inaccessible figure, missing a locale, production claim), report `PARTIAL/BLOCKED`, not complete.

---

# 13. Definition of Done / acceptance checklist

- [ ] Canonical Step 30 scope verified if roadmap present, no silent drift.
- [ ] Verified completed and approved Steps 25–29 baseline, with safe branch strategy.
- [ ] Shared `feature/public-landing-enhancements` branch correct (not one branch per step).
- [ ] New public product/GIS preview is **one simple, meaningful section** integrated with existing home.
- [ ] Actual mode selected from static schematic / approved synthetic screenshot; does not claim live GIS.
- [ ] Two relevant infrastructure activities communicate both location overlap and schedule overlap.
- [ ] Fixed illustrative data are consistent (date range math if included) and labeled synthetic.
- [ ] Visible prototype/university demonstration disclaimer and honest product status.
- [ ] Clear semantic content, figure description, accessible legend beyond color.
- [ ] Text/caption/alt/optional nav present in English, Sinhala and Tamil.
- [ ] Translation human-review status explicitly recorded; not falsely claimed complete.
- [ ] No fake CTA to unavailable routes or official endorsement/logos.
- [ ] Existing licensed photography preserved; any newly used assets documented or no new photo necessary.
- [ ] No new MapLibre/tiles/geolocation/full GIS application, public database integration or backend endpoint.
- [ ] No changes to internal dashboards, workflows, auth or protected assets.
- [ ] Contrast, mobile/desktop, zoom and keyboard checked with accurate evidence.
- [ ] Lint, types, tests, build and relevant regression checks PASS or actual blockers clearly described.
- [ ] Post-review completed, in-scope issues fixed and re-tested.
- [ ] Docs/claims/license manifest and Git diff/untracked-file review complete.
- [ ] Suggested checkpoint prepared, no unapproved commit/push/merge.
- [ ] Branch remains open for Steps 31–34, and Step 31 does not start automatically.

---

# 14. Suggested commits/PR and review checkpoints

**Suggested reviewed Step 30 checkpoint commit:**

```text
feat(landing): add trilingual illustrative infrastructure preview
```

Do not execute it until user/team grants explicit authorization. Later steps 31–34 can add their own approved checkpoints on the **same** `feature/public-landing-enhancements` branch. At group completion, run a full public site integration review and prepare **one** PR from that shared branch into `development`.

`development → main` is **not** part of Step 30. A stable checkpoint requires independent testing, team review and explicit authorization. Do not create one PR per trivial section.

---

# 15. Exact final report template

```text
INFRAOS STEP 30 — PUBLIC PRODUCT/GIS PREVIEW

STATUS: COMPLETE / PARTIAL / BLOCKED
Dependency proof: Step 29 + group 25–29 review + development merge:
Base commit:
Branch: feature/public-landing-enhancements
Current Git state:
Chosen preview format and why:
Public placement/anchor:
Synthetic overlap scenario (what exactly is illustrative):
Product readiness claims checked:
Three-language keys and native review status:
Image assets/license outcomes:
Files changed / added:
No live API/GIS/backend/auth changes (verified how):
Automated tests/commands + outcomes:
Browser keyboard/mobile/a11y/zoom outcomes:
Security/privacy/performance checks:
Defects found → fixed → re-tested:
Unresolved issues and severity:
Docs updated:
Diff/review status:
Proposed checkpoint commit:
PR target when steps 30–34 complete: development
Release main: not authorized / unchanged
Ready for Step 31: YES / NO / PENDING APPROVAL
STOP; waiting for instruction.
```

---

# 16. Explicit out-of-scope / non-goals

Do **not** in Step 30:

- implement InfraMap MapLibre map foundation, base maps, layers, bbox queries or utility networks (Steps 81–91);
- build actual RoadSync conflict detection, spatial candidate search or severity engine (Steps 66–80);
- publish real government roadwork project data or accurate real agency work locations;
- create live public project explorer or citizen complaint map (Steps 128–132);
- build operations dashboard or administrative/inspector screens;
- integrate JWT login, RBAC, approval, AuditLog, API calls or database access;
- add AI summaries, risk scoring, finance totals, real-time notifications or fabricated KPIs;
- copy official government photos, maps, logos or seals without rights;
- change the user's finalized trilingual government-style landing direction;
- perform the broad aesthetic redesign reserved for the end-of-landing polish (Step 34);
- add elaborate GSAP animation or heavy scroll transitions (Step 33 is minimal motion only);
- start Step 31 without separate approval.

**Final instruction:** Implement and verify **Step 30 only** with maximum truthfulness, accessibility, coherence and respect for Git/team ownership. When complete, stop and wait for the user's next step.
