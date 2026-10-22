# Step 35 — Pre-implementation audit

**Date:** 2026-10-22  
**Worktree:** `c:\Users\ASUS\Desktop\InfraOS\InfraOS-step35`  
**Branch:** `feature/step-35-auth-db-session-review` at `origin/development` (`15178cc`)  
**Companion files:** `Prompts/INFRAOS_Step_35_Complete_Development_Prompt.md` and `Prompts/INFRAOS_Step_35_Cursor_Codex_Execution_Prompts.md` are **not in the repository**. `Steps.docx` is **not present**. Scope follows the owner prompt pasted for this run and existing ADR-006/007, `docs/architecture/auth-flow.md`, and `docs/architecture/security-decisions.md`.

## Git safety

| Item | Result |
| --- | --- |
| Dirty design-system work | Still **uncommitted** on `feature/infraos-connected-future-ui` in the primary checkout. **Not moved, stashed, or overwritten.** |
| Step 35 location | Dedicated **git worktree** so the dirty tree was not checked out |
| Branch tracking | Created from `origin/development`. Local upstream currently follows `origin/development` until the first feature push sets `origin/feature/step-35-auth-db-session-review` |
| Commit / push / PR | **Not performed** |

## Prerequisites

| Prerequisite | Status |
| --- | --- |
| Public Connected Future on `development` | Present (`15178cc` includes Batch 2B merge) |
| Internal design system V1 | **Local only**, not on `development`. Not required to review identity models. **Not merged in this step.** |
| Auth endpoints | **Absent.** No login, register, refresh, logout, or RBAC middleware implementations were found under `apps/api/src` route modules |

## Baseline models (before this step’s hardening)

| Model | Path | Notes |
| --- | --- | --- |
| User | `apps/api/src/modules/identity/models/user.model.ts` | Unique lowercased email; `passwordHash` `select: false`; `toJSON` strips hash; **`toObject` did not** |
| Role | `apps/api/src/modules/identity/models/role.model.ts` | Immutable catalog `key`; permission validator; no wildcard |
| RefreshSession | `apps/api/src/modules/identity/models/refresh-session.model.ts` | `tokenHash` `select: false`; TTL on `expiresAt`; **no unique/query index on `tokenHash`** |

## Risks recorded before change

1. Refresh lookup in Step 39 would collection-scan `refresh_sessions`.
2. Duplicate hashes were not rejected by the database.
3. `toObject()` after `select('+passwordHash')` / `select('+tokenHash')` could leak secrets into logs or DTOs.
4. TTL deletion is delayed (MongoDB TTL monitor). Logical expiry must still be checked in Step 39. **Not an authorization check.**

## Commands at baseline

Identity model tests already exist (`apps/api/tests/models.identity.test.ts`) using mongodb-memory-server. `npm run db:indexes:check` was **not** run against a live database.
