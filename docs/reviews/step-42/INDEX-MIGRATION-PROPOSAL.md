# Step 42 index migration proposal

**Status:** proposal only. **NOT RUN** against MongoDB Atlas. Do not apply without a separate approval.

## Change

`refresh_families` already has a unique index on `familyId` and a TTL index on `expiresAt`.

Add one non-unique compound index:

```js
{ userId: 1, closedAt: 1 }
```

Declared in `apps/api/src/modules/identity/models/refresh-family.model.ts`. It is not unique. It supports "families for this user that are still open" without replacing the `familyId` uniqueness constraint.

## `credentialEpoch`

This is a numeric field on `users` and `refresh_families`, required in the schema, default `0`, minimum `0`. It is not a new index.

Existing documents may omit the field. Consume and refresh treat a missing field and a stored `0` as the same starting epoch, then write `1` on a successful reset. No backfill script is required for correctness. A later optional backfill may set missing values to `0` so operators can see the field. That backfill is not part of this step and was not run.

## Where it was created

The Step 42 API tests boot `MongoMemoryReplSet` with one node. Mongoose created the declared indexes on that disposable server. Result: **PASS** for the isolated server.

## Where it must not be created yet

The API `.env` points at Atlas. Non-production `autoIndex` is enabled. Starting `dev:api` or any index sync against that URI can create this index and the Step 41 reset-challenge index.

This review did not start the API and did not run an index check against Atlas. Atlas result: **NOT RUN**.

## Apply later, only after approval

1. Confirm the target database and a maintenance window.
2. Create `{ userId: 1, closedAt: 1 }` with `unique: false` in the background.
3. Confirm `familyId` remains unique.
4. Do not drop or rebuild existing indexes as part of this change.
5. Leave `credentialEpoch` as an application field unless a separate backfill is approved.
