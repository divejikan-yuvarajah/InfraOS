# Step 39 file manifest

## API

- `apps/api/src/modules/identity/auth/` — login schema, JWT, refresh HMAC, session rotation, cookies, routes
- `apps/api/src/routes/v1.ts` — mounts the auth router
- `apps/api/src/shared/logger.ts` — redacts cookies, tokens, and password fields
- `apps/api/src/middleware/error-handler.ts` — `413` for oversized JSON
- `apps/api/package.json` — `jose` 6.2.13
- `apps/api/tests/auth-session.test.ts`
- `apps/api/tests/auth-jwt.test.ts`
- `apps/api/tests/auth-rate-limit.test.ts`

## Web

- `apps/web/src/lib/auth/transport.ts` — live login and refresh
- `apps/web/src/lib/auth/refresh-flight.ts` — single-flight refresh and boot
- `apps/web/src/lib/api/client.ts` — optional bearer and one safe retry
- `apps/web/src/components/providers/app-providers.tsx` — boot refresh
- `apps/web/src/lib/auth/auth.test.ts` — single-flight test
