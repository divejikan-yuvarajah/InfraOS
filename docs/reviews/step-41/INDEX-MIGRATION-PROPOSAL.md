# Step 41 — `password_reset_challenges` index migration proposal

**Status:** Do **not** apply to Atlas until owner approves this document and Step 41 implementation.  
**When:** 2026-10-24

---

## 1. Collection

| Item | Value |
|------|--------|
| Name | `password_reset_challenges` |
| Model file (proposed) | `apps/api/src/modules/identity/models/password-reset-challenge.model.ts` |
| Register in | `apps/api/src/shared/database/index-models.ts` for read-only `db:indexes:check` |

---

## 2. Document shape (proposed)

| Field | Type | Notes |
|-------|------|--------|
| `userId` | ObjectId | ref User, required |
| `email` | string | snapshot at issue time, lowercase |
| `purpose` | `"RESET_PASSWORD"` | enum single value |
| `tokenHash` | string | SHA-256 hex, `select: false` |
| `expiresAt` | Date | TTL index |
| `issuedAt` | Date | cooldown calculations |
| `consumedAt` | Date | null until Step 42 consumes |
| `revokedAt` | Date | null while live |

Step 41 writes rows; Step 42 sets `consumedAt`. No password fields on this collection.

---

## 3. Indexes

| Name | Keys | Options | Role |
|------|------|---------|------|
| `tokenHash_1` | `{ tokenHash: 1 }` | `{ unique: true }` | O(1) consume lookup in Step 42 |
| `userId_1_purpose_1_createdAt_-1` | `{ userId: 1, purpose: 1, createdAt: -1 }` | — | Cooldown / audit queries |
| `userId_1_purpose_1` | `{ userId: 1, purpose: 1 }` | `{ unique: true, partialFilterExpression: { consumedAt: null, revokedAt: null } }` | **At most one live challenge per user** |
| `expiresAt_1` | `{ expiresAt: 1 }` | `{ expireAfterSeconds: 0 }` | Mongo TTL cleanup after expiry |

**No changes** to `email_verification_challenges`, `refresh_sessions`, or `refresh_families` in Step 41.

---

## 4. Partial unique index — expiry interaction (critical)

The partial filter `{ consumedAt: null, revokedAt: null }` **does not** exclude expired documents. Until TTL deletes a row, an **expired but unreaped** challenge still occupies the partial unique slot — **same behavior as** `EmailVerificationChallenge` today.

**Required issuance protocol (before insert):**

1. Find “live” row: `{ userId, purpose, consumedAt: null, revokedAt: null }`.
2. If found, **`findOneAndUpdate` revoke** (`revokedAt: now`) even when `expiresAt <= now` (mirror verification service lines 94–109).
3. Then insert new challenge.

**Optional query refinement:** When checking cooldown, use latest by `issuedAt`. When revoking, do not require `expiresAt > now`.

**Why not add `expiresAt` to partial filter?** MongoDB partial indexes cannot express “expiresAt > now” dynamically. Alternative `active: true` flag adds write complexity; **revoke-before-issue + TTL** matches proven Step 37 pattern.

**Concurrency:** Duplicate insert → catch duplicate key → return ACCEPTED (verification pattern). Test hooks validate interleaving.

---

## 5. Mongoose `autoIndex` warning

Development API (`connectDatabase` default `autoIndex: true` outside production) **will create indexes** if the model is loaded against Atlas.

**Before** running `npm run dev:api` against `infraos_dev`:

1. Owner approves this proposal.
2. Apply indexes manually (below) **or** accept autoIndex once on a controlled maintenance window.

**Safe read-only check:** `npm run db:indexes:check` uses `autoIndex: false` — use after connectivity restored.

---

## 6. Migration steps (after approval, `infraos_dev` only)

```javascript
// Confirm db name
db.getName(); // must be infraos_dev

db.password_reset_challenges.createIndex(
  { tokenHash: 1 },
  { unique: true, name: "tokenHash_1" }
);
db.password_reset_challenges.createIndex(
  { userId: 1, purpose: 1, createdAt: -1 },
  { name: "userId_1_purpose_1_createdAt_-1" }
);
db.password_reset_challenges.createIndex(
  { userId: 1, purpose: 1 },
  {
    unique: true,
    name: "userId_1_purpose_1",
    partialFilterExpression: { consumedAt: null, revokedAt: null },
  }
);
db.password_reset_challenges.createIndex(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: "expiresAt_1" }
);
```

**Rollback:** stop Step 41 API; `dropIndex` the four names; drop collection only if no production reset data (Step 41 pre-prod — likely safe).

---

## 7. Isolated tests

In `beforeAll` of password-reset tests only: `PasswordResetChallenge.syncIndexes()` on **memory** `infraos_test` — same as `auth-logout.test.ts` / email verification tests. **Not** an Atlas migration.

---

## 8. Owner approval

- [ ] Approve index definitions and partial-filter strategy  
- [ ] Approve when to run against Atlas (manual vs autoIndex)  
- [ ] Confirm no Step 41 dev server against Atlas until indexes approved or autoIndex risk accepted
