# 06 — Phase 7: Projects list and project record page

## What changed
- **Project record page** (`/projects/[id]/overview`):
  - identity header (code, title, type and agency tags, manager, status chip) with the lifecycle rail (S1/S2);
  - section tabs, using the same routes the old button rows linked to; Timeline and Activity keep their role gate;
  - facts as labelled rows (schedule, place); the lifecycle actions in one panel; Edit draft and Review links kept;
  - the old status notes (draft, waiting for review, rejected, decision reason) kept as a note strip.
- **Dual progress (S3)** on the record page:
  - Physical side is always `Reported`; financial side is always `Provisional`.
  - The financial value is the API's own ratio from `/financial-progress`. A 403 shows `Withheld`; any other failure or an "unavailable" summary shows `Unavailable`. An overrun shows its real figure plus an "over budget" flag, never a capped 100%.
  - The draft budget heading carries a `Provisional` chip.
- **Projects list** (`/projects`):
  - context bar with the primary "Create project" action (orange, one per view);
  - filter bar; the count; a Comfortable / Compact density switch;
  - code, title, a neutral type tag, a status chip with the route-line node, plain dates (no ISO slicing).
- **Shared `DataTable`** got an optional `density` prop. Without it, nothing changes (the review queue is untouched).
- The per-page language buttons are removed on these two pages; the shell switch drives them.

## Data honesty
- Every figure is an existing API field. No trends, no invented values.
- Financial "0%" on the demo record is the API's real answer (no paid rows), shown as Provisional.
- Not added (no API support): per-row progress mini-bars on the list. The list payload has no progress fields, so none were drawn.

## Bugs found by the visual check, and fixed
1. **Record page overflowed sideways at 360 px** (English and Sinhala). The six-step rail forced the identity card wider than the screen. The card's grid children can now shrink, so the rail scrolls inside its own box.
2. **Inconsistent table headers**: "Agency" was uppercase while the sortable headers were not. All headers are now sentence case.

## Density test (section 6.1), run for real this phase
Demo data: 22 fictional projects. Chrome headless at 1280×900, page size 20.

| Measure | Result |
|---|---|
| Compact: 20 rows, average row height | **36.0 px** (token `--sp-row-compact`) |
| Comfortable average row height | **48.0 px** (token `--sp-row-comfortable`) |
| Table body height for 20 rows (compact) | about 720 px |
| Last row bottom, compact, from page top | 1193 px |
| 20 rows visible without scrolling at 900 px | **No.** The first 12 rows are in the first screen (see `projects-compact-en-1280.png`); the filters and header take about 440 px above the table. |

**Verdict: pass with a note.** Compact fits 20 project rows in about 720 px, versus about 960 px for comfortable. A full screen of 12 rows at 1280×900 is scannable, but it isn't all 20 at once. The earlier Phase 3 target was "20 without scrolling". It is not met at 900 px height, and I am not claiming it. A taller window (1080 px) would show about 16.

## Responsive and i18n
- Projects list and record page, English and Sinhala, at 1280, 768 and 360 px: **no horizontal page overflow in all 12 cases** (after fix 1).
- New or still-English strings are in `i18n-missing.md`. The Sinhala screenshots show the existing English fallbacks (lifecycle panel, pagination).

## Screenshots
`docs/design/screens/phase-7/`: `projects-compact-en-1280`, `projects-{en,si}-{1280,768,360}`, `record-{en,si}-{1280,768,360}`.

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit --incremental false` (web) | exit 0 |
| `npx eslint` (9 changed TS/TSX files) | exit 0, 1 old warning in `data-table.tsx` (TanStack, unrelated) |
| `npm run test -w @infraos/web -- src/lib/design src/lib/projects` | 19 files, 84 tests passed (before the CSS-only fixes) |
| Browser | as above; only console error is the pre-login refresh 401 |

**Environment note:** midway through, Windows Controlled Folder Access briefly blocked new-file creation by shell tools, which broke `next typegen` and the dev server. It cleared on its own; no setting was changed. `type-check:web` (which runs `next typegen`) was not re-run after the fix; `tsc` directly was.

**Deferred:** full suites, build and full lint (end of the redesign). Keyboard-only walkthrough (cross-app pass).
