# ADR-004 — MongoDB Atlas + GeoJSON + Mongoose

**Status:** Accepted  
**Step:** 02  
**Date:** 2026-09-30

## Context

RoadSync and InfraMap need spatial queries (nearby, bounding box) and flexible project documents. The course specifies MongoDB Atlas.

## Decision

Use **MongoDB Atlas** as the only application database, **Mongoose** as the ODM, **GeoJSON** with **`2dsphere`** indexes where geometry is queried.

## Reasons

- Native GeoJSON and 2dsphere
- Flexible milestone/progress/document metadata
- Atlas hosting fits academic teams
- One database (vectors are Qdrant, not a second SoR)

## Alternatives considered

| Alternative | Why not V1 |
|-------------|------------|
| PostgreSQL + PostGIS | Stronger GIS long-term; extra ops and a second mental model now |
| Prisma + Mongo | Weaker GeoJSON story; Mongoose is specified |
| Multiple databases | Rejected complexity |

## Trade-offs

- Complex relational reporting is weaker than SQL — acceptable for V1 reports
- Spatial sophistication below PostGIS — enough for corridor overlap demos

## Consequences

- Conventions: timestamps, unique project codes, pagination, append-only audit
- Soft delete only where status flags are insufficient
- PostGIS is a **future revisit**, not a V1 migration

## Future revisit conditions

- National-scale GIS, topology, complex overlays, or SQL reporting that Atlas cannot serve
