# Phase 8: Cross-app Site Plan pass

Academic/portfolio project. Screens use synthetic demo data only.

## Scope
The Site Plan shell, workspace language and context bar are now used on all remaining staff pages:
- admin: agencies, roles, users
- profile and settings
- project record sub-pages: milestones, progress, timeline, activity, notices, review
- project create and edit
- the review queue
- the RoadSync list and detail pages

## Changes
- `project-record-nav.tsx` adds shared record tabs and the context bar (breadcrumbs).
- Per-page language toggles were removed. Every page now reads the workspace locale (EN/SI/TA).
- `site-plan-legacy.css` restyles the older `auth-access-*` classes inside `.mc-root` only. Login and public pages are unchanged.
- Each view has one orange (primary) action. Secondary actions are outlined. The admin users search is now outlined.
- RoadSync uses the shared `StatusChip domain="work"`.

## Sweep (local demo, synthetic data)
The sweep covered 19 pages in EN and SI at 1280, 768 and 360 px:
- Every page has exactly one h1 and the `lang` attribute set.
- Breadcrumbs are present and the active tab has `aria-current`.
- No page overflows horizontally and there are no console errors.
- Screenshots are in `screens/phase-8/`.

## Remaining issues
- The milestones project card shows the raw uppercase status, and some of its counts stay in English in SI.
- Admin tables still use the older uppercase role and status pills.
- Density: about 12 of 20 rows are visible at 1280×900.
- Windows Controlled Folder Access intermittently blocks file writes. Retrying works; no setting was changed.

## Data gaps
None new. Unknown values show an honest unavailable state. Financial figures stay Provisional, and Reported 100% is not shown as Completed.
