# Step 40 threat notes

| Threat | What the code does |
|---|---|
| Logout CSRF | `rejectDisallowedOrigin` before any write. CORS is not the control |
| Stolen current cookie | Logout closes that `familyId` only |
| Stolen previous cookie in the same family | Lookup still finds the family and closes it, including the successor hash |
| Random cookie | `204`, no family write |
| Second device | Different `familyId`, not updated |
| Refresh in flight | Single-document guard update. Tests cover claim-then-logout and swap-then-logout |
| Restore after a failed insert | Restores the old hash only if `closedAt` is still null |
| 10 second reuse grace | If the family is already closed, grace returns `401` and does not open it |
| Mongo write failure | `503`, cookie not cleared, no success log line for a closed family |
| Client race | Epoch increments before the logout request. Late login and refresh do not store a token |
| Access JWT already issued | Still valid until `exp`. No denylist. No protected-route check |
| Logs | `activeTokenHash` added to the redact list. Logout log stores `requestId` and `revoked` or `absent` only |

Not in this step: logout of every device, password reset, route middleware, RBAC.
