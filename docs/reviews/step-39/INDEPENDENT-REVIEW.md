# Step 39 review notes

This pass was implemented and checked in the same session. A second person has not reviewed it. Treat the findings below as an author check, not an independent sign-off.

## What held

- Refresh cookie is not returned in JSON. Tests assert `refreshToken` is absent and the stored value is an HMAC digest.
- Eight concurrent refreshes produced one success.
- Replay after the grace window revoked that family and left a second family usable.
- Disabled, pending, suspended, unverified, inactive role, and inactive agency logins returned the same `401` as a bad password.
- A failed `RefreshSession.create` returned `503` and no `Set-Cookie`.
- Access tokens are verified with `jose` and an HS256 allowlist.

## What is still open

- Browser proof that Chrome stores and resends the `Secure` `SameSite=None` cookie on localhost.
- Full API suite, web lint, and production build were not all re-run after the last edit.
- Logout and per-request status checks are still future steps. An access JWT issued before a user is disabled keeps verifying until it expires, unless the caller hits `/auth/refresh`.
