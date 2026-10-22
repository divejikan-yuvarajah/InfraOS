# Step 37 security test matrix

| Case | Test |
|---|---|
| Hash-only storage | `verifies a pending user once...` selects `tokenHash` and compares it with the raw token |
| Single use and no activation | Same test, plus replay |
| Concurrent consume | `lets exactly one concurrent consume succeed` |
| Expiry while the row exists | `rejects an expired challenge that is still stored` |
| Changed email | `does not accept a challenge after the email changes` |
| Disabled and suspended | `does not verify disabled or suspended accounts` |
| Resend invalidation | `invalidates the previous challenge on resend` |
| Sender failure | `revokes the challenge when delivery fails` |
| Missing account | `returns the same acceptance for a missing account...` |
| Production fail closed | `fails closed in production without creating a challenge` |
| Allowlisted link | `builds links only from the allowlisted origin` |
| Partial user update | `restores the challenge when the user update fails` |
| Enumeration, origin, returnTo, GET, cookies | `keeps HTTP responses generic...` |
| Step 36 regression | Existing `registration.service.test.ts` |
| Step 35 regression | Existing identity model tests |

UI, axe, and locale screenshots: **NOT RUN**. No page was added. Record: **SERVICE/API VERIFIED; UI DEFERRED**.
