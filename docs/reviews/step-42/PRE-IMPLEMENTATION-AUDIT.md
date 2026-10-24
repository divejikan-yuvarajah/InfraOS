# Step 42 pre-implementation audit

**Status:** Design only. No consumption code. No Atlas writes.  
**When:** 2026-10-24  
**Branch:** `feature/auth-password-recovery` @ `8071611` (same commit as `origin/main` and `origin/development`)  
**Step 41:** owner approved and pushed. Request route, digest-only challenges, policy A issuance.

## What Step 41 already decided

- Eligibility at **issuance** is sign-in equivalent: `ACTIVE`, `emailVerified`, active role, active agency.
- Issuance does not change status.
- One open `RESET_PASSWORD` challenge per user when the partial unique index exists. Expired rows still match `{ consumedAt: null, revokedAt: null }` until revoked or TTL.
- Token is 32 bytes, SHA-256 hex only in Mongo. Link fragment is `/reset-password#token=`.
- Production mail is unavailable. Live delivery remains **BLOCKED**.

## What this step must add

`POST /api/v1/auth/reset-password` consumes one challenge, replaces `passwordHash` with bcryptjs cost 12, and makes every pre-reset refresh family unusable. No signup, no status change, no auto-login, no access-token denylist (Step 44).

## Account status — not chosen

Step 41 only **issued** tokens to sign-in-eligible accounts. Consumption still needs an explicit rule because status can change after the email was prepared:

| Option | Consume when | Password change | Status write |
|---|---|---|---|
| **A (recommended, not applied)** | Same predicate as issuance, re-checked inside the reset transaction | Yes | Never |
| **B** | Any status except `DISABLED` and `SUSPENDED` | Yes | Never |
| **C** | Burn the token when status is not eligible, do not change the password | No | Never |

Do not implement until the owner picks A, B, or C. All options return the same generic failure for a bad token and a successful reset.

## Sessions that have no family guard

Rows in `refresh_sessions` created before Step 40 have no `refresh_families` document. `closeFamily` cannot see them. Reset must also set `revokedAt` on every `refresh_sessions` row for that `userId`. The epoch check below covers a session inserted after that update.

## Atlas preflight (read only)

Do not create indexes and do not update users.

1. Confirm `MONGODB_DB_NAME` is `infraos_dev`.
2. Run `npm run db:indexes:check` only. It connects with `autoIndex: false`.
3. Record whether `password_reset_challenges` and `refresh_families` indexes exist. Do not call `syncIndexes`.
4. Do not start `dev:api` against Atlas. Development `autoIndex` is on outside production.

`mongodb-memory-server` 10 can run as a replica set, which is what multi-document transactions need. Atlas replica sets support transactions. A standalone node does not. Tests must prove `withTransaction` on the isolated server before the design is treated as implemented. This audit did not open a transaction.
