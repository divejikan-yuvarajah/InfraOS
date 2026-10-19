# Demo database seed (Step 15)

> **All demo projects, agencies, contractors, budgets, schedules, conflicts, inspections, risks, and citizen reports are synthetic prototype data created for development and academic demonstration. They are not official government records.**

## Commands

Run only against **`infraos_dev`** or **`infraos_test`** with `NODE_ENV=development` or `NODE_ENV=test`. Scripts **abort** on production or other database names.

| Command | Purpose |
|---------|---------|
| `npm run db:seed:core` | Upsert seven system roles + four core demo agencies (no users) |
| `npm run db:seed:demo` | Core seed + full synthetic demo layer |
| `npm run db:seed:verify` | Read-only verification (includes spatial candidate check) |
| `npm run db:seed:reset-demo` | Delete demo-layer records only (never `dropDatabase`) |

Seeds **never** run on API startup.

## Environment guard

Demo scripts require:

- `NODE_ENV` ∈ `development`, `test`
- `MONGODB_DB_NAME` ∈ `infraos_dev`, `infraos_test` (case-insensitive)

No `--force-production` bypass exists.

## Deterministic timeline

All dates use a **fixed UTC calendar** anchored at `2026-04-01` for presentation consistency. See [../demo/infraos-demo-scenario.md](../demo/infraos-demo-scenario.md).

## Stable identifiers

| Kind | Examples |
|------|-----------|
| Agencies (layer) | `AGENCY_DEMO_TELECOM`, `AGENCY_DEMO_DRAINAGE`, … |
| Projects | `INF-ROAD-001`, `INF-WATER-001`, … |
| Contractors | `SYNTH/ALPHA-001`, … |
| Work requests | Upsert key: `projectId` + `workType` + `plannedStart` |

Role keys reuse the locked catalog (`GOV_ADMIN`, not `GOVERNMENT_ADMIN`).

## Users

**Demo interactive login: DEFERRED.** Fixture users (`*@infraos-demo.invalid`) exist only to satisfy required references. They are `PENDING`, use a non-login synthetic hash, and must not be treated as accounts.

**Notifications:** not seeded (would orphan without auth).

**Conflicts:** not seeded — RoadSync will create them from work requests later.

## Reset safety

`db:seed:reset-demo` deletes:

- Demo projects (`INF-*` catalog codes) and dependent rows
- Synthetic contractors and layer agencies
- Fixture users

It **does not** delete `roles` or core agencies from `db:seed:core`.

## Verification

`db:seed:verify` checks agencies, projects, work requests, RoadSync candidate pair, spatial overlap query, non-conflict control, milestones, assets, citizen issues, and duplicate counts. Output never includes credentials.

## Code layout

```text
apps/api/src/database/seeds/
├── core/identity.ts
├── demo/
├── helpers/
└── index.ts
```
