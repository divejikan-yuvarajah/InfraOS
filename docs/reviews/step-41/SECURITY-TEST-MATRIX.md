# Step 41 security test matrix

**Author run:** 2026-10-24. Isolated Mongo + injected memory sender. Not a live inbox.

| Criterion | Result | Evidence |
|---|---|---|
| Unknown email accepted, no row | **PASS** | `password-reset-request.test.ts` |
| PENDING / unverified no row | **PASS** | same file |
| Eligible account digest + 43-char token | **PASS** | SHA-256 hex stored; raw token not in `toJSON` or audit JSON |
| Link is `/reset-password#token=` on allowlisted origin | **PASS** | `passwordResetLink` |
| No query-string token | **PASS** | `link.includes("?") === false` |
| Cooldown suppresses second send | **PASS** | |
| Expired open challenge revoked then replaced | **PASS** | |
| Two concurrent requests, one live row | **PASS** | `beforeInsert` barrier |
| Unavailable sender writes nothing | **PASS** | |
| Send throw revokes the new challenge and restores the previous one | **PASS** | |
| HTTP 200 identical `ACCEPTED` envelope | **PASS** | unknown address |
| 403 foreign origin | **PASS** | |
| 400 extra `returnTo` / bad email | **PASS** | |
| 415 non-JSON | **PASS** | |
| 429 after test limit (40 / 15 min) | **PASS** | 45 posts |
| Oversized body above Express 1mb | **NOT RUN** | malformed email covered; no dedicated 413 case |
| Timing parity instrumentation | **NOT RUN** | residual risk; status codes match |
| Audit contains no token or hash | **PASS** | serialized audit events |
| Frontend locale paths + schema | **PASS** | `auth.test.ts` (+2) |
| Live SMTP | **BLOCKED** | no provider |
| Browser screenshots | **NOT RUN** | |
| Atlas index apply | **NOT RUN** | proposal only |
