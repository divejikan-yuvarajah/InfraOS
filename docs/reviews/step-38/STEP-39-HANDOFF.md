# Step 39 handoff

Step 38 delivers UI and client contracts only.

## Step 39 must implement

- `POST /api/v1/auth/login` returning envelope + access token body and setting refresh cookie
- `POST /api/v1/auth/refresh` rotation per ADR-006
- Server-side eligibility: status, role, agency, Q-002 email verification policy
- Enable web client with `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=1` after integration tests
- CORS + cookie domain plan for deployed origins

## Client ready for wiring

- `apps/web/src/lib/auth/transport.ts` — `createLiveAuthTransport()`
- `apps/web/src/lib/auth/state.ts` — memory access token holder
- `apps/web/src/lib/auth/client.ts` — `loginWithAuthClient()`

Do not treat Step 38 submit success in production as authentication until Step 39 is merged and the live flag is set.
