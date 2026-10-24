# Step 42 end-of-step verification

**When:** 2026-10-24 23:55 +05:30  
**Branch:** `feature/auth-password-recovery` (Step 41 commit `8071611` plus uncommitted Step 42)  
**Reviewer:** same session that implemented Step 42. Not a second person.  
**Not committed. Not pushed. Atlas was not contacted. Step 43 was not started.**

| Check | Result |
|---|---|
| Policy A at consume (`ACTIVE`, verified email, active role, active agency) | **PASS** — disabled account rejected; status and `emailVerified` are not written |
| One MongoDB transaction for consume, bcrypt replace, `credentialEpoch` increment, family close, session revoke, sibling revoke | **PASS** — `withTransaction` on a one-node replica set |
| Transaction failure does not leave a new password | **PASS** — hook throw rolls back hash and consume |
| Legacy user with no stored `credentialEpoch` | **PASS** — missing field matches epoch 0, then stores `1` |
| Old-password login cannot create a usable session after reset | **PASS** |
| Refresh cannot survive reset, both orders (after claim, and after hash swap) | **PASS** |
| Other users' sessions stay open | **PASS** — family close is filtered by the resetting user |
| Duplicate consume | **PASS** — exactly one commit |
| Expired, revoked, and short-password tokens | **PASS** — generic rejection |
| Tokens, passwords, and hashes not returned | **PASS** — `200` body is `{ status: "RESET" }`, no `Set-Cookie` |
| Logger redact list includes `password`, `passwordHash`, `token`, `tokenHash`, `activeTokenHash` | **PASS** — route does not log the body |
| Fragment read into memory and removed from the URL | **PASS** — browser, after the remount fix |
| Step 39 login and Step 40 logout still in the API suite | **PASS** — full API suite green |
| `tests/password-reset-consume.test.ts` | **PASS** — 8 tests, 33.49s |
| `npm run test:api` | **PASS** — 21 files, 256 tests, 168.73s |
| `npm run test:web` | **PASS** — 25 files, 115 tests (re-run after the fragment and client tests) |
| `npm run type-check` | **PASS** |
| `npm run lint` | **PASS** — exit 0. One existing warning in `data-table.tsx` (`react-hooks/incompatible-library`), unrelated to Step 42 |
| `npm run build` | **PASS** — web routes include `/reset-password`, `/si/reset-password`, `/ta/reset-password`; API `tsc` exit 0 |
| `{ userId: 1, closedAt: 1 }` on the isolated replica set | **PASS** — non-unique, beside unique `familyId` |
| Atlas index / `credentialEpoch` migration | **NOT RUN** — no approval, API not started |
| Live email delivery | **BLOCKED** — no approved provider. No mailbox was claimed |
| Browser UI (EN, SI, TA, validation, loading, success, rejected, unavailable, missing, mobile, semantics) | **PASS** — success, rejected, and unavailable used an in-page response fixture, not the API |
| Browser consume against the real API | **NOT RUN** — would require the API, and the local API env points at Atlas |
| Access JWT issued before reset | **NOT RUN** as a denial. Reset does not revoke it. Step 44 owns that |

Public landing files and `Documents` were not edited.
