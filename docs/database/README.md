# INFRAOS database documentation

**Steps:** 12–14 — model foundation, indexes, GeoJSON, and constraints

Step 12 identity schemas are preserved; Step 13 adds the remaining domain schemas.

| File | Purpose |
|------|---------|
| [connection.md](./connection.md) | Mongoose lifecycle, probes, pool, shutdown |
| [core-models.md](./core-models.md) | User, Role, Agency, RefreshSession (Step 12) |
| [data-model.md](./data-model.md) | Domain models, ownership, relationships, enums, money, security, and validation (Step 13) |
| [step-13-review.md](./step-13-review.md) | Verification results, file manifest, limitations, and integration notes |
| [indexes.md](./indexes.md) | Query index catalog, uniqueness, trade-offs, and read-only index inspection |
| [geospatial.md](./geospatial.md) | GeoJSON coordinate rules, spatial fields, and RoadSync candidate readiness |
| [constraints.md](./constraints.md) | Schema constraints, overlap rule, and service integrity obligations |
| [../setup/mongodb-atlas.md](../setup/mongodb-atlas.md) | Atlas project, user, network, URI |
| [../setup/environment.md](../setup/environment.md) | `MONGODB_URI`, `MONGODB_DB_NAME` |

The Step 14 spatial implementation follows [ADR-004](../adr/ADR-004-mongodb-geojson.md). It prepares indexed candidate retrieval but does not implement RoadSync conflict classification or resolution.
