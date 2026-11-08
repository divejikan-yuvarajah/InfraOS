# INFRAOS — PHASE 8 · BATCH 03 (STEPS 88–91)
## InfraMap Command Layer — Universal Search, Advanced Filters, Layer Manager, Detail Drawer, Viewport Queries, Performance, Mobile
### Claude Code implementation prompt — copy everything below into Claude Code from the repository root

---

## 0. ROLE AND MISSION

You are a senior full-stack engineer (Next.js/React, Express/Mongoose, GIS/MapLibre) and UI/UX engineer inside the **INFRAOS** monorepo. Implement **Batch 03 of Phase 8 (InfraMap), Steps 88–91**. Batches 01 and 02 delivered the map foundation and six layers (projects, roadworks, conflicts, assets, utilities, risks) plus Exposure Check, Nearby Lens, Needs-Attention, Provenance and Focus mode. This batch turns that into a **fast, searchable, filterable, shareable, mobile-ready GIS workspace** and completes Phase 8.

| Step | Deliverable |
|---|---|
| 88 | **Universal GIS search** (server-side, permission-safe) + **advanced filter panel** (all layers, chips, counts, presets) |
| 89 | **Layer manager** (opacity, order, grouping, availability) + **reusable Feature Detail Drawer** (replaces the Batch 01/02 quick view) |
| 90 | **Viewport-driven bounding-box queries** + **performance** (single data pipeline, caching, abort, cluster/simplify, memory hygiene) |
| 91 | **Full mobile map experience** (bottom sheets, compact controls, touch targets) |

Signature additions (all deterministic, DB-backed, no AI): **Command Palette (⌘/Ctrl-K)**, **Shareable Map Links** (URL-encoded view/layers/filters/selection), **Saved Views** (per-user, local), **Coordinate & Place Jump**, **Map Brief** (print/PDF-friendly summary of the current view), **Data Health panel** (completeness + freshness per layer).

Deadline-driven university project: **working functionality and a premium look beat breadth**. Every button, chip, slider, sheet and shortcut you render must work. Replace weak placeholders; don't add decorative UI.

---

## 1. HARD RULES

1. **Inspect before you write.** Don't invent paths, models, permissions, env vars or helpers. §2 is recon at the time of writing; re-verify everything you depend on.
2. **Evolve, don't fork.** Extend the existing workspace: layer registry, state hook, selection priority, quick view → drawer, theme/icons, `copy.ts`, `use-map-data.ts`, `/inframap/*` API. **No second map, no second state store, no second data-fetch path.** If Batch 01/02 code must be refactored (e.g., per-layer hooks → one pipeline), refactor it in place and keep behaviour identical.
3. **Authorization is server-side only.** Search, filter counts, facets, drawer details, shared links, Map Brief and Data Health must never reveal records or even *existence/counts* a user isn't entitled to. Reuse the Batch 01/02 access policy (`inframap.access.ts`, scope helpers, tier projections, restricted-utility exclusion in the query). A shared link opened by a user without access must show only what *that user* may see.
4. **Don't duplicate RoadSync** (no conflict detection/scoring/workflow). Don't fabricate data. Missing/invalid geometry is never placed on the map.
5. **No new dependencies** (MapLibre, React Query, lucide, date-fns, sonner, radix-ui, zod only). Build the command palette, bottom sheet, and sliders from existing `components/ui` (`sheet`, `dialog`, `popover`, `tabs`, `select`, `tooltip`, `badge`) + small custom code. No paid geocoding, no external geocoder calls.
6. **No AI, no heavy tests, no extra Markdown reports, no unrelated refactors/upgrades.** (Optionally ≤ 10 lines appended to `docs/database/geospatial.md` for the new indexes.)
7. **Never touch `main`/`development` directly; never force-push.** See §10.
8. Read `apps/web/CLAUDE.md`/`AGENTS.md` first (this Next.js version has breaking changes; consult `apps/web/node_modules/next/dist/docs/` for App Router, `useSearchParams`/Suspense requirements, metadata, dynamic imports).
9. Match conventions: Conventional Commits, error envelope, `noStore`, strict zod query parsing (unknown/repeated keys → 400), allowlisted properties, rate limiters, tokens, `useWorkspaceLocale()` + copy dictionaries.

---

## 2. RECON (re-verify)

**Repo:** npm workspaces `apps/web` (Next 16, React 19, Tailwind 4, shadcn/radix), `apps/api` (Express 5, Mongoose 8, zod 4, vitest + mongodb-memory-server), `packages/shared-types`. Branch flow: feature branch → PR into `development` (squash) → later `main`.

**Existing UI primitives:** `components/ui`: alert-dialog, alert, badge, button, calendar, card, dialog, form, input, label, popover, select, separator, **sheet**, sonner, table, tabs, textarea, tooltip. Providers: `components/providers/query-provider.tsx`. Feedback: `components/feedback/{async-content,empty-state,error-state,loading-state,content-skeleton}`. i18n: `lib/i18n/workspace-locale.ts` (`en|si|ta`). Date picker deps: `react-day-picker`, `date-fns`.

**Existing search pattern (backend):** project list uses `q` with an **escaped regex** over `title` and `projectCode` (`projects.service.ts`, `escapeRegex`). No text indexes exist. Mirror the escape approach; for map search use **anchored/prefix-first matching + capped results**, never unescaped user regex.

**Data you can search/filter on (verify exact field names):**
- Projects: `title`, `projectCode`, `projectType`, `status`, `agencyId`, `location.{district,province,locality,roadName}`, dates, progress.
- Work requests (roadworks): `workType`, `status`, `priority`, `plannedStart/End`, `agencyId`, `projectId`, `assessment.maxBand`; derived overdue.
- Conflict records: `conflictNo` (RSC-YYYY-NNNNNN), `recordType`, `status`, `severity.current.band`, `district`, `overlapWindow`, `agencyIds`, `sides.a/b.title`.
- Assets/utilities (`assets`): `name`, `assetType`, `condition`, `agencyId`, `location.*`, dates; effective sensitivity (Batch 02).
- Hazard zones (`hazardZones`, Batch 02): `name`, `hazardType`, `level`, `source.*`, `agencyId`, `visibility`.
- Agencies: `Agency` model (name/code — verify fields). **No gazetteer of provinces/districts exists** → see §4.4.

**Batch 01/02 contracts (expected; verify against the code and the report below):** `modules/inframap/{inframap.routes,schema,service,geo,access,types}.ts`; endpoints `/inframap/layers|projects|roadworks|conflicts|assets|utilities|risks|exposure|nearby|features/:layer/:id`; bbox parser; allowlisted feature properties; envelope `{type:"FeatureCollection",features,truncated,total?,generatedAt}`; frontend `components/inframap/*`, `lib/inframap/{layer-registry,theme,map-icons,selection-priority,copy,use-map-data,use-inframap-state,api,geojson,map-style}.ts`; quick view with sections (Overview/Exposure/Nearby/Source); selection-history stack (max 5); Focus mode; DEMO ribbon; per-layer filter param names already used server-side.

> **BATCH 02 FINAL REPORT / HANDOFF NOTES (authoritative if present — otherwise derive from the code):**
> `[PASTE BATCH 02 REPORT HERE]`

---

## 3. PREFLIGHT (≤ 15 lines, then continue unless blocked)

1. `git fetch origin`; `git status` clean; show branch + `git log --oneline -5`.
2. Are Batch 01 **and** Batch 02 merged into `origin/development` (look for `inframap.access.ts`, `hazard-zone.model.ts`, `/inframap/risks`)? **Yes** → branch from `development`. **No** → **STOP and ask me**: (A) I merge them first; (B) stack on the Batch 02 branch; (C) other. Don't guess.
3. `npm install` if needed; run existing inframap tests for a green baseline; list pre-existing failures without fixing them.
4. **Read the real code** and write down in your report: the registry shape, the state-hook shape, how each layer currently fetches (per-layer hooks?), how selection/quick view/history work, which filter params exist per endpoint, how Focus mode and DEMO ribbon are wired, and how the map handles `style.load`.
5. Profile the baseline before optimizing (§6.1): with all six layers on and seeded data, note network requests per pan, payload sizes, and any duplicate/stale requests. Use that to justify each optimization you make (no cargo-cult work).
6. Check `db:indexes:check`, existing indexes for each collection, and `components/ui/sheet.tsx` capabilities (side/bottom variants, focus trap, Escape).

---

## 4. BACKEND (extend `modules/inframap/`)

All new routes: `requireAuthenticated`, `requirePermission("map.view.internal")`, per-layer data permission(s) checked **independently** (a forbidden layer simply contributes nothing), strict zod schemas, `noStore`, envelope, rate limiter, caps, allowlisted properties, never stack traces. New endpoint names below are **new**.

### 4.1 `GET /inframap/search` — universal, permission-safe search
- Params: `q` (trimmed, **2–80 chars**, no control chars), `layers?` (CSV subset of layer ids), `bbox?` (bias/restrict: `scope=view|all`), `limit?` (default 8 per group, max 15), plus the Batch 03 global filters (§4.3) so "search within current filters" works.
- Searches **only** records the viewer may see, **using the same scope/tier/restriction filters as the layer endpoints** (reuse the service-level filter builders; don't re-implement). Restricted utilities the viewer can't see are **never** matched, counted or hinted.
- Fields per group: projects (title, projectCode, locality/roadName/district), roadworks (project title/code, workType label match, locality via project), conflicts (conflictNo exact/prefix, side titles, district), assets/utilities (name, locality/roadName, district), hazard zones (name, hazardType), **agencies** (name/code — returns "agency" results that apply an agency filter + fly to extent), **places** (district/province from the gazetteer §4.4 → fit-bounds). 
- Matching: normalize (trim, collapse whitespace, case-insensitive), **escape regex**, rank: exact code/ID > prefix > word-prefix > contains. Use anchored prefix queries where possible so existing indexes help; cap `$regex` scans with `limit` + a `maxTimeMS` (e.g. 1500). Parse ID-like queries (`RSC-2026-…`, project code patterns) to exact lookups first.
- Response: `{ groups: [{ layer, label?, items: [{ id, layer, title, subtitle, status?, badge?, geometryHint: { kind: "point"|"bbox", coordinates|bbox }, matchedField }] , hasMore }], took, truncated }`. `geometryHint` is a **point or bbox only** (no full geometry) and only for features the viewer is allowed to locate. Items without valid geometry are still returned **flagged `noLocation: true`** (e.g., a project) so the UI can say "No map location" and offer the record link instead of flying anywhere.
- Debounce/abort-friendly; min length enforced server-side; log nothing sensitive.

### 4.2 `GET /inframap/facets` — filter option counts (permission-safe)
- Returns option lists + counts for the current filter state: per layer the enums that have data for the viewer (status, type, condition, band, level, hazardType, …), **agencies the viewer can see features of**, districts/provinces present. Counts computed with the same scope filters (aggregation `$group`, `maxTimeMS`), **excluding the facet's own filter** (standard faceting) and respecting `bbox` if provided. Never reveal counts for forbidden layers or hidden restricted features. Cache-friendly (short `staleTime` client-side).

### 4.3 Unified filter contract (one schema, shared by all layer endpoints + search + facets)
Extend the existing zod query schema into `inframapFilterSchema` and reuse it everywhere. Params (all optional; **CSV for multi-value, max 12 values each; values validated against enums**):
`agencyId`, `province`, `district`, `projectStatus`, `projectType`, `roadworkStatus`, `workType`, `overdue` (bool), `dateFrom`/`dateTo` (ISO date; roadworks/conflicts overlap-window **overlap** semantics: a record matches if its [start,end] intersects [dateFrom,dateTo]; projects: planned date range intersects), `conflictBand`, `conflictStatusGroup` (`open|resolved|all`), `recordType`, `assetType`, `condition`, `attention`, `utilityClass`, `hazardType`, `hazardLevel`, `riskBand`.
- **Semantics (document in one comment):** values within a facet = **OR**; different facets = **AND**; a filter that doesn't apply to a layer **does not hide that layer** (e.g. `projectStatus` only affects projects). `agencyId`, `province`, `district`, and date range apply to **every layer where the field exists**. Layer-specific filters keep the Batch 01/02 param names; add aliases only if needed for consistency, keep old names working.
- Province/district matching: use `location.province|district` (and `district` on conflicts). Normalize by comparing against the gazetteer's canonical names (case-insensitive); don't free-text match.
- Reject unknown/repeated keys, bad enums, inverted date ranges, > 5-year ranges (cap) → 400.

### 4.4 Gazetteer (tiny, static, verifiable)
`apps/api/src/modules/inframap/gazetteer.ts` (and a web-safe copy of the names via `packages/shared-types` **only if that's the existing pattern for shared constants**): the 9 provinces and 25 districts of Sri Lanka with canonical English names and an approximate **bbox** each (hand-checked, clearly commented "approximate extents for map navigation only"). Don't invent finer places. Sinhala/Tamil display names for provinces/districts in `copy.ts` (flag any uncertain translations). Use it for: place search, province→district dependent filter, "fit to district". If you cannot verify a bbox with confidence, make it a generous envelope around the district and say so in your report.

### 4.5 Viewport queries & layer endpoints (Step 90)
- Keep `bbox` (`w,s,e,n`) on every layer endpoint; add `zoom?` (integer 0–22). Server uses `zoom` to choose **geometry detail**: reuse `simplifyForTransport` (or a small Douglas-Peucker helper in `inframap.geo.ts`) with a tolerance that scales with zoom; round coordinates to **6 decimals** (~0.1 m) always, **5 decimals** at zoom < 12; at low zoom return **representative points/bboxes for large polygons** (hazard zones, area projects) instead of full rings, and return full geometry for the **selected feature** via the detail endpoint. Never alter stored data.
- Add `fields=min|full` (default `min`): `min` returns only properties needed for rendering + hover/popup (id, layer, type/status/condition/band, title, agencyName); `full` is for the drawer via `/features/:layer/:id`. Keep allowlists strict.
- **Keyset-safe caps:** per-layer `limit` stays (default 500, max 1000); when `truncated`, include `total` (use `countDocuments` with `maxTimeMS`, or an estimate flag `totalIsEstimate`) so the UI can say "Showing 500 of 1,240 — zoom in or add a filter".
- **ETag/If-None-Match** on layer GETs (hash of the response body, weak ETag) → 304 when unchanged; keep `noStore` semantics compatible (use `Cache-Control: private, no-cache` **only** for these map reads so the ETag revalidation works; confirm this doesn't conflict with the repo's `noStore` convention and explain the choice in a code comment).
- **Indexes:** verify each filter/sort path used by search/facets/layers has a supporting index; add only what's justified by the baseline (candidates: `assets{assetType,condition}`, `hazardZones{hazardType,level}` (exists), `workRequests{geometry:2dsphere,status,plannedStart,plannedEnd}` (exists), `projects{location.district}`, `projects{projectCode}` prefix). Update `check-indexes.ts` for any added index. Keep it minimal.

### 4.6 Feature detail contract for the drawer (`GET /inframap/features/:layer/:id`)
Extend the Batch 02 endpoint to **all six layers**: returns the full, tier-projected detail + `related` (projects↔roadworks↔conflicts↔assets links the viewer may see, each with `{layer,id,title,status}`), `links` (existing web routes only — verify which exist), `exposure` summary (Batch 02), `provenance`, `geometry` (full, for fit-bounds/highlight, within the viewer's tier), and `actions[]` capability flags (e.g. `canOpenRecord`, `canShowNearby`). Out-of-scope ids → **404**. Sections are data-driven so the drawer renders what exists and shows meaningful "not recorded" states for missing fields.

### 4.7 Data Health endpoint `GET /inframap/health`
Per accessible layer: `total`, `withGeometry`, `withoutGeometry`, `completenessPct`, `latestUpdatedAt` (from `updatedAt`), `demoCount`, `restrictedHiddenCount` (**count only**, Batch 02 rule), and for assets `neverInspected`/`overdueMaintenance`. Scoped identically to the layers. Powers the **Data Health panel** (§5.8) and the "N projects have no map location" popover.

---

## 5. FRONTEND

### 5.1 Single data pipeline (Step 90 core)
Refactor the six per-layer fetches into **one `useViewportData` pipeline** driven by the registry: inputs = enabled layers × quantized bbox × zoom bucket × global filters; output = per-layer `{status, data, error, truncated, total, updatedAt}`.
- **Debounce** `moveend` (~250 ms), **quantize** bbox (round outward to a grid that depends on zoom) so tiny pans reuse cached results; React Query keys = `[layer, bboxKey, zoomBucket, filtersKey]`; `placeholderData: keepPreviousData` so features don't flash; **AbortController** via React Query's `signal` and cancel on layer toggle; no requests for disabled/forbidden layers; `staleTime ~30 s`; ETag-aware (browser handles 304).
- **Padded fetch:** request bbox expanded ~25% beyond the viewport so small pans need no refetch; skip refetch when the new viewport is fully inside the last fetched padded bbox **and** zoom bucket + filters are unchanged.
- **Source updates:** `setData` only when the response identity changed; reuse the Batch 01 `ensureLayers` idempotent pattern; keep source ids stable; no layer rebuilds on toggle/filter. Use `promoteId`/stable `id`s so `feature-state` (hover/selected) survives data refresh; selected feature stays highlighted across refetches.
- **Dense data:** keep clustering on point sources (assets, projects, hazard markers); cap label density (`text-allow-overlap:false`, symbol-sort-key by priority); show conflict hotspots and the selected feature above everything. Thin out line/polygon detail via server `zoom` param.
- **Render budget:** no DOM markers; avoid React re-render per map frame (viewport readout via ref + rAF-throttled state); memoize registry-derived structures; lazy-load heavy UI (`next/dynamic`) for: command palette, Map Brief, Data Health, saved-views dialog, advanced filter panel body, drawer sections beyond Overview. Dispose sources/layers/images/listeners on unmount; verify no growth on repeated mount/unmount.
- **Dev-only perf HUD** (toggle with `?perf=1` **or** Ctrl+Shift+P, rendered only when `process.env.NODE_ENV !== "production"`): requests in flight, last fetch ms, features rendered per layer, cache hits, heap estimate if available. Strip from production builds. Small, optional, but useful for the demo-day verification and your own tuning.

### 5.2 Universal search UI (replaces the Batch 01 client-side search; same component slot)
- Search box in the sidebar header (desktop) and a full-width search bar/sheet (mobile). Debounced (~200 ms), min 2 chars, **abort stale**, loading skeleton rows, grouped result list by layer with icons, status/condition/band badges, match highlighting (bold the matched substring), **keyboard navigation** (↑/↓/Enter/Esc/Tab between groups), "No results" state with suggestions ("Try a project code, conflict number like RSC-2026-…, a district or an agency"), **recent searches** (local, max 8, clearable), clear (×) button, and a scope toggle **"This view · Everywhere"**.
- Selecting a result: if `geometryHint` → `flyTo`/`fitBounds` (reduced-motion → `jumpTo`), enable the target layer if it's off (and tell the user via a subtle toast "Roadworks layer turned on"), select + highlight, open the drawer; if `noLocation` → open a **record-only drawer** (no map move, "This record has no map location" banner + link). Agency result → applies the agency filter chip and fits to that agency's current visible extent (server-provided `bbox` in the facets/search result when available, else just filters). Place result → fit to place bbox + a temporary dashed outline.
- **Coordinate & Place Jump:** the same box detects `lat, lng` pairs (e.g. `7.2906, 80.6337`; accept `7.29N 80.63E`) → "Go to coordinates" result with a temporary pin; validate within the Sri Lanka bounds (+ margin) and say "Outside Sri Lanka" otherwise. Pure client-side; no external geocoder. Label honestly: internal records + provinces/districts only — **say that general street-address geocoding isn't included** (a code comment is enough; keep UI copy short, e.g. placeholder "Search projects, roadworks, conflicts, assets, agencies, districts…").

### 5.3 Command Palette (⌘/Ctrl-K) — unique function
A dialog (reuse `components/ui/dialog`) with a single input and sectioned results: **Records** (same as universal search), **Layers** ("Toggle Roadworks", "Focus Assets"), **Filters** ("Show only active projects", "Overdue roadworks", "Critical conflicts", "Needs attention assets"), **Views** (saved views, "Reset view"), **Actions** ("Copy share link", "Open Map Brief", "Toggle fullscreen", "Toggle legend", "Switch language: English / සිංහල / தமிழ்"). Commands come from a single typed `COMMANDS` registry (id, i18n label key, keywords, `run(ctx)`, `isAvailable(ctx)`), so every command **actually runs**. Opens on Ctrl/⌘-K and `/`; Esc closes; focus trap; `aria` roles (combobox/listbox). Mobile: a "⌘" button in the header opens it as a full-height sheet.

### 5.4 Advanced Filter Panel (Step 88)
- Place in the left sidebar as a collapsible **"Filters"** section (desktop) and a bottom sheet (mobile). Sections per layer group (only for layers the viewer can access), plus **Global** (Agency, Province → District dependent select, Date range with `react-day-picker` + quick presets "This month / Next 30 days / Next 90 days / Custom").
- Controls: multi-select chips/checkbox lists using `facets` options + live counts (counts update as other filters change; zero-count options disabled but visible), toggles (Overdue, Needs attention), segmented control for Open/Resolved conflicts, range presets, **search-within-options** for long lists (agencies).
- **Applied-filter chips bar** above the map (under the header): each chip removable (×), "Clear all", count badge on the Filters button, chips are keyboard accessible and announce changes via `aria-live`.
- **Result summary:** "Showing 312 features across 4 layers" (from current responses) + per-layer counts in the layer deck; **empty-filter state** on the map ("No features match these filters in this view" + [Clear filters] [Zoom to all matches (if the server can supply a bbox)]).
- **Filter presets** (one-click, built from the same filter schema): "Active work today", "Overdue roadworks", "Critical & high conflicts", "Assets needing attention", "High-risk zones & exposed work", "Unmapped projects". Each preset sets layers + filters (deterministic).
- Filter state is part of the workspace state (shape from Batch 01 `filters: Record<LayerId, LayerFilters>` + `global`), serialized to the URL (§5.7). Filters persist across pan/zoom and layer toggles; resetting restores defaults without touching viewport or selection.

### 5.5 Layer Manager (Step 89)
Evolve the Batch 02 "Layer deck":
- **Opacity sliders** per layer (0–100 %, accessible `<input type="range">` styled with tokens; keyboard arrows; applied via data-driven paint properties — multiply into existing opacity expressions, don't replace them; restored correctly on style reload and after Focus mode).
- **Drag-free reordering:** group order is fixed by registry `z`; provide **"Bring to front / Send to back"** buttons per layer within its group (changes `moveLayer` order inside allowed bounds; selection/highlight/hotspot layers always stay above). Persist order in the view state.
- Group master switches, per-layer visibility, **availability indicators** (available / locked / error / loading), count badges, DEMO/restricted-hidden notes, Focus button, **Reset layers** and **Presets** ("Operations", "Infrastructure", "Risk & Context", "All"), legend synced from the registry (shows opacity-adjusted swatches), "Show only this layer" shortcut.
- Changing visibility/opacity/order **never** destroys map state, selection or viewport and issues no unnecessary requests (toggle off = stop fetching; toggle on = fetch for the current padded bbox).

### 5.6 Feature Detail Drawer (Step 89) — reusable, replaces the quick view
One `FeatureDrawer` component, **registry-driven sections per layer kind**, consuming `/inframap/features/:layer/:id`:
- **Header:** type icon, title, ID/code, status/condition badge, provenance chip, close (×), pin/"Lock drawer" toggle (keep open while hovering other features), prev/next within the current search/overlap list when applicable.
- **Tabs/segments:** Overview · Related · Exposure · Nearby · Source/Provenance (+ History for maintenance/assessment where data exists). Tabs render only if the viewer's tier/data supports them; missing data shows meaningful states ("No inspection recorded", "No related conflicts").
- **Related:** linked projects/roadworks/conflicts/assets as selectable rows (select → fly + swap drawer; uses the Batch 02 history stack with **Back**); for conflicts, side A/B with RoadSync redaction rules; keep the "Open in RoadSync" link.
- **Actions:** Zoom to feature, Show nearby (Batch 02 lens), Highlight exposed (zones), **Copy link to this feature** (§5.7), **Open full record** (only where a real web route exists — **verify routes**; otherwise omit, no dead links), "Report data issue" is **out of scope**.
- **Behavior:** opens on selection; Esc and × close; switching features cross-fades without remount flicker; scroll-position reset per feature; fit-to-feature honoring drawer padding (`map.setPadding` / `fitBounds` padding so the feature isn't hidden under the drawer); on close, restore the previous map padding and keep the viewport. Access-denied/404 → inline "This record isn't available to your role" state (never reveals existence beyond that); network error → Retry. Skeletons while loading.
- **Desktop:** right panel (~380 px, resizable between 340–520 px with a keyboard-accessible handle); **Tablet:** overlay panel; **Mobile:** bottom sheet (§5.9).

### 5.7 Shareable Map Links (unique function) + Saved Views
- **URL state** via `useSearchParams` + `router.replace` (no history spam; debounce 400 ms): `ll=lat,lng` (5 dp), `z`, `layers=` (CSV of enabled layer ids), `op=` (non-default opacities `layer:0.6,…`), filter params (same names as §4.3), `sel=layer:id`, `fs=1` for focus mode (optional). Parse on load with zod; **ignore unknown/invalid values safely**; clamp to Sri Lanka bounds; never trust URL values beyond validation. Opening a link: restore view/layers/filters; if `sel` is present, fetch the detail via the normal authorized endpoint — if forbidden/404 show a non-revealing toast "Shared feature isn't available to your role" and proceed with the rest of the view.
- **Copy link** button (header) + palette command; uses Clipboard API with a graceful fallback (select-and-copy input in a popover). Toast "Link copied".
- **Saved Views:** local-only (`localStorage`, wrapped in try/catch, versioned key `infraos.inframap.views.v1`, max 12). Save current view/layers/filters/opacity with a name; list in a popover; apply, rename, delete; stored values re-validated on load. State clearly it's saved **on this device**. (A server-side store is a future enhancement — don't build it.)

### 5.8 Map Brief + Data Health (unique functions)
- **Map Brief** (dialog, lazy-loaded): a printable, authorization-safe summary of the **current viewport + filters**: counts per layer (from the already-fetched, already-authorized responses; refetch `facets` for exact counts), top 5 conflicts by severity, assets needing attention, hazard exposure summary, active filters, data sources/DEMO notice, "generated at hh:mm by <role> · scope: <agency>" footer, and a static map snapshot via `map.getCanvas().toDataURL()` **only if** the map was created with `preserveDrawingBuffer` (set it only while the Brief dialog is requested, or capture on the next `render` event — pick the approach that doesn't hurt performance; if capture fails, omit the image gracefully). **Print** button → `window.print()` with `@media print` styles scoped to the dialog (hide the app shell). No PDF library.
- **Data Health panel** (popover/dialog, lazy-loaded, `GET /inframap/health`): per-layer completeness meter (with-geometry %), freshness ("updated 2 days ago" with `date-fns` locale), DEMO counts, restricted-hidden **counts only**, and a list of "Unmapped projects" (cap 25, with links to existing project pages). This replaces and extends the Batch 01 no-location popover.

### 5.9 Mobile Map Experience (Step 91) — not a shrunken desktop
Breakpoints: **<640 phone**, **640–1023 tablet**, **≥1024 desktop**.
- **Phone layout:** full-bleed map under a compact header (title, search icon, ⌘/menu, filter badge). **Bottom navigation dock** (floating, 56 px): Layers · Filters · Search · Legend/Menu. Each opens a **bottom sheet**.
- **Bottom sheet component** (`components/inframap/bottom-sheet.tsx`, built on existing `sheet`/portal + pointer events): three snap points (**peek ~96 px / half ~50 % / full ~92 %**), drag handle with pointer capture, velocity-based snapping, tap-outside to collapse, Escape closes, focus trap, `aria-modal`, `inert`/focus return, **safe-area insets** (`env(safe-area-inset-bottom)`), body scroll lock only when full; drawer content scrolls internally and only drags the sheet from the handle/header (avoid scroll-vs-drag conflicts). Reduced-motion: snap without animation.
- **Feature drawer on mobile** = bottom sheet starting at **peek** (title + status + 2 key facts + primary actions), swipe up → half/full for tabs; **map padding** adjusts to the sheet height so the selected feature stays visible above the sheet; closing restores padding. Tapping the map while the sheet is at half collapses it to peek.
- **Touch-first controls:** ≥ 44×44 px targets; floating controls moved to the right edge above the dock (zoom, reset, locate Sri Lanka, fullscreen); no hover-only affordances (hover popup replaced by tap-select); overlap chooser as a bottom list; cluster tap expands; **long-press** on the map drops a coordinate pin with "What's nearby?" (reuses the Nearby lens at 100 m; pin/lens state follows the Batch 02 rules).
- **Compact filters:** the Filters sheet shows chips-first with an "Apply" sticky footer for heavy edits (or live-apply on desktop); applied-chips bar collapses into a single "N filters" pill that opens the sheet.
- **Search on mobile:** tap the search icon → full-screen search sheet with keyboard-friendly input (`inputMode="search"`, `enterkeyhint="search"`), recent searches, results; selecting returns to the map with the drawer at peek.
- **Legend** readable on small screens (2-column grid in the sheet), attribution compact but always visible, status bar condensed to counts + DEMO ribbon + truncated notice.
- **Performance on mid-range phones:** lower default `limit` (e.g., 300/layer) and larger bbox quantization on `<640` / when `navigator.connection.saveData` or `hardwareConcurrency <= 4`; `pixelRatio` capped at 2; clustering radius tuned; skip pulse animations when `prefers-reduced-motion` **or** low-power heuristics.
- **Orientation/resizing:** call `map.resize()` on container size changes (`ResizeObserver`), preserve center on rotation.

### 5.10 Modern UI/UX polish (apply across the workspace; build on existing tokens)
- Refined surfaces (soft glass headers over the map with `backdrop-filter` + solid fallback), 8-pt rhythm, consistent radii/elevation, compact controls, subtle micro-interactions only (150–250 ms CSS transitions; chips pop-in, drawer slide, sheet snap), skeletons for every async region, tabular numerals for counts, truncation with tooltips, consistent iconography via `lucide-react` + canvas sprites.
- **Keyboard & shortcuts** (listed in a "?" help dialog): `⌘/Ctrl-K` palette, `/` search, `Esc` close/clear, `L` layers, `F` filters, `G` legend, `R` reset view, `[`/`]` previous/next selection (history), `Shift+F` focus. Shortcuts disabled while typing in inputs.
- Accessibility: visible focus rings, roles/labels for all custom widgets (combobox, listbox, slider, tablist, dialog), `aria-live` for search result counts/filter changes/selection changes, color never the only signal, contrast checked via existing contrast helpers.
- **i18n:** extend `copy.ts` with **complete en/si/ta** strings for every new UI string, command label, filter label/option (enums, provinces, districts), error/empty state, aria-label, date phrase (`date-fns` locale). Don't translate stored names. Verify long Sinhala/Tamil strings don't overflow buttons/chips/tabs (wrap or truncate with tooltip). Flag uncertain translations in the report.

---

## 6. PERFORMANCE & HARDENING CHECKLIST (do what the baseline justifies)

1. **Baseline vs after** (report numbers): requests/pan, bytes/pan, time-to-first-feature, features on screen, JS heap after 20 pans + 10 layer toggles.
2. No duplicate requests for identical key; stale responses never overwrite newer ones (verify by throttling network in DevTools and panning quickly).
3. Single pipeline, stable source ids, `setData` only on change; no layer rebuilds on toggle/filter/opacity.
4. Server payload trimmed (`fields=min`, coordinate rounding, zoom-based simplification) — show payload size before/after in the report.
5. Memory hygiene: remove listeners/sources/images on unmount; verify exactly one canvas after navigating away/back 10×.
6. Style reload (`style.load`) restores layers, images, opacity, order, filters and selection highlight.
7. Tile/basemap failure banner (Batch 01) still works; data layers render without basemap.
8. Rate limiting on `/search`, `/facets`, `/health` (tighter than layer reads); input length caps; `maxTimeMS` on every aggregate/regex query; no unbounded `$regex` scans — if a query can't be bounded, require the prefix.
9. Security re-check: search/facets/health/detail/brief/links leak **no** unauthorized records, geometry, counts, or existence (see §7 tests).

---

## 7. ESSENTIAL VERIFICATION ONLY

**Automated (small; existing vitest patterns; no new frameworks):**
- API (`mongodb-memory-server`): `/search` — min length, regex-escape (`.*`, `(`), ranking order (exact > prefix > contains), agency scoping, **restricted utility never matched or counted for unauthorized users**, noLocation flag for projects without geometry, groups capped, forbidden layer omitted; `/facets` — counts respect scope and exclude own facet; no counts for forbidden/hidden; `/health` — scoped, counts only for restricted; unified filter schema — OR within facet / AND across facets, date-overlap semantics, inverted/oversized range → 400, enum/CSV caps; `zoom`/`fields=min` payload shape + coordinate rounding; ETag 304 behavior; `/features/:layer/:id` for all six layers (tier projection, 404 for out-of-scope); `bbox` + filters combined.
- Web pure tests: URL state parse/serialize round-trip + invalid-input handling + clamping; bbox quantization/padded-containment helper; filter→query-string builder & preset definitions; coordinate-input parser (valid/invalid/out-of-bounds); command registry (every command has i18n label + `run`); bottom-sheet snap-point math; selection-history; saved-views validation. No component-render suites.
- Run: `npm run type-check`, `npm run lint`, `npm run test:api` (inframap + roadsync + touched), `npm run test:web`, `npm run build:web`, `npm run db:indexes:check`, `npm run db:seed:verify`.

**Manual (report outcomes):**
1. Users: platform admin; same-agency user; other-agency user; user lacking `map.layer.restricted`; user lacking `risk.read`.
2. Search: project name/code, `RSC-…` conflict no., asset name, agency, district, province, coordinates; keyboard nav; no-results; "This view/Everywhere"; unmapped project → record-only drawer; unauthorized user cannot find the restricted water main (also check the Network tab).
3. Filters: every control changes **server-side** results (verify query strings); chips remove/clear; presets work; counts update; empty state works; filters persist across pan/zoom/toggle; province→district dependency.
4. Layer manager: opacity, bring-to-front/back, group switches, presets, reset, Focus + opacity interplay, style-reload recovery.
5. Drawer: all six kinds; related-row navigation + Back; Zoom to; Show nearby; Highlight exposed; link copy; Esc/×; resize handle; 404/forbidden state; no dead links.
6. Share link: copy → open in a private window/other role → restored view/layers/filters; forbidden `sel` handled safely; garbage params ignored.
7. Command palette: every command runs; Saved Views save/apply/rename/delete; Map Brief renders and prints; Data Health matches counts.
8. Performance: before/after numbers (§6.1); rapid pan with throttled network shows no stale overwrite; single canvas after 10× mount cycles; `?perf=1` HUD absent in production build.
9. Mobile (375×812, 768×1024, landscape): dock, bottom sheets (peek/half/full), swipe, safe-areas, map padding with sheet open, long-press pin, 44 px targets, search sheet, filters sheet, legend; keyboard on iOS-like viewport doesn't hide the input.
10. en/si/ta: layout holds; stored data untranslated. Keyboard-only run-through of search, palette, filters, drawer.
11. Regression: Batch 01/02 behaviours (conflict evidence overlay, Exposure Check, Nearby lens, Focus, DEMO ribbon) and RoadSync's own map unchanged.

---

## 8. IMPLEMENTATION SEQUENCE (commit at each ✔; don't advance until it works)

1. Preflight + baseline profile + branch (§3, §10).
2. Backend: unified filter schema, gazetteer, `zoom`/`fields`/ETag/`total` on layer endpoints, index changes. ✔
3. Backend: `/search`, `/facets`, `/health`, all-layer `/features/:layer/:id`; essential API tests. ✔
4. Frontend pipeline: `useViewportData` refactor (padding, quantization, abort, keepPrevious), stable source ids, perf HUD (dev only); confirm Batch 01/02 behaviour unchanged. ✔
5. Universal search UI + coordinate/place jump + recent searches. ✔
6. Filter panel + chips + presets + facets counts + URL serialization of filters. ✔
7. Layer manager (opacity, order, presets, availability) + Focus interplay. ✔
8. Feature Detail Drawer (all six kinds, related, actions, padding) replacing quick view. ✔
9. Shareable links (full URL state), Saved Views, Command Palette, shortcuts/help. ✔
10. Map Brief + Data Health. ✔
11. Mobile: bottom sheet, dock, touch controls, long-press pin, compact filters/search, perf tuning. ✔
12. i18n (si/ta) completion + visual/a11y polish + responsive pass (375/768/1280). ✔
13. Verification (§7), baseline-vs-after numbers, cleanup, push, PR text. ✔

---

## 9. WHAT MUST NOT HAPPEN (quick self-check before pushing)
- A control that renders but does nothing · a dead link · a placeholder "coming soon".
- Any record, geometry, count or existence hint reaching a user who shouldn't have it (search, facets, health, brief, share link, detail).
- A second map instance, second fetch path or second state store.
- New dependencies, AI features, external geocoders, bundled/real datasets, secrets in the repo.
- Unbounded regex/aggregate queries; unvalidated URL/query input; unescaped user text in a regex.
- Stale responses overwriting newer ones; leaked listeners/sources; layers rebuilt on toggle.
- Colour-only encodings; hover-only mobile interactions; tap targets < 44 px on phones.

---

## 10. GITHUB WORKFLOW

- **Base:** `development` once Batches 01 and 02 are merged; otherwise follow §3.2.
- **Branch:** `feature/phase8-inframap-advanced-gis` (adapt to repo convention).
- **Commits (Conventional Commits, one per ✔):**
  1. `feat(inframap): unified filter schema, gazetteer and viewport payload controls (Steps 88, 90)`
  2. `feat(inframap): permission-safe search, facets, health and all-layer feature detail APIs`
  3. `perf(inframap): single viewport data pipeline with padding, quantization and abort (Step 90)`
  4. `feat(inframap): universal search, coordinate jump and recent searches (Step 88)`
  5. `feat(inframap): advanced filter panel, chips, presets and facet counts (Step 88)`
  6. `feat(inframap): layer manager with opacity, ordering and presets (Step 89)`
  7. `feat(inframap): reusable feature detail drawer (Step 89)`
  8. `feat(inframap): shareable links, saved views, command palette and shortcuts`
  9. `feat(inframap): map brief and data health panels`
  10. `feat(inframap): mobile bottom sheets, dock and touch controls (Step 91)`
  11. `feat(inframap): si/ta copy and responsive/a11y polish`
  12. `test(inframap): search, filter, facet and URL-state essentials`
- Before each commit: type-check + lint touched workspaces. Never commit `.env*`, secrets, datasets or `node_modules`.
- **Push:** `git push -u origin <branch>` (no force). **Do not merge.** Open a PR into `development` (squash): title `feat(inframap): Phase 8 Batch 03 — search, filters, drawer, viewport performance and mobile (Steps 88–91)`; body = shipped features per step, new endpoints, index changes, performance before/after, security checks, verification results, known gaps. If you can't open the PR, give me the exact title/body.

---

## 11. COMPLETION CRITERIA (Phase 8 is done when all are true)

- [ ] **Search:** server-side, permission-safe, grouped, keyboard-navigable; records + agencies + districts/provinces + coordinates; noLocation handled honestly; restricted data never matched or counted.
- [ ] **Filters:** every filter in the roadmap list works server-side with OR/AND semantics, dependent province→district, date-range overlap, chips, presets, live facet counts, reset, empty states; filters persist across pan/zoom/toggles and combine with bbox.
- [ ] **Layer manager:** visibility, group switches, opacity, front/back ordering, presets, availability/locked/error states, legend sync, reset — without destroying map state or issuing needless requests.
- [ ] **Drawer:** one reusable component for all six layers with Overview/Related/Exposure/Nearby/Source, actions, Back history, padding-aware fit, forbidden/404/error states, no dead links.
- [ ] **Viewport queries & performance:** one pipeline; padded + quantized bbox, debounced, abortable, cached, ETag-aware; zoom-based simplification, rounding, `fields=min`, truncation with totals; no stale overwrites; no leaks; before/after numbers reported.
- [ ] **Mobile:** bottom-sheet system with snap points, dock, touch controls, long-press pin, compact filters/search, safe areas, map padding, 44 px targets; all core features usable at 375 px.
- [ ] **Unique functions:** Command Palette, Shareable Links, Saved Views, Coordinate/Place Jump, Map Brief (printable), Data Health — all functional and permission-safe.
- [ ] en/si/ta complete; a11y/keyboard/reduced-motion handled; unified operation of all six layers with Batch 01/02 features intact; RoadSync unaffected.
- [ ] No new dependencies, no AI, no external geocoder, no real datasets; type-check, lint, targeted tests, indexes check, seed verify and `build:web` pass; branch pushed; PR text ready.

---

## 12. FINAL REPORT (short) — Phase 8 wrap-up

(1) Preflight findings, deviations from §2 and the Batch 02 report; (2) what shipped per step (88/89/90/91) and per unique function; (3) endpoints/indexes added; (4) performance baseline vs after; (5) security checks performed and results; (6) verification results (commands + manual checklist); (7) uncertain translations and gazetteer bbox confidence; (8) known gaps/future enhancements (server-side saved views, real geocoding, vector tiles); (9) a **demo-day script** (≤ 12 steps, ~5 minutes) walking through the story: unmapped project → search → roadwork vs pipeline conflict → exposure to the DEMO flood zone → share link → mobile view.

Stop after the report. Phase 8 ends here.
