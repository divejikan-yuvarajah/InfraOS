# Handoff to Step 45

SAME-AGENT REVIEW recommendation: APPROVE the uncommitted Step 44 identity middleware for owner acceptance. Step 45 is not started. Do not commit or push until the owner asks.

## Owner demo

Do not start `dev:api` against Atlas. `autoIndex` is on outside production, and the Step 40–42 Atlas indexes are not approved.

With an isolated API and the web app pointed at it:

1. Open `/dashboard` signed out. The workspace shell must stay hidden. A 503 from refresh stays on retry. A 401 from refresh goes to `/login?next=%2Fdashboard`.
2. Sign in with a non-production test account. The shell appears only after `GET /api/v1/auth/me` returns 200. The response has `Cache-Control: no-store` and no `passwordHash`.
3. Reset that account's password. The old access token receives 401 `SESSION_EXPIRED` from `GET /auth/me`. A new login works. Another user's token keeps working.
4. `/`, `/si`, and `/ta/forgot-password` stay public. Live reset email is not part of this step.

## Proposed commits, after a separate owner request

Do not include `.env`, secrets, or `Prompts/INFRAOS_Steps_43_44_Enhanced_Development_Prompt.md`.

1. `feat(web): keep private pages behind a client session guard`
   - Step 43 files: `apps/web/src/app/dashboard/`, `workspace-home.tsx`, `query-cache.ts`, `route-access.test.ts`, `auth-access.css`, `login-form.tsx`, `app-providers.tsx`, `query-provider.tsx`, `messages.ts`, `redirect.ts`, `refresh-flight.ts`, and `docs/reviews/step-43/`.
2. `feat(auth): check the access token and credential epoch on GET /auth/me`
   - Step 44 files: `require-authenticated.ts`, `jwt.ts`, `auth.routes.ts`, `refresh-session.service.ts`, `express.d.ts`, `auth-me.test.ts`, `auth-jwt.test.ts`, `auth-session.test.ts`, `confirm-identity.ts`, and `docs/reviews/step-44/`.

`state.ts`, `route-access.ts`, `route-access-guard.tsx`, `client.ts`, and `auth.test.ts` contain both steps. Split those hunks at commit time so the first commit still builds. Push and the pull request to `development` need their own approval. `development` to `main` needs a separate release approval.

Step 44 proves identity on `GET /api/v1/auth/me` only. Step 45 is not started.

## Already on the request

`req.actor` is `{ userId, roleId, roleKey, agencyId, credentialEpoch }`, filled from MongoDB after the JWT verifies. `req.authUser` is the safe user DTO. Neither carries permissions.

## What Step 45 should add

A separate permission middleware, after `requireAuthenticated`, that loads the role's permission set from the database for that request. It should answer 403 `FORBIDDEN` only when the caller is authenticated and lacks the capability. It must not treat a bad bearer as 403. It must not trust a permissions array, role name, or scope placed in the JWT.

Do not wrap all of `/api/v1`. Keep health, ready, login, refresh, logout, forgot-password, reset-password, email verification, and public reads on their own rules.

## What Step 45 should not undo

- `ce` comparison and the reject-missing-`ce` rule.
- Q-002 account, role, and agency checks inside `requireAuthenticated`.
- The web rule that private children wait for `GET /auth/me`.
- The production preview gate, locale middleware, and the public landing page.
- The refresh cookie path and the one-GET refresh retry. Do not replay POST bodies.

## Still true after this step

An access JWT survives logout until it expires or the account epoch or eligibility changes. Resource ownership and IDOR checks belong to Step 46, not Step 45.
