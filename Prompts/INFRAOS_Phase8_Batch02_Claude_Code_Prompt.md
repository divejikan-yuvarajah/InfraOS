# INFRAOS — PHASE 8 · BATCH 02 (STEPS 85–87)
## InfraMap Assets + Utilities + Risk Layers — "Context Intelligence" release
### Claude Code implementation prompt — copy everything below into Claude Code from the repository root

---

## 0. ROLE AND MISSION

You are a senior full-stack engineer (Next.js/React, Express/Mongoose, GIS/MapLibre) and product-minded UI engineer working inside the **INFRAOS** monorepo. Implement **Batch 02 of Phase 8 (InfraMap), Steps 85–87**, extending the workspace delivered in Batch 01:

| Step | Deliverable |
|---|---|
| 85 | Infrastructure **asset** layer (roads, bridges, buildings, public facilities, other) |
| 86 | **Utility** layer (water, drainage, electricity, telecom) with sensitive-geometry protection |
| 87 | **Risk** layer (hazard zones + project risk) with provenance and exposure checks |

On top of the three layers this batch ships four **signature functions** that make InfraMap more than a map (§5): **Exposure Check**, **Nearby Context Lens**, **Needs-Attention Lens** (asset health + maintenance), and **Provenance & Trust badges** with **Focus mode**. These are all deterministic, database-backed features — **no AI, no prediction**.

Batch 03 (universal search, full filter panel, layer-manager polish/opacity, reusable detail drawer, bbox optimisation, full mobile polish) comes later. Do **not** build it, but keep the seams it needs.

Deadline-driven university project: working functionality and a premium look beat breadth. **Every control you render must work.**

---

## 1. HARD RULES

1. **Inspect before you write.** Do not invent paths, models, permissions, env vars or helpers. Section 2 is recon from the repo at the time of writing — re-verify everything you depend on.
2. **Batch 01 is the foundation.** Build into the existing workspace: the **layer registry**, selection priority, quick view, `/inframap/layers` availability contract, theme/icons, React Query hooks, i18n `copy.ts`. **No second map, no parallel state, no per-layer branching in components.** Adding a layer = adding a registry definition + a service + a route.
3. **Never fabricate government data.** Hazard zones, utilities and assets shown on the map come from (a) existing InfraOS records, (b) an imported dataset with recorded provenance and licence, or (c) a small clearly-labelled **DEMO** set. Missing data ⇒ honest empty state, never invented features.
4. **Server-side authorization only.** Unauthorized records and unauthorized geometry never reach the browser. Utility data is **sensitive by default**.
5. **Do not duplicate RoadSync.** The Nearby Context Lens and Exposure Check are informational spatial lookups; they never create, score, or classify RoadSync conflicts and must be labelled as such.
6. **No new dependencies**, no AI features, no unrelated refactors, no package upgrades, no heavy tests, no extra Markdown reports (at most a ≤ 15-line section appended to `docs/database/geospatial.md` describing the hazard-zone collection and import script).
7. **Never touch `main` or `development` directly; never force-push.** Follow §10.
8. Read `apps/web/CLAUDE.md` / `AGENTS.md` before writing Next code (this Next.js version has breaking changes; consult `apps/web/node_modules/next/dist/docs/`).
9. Match existing conventions: Conventional Commits, error envelope, `noStore`, strict query parsing (reject unknown/repeated keys), allowlisted response properties, design tokens, `useWorkspaceLocale()` + copy dictionaries.

---

## 2. RECON FINDINGS TO RE-VERIFY

**Data model reality (observed):**
- **Asset** — `apps/api/src/modules/assets/models/asset.model.ts`, collection `assets`: `sourceProjectId`, `assetType` (`ROAD, WATER, ELECTRICITY, TELECOM, DRAINAGE, BRIDGE, BUILDING, PUBLIC_FACILITY, OTHER`), `name`, `location` (district/province/locality/roadName/description), optional GeoJSON `geometry` (`2dsphere`), `agencyId`, `condition` (`EXCELLENT, GOOD, FAIR, POOR, CRITICAL, UNKNOWN`), `healthScore` (percentage), `commissionedAt`, `lastInspectionAt`, `nextMaintenanceAt`. Schema is `strict: "throw"`. **There is no `status` field (use `condition`), no sensitivity field, and — as far as recon found — no asset HTTP routes, services or web pages yet.**
- **MaintenanceRecord** — `assets/models/maintenance-record.model.ts`: `assetId`, `maintenanceType`, `scheduledDate`, `completedDate`, `status` (`PLANNED, SCHEDULED, IN_PROGRESS, COMPLETED, OVERDUE, CANCELLED`), optional `cost`.
- **Utilities:** there is **no utility collection**. Utility-typed assets (`WATER, DRAINAGE, ELECTRICITY, TELECOM`) in `assets` are the only utility records. RoadSync detection already treats assets as candidates (`aType/bType: "asset"`), and `UTILITY_INTERFERENCE` exists as a conflict type — read how `detection.service.ts` loads asset items before deciding how to share logic.
- **Risk:** `modules/risk/models/risk-assessment.model.ts` is a **per-project** score (`projectId`, `overallRisk/delayRisk/budgetRisk/scheduleRisk` percentages, `factors`, `recommendations`, `modelVersion`, index `projectId+createdAt`). It has **no geometry**. **There is no hazard-zone/flood/landslide model.** `risk.constants.ts` only lists factor categories.
- **Issues:** `CitizenIssue` has `geometry` (2dsphere) and categories incl. `WATER_LEAK`, `DRAINAGE`, `UTILITY_DAMAGE`, `ROAD_DAMAGE` — usable later; **out of scope** now unless trivial (see §4.4 optional).
- **Permissions** (`packages/shared-types/src/permissions.ts`): `map.view.internal`, `map.view.public`, `map.layer.restricted`, `asset.read`, `asset.health.read`, `risk.read`, `project.read`, `roadsync.work_request.read`, `roadsync.conflict.read`. **Verify which seeded roles (`identity/seed/system-role-permissions.ts`) actually hold each**, especially `asset.read`, `asset.health.read`, `risk.read` and `map.layer.restricted`.
- **Scoping helpers:** `resolveResourceScope(actor)`, `projectReadFilter(scope)` (`identity/authorization/resource-scope.ts`), `readFilter(actor)` in `roadsync/work-requests.service.ts`.
- **Seeds:** `database/seeds/helpers/geometry.ts` (`GEO_BRIDGE_POINT`, `GEO_ROAD_CORRIDOR`, `GEO_WATER_CORRIDOR_OVERLAP`, …), `seeds/demo/*`, `reset-demo.ts` already deletes demo assets/maintenance records. Scripts: `db:seed:core|demo|verify|reset-demo`, `db:indexes:check`.
- **Geometry helper:** `shared/database/geometry.ts` (`validGeometry`; Point/LineString/Polygon only; lon/lat; ≤ 10 000 coordinates).

**Batch 01 contract (expected — verify against the actual code and the report below):**
`apps/api/src/modules/inframap/` (routes, schema, service, geo helpers, types, test); endpoints `GET /api/v1/inframap/layers|projects|roadworks|conflicts`; bbox parser; allowlisted feature-property contracts; `{type:"FeatureCollection", features, truncated, total?, generatedAt}` envelope; frontend `apps/web/src/components/inframap/*` and `apps/web/src/lib/inframap/*` with `layer-registry.ts`, `theme.ts`, `map-icons.ts`, `selection-priority.ts`, `copy.ts`, `use-map-data.ts`, `use-inframap-state.ts`, `feature-quick-view.tsx`, `overlap-chooser.tsx`, `map-status-bar.tsx`, layer panel + legend generated from the registry.

> **BATCH 01 FINAL REPORT (authoritative if present — paste here, otherwise derive everything from the code):**
> `[PASTE BATCH 01 REPORT / HANDOFF NOTES HERE]`

---

## 3. PREFLIGHT (report in ≤ 15 lines, then continue unless blocked)

1. `git fetch origin`; `git status` clean; print branch and `git log --oneline -5`.
2. Is Batch 01 merged into `origin/development` (look for `modules/inframap/inframap.routes.ts` and `components/inframap/inframap-workspace.tsx`)?
   - **Yes** → branch from `development`.
   - **No** → **STOP and ask me**: (A) I merge the Batch 01 PR first; (B) stack this branch on `feature/phase8-inframap-foundation-layers` (PR targets that branch or waits); (C) other. Do not guess.
3. `npm install` if needed. Run Batch 01's targeted tests to confirm a green baseline; list pre-existing failures without fixing them.
4. Read the real Batch 01 registry, theme, icons, quick view, state hook, `/inframap/layers` implementation. **Write down (in your report) the exact registry shape you will extend.** Where it differs from §2, adapt to the code, not to this prompt.
5. Confirm role↔permission matrix for `asset.read`, `asset.health.read`, `risk.read`, `map.layer.restricted`, `map.view.internal`. **If no seeded role holds `map.layer.restricted` (or `asset.read`/`risk.read` is held by too few roles to demo), stop and tell me what additive seed change you propose** (existing `sync-super-admin-permissions.ts` exists). Do not silently change role grants.
6. Check whether any non-demo asset/hazard data exists locally; list what demo assets already have geometry, `agencyId`, `condition`.
7. Read `docs/database/geospatial.md`, `docs/database/indexes.md`, `apps/api/src/scripts/check-indexes.ts`, `seeds/demo/seed-supporting-records.ts` (where assets are likely seeded), and `packages/shared-types/src/domain/enums.ts` (add shared enums there only if that is how asset/risk enums are shared today).

---

## 4. DATA MODEL EXTENSIONS (minimal, additive, explicit)

### 4.1 Asset: sensitivity (one optional field)
Add to `assetSchema`: `sensitivity: { type: String, enum: ["STANDARD","RESTRICTED"] }` (**optional, no backfill**). **Effective sensitivity** (single pure function `effectiveSensitivity(asset)` in `inframap.access.ts`): explicit value wins; otherwise `RESTRICTED` for utility types (`WATER, DRAINAGE, ELECTRICITY, TELECOM`) and `STANDARD` for everything else. Secure-by-default; demo seeds set explicit values.

### 4.2 Layer classification rule (document in one code comment)
- **Assets layer** = `assetType ∈ {ROAD, BRIDGE, BUILDING, PUBLIC_FACILITY, OTHER}`.
- **Utilities layer** = `assetType ∈ {WATER, DRAINAGE, ELECTRICITY, TELECOM}` (any geometry: pipes/cables as lines, facilities as points, service areas as polygons). Water/drainage *facilities* therefore appear under Utilities. Keep this in one `LAYER_OF_ASSET_TYPE` map used by backend and frontend legend.

### 4.3 New collection: `hazardZones` (the only new collection)
`apps/api/src/modules/risk/models/hazard-zone.model.ts`, collection `hazardZones`, `strict: "throw"`, timestamps:
- `name` (≤ 200), `description` (≤ 1000, optional)
- `hazardType`: `FLOOD, LANDSLIDE, COASTAL, INFRASTRUCTURE_DAMAGE, OTHER`
- `level`: `LOW, MEDIUM, HIGH, VERY_HIGH`
- `geometry` — required, `Polygon` (or `Point` for recorded incident markers); reuse `geometryField(true)`; `2dsphere` index; `{hazardType:1, level:1}` index
- `agencyId` — optional (set for agency-supplied datasets); `visibility`: `ALL_STAFF` (default) | `AGENCY`
- `source` (required object): `kind` (`OFFICIAL_PUBLIC | AGENCY_SUPPLIED | DEMO`), `organisation` (e.g. "National Building Research Organisation"), `datasetName`, `licence` (free text, required unless `DEMO`), `url` (optional), `dataDate` (optional date), `retrievedAt` (date), `notes`
- `externalId` (optional, unique-sparse per `source.datasetName` for idempotent re-imports)
- `isDemo` boolean derived from `source.kind === "DEMO"` (store it for cheap filtering and reset)
Add the indexes to `check-indexes.ts`. **Do not add a hazard CRUD UI/API** — read-only on the map; data arrives through the import script and the demo seed only.

### 4.4 Import script (provenance-enforcing, small)
`apps/api/src/scripts/import-hazard-zones.ts` + npm script `db:import:hazards`. Arguments: `--file <geojson>`, `--hazard-type`, `--level-property <name>` (mapping of feature property → level, with a `--level-map` JSON option), `--organisation`, `--dataset`, `--licence`, `--kind OFFICIAL_PUBLIC|AGENCY_SUPPLIED`, `--source-url`, `--data-date`, optional `--agency-id`, `--dry-run` (**default ON**; require `--commit` to write). Behaviour: stream-safe read, require all provenance args (refuse otherwise), validate every geometry with `validGeometry`, reject > 10 000 coordinates per feature (report, do not crash), report counts (read / valid / skipped / inserted / updated), upsert by `externalId`, **never** write `DEMO` through this script. Add a comment listing candidate **sources to *request* permission/data from** (e.g. National Building Research Organisation landslide hazard zonation, Disaster Management Centre / Irrigation Department flood extents) with the explicit note that access, format and licence are **unverified** and no dataset is bundled or scraped.

### 4.5 Demo seed (clearly labelled, small)
In `seeds/demo/`: 2 hazard zones with `source.kind: "DEMO"`, names prefixed `[DEMO]` (one flood polygon overlapping the existing demo road corridor `GEO_ROAD_CORRIDOR`, one landslide polygon away from it), 1 utility-typed asset line (water main) running along `GEO_WATER_CORRIDOR_OVERLAP` marked `RESTRICTED`, 1 `STANDARD` drainage point, 3–4 assets (a bridge using `GEO_BRIDGE_POINT` with condition `POOR` and an overdue `nextMaintenanceAt`, a road asset line, a public building point), each with a couple of `MaintenanceRecord`s where useful. Reuse the existing seed context/idempotency/guard helpers; extend `reset-demo.ts` and `verify-demo.ts` (hazard zones where `isDemo`). Do **not** override existing demo records. Every demo feature must show a visible **DEMO** badge in the UI (§5.4).

---

## 5. BACKEND — extend the `inframap` module

### 5.1 New endpoints (names are **new**, under `/api/v1/inframap`)
All: `requireAuthenticated`, `requirePermission("map.view.internal")`, plus the layer's data permission(s) checked in the service; strict zod query schemas (unknown/repeated keys → 400); `noStore`; envelope; rate limiter like the Batch 01 read routes; caps + `truncated`; allowlisted properties; invalid geometries skipped & counted.

| Endpoint | Purpose | Permission(s) beyond `map.view.internal` |
|---|---|---|
| `GET /inframap/assets` | Asset FeatureCollection | `asset.read` (health fields additionally need `asset.health.read`) |
| `GET /inframap/utilities` | Utility FeatureCollection + `restrictedHidden` count | `asset.read`; restricted geometry needs `map.layer.restricted` |
| `GET /inframap/risks` | Hazard zones + project-risk markers | `risk.read` |
| `GET /inframap/exposure` | Exposure Check for one feature or one zone (§6.1) | the permissions of every layer it reads, each applied independently |
| `GET /inframap/nearby` | Nearby Context Lens (§6.2) | per-layer, applied independently |
| `GET /inframap/features/:layer/:id` | **Quick-view detail** for the new layers (maintenance timeline, source metadata, exposure counts) | per layer; 404 (not 403) for out-of-scope ids to avoid existence leaks |

Extend `GET /inframap/layers` with `assets`, `utilities`, `risks`: `{available, reason?, featureCount?, restrictedHidden?, hasDemo?}`. A forbidden layer never breaks the others.

Common query params (extend the Batch 01 schema; keep names consistent so Batch 03 filters slot in): `bbox`, `limit`, plus — assets: `assetType`, `condition`, `attention=1`; utilities: `assetType`; risks: `hazardType`, `level`, `kind` (`hazard|project`), `projectLevel`.

### 5.2 Access policy (implement as pure, unit-tested functions in `inframap.access.ts`)
Define a **viewer tier** per feature: `FULL` | `AWARENESS` | `HIDDEN`.
- Platform-level actors (super admin / platform scope): `FULL` for everything they hold permissions for.
- Same-agency (in `resolveResourceScope` agencies): `FULL`.
- **Other agency, `STANDARD` feature, viewer holds `asset.read`:** `AWARENESS` — geometry, type, name, owning agency name, condition only. **Strip** `healthScore`, inspection/maintenance dates, maintenance history, `sourceProjectId`, and location description. (This single constant `CROSS_AGENCY_STANDARD_TIER = "AWARENESS"` is the policy knob; flipping it to `"HIDDEN"` gives strict own-agency-only. **Mention this knob and the tradeoff in your report so I can decide.**)
- **`RESTRICTED` feature:** only `FULL` if viewer holds `map.layer.restricted` **and** the feature is in their scope (or they are platform-level). Otherwise `HIDDEN` — geometry excluded **in the database query** (filter, don't post-process), and only a **count** (`restrictedHidden`) is returned so the UI can say "N restricted utility features are hidden for your role" without leaking positions. Never return centroids, bboxes or approximate locations of hidden features.
- Hazard zones: `ALL_STAFF` visible to anyone with `risk.read`; `AGENCY` visibility only for the owning agency scope. Project-risk markers follow project read scope (`projectReadFilter`) and the PROJECT_MANAGER narrowing used in Batch 01.
- `PROJECT_MANAGER` and other narrowed roles: mirror the exact narrowing used by the Batch 01 project endpoint.

### 5.3 Feature property contracts (allowlist; never spread documents)
- **Asset:** `id`, `layer:"assets"`, `assetType`, `name`, `condition`, `agencyId`, `agencyName`, `district`, `province`, `tier` ; FULL adds `healthScore` (if `asset.health.read`), `lastInspectionAt`, `nextMaintenanceAt`, `needsAttention`, `attentionReasons[]` (`CONDITION_POOR|CONDITION_CRITICAL|MAINTENANCE_OVERDUE|INSPECTION_STALE`), `sourceProjectId` + `sourceProjectTitle` (only if the project is in scope), `roadName`.
- **Utility:** same base as asset plus `utilityClass` (`water|drainage|electricity|telecom`), `sensitivity`, `tier`.
- **Hazard zone:** `id`, `layer:"risks"`, `kind:"hazard"`, `name`, `hazardType`, `level`, `description`, `source {kind, organisation, datasetName, licence, url, dataDate, retrievedAt}`, `isDemo`, `agencyName?`.
- **Project risk marker:** `kind:"project"`, `projectId`, `projectCode`, `title`, `overallRisk`, `riskBand` (derive LOW <34, MEDIUM <67, HIGH ≥67 — define once, same constants used for legend), `latestAssessedAt`, `modelVersion`. Representative point only (Point → itself; LineString → middle vertex; Polygon → centre of outer-ring bbox), computed server-side; skip projects without valid geometry.
- **Attention rule (single function, documented):** `needsAttention` if condition ∈ {POOR, CRITICAL}, or `nextMaintenanceAt < now`, or `lastInspectionAt` older than 365 days / missing for commissioned > 1 year. Reasons returned as codes, translated client-side.

### 5.4 Latest risk assessment per project
Aggregate scoped, geometry-bearing projects → latest `RiskAssessment` per `projectId` (`$sort createdAt desc` + `$group first`), cap by `limit`. Do not return `factors`/`recommendations` in the layer response; the detail endpoint may return top 3 factor *categories + scores* (no free text) for users with `risk.read`.

---

## 6. SIGNATURE FUNCTIONS (all must really work)

### 6.1 Exposure Check — "Is this work in a hazard zone?"
- **Feature → zones:** for a selected project / roadwork / asset / utility, query `hazardZones` with `$geoIntersects` on that feature's stored geometry (fetched server-side by id under the viewer's own scope — never accept client-supplied geometry for this). Return the intersecting zones (name, hazardType, level, source kind) + a worst-level summary.
- **Zone → exposed records:** for a selected hazard zone, return counts and capped lists (≤ 25 each) of **in-scope** projects, roadworks (work requests) and assets/utilities intersecting the polygon, each permission-checked and tier-projected independently.
- **UI:** quick view shows an **Exposure** card ("Intersects 2 hazard zones · worst: HIGH Flood") with chips that select the zone on the map; a zone's quick view shows an **Exposed records** card with tabs (Projects / Roadworks / Assets) whose rows select-and-fly to the feature. **Toggle "Highlight exposed"** on a zone draws its exposed features with a hatched halo using a temporary highlight source (cleared on deselect).
- Label: "Spatial overlap with recorded hazard data — not a prediction." State the dataset source/date next to the result.
- Empty states: "No hazard zones recorded here" must say **"No overlap with the hazard data currently loaded"**, not "safe".

### 6.2 Nearby Context Lens
- Quick-view action **"Show what's nearby"** on any feature opens a lens with a radius segmented control (**50 / 100 / 250 / 500 m**), draws a dashed radius/envelope on the map, and lists nearby **assets, utilities, hazard zones** grouped by layer with type icons, owner agency and relative direction/"approx. distance" **only if computed reliably** (otherwise omit distance; do not fake it).
- Server: `GET /inframap/nearby?featureLayer&featureId&radiusM=50|100|250|500&layers=assets,utilities,risks` — resolves the focal geometry server-side, builds the envelope = geometry bbox expanded by radius (document: approximate, envelope-based), queries each permitted layer with the same tier/sensitivity rules, caps 30 per layer. Hidden/restricted features contribute only a "N restricted features nearby are hidden" note.
- Banner on the lens: "Informational proximity lookup. Official coordination conflicts are managed in RoadSync." with a link to the related RoadSync page when the focal feature is a roadwork/conflict (reuse Batch 01 links). Never label results as conflicts.
- Selecting a result flies to it and swaps the quick view; a "Back to <original>" control restores the previous selection (small selection history stack, max 5, in the state hook).

### 6.3 Needs-Attention Lens (asset health + maintenance)
- Assets layer gets a **"Needs attention"** toggle (and a header counter). When on, non-attention assets dim; attention assets get a badge + soft pulse (static ring under reduced motion).
- Condition styling uses a 5-step ramp **plus shape/ring/badge** (not colour-only): EXCELLENT/GOOD plain, FAIR half-ring, POOR dashed ring + "!" badge, CRITICAL double ring + pulse, UNKNOWN hollow "?".
- Asset quick view (FULL tier): health score as a ring gauge, **maintenance mini-timeline** (last inspection → today → next maintenance; overdue segment highlighted; up to 5 most recent `MaintenanceRecord`s with status chips), related source project link (if in scope), attention reasons list. AWARENESS tier shows only the allowed fields plus a "More detail is visible to the owning agency" note.
- Summary strip in the layer panel: tiny stacked bar of loaded assets by condition (counts from the current response; clicking a segment applies that condition filter).

### 6.4 Provenance & Trust badges + Focus mode
- Every utility, asset and risk feature carries a **source/provenance chip**: `Live InfraOS record`, `Official dataset`, `Agency supplied`, `DEMO data`. Hazard zones show organisation, dataset, licence, data date and "retrieved" date in the quick view and a collapsible "About this data" section.
- A non-dismissible **DEMO ribbon** in the status bar whenever any visible feature is demo; DEMO features get a diagonal-hatch outline so they can't be mistaken for official data in screenshots.
- **Focus mode:** a button on each layer row ("Focus") dims all other layers (opacity ≈ 0.25) until released; ESC or a "Exit focus" chip restores. Purely client-side, via registry-driven paint-property changes (restore the exact previous values; survive style reload).

---

## 7. FRONTEND — extend the existing workspace (registry-driven)

### 7.1 Register three layers (Batch 01 registry)
Add defs for `assets`, `utilities`, `risks` (new groups: **Infrastructure** = assets + utilities, **Risk & Context** = risks; Batch 01 layers stay in **Operations**). Each def supplies: i18n label keys, default visibility (**off** by default; only operations layers stay on), `z` order, `permissionLayerId`, fetcher, `addToMap`, `interactiveLayerIds`, `highlight`, legend entries, quick-view kind. **Z-order (bottom→top):** basemap → risk polygons (hatched/transparent) → utility polygons → utility lines → asset polygons/lines → project geometry → roadworks → conflict evidence → conflict hotspots → asset/utility points → project-risk markers → highlights. Update `selection-priority.ts` (pure, with tests): conflict > roadwork > project > asset > utility > project-risk > hazard zone, with the overlap chooser listing all candidates under the pointer, **and zones always last** so large polygons never block point/line selection.

### 7.2 Rendering (MapLibre sources/layers only — no DOM markers)
- **Assets:** point sprites by type (road, bridge, building, facility, other) via `map-icons.ts` canvas sprites; line/polygon assets with casing; condition ring/badge variants as sprite variants (data-driven `icon-image` via `match`). Cluster dense points (`cluster: true`) with count bubbles that open at expansion zoom.
- **Utilities:** colour + **line style** per class (water = solid blue, drainage = dashed teal, electricity = dash-dot amber, telecom = dotted violet — final colours derived from tokens/contrast helpers); casing for readability; points as small hexagon sprites; polygons as outline + very light fill. Restricted-tier features show a lock glyph in the quick view only (they are only present when authorized).
- **Risks:** polygons with **fill-pattern hatches by level** (generated canvas patterns registered via `map.addImage`) + semi-transparent fill + coloured outline, so level is readable without colour alone (LOW sparse dots → VERY_HIGH dense cross-hatch). Hazard type shown by outline style + icon in legend (flood = wave glyph, landslide = slope glyph, etc.). Project-risk markers: ring sized by band with the band letter. Selected zone: thick animated-free outline + subtle glow layer.
- All custom images/layers are re-registered idempotently on `style.load` (use the Batch 01 `ensureLayers` pattern). Visibility via `setLayoutProperty`; never rebuild layers to toggle.
- Debounced `moveend` bbox requests with `AbortController` and bbox-quantized React Query keys (Batch 01 pattern) for each enabled layer; disabled/forbidden layers make **no** requests.

### 7.3 Modern UI/UX upgrades for this batch (build on existing tokens; no new design system)
- **Layer panel → grouped "Layer deck":** collapsible groups (Operations · Infrastructure · Risk & Context) with a group-level master switch, per-layer switch, colour+shape swatch, live count badge, **skeleton shimmer** while loading, inline error + Retry, **lock state** with tooltip for forbidden layers, "N restricted hidden" micro-note, Focus button, and per-layer quick-filter chips that animate in (CSS transitions only; respect `prefers-reduced-motion`).
- **Legend:** registry-generated, collapsible, grouped, shows the hatch patterns/line styles exactly as rendered on the map (render the same sprites/patterns into small canvases or SVGs; do not hand-maintain a separate legend).
- **Quick view upgrades:** glass-style header (type icon, title, ID, status/condition badge, provenance chip), segmented sections ("Overview · Exposure · Nearby · Source"), ring gauge, mini-timeline, tier banner for AWARENESS, sticky action row (Open record link where an existing page exists — **verify**: there may be no asset web page; if none, show no dead link and say "No detail page yet" only in the report, not in the UI). Mobile = bottom sheet (same component, existing Batch 01 behaviour); lens/exposure sections stack as accordions.
- **Status bar:** per-layer counts, DEMO ribbon, truncated notice, restricted-hidden notice.
- **Empty/error/forbidden states** for each new layer with i18n copy. Loading uses skeletons, not spinners over the map.
- Visual language: refined surfaces, 8-pt spacing, compact controls, 44 px mobile tap targets, visible focus rings, `aria-label`s, focus trap + Escape in sheets, `aria-live` announcements on selection and when Focus mode changes. Keep animation subtle and cheap.
- **i18n:** extend `copy.ts` with complete `en`/`si`/`ta` strings for: layer names, group names, asset types, conditions, utility classes, hazard types, levels, risk bands, attention reasons, provenance labels, tier notes, lens/exposure/focus UI, all empty/error/forbidden messages, aria-labels. Reuse existing Sinhala/Tamil terminology found in the app; flag uncertain translations in your report. Don't translate stored names/agency names/dataset names. Format dates with the active locale.

---

## 8. IMPLEMENTATION SEQUENCE (commit at each ✔; don't advance until it works)

1. Preflight + branch (§3, §10).
2. Data layer: `sensitivity` field, `hazardZones` model + indexes (+ `check-indexes`), `inframap.access.ts` pure policy functions. ✔
3. Services + routes: `/assets`, `/utilities`, `/risks`, extended `/layers`; essential tests for access policy and scoping. ✔
4. Seeds: demo assets/utility/hazards (+ reset/verify), import script. ✔
5. Frontend: register `assets` layer end-to-end (render, clusters, condition styling, quick view, Needs-Attention lens). ✔
6. Frontend: `utilities` layer end-to-end incl. restricted-hidden UX and tier banners. ✔
7. Frontend: `risks` layer end-to-end incl. hatch patterns, provenance, project-risk markers. ✔
8. Signature functions: `/exposure`, `/nearby`, `/features/:layer/:id`; Exposure card, Nearby lens, selection history, Focus mode, DEMO ribbon. ✔
9. Layer-deck/legend/quick-view UI polish, i18n (si/ta), responsive pass (375/768/1280). ✔
10. Verification (§9), cleanup, push, PR text. ✔

---

## 9. ESSENTIAL VERIFICATION ONLY

**Automated (small, existing vitest patterns):**
- `inframap.access` pure tests: effective sensitivity defaults (utility types restricted; roads standard); tier matrix (platform / same agency / other agency STANDARD / other agency RESTRICTED / lacking `map.layer.restricted`); AWARENESS projection strips `healthScore`, dates, `sourceProjectId`.
- API tests (mongodb-memory-server): `/utilities` never returns RESTRICTED geometry to a user lacking `map.layer.restricted` and returns only a count; other-agency STANDARD returns awareness properties only; `/assets` agency scoping + attention rule; `/risks` project-risk scoping and latest-assessment selection; `/exposure` feature→zones and zone→records respect scope and tier; `/nearby` respects tiers and radius whitelist (reject 37 m); one layer forbidden ⇒ others still return; unknown/repeated params → 400; allowlist check on properties; hazard geometry validation in the import script (dry-run default, missing provenance refused).
- Web pure tests: updated `selection-priority`, condition/level style tables (every enum value has a style + legend entry), attention-reason mapping, restore-previous-paint logic for Focus mode.
- Run: `npm run type-check`, `npm run lint`, `npm run test:api` (inframap + roadsync + any touched), `npm run test:web`, `npm run build:web`, `npm run db:indexes:check`, `npm run db:seed:demo` + `db:seed:verify` (and confirm `db:seed:reset-demo` removes demo hazards/assets). Don't "fix" unrelated pre-existing failures — list them.

**Manual (report outcomes):**
1. Sign in as: platform admin; user in the owning agency; user in a different agency; user without `map.layer.restricted`; user without `risk.read`.
2. Assets: markers/lines/polygons render, clusters expand, condition styling readable without colour, the bridge shows POOR + overdue; Needs-Attention toggle dims others and the counter matches.
3. Utilities: the water main is visible only to authorized/in-scope users; others see "N restricted hidden" and **no geometry in the network response** (check DevTools Network payload); other-agency STANDARD drainage point shows reduced detail with the awareness banner.
4. Risks: DEMO flood zone shows hatch pattern, DEMO ribbon, source details; project-risk markers match latest assessments; zones never block selecting roads/points under them.
5. Exposure Check: selecting the demo road resurfacing roadwork shows "Intersects 1 hazard zone"; selecting the flood zone lists exposed roadworks/projects/assets (scoped); wording is non-predictive.
6. Nearby lens: radius switch works, restricted-hidden note appears for unauthorized users, "Back to previous" works, RoadSync link shown for roadworks.
7. Focus mode dims/restores exactly; style reload (toggle style URL or force `style.load`) restores all new layers/images.
8. Toggle all layers on/off repeatedly: one canvas, no duplicate listeners, no console errors; Network tab shows no requests for disabled/forbidden layers and aborted requests on rapid pan.
9. en/si/ta switch holds layout; 375 px bottom-sheet works; keyboard-only operation of layer deck, quick view, lens, Escape behaviour.
10. Batch 01 layers (projects/roadworks/conflicts) and RoadSync's own map still behave exactly as before.

---

## 10. GITHUB WORKFLOW

- **Base:** `development` (once Batch 01 is merged); otherwise follow §3.2.
- **Branch:** `feature/phase8-inframap-assets-utilities-risks` (adapt to repo convention).
- **Commits (Conventional Commits, one per ✔):**
  1. `feat(inframap): asset sensitivity, hazard-zone model and access policy (Steps 85-87 data)`
  2. `feat(inframap): scoped asset, utility and risk layer APIs`
  3. `feat(inframap): demo hazard/asset seeds and provenance-enforcing hazard import script`
  4. `feat(inframap): asset layer with condition styling and needs-attention lens (Step 85)`
  5. `feat(inframap): utility layer with restricted-geometry protection (Step 86)`
  6. `feat(inframap): risk layer with hatch patterns, provenance and project risk (Step 87)`
  7. `feat(inframap): exposure check, nearby context lens and focus mode`
  8. `feat(inframap): layer deck, legend, quick-view polish and si/ta copy`
  9. `test(inframap): access policy, scoping and exposure tests`
- Before each commit: type-check + lint touched workspaces. Never commit `.env*`, secrets, datasets under licence, or `node_modules`. **Do not commit any real hazard dataset**; only the tiny DEMO seed.
- **Push:** `git push -u origin <branch>` (no force). **Do not merge.** PR into `development` (squash-merge expected): title `feat(inframap): Phase 8 Batch 02 — assets, utilities, risks and context tools (Steps 85–87)`; body = what shipped, new endpoints, new collection + indexes, permissions used, the `CROSS_AGENCY_STANDARD_TIER` decision, sensitive-data handling, demo-data statement, verification results, known gaps. If you can't open the PR, give me the exact title/body.

---

## 11. COMPLETION CRITERIA (all true)

- [ ] Assets, Utilities, Risks are registered layers in the **same** map/registry/state/quick-view as Batch 01; no duplicated map logic or per-layer branching.
- [ ] Asset layer: type symbols, condition styling not colour-only, clustering, FULL vs AWARENESS detail, maintenance mini-timeline, Needs-Attention lens working.
- [ ] Utility layer: class styling by colour **and** line style; restricted geometry excluded **in the database query** for unauthorized users with only a hidden-count returned; verified in the network payload.
- [ ] Risk layer: hazard polygons with level hatch patterns, project-risk markers from existing `RiskAssessment`, full source/licence/date metadata, DEMO labelling, honest empty states.
- [ ] Exposure Check (both directions), Nearby Context Lens, Focus mode, selection history, provenance chips all functional and permission-safe.
- [ ] `hazardZones` has indexes + import script (dry-run default, provenance required) + demo seed + reset/verify support; no real dataset committed; no fabricated official data.
- [ ] All new endpoints: authenticated, permission-checked, scoped server-side, strictly validated, capped, allowlisted, `no-store`.
- [ ] en/si/ta complete for all new strings; responsive at 375/768/1280; keyboard and reduced-motion handled.
- [ ] No new dependencies; no RoadSync duplication; Batch 01 and RoadSync behaviours unchanged.
- [ ] Type-check, lint, targeted tests, indexes check, seed verify and `build:web` pass; branch pushed; PR text ready.

---

## 12. FINAL REPORT (short)

(1) Preflight findings and deviations from §2/Batch 01 report; (2) what shipped per step and per signature function; (3) endpoints + collection + indexes added; (4) permission matrix findings and any proposed seed change; (5) access-policy decisions (`CROSS_AGENCY_STANDARD_TIER`, secure-by-default utilities) for my approval; (6) verification results (commands + manual checklist); (7) known gaps / uncertain translations; (8) **Batch 03 handoff notes**: final registry shape incl. new groups, the per-layer filter param names that now exist server-side, the quick-view section pattern (Batch 03 evolves it into the reusable drawer), the selection-history stack, the `/features/:layer/:id` detail contract, search-indexable fields per layer, and anything bbox/performance-sensitive (e.g., hazard polygon sizes, truncation points) that Batch 03 should optimise.

Stop after the report. Do not start Batch 03.
