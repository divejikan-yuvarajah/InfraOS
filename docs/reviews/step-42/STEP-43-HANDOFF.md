# Step 43 handoff

**When:** 2026-10-24 23:55 +05:30  
**Step 43 was not started.**

Step 43 in the roadmap is protected frontend routes and UX. It is not part of password reset. Do not add route guards, Bearer middleware, or an access-token denylist under this step.

## What Step 43 can rely on

- `POST /api/v1/auth/reset-password` returns `{ status: "RESET" }` and does not set a session cookie or an access token.
- After a committed reset, `users.credentialEpoch` is one higher than the epoch stored on families created before that reset.
- Those families are closed and their refresh sessions are revoked.
- Login will not attach a family if the password hash or epoch changed after verification.
- Refresh will not rotate a family whose epoch does not match the user.
- The reset page is `/reset-password`, `/si/reset-password`, and `/ta/reset-password`. The token lives in the fragment, then in tab memory, not in browser storage.

## What Step 43 must not assume

- An access JWT minted before reset is still valid until it expires. Protected UI must not treat "the password was reset" as "every already-issued access token is dead." That denial belongs with Step 44.
- Atlas does not yet have the new `{ userId: 1, closedAt: 1 }` index unless someone applies the proposal.
- Mail is not delivered. Forgot-password in production still does not send.

## Stop

No commit, push, pull request, merge, or Step 43 work until the owner asks for it.
