# Batch 2A — Professional visual, typography & trilingual refinement

**Date:** 2026-10-21  
**Branch:** `feature/infraos-connected-future-ui` (local, not pushed)  
**Scope:** Batch 2A revision only — **not** Batch 2B.

## Part A — Analysis (summary)

| Issue (prior 2A) | Correction |
| --- | --- |
| Heavy maroon/dark hero panel | Light warm hero (`#faf6f0`), charcoal type, maroon accent line only |
| Triple photo collage | Single licensed Southern Expressway hero image + credit |
| Long mobile text wall | Photo first on mobile (`max-height: 42vh`), shortened lead, modules removed from hero |
| Dark maroon RoadSync band + nested cards | Light section (`#f8fafc`), white diagram card, 3-step story row |
| 8-day overlap copy | **9 calendar days** (20–28 May inclusive) |
| Desktop hamburger with full nav | Mobile menu `lg:hidden` only |
| si/ta RoadSync English inherit | Dedicated `roadsyncSignature` blocks (draft) |
| Language order | **English · සිංහල · தமிழ்** |

**Typography:** Kept **Geist + Noto Sans Sinhala/Tamil** (no extra display font — avoids load cost). Public scales via `--cf-display-size` / section title clamps; no uppercase/letter-spacing on si/ta eyebrows.

**OpenRouter:** **Not used** (no API approval, no production routes). Static `messages.ts` + glossary doc; native review still required.

**Prompt file:** `Prompts/INFRAOS_Batch_2A_Professional_Visual_Typography_Trilingual_Refinement_Cursor_Prompt.md` was **not present** in the repo at execution time; this work follows the owner message in chat.

## Part B — Implementation highlights

See changed files in Git status. Key: `public-connected-future.css`, `landing-hero.tsx`, `roadsync-coordination-showcase.tsx`, `public-site-header.tsx`, `messages.ts`, `locales.ts`, glossary doc.

## Part C — Verification

Screenshots: `docs/reviews/connected-future/screenshots/refinement-*` (after capture).

**Review blockers:** Native Sinhala/Tamil sign-off; axe/Lighthouse NOT RUN; lower homepage sections still pre-refinement styling.
