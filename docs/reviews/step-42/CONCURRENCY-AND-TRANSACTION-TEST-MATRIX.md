# Step 42 concurrency and transaction test matrix

All of these run on the isolated memory server. None of them touch Atlas or a real account. Hooks must block inside the transaction boundaries the way `refreshRotationHooks` and `passwordResetIssuanceHooks` do. A sleep is not evidence.

| # | Order | Required result |
|---|---|---|
| C1 | Two consumes of the same token, both waiting before the user update | One `200`. One `400`. One `consumedAt`. Epoch increased by 1. |
| C2 | Two different live challenges for one user, if the test inserts both | First commit revokes the other. Second consume is `400`. One new hash. |
| C3 | Login has passed bcrypt and is waiting before family insert. Reset commits. Login resumes | Login `401`. No open family. No cookie. New password verifies. Old password does not. |
| C4 | Refresh has claimed the session and is waiting before the hash swap. Reset commits. Refresh resumes | Refresh `401`. Family `closedAt` set or epoch mismatch. No successor cookie. |
| C5 | Refresh has swapped `activeTokenHash` and is waiting before successor insert. Reset commits. Refresh resumes | No successor row. Hash restore does not clear `closedAt` or roll the epoch back. |
| C6 | Two families for the reset user and one family for another user | Both of the reset user's families are unusable. The other user's family still refreshes. |
| C7 | Consume transaction throws after the epoch update is staged | Abort. Old hash still verifies. Token still unconsumed. Client `503`. |
| C8 | Repeat the `200` response body | Second call with the same token is `400`. |
| C9 | Verification-purpose token, expired `expiresAt` with the row still present, malformed token | `400`. No hash change. |
| C10 | Password of 8 characters and a 72-byte password succeed. 7 characters and 73 bytes fail | `200` or `400` as above. No trim of internal spaces. |
| C11 | `DISABLED` or `PENDING` user, once the owner picks the status rule | Matches that rule. Status field unchanged in every option. |

## Pass condition

Every row above is **PASS** on a replica-set transaction. If `withTransaction` is not available in the test server, the suite is **BLOCKED**, not passed by falling back to separate updates.

## Not in this step

Access JWT denial on other routes. Real email delivery. Atlas index creation. Step 43 route guards.
