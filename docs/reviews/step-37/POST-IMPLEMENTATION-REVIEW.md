# Step 37 post-implementation review

Reviewed against the Step 37 diff in `feature/step-37-email-verification` at base `b315b0f`.

## Findings fixed before the final run

| Severity | Finding | Fix |
|---|---|---|
| P1 | Cooldown used Mongo `createdAt`, so a caller-supplied clock could not resend deterministically and a past `issued` time was treated as still inside the cooldown. | Cooldown uses an explicit `issuedAt` set from the same clock as expiry. |
| P1 | After a successful `emailVerified` write, a later session check could throw and make a completed verification look failed. | Success is returned only after the user update matches. Role and status are not written. |
| P1 | A resend used `updateMany`, so a racing second request could revoke the token the first request had just created. A failed insert also left the previous token revoked. | Revoke the current live challenge by id. The loser of that update does not send. If the new insert fails, the previous token is restored unless another live challenge holds the unique index. The request route returns 503 for a storage failure instead of an unexpected 500. |

## Residual, not blocking

| Severity | Residual |
|---|---|
| P2 | Missing-account and existing-account requests share status and body, but their timing is not equalized. |
| P2 | If the compensation write that clears `usedAt` itself fails, the token stays consumed and `emailVerified` stays false. The caller still receives `VerificationDependencyError`, not success. |
| P2 | Audit events are in-memory only. |
| P2 | The global API rate limit is the IP control. The account control is the 60-second cooldown plus one live challenge. |

## Review answers

- GET does not consume a token. `GET /api/v1/auth/verify-email` is `ROUTE_NOT_FOUND`.
- The raw token is 32 random bytes. The database stores SHA-256 hex. HTTP JSON and the audit list do not contain the token. The request logger does not record the body.
- Concurrent consume: one success in the isolated Mongo test.
- A thrown user update clears `usedAt` and is not reported as success. A follow-up consume can succeed.
- Resend revokes the previous live challenge. The old token fails.
- An expired row that is still stored is rejected.
- A changed email, `DISABLED`, and `SUSPENDED` do not verify.
- Q-002 is still open. Status stays `PENDING`.
- No JWT, refresh cookie, role change, or agency change.
- Production sender mode creates no challenge and does not claim delivery.
- `Host` and `returnTo` are not used as the link base. A foreign `Origin` is `403`.
- No verification page. Public styles and the internal design system were not edited on this branch.

Verdict from this review: **REVISE items above are fixed. APPROVE RECOMMENDED** for owner review. This is not owner approval to commit or merge.
