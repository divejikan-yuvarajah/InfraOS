# Step 41 implementation manifest

**Branch:** `feature/auth-password-recovery` at base `4e97f42`  
**Uncommitted.**

## Added

- `apps/api/src/modules/identity/models/password-reset-challenge.model.ts`
- `apps/api/src/modules/identity/password-reset-mail.ts`
- `apps/api/src/modules/identity/password-reset-request.schema.ts`
- `apps/api/src/modules/identity/password-reset-request.service.ts`
- `apps/api/tests/password-reset-request.test.ts`
- `apps/web/src/app/forgot-password/page.tsx`
- `apps/web/src/app/si/forgot-password/page.tsx`
- `apps/web/src/app/ta/forgot-password/page.tsx`
- `apps/web/src/components/auth/forgot-password-form.tsx`
- `apps/web/src/components/auth/forgot-password-page-shell.tsx`
- `apps/web/src/lib/auth/forgot-password-schema.ts`
- `docs/reviews/step-41/*` (design plus this evidence pack)

## Edited

- `apps/api/src/modules/identity/auth/auth.routes.ts` — `POST /forgot-password`
- `apps/api/src/modules/identity/auth/auth.security.ts` — rate limit
- `apps/api/src/shared/database/index-models.ts` — model registered for later read-only checks
- `apps/api/tests/helpers/mongo-memory.ts` — clear the new collection
- `apps/web/src/components/auth/login-form.tsx` — Forgot password? link
- `apps/web/src/lib/auth/client.ts`
- `apps/web/src/lib/auth/messages.ts`
- `apps/web/src/lib/auth/redirect.ts`
- `apps/web/src/lib/auth/auth.test.ts`

## Not changed

Public landing routes, fonts, and styles. No Step 42 consume route. No mail provider credentials.
