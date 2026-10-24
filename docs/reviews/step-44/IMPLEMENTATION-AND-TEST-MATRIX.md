# Step 44 implementation and test matrix

## Contract

`signAccessToken(userId, credentialEpoch)` adds `ce` to the existing HS256 access token. `verifyAccessToken` requires an integer `ce` of 0 or greater and returns it as `credentialEpoch`. Login passes the epoch read inside the issuance transaction. Refresh passes the epoch that still matched the open family after the swap. Both call sites re-read the user immediately before signing and abort if the epoch changed.

`requireAuthenticated` accepts only `Authorization: Bearer <single-token>`. It does not read the refresh cookie. It verifies the signature, algorithm, issuer, audience, `typ`, `sub` as a 24-hex ObjectId, `jti`, `iat`, `exp`, and the existing clock skew. It then loads User, Role, and Agency. The account must be `ACTIVE`, `emailVerified`, with an active role and an active agency. A null agency is rejected. `ce` must equal `user.credentialEpoch` (missing field = 0).

The request receives `actor` (`userId`, `roleId`, `roleKey`, `agencyId`, `credentialEpoch`) and `authUser` (the existing safe login user DTO). No password hash and no permission list.

`GET /api/v1/auth/me` returns `{ success, data: { user }, meta: { requestId } }` with `Cache-Control: no-store`.

The web guard, when auth is live, shows private children only after `identityConfirmed`. That flag is set only by a successful `apiClient` GET `/api/v1/auth/me` with `authenticated: true`. One safe GET refresh retry stays inside the client. A 401 that has already cleared the memory token sends the user to login. A 503 or a 401 that left the token in place shows retry and does not render the workspace. Preview mode never shows the workspace.

## Results

| Check | Result |
| --- | --- |
| Safe DTO `GET /auth/me` 200, no-store, no password hash | PASS (`auth-me.test.ts`) |
| Missing, empty, Basic, spaced, and comma-joined Bearer | PASS |
| Cookie without Bearer | PASS 401 `AUTH_REQUIRED` |
| Tamper, wrong issuer, non-ObjectId `sub`, missing `ce` | PASS 401 |
| Expired token | PASS 401 `SESSION_EXPIRED` |
| Disabled, suspended, pending, unverified, inactive role, inactive agency, missing role, null agency, deleted user | PASS 401 |
| Epoch bumped after issuance | PASS 401 `SESSION_EXPIRED`; new `ce` returns 200 |
| Reset consume then old JWT | PASS 401; old password login 401; new login `GET /me` 200 |
| `User.findById` throw and short access secret | PASS 503 `SERVICE_UNAVAILABLE`, generic body |
| `GET /health` and login body validation without Bearer | PASS public |
| Refresh without cookie still the refresh handler | PASS 401 `SESSION_EXPIRED` from that route, not a global middleware block |
| Login still stamps `ce: 0` | PASS (`auth-session.test.ts`) |
| Reset consume concurrency suite | PASS 8/8 |
| JWT tamper, `none`, wrong audience, wrong `typ`, expiry, missing `ce`, identical secrets | PASS (`auth-jwt.test.ts`) |
| Web decision waits for identity confirmation and keeps preview closed | PASS (`route-access.test.ts`, `auth.test.ts`) |
| Newer sign-in survives an older `/auth/me` failure | PASS (`auth.test.ts`) |
| `alg: none`, wrong audience, wrong type, future `iat`, forged secret, on `GET /auth/me` | PASS (`auth-me.test.ts`) |
| Deleted agency, then restored agency returns 200 | PASS |
| Other user's JWT still accepted after this user's reset | PASS |
| `/ready`, forgot-password, verify-email, logout, and `POST /auth/me` stay off the middleware | PASS. Logout with the allowed origin is 204. `POST /auth/me` is 404. |
| `npm run test:api` | PASS, exit 0, 260 tests |
| `npm run test:web` | PASS, exit 0, 128 tests |
| `npm run type-check`, `npm run lint`, `npm run build` | PASS, exit 0. Lint has the existing data-table warning. |
| Browser 503 retry and public EN/SI/TA pages | PASS against the already-running dev server. See the verification note. |
| Browser 401 redirect and live `GET /auth/me` 200 | NOT RUN / BLOCKED. No staff login. No new API process. |
| Reset paused between the two epoch reads | NOT RUN. The second read fails closed in code. |
| Atlas indexes | NOT RUN. No `createIndex` or `syncIndexes` against Atlas. |
