# INFRAOS — PHASE 8 · BATCH 01 (STEPS 81–84)
## InfraMap Foundation + Project Layer + Roadwork Layer + Conflict Visualization
### Claude Code implementation prompt — copy everything below into Claude Code from the repository root

---

## 0. ROLE AND MISSION

You are a senior full-stack engineer (Next.js/React, Express/Mongoose, GIS/MapLibre) working inside the existing **INFRAOS** monorepo. Implement **Batch 01 of Phase 8 (InfraMap: GIS Intelligence), Steps 81–84** in one cohesive, production-quality change set:

| Step | Deliverable |
|---|---|
| 81 | MapLibre + OpenStreetMap foundation, map architecture, base GIS workspace UI |
| 82 | Infrastructure **project** layer |
| 83 | **Roadwork** layer (RoadSync work requests) |
| 84 | Geographic **conflict** visualization (existing RoadSync conflict records) |

Batches 02 (assets, utilities, risks) and 03 (search, advanced filters, layer manager polish, detail drawer, bbox optimisation, mobile polish) will be built **on top of this batch**. Build the foundation so they plug in without rewrites. **Do not build Batch 02/03 features now**, but leave the extension seams defined in §6.

This is a university project with a deadline: working functionality and a premium look beat breadth. Every control you render must work. No decorative dead UI.

---

## 1. HARD RULES (non-negotiable)

1. **Inspect before you write.** Never invent paths, models, permissions, env vars, or helpers. Everything in §2 was observed during recon but you must re-verify each item you depend on.
2. **Do not duplicate RoadSync.** No new conflict collection, no new detection logic, no parallel workflow. InfraMap only *reads* existing RoadSync data and links to existing pages. The map never claims to detect conflicts itself.
3. **Server-side authorization only.** Unauthorized records must never reach the browser (no client-side filtering for security). Reuse the existing scope helpers; do not weaken them.
4. **Never invent locations.** A project without valid `geometry` is not drawn, not placed at a default coordinate, and is counted in a "no map location" indicator.
5. **No new dependencies.** `maplibre-gl`, `@tanstack/react-query`, `lucide-react`, `date-fns`, `sonner`, `radix-ui`, `zod` are already installed. Use them. If you believe a package is unavoidable, stop and ask.
6. **No AI features, no unrelated refactors, no package upgrades, no heavy test suites, no extra Markdown reports.**
7. **Do not touch `main` or `development` directly.** Work on a feature branch (§9). Never force-push.
8. **Read `apps/web/CLAUDE.md` / `AGENTS.md` first.** It states this Next.js version has breaking changes: read the relevant guides in `apps/web/node_modules/next/dist/docs/` (App Router pages, client components, dynamic imports, metadata) before writing Next code.
9. Match existing conventions (Conventional Commits, file naming, error envelope, `noStore`, strict query parsing, i18n pattern, design tokens). Read neighbouring code and copy its style.

---

## 2. RECON FINDINGS TO RE-VERIFY (state at the time this prompt was written)

**Repo:** npm workspaces — `apps/web` (Next 16.3.8, React 19.2, Tailwind 4, shadcn/radix, `next build --webpack`), `apps/api` (Express 5, Mongoose 8, zod 4, vitest + mongodb-memory-server), `packages/shared-types`. Node ≥ 22.

**⚠ Branch/state prerequisite (critical).** At recon time:
- `main` and `development` contained RoadSync **through Steps 70–71**.
- The formal **conflict record** model/API (Steps 72–73) existed only on branch **`feature/phase7-roadsync-steps-72-73`** (head `5fea2a8`), not yet merged into `development`.
- Steps 74–80 did not exist in the repo.
Step 84 depends on the Step 72–73 conflict records. See §3 (Preflight) for what to do.

**Backend facts observed:**
- Routes mount in `apps/api/src/routes/v1.ts` under `/api/v1/...` (`/projects`, `/roadsync`, …). Auth helpers: `requireAuthenticated`, `requirePermission("...")`. Responses use `success(data, req.requestId)` / `failure(code, message, req.requestId)` envelopes; handlers call `noStore(res)` and reject unknown/repeated query keys (see `work-requests.routes.ts`).
- **Projects** (`modules/projects/models/project.model.ts`): `agencyId`, `projectType` (ROAD, WATER, ELECTRICITY, TELECOM, DRAINAGE, BRIDGE, BUILDING, PUBLIC_FACILITY, MULTI_INFRASTRUCTURE, OTHER), `status` (DRAFT, SUBMITTED, UNDER_REVIEW, REJECTED, APPROVED, ACTIVE, ON_HOLD, DELAYED, COMPLETED, CANCELLED), `location` (`district`, `province`, `locality`, `roadName`, `description` — **no lat/lng**), optional GeoJSON `geometry` with a `2dsphere` index, planned/actual dates, progress.
- **Geometry helper:** `shared/database/geometry.ts` — `validGeometry`, `geometryField`; supports Point / LineString / Polygon only; lon/lat order; |lon| ≤ 180, |lat| ≤ 90.
- **Project scoping:** `modules/identity/authorization/resource-scope.ts` — `resolveResourceScope(actor)` → `{kind: "none"|"agencies"|"platform"}`, `projectReadFilter(scope)`. `listProjects`/`readProject` live there. Check how `PROJECT_MANAGER` is narrowed and mirror it exactly.
- **Work requests** (`modules/roadsync/models/work-request.model.ts`): `projectId`, `agencyId`, required `geometry` (2dsphere), `workType` (ROAD_RESURFACING, ROAD_EXCAVATION, PIPELINE_INSTALLATION, ELECTRIC_CABLE_WORK, TELECOM_CABLE_WORK, DRAINAGE_WORK, UTILITY_REPAIR, BRIDGE_WORK, OTHER), `status` (DRAFT, SUBMITTED, PLANNED, APPROVED, ACTIVE, COMPLETED, CANCELLED — **there is no stored "DELAYED"**), `priority`, `plannedStart/End`, server-owned `assessment`, `conflictRecords` summary.
- **Existing roadwork map read:** `mapWorkRequests(actor, query)` in `work-requests.service.ts`, served at `GET /roadsync/work-requests/map` (permission `roadsync.work_request.read`, `readFilter(actor)` scoping incl. PROJECT_MANAGER narrowing, optional `bbox` via `$geoIntersects`, `MAP_FEATURE_CAP = 1000`, returns `truncated`). Web type `WorkMapData` in `apps/web/src/lib/roadsync/api.ts`.
- **Conflict records** (Steps 72–73, `roadsync/models/conflict-record.model.ts`, collection `roadsync_conflicts`): `conflictNo` (RSC-YYYY-NNNNNN), `recordType` (conflict|opportunity), `sides.a/b` (ref, title, agencyId, workType, dates), `hotspot` (Point, `2dsphere`), `district`, `overlapWindow`, `severity` (`severity.current.band/score`; bands info/low/medium/high/critical), `status` (`RECORD_STATUSES`), `affectedAgencies`, `agencyIds`. Read layer in `conflict-record.read.ts`: `accessFilter(Who)`, `listRecords`, `getDossier`, `getMap(w, id)` (evidence geometry), with other agencies' items passed through the redaction projection (`projectOther`). Routes: `GET /roadsync/conflicts`, `/conflicts/summary`, `/conflicts/:id`, `/conflicts/:id/map`, `/conflicts/:id/evidence.geojson` (permission constant `R` in `conflict-record.routes.ts` — verify its value, expected `roadsync.conflict.read`).
- **Permissions** (`packages/shared-types/src/permissions.ts`): `map.view.public`, `map.view.internal`, `map.layer.restricted` already exist and are assigned to several system roles in `identity/seed/system-role-permissions.ts`. Also `project.read`, `roadsync.work_request.read`, `roadsync.conflict.read`.
- **Demo data:** `database/seeds/demo/seed-work-requests.ts` seeds work requests using `GEO_ROAD_CORRIDOR` and `GEO_WATER_CORRIDOR_OVERLAP` (a road corridor and an overlapping water corridor) — the exact resurfacing-vs-pipeline story. Seeds run via `npm run db:seed:core|demo|verify`.

**Frontend facts observed:**
- `apps/web/src/components/roadsync/work-map.tsx` already uses MapLibre with an inline OSM raster `STYLE` (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`), `SRI_LANKA` bounds `[[79.4,5.8],[82.1,9.95]]`, and the layer-once/cleanup-on-unmount pattern; it also defines band colour usage via `@/lib/roadsync/assessment` (`BAND_COLOR`, `BANDS_ASC`). **Study it; extract reusable pieces rather than copying.** Do not break RoadSync's map.
- API client pattern in `lib/roadsync/api.ts`: `apiClient(..., {authenticated: true})`, `guard()` / `moved()` epoch + token checks (responses after sign-out are discarded). Reuse the pattern; do not bypass it.
- Staff nav lives in `components/auth/workspace-nav.ts` (items carry `i18n: {si, ta}`); protected route segments in `lib/auth/route-access.ts` (has `projects`, `roadsync`; has a test file). `components/layout/navigation-config.ts` contains a non-clickable "InfraMap" future-preview item — do not make that the live entry; use `workspace-nav.ts`.
- i18n: `useWorkspaceLocale()` from `lib/i18n/workspace-locale.ts` (locales `en`/`si`/`ta`); copy dictionaries like `lib/roadsync/assessment-copy.ts` (`getAssessmentCopy(locale)`). Env: `NEXT_PUBLIC_MAP_STYLE_URL` already exists in `.env.example`.
- Design tokens: `lib/design/brand-tokens.ts`, `design-tokens.ts`, `semantic-colors.ts`; shared UI in `components/ui`, `components/feedback`, `components/layout` (`page-container`, `page-header`, app shell/sidebar/header).

---

## 3. PREFLIGHT (do this first; report in ≤ 15 lines; then continue unless blocked)

1. `git status` clean? `git fetch origin`. Print current branch and `git log --oneline -5`.
2. Does `origin/development` contain the Step 72–73 conflict-record code? Check: `git ls-tree -r origin/development --name-only | grep conflict-record.model.ts`.
   - **If yes** → branch from `development`.
   - **If no** → **STOP and ask me** which option I want, giving exactly these choices: (A) I merge `feature/phase7-roadsync-steps-72-73` into `development` first; (B) branch from `origin/feature/phase7-roadsync-steps-72-73` and I accept the PR will include/depend on it; (C) build Steps 81–83 now and defer Step 84 until 72–73 land. Do not guess.
3. `npm install` if `node_modules` is missing. Confirm Node ≥ 22.
4. Re-verify every item in §2 you depend on (open the files). List any difference you find in the report.
5. Confirm `QUERY`/permission values: the `R` constant in `conflict-record.routes.ts`; which seeded roles hold `map.view.internal`, `project.read`, `roadsync.work_request.read`, `roadsync.conflict.read`.
6. Run `npm run db:seed:verify` (or the repo's documented seed flow) to learn what demo projects/work requests/conflicts exist locally. Check how many demo **projects have `geometry`**. If conflict records are missing for the demo corridors, create them through the **existing** detection/assessment flow (see `detection.routes.ts`, `assessment.routes.ts`, and the `scripts/step*-isolated-dev.ts` helpers) — never by inserting conflict documents by hand.
7. Read `docs/database/geospatial.md` and `docs/team/git-workflow.md`.

---

## 4. ARCHITECTURE TO IMPLEMENT

### 4.1 Backend — new module `apps/api/src/modules/inframap/` (thin read-only facade)

InfraMap owns **no collections**. It composes existing services into map-ready GeoJSON. Create:

```
modules/inframap/
  inframap.routes.ts      // router mounted at /inframap in routes/v1.ts
  inframap.schema.ts      // zod: strict query schemas (reject unknown + repeated keys)
  inframap.service.ts     // layer readers; reuse existing scope + read functions
  inframap.geo.ts         // bbox parse/validate, geometry simplify/cap helpers, GeoJSON feature builders
  inframap.types.ts
  inframap.test.ts        // essential tests only (§8)
```

**Guards on every route:** `requireAuthenticated`, `requirePermission("map.view.internal")`, **plus** the layer's underlying data permission checked inside the handler/service (`project.read`, `roadsync.work_request.read`, `roadsync.conflict.read`). `noStore(res)`, success/failure envelopes, rate limiter consistent with the roadsync read routes, never return stack traces or other agencies' internals.

**Endpoints (these are NEW names you are creating; mount under `/api/v1/inframap`):**

| Method + path | Purpose | Notes |
|---|---|---|
| `GET /inframap/layers` | Layer availability for the current user | Returns `[{id, available, reason?: "forbidden"\|"unavailable", featureCount?}]` for `projects`, `roadworks`, `conflicts`. Derived from the actor's permissions; one layer being forbidden never fails the others. Also returns `projects.withoutLocation` count (in-scope projects with no valid geometry). |
| `GET /inframap/projects` | Project GeoJSON FeatureCollection | Query: `bbox?` (`w,s,e,n`), `status?`, `projectType?`, `agencyId?`, `limit?` (default 500, max 1000). Uses `resolveResourceScope` + `projectReadFilter` (mirror PROJECT_MANAGER narrowing from existing project listing). Only docs with valid `geometry`. |
| `GET /inframap/roadworks` | Work-request GeoJSON FeatureCollection | **Refactor-and-reuse** `mapWorkRequests` / `readFilter` (export what you need; keep `GET /roadsync/work-requests/map` behaviour identical and its tests green). Add fields needed for InfraMap (below). |
| `GET /inframap/conflicts` | Conflict hotspot FeatureCollection (Point) | Built from existing `ConflictRecord` via `accessFilter(Who)` + the existing redaction projection. Query: `bbox?`, `band?`, `status?`, `recordType?`, `limit?`. Reuse `listRecords`/`rowOf` logic or share a small exported helper — **do not re-implement scoping or redaction.** Build `Who` the same way `conflict-record.routes.ts` does. |

Conflict **evidence geometry** (the two conflicting road segments) is **not** in the layer response. On selection the frontend calls the **existing** `GET /roadsync/conflicts/:id/map` and draws that. This avoids duplicating RoadSync logic and keeps the layer payload small.

**Feature property contracts (allowlist only; never spread a DB document):**

- Project feature: `id`, `code`/project number (verify field name), `title`, `projectType`, `status`, `agencyId`, `agencyName`, `district`, `province`, `progressPercent` (if present), `plannedStartDate`, `plannedEndDate`, `isDelayed` (status === "DELAYED"), `geometryType`. No budget, contractor, manager, or financial data.
- Roadwork feature: `id`, `workType`, `status`, `priority`, `plannedStart`, `plannedEnd`, `agencyId`, `agencyName`, `projectId`, `projectTitle`, `projectCode`, `maxBand`, `riskIndex`, `conflictCount`, **`isOverdue`** (derived server-side: `plannedEnd < now` and status not COMPLETED/CANCELLED — this is the "delayed roadwork" notion; document it as derived, not stored), `displayStatus` (`overdue` overrides for styling only).
- Conflict feature (Point = `hotspot`): `id`, `conflictNo`, `recordType`, `band`, `score`, `status`, `district`, `overlapStart`, `overlapEnd`, `sideA {title, agencyName, workType}`, `sideB {…}`, `affectedAgencyCount`, `isResolved`/`isClosed`. Other agencies' sides go through the **existing redaction** (titles/names may be masked exactly as RoadSync does today).

**Response envelope:** `{ type:"FeatureCollection", features, truncated:boolean, total?:number, generatedAt: ISO }`. Enforce caps; set `truncated:true` when hit. Coordinates are WGS84 lon/lat. Validate every geometry with `validGeometry`; skip (and count in `skipped`) any invalid geometry rather than failing the request. Use the existing `simplifyForTransport` from `roadsync/spatial.analysis.ts` for very long lines if it fits.

**bbox:** parse `w,s,e,n` as four finite numbers within range, `w<e`, `s<n`; reject otherwise (400). Antimeridian handling not needed for Sri Lanka. Query with `$geoIntersects` against the existing 2dsphere indexes (same polygon-building approach as `mapWorkRequests`). **Do not add new indexes** unless `db:indexes:check` shows a needed one is missing; if you add one, add it in the model and the indexes check script.

### 4.2 Frontend — route, state, map core

**Route:** `apps/web/src/app/inframap/page.tsx` (server component with metadata `InfraMap · INFRAOS`, `robots: noindex`) rendering a client workspace via `next/dynamic` with `ssr: false` for the MapLibre canvas only (avoid hydration problems and keep MapLibre out of the server bundle). Add `inframap` to the protected segments in `lib/auth/route-access.ts` (+ update `route-access.test.ts`) and add a live **InfraMap** entry (MapIcon, `i18n` si/ta) to `components/auth/workspace-nav.ts` with correct active-state handling. Gate the page by `map.view.internal` the way other pages gate by permission (inspect how e.g. work-request pages do it); show the existing forbidden/empty pattern if denied.

**Files (adapt names to conventions you observe):**

```
apps/web/src/
  app/inframap/page.tsx
  components/inframap/
    inframap-workspace.tsx        // layout shell: header, sidebar, canvas, quick view, status bar
    map-canvas.tsx                // owns the single MapLibre instance (dynamic-imported)
    map-controls.tsx              // zoom, reset view, fullscreen, locate-sri-lanka, scale/zoom/coord readout
    layer-panel.tsx               // layer toggles + legend (registry-driven)
    quick-filters.tsx             // per-layer status/band chips (server-side params)
    search-box.tsx                // see §4.5
    feature-popup.tsx             // hover/click popup content
    feature-quick-view.tsx        // right panel (desktop) / bottom sheet (mobile) — Batch 03 will evolve this into the full drawer
    overlap-chooser.tsx           // chooser when several features sit under the pointer
    map-status-bar.tsx            // attribution slot, counts, "updated hh:mm", refresh, no-location indicator
  lib/inframap/
    api.ts                        // guard()/moved() pattern; AbortSignal support
    types.ts                      // FeatureRef { layer, id }, layer ids, response types
    layer-registry.ts             // THE extension seam (see §4.4)
    map-style.ts                  // style resolution (§5)
    map-icons.ts                  // canvas-drawn sprite registration
    theme.ts                      // layer colours/dashes/symbols derived from design tokens
    geojson.ts                    // normalizers, bounds-of-feature, safe coordinate guards
    selection-priority.ts         // conflicts > roadworks > projects; pure + unit-tested
    copy.ts                       // en/si/ta strings
    use-map-data.ts               // React Query hooks per layer (abortable, keyed by layer+filters+bbox)
    use-inframap-state.ts         // workspace state (layers, filters, selection, viewport)
```

Reuse `components/ui`, `components/feedback` (loading/empty/error states), `components/layout` containers, toasts (`sonner`), and `lib/api/client`. Check whether a React Query provider exists under `components/providers`; reuse it.

### 4.3 Map lifecycle (the part that usually breaks — be strict)

- **One** MapLibre instance per workspace mount, created in `useEffect`, stored in a ref; `map.remove()` in cleanup; guard against React 19 strict-mode double mount (no duplicate sources/layers/listeners; keep `map.on` handlers referenced so they can be `off`'d).
- Sources/layers are created **once** after `load`, through the layer registry; data updates use `source.setData(...)`. Visibility uses `setLayoutProperty(id, "visibility", ...)` — never remove/re-add layers to toggle.
- Re-add custom sources/layers/icons on **`style.load`** so a style swap or reload restores everything (use a single `ensureLayers(map)` idempotent function that checks `getSource`/`getLayer` first).
- Viewport state lives outside React render loops (ref + throttled state for the readout). `moveend` (debounced ~250 ms) updates the bbox used by layer queries; `AbortController` cancels stale requests; React Query keys include the quantized bbox so identical viewports de-duplicate.
- Selection state: `selected: FeatureRef | null` + `hovered`. Highlight with feature-state or filter-based highlight layers; clearing selection removes highlight. ESC clears selection/closes the quick view.
- Respect `prefers-reduced-motion` for `flyTo`/pulse animation (use `jumpTo`/static ring).
- Map `error` events (tile failures) must not crash the page: show a non-blocking banner "Basemap tiles are unavailable — data layers still work" with a Retry action; data layers must still render on a blank background.

### 4.4 Layer registry (extension seam for Batches 02 and 03)

`layer-registry.ts` exports a typed `LAYER_DEFS` array. Each def declares: `id`, `group` ("operations" now; Batch 02 adds "infrastructure"/"risk"), i18n label key, default visibility, `z` order, `permissionLayerId` (matched against `/inframap/layers`), `fetcher`, `addToMap(map)`, `interactiveLayerIds`, `highlight(map, ref)`, `legend` (symbol + label key list), `quickViewKind`. **The workspace, layer panel, legend, click handler, and data hooks must be generated from this registry** — no per-layer branching in components — so Batch 02 can register `assets`, `utilities`, `risks` by adding defs only.

Z-order bottom→top: basemap → (reserved: risk polygons, utilities, assets) → project polygons/routes → project points/clusters → roadwork lines/zones → conflict evidence overlay → conflict hotspots → highlights → popups.

### 4.5 Search and filters in this batch (functional, not placeholders)

- **Search box:** functional client-side search over the *currently loaded* features of enabled layers (title, project code, conflict no., work type, district, agency name). Results grouped by layer, keyboard navigable, selecting a result flies to it, highlights it and opens the quick view. Label it honestly (placeholder: "Search loaded projects, roadworks, conflicts"). Batch 03 replaces the data source with a server-side universal search behind the same component props — design the component around a `search(query) => Promise<Result[]>` prop.
- **Quick filters** (server-side query params, chips with counts where cheap): projects → status; roadworks → status (+ "Overdue"); conflicts → severity band + status group (Open / Resolved). "Reset" clears them. Keep the filter state shape extensible (`filters: Record<LayerId, LayerFilters>`) for Batch 03's full panel.

### 4.6 Rendering specification (use MapLibre sources/layers — **no DOM markers**)

**Projects** — one GeoJSON source split by geometry type.
- Points: `cluster: true` (`clusterRadius ~50`, `clusterMaxZoom ~13`), cluster circles sized/stepped by count with count labels; click on a cluster zooms in (`getClusterExpansionZoom`). Unclustered points: circle layer + symbol glyph sprite by project-type group (road, water, power, telecom, building/bridge, drainage/other).
- LineStrings: casing + line; Polygons: low-opacity fill + outline.
- Status styling is **never colour-only**: status → colour **and** ring/outline style (e.g., ACTIVE solid ring, APPROVED/PLANNED dashed ring, ON_HOLD double ring, DELAYED warning outline + "!" badge sprite, COMPLETED faded with check badge, CANCELLED/REJECTED muted with strike pattern for lines). Define the table in `theme.ts` once; legend renders from the same table.

**Roadworks** — line casing + coloured line + status dash (`PLANNED/APPROVED` dashed, `ACTIVE` solid wide, `SUBMITTED` dotted, `COMPLETED` thin low-opacity, `CANCELLED` muted dashed, **overdue** = red hatch-style dash + warning badge at midpoint). Polygons = construction zones with hatched/transparent fill; Points = small square markers (distinct from project circles). Optional work-type accent in popup/legend, not required on the line.

**Conflicts** — hotspot Points: severity-coloured symbol with **distinct shape per band** (info=circle, low=circle+ring, medium=diamond, high=triangle, critical=triangle+pulse) using `BAND_COLOR` from `lib/roadsync/assessment`; resolved/closed/dismissed = grey hollow marker with check; `opportunity` records = green dashed treatment (matches RoadSync's existing convention). Pulse ring for high/critical only, cancelled under reduced motion. Conflict hotspots always render above roadworks.
- **On conflict select:** fetch existing `GET /roadsync/conflicts/:id/map`, draw returned side geometries in a dedicated `conflict-evidence` source (side A / side B in two contrasting colours + dashed connector, overlap emphasised), fit bounds with padding, show quick view with: conflictNo, band + score, status, district, overlap window ("overlaps 12 Jan – 20 Jan"), both sides (title, agency, work type, dates — redacted per RoadSync rules), affected-agency count, links. Clear evidence on deselect.
- **Quick-view actions:** "Open conflict in RoadSync" → the existing conflict/work-request detail route. **Verify which web route exists** (`apps/web/src/app/roadsync/...` has `work-requests` and `work-requests/[id]` today; a conflict dossier page may not exist). If no conflict page exists, link to the related work request's page (conflicts tab) and say so in your report; do not create a new conflicts module.
- Projects/roadworks quick-view links: `/projects/[id]/overview` and `/roadsync/work-requests/[id]` (verify exact routes).

### 4.7 Interaction behaviours (implement exactly)

| Situation | Behaviour |
|---|---|
| Hover a feature | Pointer cursor, subtle hover highlight, compact popup (title, status badge, agency). Touch: no hover; tap selects. |
| Click one feature | Select, highlight, fit/fly to it (keep zoom if already closer than needed), open quick view. |
| Click empty map | Clear selection. |
| Click several overlapping features | Show `overlap-chooser` listing them ordered by priority (conflict > roadwork > project) with layer icon + title; picking one selects it. Pure logic in `selection-priority.ts`. |
| Multiple conflicts at the same hotspot | Chooser lists all conflicts there (by band desc). |
| Click cluster | Zoom to expand. |
| Resolved conflict | Neutral marker; quick view shows resolution status and read-only history link; no "needs action" styling. |
| Conflict has no drawable evidence | Hotspot remains selectable; quick view shows "Detailed geometry isn't available for this record"; no crash. |
| Layer forbidden for the user | Layer row disabled with lock icon + tooltip "You don't have access to this layer"; no request is made for it. |
| API error / 403 on a layer | Layer row shows error state with Retry; other layers unaffected; toast on first failure only. |
| Empty result | Quiet inline hint "No roadworks match the current view/filters" with a "Clear filters" action. |
| Truncated result | Status-bar notice "Showing first N — zoom in or filter to see more". |
| Projects without location | Status-bar badge "N projects have no map location" opening a small popover listing them with links to their project pages (reuse the `/inframap/layers` count and, if cheap, an id/title list capped at 25 from an optional `includeMissing=1` param on `/inframap/projects`). |

### 4.8 Data freshness (no websockets)

Server is the source of truth. React Query: `staleTime ~30s`, refetch on window focus and on reconnect, optional 60 s refetch while the tab is visible, **manual Refresh** button with "Updated hh:mm" in the status bar. Changing a project's geometry/status or a work request's status is reflected on next refetch. Document this in a 3-line code comment, nowhere else.

---

## 5. MAP STYLE, TILES AND ATTRIBUTION

- `map-style.ts` resolves the style: if `NEXT_PUBLIC_MAP_STYLE_URL` is set and valid, use it; otherwise fall back to the inline OSM raster style (extract the constant from `work-map.tsx` into a shared module and have `work-map.tsx` import it — keep RoadSync's map working).
- Attribution is always visible (`© OpenStreetMap contributors`, plus the provider's attribution when a custom style is used). Use MapLibre's attribution control, compact on mobile.
- Explain in a short code comment: **OpenStreetMap is the data; tile servers are hosting services.** The public `tile.openstreetmap.org` server is for light/dev/demo use only and its usage policy forbids heavy or production-scale use, so deployments should set `NEXT_PUBLIC_MAP_STYLE_URL` to a compliant provider/self-hosted style. Do not hardcode any API key; do not add a key to the repo. Update `.env.example` comment for `NEXT_PUBLIC_MAP_STYLE_URL` accordingly (one or two lines).
- Sri Lanka initial view: `fitBounds` to the existing `SRI_LANKA` constant with padding and `maxBounds` slightly larger than the island (avoid scrolling to empty ocean). "Reset view" returns to it.

---

## 6. WORKSPACE UI/UX SPEC (premium GovTech, using existing design tokens)

**Desktop layout (≥1024 px):** full-height inside the existing app shell.
- *Top bar* (within page): title "InfraMap", breadcrumb, data-freshness chip, Refresh, fullscreen toggle.
- *Left sidebar (collapsible, ~320 px)*: search → layers (toggle switches, count badge, colour/shape swatch, per-layer quick-filter chips, loading/error/locked states) → legend (collapsible, generated from registry).
- *Center*: map canvas, rounded, subtle border/shadow, skeleton shimmer until `load`; floating control stack (zoom in/out, reset view, fullscreen, "locate Sri Lanka"), scale bar bottom-left, zoom + cursor coordinate readout in the status bar (toggleable).
- *Right quick view (~360 px)*: slides in on selection (CSS transition, respects reduced motion); header with type icon, title, status badge, ID, close button; sections vary by feature kind; primary action buttons at the bottom.
- *Status bar*: attribution, counts per enabled layer, "updated hh:mm", truncated/no-location notices.

**Tablet (640–1023 px):** sidebar becomes an overlay panel toggled from a floating "Layers" button; quick view as a right overlay.
**Mobile (<640 px):** full-bleed map, compact header, "Layers" floating button opening a bottom sheet, quick view as a bottom sheet with drag-to-dismiss (or tap-outside/close button), ≥ 44 px tap targets, map padding adjusted when a sheet opens (`map.setPadding`/`fitBounds padding`). Keep it functional and clean now; Batch 03 does the full mobile polish and bottom-sheet refinements.

**Visual language:** clean surfaces, strong hierarchy, compact controls, tokens from `lib/design` (no new random hex values outside `theme.ts`, where each colour is derived from or checked against the existing tokens and contrast helpers). Subtle Sri Lankan identity only in accents (do not use flag colours on the map). Never colour-alone (shapes, dashes, badges, labels). Visible focus rings; all controls keyboard accessible with `aria-label`s; dialogs/sheets trap focus and close on Escape; live-region announcement when selection changes.

**Multilingual:** `copy.ts` with complete `en`, `si`, `ta` dictionaries for every visible string (layer names, statuses, filter chips, legend, empty/error/forbidden messages, buttons, aria-labels, date phrases). Use `useWorkspaceLocale()`. Use `Intl.DateTimeFormat`/`date-fns` with the active locale for dates. **Do not translate stored data** (project titles, agency names, conflict numbers). Test layout with the longest (Sinhala/Tamil) strings: no clipped buttons; allow wrapping. Provide accurate Sinhala/Tamil wording using the terminology already present in the app (search existing `i18n` entries such as "ව්‍යාපෘති"/"திட்டங்கள்" for Projects and reuse it); keep any uncertain translation simple and flag it in your report.

---

## 7. IMPLEMENTATION SEQUENCE (follow in order; commit at each ✔)

1. **Preflight + branch** (§3, §9).
2. **Backend geo core:** `inframap.geo.ts` (bbox parse, geometry guard, feature builders) + schema. ✔ *commit*
3. **Backend layers:** extract/reuse scope + read functions (small exported refactors in `work-requests.service.ts` and `conflict-record.read.ts` only if necessary, with existing tests still green); implement `/inframap/layers`, `/projects`, `/roadworks`, `/conflicts`; mount in `routes/v1.ts`; essential API tests. ✔ *commit*
4. **Frontend core:** map style module (+ refactor `work-map.tsx` to share it), `map-canvas`, controls, lifecycle, registry skeleton, theme/icons, state hook, route + nav + route-access. Map loads Sri Lanka with working controls, fullscreen, attribution, error banner. ✔ *commit*
5. **Project layer** (Step 82) end-to-end incl. clustering, status styling, popup/quick view, no-location indicator. ✔ *commit*
6. **Roadwork layer** (Step 83) end-to-end incl. overdue derivation, overlap chooser, link to RoadSync. ✔ *commit*
7. **Conflict layer** (Step 84) end-to-end incl. evidence overlay via existing `/roadsync/conflicts/:id/map`, forbidden/error states, resolved styling. ✔ *commit*
8. **Search + quick filters + legend + freshness/refresh + i18n pass (si/ta) + responsive pass.** ✔ *commit*
9. **Verification (§8), fix issues, final cleanup, push, PR text (§9).** ✔ *commit*

Do not start step N+1 until N works in the browser/API.

---

## 8. ESSENTIAL VERIFICATION ONLY

**Automated (small, targeted — match existing vitest patterns; no new framework):**
- API (`inframap.test.ts`, using the existing mongodb-memory-server setup):
  - bbox parser accepts valid / rejects malformed, reversed, out-of-range values; unknown/repeated query keys → 400.
  - `/inframap/projects`: returns only in-scope agency projects; project with no geometry excluded and counted; a user from another agency receives none of the first agency's features; a user without `map.view.internal` → 403.
  - `/inframap/roadworks`: same scoping as `/roadsync/work-requests/map`; `isOverdue` derivation; cap + `truncated`.
  - `/inframap/conflicts`: agency scoping + redaction of the other side; no records for an unrelated agency; forbidden when lacking `roadsync.conflict.read` while other layers still load.
  - Allowlist check: response properties contain no fields outside the contracts (e.g., no budget/financial data).
- Web: pure unit tests for `selection-priority.ts`, bbox quantization/query-key helper, geometry bounds helper, and the `route-access` update. No component-render test suites.
- Run: `npm run type-check`, `npm run lint`, `npm run test:api` (at least the roadsync + new inframap tests), `npm run test:web`, `npm run build:web`. Fix everything you introduced; do not “fix” unrelated pre-existing failures — list them.

**Manual (state the results in your final report):**
1. Seed/demo data loaded; sign in as two users from different agencies and a user without map permission.
2. `/inframap` shows Sri Lanka; zoom buttons, wheel, drag, double-click, touch emulation, reset, fullscreen, scale, attribution all work.
3. Projects: markers/lines/areas render; clustering expands on click; status legend matches styling; project without geometry is **not** drawn and appears in the "no map location" popover.
4. Roadworks: statuses styled; overdue example (temporarily adjust a demo work request's dates via the normal app flow or seed data) is flagged; overlapping features open the chooser.
5. Conflicts: the demo road-resurfacing vs water-pipeline corridors show a hotspot; click → evidence geometries for both sides, quick view details, link to RoadSync works; a user from an unrelated agency does not see it; resolved styling verified if a resolved record exists.
6. Layer toggles hide/show without losing selection/viewport; forbidden layer shows locked state; offline/blocked tiles → banner appears and data layers still render.
7. Switch language en/si/ta: labels translate, layout holds; stored titles untouched.
8. Browser DevTools: 375 px and 768 px widths; no console errors/warnings from your code; navigating away and back leaves no duplicate map/listeners (check there is exactly one canvas, no memory growth on repeated mount).
9. Existing RoadSync map (`work-map.tsx`) still works.

---

## 9. GITHUB WORKFLOW

- **Base branch:** `development` (per `CONTRIBUTING.md`), **provided it contains the Step 72–73 conflict-record code** — otherwise follow §3.2 and wait for my answer.
- **Branch:** `feature/phase8-inframap-foundation-layers` (adapt if the repo's actual convention differs; recent example: `feature/phase7-roadsync-steps-72-73`).
- **Commits (Conventional Commits, one per ✔ in §7), e.g.:**
  1. `feat(inframap): bbox, geometry guards and GeoJSON feature builders (Step 81)`
  2. `feat(inframap): scoped project, roadwork and conflict layer APIs (Steps 82-84 backend)`
  3. `feat(inframap): MapLibre workspace foundation, layer registry, controls and routing (Step 81)`
  4. `feat(inframap): infrastructure project layer with clustering and quick view (Step 82)`
  5. `feat(inframap): roadwork layer with overlap chooser and RoadSync links (Step 83)`
  6. `feat(inframap): conflict visualization with evidence overlay (Step 84)`
  7. `feat(inframap): search, quick filters, legend, i18n and responsive pass`
  8. `test(inframap): essential scope, bbox and selection tests`
- **Before each commit:** type-check + lint on touched workspaces. Never commit `.env*`, secrets, or `node_modules`.
- **Push:** `git push -u origin feature/phase8-inframap-foundation-layers` (no force). **Do not merge.** Do not push to `main`/`development`.
- **PR (open into `development`, squash-merge expected):** title `feat(inframap): Phase 8 Batch 01 — GIS foundation, projects, roadworks, conflicts (Steps 81–84)`; body = what shipped, endpoints added, permissions used, files refactored in RoadSync (and proof the old behaviour is unchanged), manual verification checklist results, known gaps. If you cannot open the PR (no GitHub credentials in this environment), say so and give me the exact title and body to paste.

---

## 10. COMPLETION CRITERIA (all must be true)

- [ ] `/inframap` is reachable from the staff nav, permission-gated, and shows an interactive OSM-based map of Sri Lanka with working zoom, reset, fullscreen, scale, attribution, loading and tile-failure recovery.
- [ ] Exactly one MapLibre instance; clean unmount; layers restored after `style.load`.
- [ ] Project layer renders points (clustered), lines and polygons from stored geometry; status/type styling not colour-only; projects without geometry never drawn and are counted.
- [ ] Roadwork layer renders RoadSync work-request geometries (points/lines/zones) with status styling and a derived overdue flag; links to the existing work-request page.
- [ ] Conflict layer renders existing RoadSync conflict hotspots with severity shapes/colours, resolved styling, evidence overlay from the existing endpoint, redaction preserved, links to RoadSync.
- [ ] Overlap chooser, cluster expansion, selection highlight, popup and quick view all work; ESC and close button work.
- [ ] Functional client-side search over loaded features and server-side quick filters with reset.
- [ ] Layer panel + legend are registry-generated; Batch 02 can add layers by adding registry defs only.
- [ ] All new endpoints are authenticated, permission-checked, agency-scoped server-side, capped, strictly validated, allowlisted, `no-store`; no unauthorized features reach the browser.
- [ ] en/si/ta complete for all new UI strings; responsive at 375 / 768 / 1280 px.
- [ ] No new dependencies, no duplicate RoadSync logic/collections, RoadSync's existing map and tests unaffected.
- [ ] Type-check, lint, targeted tests and `build:web` pass; branch pushed; PR text ready.

---

## 11. FINAL REPORT (keep it short)

Reply with: (1) preflight findings and any deviation from §2; (2) what was built per step; (3) endpoints added; (4) RoadSync refactors made; (5) verification results (commands + manual checklist outcome); (6) known gaps or items needing my decision; (7) **Batch 02 handoff notes**: the exact registry file/shape, the feature-property conventions, the selection-priority hook, the quick-view section pattern, the `/inframap/layers` availability contract, and how permission-gated layers are expected to behave — so the Batch 02 prompt can build directly on what actually exists.

Stop after the report. Do not start Batch 02.
