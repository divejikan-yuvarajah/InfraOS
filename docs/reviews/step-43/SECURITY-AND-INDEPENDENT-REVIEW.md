# Step 43 security review

**When:** 2026-10-25 00:40 +05:30  
**Kind:** same-session self-review. Not a second person.

## What the guard is

`RouteAccessGuard` hides private route trees until the in-memory session is known. It does not authenticate API requests. Next middleware only sets `x-infraos-public-locale`. The access token is module memory. The refresh cookie is on the API host and is not read here. The React snapshot is `{ phase, authenticated, bootSettled }`. The server snapshot is always unknown and unsettled, so the first HTML for `/dashboard` is the checking panel.

Production `getAuthAvailability()` remains `preview`. A preview build shows the non-live panel instead of private content.

## Classification

Staff prefixes match a whole first segment: `/map` is private and `/public-map` is not. `/dashboarding` is not private. `/si/dashboard` is not a staff URL. Unknown paths, marketing pages, and `/403` `/404` `/500` `/maintenance` stay public. Login, forgot-password, reset-password, and verify-email, including `/si` and `/ta`, stay reachable.

`next` allows those public pages and the staff prefixes. It rejects schemes, `//`, backslashes, `@`, `..`, control characters, `%00`, double-encoded `..`, auth pages, and any fragment. A reset `#token=` cannot be carried into login.

## Failure handling

`UNAVAILABLE`, `NETWORK`, `RATE_LIMITED`, and `NOT_LIVE` set the error phase and do not clear an existing memory token. `SESSION_EXPIRED` and other credential failures clear the token and the TanStack cache. A refresh that finishes after logout, or after a newer sign-in, does not write the old result. Logout still bumps the epoch.

A network failure on the first check is the retry panel, not a login redirect. A stubbed 401 is the login redirect. Those are different on purpose.

## Not claimed

The guard does not protect records. A memory token issued before password reset still opens this shell until refresh fails. Step 44 has to reject that token on the API. There is no RBAC and no agency scope.

## Recommendation

**APPROVE** the uncommitted frontend guard for owner testing.

Residuals that stay open: live API proof is **BLOCKED** until Atlas `autoIndex` is approved; the signed-in workspace was not completed in the browser; this review is not a second person.
