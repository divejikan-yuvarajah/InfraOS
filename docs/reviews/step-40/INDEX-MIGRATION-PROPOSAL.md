# Refresh family index proposal

**Do not apply this to Atlas until you approve it.** This branch was not pointed at Atlas. `npm run dev:api` from this worktree would create the indexes, because development currently sets Mongoose `autoIndex` on. Do not start that process against Atlas yet.

## Definitions

Collection: `refresh_families`

| Index | Keys | Options | Documents included |
|---|---|---|---|
| `familyId_1` | `{ familyId: 1 }` | `{ unique: true }` | Every family guard. One document per family |
| `expiresAt_1` | `{ expiresAt: 1 }` | `{ expireAfterSeconds: 0 }` | Every family guard, removed after `expiresAt` |

No partial filter. No change to existing `refresh_sessions` indexes. No drop.

## Why it is needed

The logout barrier is the family document. The unique index stops two guards for one `familyId`. The TTL matches the existing refresh absolute expiry so a closed family cannot be recreated under the same id after it should be gone. Login already allocates a new `familyId` for a new sign-in.

The race itself is closed by the single-document update even before the unique index exists. The index is still required before this build is used on Atlas, so two writers cannot insert two guards.

## Compatibility

`refresh_sessions` rows are unchanged. Existing sessions have no family document. A logout of such a cookie finds the session, fails to close a missing open guard, and returns **503** rather than pretending the family is closed. New logins create the guard. There is no backfill in this step.

Isolated tests called `RefreshFamily.syncIndexes()` on the disposable memory server only. They passed, including the unique index build on an empty collection. No duplicate-family case exists in that database.

## Migration, after approval

1. Confirm `MONGODB_DB_NAME` is `infraos_dev`.
2. `db.refresh_families.createIndex({ familyId: 1 }, { unique: true })`
3. `db.refresh_families.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })`
4. Deploy this code only after those indexes exist.

Rollback: stop the new API, `dropIndex` on those two names, and drop `refresh_families` only if you accept that logout barriers already stored there are gone. Do not drop `refresh_sessions` indexes.

## Check on the disposable test database

`tests/auth-logout.test.ts` `beforeAll` runs `RefreshFamily.syncIndexes()` against `infraos_test` in memory. Logout tests then enforce one closed guard per family. **PASS**, 2026-10-24 01:41 +05:30. Atlas was not contacted.
