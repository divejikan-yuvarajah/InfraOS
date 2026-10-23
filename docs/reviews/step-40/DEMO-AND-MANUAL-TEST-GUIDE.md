# Step 40 manual test

Do not start `npm run dev:api` from `InfraOS-auth-lifecycle` against Atlas until you approve `INDEX-MIGRATION-PROPOSAL.md`. Development mode would create `refresh_families` indexes on connect.

Until then, the proof is:

```powershell
cd C:\Users\ASUS\Desktop\InfraOS\InfraOS-auth-lifecycle
npm run test -w @infraos/api -- tests/auth-logout.test.ts tests/auth-session.test.ts
npm run test -w @infraos/web -- src/lib/auth/auth.test.ts
```

After the index is applied and the API is allowed to run:

1. `npm run dev:api` and `npm run dev:web` from this worktree.
2. Open `http://localhost:3000/login`.
3. Sign in with the existing synthetic user. Do not create another account.
4. In DevTools, confirm `infraos_refresh` is HttpOnly, Secure, SameSite=None, Path `/api/v1/auth`, and has no Domain. Do not copy the value.
5. `POST http://localhost:4000/api/v1/auth/logout` with that cookie and `Origin: http://localhost:3000`. Expect **204** and an empty body.
6. The cookie should be cleared with the same Path, HttpOnly, Secure, and SameSite.
7. `POST /api/v1/auth/refresh` with the old cookie. Expect **401**.
8. A second family, if you signed in from another profile, should still refresh.
9. Wrong `Origin` expects **403** and the cookie stays.
10. The access token from the login response can still be decoded until it expires. Logout does not revoke it. That wait is at most 15 minutes and is Step 44's job.

There is no logout button on the public site. Call `logoutWithAuthClient` from the future authenticated shell. If the POST returns **503**, the memory token is already cleared and the result is `unconfirmed`. Do not show that as a finished server logout.
