# Token lifecycle and index plan

## Record

| Field | Rule |
|---|---|
| `userId` | Account the challenge was issued for |
| `email` | Normalized address at issuance |
| `purpose` | `VERIFY_EMAIL` only |
| `tokenHash` | SHA-256 hex, `select: false` |
| `expiresAt` | 30 minutes from issuance |
| `usedAt` | Set only by the winning conditional update |
| `revokedAt` | Set on resend or failed delivery |
| `issuedAt` | Clock used for the 60-second cooldown |

## Indexes (additive, not applied to Atlas by this step)

| Index | Why |
|---|---|
| Unique `{ tokenHash: 1 }` | One digest, one challenge |
| `{ userId: 1, purpose: 1, createdAt: -1 }` | Latest challenge and cooldown |
| Partial unique `{ userId: 1, purpose: 1 }` while `usedAt` and `revokedAt` are null | One live challenge |
| TTL `{ expiresAt: 1 }` with `expireAfterSeconds: 0` | Delayed cleanup only |

The service compares `expiresAt` itself. A row that TTL has not deleted is still rejected when `expiresAt <= now`.

## Lifecycle

1. Request looks up a `PENDING` user with `emailVerified: false`. Any other case returns the same acceptance and stores nothing.
2. A request inside 60 seconds of the latest challenge returns acceptance and does not send another message.
3. The current live challenge is revoked by its own id, then one new challenge is created. A second racing request loses that revoke and does not send. A duplicate live-challenge write returns acceptance without a second send. If the new challenge cannot be stored, the previous token is restored unless another live challenge already won the unique index.
4. The link is `FRONTEND_ORIGIN + /verify-email#token=...`. The fragment is not sent to the server by the browser.
5. POST consume is the only transition. Replay, expiry, revocation, email mismatch, `DISABLED`, and `SUSPENDED` fail without a session.
6. User update failure clears `usedAt` so a recoverable failure is not reported as success.

`db:indexes:check` against a live database was not run.
