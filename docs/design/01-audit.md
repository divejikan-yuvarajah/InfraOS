# 01 — Internal audit (Phase 1)

Branch `feature/platform-redesign` (from `feature/roadsync-work-requests` @ `8e282b8`). Date: 2026-11-01.
Method: code reading only, plus two existing screenshots from `docs/reviews/ui-mission-control/after/` (dashboard and project overview, 1440). Every other page was **not viewed visually** in this phase; findings for those pages come from code and are marked *(code)*.

## 1. Users and jobs-to-be-done

Roles and grants come from `apps/api/src/modules/identity/seed/system-role-permissions.ts`; routes from `apps/web/src/app`. No personas are invented. Where a role has a grant but no web screen, that is noted as a gap.

| Role | Grants (summary) | Top jobs (from grants + existing routes) | Needs to see first | Decisions | Bad day |
|---|---|---|---|---|---|
| **Gov Admin** | 71: full project lifecycle incl. approve/cancel, payments approve/reject, users/agencies, audit, RoadSync conflict resolve | 1. Review and approve submitted projects (`/projects/reviews`) 2. Oversee projects across child agencies (`/dashboard`, `/projects`) 3. Manage staff and agencies (`/admin/*`) | Pending reviews; delayed projects across scope | Approve / reject / return projects; agency and user changes | Review queue backlog; delayed projects nobody owns |
| **Agency Officer** | 56: create/submit/hold/cancel/complete projects in own agency, milestones, work requests, finance create, citizen issues | 1. Create and submit projects (`/projects/new`) 2. Track agency projects and milestones 3. Plan work requests (`/roadsync/work-requests`) | Own agency's delayed and overdue items; drafts not yet submitted | Submit, hold, cancel; milestone edits | Overdue milestones; rejected submissions |
| **Project Manager** | 46: assigned projects only; progress submit; milestones; work requests | 1. Update progress and milestones (`/projects/[id]/progress`, `/milestones`) 2. See own project status and timeline 3. Draft work requests on own projects | Assigned projects with overdue milestones; "reported 100% but still open" | What to report, when to request completion | Overdue milestones; project put on hold |
| **Super Admin** | 53: platform read; users/roles/system manage; **no project create/approve** | 1. Manage users, roles, agencies (`/admin/*`) 2. Read platform-wide status (`/dashboard`) | Platform scope figures; admin lists | Role and permission assignment | Locked-out staff; misconfigured roles |
| **Contractor** | 10: project/milestone read, progress submit, documents | Progress submission (grant exists) | Assigned work | — | *Gap:* no contractor-specific screen; the dashboard/projects scope is server-limited |
| **Inspector** | 14: inspections read/submit/verify | Inspections | — | — | *Gap:* no inspection pages exist yet |
| **Citizen** | 5 | Public map, issues | — | — | Out of scope: public, not the staff workspace |

Grants with **no web screen yet**: conflicts and coordination, documents, finance payments and approvals, inspections, assets, citizen issues, reports, audit log, map. These must not get fake screens; at most honest placeholders, and only where the brief allows.

## 2. Current-UI inventory

Staff pages (in scope). Line counts come from `wc -l`. "Dialect" is the CSS family the page mostly uses.

| Route | Component | Lines | Dialect | Viewed |
|---|---|---|---|---|
| `/dashboard` | `components/auth/workspace-home.tsx` → `projects/project-dashboard.tsx` | 18 + 476 | `mc-*` | screenshot |
| `/projects` | `projects/projects-page-client.tsx` (+ `data-table/*`) | 224 | `auth-access-*` | (code) |
| `/projects/new` | `project-create-page-client.tsx` + `project-create-form.tsx` | 83 + 322 | `auth-access-*` | (code) |
| `/projects/[id]/overview` | `project-overview-client.tsx` | 272 | `auth-access-*` | screenshot |
| `/projects/[id]/edit` | `project-edit-page-client.tsx` + `project-edit-form.tsx` | 140 + 292 | `auth-access-*` | (code) |
| `/projects/[id]/milestones` | `project-milestones-client.tsx` | 255 | `auth-access-*` | (code) |
| `/projects/[id]/progress` | `project-progress-client.tsx` | 210 | `auth-access-*` | (code) |
| `/projects/[id]/timeline` | `project-timeline-client.tsx` | 199 | `auth-access-*` | (code) |
| `/projects/[id]/activity` | `project-activity-client.tsx` | 122 | `auth-access-*` | (code) |
| `/projects/[id]/review` | `project-review-client.tsx` | 246 | `auth-access-*` | (code) |
| `/projects/reviews` | `review-queue-client.tsx` | 205 | `auth-access-*` | (code) |
| `/notifications` | `project-notices.tsx` | 112 | `auth-access-*` + some `mc-*` | (code) |
| `/admin/users` · `/agencies` · `/roles` | `admin/admin-*-page-client.tsx` | 380 · 313 · 250 | `auth-access-*` | (code) |
| `/profile` · `/settings` | `profile/*-page-client.tsx` | 259 · 136 | `auth-access-*` | (code) |
| `/roadsync/work-requests` (+ `/new`, `/[id]`) | `roadsync/*` | 240 · 275 · 122 | `rs-*` | Step 66 screenshots |

Shell and shared components: `auth/staff-workspace-shell.tsx` (230, `mc-*`), `auth/workspace-nav.ts`, `auth/route-access-guard.tsx` (imports the Mission Control CSS), `common/status-badge.tsx`, `common/date-picker.tsx`, `data-table/*` (5 files), `feedback/{async-content,content-skeleton,empty-state}.tsx`, `motif/connected-motif.tsx`, `ui/*` (19 shadcn primitives).

Out of scope, confirmed not to be touched: `/`, `/si`, `/ta` and the public info pages, `/login`, `/forgot-password`, `/reset-password` (and their `si/ta` variants), `components/landing/*`, `components/auth/login-*`, `*-password-*`.

No placeholder pages exist for future modules. The nav lists only real routes (`workspace-nav.ts`: "Only routes that exist today").

## 3. Heuristic review

### Shared to all pages
- **Three visual dialects.** `auth-access-*` (693 lines of CSS, originally the auth/access-card styles) dresses 15 of 18 staff pages. `mc-*` (shell + dashboard, 766 lines) and `rs-*` (RoadSync, 118 lines) are newer. Same tokens, but different components, spacing and header patterns.
- **Language switch is per page, in content, and not persisted.** Every page has its own "View language (draft)" EN/SI/TA control (screenshot: overview; code: 13 pages hold `useState<AuthLocale>("en")`). Switching does not carry across navigation. The shell (nav labels, role names, menu) is **English-only** (`workspace-nav.ts` hard-codes labels). RoadSync has no SI/TA at all.
- **Page header** comes from the shell (title + description + route-lines motif) and is consistent. But it is title-only: no scope chip, no "as of", no primary action slot. Pages compensate with ad-hoc breadcrumbs (`auth-access-locale-row` reused as a breadcrumb nav) and back links.
- **Status vocabulary is defined twice.** `lib/design/semantic-colors.ts` (badge variants) and `lib/projects/dashboard-view.ts` `STATUS_TONE` (chart tones). Both have icon + label (good, not colour-only), but the tone mappings differ by module.
- **Hard-coded colours:** 47 hex literals in `mission-control-dashboard.css`, 30 in `mission-control-roadsync.css`, 17 in `auth-access.css`, 13 in `mission-control.css`, plus 4 in `roadsync-shared.tsx` (SVG). That is design debt against a semantic-token rule.
- **States:** `feedback/*` provides skeleton, empty and async wrappers. The dashboard and RoadSync use custom states; most `auth-access` pages use a plain `role="status"` paragraph *(code)*.

### Page-specific (evidence)
- **Dashboard** *(screenshot)*: the strongest page. Real KPI cards with honest denominators, a "What needs attention" panel first, a provisional finance card, a donut with a full text legend, and recent projects. Weaknesses:
  - Six equal KPI cards with uniform weight, so nothing leads.
  - Recent projects is a long list with repeated "Timeline · Activity" links per row, which is noisy.
  - The bottom row leaves empty space at the right.
  - The language switch takes a full row.
- **Project overview** *(screenshot)*: the clearest example of dated UI.
  - The identity card mixes labels ("Project code", "Manager") with values that have no visual separation.
  - Explanatory prose sits loose between cards.
  - Sub-navigation is four outline buttons, not tabs, and `aria-current` is not shown.
  - Facts are spread across five equal cards with lots of white space.
  - The physical vs financial progress pair is not shown together.
- **Lists** (`/projects`, review queue) *(code)*: `DataTable` with a code link, title, type and status badge. Uppercase enum values are shown raw for type (`projectType` cell renders the enum), and dates are sliced ISO strings (`startDate?.slice(0,10)`).
- **Forms** (create/edit project, milestones, progress) *(code)*: `auth-access-field-*` stacks in one long column, with no section grouping beyond fieldsets.
- **Admin** *(code)*: three ~300-line clients with near-duplicate list/form/dialog patterns.

### Why it reads as template-like
1. Flat, equal-weight card grids: every fact gets a same-size white box.
2. Uniform type weights. Section titles, labels and values sit too close in size and weight (overview screenshot).
3. Sub-navigation and actions all styled as identical outline buttons.
4. Tables render raw enum values and ISO dates.
5. The brand appears only in the sidebar active bar, one orange CTA and the header motif. There is no INFRAOS-specific component vocabulary on inner pages.

### Design-debt list
- `auth-access-*` used outside its original auth context (15 pages).
- Per-page locale state duplicated 13×. The shell is not localised.
- Two status-tone maps.
- ~110 hex literals in CSS.
- Breadcrumbs implemented with a locale-row class.
- RoadSync `rs-*` duplicates `mc-*` button and tile primitives (`rs-btn` vs `mc-btn`, `rs-tile` vs `mc-*` KPI).
- No shared page-header actions slot. No shared detail-header or tab component.

## 4. Data and capability map (honest constraints)

| Page | Source | What it can honestly show |
|---|---|---|
| Dashboard | `GET /projects/dashboard` → `DashboardPayload` (`lib/projects/dashboard-view.ts`) | `scope`, `asOf` (Asia/Colombo); counts total, by status, active/onHold/delayed; `physical.reportedAt100StillNotCompleted` and `completedByStatus` (explicitly *not* completion); milestones overdue / due in 14 days with items, or `null` (unavailable); reviews pending + items or `null`; finance `storedPaidCount/AmountMinor` with provenance `stored_record_provisional_not_bank_settlement`, or `null`/`withheld`; `assignedToYou`; `availableWidgets`. **No time series, so no trends or deltas.** |
| Projects list | `GET /projects` (`ProjectListPayload`) | id, code, title, type, status, agency code, manager id, start/planned end, revision; page ≤ 25; filters status/type/q/agency; sort fields `createdAt, updatedAt, projectCode, title, …` |
| Project overview / edit | `GET /projects/:id` (`ProjectDetail`) | Identity, status, location/geometry, budget (draft), physical progress, dates |
| Milestones / progress / timeline / activity | their `*-api.ts` | Milestone list + counts; progress history (reported); timeline events; activity log (scoped). Financial progress is provisional (`finance-api.ts`, `finance-summary.ts`) |
| Reviews | `GET /projects/reviews` + review detail | Queue items, review decision actions (approval segregation enforced server-side) |
| Notifications | notice API | User's own notices, unread count |
| Admin | admin-* APIs | Users, agencies, roles/permissions (Super/Gov Admin) |
| RoadSync | `/roadsync/work-requests` | Work requests + counts by status/priority. **No conflicts or coordination data.** |

**Not available anywhere (data gaps):** historical trends, per-project spatial view in the web app (geometry exists, but there is no map component in staff pages), conflicts/coordination, documents, inspections, payments workflow UI, reports, audit-log UI.

## 5. Phase 1 conclusion (input to Phases 2–3)
- The foundation is sound: semantic tokens exist, statuses have icon + label, honesty rules are already encoded (reported ≠ completed, provisional finance, unavailable widgets).
- The biggest wins are structural, not decorative:
  1. One page-header pattern with scope, as-of and an actions slot.
  2. One detail-page pattern (identity header + tabs + facts) to replace the five-card overview.
  3. A single status language and a dual-progress component.
  4. Retire `auth-access-*` from staff pages in favour of one `mc-*` family.
  5. A persisted, shell-level language switch covering nav labels.
- **Uniqueness test (baseline, run now):**
  - *Logo-removal:* only the dashboard is recognisable (attention panel, provisional finance); inner pages are not.
  - *Template:* inner pages resemble a default card/form admin.
  - *Squint:* the dashboard passes; the overview fails (no dominant element).
  - *Density:* the projects table is untested visually, *(code)* only.
