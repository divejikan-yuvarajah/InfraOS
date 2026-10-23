# Step 39 demo guide

Do not paste raw cookies, access tokens, or passwords into notes or screenshots.

## Isolated API check

From `InfraOS-step39` (the clean Step 39 worktree):

```powershell
$env:NODE_ENV = "test"
$env:ACCESS_TOKEN_SECRET = "access-secret-step39-0123456789abcdef"
$env:REFRESH_TOKEN_SECRET = "refresh-secret-step39-0123456789abcdef"
$env:FRONTEND_ORIGIN = "http://localhost:3000"
npm run test -w @infraos/api -- tests/auth-jwt.test.ts tests/auth-rate-limit.test.ts tests/auth-session.test.ts
```

Observed on 2026-10-23: JWT and rate-limit files passed. The session file passed **10/10** after the disposable MongoDB binary finished downloading. The suite covers a correct login, the generic 401 cases, cookie flags, one-winner concurrent refresh, replay after the 10 second grace window, absolute expiry, a disabled account, and a failed session insert with no cookie.

## Browser

Live login in the browser needs a non-production web build with `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=1` and `NEXT_PUBLIC_API_BASE_URL` pointed at the API. Production builds stay in preview until Steps 40, 43, and 44. A full browser walkthrough of `Set-Cookie` on localhost was **not run** in this pass. Supertest observed the cookie flags and a following refresh that sent the cookie back.

Public `/` is unchanged aside from a silent boot refresh that does nothing unless live mode is on.

## 2026-10-23 live notes

`apps/api/.env` and `apps/web/.env.local` were created from placeholders because they were missing. Secrets and `MONGODB_URI` are still empty. Do not commit those files.

Until you paste your own development URI and two different 32+ character secrets, `/ready` stays 503 and login stays `SERVICE_UNAVAILABLE`. Generate secrets with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Run that twice. Put the two values in `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET`. Restart `npm run dev:api` and `npm run dev:web` after editing env files.

There is no synthetic login user in the database yet. Do not use demo seed accounts; their hashes are non-login fixtures. No public bootstrap route was added.

## Proposed synthetic account — not written

Waiting for explicit approval. Do not run this until Atlas `db:check` passes and the owner says to create it.

Target database: `infraos_dev` only. Refuse if `NODE_ENV` is `production` or the database name is anything else.

| Field | Value |
|---|---|
| Email | `step39.synthetic@infraos-dev.invalid` |
| Password | Chosen locally at creation time. Hash with bcrypt cost 12. Do not commit it and do not put it in a screenshot |
| `status` | `ACTIVE` |
| `emailVerified` | `true` |
| Role | Existing active `AGENCY_OFFICER` if one is already present. Otherwise create that one role with only `SYSTEM_ROLE_PERMISSIONS.AGENCY_OFFICER` |
| Agency | New department, code `AUTH_STEP39_SYNTH`, status `ACTIVE` |
| Extra permissions | None |

Cleanup, only after the demo:

1. Delete `refresh_sessions` whose `userId` is that user.
2. Delete the user with that email.
3. Delete agency `AUTH_STEP39_SYNTH` only when no other user references it.
4. Leave `AGENCY_OFFICER` in place if it already existed.

## Owner reproduction

1. Confirm Windows date and time, and that Atlas Network Access includes this machine. `npm run db:check -w @infraos/api` must print a successful connection before any login attempt. Then run `npm run db:indexes:check -w @infraos/api` and confirm `User`, `Role`, `Agency`, and `RefreshSession` indexes. Do not sync or drop indexes.
2. From the repo root, in two terminals: `npm run dev:api` and `npm run dev:web`.
3. Open `http://localhost:3000/login`.
4. After the account above is approved and created, sign in with that email and the local password.
5. Expect HTTP 200 on `POST /api/v1/auth/login`. The JSON body includes `accessToken`. It must not include `refreshToken`. The access token stays in memory; it is not written to `localStorage`.
6. In DevTools, Application → Cookies → the API host. Confirm a cookie named `infraos_refresh` with HttpOnly, Secure, SameSite `None`, and Path `/api/v1/auth`. Do not copy the cookie value.
7. In Network, a later `POST /api/v1/auth/refresh` with the cookie should return 200 and a new access token. The response JSON still has no refresh token. The cookie value should change. Absolute expiry is covered by `tests/auth-session.test.ts`, not by waiting seven days.
8. Negative checks: wrong password returns generic `401`. A body of `{` returns `400`. With Mongo stopped, a valid JSON login returns `503`.

`GET /health` was 200 and `GET /ready` was 503 on 2026-10-23 after the API restart, because Atlas did not connect. Successful browser login was not run.
