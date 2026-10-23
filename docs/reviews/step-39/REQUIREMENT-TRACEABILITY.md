# Step 39 requirement trace

| Requirement | Source |
|---|---|
| Login envelope with user, access token, and expiry | `auth.routes.ts`, `auth.types.ts` |
| Refresh cookie, not JSON | `cookies.ts`, session test |
| HMAC refresh hash and family rotation | `refresh-token.ts`, `refresh-session.service.ts` |
| Origin check | `auth.security.ts` |
| Q-002 blocking rule | `accountCanSignIn` in `refresh-session.service.ts` |
| Memory access token and one refresh flight | `state.ts`, `refresh-flight.ts`, `client.ts` |
| Production login still gated | `apps/web/src/lib/auth/availability.ts` |
