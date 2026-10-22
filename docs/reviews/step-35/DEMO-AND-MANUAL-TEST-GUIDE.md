# Step 35 — How to test it

This step is verified by the identity model tests and by confirming that auth HTTP routes do not exist. There is no login screen and no test user password.

Run everything from the worktree:

```text
c:\Users\ASUS\Desktop\InfraOS\InfraOS-step35
```

The folder `c:\Users\ASUS\Desktop\InfraOS\InfraOS` is a different branch and still has uncommitted design-system files. Do not run these checks there if you want the Step 35 models.

## 1. Confirm the branch

```powershell
cd c:\Users\ASUS\Desktop\InfraOS\InfraOS-step35
git status -sb
git diff --stat
```

Expected: branch `feature/step-35-auth-db-session-review`, with the model, test, and docs changes listed above. `HEAD` stays `15178cc` until you commit.

## 2. Run the identity tests

```powershell
npm run test -w @infraos/api -- tests/models.identity.test.ts
```

Expected: **7 passed**. The suite uses mongodb-memory-server. It does not connect to Atlas.

What those tests do with safe fixture data:

- Email `dup@example.com` and `DUP@example.com` collide after lowercase normalization.
- `passwordHash` is the non-secret string `x` repeated 60 times. It is not a login password.
- A second refresh row with the same `tokenHash` is rejected.
- Default queries and `toObject()` omit `passwordHash` and `tokenHash`.
- Default `lean()` omits `passwordHash`.
- `.select('+passwordHash').lean()` still includes that fixture hash. That is the known residual, not a bug in the test.

If the suite fails to start Mongo in memory, install is already present in this worktree (`npm ci` was run here). Do not point `MONGODB_URI` at a shared database for this test.

## 3. Run the wider API suite

```powershell
npm run test:api
npm run type-check:api
npm run lint:api
npm run build:api
```

Expected from the 2026-10-22 verification: **192 passed**, type-check clean, lint clean, build clean.

## 4. Prove there is no auth API

`apps/api/src/routes/v1.ts` mounts only `/health` and `/ready`.

The unknown-route test already covers a missing path:

```powershell
npm run test -w @infraos/api -- tests/health.test.ts
```

Expected: `GET /api/v1/does-not-exist` returns **404** with `success: false` and `error.code` `ROUTE_NOT_FOUND`.

If you start the API yourself (`npm run dev -w @infraos/api`) only after `apps/api/.env` points at a **local** database:

- `GET http://localhost:4000/api/v1/health` (port comes from your env; the test app does not bind a port) should be **200**, `data.status` `ok`, `data.service` `infraos-api`, and the JSON must not contain `SECRET`, `PASSWORD`, or `mongodb`.
- `GET http://localhost:4000/api/v1/auth/login` should be **404** `ROUTE_NOT_FOUND`.

Do not create a user or call a login URL and expect 200. That route is Step 38.

## 5. Error cases you can see today

| Action | Expected |
| --- | --- |
| Insert two refresh sessions with the same `tokenHash` | The identity test rejects the second insert |
| Read a user without `select('+passwordHash')` | Hash is absent |
| Call `toObject()` after selecting the hash | Hash is absent from the plain object |
| Call `lean()` after selecting the hash | Hash is **present**. Do not return that object from an API |
| Request `/api/v1/auth/login` | 404, not 401. Authentication is not implemented |

Replay, expired-cookie, and parallel-refresh cases are **not executable** until Step 39.

## 6. What not to run

- `npm run db:indexes:check` against Atlas or any shared database. It is read-only, and this review did not authorize a connection.
- `db:seed:demo` as a login demo. Demo users are non-login fixtures.
- Browser screenshots. No auth UI changed.

## 7. Checks still open

- Native review of future Sinhala/Tamil auth copy.
- Production creation of the `tokenHash` unique index before Step 39.
- Your commit and pull request into `development`.
