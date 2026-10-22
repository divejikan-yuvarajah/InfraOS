# Step 35 — Index migration plan

## Change

Add a unique index on `refresh_sessions.tokenHash`.

Declared in `apps/api/src/modules/identity/models/refresh-session.model.ts`:

```text
{ tokenHash: 1 } unique
```

Existing indexes stay: `{ userId: 1 }`, `{ familyId: 1 }`, `{ expiresAt: 1 }` with `expireAfterSeconds: 0`.

## Compatibility

- Additive. No field rename, no collection drop, no TTL change.
- Issuance is not live, so the collection should be empty or contain only test fixtures.
- A duplicate `tokenHash` would make index build fail. Stop and inspect; do not drop the collection.

## Where it is created

| Environment | Behavior |
| --- | --- |
| Test | `syncIndexes()` in `models.identity.test.ts` on mongodb-memory-server. |
| Development | Mongoose `autoIndex` when the API connects. |
| Production | `autoIndex` is off. Build the index in a reviewed maintenance window **before** Step 39 traffic. This step does not run that command. |

`npm run db:indexes:check` is read-only and was **not** run. It needs an explicitly disposable database.

## Rollback

Drop only the new `tokenHash_1` unique index if a build must be reversed before Step 39. Do not drop the TTL index.
