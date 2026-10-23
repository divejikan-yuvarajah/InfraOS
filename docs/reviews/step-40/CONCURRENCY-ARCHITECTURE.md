# Step 40 concurrency architecture

**Branch:** `feature/auth-session-lifecycle` at base `7da9743`  
**Worktree:** `C:\Users\ASUS\Desktop\InfraOS\InfraOS-auth-lifecycle`  
**Status:** implemented locally. Not committed. Atlas indexes not created.

## Why `updateMany` is not enough

Refresh claims the current session by setting `revokedAt`, then inserts the successor later. Logout that only updates rows with `revokedAt: null` can run in that gap, match nothing, and return success. The insert then creates a live successor.

A partial unique index only on tombstone rows does not stop that insert. A partial unique index on every live session row would, but it also constrains ordinary rotation. That design was not used.

## Selected barrier

Collection `refresh_families`, one document per family.

- `activeTokenHash` is the only refresh hash that may be replaced.
- `closedAt` set means the family is finished until `expiresAt`.
- Logout and refresh both use one `findOneAndUpdate` on that document.

Logout commits by matching `{ familyId, closedAt: null }` and setting `closedAt` plus `activeTokenHash: null`. A refresh that already claimed the old session then fails its own update `{ closedAt: null, activeTokenHash: oldHash }`. It does not clear `revokedAt`.

If logout runs after the hash has moved to the successor, the same logout update still matches `closedAt: null` and clears the new hash. The successor row is then rejected by a re-read before a cookie is issued. The failure path restores the previous hash only when `closedAt` is still null and the hash is still the one this request wrote.

Other families are separate documents. Logout does not update by `userId`.

No access-token denylist. An access JWT already issued stays valid until it expires. That is Step 44.

## Tests that force the order

`apps/api/tests/auth-logout.test.ts` uses hooks, not sleeps.

- After claim, before the hash swap: logout commits, then refresh resumes. Result `401`, no live session, hash null.
- After the hash swap, before the successor insert: logout commits, then refresh resumes. Result `401`, no live session, a later refresh of the old cookie is `401`.
- Logout fully completes, then refresh starts. Result `401`.

Observed 2026-10-24 01:41 +05:30 in `npm run test:api`: those cases passed inside 10 logout tests, 238 API tests total, exit 0.
