# Step 39 test matrix

| Criterion | Evidence | Result |
|---|---|---|
| Valid login, normalized email, cookie flags, digest stored | `auth-session.test.ts` login test | PASS |
| Wrong password and unknown email share one 401 | same file | PASS |
| PENDING, SUSPENDED, DISABLED, unverified ACTIVE, non-login hash | same file | PASS |
| Inactive role and inactive agency | same file | PASS |
| Extra JSON field, bad origin, non-JSON | same file | PASS |
| Rotation, replay after 10s, other family survives | same file | PASS |
| 8 concurrent refreshes, one successor | same file | PASS |
| Absolute expiry unchanged; disabled refresh fails | same file | PASS |
| Expired session rejected while the row still exists | same file | PASS |
| Insert failure sets no cookie | same file | PASS |
| Logger redact paths | same file | PASS |
| HS256, tamper, `alg=none`, wrong audience, wrong type, expiry | `auth-jwt.test.ts` | PASS |
| Identical or missing secrets fail closed | `auth-jwt.test.ts` | PASS |
| 429 envelope | `auth-rate-limit.test.ts` | PASS |
| Client single-flight refresh | `apps/web/src/lib/auth/auth.test.ts` | PASS — 11 tests in that file |
| Browser Set-Cookie round trip | — | NOT RUN |
