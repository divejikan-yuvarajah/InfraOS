# Step 40 logout design (G1)

**Status:** proposed. No logout code until the owner approves this document.  
**Date:** 2026-10-24  
**Base:** `origin/development` `7da9743`. Local `main` is `90513bc`.  
**G0:** `docs/reviews/step-40/PREREQUISITE-AND-PRE-IMPLEMENTATION-AUDIT.md` is **G0 READY**. This implementation request is treated as acceptance of that gate. G1 is still closed until you approve the race design below.

`Steps.docx` is not in the repo. Step 40 wording used here is logout of the **current refresh family** only, matching `STEP-40-HANDOFF.md` and `security-decisions.md`. Q-002 stays as recorded: sign-in still requires verified `ACTIVE` plus an active role and agency. Logout does **not** re-check that rule. A disabled user can still revoke the family that matches the cookie.

## Branch

Do not reuse `feature/step-39-jwt-rotating-refresh`. That worktree is dirty (local deletions) and the branch is already published.

After G1 approval, add a **new worktree** from `origin/development` and create `feature/auth-session-lifecycle` there. Leave `main` and `InfraOS-step39` untouched. `main` currently has untracked `Prompts/INFRAOS_Step_40_Enhanced_Development_Prompt.md` and `docs/reviews/step-40/`.

## API

`POST /api/v1/auth/logout` on the existing `authRouter`. No query credentials, no body identity, no client `familyId`. Empty body is allowed. If `Content-Type` is present it must be JSON. Malformed JSON stays `400`. Wrong type `415`. Oversized body stays `413`.

| Case | HTTP | Cookie | Database |
|---|---|---|---|
| Cookie matches a session and that family is durably closed | `204` empty | `clearRefreshCookie` | That `familyId` only |
| Missing, unknown, malformed, or repeated cookie | `204` empty | clear | No family write |
| Known rotated or already-revoked predecessor | `204` only after that family is closed | clear | Same family, including successors |
| Origin and Referer not exactly `FRONTEND_ORIGIN` | `403` `FORBIDDEN` | unchanged | No write |
| Rate limit (30 / 15 min, 80 in test, same shape as refresh) | `429` `RATE_LIMITED` | unchanged | No write |
| Secrets missing, Mongo disconnected, or close loop cannot confirm | `503` `SERVICE_UNAVAILABLE` | **not cleared** | No success claim |

`204` has no JSON body. Errors use the existing failure envelope, `Cache-Control: no-store`, `Pragma: no-cache`. Responses never include the refresh token, `tokenHash`, `familyId`, access JWT, or password.

`clearRefreshCookie` already sets HttpOnly, Secure, SameSite=None, Path `/api/v1/auth`, and no Domain. Tests will assert those flags and an expiry in the past.

On `503` the cookie stays so the same device can retry. The client still drops the in-memory access token and must say server revocation is **unconfirmed**.

## Why `updateMany({familyId})` is not enough

Current rotation in `refresh-session.service.ts`:

1. `findOneAndUpdate` sets the predecessor `revokedAt` (the claim).
2. `RefreshSession.create` inserts the successor in the same `familyId` with `revokedAt: null`.
3. The predecessor is linked with `replacedBySessionId`.
4. On insert failure the catch path **clears** the predecessor `revokedAt`.

Worst interleaving:

1. Refresh claims the predecessor (`revokedAt` set, successor not inserted).
2. Logout `updateMany({familyId, revokedAt: null})` matches nothing.
3. Logout returns `204`.
4. Refresh inserts the successor.
5. The family is live again.

A multi-document transaction does not close this by itself on the current schema. Logout may write no document, so it does not conflict with the later insert. `mongodb-memory-server` is also started as a standalone, so transactions are a poor test basis.

## Proposed close (needs your approval)

Stay on `refresh_sessions`. Two additive changes:

1. Boolean `closureTombstone`, default `false`.
2. Partial unique index `{ familyId: 1 }` where `revokedAt` is `null`.

Step 39 already keeps one live row per family. The index build must be checked on `infraos_dev` before it is created. If two live rows share a `familyId`, stop and report. Do not drop or rebuild unrelated indexes. No new collection.

Logout, after HMAC lookup of the cookie (never a browser `userId`):

1. Revoke every row in that family with `revokedAt: null` and `closureTombstone` not true.
2. Insert one tombstone in that family: random token nobody has, `revokedAt: null`, `closureTombstone: true`, `expiresAt` copied from the matched session so the existing TTL still applies.
3. If the insert hits the unique index, a real live row still holds the slot. Repeat the revoke and try again, bounded (5 attempts).
4. Return success only when the tombstone exists and a count of other live rows in that family is 0.
5. If that cannot be confirmed, return `503` and do not clear the cookie.

The commit point is the planted tombstone plus the following revoke. A later successor insert uses the same `familyId` and `revokedAt: null`, so the unique index rejects it.

The refresh catch path must change in one place: a duplicate-key failure must **not** clear the predecessor `revokedAt`. Other insert failures keep today's un-revoke behavior. The 10-second reuse grace stays for theft detection. It does not authorize a refresh after a confirmed logout. Grace classification must treat a family that already has a tombstone as revoked, not as a benign race.

Other families of the same user are not updated. Records are not deleted.

Rollback: stop sending tombstones, ignore `closureTombstone`, and drop the partial index only under a separate approval. Older servers that do not know the field still store it if Mongo is schemaless at the driver layer; strict Mongoose on an old process would reject the field. Roll forward before relying on the index. Do not run the index build against production in this step.

## Client

No authenticated internal shell is mounted for real sessions. `AppShell` is a layout preview. Do not put logout on the public landing page and do not invent a dashboard.

After G1, the client work is:

- `AuthTransport.logout()` → `POST /api/v1/auth/logout` with `credentials: 'include'` and no body, only to `NEXT_PUBLIC_API_BASE_URL`.
- Outcomes: `server-confirmed` (`204`), `already-signed-out` (`204` with no local session), `unconfirmed` (`503` or network).
- Clear the in-memory access token at the start of logout.
- A monotonic epoch ignores a late boot refresh, single-flight refresh, login success, or GET/HEAD retry that started before logout.
- `BroadcastChannel` name `infraos-auth`, message `{ type: "logout", epoch }` only. No token, cookie, email, or user id.
- Production stays preview-only. Preview and fixture do not pretend the API revoked a family.
- Confirmed logout navigates to the locale login path. Unconfirmed logout stays on a truthful warning. There is no permanent menu button until a later authenticated shell.

## Step 44 limit

Logout does not invalidate an access JWT that was already issued. That token can still be presented until its `exp` (at most 15 minutes). Step 40 does not add a denylist. Protected routes still do not check it.

## Tests that must exist before G2 is called done

Isolated Mongo only. Both orderings of refresh claim versus logout, with a barrier between claim and successor insert. After `204`, no live non-tombstone row remains and a late insert does not stick. A second family still refreshes. Missing, unknown, expired, and repeated cookies are `204`. Bad origin is `403` with no write. `503` does not clear the cookie and does not report success. Cookie flags match login. Web tests cover epoch rejection of late refresh and login, `204`, `503` unconfirmed copy, and the broadcast. Landing files stay unmodified.

## Stop

Implementation is waiting on approval of the tombstone plus the partial unique index. If you reject that index, the alternative is to block Step 40 rather than ship a best-effort `updateMany`.
