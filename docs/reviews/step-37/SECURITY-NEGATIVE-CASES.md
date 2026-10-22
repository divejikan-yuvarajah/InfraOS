# Step 37 security negative cases

These are enforced by `apps/api/tests/email-verification.service.test.ts`.

| Action | Expected result |
|---|---|
| Replay the same token | Second call `{ ok: false }`; status stays `PENDING` |
| Two concurrent consumes | Exactly one `{ ok: true }` |
| `expiresAt` in the past while the document remains | Rejected; `emailVerified` stays false |
| Email changed after issuance | Rejected; `usedAt` stays null |
| `DISABLED` or `SUSPENDED` | Rejected; `emailVerified` stays false |
| Resend | Previous token fails; the new token can succeed once |
| Sender throws | Challenge `revokedAt` is set |
| Unknown email | `{ accepted: true }`, no document, no message |
| Production sender | `{ accepted: true }`, no document |
| `http://evil.example` as link base | Thrown before send |
| `Origin: https://evil.example` | HTTP 403 `FORBIDDEN` |
| Body `returnTo` or `next` | HTTP 400 generic validation message |
| `GET /api/v1/auth/verify-email` | HTTP 404 `ROUTE_NOT_FOUND` |
| User update throws | `VerificationDependencyError`; `usedAt` restored; no success response |
| Response and audit JSON | No raw token, no `Set-Cookie` |

No negative case changes role, agency, or creates `RefreshSession`.
