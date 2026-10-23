# Independent review after the local Step 40 build

**Scope:** the uncommitted diff in `InfraOS-auth-lifecycle` at base `7da9743`.  
**When:** 2026-10-24 01:48 +05:30  
This file reviews the code that was just added. It is not a second person.

## What was checked in source

- `POST /logout` is on `authRouter` only. Origin is rejected before the cookie is read. `503` does not clear the cookie. `204` uses `clearRefreshCookie` and `res.status(204).end()`.
- The family close is one `findOneAndUpdate` on `{ familyId, closedAt: null }`. It does not query by a caller-supplied user id.
- Refresh installs a new hash only with `{ closedAt: null, activeTokenHash: previous }`. If that update misses, `revokedAt` is left set.
- Hash restore after a failed insert uses the same closed-null filter, so it cannot undo logout.
- Web logout bumps an epoch before the request. Refresh and login apply a token only when the epoch is unchanged.
- No landing page path is in the diff.

## Evidence

| Item | Result |
|---|---|
| Barrier A, claim then logout | **PASS** in `auth-logout.test.ts` |
| Barrier B, logout then refresh | **PASS** |
| Swap then logout | **PASS** |
| Second family still refreshes | **PASS** |
| `503` keeps the cookie | **PASS** |
| `403` does not write | **PASS** |
| Full API suite | **PASS** — 238 tests |
| Full web suite | **PASS** — 110 tests |
| Browser on localhost | **NOT RUN** |
| Atlas index | **NOT RUN** / not created |

## Disposition

The logout/refresh race described in the earlier blocked review is covered by the family document and the three ordered tests. Release is still **BLOCKED** until you approve the index proposal and a browser pass. The local patch itself is ready for your Git review.

No Step 41 work was started.
