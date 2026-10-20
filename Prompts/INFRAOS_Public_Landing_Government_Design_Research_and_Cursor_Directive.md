# INFRAOS — Public Landing Page: Sri Lankan Government-Site Research & Design Directive

**Date:** 2026-10-20  
**Scope:** Public-facing marketing/information/entry pages ONLY  
**Current project checkpoint:** Steps 25 and 26 completed, as reported by project owner; implementation/merge details to be verified in repository  
**Next planned group:** Steps 27–29 on shared branch `feature/public-landing-core`  
**Later landing group:** Steps 30–34 on `feature/public-landing-enhancements` only when needed and authorized  
**Explicit exclusion:** All internal admin dashboards, ProjectTrace/RoadSync/InfraMap operational pages, finance/inspection/AI screens and protected feature workflows remain on their previously approved enterprise design system.

> This is research-led design guidance drawn from a **representative sample**, not an exhaustive audit of every Sri Lankan or global government agency website. Review the websites again during implementation, and treat their live content/appearance as changing over time. These references are **examples and patterns**, not permission to use their logos or copy their photographs.

---

## 1 — Decision locked by project owner

The public INFRAOS landing page should feel like a credible, practical **Sri Lankan public information/service portal**, not an elaborate SaaS product-launch website.

**Non-negotiable:**
- Minimal, calm, accessible layout with recognizable public-service structure.
- Public landing interface and substantive content in all three languages: **English (`en`), Sinhala (`si`) and Tamil (`ta`)**.
- Real, relevant Sri Lankan infrastructure photography only where licensed/approved for reuse; not automatically scraped from government websites.
- No automatic carousels, autoplay videos, parallax, decorative particle effects or intrusive animated transitions.
- Audience-neutral access for everyone: citizens, local communities, officers, government administrators and staff.
- Obvious, separate **Staff / Officer Sign in** that never discloses protected routes/data before authentication.
- Keep existing approved brand palette and professional neutral UI; do not imitate an official government domain, emblem, ministry seal or affiliation.
- No changes to authenticated dashboard, project tools or internal design-system architecture.
- Preserve the completed Step 25 and Step 26 functionality and tests. Adjust only the public landing where a demonstrated gap exists.
- Do not reopen broad architecture decisions or create a new branch just to apply this direction; use the existing shared landing branch according to team Git safety checks.

### Approved brand values

| Role | Brand hex | Public site usage |
|---|---|---|
| Orange | `#FF5B00` | Brand identity, restrained CTA or line/section highlight |
| Yellow | `#FEB600` | Small highlights, announcements requiring attention |
| Maroon | `#8C1F28` | Official-feeling accent, critical notice (only real critical notice) |
| Green | `#279541` | Positive status, relevant action success |
| Canvas | `#F8FAFC` | Overall pale background |
| Surface | `#FFFFFF` | Header, page, simple section surfaces |
| Text | `#111827` | Primary body/headings |
| Secondary | `#475569` | Secondary text |
| Muted | `#64748B` | Auxiliary labels |
| Border | `#E2E8F0` | Subtle separation |

Use accessible foreground variants from Steps 17–18: don't assume ordinary white text on raw orange/green or yellow-on-white passes contrast. No rainbow stripe repeated across every panel.

---

## 2 — Reviewed government website references

The following publicly accessible websites were reviewed for current navigation/content patterns (research date 2026-10-20). Some sites update frequently and page details may change.

| Reference | URL | Observed design/content patterns to learn from | What INFRAOS should avoid copying |
|---|---|---|---|
| Sri Lanka national government portal | https://www.gov.lk/ | Information/services categories, search, links to agencies, Sinhala and Tamil navigation | Overly dense directories and any suggestion INFRAOS is itself the official national portal |
| Road Development Authority | https://www.rda.gov.lk/index.php?lang=en | Services, road developments, publications, staff login, Sinhala and Tamil access | Copying RDA branding, real project claims or overwhelming navigation |
| National Water Supply & Drainage Board | https://www.waterboard.lk/ | New/existing customer areas, public complaints, projects, latest news, notices, contact | Too many homepage blocks or live service widgets that INFRAOS does not implement |
| Ceylon Electricity Board | https://ceb.lk/home/signin/en/ | New/existing customer task groups, public service links, media and news | Copying payment flows or suggesting live service integration |
| Sri Lanka Department of Immigration and Emigration | https://www.immigration.gov.lk/ | Strong visible Sinhala/Tamil/English welcome and translated navigation | Three separate language-only splash pages if they become a needless extra click; favor direct localized content |
| Sri Lanka Ministry of Health | https://www.health.gov.lk/home/ | Institutional introduction, official updates, publications, contact and multiple languages | Minister names, government logos, claims of actual affiliation |
| Sri Lanka ICTA | https://icta.lk/ | Relatively modern institutional design, useful public consultation/news, official documents and reports | Glossy marketing treatment at the expense of public task clarity |
| GOV.UK | https://www.gov.uk/ | Clear search/tasks, straightforward headings, content-first navigation | Copying British government branding |
| GOV.UK Design System | https://design-system.service.gov.uk/ | Simple page structures, language navigation, accessible interactions | Importing GOV.UK code/branding instead of existing Next/shadcn stack |
| US Web Design System | https://designsystem.digital.gov/ | Accessibility, trust, consistency, plain language and inclusive design | Adding an unrelated UI framework just for visual styling |
| Singapore gov.sg | https://www.gov.sg/ | Public information with relevant real-life imagery, institutional articles and clear links | Unverified policy text, branding or fake live statistics |

Supporting design-system guidance:
- GOV.UK Homepage: https://design-guide.publishing.service.gov.uk/frontend-templates/homepage/
- GOV.UK Language Navigation: https://design-system.service.gov.uk/components/language-navigation/
- USWDS Design Principles: https://designsystem.digital.gov/design-principles/
- Home Office image guidance: https://design.homeoffice.gov.uk/design-system/styles/images
- USWDS accessibility: https://designsystem.digital.gov/documentation/accessibility/

**Finding:** Actual government sites vary, but successful patterns emphasize identifiable purpose, languages, information hierarchy, services, news/notices and public contact pathways. Global design systems reinforce task-first layouts and accessible multilingual navigation. Don't assume that every government site is simple, accessible or automatically ideal: curate the best patterns.

---

## 3 — Audience model: one public site for everyone

| Audience | Arrives to do | Appropriate homepage path | Authentication gate |
|---|---|---|---|
| Citizen/local resident | Find projects, understand construction impacts, report an infrastructure concern | Public projects, public map, citizen issue reporting **only if actually implemented** | Public read-only pages may require no login; reporting route requirements decided in later Citizen phase |
| Road/water/electricity/telecom officer | Understand platform, access assigned work | Clear `Staff / Officer Sign in` entry | All agency coordination/data access behind actual backend auth/RBAC |
| Administrator | Understand platform, sign in to manage authorized agencies and users | Same sign-in; no public link exposing internal admin data | Server-side roles/agency/resource assignments govern permissions |
| Inspector/contractor/staff | Understand platform and reach designated work tools | Staff login, help/instructions | No dummy accounts or unsafe shortcuts |
| General visitor/student | Read about purpose, workflow, features and contact | About, how it works, public information, contact/help | Anonymous pages only |

Do not display a large role-picker that makes every visitor choose an identity before accessing public content. Avoid showing inactive internal links as though features are live. Where a feature is planned but not implemented, link only to an accurate informational anchor or omit the action. There is no real login until the authentication phase; avoid dead-end fake buttons.

---

## 4 — Recommended homepage information architecture

### Compact text wireframe

```text
[Utility header: INFRAOS public demonstration label]       [සිංහල] [தமிழ்] [English]
[INFRAOS text logo]    About | How It Works | Projects* | Notices* | Contact    [Staff Sign in*]
────────────────────────────────────────────────────────────────────────────────────
[One short, readable title and introduction]           [ONE genuine local road/water
"Coordinating Sri Lanka's infrastructure."            project photo, with source credit]
"A shared approach to planning, coordination and public information."
[How INFRAOS Works]   [Public Projects*]

[Quick access to useful information — max 3–4 options]
  Project information* | Coordination approach | Citizen information* | Staff access*

[Why coordination matters]
  Short problem explanation (repeated excavation / overlapping schedules / transparency)

[How the platform helps]
  Plan → Identify overlapping works → Coordinate → Track → Verify
  A restrained text/diagram representation; no complex mock dashboard required

[Relevant infrastructure photography — up to 2–3 supporting photos, where licensed]

[Public notices / project updates*]     Only if source is implemented and safe
[About the platform]                   Clear research/demo disclosure
[Contacts / help / official status]    Only verified contact methods

[Footer: INFRAOS | About | Accessibility | Languages | Privacy | Contact]
[Disclosure: university GovTech project / simulated dataset; not official government service]
```

`*` Show as a working action only when there is a verified, implemented destination. Until then, provide explanatory information or omit the link.

### Page structure prioritization

**Above the fold:** Brand, language switch, public navigation, purpose, primary task paths, one real infrastructure photograph. The user should understand the purpose in seconds.

**Middle:** Problem/solution from existing Step 26, simple features/lifecycle and role-oriented help from Steps 27–29, modest supporting imagery.

**Lower:** Genuine news/notices *only when a safe, real data source exists*. Otherwise factual help/FAQ and project/demo clarification. Footer with privacy/contact/accessibility and demo status.

**Navigation:** No nested megamenu or large flyout for a small student project. One level of links, responsive menu, transparent destinations. Sticky header optional only if it does not consume a large portion of a mobile screen.

---

## 5 — Full public landing localization: en / si / ta

**The language switch must change the entire public landing experience**: hero headings, navigation labels, explanation, feature names, CTAs, forms/help if present, alt text, page title/meta descriptions, notices (if published in that language), footer and the user-facing demo disclosure. Do not merely change language names while leaving English content.

**Recommended route pattern (check existing architecture first):**

```text
/en             English
/si             සිංහල
/ta             தமிழ்
/en/about       /si/about         /ta/about      only for real public pages
```

Keep one canonical logical page with dictionary content per locale. Use the current Next.js App Router implementation; choose appropriate routing integration after examining actual installed dependencies. Avoid introducing another i18n service or library when static dictionaries and a few routes suffice.

**Internationalization specifics:**
- Native-script chooser labels: `සිංහල`, `தமிழ்`, `English`.
- HTML `lang="si"`, `lang="ta"`, `lang="en"` on their respective localized pages; use segment-level `lang` for embedded foreign-language text.
- Corresponding `hreflang`/alternate canonical URLs for localized public pages and appropriate metadata.
- Preserve the same page/section context across language switches; maintain accessible current-language indication and keyboard navigation.
- Avoid forcing a language based on IP/identity. Default can be English or the app's explicit locale choice, but all languages remain equally easy to select.
- Translation dictionaries must share the same keys and support tests for missing keys; no silent English fallbacks disguised as complete translation.
- Correct font coverage: check selected font actually supports Sinhala and Tamil; use suitable `Noto Sans Sinhala` and `Noto Sans Tamil` or verified comparable fonts/fallbacks. Test glyph shapes, line-height and diacritics, not only the Latin interface.
- Accommodate longer translations (no hardcoded English-width buttons, avoid tiny type, verify 320/375px mobile).
- Ensure date formats, numbers and LKR presentation are understandable. Don't add translation to protected dashboards without a separate later decision.
- Use professional human validation/native-speaker review for translations. AI draft translations may be useful but must be identified as unverified drafts; don't claim verified localization until approved.
- Existing routes must not break; introduce rewrite/redirect strategy carefully and test old links/anchors.
- No automatic Google Translate widget as a substitute for proper localization or as a secret external data dependency.
- Translation work belongs solely to the public website unless otherwise authorized.

---

## 6 — Real photography: safe acquisition and UX policy

Photographs should be **real and related to Sri Lankan infrastructure**, without implying they depict an actual INFRAOS-managed project.

**Preferred subjects:**
1. Sri Lankan road construction, resurfacing or maintenance with visible real-world context.
2. Water-supply/pipeline work or infrastructure maintenance.
3. Municipal construction planning or workers at a road site.
4. Bridge, road junction or utility-infrastructure view relevant to coordination.

**Asset policy:**
- Use user/team-owned images, explicitly licensed stock images, government images only when reuse rights permit, or Creative Commons photographs with compatible terms and proper attribution.
- Do not download/scrape images from government websites, Google image results or social posts simply because they are publicly visible.
- Track `source URL`, `photographer/owner`, `license/permission`, `attribution`, `date obtained`, `cropping/adaptation permission`, `alt text`, and an honest location/subject caption (when known).
- Never forge government institutional seals, edited 'official' photos, or show fabricated officials/agencies.
- Put approved optimized images in the project's asset directory or configured storage, not fragile third-party hotlinks. Use Next.js `Image` and appropriate `sizes`, width/height, responsive crop, compression and lazy loading below fold.
- Hero: **one** strong photograph (not a carousel). Support images: usually **two or three** small ones if they help understanding. Photograph plus readable adjacent text; avoid putting long hero text on an image.
- Alternative text should convey the informative scene; decorative images should use empty alt text. Don't write 'official government site' as alt text.
- Do not use random people stock shots, generic skyscraper renders, AI-generated infrastructure photos falsely described as genuine, or photographs from countries outside Sri Lanka without disclosure.
- If approved local imagery is not available, keep existing legitimate imagery/neutral background and present an image sourcing TODO with responsible owner. Do not substitute an unlicensed image just to meet a visual target.

**Design guidance:** UK government image guidance cautions against unnecessary decoration and recommends relevant, people-aware, naturally presented, accessible photography with verified usage rights. Source: https://design.homeoffice.gov.uk/design-system/styles/images

---

## 7 — Public-only motion and visual constraints

| Item | Decision |
|---|---|
| Automatic carousels | Do not add |
| Autoplay background videos | Do not add |
| Parallax/3D/GPU particle backgrounds | Do not add |
| GSAP timelines/split-text intros | Avoid for public landing; Step 33 only if a small documented interaction genuinely improves comprehension |
| Transitions | Very subtle CSS transitions for hover/focus/menu state; none required for content reveal |
| Motion preferences | Respect `prefers-reduced-motion` |
| Photos | Real, licensed, relevant, well-compressed, non-decorative |
| Icons | Restrained, recognizable, ideally used only with text |
| Borders/radii | Modest, existing Step 17/18 tokens |
| Content | Plain language; no unverifiable ROI numbers or live-project claims |
| Hero | Service introduction with one clear title/description/CTA group |
| Staff/login | Separate real route when implemented; never pretend auth already exists |

**Important change to future Step 33:** Keep the original Step number, but interpret it as **landing interaction/motion quality and reduced-motion auditing** rather than a requirement to make every section animate. Minimal or no GSAP is the preferred outcome if it serves users better.

---

## 8 — Correct treatment of public trust and legal/demo status

INFRAOS is a **university GovTech project** unless formal public-agency ownership has been verified. Never label it the 'Official National Infrastructure Portal' or a government-operated website. Avoid unauthorized state emblems, flags presented as seals, `.gov.lk` domain claims, or ministry partner logos.

Recommended honest, unobtrusive disclosure:

> INFRAOS is a university-developed infrastructure coordination demonstration. Project information shown for demonstration may be synthetic and does not represent official government records.

Translate disclosure accurately into `en`, `si`, `ta` once reviewed. Don't present a fake Ministry contact number, an official emergency hotline or a 'Live roadworks' status unless a real authorized source is connected. Provide verified developer/team contact information only when approved.

Security requirements for anonymous public site: no internal dashboard data in HTML payload; route links not used as an authorization substitute; no live protected API calls unless public projection/authorization exists; no tracking scripts or external image requests without consent/policy; treat localization parameters as allowlisted (`en|si|ta`) and escape any user-supplied public query strings.

---

## 9 — Implementation plan after Steps 25–26

**Reported current status:** User says Steps 25–26 complete. Do not reimplement them from scratch. First inspect current public UI and list the smallest concrete changes to fit the new policy. Branch policy remains `feature/public-landing-core` for Steps 25–29.

**Within the shared landing branch:**

1. Read Git branch/status, exact Step 25–26 changes, current landing layouts/routes, components, tests, previous Step 24 accessibility guidance and existing translations/assets. Preserve untracked teammate files.
2. Prepare small **Step 25–26 public landing alignment review** (no broad rework): header language switch, honest login CTA, service-first hero, photo licensing, reduced animation, old anchor compatibility. Fix only necessary issues with a clearly reviewed checkpoint.
3. Execute **Step 27** with this policy: concise, factual feature/service overview, translated and task-first; no card overload.
4. Execute **Step 28**: short infrastructure lifecycle explained for nontechnical people; no giant animated diagram.
5. Execute **Step 29**: audience benefits/service access for citizen/officer/admin/staff with no unimplemented or unauthorized destinations.
6. Full **group review**: three locale pages, routes, 320/375/768/1280 widths, keyboard and screen readers, image licenses, mobile page performance, tests/build, unchanged dashboard styling, honest demo claims.
7. Prepare PR to `development` after approval. No automatic `main` merge. Do not invent Step 30–34 as completed.

**Later Steps 30–34** remain separate landing enhancements and must respect the same minimal public-facing government style. Step 30 preview should be static or a clearly labeled product illustration/screenshot of *actual implemented code*, not a simulated live map. Step 33 animation defaults to near-zero. Step 34 checks trilingual responsive polish and accessibility.

**Avoid a new branch solely for revision.** If `feature/public-landing-core` is already closed/merged, inspect history and follow team-approved corrective branch/PR policy rather than rewriting merged history or reusing a deleted branch blindly.

---

## 10 — Acceptance matrix

| Test | Acceptance |
|---|---|
| Existing Step 25–26 pages | Functionality preserved; minimal scoped refinements only |
| Public vs internal | Landing changes do not restyle or break dashboards/operational pages |
| Locale menu | English, Sinhala, Tamil visible and accessible on mobile + desktop |
| Translation completeness | All **implemented public pages** translated or honestly marked blocked; no pseudo-complete language toggle |
| Language metadata | HTML lang, route stability, hreflang/canonical where appropriate |
| Native-script QA | Sinhala/Tamil diacritics, heading wrapping, font loading/fallback, 200% zoom |
| Hero/imagery | One relevant, licensed photograph when available; source record and text alternative |
| Public audience | Citizens, officers, admins, staff can find an honest next step; no identity required for public overview |
| Notices/metrics | Only implemented real public data, or clearly synthetic demo with labels |
| Accessibility | WCAG 2.2 AA targeted; semantic landmarks, focus, contrast, alt, mobile menu, reduced motion |
| Performance | Responsive next/image handling, no heavy animation dependencies added, measure bundle changes |
| Risk | No misleading government endorsement, unverified stats, fake links or public sensitive API data |
| Git | Same approved shared branch, step-level review and test checkpoints, PR only at group completion unless authorized |

---

## 11 — Ready-to-paste Cursor Agent direction (read and apply to PUBLIC landing ONLY)

```text
You are INFRAOS's Government Digital Service UX Reviewer, Sri Lankan Trilingual Localization Engineer, Next.js/TypeScript Frontend Engineer, Public Accessibility/Performance Reviewer and Git Integration Lead.

IMPORTANT CHANGE REQUEST: The project owner has completed Steps 25–26 and has clarified the desired style for INFRAOS public pages. The public landing must resemble a credible, service-first Sri Lankan institutional website, not a SaaS startup landing page. Public pages must support English (en), Sinhala (si) and Tamil (ta), use relevant real photos only with verified reuse permission, and avoid complex animations. DO NOT change dashboard, GIS, authentication, or internal app UI styles.

FIRST READ THE ENTIRE APPROVED DESIGN BRIEF:
  docs/design/INFRAOS_Public_Landing_Government_Design_Research_and_Cursor_Directive.md
Also inspect the actual Step 25–26 implementation and previous approved project architecture and design tokens. If the brief is installed elsewhere, use the actual path; never claim to have read a missing file.

Stage A — READ-ONLY PRE-REVIEW:
Check Git branch, status, remotes, untracked/teammate files and whether `feature/public-landing-core` already exists or has merged. Inspect current public routes/layout, navigation/hero/problem/solution sections, images, animation packages, translation strategy, Next.js locale routing and available tests. Compare actual pages against the design brief. Report precise deficiencies and small proposed changes without assuming missing features exist.

Stage B — BRANCH SAFETY:
Use existing `feature/public-landing-core` for Steps 25–29 if safe and still open. Do not create new step branches. If already merged, don't recreate/rewrite its history; report the correct small corrective PR route for approval. Do not reset/stash teammates' work, commit/push/merge without explicit authorization.

Stage C — LANDING-ONLY IMPROVEMENT:
Preserve completed Steps 25–26 but apply targeted changes for calm public service layout, limited navigation, practical CTAs, visible trilingual selector, accurate page content in en/si/ta and one genuine locally relevant properly licensed hero photograph if available. Use existing Next.js/Tailwind/shadcn design tokens. Never copy official logos or falsely claim government operation. Avoid heavy GSAP/carousels/autoplay/particle effects. Don't turn public website into internal dashboard.

Stage D — MULTILINGUAL QUALITY:
Ensure all implemented public content is truly localized (including navigation/footer/alt/meta/demo disclaimer), correct html lang/hreflang, accessible language switching and locale persistence, font coverage for Sinhala/Tamil, no text clipping on mobile and accurate route/anchor retention. Treat AI translations as draft pending native-speaker review, never as certified translations.

Stage E — VALIDATION:
Verify images have documented owner/license/permission/attribution, no broken links, no fake staff login or project feeds, no private data leakage. Run existing lint/typecheck/tests/build, keyboard/axe checks if available, 320/375/768/1280px plus 200% zoom review and real browser console. Record PASS/FAIL/NOT RUN. Fix scoped issues and rerun tests. Ensure operational dashboard appearance remains unchanged.

Stage F — HANDOFF:
Update docs/design public landing decisions, locale matrix, approved imagery manifest and Step 25–26 scoped corrections. Review Git diff/untracked files. Prepare a step checkpoint and a proposed PR path to development following team approval. Do not auto-commit/push/merge. Then STOP, unless the owner separately authorizes execution of Step 27.

FINAL REPORT: Actual files changed; inspected Step 25–26 state; language completeness for en/si/ta; photo licenses; visual/a11y QA; animations removed; link/route truthfulness; no internal UI regression; tests; Git status; remaining translator/image/branch approvals; Step 27 readiness. Do not implement Step 27 automatically.
```

---

## 12 — Suggested future public-facing content shape (English source copy ONLY)

**Header:** `INFRAOS | About | How It Works | Public Information | Contact | Staff Sign in | සිංහල | தமிழ் | English`

**Hero:**

> Coordinating infrastructure work for better communities.
>
> INFRAOS demonstrates how infrastructure projects can be planned, reviewed and coordinated to reduce overlapping road and utility work and support clearer public information.

**Supporting text:**

> Infrastructure development involves road agencies, water suppliers, electricity providers and other services. When schedules and locations overlap without coordination, the public can experience repeated digging, delays and avoidable disruption.

**Solution:**

> INFRAOS brings project information and proposed work schedules into one coordinated view. RoadSync can identify potential location-and-time conflicts using explainable rules, while ProjectTrace helps track milestones and responsibilities.

**Public disclosure:**

> University-developed demonstration platform. Example project data may be synthetic and is not an official government record.

**Caution:** These are optional editorial examples, not verified copy for official public deployment, and not translated Sinhala/Tamil text. Ask native speakers to review actual translations rather than having the coding agent guess nuanced government terminology.

---

## 13 — Sources consulted (reference links, not reused content)

1. Sri Lanka national portal: https://www.gov.lk/
2. Sri Lanka RDA: https://www.rda.gov.lk/index.php?lang=en
3. NWSDB: https://www.waterboard.lk/
4. CEB: https://ceb.lk/home/signin/en/
5. Department of Immigration: https://www.immigration.gov.lk/
6. Ministry of Health: https://www.health.gov.lk/home/
7. ICTA: https://icta.lk/
8. GOV.UK: https://www.gov.uk/
9. Singapore: https://www.gov.sg/
10. GOV.UK homepage design guide: https://design-guide.publishing.service.gov.uk/frontend-templates/homepage/
11. GOV.UK language navigation: https://design-system.service.gov.uk/components/language-navigation/
12. USWDS principles: https://designsystem.digital.gov/design-principles/
13. Home Office image policy: https://design.homeoffice.gov.uk/design-system/styles/images
14. USWDS accessibility: https://designsystem.digital.gov/documentation/accessibility/

**End of brief — this is a public landing directive only.**
