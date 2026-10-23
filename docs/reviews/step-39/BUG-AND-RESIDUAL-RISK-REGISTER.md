# Step 39 residual risks

| ID | Risk | Severity | Owner |
|---|---|---|---|
| R-39-1 | Access JWTs are not re-checked against account status on ordinary API routes. Disabling a user stops refresh, not an already issued access token. | High until Step 44 | Step 44 |
| R-39-2 | No logout route. A stolen refresh cookie inside the grace window, or before reuse detection, can still rotate. | High until Step 40 | Step 40 |
| R-39-3 | Production web login stays off. Turning the public flag on before Steps 40, 43, and 44 would expose a partial control plane. | High if misconfigured | Release owner |
| R-39-4 | Benign-race window is 10 seconds. A thief who replays inside that window gets `401` and does not trip family revocation. | Medium, accepted | Step 39 record |
| R-39-5 | Users with `agencyId: null` cannot sign in, including any future platform role that is modeled that way. | Medium | Identity owner |
| R-39-6 | Login rate limit is per IP, 10 / 15 min outside tests. A shared NAT can lock out a lab. | Low | Step 40+ tuning |
| R-39-7 | **Fixed locally 2026-10-23, not committed.** Login with Mongo disconnected waited on Mongoose buffering and returned `500`. It now returns `503 SERVICE_UNAVAILABLE` before querying. | Was high | Owner commit |
| R-39-8 | **Fixed locally 2026-10-23, not committed.** Invalid JSON on login returned `500` and the error logger included a body fragment. It now returns `400 VALIDATION_ERROR` without logging the body. | Was medium | Owner commit |
| R-39-9 | Successful browser cookie acceptance is unproven. Secrets and `infraos_dev` are configured, but Atlas did not connect (`certificate is not yet valid` plus SRV lookup failure). No synthetic user has been written. Do not weaken `Secure` for plain HTTP. | High for the demo | Owner setup |
| R-39-10 | Full `npm run test:api` failed once on `email verification > sends one message when two requests race` (2 messages instead of 1) while other files ran in parallel. The same test passed alone. It is outside Step 39 and was not changed. | Low, flaky | Identity owner |
