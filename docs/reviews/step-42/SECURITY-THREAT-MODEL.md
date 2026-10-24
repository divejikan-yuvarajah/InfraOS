# Step 42 threat model

## Assets

The new password hash, unused reset tokens, and every refresh family for the account. An access JWT already issued is not revoked here. Step 44 still has to check the account on protected routes.

## API

`POST /api/v1/auth/reset-password`

Headers: `Origin` or `Referer` must match `FRONTEND_ORIGIN`. `Content-Type: application/json`. `Cache-Control: no-store`. `Referrer-Policy: no-referrer`.

Body, strict Zod: `{ "token": "<43 char base64url>", "password": "<untrimmed>" }`. Reject `returnTo`, `next`, `email`, `status`, and any other key.

The token is posted in JSON. It is not accepted from the query string.

| Result | HTTP | Body |
|---|---|---|
| Reset committed | 200 | `{ status: "RESET" }` and no `Set-Cookie`, no access token |
| Malformed, weak password, bad token, ineligible | 400 | `VALIDATION_ERROR`, one generic message |
| Origin rejected | 403 | `FORBIDDEN` |
| Not JSON | 415 | `UNSUPPORTED_MEDIA` |
| IP rate limit | 429 | `RATE_LIMITED` |
| Transaction failed | 503 | `SERVICE_UNAVAILABLE` |

Password rules stay in `registration.schema.ts`: minimum 8 characters, maximum 72 UTF-8 bytes, no trim, bcryptjs cost 12.

## Browser

Pages `/reset-password`, `/si/reset-password`, `/ta/reset-password` only. Reuse the auth shell. Do not change the public landing.

On load, read `location.hash` once into component state, then `history.replaceState` to remove the fragment. Do not send the token to the server during SSR. Do not write `localStorage` or `sessionStorage`. Do not log the token. Drop it from state after submit, success, or cancel. `robots: noindex, nofollow` and `Referrer-Policy: no-referrer` on the route.

A reload after the fragment is removed shows an empty form and a generic expired-link message, not a recovered token.

## Threats

| Threat | Control |
|---|---|
| Same token consumed twice | One `findOneAndUpdate` on `consumedAt: null` inside the transaction |
| Second outstanding link | Sibling challenges revoked in the same transaction; partial unique index already aims for one live row |
| Old-password login overlaps reset | Login family insert is in a transaction that re-reads `credentialEpoch` and the hash just compared. Mismatch aborts the insert |
| Refresh swaps after reset | Swap filter includes `closedAt: null` and `credentialEpoch` equal to the current user epoch |
| Successor inserted after close | The swap and the successor insert are separate writes. After the insert, the family is re-read. If reset closed it or changed the epoch, the successor is revoked. Hash restore runs only when the epoch is unchanged and the family is still open |
| Other users | Updates filter `userId` from the consumed challenge, never from the body |
| Token in logs or JSON success | Success body is only `RESET`. Audit records category and user id |
| Status flip or auto-login | No status write. No session cookie on this route |
| Expired row still stored | `expiresAt > now` in the consume filter |
| Wrong purpose | `purpose: "RESET_PASSWORD"` in the filter |

## Consumption policy

Policy A is the approved rule. A token is consumed only when the account can still sign in: `ACTIVE`, verified email, active role, and active agency. A disabled account is rejected and the transaction rolls back. Reset does not change `status` or `emailVerified`.

Acceptance evidence is in `END-OF-STEP-VERIFICATION.md` and `INDEPENDENT-REVIEW.md` (2026-10-24).
