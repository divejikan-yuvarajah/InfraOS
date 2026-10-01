# INFRAOS database documentation

**Step:** 11 — Atlas connection foundation

Schemas and indexes for Users / Roles / Agencies start in **Step 12**.

| File | Purpose |
|------|---------|
| [connection.md](./connection.md) | Mongoose lifecycle, probes, pool, shutdown |
| [core-models.md](./core-models.md) | User, Role, Agency, RefreshSession (Step 12) |
| [../setup/mongodb-atlas.md](../setup/mongodb-atlas.md) | Atlas project, user, network, URI |
| [../setup/environment.md](../setup/environment.md) | `MONGODB_URI`, `MONGODB_DB_NAME` |

GeoJSON / `2dsphere` intent remains in [../architecture/system-architecture.md](../architecture/system-architecture.md) and [ADR-004](../adr/ADR-004-mongodb-geojson.md). Do not create project collections in this step.
