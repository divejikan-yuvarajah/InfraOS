# Step 37 owner-repeatable demonstration

Run this from the Step 37 worktree. It uses mongodb-memory-server. It does not seed Atlas and it does not print a raw verification token.

```powershell
cd C:\Users\ASUS\Desktop\InfraOS\InfraOS-step37
npm run test:api -- tests/email-verification.service.test.ts
```

What the passing file demonstrates:

1. Step 36 `provisionStaff` creates a `PENDING` user with `emailVerified: false`.
2. The in-memory sender captures a message only inside the test process. The stored field is a SHA-256 hex digest, and the test asserts that digest is not the raw token.
3. One POST-equivalent `consumeEmailVerification` call sets `emailVerified: true`, leaves `status` as `PENDING`, and creates no `RefreshSession`.
4. The same token fails on replay. Two concurrent consumes produce exactly one success.
5. An expired document that is still in the collection fails. A changed email, a `DISABLED` account, and a `SUSPENDED` account fail without being marked used.
6. Resend makes the previous token fail. A throwing sender revokes the challenge. An unknown email and a production unavailable sender create no challenge.
7. HTTP `POST /api/v1/auth/verification/request` returns the same `{ status: "ACCEPTED" }` body for a known and an unknown address, with no `Set-Cookie`. A foreign origin is `403`. `returnTo` is `400`. `GET /api/v1/auth/verify-email` is `404`.

There is no browser page to click. Record: **SERVICE/API VERIFIED; UI DEFERRED**.

Do not commit, push, or open a pull request from this guide.
