# Step 35 — Future API contract handoff

No new shared types in this step. Later auth routes must use the existing Step 16 envelope.

## Success and error

- Success: `ApiSuccess<T>` from `packages/shared-types/src/api/contracts.ts` (`success`, `data`, `meta.requestId`).
- Failure: `ApiFailure` with `error.code` from `API_ERROR_CODES`.
- Unauthenticated or bad credentials: `AUTH_REQUIRED` (401). Do not distinguish unknown email from a bad password.
- Expired or reused refresh: `SESSION_EXPIRED` (401) and clear the cookie.
- Role present but action denied: `INSUFFICIENT_PERMISSION` or `RESOURCE_SCOPE_DENIED` (403). Out-of-scope private records stay `RESOURCE_NOT_FOUND` (404) per ADR-007.

## Bodies

| Later step | `data` | Must not include |
| --- | --- | --- |
| 36 register | acknowledgement only, or `SafeUserDto` without permissions | `password`, `passwordHash` |
| 38 / 39 login and refresh | `CurrentUserDto` plus access token in JSON | refresh token in JSON, `tokenHash` |
| 40 logout | empty | session secrets |

`SafeUserDto` and `CurrentUserDto` live in `packages/shared-types/src/domain/dtos.ts`. Do not add `passwordHash` or `tokenHash` to shared types.

## Cookie (not a JSON field)

Refresh cookie: `HttpOnly`, `Secure`, `SameSite=None` for the Vercel/Render split, `Path=/api/v1/auth`, `Domain` unset. Access token stays in memory. Secrets: `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET` (`apps/api/src/config/env.ts`).

## Web client

`apps/web/src/lib/api/client.ts` already speaks the envelope. Step 38 may set `credentials: 'include'` for auth calls only. No token storage in `localStorage`.

## UI

Internal forms use the design-system V1 shell (`[data-infra-app]`, Sora, DM Sans, Noto Sinhala/Tamil) when that work is merged. This step does not add login screens. Public landing stays Manrope + Geist. Copy for si/ta remains pending native review.
