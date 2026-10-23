# Step 39 demo guide

Do not paste raw cookies, access tokens, or passwords into notes or screenshots.

## Isolated API check

From `InfraOS-step39` (the clean Step 39 worktree):

```powershell
$env:NODE_ENV = "test"
$env:ACCESS_TOKEN_SECRET = "access-secret-step39-0123456789abcdef"
$env:REFRESH_TOKEN_SECRET = "refresh-secret-step39-0123456789abcdef"
$env:FRONTEND_ORIGIN = "http://localhost:3000"
npm run test -w @infraos/api -- tests/auth-jwt.test.ts tests/auth-rate-limit.test.ts tests/auth-session.test.ts
```

Observed on 2026-10-23: JWT and rate-limit files passed. The session file passed **10/10** after the disposable MongoDB binary finished downloading. The suite covers a correct login, the generic 401 cases, cookie flags, one-winner concurrent refresh, replay after the 10 second grace window, absolute expiry, a disabled account, and a failed session insert with no cookie.

## Browser

Live login in the browser needs a non-production web build with `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=1` and `NEXT_PUBLIC_API_BASE_URL` pointed at the API. Production builds stay in preview until Steps 40, 43, and 44. A full browser walkthrough of `Set-Cookie` on localhost was **not run** in this pass. Supertest observed the cookie flags and a following refresh that sent the cookie back.

Public `/` is unchanged aside from a silent boot refresh that does nothing unless live mode is on.
