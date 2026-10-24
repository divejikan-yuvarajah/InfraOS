# Step 42 credential revocation architecture

## Why `updateMany` on families is not enough

`persistInitialRefreshSession` compares the password in `loginWithPassword`, then creates a `refresh_sessions` row and a `refresh_families` row. A reset that only closes families currently in the collection loses to this order:

1. Login reads the old `passwordHash` and bcrypt succeeds.
2. Reset writes the new hash and closes every open family.
3. Login creates a new family and returns a cookie.

`rotateRefreshSession` has the same shape as logout. It claims the session (`revokedAt` set), then swaps `RefreshFamily.activeTokenHash`, then inserts the successor. A family close that runs in either gap does not, by itself, stop a swap or insert that already passed its earlier check. Step 40 fixed logout with `closedAt` on that one family. Reset must cover **every** family, including one created after the close.

## Selected linearization point

Add one number on the user, `credentialEpoch`, default `0`.

The commit point is a single user update:

```text
findOneAndUpdate(
  { _id, credentialEpoch: E },
  { $set: { passwordHash: newHash, credentialEpoch: E + 1 } }
)
```

`E` is the epoch read inside the same transaction before this update. Exactly one reset wins if two resets race. Login and refresh treat a family as live only when `family.credentialEpoch === user.credentialEpoch`.

Closing families is required cleanup, not the security boundary. A family that appears after `updateMany` still carries the old epoch and fails the compare.

## Smallest schema additions

`User.credentialEpoch`: Number, required, default 0. No separate index. Lookup stays on `_id`.

`RefreshFamily.credentialEpoch`: Number, required for new families, copied from the user at creation. Missing field on existing documents means `0`. After the first successful reset the user epoch is at least `1`, so those old families no longer match.

No new collection. No change to bcrypt cost, password length, or the 72-byte limit. Password bytes are not trimmed.

Proposed index, not created on Atlas:

```text
refresh_families { userId: 1, closedAt: 1 }
```

Used only to make the cleanup `updateMany` bounded. The epoch predicate does not depend on it.

## Transaction

Use `mongoose.startSession()` and `withTransaction` when the deployment is a replica set (Atlas, and the memory server when it is started as a replica set).

```text
withTransaction:
  challenge = findOneAndUpdate(
    { tokenHash, purpose: "RESET_PASSWORD", consumedAt: null, revokedAt: null, expiresAt: { $gt: now } },
    { $set: { consumedAt: now } }
  )
  if challenge is null: abort { code: "rejected" }

  user = findById(challenge.userId).select("+passwordHash +credentialEpoch")
  if user is missing or fails the owner-selected eligibility rule:
    abort { code: "rejected" }   // transaction rolls the consume back

  written = findOneAndUpdate(
    { _id: user._id, credentialEpoch: user.credentialEpoch },
    { $set: { passwordHash: bcrypt(password, 12), credentialEpoch: user.credentialEpoch + 1 } }
  )
  if written is null: abort { code: "conflict" }  // retry the whole transaction once

  updateMany refresh_families
    { userId, $or: [ { credentialEpoch: { $lte: user.credentialEpoch } }, { credentialEpoch: { $exists: false } } ] }
    { $set: { closedAt: now, activeTokenHash: null } }

  updateMany refresh_sessions
    { userId, revokedAt: null }
    { $set: { revokedAt: now } }

  updateMany password_reset_challenges
    { userId, purpose: "RESET_PASSWORD", consumedAt: null, revokedAt: null, _id: { $ne: challenge._id } }
    { $set: { revokedAt: now } }
```

Abort rolls back the consume, the hash, and the epoch. The client gets `503` only when the transaction throws. A logical reject gets `400` and leaves the database unchanged.

Retry once on `conflict` (another writer incremented the epoch). Do not retry a `rejected` outcome.

A pair of reads outside a transaction is not this algorithm.

## Login change

After bcrypt succeeds against hash `H` and epoch `E`:

1. Create the session and family with `credentialEpoch: E`.
2. Inside the same transaction, `findOne` the user again with `{ credentialEpoch: E }` and the new hash still equal to `H`.
3. If that read fails, abort. The family insert rolls back. Response is generic `401`, no cookie.

If a transaction is not available, do not ship the login path. Returning a cookie after an unsynchronized re-read still leaves a window.

## Refresh change

After the session claim and `afterClaim` hook:

1. Load `user.credentialEpoch`.
2. Swap only when `{ familyId, closedAt: null, activeTokenHash: oldHash, credentialEpoch: user.credentialEpoch }`.
3. Insert the successor only inside that same transaction.
4. If the swap misses, leave `revokedAt` set and do not restore a hash onto a family whose epoch is stale.

`restoreHashIfStillOpen` must also require `credentialEpoch` equal to the epoch this request swapped. A reset that already incremented the user epoch must not be undone by a hash restore.

## Failure behavior

| Failure | Database | Client |
|---|---|---|
| Token already consumed, revoked, expired, or wrong purpose | Unchanged | `400` generic |
| Eligibility fails | Unchanged, consume rolled back | `400` generic |
| Epoch conflict | Unchanged | One retry, then `503` |
| Transaction abort after a network error | Unchanged if the abort reached the server | `503`, client may retry the same token |
| Cleanup `updateMany` inside the transaction fails | Whole transaction aborts | `503` |

Expired challenges that TTL has not deleted still fail `expiresAt: { $gt: now }`.
