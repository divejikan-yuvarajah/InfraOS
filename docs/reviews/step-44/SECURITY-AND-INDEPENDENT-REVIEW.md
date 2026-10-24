# Step 44 security review

SAME-AGENT REVIEW. Not a second person. Source and the test run on 2026-10-25 are the evidence. The earlier author note is not.

## Decision

APPROVE for owner acceptance. No Step 45 permission engine was added. No access-token denylist was added. `requireAuthenticated` is mounted only on `GET /api/v1/auth/me`.

## Route contract

`GET /api/v1/auth/me` requires one header of the form `Authorization: Bearer <token>`. The refresh cookie is not accepted. Verification requires HS256, issuer `infraos-api`, audience `infraos-web`, `typ: access`, a 24-hex `sub`, a non-empty `jti`, `iat`, `exp`, and integer `ce` >= 0. The handler then reads the user, role, and agency. The user must be `ACTIVE` and `emailVerified`, the role active, and the agency present and `ACTIVE`. `ce` must equal the stored credential epoch. A missing stored field counts as 0. A missing `ce` claim is rejected even when the stored epoch is 0.

The response is the existing safe user DTO inside the success envelope, with `Cache-Control: no-store`. It does not include `passwordHash` or `permissions`. `req.actor` is `{ userId, roleId, roleKey, agencyId, credentialEpoch }` from the database, not from a role claim in the JWT.

| Outcome | Status | Code |
| --- | --- | --- |
| Missing, Basic, empty, duplicate, malformed, forged, `alg: none`, wrong issuer, audience, or type, bad `sub`, future `iat`, missing `ce` | 401 | `AUTH_REQUIRED` |
| Expired JWT, or `ce` different from the current user epoch | 401 | `SESSION_EXPIRED` |
| Disabled, suspended, pending, unverified, inactive or deleted role, inactive or deleted agency, null agency, deleted user | 401 | `AUTH_REQUIRED` |
| Secret missing or database lookup throwing | 503 | `SERVICE_UNAVAILABLE` |
| Authenticated but lacking a later permission | not implemented | 403 is reserved |

Public login, refresh, logout, forgot-password, reset-password, and verify-email still answer without this middleware. A bad origin on those older routes can still return 403 `FORBIDDEN`. That is the existing origin gate, not a Step 44 permission denial. `POST /api/v1/auth/me` is 404.

Request logs keep method, url, and status. The authorization header and cookies are in the Pino redaction list. The lookup failure log is the request id only. CORS allows the configured frontend origin and the `Authorization` header. `FRONTEND_ORIGIN=*` is rejected by the CORS helper.

## Epoch proof

Isolated replica-set tests, all inside the passing API suite:

- Reset after the old password matched, before family insert: login returns no session and leaves no open family. PASS (`password-reset-consume.test.ts`).
- Refresh paused after claim, and again after the authority swap: reset commits and the rotation returns not ok. PASS.
- Access JWT issued before reset: `GET /auth/me` is 401 `SESSION_EXPIRED` while the signature has not reached `exp`. The old password login is 401. The new password login then returns 200 from `GET /auth/me`. PASS (`auth-me.test.ts`).
- A second user's access token still returns 200 from `GET /auth/me` after the first user's reset. PASS.
- An outsider refresh family stays open and can rotate after the other user's reset. PASS (`password-reset-consume.test.ts`).

NOT RUN: a hook that pauses after the in-transaction epoch re-read and before the pre-sign re-read. The code returns no token if that second read sees a new epoch. A reset that commits after that second read can still hand the client a JWT whose `ce` is already stale. `GET /auth/me` then returns 401. That JWT is not a denylist entry, and logout still does not revoke an unexpired token whose `ce` still matches.

## Review fix

`confirmSessionWithMe` was marking a newer in-memory sign-in as an error when an older `GET /auth/me` finished after the token had changed. It now leaves that newer sign-in in place and checks the new token once. Covered by `auth.test.ts`: "does not treat a newer sign-in as failed when an older identity check loses".

## Cost

Each call to the one protected route reads the user, then the role and agency. There is no permission catalog and no token blacklist. The three reads are not one snapshot. The next request sees a role or agency change that lands between them.

## Legacy migration

Tokens issued before this step have no `ce` and receive 401 on `GET /auth/me` until the user logs in again or the refresh cookie rotates a new access token. Do not accept a missing claim as epoch 0.
