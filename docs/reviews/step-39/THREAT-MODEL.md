# Step 39 threat model

**Date:** 2026-10-23  
**Branch:** `feature/step-39-jwt-rotating-refresh`  
**Base:** `a1f4421`

## Topology

ADR-006 stands: the browser and API are different sites (Vercel and Render). The refresh cookie is `HttpOnly`, `Secure`, `SameSite=None`, `Path=/api/v1/auth`, and host-only (no `Domain`). Localhost is the controlled equivalent: Chromium treats `http://localhost` as a secure context, so the `Secure` flag can still be stored. A non-localhost HTTP origin is not a supported demo target.

CORS allowlisting is not treated as CSRF protection. `POST /api/v1/auth/login` and `POST /api/v1/auth/refresh` require `Origin` or `Referer` to equal `FRONTEND_ORIGIN`.

## Decisions

| Threat | Control |
|---|---|
| Brute force | Separate login and refresh rate limits. Test mode uses a higher ceiling so the suite can run; production login limit is 10 per 15 minutes per IP. `X-Forwarded-For` is trusted only when `NODE_ENV=production` (`trust proxy` 1). |
| Enumeration | Unknown email, wrong password, non-login fixture hash, `PENDING`, `SUSPENDED`, `DISABLED`, inactive role, inactive agency, and unverified `ACTIVE` all return generic `401 AUTH_REQUIRED`. Missing users still pay a bcrypt compare against a timing pad. |
| CSRF | Exact origin allowlist, POST only, JSON content type for login. Refresh rejects a non-JSON content type when one is sent. |
| XSS token theft | Access JWT stays in memory. Refresh cookie is `HttpOnly`. No `localStorage`. |
| Token theft / replay | Opaque 256-bit refresh token, HMAC-SHA256 digest in unique `tokenHash`. Compare-and-swap claims the predecessor. Reuse after 10 seconds revokes the family. A second request inside 10 seconds of a claim is a benign race: `401` and the family stays live for the winner. |
| Simultaneous refresh | Eight parallel requests on one cookie produced exactly one `200` and one unrevoked successor. |
| DB failure | Login does not set a cookie if the session insert fails. A failed successor insert revokes the new row and restores the predecessor when that update still matches. |
| Q-002 | Blocking rule from `docs/reviews/step-38/Q-002-BLOCKING-RULE.md`. Verification does not activate accounts. Unverified `ACTIVE` accounts cannot sign in. |
| Access JWT confusion | `jose` signs and verifies HS256 only, with issuer `infraos-api`, audience `infraos-web`, `typ=access`, `jti`, `iat`, and `exp`. `alg=none`, wrong audience, wrong type, tamper, and expiry are rejected. |

## Not in this step

Logout and server revocation of every access JWT are Step 40 and Step 44. Route authorization and RBAC are Steps 43–46. Production login stays in preview because `getAuthAvailability()` returns `preview` whenever `NODE_ENV=production`.
