# Independent review — Public landing Steps 31–32

**Reviewer:** Independent audit (automated + manual spot-check)  
**Date:** 2026-10-20  
**Branch:** `feature/public-landing-enhancements`  
**Integration state:** Step 31 @ `38db03e` (committed, pushed); Step 32 **uncommitted** in working tree  
**Spec:** `Prompts/INFRAOS_Development_Prompts_Steps_31_to_32.md`

## Executive verdict

| Checkpoint | Verdict | Notes |
| --- | --- | --- |
| **Step 31** (trust, FAQ, next steps) | **CONDITIONAL PASS** | Scope correct; gates and manual QA incomplete |
| **Step 32** (footer, info pages) | **CONDITIONAL PASS** | Scope correct; not committed; trilingual body gaps |
| **Future scope (33–34)** | **PASS** | No animation/polish creep detected |
| **Step 33 readiness** | **NOT READY** until Step 32 commit + sign-offs below |

**Overall:** **REQUEST CHANGES** for production-grade approval; **acceptable to continue Step 33 engineering** only if team accepts documented risks and commits Step 32 first.

---

## Approval gates (Steps 30–31)

| Gate | Evidence | Result |
| --- | --- | --- |
| Step 30 implemented | `fc98e14`, `preview-data.test.ts`, static SVG | **Met** |
| Step 30 human sign-off | `step-30-pre-post-review.md` says approval required; no `YES` | **NOT MET** |
| Step 31 implemented | `38db03e`, `landing-trust-faq.test.ts` | **Met** |
| Step 31 owner approval before Step 32 | Spec §4.8; doc says partial only | **NOT MET** (process) |
| Step 32 dependency | Step 31 code exists | **Met** |

---

## Branch and Git safety

| Check | Finding |
| --- | --- |
| Current branch | `feature/public-landing-enhancements` ✓ |
| `origin` sync | Step 31 pushed; **Step 32 only local** (+ untracked prompt files) |
| `git diff --check` | **PASS** (no conflict markers) |
| Dashboard / API / auth | **No changes** in Step 31 commit or Step 32 diff |
| Untracked | `Prompts/*Step_30*`, `Prompts/*Steps_31_to_32*` — team-owned; not staged |

---

## Section order and anchors (Steps 25–31)

Order in `public-home.tsx`: hero → problem → solution → features → lifecycle → audiences → preview → trust → faq → next-steps → footer.

| Anchor | ID | Unique |
| --- | --- | --- |
| Trust | `trust-information` | ✓ |
| FAQ | `faq` | ✓ |
| Next steps | `next-steps` | ✓ |
| Preview | `preview` | ✓ |

Primary nav unchanged (7 items); no `#preview` in nav (by design).

---

## Step 31 acceptance mapping

| Criterion | Status | Evidence |
| --- | --- | --- |
| Honest trust copy | PASS | `trust-information-section.tsx`, `messages.ts` |
| 6–10 FAQ items | PASS | 9 IDs in `faq-items.ts` |
| Native `<details>` FAQ | PASS | `landing-faq-section.tsx` |
| CTAs real only | PASS | `#how-it-works`, `#preview`; no `/login` |
| en/si/ta keys | PASS | `messages.test.ts` |
| Native si/ta quality | **FAIL (sign-off)** | Mixed English in si/ta FAQ/trust; draft note present |
| Browser/axe/zoom | **NOT RUN** | — |

---

## Step 32 acceptance mapping

| Criterion | Status | Evidence |
| --- | --- | --- |
| Semantic footer | PASS | `public-site-footer.tsx` — `<footer>`, `nav` |
| About / Accessibility / Privacy | PASS | 9 routes in build output |
| Contact omitted | PASS | No `/contact` |
| FAQ not duplicated | PASS | Footer → `/{locale}#faq` |
| Photo credits | PASS | Manifest + `/landing/photo-credits.html` |
| Privacy factual | PASS | Code-based; `NEEDS_OWNER_REVIEW` in copy |
| Locale switch on info pages | PASS | `infoSlug` on `PublicLanguageNav` |
| Full si/ta page bodies | **PARTIAL** | `/si/about`: Sinhala title, **English H2/body** (browser snapshot) |
| Step 32 committed | **FAIL (process)** | Working tree dirty |

---

## Findings (severity)

### P1 — Sign-off / content (owner + native speakers)

1. **Sinhala/Tamil completeness** — Info pages use `...en.infoPages.*` for section bodies; `/si/about` and `/ta/about` show English headings and paragraphs under localized titles. FAQ/trust si/ta also mix English. Draft disclaimer exists but spec §3.3/§5.10 expects meaningful parity or explicit limitation.  
   **Reproduction:** Open `http://localhost:3000/si/about`.  
   **Files:** `apps/web/src/lib/landing/messages.ts` (si/ta `infoPages` blocks ~1231+).

2. **Native-speaker review** — `PUBLIC_TRANSLATION_STATUS = "unverified-draft"`. No evidence of proficient si/ta review. **Do not claim native-approved.**

3. **Legal/owner privacy** — Public privacy page includes `NEEDS_OWNER_REVIEW` for retention/subprocessors (appropriate honesty; requires owner acknowledgment before external release).

### P2 — UX / accessibility (should fix before group PR)

4. **Language switch drops hash on homepage** — `PublicLanguageNav` uses `publicHomePath(locale)` only when `infoSlug` is null; user on `/#faq` switching to `/si` loses section context.  
   **Files:** `public-language-nav.tsx` lines 21–22.

5. **Manual keyboard/responsive/axe** — Not executed. FAQ uses native `details` (good); no Playwright/axe in repo.

### P3 — Process / polish

6. **Step 32 not on remote** — Teammates cloning branch miss footer/pages until commit/push.

7. **Duplicate language controls** — Header and footer both expose language links on info pages (consistent state observed; slightly redundant).

8. **Photo credits page** — English HTML only; footer label localized.

9. **External photo link** — Footer uses `<a href="/landing/photo-credits.html">` without `rel`; same-origin static file — low risk.

---

## Claims, privacy, security

| Area | Result |
| --- | --- |
| Government affiliation | **PASS** — banner, footer, trust, tests grep |
| WCAG/certified secure | **PASS** — accessibility page denies certification |
| Fake contact | **PASS** — omitted |
| Analytics/cookies in code | **PASS** — none found in `apps/web/src` |
| GIS preview | **PASS** — illustrative; overlap dates tested |
| App/public boundary | **PASS** — `AppProviders` wraps all pages (pre-existing); public routes server components |
| Hydration | **NOT RUN** — FAQ is server-rendered; mobile nav client-only (pre-existing) |

---

## Toolchain (this review — re-run)

| Command | Result |
| --- | --- |
| `npm run test:web` | **PASS** (93 tests, 23 files) |
| `npm run type-check:web` | **PASS** |
| `npm run lint:web` | **PASS** (0 errors; data-table warning) |
| `npm run build:web` | **PASS** (15 public routes) |
| Browser smoke | **PARTIAL** — `/`, `/about`, `/si/about` loaded on `localhost:3000` |
| axe / zoom / SR | **NOT RUN** |

---

## Fixes applied in this review

**None.** Per instruction: no code changes; no commit/push/PR.

---

## Recommended actions before Step 33 / group PR

1. **Commit and push** Step 32: `feat(landing): add trilingual footer and public information pages`.
2. **Owner/legal:** Confirm privacy `NEEDS_OWNER_REVIEW` wording or redact for public until approved.
3. **Native si/ta:** Translate info page sections (or add visible “English section text” labels on si/ta routes).
4. **Optional engineering:** Preserve hash in language switch on homepage (`publicPathForLocale` + hash).
5. **Manual QA:** Tab order, FAQ expand, 320px/200% zoom, footer links from `/si` and `/ta/privacy`.
6. **Record** formal Step 30/31 approval in review docs if team policy requires it.

---

## Step 33 readiness

| Ready? | Condition |
| --- | --- |
| **Engineering** | Yes — scope 31–32 contained; branch correct |
| **Release / merge** | No — P1 sign-offs, Step 32 commit, manual QA |
| **Risk carry-forward** | Unverified translations, hash locale bug, no axe/SR proof |

**STOP** — Step 33 not started; no merge to `development`/`main`.
