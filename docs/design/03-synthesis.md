# 03 — Synthesis and concept directions (Phase 3)

## 0. Owner direction change (2026-11-01)
After Phase 2 the owner asked for a **modern business SaaS look, not a government-style UI**, with references from GitHub, v0 and design galleries. Consequences:
- Government systems (GOV.UK, USWDS, SGDS) are kept **only** for structural and accessibility mechanics (labelled fact rows, `aria-current`, de-emphasising finished work). Their visual style is dropped.
- The "demonstration, not official" honesty marker stays, because it is a CLAUDE.md product rule. It is styled as a small SaaS-style environment badge, not a government banner.
- All honesty rules stay: no fabricated data, Provisional labels, reported ≠ completed.

### Added business references (accessed 2026-11-01, text only, visuals unverified)

| # | Source | Licence | Taken |
|---|---|---|---|
| B1 | shadcn/ui blocks: https://ui.shadcn.com/blocks (`dashboard-01`: inset sidebar, section cards, interactive chart, data table; `sidebar-07`: collapses to icons) | MIT (https://github.com/shadcn-ui/ui) | The INFRAOS stack already uses shadcn. Inset-sidebar and icon-collapse are **mechanics** to adopt. The `dashboard-01` composition (cards → chart → table) is the **convergence pattern to avoid copying**. |
| B2 | Vercel Geist: https://vercel.com/geist/introduction, `/materials` | proprietary docs | A "materials" scale: surface radii 6/12 px, floating elements (tooltip 6, menu/modal 12, fullscreen 16) lifted by shadow level. **The grid is "a core part of the aesthetic".** Adopt the materials idea and a visible structural grid. |
| B3 | next-shadcn-dashboard-starter: https://github.com/Kiranism/next-shadcn-dashboard-starter | MIT | Command-K palette, URL-synced table state, theme switcher. Confirms the common starter feature set. INFRAOS adopts URL-synced filters (already present on `/projects`); Command-K only if it needs no backend. |
| B4 | Attio: https://attio.com/ | commercial | "Redesigned record pages" that put all of a record's data in one place: the record-page model for the project detail. |
| B5 | Twenty CRM: https://github.com/twentyhq/twenty | licence not stated in fetched text | Objects + views + customisable layouts: the record/view vocabulary. Not reused. |
| B6 | Dub: https://github.com/dubinc/dub | AGPLv3 core + commercial `/ee` | **No code reuse.** No UI detail stated in the fetched text. |
| B7 | v0 templates: https://v0.app/templates | per-template | Text listed only "Dashboard – M.O.N.K.Y" and "FINBRO Dashboard" (no descriptions). **Visuals unverified**, so nothing is claimed about their look. |
| — | Mobbin dashboards | — | HTTP 403. Not used. |

From Phase 2 the business sources are kept: Linear (alignment, LCH-derived themes, display headings), Carbon (density steps, skeletons), Primer (empty and error tone, no toasts for important outcomes), Atlassian (status ≠ tag), Stripe (toast vs banner), Felt (map legend with counts, future).

## 1. Design principles (testable)
1. **Action before history.** On every page, what needs a decision (delayed, overdue, awaiting review) is visually stronger than what is finished. *Test:* in a squint test, the top-weighted element is an action item.
2. **One record, one place.** A project or work request has a single record page: header, lifecycle and facts, then focused tabs. *Test:* the code, status, agency, schedule and progress of a project are visible without scrolling at 1440.
3. **Honesty is a visible material.** Provisional, reported, unavailable and withheld have their own visual treatment, the same everywhere, including inside charts. *Test:* every money figure carries "Provisional"; no "100%" appears without "reported".
4. **Structure shows.** A faint engineering grid and route-line geometry carry the brand. Decoration never does. *Test:* removing the motif loses no information.
5. **Density is a choice.** Lists offer comfortable and compact density; numbers are tabular. *Test:* 20 projects fit without scrolling in compact mode at 1440×900.
6. **Three scripts, one layout.** Every component survives Sinhala and Tamil labels 50% longer than English. *Test:* switching to TA causes no clipping or overflow at 360 px.
7. **Orange means act.** Brand orange is reserved for the primary action and focus. *Test:* at most one orange filled element per view.

## 2. Signature elements (chosen 5)

| # | Element | Why it's INFRAOS-specific | Data backing |
|---|---|---|---|
| S1 | **Route-line status language**: each status is a *node shape* on a line (filled = active, ring = pending, half = on hold, diamond = delayed/critical, check = completed, dash = draft or cancelled) + colour + text label | Draws on the existing connected/route-line motif. Shape survives greyscale and colour-blindness. Used in badges, table rows, the lifecycle rail and chart legends. | Project and work statuses already in the API |
| S2 | **Lifecycle rail** in record headers: the main path as a line of nodes with the current node lit; off-path states (On hold, Delayed, Rejected, Cancelled) shown as a branch flag | No SaaS reference has a public-works lifecycle. It replaces the five-card overview. | `status` only; no invented dates |
| S3 | **Dual progress bar**: physical (reported) and financial (provisional) on one track pair, labels built in ("Reported 62%", "Provisional 40%"), hatched fill for provisional | Encodes two honesty rules in one component | `physicalProgress`, finance summary |
| S4 | **Honesty chips**: `Provisional`, `Reported`, `Unavailable`, `Withheld`, `Demo data` as one small chip family with a dotted outline (vs. the solid status chips) | Turns the API's `coverage`, `provenance` and `meaning` fields into a visible design language. This is whitespace in Phase 2. | `coverage.*`, `finance.provenance`, `physical.meaning` |
| S5 | **Grid canvas + "as of" page header**: a faint 24 px engineering grid on the canvas; the page header carries breadcrumb, title, scope chip, "as of" time and one action slot | Geist-style structural grid, but drafted like a site plan. One header everywhere fixes ad-hoc breadcrumbs. | `scope`, `asOf` from APIs where present; omitted otherwise |

Rejected as signatures: Command-K palette (generic, adds nothing to the brand; may come later as a utility), dark mode first (owner's office use, and a large token surface), animated counters (they delay reading).

## 3. Concept directions

### A. "Command Deck": dense, dark-chrome operations console
Charcoal sidebar **and** topbar, a light working canvas, a compact table-first dashboard, KPIs as a thin strip, a right-hand inspector panel on list pages.
```
┌─sidebar─┬─ topbar (dark) ── search · scope · as-of ────────────┐
│ ▪ Dash  │ KPI strip: Active 2 │ On hold 1 │ Delayed 1 │ …      │
│ ▪ Proj  ├──────────────────────────────────┬──────────────────┤
│ ▪ Work  │ Attention table (sortable)       │ Inspector panel  │
│         │ ◆ Kelani Bridge  Delayed  …      │ selected project │
│         │ ○ Negombo road   Review   …      │ facts + progress │
└─────────┴──────────────────────────────────┴──────────────────┘
```
Detail page: tabs across the top, facts in an inspector panel at the right.

### B. "Site Plan": light, editorial record pages on a drafting grid (recommended)
Keeps the current charcoal sidebar. The canvas is warm off-white with the faint grid (S5). The dashboard opens with an **attention lane** (action-weighted list) beside a **portfolio line**, a horizontal route line showing project counts per lifecycle node (S1 + S2 at portfolio scale), then dual-progress and provisional finance, then a compact table. Record pages follow the Attio "one place" model.
```
DASHBOARD
┌ header: Workspace / Dashboard   ProjectTrace   [Agency scope] as of 19:28 ┐
├ Portfolio line ─○ Draft 1 ── ○ Submitted 1 ── ○ Review 1 ── ● Active 2 ── ✓ Done 1 ┤
│                  ╰─ ◐ On hold 1   ◆ Delayed 1 (branch flags)                     │
├───────────────────────────────┬──────────────────────────────────────────────┤
│ Needs action (attention lane) │ Progress honesty                             │
│ ◆ Delayed · Kelani Bridge  →  │ Reported 100% but open: 1  [Reported]        │
│ ◷ Overdue · Culvert deck   →  │ Paid rows LKR 12,500  [Provisional]          │
│ ○ Due ≤14d · Slab pour     →  │                                              │
├───────────────────────────────┴──────────────────────────────────────────────┤
│ Projects (compact table, node-shape status, dual progress mini-bars)         │
└──────────────────────────────────────────────────────────────────────────────┘

PROJECT RECORD
┌ Projects / INF-MCD-0002 ─────────────────────────────── [Edit] [⋯] ┐
│ Kelani Bridge Rehabilitation          ◆ Delayed   ROAD · DEPT_WEST │
│ ●──●──●──●──◆ lifecycle rail (Draft→…→Active, branch: Delayed)     │
├ Overview · Milestones · Progress · Timeline · Activity  (tabs)     ┤
├──────────────────────────────┬─────────────────────────────────────┤
│ Facts (labelled rows)        │ Dual progress (S3)                  │
│ Agency     DEPT_WEST         │ Physical ▓▓▓▓▓░░ Reported 62%        │
│ Manager    N. Perera         │ Financial ▨▨░░░░ Provisional 40%     │
│ Schedule   Mar 26 → Mar 27   │ Next milestone · Slab pour · 5 Nov  │
│ Budget     LKR 2.5M (draft)  │ Location · Colombo, Western         │
└──────────────────────────────┴─────────────────────────────────────┘
```

### C. "Bento Signal": marketing-grade bento grid
Asymmetric bento tiles of mixed sizes, gradient edges and a large hero metric per page. Closest to v0 and landing-page aesthetics.
```
┌──────────── big hero tile: 8 projects ───────┬─ donut ─┐
├─ Active ─┬─ Hold ─┬─ Delayed ─┬─ Reported ───┤         │
├──────── recent projects ─────────┬─ finance ─┴─────────┤
```

### Scoring (1–5)

| Criterion | A Command Deck | **B Site Plan** | C Bento Signal |
|---|---|---|---|
| Principles 1–7 | 4 (action-first, dense; orange OK) | **5** (all seven map to S1–S5) | 2 (hero metrics put history before action; decoration) |
| User jobs (approve, update, oversee) | 4 | **5** (attention lane + record page) | 2 |
| Density (20 projects) | 5 | 4 | 2 |
| i18n resilience | 3 (dense strips clip SI/TA) | **4** (rows and lanes wrap) | 2 (fixed tiles clip) |
| Uniqueness vs shadcn `dashboard-01` | 3 (generic console) | **5** (portfolio line, rail, honesty chips) | 2 (bento is the 2024–26 default) |
| Effort on this stack / laptop | 3 (new inspector + dark topbar) | **4** (reuses shell, `mc-*`, motif, data) | 3 |
| **Total** | 22 | **27** | 13 |

## 4. Decision
**Direction B, "Site Plan"**, with two borrowings from A: a compact density toggle on tables, and a slim KPI strip where a page truly has several independent counts.

Rejected:
- **A**, because a dark console reads as a dev tool rather than a business product, and its dense strips break with Sinhala and Tamil.
- **C**, because the bento grid is exactly the convergence pattern from Phase 2. Its hero numbers also push history above action and invite decorative "metric theatre" the APIs can't honestly support.

B is the only option where the brand signature (route-line nodes, lifecycle rail, honesty chips, drafting grid) is also the information design. That is what should pass the logo-removal test.

## 5. Inputs to Phase 4
- Tokens:
  - Brand colours stay.
  - Add a warm off-white canvas.
  - Add a 24 px grid token.
  - Add two densities (36/48 row).
  - Add materials (6/12/16 radii, three lift levels).
  - Add darker text shades for orange and yellow on tints.
- Components to specify:
  - `PageHeader` (S5).
  - `StatusNode` / `StatusChip` (S1).
  - `LifecycleRail` (S2).
  - `DualProgress` (S3).
  - `HonestyChip` (S4).
  - `FactsList`.
  - `AttentionLane`.
  - `RecordTabs`.
  - `DataTable` density.
  - Empty and error state.
- Open items to measure, not guess: SI/TA line-height; contrast of darkened orange/yellow text shades.
