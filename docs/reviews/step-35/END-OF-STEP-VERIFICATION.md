# Step 35 — End-of-step verification

**Verified:** 2026-10-22, from the worktree, not from the earlier implementation report alone.  
**Worktree:** `c:\Users\ASUS\Desktop\InfraOS\InfraOS-step35`  
**Branch:** `feature/step-35-auth-db-session-review`  
**HEAD:** `15178cc` (unchanged; Step 35 edits are uncommitted)  
**Upstream:** still `origin/development` until a feature push sets its own upstream.

## What was built

A database and session **architecture hardening**, not a login system.

- `refresh_sessions.tokenHash` has a unique index so a future refresh lookup cannot insert two rows with the same hash.
- `User.toObject()` strips `passwordHash`. `RefreshSession.toObject()` strips `tokenHash`.
- Tests record that default `lean()` hides `passwordHash`, and that `.select('+passwordHash').lean()` still returns it.
- Review notes under `docs/reviews/step-35/`.

There is no `/api/v1/auth/login`, no JWT signer, no refresh cookie, and no login page. A search of `apps/api/src` found no `auth/login`, `signJwt`, or `bcrypt` usage.

## Acceptance matrix

| Requirement | Result | Evidence |
| --- | --- | --- |
| Review User, Role, RefreshSession | **PASS** | Models read; Role catalog left unchanged |
| Unique normalized email | **PASS** | Existing identity test still green |
| Secret redaction on JSON/object | **PASS** | `models.identity.test.ts` |
| `lean()` risk documented and tested | **PASS** | Default lean omits hash; explicit select does not |
| Unique token-hash index | **PASS** | Index assertion plus duplicate insert rejection |
| TTL is not treated as instant logout | **PASS** | TTL index still `expireAfterSeconds: 0`; docs say the API must compare `expiresAt` |
| No auth routes in this step | **PASS** | Router file only mounts `/health` and `/ready` |
| Rotation, replay, CSRF, disabled-user checks | **PLANNED** | Step 39 / 43. Not claimed as pass |
| Login UI, Sora/DM Sans auth screens | **NOT IN SCOPE** | No visual change. Design-system work remains on the other checkout |
| Production index migration | **NOT RUN** | Must happen before Step 39 traffic. Do not run it from this review |

## Automated results (this verification)

| Command | Result |
| --- | --- |
| `npm run test:api` | **PASS** — 13 files, 192 tests. Includes `models.identity.test.ts` (7) |
| `npm run type-check:api` | **PASS** |
| `npm run lint:api` | **PASS** |
| `npm run build:api` | **PASS** |
| `npm run test:web` | **PASS** — 24 files, 96 tests. No web source changed |
| `npm run type-check:web` | **PASS** |
| `npm run lint:web` | **PASS** — 0 errors. Pre-existing warning in `data-table.tsx` (`react-hooks/incompatible-library`) |
| `npm run build:web` | **PASS** — 24 public routes |
| `npm run db:indexes:check` | **NOT RUN** — needs an authorized disposable database |

No new failures. The data-table warning is pre-existing and unrelated.

## Frontend

No screenshots. This step does not change the public landing or the internal shell. The Sora/DM Sans design system is still uncommitted on `feature/infraos-connected-future-ui` in `c:\Users\ASUS\Desktop\InfraOS\InfraOS`.

## Security limits

- Duplicate refresh hashes are rejected in the isolated test database.
- Concurrent rotation and replay-family revoke are **not implemented**.
- A selected lean document can still contain `passwordHash`. Callers must not return it.
- Health JSON tests already assert the payload does not contain `SECRET`, `PASSWORD`, or `mongodb`.

## Git

Uncommitted in the worktree:

- `apps/api/src/modules/identity/models/refresh-session.model.ts`
- `apps/api/src/modules/identity/models/user.model.ts`
- `apps/api/tests/models.identity.test.ts`
- `docs/database/core-models.md`
- `docs/database/indexes.md`
- `docs/reviews/step-35/` (untracked)

Do not commit from the primary checkout. That tree holds the design-system edits.

## Approval

**Ready for Step 35 architecture approval.** Not ready to be described as working authentication. Step 36 stays blocked until you approve this step and authorize a commit.
