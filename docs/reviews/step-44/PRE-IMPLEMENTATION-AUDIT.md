# Step 44 pre-implementation audit

Date: 2026-10-25. Branch: `feature/auth-protected-access`. HEAD `6d233480ef3ec8903d887d11dab851fc51de519d`, equal to `origin/development` and `origin/main`. One worktree. Step 43 files stayed uncommitted. No `step-44` branch.

## Gate

Step 43 self-review recommended APPROVE for the client guard and did not claim a second reviewer. The owner then ordered this Step 44 implementation on the same branch. That order is the gate used here. There is no separate sentence that says "Step 43 APPROVED". Step 43 remains uncommitted.

## What the code already did

- Access JWTs were HS256, `typ: access`, issuer `infraos-api`, audience `infraos-web`, `sub`, `jti`, `iat`, `exp`, capped at 15 minutes (ADR-006). They did not carry `credentialEpoch`.
- `User.credentialEpoch` and `RefreshFamily.credentialEpoch` default to 0. A missing stored field is treated as 0 on read. Reset increments the epoch inside the existing transaction. Login and refresh already refuse to issue a session when the epoch or password hash changed underneath them.
- No access-token denylist and no server session store exist. Logout closes the refresh family only.
- `/api/v1` had no authentication middleware. Health, ready, login, refresh, logout, forgot-password, reset-password, and email verification stay public.
- The web guard treated a memory access token as enough to render private children. Production still forces the login preview gate.

## Decisions recorded before code

- Signed claim name: `ce`, a non-negative integer. Role and permission claims are not added.
- Legacy policy: a JWT without `ce` is rejected on protected APIs, including when the stored epoch is still 0. A cookie refresh or a new login must issue a replacement. A missing stored user field still counts as 0 on the database side of the comparison. Epoch 0 is not accepted as a stand-in for a missing claim, and a claim is never accepted once it differs from the current user epoch.
- Protected surface for this step: `GET /api/v1/auth/me` only.
- 401 is invalid, expired, ineligible, or epoch mismatch. 403 is not used. 503 is secrets or database failure.
- Issuance stamps the epoch that the login transaction or the refresh rotation just proved, then re-reads the user and refuses to sign if that epoch moved. It does not copy a post-reset epoch onto a check that used the old password.

## Explicitly out of scope

Step 45 permission middleware, Step 46 resource checks, Atlas index creation, `dev:api` against Atlas, commit, push, and pull request.
