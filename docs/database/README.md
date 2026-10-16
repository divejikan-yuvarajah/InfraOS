# INFRAOS database documentation

**Step:** 13 — Domain model foundation

Step 12 identity schemas are preserved; Step 13 adds the remaining domain schemas.

| File | Purpose |
|------|---------|
| [connection.md](./connection.md) | Mongoose lifecycle, probes, pool, shutdown |
| [core-models.md](./core-models.md) | User, Role, Agency, RefreshSession (Step 12) |
| [data-model.md](./data-model.md) | Domain models, ownership, relationships, enums, money, security, and validation (Step 13) |
| [step-13-review.md](./step-13-review.md) | Verification results, file manifest, limitations, and integration notes |
| [../setup/mongodb-atlas.md](../setup/mongodb-atlas.md) | Atlas project, user, network, URI |
| [../setup/environment.md](../setup/environment.md) | `MONGODB_URI`, `MONGODB_DB_NAME` |

GeoJSON / `2dsphere` intent remains in [../architecture/system-architecture.md](../architecture/system-architecture.md) and [ADR-004](../adr/ADR-004-mongodb-geojson.md). Step 13 supplies basic geometry structure; domain indexes and fuller spatial constraints remain Step 14.
