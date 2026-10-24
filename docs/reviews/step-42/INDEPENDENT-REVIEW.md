# Step 42 security review

**When:** 2026-10-24 23:55 +05:30  
**Scope:** uncommitted Step 42 on `feature/auth-password-recovery`  
**Limit:** this is a re-read in the same session that wrote the code. It is not a second person.

## Recommendation

**APPROVE** the uncommitted implementation for owner acceptance.

Do not treat that as approval to commit, push, open a PR, apply Atlas indexes, send live email, or start Step 43.

## What was verified in code and tests

Policy A is applied when the token is consumed. `stillEligible` requires `ACTIVE`, `emailVerified`, an active role, and an active agency. A failed eligibility check throws inside the transaction, so the challenge consume rolls back. The reset does not write `status` or `emailVerified`.

`consumePasswordReset` hashes the new password with bcrypt cost 12 before the transaction, then `withTransaction` does all of the following:

1. Claim the challenge (`consumedAt` set) only when purpose is `RESET_PASSWORD`, it is unconsumed, unrevoked, and unexpired.
2. Re-read the user and re-check Policy A.
3. Replace `passwordHash` and set `credentialEpoch` to the previous epoch plus one.
4. Close that user's refresh families and clear `activeTokenHash`.
5. Revoke that user's open refresh sessions.
6. Revoke other live reset challenges for that user.

A thrown hook aborts the transaction. The regression test sees the previous hash and an unconsumed challenge afterward.

Epoch 0 matches either a stored `0` or a missing field. Mongoose hydrates a missing epoch as `0` on read, so a filter of `{ credentialEpoch: 0 }` alone misses a legacy document. Refresh swap, current-family checks, and hash restore use the same `epochEquals` helper. The legacy test logs in, rotates, consumes, and stores epoch `1`.

Login stores the hash and epoch it verified, then inserts the family only while both still match. The overlap test gets no open family. Refresh after claim and refresh after swap both fail once reset commits. Another user's family is not closed. A second consume, an expired row, a revoked row, and a short password are rejected. The HTTP success body is `{ status: "RESET" }` with no `Set-Cookie`. A foreign origin is rejected.

The reset route sets `Cache-Control: no-store` and `Referrer-Policy: no-referrer`. Validation failures use a generic message. Pino redacts `password`, `passwordHash`, `token`, `tokenHash`, and `activeTokenHash`. The consume service does not log those values.

## What was verified in the browser

The page reads `#token=` into module memory, then `replaceState` removes the fragment. After that, the address bar, page text, `localStorage`, and `sessionStorage` do not contain the marker. English, Sinhala, and Tamil routes keep the in-memory token across client-side language changes. A short password shows "Use at least 8 characters." and does not call the network. Submit shows "Updating…" with `aria-busy`. An injected `200` shows the success status and clears the token. An injected `400` shows the rejected alert, clears the password, and disables the form. An injected `503` shows the unavailable copy and leaves the form usable. A load with no fragment shows the missing-link alert. At 390×844 the grid is one column, the input is about 350px wide, and the document does not scroll horizontally.

The success, rejected, and unavailable browser results are UI fixtures. They are not a live consume and not an email delivery.

## Defects fixed in this pass

See `BUGFIXES-AND-REGRESSION.md`. The legacy epoch miss, the development remount dropping the fragment token, a stale success banner on a new fragment, and a 503 shown as a dead link were fixed and rechecked.

## Accepted residuals

An access JWT from before reset still verifies until it expires. Refresh swap and the successor insert are separate writes, gated by the epoch. Those are recorded in `REMAINING-RISKS.md`. They do not block this step.
