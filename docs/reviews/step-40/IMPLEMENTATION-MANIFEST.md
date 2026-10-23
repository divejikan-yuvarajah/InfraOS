# Step 40 implementation manifest

Worktree `InfraOS-auth-lifecycle`, branch `feature/auth-session-lifecycle`, base `7da9743`. Not committed.

| File | Change |
|---|---|
| `apps/api/src/modules/identity/models/refresh-family.model.ts` | New family guard |
| `apps/api/src/modules/identity/auth/refresh-session.service.ts` | Create the guard on login. Rotate only if the guard accepts the hash. Logout closes that guard. Failure restore cannot clear a closed guard |
| `apps/api/src/modules/identity/auth/auth.routes.ts` | `POST /logout` |
| `apps/api/src/modules/identity/auth/auth.security.ts` | Logout rate limit, 30 / 15 min, 80 in tests |
| `apps/api/src/shared/database/index-models.ts` | Include the new model in the read-only index report |
| `apps/api/src/shared/logger.ts` | Redact `activeTokenHash` |
| `apps/api/tests/auth-logout.test.ts` | Logout and barrier tests |
| `apps/api/tests/helpers/mongo-memory.ts` | Clear family documents between tests |
| `apps/web/src/lib/auth/state.ts` | Logout epoch |
| `apps/web/src/lib/auth/client.ts` | `logoutWithAuthClient` |
| `apps/web/src/lib/auth/transport.ts` | `POST /api/v1/auth/logout` |
| `apps/web/src/lib/auth/refresh-flight.ts` | Ignore a refresh that started before logout |
| `apps/web/src/lib/auth/types.ts` | `LogoutOutcome` |
| `apps/web/src/lib/auth/auth.test.ts` | Late refresh, late login, unconfirmed server |
| `apps/web/src/lib/api/client.ts` | Do not refresh-retry the logout path |

No public landing file is in the diff. No logout button was added. There is no authenticated shell yet. The client function is what the later shell should call.

## HTTP contract

| Case | Status |
|---|---|
| Family closed, or cookie missing / unknown / repeated | `204` empty, cookie cleared |
| Origin not allowed | `403`, cookie unchanged, no write |
| Limiter exceeded | `429` |
| Guard write failed | `503`, cookie kept |
| Wrong content type | `415` |

`204` does not mean the access JWT is dead. It means this refresh family cannot mint another one.
