# Step 35 — Post-implementation review

**Branch:** `feature/step-35-auth-db-session-review` (worktree, uncommitted)  
**Boundary:** Steps 36–46 were **not** started.

## Source changes

| Change | Why |
| --- | --- |
| Unique index on `RefreshSession.tokenHash` | Lookup and duplicate-token rejection for Step 39 |
| `toObject` strips `passwordHash` and `tokenHash` | Same redaction as `toJSON` when a caller explicitly selects the secret |
| Identity tests | Unique index, duplicate rejection, `toObject` redaction, and `lean()` secret behavior |
| `docs/database/core-models.md`, `docs/database/indexes.md` | Document the unique hash index and the existing session indexes |
| `docs/reviews/step-35/*` | Audit, threat model, migration plan, test matrix, API handoff, Step 36 handoff |

No auth routes, cookies, JWT signing, web login UI, or design-token edits.

## Verification

| Command | Result |
| --- | --- |
| `npm run test:api` | **PASS** — 192/192 (13 files). Lean assertions sit inside the existing password-hash test, so the count did not increase. |
| `npm run type-check:api` | **PASS** |
| `npm run lint:api` | **PASS** |
| `npm run build:api` | **PASS** |
| `npm run test:web` | **PASS** — 96/96 on this branch (design-system tests are not on `development`) |
| `npm run type-check:web` | **PASS** |
| `npm run lint:web` | **PASS** — 0 errors, 1 existing data-table warning |
| `npm run build:web` | **PASS** — 24 routes |
| `git diff --check` | **PASS** |
| `npm run db:indexes:check` | **NOT RUN** — no authorized disposable database |

## Independent review notes

- Unique hash index does not replace the atomic rotation update. Both are required.
- `lean()` still omits `select: false` fields unless `+tokenHash` is requested. `lean()` **does not** run `toObject` transforms. Step 39 services must not return lean documents that selected the hash.
- Role catalog and email uniqueness were already enforced and were left unchanged.

## Handoff to Step 36

Registration may create `User` with `status: PENDING`, `emailVerified: false`, and a bcrypt hash. It must not issue refresh sessions. That remains Step 39.
