# Step 39 architecture

The API stays an Express modular monolith. New code lives under `apps/api/src/modules/identity/auth/`.

| Piece | Choice |
|---|---|
| JWT library | `jose` 6.2.13. Signing is not hand-rolled. |
| Access token | HS256, 15 minute cap, issuer `infraos-api`, audience `infraos-web`, `typ=access`. Memory only on the client. |
| Refresh token | 32 random bytes, HMAC-SHA256 with `REFRESH_TOKEN_SECRET`, unique `tokenHash`. |
| Cookie | `infraos_refresh`; `HttpOnly`; `Secure`; `SameSite=None`; `Path=/api/v1/auth`; no `Domain`. |
| Rotation | `findOneAndUpdate` claims a live predecessor. The successor keeps the original `expiresAt`. |
| Benign race | 10 seconds. Inside the window, the loser gets `401` and the family is not revoked. Outside it, reuse revokes the family. |
| Eligibility | `ACTIVE`, `emailVerified`, active role, active agency. Q-002 blocking rule. |
| Web gate | Live transport only when `getAuthAvailability()` is `live`. Production still returns `preview`. |
| Client retry | One shared refresh on boot, and one shared refresh before a single retry of `GET` or `HEAD`. Unsafe methods are not retried. |

`POST /api/v1/auth/logout` is not mounted.
