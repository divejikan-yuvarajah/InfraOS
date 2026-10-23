# Step 40 prerequisite and pre-implementation audit

**Gate:** G0  
**Observed:** 2026-10-24 00:45–00:49 +05:30  
**Checkout:** `C:\Users\ASUS\Desktop\InfraOS\InfraOS`  
**HEAD / `origin/main`:** `90513bc` `docs(auth): record Step 39 approval gate evidence`  
**`origin/development`:** `7da9743` `Merge main: Step 39 approval gate documentation` (one merge commit ahead of `main`; `main` has no commits that `development` lacks)  
**Environment:** `NODE_ENV=development`, database name `infraos_dev`, API `http://localhost:4000`, web `http://localhost:3000`  
**Verdict:** **G0 READY**

No Step 40 feature code was written. No branch was created. No commit, push, merge, reset, stash, or clean was performed.

## Roadmap

`Steps.docx` is not in this workspace, so its exact Step 40 sentence was not read. The sources that are present agree:

- `Prompts/INFRAOS_Step_40_Enhanced_Development_Prompt.md` — logout, current refresh-family revocation, clear the existing cookie, client session end. Access JWTs stay valid until expiry or Step 44.
- `docs/reviews/step-39/STEP-40-HANDOFF.md` — `POST /api/v1/auth/logout` clears the same cookie flags and revokes the current family.
- `docs/architecture/security-decisions.md` — logout clears the cookie and revokes the session family. Origin allowlist stays required because `SameSite=None`.

No scope mismatch among those three. Logout is not mounted on `90513bc` (`git grep auth/logout` in `apps/api/src` and `apps/web/src` found nothing).

## Git (read-only)

Commands run after `git fetch origin --prune`. `git diff --check` was clean.

| Item | Result |
|---|---|
| Branch | `main`, even with `origin/main` at `90513bc` |
| Open pull requests | **0** (`GET /repos/divejikan-yuvarajah/InfraOS/pulls?state=open`). `gh` is not on PATH |
| Main porcelain | One untracked file only: `Prompts/INFRAOS_Step_40_Enhanced_Development_Prompt.md`. Left in place |
| Fail-closed commit `6c3d9a8` | Ancestor of `HEAD` and of `origin/development` |
| Worktree `InfraOS-step39` | Preserved. Branch `feature/step-39-jwt-rotating-refresh` at `76f872a`, **ahead 8** of its remote. Dirty: 5 files, about 111 deletions (`v1.ts`, `app-providers.tsx`, `client.ts`, `auth.test.ts`, `transport.ts`). Not reset |

Do not implement Step 40 in that worktree and do not reuse the already-published Step 39 feature branch.

## Environment presence (values not recorded)

`apps/api/.env`: URI scheme `mongodb+srv`, `MONGODB_DB_NAME=infraos_dev`, access and refresh secrets length 64 and distinct, TTLs `15m` and `7d`, `FRONTEND_ORIGIN=http://localhost:3000`.

`apps/web/.env.local`: `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000`, `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=1`. No public variable name matched a secret, token, password, or Mongo URI.

## Step 39 evidence from this session

Prior review documents were not reused as results.

| Check | Command / observation | Result |
|---|---|---|
| Database | `npm run db:check -w @infraos/api` | **PASS** after one SRV lookup failure on attempt 1. Final line: `INFRAOS MongoDB check: PASS`, environment `development`. TLS verification was not disabled |
| Ready | `GET http://localhost:4000/ready` | **PASS** — HTTP 200, body `database: connected` |
| Health | `GET /health` | **PASS** — HTTP 200 |
| Auth indexes | `npm run db:indexes:check` parsed for four models | **PASS** — `User`, `Role`, `Agency`, `RefreshSession` missing 0, mismatch 0 |
| Other indexes | same command | **FAIL** for the script’s overall intent — 16 non-auth models report missing indexes (empty domain collections). No index sync or drop was run |
| Synthetic user | existing `step39.synthetic@infraos-dev.invalid` only | **Not written this session.** Login against the account created in the earlier approved gate |
| Live login | `POST /api/v1/auth/login` | **PASS** — HTTP 200, access token present, `refreshToken` absent from JSON |
| Cookie flags | `Set-Cookie` on that response | **PASS** — HttpOnly, Secure, SameSite=None, Path `/api/v1/auth`, no Domain |
| Refresh | `POST /api/v1/auth/refresh` with that cookie | **PASS** — HTTP 200, new access token, no refresh token in JSON, new `Set-Cookie` |
| Browser | `http://localhost:3000/login`, submit, then URL | **PASS** — left `/login` while “Signing in…”, then landed on `http://localhost:3000/` (public landing). Cookie jar was not opened in DevTools; flags above are from the live `Set-Cookie` |
| `npm run test:api` | vitest, started 00:45:54 +05:30 | **PASS** — 18 files, 228 tests, exit 0. Includes `auth-jwt` 2, `auth-session` 10, `auth-rate-limit` 3 |
| Email race | inside that same API run | **PASS** — `sends one message when two requests race`. The earlier parallel-suite failure was **not reproduced** |
| `npm run test:web` | vitest | **PASS** — 25 files, 107 tests, exit 0 |
| `npm run type-check` | web then API | **PASS** — exit 0 |
| `npm run lint` | web then API | **PASS** — exit 0. One existing warning: `data-table.tsx` `react-hooks/incompatible-library` |
| `npm run build` | web then API | **PASS** — exit 0 |

## Residuals that do not block G0

- Intermittent Atlas SRV `ENOTFOUND` on the first attempt. The retry connected. If it returns as a hard failure, fix DNS and Atlas network access. Do not turn off TLS checks.
- Dev hydration overlay appeared again on `/login`, this time blamed on `apps/web/src/app/layout.tsx` line 72 (skip link). Sign-in still completed. Not changed.
- Logout, route middleware, and RBAC are still absent. That is Step 40 and Steps 43–46, not a failed Step 39 check.
- Synthetic dev user and agency `AUTH_STEP39_SYNTH` remain in `infraos_dev` until an approved cleanup.
- `R-39-7` and `R-39-8` rows in the risk register still say “not committed”; `6c3d9a8` is on `main`. The register text is stale. The code is merged.

## Branch plan (not created)

After owner approval of Step 40 design/implementation:

1. Leave `main` and the dirty `InfraOS-step39` worktree untouched.
2. Add a new worktree from `origin/development` (`7da9743`).
3. Create one feature branch there, `feature/auth-session-lifecycle`, for logout and refresh-family revocation only.
4. Do not open a branch per later step. Steps 41–46 stay behind their own gates.

## Stop

Implementation has not started. Next action is owner authorization to write the Step 40 design (G1) and then the logout implementation in that new worktree.
