# Step 42 bug fixes and regression tests

**When:** 2026-10-24 23:55 +05:30

## Legacy epoch

**FAIL then PASS.** A user document with `credentialEpoch` removed read back as `0` because of the schema default. The update filter `{ credentialEpoch: 0 }` did not match the stored document, so consume returned `unavailable` and wrote nothing.

The consume update and the refresh `epochEquals` helper now match epoch 0 as `{ $or: [{ credentialEpoch: { $exists: false } }, { credentialEpoch: 0 }] }`. A non-zero epoch still matches that exact number.

Regression: `treats a missing credentialEpoch as zero and then stores one` in `apps/api/tests/password-reset-consume.test.ts`. Focused file: 8 passed.

## Fragment dropped on remount

**FAIL then PASS.** The first effect read `#token=` and immediately called `replaceState`. In development the effect runs again, the fragment is already gone, and the token state became null. The password field stayed disabled.

The token is now held in a module variable, not `localStorage` or `sessionStorage`. The effect records the fragment, then strips it. A later run with an empty fragment keeps the held token. A newer fragment replaces it and clears a previous outcome. `hashchange` covers a same-page fragment update.

Regression: `readResetTokenFromHash` and `retainResetToken` in `apps/web/src/lib/auth/reset-fragment.ts`, covered by `reset fragment retention` in `apps/web/src/lib/auth/auth.test.ts`. Browser recheck: field enabled, fragment gone, marker absent from the DOM and web storage.

## Unavailable shown as a dead link

**FAIL then PASS.** Any non-success outcome used the rejected copy, including HTTP 503, and the wording told the person to request a new link. The token was already kept for retry, which contradicted that copy.

`unavailable` now has its own sentence. The form stays enabled. `reset password client` maps `RESET`, HTTP 400, and HTTP 503, and the returned outcome string does not contain the token.

## Client password bounds

The form rejects fewer than 8 characters and more than 72 UTF-8 bytes before the request. The API already rejected those. The browser showed the short-password alert. The 72-byte path is the shared copy plus the client check; it was not clicked in the browser.

## Not a product defect

The first full web run (112 tests) predates these web tests. The re-run is 115 tests, 25 files, all passed.
