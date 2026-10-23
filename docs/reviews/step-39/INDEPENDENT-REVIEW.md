# Step 39 review notes

This pass was implemented and checked in the same session. A second person has not reviewed it. Treat the findings below as an author check, not an independent sign-off.

## What held

- Refresh cookie is not returned in JSON. Tests assert `refreshToken` is absent and the stored value is an HMAC digest.
- Eight concurrent refreshes produced one success.
- Replay after the grace window revoked that family and left a second family usable.
- Disabled, pending, suspended, unverified, inactive role, and inactive agency logins returned the same `401` as a bad password.
- A failed `RefreshSession.create` returned `503` and no `Set-Cookie`.
- Access tokens are verified with `jose` and an HS256 allowlist.

## 2026-10-23 re-check on `main`

The previous report was not trusted. Focused tests were run again on `2e3c21a` and passed (13, then 14 after the fix). Live API without Mongo originally returned 500; that is fixed locally to 503. Invalid JSON is now 400. The browser rendered `/login` and `/si/login` and showed the unavailable message when sign-in was attempted. A successful cookie round trip was not possible.

## 2026-10-23 final pass

This is still an author check. A second person has not signed it.

- JWT validation, login eligibility, HMAC refresh storage, rotation, the 10 second grace, concurrent single-winner refresh, origin checks, rate limits, and secret redaction remain as implemented in Step 39. This pass did not reimplement them.
- Missing MongoDB now fails closed with `503` before a query, including a regression test that forces `readyState` to 0. Live probe with the current development process also returned `503 SERVICE_UNAVAILABLE`.
- Malformed JSON returns `400` before the error logger runs. Live probe returned `400 VALIDATION_ERROR`.
- Logout does not exist. Ordinary routes still do not enforce the access JWT or re-check role and agency. Those are Steps 40, 43, 44, and 46. Do not treat them as done.
- Production web login remains preview-only.
- Browser refresh-cookie proof is blocked by the Atlas connection. `Secure` was left on.

## What is still open

- Atlas connectivity from this machine, then an owner-approved synthetic user, then a browser login that returns 200 and a `Secure` `SameSite=None` cookie.
- The email-verification race assertion failed once under the full API suite and passed when rerun alone.
- Logout and per-request status checks are still future steps. An access JWT issued before a user is disabled keeps verifying until it expires, unless the caller hits `/auth/refresh`.
