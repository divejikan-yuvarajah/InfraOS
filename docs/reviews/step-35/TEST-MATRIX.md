# Step 35 — Test matrix

| Case | Evidence | Result |
| --- | --- | --- |
| Unique lowercased email | `models.identity.test.ts` | **PASS** (existing) |
| `passwordHash` omitted by default query, `toJSON`, `toObject` | same file | **PASS** |
| Default `lean()` omits `passwordHash` | same file | **PASS** |
| `.select('+passwordHash').lean()` still contains the hash | same file | **PASS** (documents the residual risk; not a product leak path if callers avoid it) |
| `tokenHash` omitted by default; `toObject` strips an explicit select | same file | **PASS** |
| Unique `tokenHash` index and duplicate insert rejected | same file | **PASS** |
| TTL index `{ expiresAt: 1 }` `expireAfterSeconds: 0` | same file | **PASS** |
| Role catalog rejects unknown permission and scope | same file | **PASS** (existing) |
| Atomic refresh rotation under concurrency | — | **PLANNED** (Step 39) |
| Family revoke on replay | — | **PLANNED** (Step 39) |
| Cookie `Origin` check | — | **PLANNED** (Step 39) |
| Disabled user rejected while JWT is unexpired | — | **PLANNED** (Step 43) |
| Login UI, si/ta auth copy | — | **PLANNED** (Step 38); native review still pending |
