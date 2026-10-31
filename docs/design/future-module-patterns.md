# INFRAOS Mission Control: Future Module Patterns

**Status: design specification only.** None of these modules is built. This document defines how roadmap modules reuse the Mission Control shell, tokens and components. It adds no routes, links, fake screens or integrations. A module gets a sidebar link only when its route exists and the user is permitted to open it.

## Shared building blocks (already shipped)

| Block | Where | Use |
|---|---|---|
| Shell: charcoal sidebar, top bar, mobile drawer | `components/auth/staff-workspace-shell.tsx`, `workspace-nav.ts` | Add a nav item to the right group once the route exists |
| Page header with route-line backdrop | same shell | Title, one-line description, scope |
| Status badge (icon + label, `sm`/`md`) | `components/common/status-badge.tsx` | One status vocabulary everywhere |
| KPI card, panel, rows, split bar, donut, legend | `styles/mission-control-dashboard.css`, `project-dashboard.tsx` | Summary strips and charts |
| Motif: route lines, junction nodes, survey grid, 3 illustrations | `components/motif/connected-motif.tsx` | Headers and empty/unavailable states only |
| Tokens: soft status tints, sidebar, radii, overlay shadow, focus ring | `styles/tokens.css` | No new hues |

Rules for every module:

1. Every panel has a real data source or an honest unavailable state (use the "unavailable" illustration).
2. The backend enforces authorization; link visibility is never authorization.
3. No fabricated counts, trends, scores or "live" indicators. No line charts without a genuine time series.
4. Provisional or unverified figures carry a visible tag (for example `Provisional`).

Sidebar placement follows the groups in the master prompt: Operations, Management, Intelligence, System.

---

## RoadSync: Coordination Command Center

**Purpose:** show road-works coordination requests and the conflicts between agencies, and track their resolution.

```text
+--------------------+---------------------------------+----------------------+
| CONFLICTS          | EVENT TIMELINE                  | AGENCY RESPONSES     |
| [Critical] Road A  | o 09:10 Request submitted       | Water Board  [Reply] |
| [Medium]   Road B  | o 11:42 Conflict flagged        | Electricity  [Wait]  |
| severity chips     | o 14:05 Response received       | decision + reason    |
+--------------------+---------------------------------+----------------------+
 Header strip: request overview KPIs. Map preview opens the InfraMap drawer.
```

- **Reuses:** KPI cards, status badge (severity chips), vertical timeline, dialog with required reason, empty/unavailable illustrations.
- **Honesty rule:** never fake conflict detection. Show only conflicts the backend has recorded; when detection is not running, say so.

## InfraMap: National Infrastructure Map Console

**Purpose:** a scoped map of infrastructure features and projects.

```text
Desktop                                  Mobile
+-------+--------------------+--------+  +---------------------+
| LAYER |   full-bleed       | FEATURE|  |   full-bleed map    |
| panel |   MapLibre canvas  | drawer |  |                     |
| legend|                    |        |  +---------------------+
+-------+--------------------+--------+  | bottom sheet: layers|
                                          +---------------------+
```

- **Reuses:** drawer pattern (focus trap, Escape, return focus), status badge, legend component.
- **Failure fallback:** if tiles or the style fail, show the "unavailable" illustration plus a text list of the same features.
- **Honesty rule:** never expose unauthorized features. Layers and features come from scoped API responses only.

## Contractors: Directory and profile

**Purpose:** directory of contractors with assignments, project history and compliance context.

```text
[Directory table: name | registration | active assignments | compliance status]
Profile: header + tabs [Assignments | Project history | Compliance]
```

- **Reuses:** data table (sticky header, filter chips), two-line identity cell, status badge.
- **Honesty rule:** no invented performance scores or rankings. Show recorded facts only.

## Inspections: Verification queue

**Purpose:** scheduled inspections, evidence review, field forms and results.

```text
+------------------------+---------------------------------------------+
| QUEUE (by date)        | INSPECTION: PRJ-0012                        |
| > Site visit  Tue      | Reported progress 80%  |  Verified: pending |
|   Bridge cert Thu      | Evidence | Field form | Result              |
+------------------------+---------------------------------------------+
```

- **Reuses:** split queue/detail layout (as in Reviews), sectioned forms with sticky action bar.
- **Honesty rule:** keep contractor-reported progress visually separate from independently verified outcomes. Never merge them into one number.

## Finance: Budget and payment views

**Purpose:** budget overview and payment records.

```text
[KPI: Budget | Stored paid rows (Provisional) | Remaining (unreconciled)]
[Physical progress bar]   [Financial progress bar, Provisional tag]   (never merged)
[Payment records table, right-aligned tabular LKR figures]
```

- **Reuses:** dual progress indicator, KPI cards, data table, definition tooltips for "Provisional".
- **Honesty rule:** a stored payment row never implies verified expenditure. Keep "provisional / unreconciled" wording. Roles without finance access see "Not available for your role", never zero.

## DocTrace: Document repository

**Purpose:** folders, preview and versions of project documents.

```text
+---------+-----------------------------+------------------+
| folders | file list (version badge)   | preview + meta   |
+---------+-----------------------------+------------------+
```

- **Reuses:** data table, drawer for preview, badge for version and classification.
- **Honesty rule:** show only permission-safe metadata. Any retrieval-based answer shows citations and an uncertainty note.

## Risk Intelligence: Advisory scoring

**Purpose:** advisory risk scores with explanations.

```text
[Score card: value + confidence + "Advisory only"]
[Factors list: contribution each]   [Missing-data notices]
[Human override: reason required]
```

- **Reuses:** KPI card, panel, alert (missing data), dialog with required reason.
- **Honesty rule:** advisory only, never a legal decision. Always show the factors, the confidence and what data is missing. A human can override with a recorded reason.

## Assets: Asset directory

**Purpose:** asset lifecycle, condition and maintenance history, linked to projects.

```text
[Asset table: id | type | condition | last maintained]
Detail: summary | maintenance timeline | linked projects
```

- **Reuses:** data table, vertical timeline, badge.
- **Honesty rule:** no unsupported digital-twin or live-condition claims. Show the last recorded condition with its date.

## Citizen Issues: Case management

**Purpose:** staff-side inbox for citizen-reported issues.

```text
+---------------------+-------------------------------+
| INBOX (status chips)| CASE: assignment | history    |
|                     | location context (map preview)|
+---------------------+-------------------------------+
```

- **Reuses:** split queue/detail, status badge, timeline.
- **Honesty rule:** keep separate from the public reporting UI. Protect personal data and show it only to authorized roles.

## Reports: Report catalog

**Purpose:** scoped reports and exports.

```text
[Catalog cards] -> [Report: filters bar | chart panels | table] [Export*] [Print layout]
```

- **Reuses:** chart panel frame (title, scope, as-of, footnote, table disclosure), filters.
- **Honesty rule:** exports obey server-side RBAC. Show the scope and the as-of time on every report.

## AI Copilot: Assistant panel

**Purpose:** assistant panel with scoped context.

```text
Right-side drawer: [context chip: current project] [conversation]
 each answer: citations | confidence | tools used | [Approve action]
```

- **Reuses:** drawer, alert, dialog for human approval.
- **Honesty rule:** no LLM integration unless an approved roadmap step requires it. Any future version must show scope, tool use, citations and confidence, and require human approval before any change.

---

## Adding a module: checklist

1. The route and API exist and are authorized server-side.
2. The nav item is added to `workspace-nav.ts` in the right group.
3. The page uses the shell's header and the shared components above.
4. Loading, empty, error, permission-limited and zero/one/many states are covered.
5. Contrast, keyboard use, 320px reflow and Sinhala/Tamil text are checked.
