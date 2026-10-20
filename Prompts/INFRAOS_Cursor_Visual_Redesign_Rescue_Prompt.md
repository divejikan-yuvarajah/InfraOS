# INFRAOS — Public Landing Visual Rescue: Genuine Redesign, Not a Reskin

**Use in Cursor Agent after placing this file under `Prompts/`.**  
**Scope:** public landing and its public informational pages only.  
**Status:** owner rejects current look; earlier Civic Atlas direction was approved but the perceived visual result remains essentially unchanged.  
**Approval:** owner requests a visibly new design, not another audit with only spacing/typography edits. Do not auto-commit, push or merge.

## 0. Owner feedback — treat as a blocking design defect

The current public INFRAOS website is too plain, repetitive and visually disconnected. Screenshots provided to the assistant show an oversized mostly empty hero, a small `INFRAOS` text link, a dashed-line/two-dot diagram instead of visual impact, 7 equal-weight navigation links, repeated white/gray cards through problem, solution, features, lifecycle and audience sections, small side photos, and technical explanations rather than compelling storytelling. Some screenshots show dev-only UI fixtures on the homepage. The owner says the subsequent Civic Atlas implementation still looks substantially the same. **Do not argue that passing tests or changing class names constitutes a successful visual redesign.**

The linked repository is `https://github.com/divejikan-yuvarajah/InfraOS.git`. Inspect the actual local checkout, because the external reviewer could not fetch the repo content. Verify current branch, latest commit, staged/unstaged/untracked files, and how/when the previous redesign was integrated; do not assume any claimed commit or visual state is current.

## 1. Visual north star — 'The Connected Landscape'

Design a **memorable civic editorial identity** that feels as polished as a contemporary public infrastructure program, not a generic dashboard template, while clearly disclosing this is a **university demonstration, not an official Sri Lankan government service**.

Three defining visual ideas:

1. **Aerial roads / geographic corridors:** authentic, licensed Sri Lankan infrastructure photography, cropped purposefully with subtle custom route/intersection linework. The photograph, not a basic status-chart rectangle, must anchor the first screen.
2. **One road, two agencies:** a signature original static or lightly interactive illustration that makes the RoadSync scheduling problem instantly understandable; it must depict the *same geography and overlapping work dates*, remain synthetic and include a readable text equivalent. Not just a dashed line and two dots.
3. **A joined network motif:** subtle original route geometry in section dividers and the eight-stage lifecycle, creating brand recognition through composition rather than generic cards, badges and box shadows.

Editorial principles: surprising but disciplined compositions; strong typography; authentic photography; a clear 12-column grid; varying section rhythm; generous **purposeful** whitespace, not vast blank paddings; visual storytelling; clean accessible color; mobile-first behavior.

**Keep national palette:** `#FF5B00` orange brand, `#FEB600` yellow, `#8C1F28` maroon, `#279541` green, `#F8FAFC` neutral canvas, `#FFFFFF` surfaces, `#111827` foreground, `#475569` secondary, `#E2E8F0` borders. Use accessible tonal variants for text/buttons. Maroon and green should retain their conflict/resolved semantics in diagrams and statuses; do not paint all sections in all four colors. A dark ink/neutral background is permissible as a compositional counterweight; do not change internal theme tokens.

## 2. Non-negotiable structural changes

### 2.1 Header / identity
- Replace tiny wordmark with a carefully drawn **original INFRAOS intersection/route monogram SVG** plus legible wordmark (or demonstrably superior typography-only treatment). Do not use government emblems, seals, or third-party logos.
- Reduce desktop primary navigation to **~4 meaningful categories** with descriptive, working anchors. Preserve existing IDs/links and ensure footer/sitemap exposes all sections. Do not hide content merely to reduce menu count.
- English / සිංහල / தமிழ் switcher always visible, properly labeled, and preserving equivalent route where present. Header must work at 320px, 400% zoom and with keyboard/screen reader.
- Keep one unobtrusive university-prototype designation in the visible header/hero and a full factual disclosure in footer. Do not stack multiple distracting disclaimers in every paragraph.

### 2.2 Hero — replace old composition, not re-skin
- **Reject** a left text block next to the previous dashed diagram in a white card.
- Build a strong, editorial **photography-led first fold**: full-width or asymmetric panoramic documentary image of Sri Lankan infrastructure, meaningful crop, high-contrast headline area, original route line detailing, one working primary CTA. May use dark ink overlay or grounded color region to maintain legibility. Keep image license/credits accessible.
- Candidate headline: **'Better infrastructure starts with better coordination.'** Alternative: **'One shared view. Fewer surprises on the ground.'** Localize it; avoid falsely claiming proven outcome or deployment.
- Description: one or two clear sentences about how INFRAOS demonstrates shared project planning and coordination for road and utility works. One compact, accurate demo disclaimer.
- The hero must be visually distinctive on screenshot at desktop and at 375px, never a blank top half or giant text-only strip. Use `next/image`, reserved dimensions, responsive `sizes`, LCP priority only where warranted, and no autoplay video.

### 2.3 Problem → story, not cards
- Replace the grid of near-identical problem cards with a **single coherent visual narrative**: a resurfaced street, planned pipeline work, competing timing, and why early coordination matters. Prefer an editorial photo/text treatment plus one short visual explainer.
- Use concise headings and two or three short explanatory callouts at most. Do not invent affected road names or real government timelines.

### 2.4 Signature RoadSync explainer
- Build a custom accessible corridor/timeline diagram with distinct road and pipeline layers, clear geographic intersection, comparable date windows and visibly highlighted synthetic overlap. If dates are shown, keep them consistent in the legend and explanation. SVG and CSS are sufficient; no live map engine or network calls.
- Introduce it with a bold section headline such as **'Two projects. One stretch of road. A decision that cannot wait.'**
- Include 'Illustrative scenario — synthetic data, not a live detected conflict' near the visual. Use meaningful shape/labels, not color alone. Never claim AI determines truth or approvals; human agencies review.
- On mobile switch to a vertically readable sequence/stacked comparison, preserving every label.

### 2.5 Capabilities
- Give **ProjectTrace and RoadSync** two substantial *asymmetric editorial* panels or photo+diagram treatments, differentiated by function. Avoid another 2-column white-card grid.
- Put planned InfraMap, inspections/assets and citizen information capabilities in a compact clearly marked roadmap/list rather than selling them as operational services. Do not route to fake pages.

### 2.6 Eight-stage lifecycle
- Replace eight box cards with one **connected route / station visual**: Plan → Coordinate → Approve → Build → Verify → Monitor → Complete → Maintain. Use semantic ordered-list HTML with CSS/SVG decoration and responsive wrapping; stacked readable sequence on mobile. No forced horizontal scroll, no animation dependency.
- Show stage descriptions in concise format and keep clear distinction between *proposed process* and real operational implementation.

### 2.7 GIS/product preview and audiences
- Preserve an illustrative (not live) GIS/product preview, but put it in a wide composed section with a map-inspired artwork or **verified screenshot** and clear caption. No fake live maps or raw operational data.
- Differentiate audience journeys with useful, concise content and in-page links for public visitors, agency staff, officials and administrators. Avoid adding a fake staff-login CTA if no valid destination exists. Do not turn audiences into four more anonymous cards.

### 2.8 FAQ, supporting pages, footer
- Collapse long marketing paragraphs to readable FAQ and supporting info; the lower page should feel like an intentional concluding scene, not a documentation dump.
- Use a distinctive footer color/typography layout with working links, photo credits, accessibility/privacy and locale options. Preserve accurate university affiliation only when verified.
- If UI foundation fixtures are mounted on the public home, remove that mount **only** and preserve their separate testing infrastructure. Next.js dev toolbar is not a site-design component; don't style/remove it to claim a fix.

## 3. Design system rules

- Public-only component variants and CSS namespace. Do not rewrite shared shadcn tokens that would break dashboards.
- Avoid repeated card radius, borders and shadows; use at most a few bordered boxes where they materially communicate grouped info. Mix editorial columns, edge-to-edge photography, section-wide visual compositions and constrained text.
- Define clear type hierarchy using the project's existing typefaces unless a justified, font-licensed upgrade is truly needed. Verify Sinhala and Tamil fallback fonts and wrapping independently.
- Use more decisive spatial rhythm: each major section must have a reason to be different from the preceding section; no four consecutive repeated card grids.
- Keep purposeful color contrast, no illegible orange-on-white or yellow-on-white text, no inaccessible image-over-text.
- Animations should be optional and subtle, disabled/reduced with `prefers-reduced-motion`. Static presentation must look excellent.
- Use real infrastructure photography only with per-image license checks and attribution manifest. No random copyrighted images from search engines; no invented official partnerships.

## 4. Mandatory visual process — do not skip

### Phase A: Baseline and diagnosis (read-only)
1. Inspect `development` and active worktree/branch safety. Check branch is not already merged; do not rebase/reset/stash/delete uncommitted files. Choose **one** safely approved corrective feature branch if necessary, e.g. `feature/public-landing-visual-rescue`, from latest reviewed `development`. If checkout unsafe, STOP and ask owner.
2. Read actual public route composition and components (`public-home`, `landing-hero`, `public-site-header`, `platform-features-section`, etc. where they exist), public CSS, dictionaries, images/licenses, and tests.
3. Run app and capture **baseline screenshots** for `/`, `/si`, `/ta` at 375, 768, 1440 widths; record routes and viewport size; capture with Playwright if tools available. If browser unavailable, mark NOT RUN and request means of verification instead of claiming redesign.
4. Record top 10 visual defects with affected components, impact and proposed replacement composition. Explicitly compare to owner's screenshots. Preserve every functional link/anchor in a route/anchor inventory.

### Phase B: Actual art-direction prototype
5. Implement a small **vertical slice** — new header/brand + photography-led hero + one original RoadSync explainer — in code, not only prose. This project already approved an editorial Civic Atlas-like direction; do not ask the owner to choose A vs B again.
6. Capture before/after desktop/mobile screenshots of the working prototype. Present them with a concise rationale. **Pause for owner visual approval before rewriting all remaining sections**. This is a visual approval gate, not authorization to merge.
7. If owner says it still looks like the old site, revise the composition before proceeding. Cosmetic adjustments cannot pass this gate.

### Phase C: Complete public redesign after visual approval
8. Implement new layouts for all public homepage sections described in §2, grouped as: narrative; capabilities/lifecycle; GIS/audiences; support/footer. Retain actual working URLs, anchor IDs, data honesty and locale routes. Do not touch internal dashboards, auth, Express API, MongoDB, AI or operational GIS.
9. Add independent focused tests on navigation, three locales, responsive layout semantics, component state where needed, and content/demo disclaimers.
10. Verify no repeated card-grid succession remains and that the hero/overlap diagram provide the defining visual identity at desktop and mobile.

### Phase D: Quality and evidence
11. Run actual repo test, lint, typecheck and build scripts. Use available browser automation to check 320/375/390/768/1024/1440/1920px, three locale routes, 200/400% zoom/reflow, keyboard/focus, headings, anchor scroll, responsive images, content overflow, Reduced Motion and axe. Record PASS/FAIL/NOT RUN honestly.
12. Verify license source URLs, creators, license versions, attribution, image optimization, public SEO/metadata, text contrast and no accidental exposure of private app data.
13. Arrange explicit human native-speaker review for Sinhala/Tamil; AI output alone is unverified. Do not label translations approved without it.
14. Conduct independent design/architecture/security/accessibility review. Fix in-scope defects and rerun checks. Review public and internal regression smoke checks.
15. Capture **final before/after screenshot pairs** for three languages at mobile and desktop; store review artifacts under existing `docs/reviews/` conventions. Annotate each major visual change and confirm visibly changed composition; don't claim arbitrary percentage improvements unsupported by measurement.

## 5. Failure criteria

Do not present the project as visually redesigned if ANY of the following persist:

- Hero still consists primarily of previous narrow text+small white dashed-line diagram/card.
- More than two major sections in succession reuse essentially the same card-grid presentation.
- Brand remains an undifferentiated tiny text link with no stronger hierarchy.
- Hero has no compelling licensed, appropriately placed infrastructure imagery without an explicit justified owner-approved exception.
- Desktop nav remains crowded with seven equally weighted links.
- Language layouts overflow or visually collapse.
- Screenshot evidence is missing but output claims visual testing passed.
- The implementation changes internal app/dashboard screens, misstates government affiliation, or invents working backend services.

## 6. Git safety and final handoff

Document each batch review; never auto-commit/push/merge. Verify staged/unstaged/untracked and potential leaked secrets. Prepare suggested commit `style(landing): rebuild INFRAOS public visual storytelling`, and a PR plan to `development` after owner's approval. Any `development` → `main` update requires separate release approval. Do not start Step 35.

## 7. Required response from Cursor

Return: baseline Git and component audit; before/after hero prototype screenshots; owner approval checkpoint; exact code/asset changes; links and locale coverage; image license manifest; visual defect closure; tests and manual QA outcomes; unresolved issues; Git status and approval needed. Prioritize **what the visitor actually sees** over a list of files changed.
