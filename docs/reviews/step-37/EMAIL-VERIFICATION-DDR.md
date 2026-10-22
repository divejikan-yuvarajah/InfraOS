# Step 37 email verification decision record

## Decision

Email verification proves that someone could present a single-use secret bound to one pending account and one normalized email. It does not prove employment, grant a role, or open a session.

## Q-002 remains open

Successful verification sets `emailVerified` to `true` and leaves `status` as `PENDING`. This step does not activate staff. A later owner decision is required before any login or activation rule treats a verified pending account as allowed to sign in.

## Q-005 remains closed

Citizen self-registration is still rejected by the Step 36 service. This step does not add a citizen signup path.

## Token

- `crypto.randomBytes(32)` encoded as base64url (43 characters).
- Only SHA-256 hex is stored. An unkeyed hash is acceptable because the token has 256 bits of entropy and is not a password. An HMAC key is not introduced because no verification key is provisioned.
- Purpose is only `VERIFY_EMAIL`.
- Bound to `userId` and the exact normalized email at issuance.
- Lifetime is 30 minutes, inside the 15–60 minute proposal.
- Collection `email_verification_challenges`. `refresh_sessions` is not reused.

## Consumption

`findOneAndUpdate` requires `usedAt: null`, `revokedAt: null`, and `expiresAt > now`. The user update then sets only `emailVerified`. If that update throws or matches nothing, `usedAt` is cleared and the caller does not receive success. mongodb-memory-server in this repository is not a replica set, so a multi-document transaction is not required.

## Delivery

`NODE_ENV=production` uses an unavailable sender. No challenge is created and the public body stays `{ status: "ACCEPTED" }`. Test and development use an in-memory sender that is not an HTTP endpoint.

## Public routes

- `POST /api/v1/auth/verification/request`
- `POST /api/v1/auth/verify-email`

There is no status-by-email route and no GET consumer. UI is deferred: **SERVICE/API VERIFIED; UI DEFERRED**.
