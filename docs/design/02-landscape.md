# 02 — External landscape (Phase 2)

Accessed 2026-11-01 with a text fetcher (WebFetch) and one web search.
**Every source below was read as text only. None was viewed visually.** Statements about how a product *looks* are therefore limited to what its own text says, and visual style is marked **unverified**. Nothing was cloned or copied; only principles are taken.

Failed or unusable (logged, not described): Shopify Polaris *resource details layout* (socket closed, twice), kepler.gl home page (title only), USAspending.gov home page (title only, client-rendered). The Polaris "two-column details" idea below is therefore **not** sourced from Polaris.

## Coverage map

| Required area | Reference(s) |
|---|---|
| App shell / navigation | Linear (R1) |
| Executive dashboard / KPI | Tremor (R11), Stripe chart/patterns index (R8) |
| Data table at scale | Carbon (R4) |
| Review / approval workflow | GOV.UK task list (R2), USWDS step indicator (R5) |
| Project detail page | GOV.UK summary list (R3), Plane (R10) |
| Map / geospatial panel | Felt (R12) |
| Notifications | Primer messaging (R7), Stripe communicating state (R9) |
| Empty / loading / error | Primer empty states (R6) |
| Status language | Atlassian lozenge (R13) |
| Government trust | USWDS banner (R14), SGDS (R15) |
| Multilingual / non-Latin | Sinhala/Tamil font sources (R16) |

## Teardowns

**R1 · Linear: "How we redesigned the Linear UI".** https://linear.app/now/how-we-redesigned-the-linear-ui · blog post · visuals unverified
- *Does well:* Treats the redesign as an "evolution", not a rebuild, and keeps navigation structure stable. Aligns labels, icons and buttons on a strict grid in the sidebar and tabs to "reduce visual noise… increase the hierarchy and density". Generates themes from three inputs (base, accent, contrast) in LCH instead of 98 variables. Uses a display face for headings and the body face elsewhere.
- *Principle:* Calm comes from alignment and a small set of derived tokens, not from decoration.
- *Adapt:* Keep the current shell and IA (it matches the INFRAOS rule "never remove navigation"). Tighten alignment of nav, tabs and headers. Derive neutral and tint tokens from a few inputs. Keep Manrope display headings over Geist body (already present in `layout.tsx`).
- *Avoid:* Linear's near-monochrome, dark-first aesthetic. A government tool used daytime on office monitors needs a light default and stronger semantic colour.
- *Fit:* 5

**R2 · GOV.UK task list pattern.** https://design-system.service.gov.uk/patterns/complete-multiple-tasks/ · OGL v3.0 · visuals unverified
- *Does well:* Each task is a link plus a short adjective status ("Incomplete", "In progress", "Cannot start yet", "There is a problem"). **Completed items become less prominent so the ones needing action stand out.** Unavailable tasks are not linked. Status is tied to the task with `aria-describedby`.
- *Principle:* Visual weight follows *need for action*, not chronology.
- *Adapt:* Reviews queue, milestones and the dashboard "attention" panel. Completed or closed rows are de-emphasised and actionable rows are strongest. Use status text that is short and sentence case.
- *Avoid:* GOV.UK's very sparse, single-column layout for dense officer workloads.
- *Fit:* 5

**R3 · GOV.UK summary list.** https://design-system.service.gov.uk/components/summary-list/ · OGL v3.0 · visuals unverified
- *Does well:* Key/value rows in a description list with an optional per-row action ("Change" + visually-hidden context). Missing values show a link to supply them. **Summary cards** group several lists about the same kind of thing, with a unique title and at most 2–3 card actions. Row borders are kept because they help zoom users.
- *Principle:* Facts read best as labelled rows, not as scattered boxes.
- *Adapt:* This directly fixes the project-overview problem in 01-audit §3 (labels and values with no separation, five equal cards). One "facts" summary list per topic, with honest "Not provided".
- *Avoid:* Per-row "Change" links where INFRAOS edits whole drafts on a separate page.
- *Fit:* 5

**R4 · IBM Carbon: data table usage.** https://carbondesignsystem.com/components/data-table/usage/ · Apache-2.0 (Carbon) · visuals unverified
- *Does well:* Five row heights (24/32/40/48/64; 40 default; 64 only for two-line rows). A toolbar with ≤5 global actions. Sort arrow shown on the sorted column and on hover elsewhere. Headers kept to 1–2 words and truncated with a tooltip. Row hover always on. Skeletons, not spinners. Expandable rows only for supplementary data.
- *Principle:* Density is a setting with fixed steps, not ad-hoc padding.
- *Adapt:* Two densities for INFRAOS tables: comfortable 48, compact 36–40. Skeleton rows matching the final layout. Hover on all rows. Short headers.
- *Avoid:* Batch-selection toolbars. INFRAOS has no batch APIs, so they would be fake capability.
- *Fit:* 4

**R5 · USWDS step indicator.** https://designsystem.digital.gov/components/step-indicator/ · licence not stated on page (repo not checked) · visuals unverified
- *Does well:* For linear processes of 3+ steps. `aria-current` on the current step. Visually-hidden completion text. Not for non-linear flows.
- *Principle:* Show where a record is in a fixed lifecycle, with explicit text for screen readers.
- *Adapt:* The project lifecycle (Draft → Submitted → Under review → Approved → Active → Completed) is linear on its main path, so a compact lifecycle rail fits the project header. Off-path states (On hold, Delayed, Rejected, Cancelled) are shown as flags, not as fake steps.
- *Avoid:* Using it for milestones, which are not linear.
- *Fit:* 4

**R6 · GitHub Primer: empty states.** https://primer.style/product/ui-patterns/empty-states/ · visuals unverified
- *Does well:* Four types (not yet used, temporarily empty, error, first-time). A title plus optional short secondary text that says the *next step*. One primary action. **Errors are serious in tone, with an alert icon, not a playful illustration.**
- *Principle:* Empty states explain *why* and *what next*, and tone matches stakes.
- *Adapt:* Per-widget empty and error states with retry. The route-line motif is used only in "not yet used" states, never in errors.
- *Fit:* 5

**R7 · GitHub Primer: notification messaging.** https://primer.style/product/ui-patterns/notification-messaging/ · visuals unverified
- *Does well:* Banners for page or section messages near the interaction. Inline messages for field or action feedback. **Toasts are not recommended.** Severity set: info, warning, critical, success (used sparingly), unavailable (degraded or permission). Results must still be announced to screen readers.
- *Principle:* Persistent, located messages beat transient toasts.
- *Adapt:* Add an "unavailable" tone to the INFRAOS status language. It matches existing honesty states ("Not available in this view", withheld finance). Avoid toasts for important outcomes.
- *Fit:* 5

**R8 · Stripe Apps: design patterns index.** https://docs.stripe.com/stripe-apps/patterns · visuals unverified
- *Does well:* Patterns are compositions of components (layout, chart layout, lists, filter controls, back link, action buttons, empty, loading, progress stepping). Filters use chips for tables and a select for charts.
- *Principle:* A small, named pattern catalogue keeps a large surface consistent.
- *Adapt:* Define the INFRAOS pattern set explicitly in 04-direction (page header, facts list, attention list, dual progress, filter bar, table, detail header, empty/error).
- *Fit:* 3

**R9 · Stripe Apps: communicating state.** https://docs.stripe.com/stripe-apps/patterns/communicating-state · visuals unverified
- *Does well:* Toast is temporary, triggered by a user action, ≤30 characters, with an optional action. Banner is persistent, has a title and body, needs an action to dismiss, and sits under the header.
- *Principle:* Separate "I did something" feedback from "the system needs you".
- *Adapt:* Success after create or save can be a brief confirmation (as in Step 66 detail). System requirements ("Provisional", "Not available yet", stale data) are persistent, located banners.
- *Fit:* 3

**R10 · Plane (open source PM).** https://github.com/makeplane/plane · **AGPL-3.0, so no code reuse** · visuals unverified
- *Does well (stated):* Cycles with burn-down charts, modules to split large projects, saved and shared filtered views, analytics.
- *Principle:* Project tools earn trust through saved views and focused sub-areas.
- *Adapt:* Only the idea that the project detail is a set of focused tabs (overview, milestones, progress, timeline, activity), which INFRAOS already has as routes.
- *Avoid:* Burn-down and trend charts. INFRAOS APIs provide no time series (01-audit §4).
- *Fit:* 2

**R11 · Tremor.** https://github.com/tremorlabs/tremor · Apache-2.0 · visuals unverified
- *Does well (stated):* 35+ accessible chart and dashboard components on Tailwind + Radix.
- *Principle:* Dashboard primitives can stay accessible and Tailwind-native.
- *Adapt:* Nothing imported. INFRAOS keeps its plain SVG/CSS charts (Phase 1 donut). Specific components (KPI cards, trackers) were **not confirmed** from the README text.
- *Avoid:* Adding a chart dependency for simple bars and segments.
- *Fit:* 2

**R12 · Felt.** https://felt.com/ · commercial · visuals unverified
- *Does well (stated):* One shared map instead of several tools. A legend lists each layer with counts. Popups show a record's key facts (material, inspection date). Comments thread on the map. "Nobody needs GIS training."
- *Principle:* Maps should answer a question with plain-language labels and counts, not raw GIS.
- *Adapt:* A future map-adjacent panel for project and RoadSync detail: a legend with counts and a facts popup. **Deferred:** the web app has no staff map yet (01-audit §4), so no map is designed now.
- *Fit:* 3 (future)

**R13 · Atlassian lozenge.** https://atlassian.design/components/lozenge/usage · visuals unverified
- *Does well:* Lozenges for workflow status, priority and state; tags for descriptive metadata. Semantic colours for meaning, accent colours for user content only. Sentence case, short, never colour alone. Filled icons reserved for critical states, because overuse weakens them.
- *Principle:* Status and metadata are different components.
- *Adapt:* Split INFRAOS "status chip" (lifecycle, semantic) from "meta tag" (work type, project type, agency code, neutral). Filled icon only for Delayed or critical.
- *Fit:* 5

**R14 · USWDS banner.** https://designsystem.digital.gov/components/banner/ · visuals unverified
- *Does well:* An identity strip on every page tells users how to recognise an official site. Must not be used on non-official, test or misleading sites.
- *Principle:* Trust comes from **truthful** identity statements, consistently placed.
- *Adapt (inverted):* INFRAOS is an academic or portfolio project, **not** official (CLAUDE.md). A persistent, quiet "Demonstration system — not official government data" marker in the shell is the honest equivalent. It must never imitate an official-site banner.
- *Fit:* 4

**R15 · Singapore Government Design System.** https://www.designsystem.tech.gov.sg/ (redirected from designsystem.gov.sg) · licence not stated in fetched text · visuals unverified
- *Does well (stated):* "Unifying Government through Design and Code". Tokens feed Tailwind v4. Components work across frameworks.
- *Principle:* Government consistency comes from shared tokens consumed by the existing stack.
- *Adapt:* Validates the INFRAOS approach: tokens → Tailwind/CSS variables, with no new UI framework.
- *Fit:* 3

**R16 · Sinhala/Tamil typography sources.** Yaldevi font (https://github.com/mooniak/yaldevi-font), Fontsource Noto Sans Sinhala (https://fontsource.org/fonts/noto-sans-sinhala/cdn), Univ. of Moratuwa legibility study (https://dl.lib.uom.lk/items/f691379b-d1db-42a5-b5ba-781642532937/full) · search-result summaries only, not opened individually · visuals unverified
- *Found:* Noto Sans Sinhala was preferred for small-screen legibility (UoM 2024, per the search summary). Yaldevi shares vertical metrics across Sinhala, Tamil and Latin for mixed-script layout. `unicode-range` lets the browser choose the per-script font.
- *Not found:* Any authoritative line-height numbers. Values in 04-direction will be **measured in-browser**, not quoted.
- *Adapt:* INFRAOS already loads Noto Sans Sinhala and Noto Sans Tamil (`layout.tsx`). Keep them. Give SI/TA text a larger line-height via `:lang(si)` / `:lang(ta)`, and design labels to survive 30–50% growth.
- *Fit:* 5

## Cross-reference analysis

1. **Pattern map.**
   - *Best practice (independent sources agree):* key/value facts lists (R3); status = text + icon + colour, never colour alone (R2, R13, R7); persistent located messages over toasts (R7, R9); fixed density steps and skeletons (R4, R6); one primary action per empty state (R6); alignment over decoration (R1).
   - *Trend, not principle:* dark-first monochrome (R1), illustration-heavy first-run (R6's "playful"), burn-down and analytics everywhere (R10).
2. **Convergence risk** (what makes every SaaS look alike, so INFRAOS avoids defaulting to it):
   - A row of equal KPI cards with big numbers.
   - Donut + line chart + "recent activity" grids.
   - Monochrome chrome with one accent.
   - Toasts for everything.
   - Avatar-heavy activity feeds.
   - INFRAOS's current dashboard already shows the first one (01-audit §3).
3. **Whitespace INFRAOS can own.**
   - **Honest-data design as a visible feature.** None of the references has first-class components for *provisional*, *reported ≠ completed* or *unavailable/withheld*. Primer's "unavailable" tone is the closest. INFRAOS already has these semantics in its API (`provenance`, `coverage`, `meaning`), so it can surface them as a design language.
   - **Action-weighted lists** (R2's de-emphasised completed rows) applied to infrastructure work: overdue → due → on track → closed.
   - **Lifecycle rail** for public-works projects (R5) with off-path flags.
   - **Trilingual-ready layout** for Sinhala and Tamil. No reference covers it.
   - **Coordination-first** RoadSync views. The data does not exist yet, so this is reserved.
4. **Government trust signals.**
   - Truthful identity (R14), applied honestly here as "demonstration, not official".
   - Consistent placement.
   - Sentence-case plain language (R2, R13).
   - Calm, located messages (R7).
   - "As of" timestamps and scope statements (already in the INFRAOS dashboard).
   - Bureaucratic heaviness comes from walls of form fields and explanatory prose. INFRAOS's overview shows prose loose between cards (01-audit §3), and summary lists fix that.
5. **Accessibility and multilingual lessons.**
   - Visually-hidden context on repeated actions (R3).
   - `aria-current` on steps and nav (R5).
   - `aria-describedby` to tie status to item (R2).
   - Announce results even when visible (R7).
   - Keep row borders for zoom users (R3).
   - Per-script fonts via `unicode-range`, and measure SI/TA line-height rather than guess (R16).

## Licences and reuse
- No code was copied.
- Reusable *if needed later*, with attribution: Carbon (Apache-2.0), Tremor (Apache-2.0), GOV.UK guidance text (OGL v3.0).
- Plane is AGPL-3.0: do not reuse code.
- USWDS and SGDS licences were not confirmed from the fetched pages, so treat them as not reusable until checked.
