# Missing Sinhala / Tamil strings (staff workspace redesign)

These UI strings have **no SI/TA source** in the existing message files. They render in **English** in SI and TA mode.
No translations were invented. Native-speaker translations are needed. Existing SI/TA strings remain drafts pending native review (as the app already states).

| Key / string (EN) | Where | Added in |
|---|---|---|
| Dashboard | sidebar nav (`workspace-nav.ts`) | Phase 5 |
| Work Requests | sidebar nav | Phase 5 |
| Notifications | sidebar nav | Phase 5 |
| Staff | sidebar nav | Phase 5 |
| Profile | sidebar nav, user menu | Phase 5 |
| Settings | sidebar nav, user menu | Phase 5 |
| Overview / Operations / System | sidebar group headings | Phase 5 |
| Sign out, Skip to content, Open/Close navigation, User menu | shell (`staff-workspace-shell.tsx`) | existing, now listed |
| Role names (Agency Officer, …) | user menu (`ROLE_LABELS`) | existing, now listed |
| Demo data / Demo, Provisional, Reported, Unavailable, Withheld + hints | honesty chips (`lib/design/site-plan.ts` `HONESTY_COPY`) | Phase 4 |
| View language (… drafts pending native review) | shell language switch `aria-label` | Phase 5 |
| Status labels except Active / On hold / Delayed: Draft, Submitted, Under review, Rejected, Approved, Completed, Cancelled | status chips, lifecycle line (`dashboardStatusLabel`) | Phase 6 |
| Portfolio lifecycle | dashboard section heading | Phase 6 |
| Projects at each stage. Branches show projects off the main path. | dashboard lifecycle hint | Phase 6 |
| Progress and money | dashboard section heading | Phase 6 |
| Completed by status (dashboard has `completedByStatus` copy, but the new card label is shorter) | dashboard honesty card | Phase 6 |
| Reported 100%, not completed | dashboard honesty card | Phase 6 |
| Workspace / Dashboard | dashboard breadcrumb | Phase 6 |
| As of … | context bar prefix (`ContextBar`) | Phase 4 |
| from {status} | lifecycle branch origin | Phase 6 |
| Off the main path | lifecycle branch list `aria-label` | Phase 6 |
| Lifecycle rail "(passed / current stage / not reached)", "Lifecycle ended here.", "Off the main path." | `LifecycleRail` (not mounted yet) | Phase 4 |
| RoadSync work-request screens (all strings) | `/roadsync/*` | Step 66 |

Strings reused **from existing SI/TA message files** (not new translations): Projects, Reviews (*Project reviews*), Agencies, Roles in the nav; every dashboard string from `dashboard-messages.ts`.
