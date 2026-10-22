# Step 35 — Threat model (design)

**Status:** Review only. No auth endpoints exist.

| Threat | Control now | Control later (not this step) |
| --- | --- | --- |
| Stolen refresh cookie | Hash stored, not the raw token. Unique `tokenHash` index. | Rotation + family revoke (Step 39). `HttpOnly` `Secure` cookie, `Path=/api/v1/auth`. |
| Replayed rotated refresh | Schema has `revokedAt`, `replacedBySessionId`, `familyId`. | Conditional update; if the hash is already revoked, revoke the family. |
| Parallel refresh of one token | Unique hash prevents two rows with the same hash. | Only the `findOneAndUpdate` that matches `revokedAt: null` may insert a successor. The loser is a replay. |
| XSS reads access JWT from `localStorage` | Not implemented, and ADR-006 forbids persistent browser storage. | Memory-only Bearer token (Step 39). |
| CSRF on `SameSite=None` cookie | Documented. No cookie route exists yet. | CORS allowlist + `Origin` check on cookie mutations. |
| Password hash in API JSON | `select: false`, `toJSON`, and `toObject` strip `passwordHash`. | Map users to `SafeUserDto` / `CurrentUserDto`. Never return the document. |
| Hash leak via `lean()` | Default `lean()` omits `select: false` fields. **Explicit `.select('+passwordHash').lean()` still returns the hash.** Tested. | Auth services must not send lean secret documents to clients or logs. |
| TTL used as logout | TTL only deletes later. | Compare `expiresAt` and `revokedAt` in the request path. |
| Disabled user keeps a valid JWT | Not enforced; no JWT code. | Step 43 loads user status from the database. |
| Privilege wildcard | Role permissions must be catalog keys. No `*`. | Unchanged. |
| Self-escalation via DTO | `SafeUserDto` has no permissions array the server would trust. `CurrentUserDto.permissions` is server-loaded display data only. | ADR-007: Express is the enforcement boundary. |

Partial write (Step 39, planned): if the predecessor is revoked and the successor insert fails, the presented cookie is dead. That fails closed. The client must sign in again. Do not roll the revocation back.
