# Step 39 residual risks

| ID | Risk | Severity | Owner |
|---|---|---|---|
| R-39-1 | Access JWTs are not re-checked against account status on ordinary API routes. Disabling a user stops refresh, not an already issued access token. | High until Step 44 | Step 44 |
| R-39-2 | No logout route. A stolen refresh cookie inside the grace window, or before reuse detection, can still rotate. | High until Step 40 | Step 40 |
| R-39-3 | Production web login stays off. Turning the public flag on before Steps 40, 43, and 44 would expose a partial control plane. | High if misconfigured | Release owner |
| R-39-4 | Benign-race window is 10 seconds. A thief who replays inside that window gets `401` and does not trip family revocation. | Medium, accepted | Step 39 record |
| R-39-5 | Users with `agencyId: null` cannot sign in, including any future platform role that is modeled that way. | Medium | Identity owner |
| R-39-6 | Login rate limit is per IP, 10 / 15 min outside tests. A shared NAT can lock out a lab. | Low | Step 40+ tuning |
