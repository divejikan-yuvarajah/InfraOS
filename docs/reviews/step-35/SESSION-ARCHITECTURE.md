# Step 35 — Session architecture decisions

**Status:** Design locked for later steps. **Login, refresh, and JWT issuance are not implemented.**

## Token and cookie (unchanged from ADR-006)

| Item | Decision |
| --- | --- |
| Access | ~15 min HS256 JWT, `Authorization: Bearer`, memory only |
| Refresh | Opaque random token, store **SHA-256 (or equivalent) hash only**, HttpOnly Secure cookie, `Path=/api/v1/auth`, `SameSite=None` for Vercel↔Render, `Domain` unset |
| Password | bcryptjs cost 12 in Step 36/38 — not in this step |
| CSRF | CORS exact allowlist + `Origin` check on cookie routes. No new CSRF token in this step |

## Lookup index

`refresh_sessions.tokenHash` is **unique**. Step 39 looks up with `.select('+tokenHash')` only inside the auth service, never in list APIs.

## TTL vs logical expiry

`expireAfterSeconds: 0` deletes documents after `expiresAt`, on the TTL monitor schedule (often about a minute, not instant). Step 39 must reject `expiresAt <= now` even if the document still exists. Revoked rows stay until TTL so reuse detection can see `revokedAt` / `replacedBySessionId`.

## Rotation (Step 39 — not coded)

1. `findOneAndUpdate` where `tokenHash` matches, `revokedAt` is null, and `expiresAt > now`, setting `revokedAt` and later `replacedBySessionId`.
2. If no document is modified, treat as reuse or expiry: revoke the **family** (`familyId`) and clear the cookie.
3. Insert the successor only after the predecessor update succeeds. One successor per presented token.
4. Concurrency: the unique `tokenHash` index plus the conditional update prevents two successors for one hash.

## Disable behavior (design only)

Disabled user, inactive role, or removed agency: Step 39/43 must fail closed even if the access JWT is unexpired. This step does not add middleware.

## Audit redaction

Do not log raw refresh cookies, password hashes, or `tokenHash`. `toJSON` and `toObject` now strip `passwordHash` and `tokenHash`.

## Migration

New unique index `{ tokenHash: 1 }`. Empty or demo collections can build it with the existing non-production index workflow. **Do not run index sync against production from this step.** Existing duplicate hashes would block index build; none are expected because issuance is not live.
