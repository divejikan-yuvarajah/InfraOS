# INFRAOS — Enhanced Development Prompt
## Roadmap Step 40 of 190 — Secure Logout, Refresh-Session Family Revocation & Client Session Termination

**Project:** INFRAOS — National Infrastructure Intelligence & Coordination Platform  
**Vision:** The Operating System for National Infrastructure  
**Source target:** [`divejikan-yuvarajah/InfraOS`](https://github.com/divejikan-yuvarajah/InfraOS), verified GitHub `development` at `966b6652f797` and `main` at `14f17c03ba8b` during preparation on 2026-10-23; **recheck before execution**.  
**Classification:** Security-critical authentication feature completion; moderate UI scope, high concurrency/security complexity.  
**Companion:** `INFRAOS_Step_40_Cursor_Agent_Execution_Prompts.md`  
**Implementation policy:** *Feature-/section-based branching, not automatic per-step branches.* A single Step 40 can reuse a safe existing unmerged authentication-feature branch; create a fresh `feature/auth-session-lifecycle` only if justified by Git state and owner approval.  
**Authority:** The original `Steps.docx` could not be directly reviewed. Confirm its exact Step 40 language in the executing workspace; the previously established roadmap and `docs/reviews/step-39/STEP-40-HANDOFF.md` identify Step 40 as **logout and session revocation**. Report any discrepancy rather than silently changing scope.

---

## 0. Execution contract — READ BEFORE CODING

**Mission:** Add trustworthy logout and current-refresh-family revocation to the existing Express and Next.js authentication flow. End a client's local session, securely invalidate the refresh family associated with its existing HttpOnly cookie, and clear that cookie with the exact existing attributes. Deliver comprehensive automated verification and an owner-repeatable working demonstration, while remaining precise about the **already-issued access JWT limitation** until later authentication middleware exists.

**Prerequisite gate:** Step 39's source code and the fail-closed fixes are merged. **Step 39's most recent committed acceptance report remained BLOCKED**: Atlas SRV/TLS connection and `/ready` had failed; no approved synthetic user or successful browser login/refresh-cookie proof existed; full API suite had one intermittent Step 37 mail-race failure; independent sign-off was absent. Do not mistake code integration for acceptance. Before Step 40 feature implementation, verify this gate is closed with current, reproducible evidence **or obtain explicit owner approval of a documented exception**. If not closed, perform only safe prerequisite diagnosis and Step 40 planning/test design; do not deceptively certify Step 40 or progress beyond the owner gate.

**Non-goals:** Password reset (Steps 41–42); protected frontend routing (43); full Bearer authentication middleware/DB-status rechecks for all private routes (44); RBAC/agency/IDOR enforcement (45–46); user-managed device lists, logout-all-devices, cross-device revocation UI unless separately approved; MFA/OAuth; infrastructure redesign; deployment; public landing page redesign. Do not introduce Redis, NextAuth, independent login databases, sessionStorage/localStorage tokens, novel encryption schemes, or a second identity provider.

**Project constraints:** University GovTech *demonstration*, not actual Sri Lankan government integration or national production system. Lifecycle: Plan → Coordinate → Approve → Build → Verify → Monitor → Complete → Maintain. Core stack Next.js 16 App Router / React 19 / TypeScript / Tailwind 4 / shadcn-Radix; Express 5 TypeScript `/api/v1` modular monolith; MongoDB Atlas Mongoose 8; `packages/shared-types`. Python FastAPI, OpenRouter, Qdrant and R2 are unrelated to this step.

**Locked auth decisions:** 15-minute maximum HS256 access JWT signed by `ACCESS_TOKEN_SECRET`, held only **in JS memory**, Bearer header; 7-day absolute rotating opaque refresh token, **HMAC hash only in Mongo**, unique token-hash index; refresh cookie `infraos_refresh`, `HttpOnly`, `Secure`, `SameSite=None` for cross-site Vercel/Render, host-only (`Domain` unset), `Path=/api/v1/auth`; exact frontend Origin validation, CORS credentials, no wildcard. Passwords bcryptjs cost 12; Step 39 verified, `ACTIVE`, active role and agency login restriction remains; no exception for unverified demo users; `Q-002` policy remains as recorded. Access token expiry/role-status protection on subsequent private API calls remains under Step 44; **logout by itself cannot cryptographically revoke a stateless JWT already issued**.

### Mandatory decision gates

| Gate | Requirement | Output | Go/no-go |
|---|---|---|---|
| G0 | Step 39 acceptance, clean/separately preserved work, actual roadmap | `PREREQUISITE-AND-PRE-IMPLEMENTATION-AUDIT.md` | No code if missing and no explicit exception |
| G1 | Logout API contract + replay/concurrency strategy independently reviewed | `LOGOUT-DESIGN-DECISIONS.md`, threat model | No implementation until approved |
| G2 | Backend current-family revocation works in isolated Mongo; negative security cases pass | API implementation/tests | Review then continue |
| G3 | Browser/client state termination integrated, no stale session rehydration | Web implementation/tests | Review then continue |
| G4 | Full regression, independent security review, manual browser demo and evidence | final review/report | Owner approval needed |
| G5 | Git commit/push/PR into `development` | approved feature work | Separate approval per Git operation |
| G6 | Stable release from `development` to `main` | release record | Separate explicit release approval |

---

## 1. Mandatory repository and Step 39 baseline audit (40-A)

### 1.1 Non-destructive Git inspection

From actual repo root (do not assume past path is still current):

```powershell
git status --short --branch
git branch --show-current
git branch -vv
git remote -v
git worktree list
git fetch origin --prune
git log --oneline --decorate -n 15
git diff --stat
git diff --check
git status --porcelain=v1 -uall
```

`git fetch` updates remote refs, not source files. Examine the main checkout and earlier `InfraOS-step39` worktree without resetting or overwriting either. Verify `origin/development` and `origin/main` ancestry and PR/CI status. Never auto-stash, clean, reset, force-push, discard local work, or commit to a shared/dirty checkout. Read `AGENTS.md`, `.cursor/rules`, Git workflow/PR policy, ownership rules and the 190-step roadmap if present.

**Feature-based branch selection algorithm:**
1. If a suitable **unmerged, clean, authorized** authentication/session feature branch already exists and includes fresh `development`, propose reusing it. Do not reuse a stale, already-merged Step 39 branch blindly.
2. If the task is isolated and the checkout is clean, propose `feature/auth-session-lifecycle` off verified, current `origin/development`; create **only after owner approves branching**.
3. If worktree is dirty or owned by another task, preserve it and propose a separate `git worktree add` plan, also subject to approval. Never mix public-landing or unmerged internal design-system edits into Step 40.
4. Not every future step requires a branch. Branching follows a cohesive feature boundary and team ownership, while **each roadmap step always has a review and approval gate**.

### 1.2 Inspect actual source and architectural decisions

Required paths (follow actual moved files and document mismatches):

```text
apps/api/src/routes/v1.ts
apps/api/src/modules/identity/auth/auth.routes.ts
apps/api/src/modules/identity/auth/auth.security.ts
apps/api/src/modules/identity/auth/auth.service.ts
apps/api/src/modules/identity/auth/jwt.ts
apps/api/src/modules/identity/auth/cookies.ts
apps/api/src/modules/identity/auth/refresh-token.ts
apps/api/src/modules/identity/auth/refresh-session.service.ts
apps/api/src/modules/identity/auth/auth.constants.ts
apps/api/src/modules/identity/models/refresh-session.model.ts
apps/api/src/middleware/error-handler.ts
apps/api/src/shared/http/envelope.ts
apps/api/src/shared/logger.ts
apps/web/src/lib/auth/{types,state,client,transport,refresh-flight,availability}.ts
apps/web/src/lib/api/client.ts
apps/web/src/components/auth/{login-form,login-page-shell}.tsx
apps/web/src/components/providers/app-providers.tsx
apps/web/src/styles/auth-login.css
apps/api/tests/{auth-session,auth-jwt,auth-rate-limit}.test.ts
apps/web/src/lib/auth/auth.test.ts
docs/adr/ADR-006-jwt-access-refresh-session.md
docs/architecture/{auth-flow,security-decisions}.md
docs/reviews/step-39/{STEP-40-HANDOFF,END-OF-STEP-VERIFICATION,BUG-AND-RESIDUAL-RISK-REGISTER,INDEPENDENT-REVIEW}.md
docs/setup/environment.md
packages/shared-types/src/api/contracts.ts
```

**Observed Step 39 contracts (verify fresh):** `/api/v1/auth/login` and `/api/v1/auth/refresh` already mounted; logout **not mounted**. Refresh sessions have `userId`, hidden `tokenHash`, `familyId`, `expiresAt`, nullable `revokedAt`, nullable `replacedBySessionId`, `lastUsedAt`. `{tokenHash:1}` is unique, `{expiresAt:1}` TTL, `{familyId:1}` indexed. Rotation conditionally claims the previous token and inserts successor using the **same** `familyId` and **same absolute** expiry; replay has a documented **10-second benign-race grace**. Cookie helpers already provide `readRefreshCookie`, `setRefreshCookie`, `clearRefreshCookie`. `apiClient` defaults to `credentials:omit` and uses `include` for auth requests. Client session currently resides in module-level memory, and boot refresh is single-flight with possible asynchronous races. These are the structures to **reuse**, not replace.

### 1.3 Step 39 closure: show evidence or stop feature work

Verify and report independently:
- Atlas URI configured only in ignored `apps/api/.env`; no value disclosed; Windows clock/certificate/SRV issues resolved; `npm run db:check` and `/ready` 200 on **authorized development** connection.
- `db:indexes:check` read-only result against approved non-production DB, and no destructive index sync against production.
- Explicitly authorized synthetic development user, following Step 39 doc; real local browser `200` login with HttpOnly cookie and subsequent `200` refresh; no real government data; no publicly callable bootstrap endpoint.
- `npm run test:api`, `test:web`, `type-check`, `lint`, `build`; investigate intermittent Step 37 email-delivery concurrency test, report whether reproducible instead of blaming Step 40.
- Independent review and owner acceptance of Step 39; no assumption that previous commit equals approval.

When missing: document `G0 BLOCKED`, give safe exact setup steps and non-mutating offline test tasks; stop before Step 40 implementation, unless owner explicitly changes the gate in writing. Do **not** ask user to paste real secrets into AI chat.

---

## 2. Step 40 functional and API contract design (40-B)

### 2.1 Endpoint and response policy

**Endpoint:** `POST /api/v1/auth/logout`, registered within existing `authRouter` only; do not add a new independent auth router. `Content-Type` may be absent for an empty body, but if provided validate consistently with existing JSON content policy; do not accept credential-bearing query params, arbitrary JSON identity IDs, or client-supplied `familyId`.

Recommended API contract requiring G1 confirmation:

| Scenario | HTTP | Result |
|---|---|---|
| Valid refresh cookie; family durably revoked | `204 No Content` | Clear cookie; no JSON body; no JWT issuance |
| Missing cookie / unknown cookie / duplicate sign-out | `204 No Content` | Clear cookie idempotently without revealing existence; no DB mutation when no identifiable session |
| Known rotated predecessor cookie | `204` only **after** family revocation confirmed | Must revoke its family even if predecessor `revokedAt` is set; never treat it as automatically harmless |
| Missing/invalid `Origin` and unacceptable `Referer` | `403` | Existing `ApiFailure` envelope; **no authorization side effect** |
| Disallowed media type or excessive body | `415` / `413` or documented reject | Existing failure envelope; no credential leak |
| Cookie present, DB/secrets unavailable or write unsuccessful | `503 SERVICE_UNAVAILABLE` | **Do not claim server-side logout succeeded**; choose documented safe local cookie handling and retry guidance |
| Rate limit exceeded | `429 RATE_LIMITED` | Existing error envelope; no sensitive metadata |

`204` must contain no body; for other codes follow `failure(code,message,req.requestId)` and `Cache-Control:no-store`, `Pragma:no-cache`. Do not use a 200 success envelope with an empty 204 simultaneously. Never return refresh credential/session hash/family ID in public DTO. Define how unknown malformed-cookie inputs are handled without triggering hashing exceptions, DB query pollution or timing leaks.

### 2.2 Current family vs all-device distinction

A **logout of this device** revokes **only the refresh-session family matching the current cookie**. Other independently authenticated devices/sessions (other `familyId`s, same user) must remain valid. Never `deleteMany({userId})` or `updateMany({userId})` on logout; logout-all-devices is not in this step. Revoked session records may be retained until their TTL to support replay/audit semantics; do not delete them simply to make tests pass.

### 2.3 Cookie contract

Reuse `infraos_refresh`, `readRefreshCookie`, and `clearRefreshCookie` from the current module. Cookie clearing must use the same `Path=/api/v1/auth`, `Secure`, `HttpOnly`, `SameSite=None`, **host-only** behavior and no `Domain`. Confirm the `Set-Cookie` expiry/max-age actually instructs browser deletion. `credentials:'include'` must be used for logout request, but only against approved exact API origin. Request does not rely on a browser-readable refresh token or an access token. No secret in query strings/logs/DOM/HTML/storage/screenshot. Keep production Secure cookie policy even if localhost tests need configuration.

### 2.4 Family revocation algorithm and concurrency threat

This is Step 40's most important engineering decision. Review exact Step 39 `rotateRefreshSession` behavior and design a **race-safe and provable** revocation procedure:

1. Read the opaque cookie safely, calculate the existing HMAC-based `tokenHash` with the existing helper (which checks secret readiness); find the *associated* `RefreshSession` using equality on `tokenHash`, with only required fields projected. Never trust a userId or familyId from the browser. Do not output or serialize hidden hashes.
2. If a stored predecessor was already rotated, identify its family; do not skip family cleanup because `revokedAt` is already populated.
3. Revoke only that family's live records; ensure known successor records are covered. Use a conditional update and appropriate MongoDB session/transaction or other reviewed atomic family-close mechanism **when required**.
4. Critically consider race: a concurrent `/refresh` may **claim** predecessor, pause, then **insert successor after logout's `updateMany`**. A naive `updateMany({familyId})` is **insufficient** to claim “no active refresh session remains” under this interleaving. Provide an explicit interleaving table, implemented guard/serialization/marker or transaction strategy with a well-defined commit point, and a deterministic regression test demonstrating no successful refresh after confirmed logout. If the existing model cannot safely represent a closed family under concurrency, document alternatives and require approval before an additive model/index change; do not pretend a second best-effort sweep proves atomicity.
5. Treat the Step 39 10-second grace rule carefully: it is **not an authorization to refresh after logout**. Preserve replay/rotation logic for unrelated sessions; any necessary modifications must be minimal, include new tests, and document failure recovery and write conflicts.
6. On concurrent logout requests, idempotent outcome and no unsafe exposure. On unknown cookie, do not revoke unrelated sessions. On a database outage, **no false success acknowledgment**; if client state is cleared immediately it must be described as *local sign-out pending server confirmation*.
7. Check revocation also holds when user is disabled/inactive, because termination must not require successful current login eligibility. Respect absolute expiresAt independent of Mongo TTL cleanup delay. Avoid `familyId` global enumeration, deliberate slowdown, or unnecessary new indexes.
8. Show how rollback of an additive session-family marker (if adopted) would interact with old server instances; include forward/backward rollout, safe feature-gating, and compatibility tests. Do not undertake collection/index deletion or production migration without explicit separate authorization.

**Acceptance for concurrency:** after a successful acknowledged logout, later uses of *any* refresh credential from that family must fail; the server must not be able to resurrect a live successor via an in-flight rotation. Verify in repeated controlled tests on isolated MongoDB, not merely with one sequential happy-path request. If impossibility remains because of current schema constraints, **BLOCK** release and present owner-reviewed alternatives.

### 2.5 JWT claim limitation — communicate accurately

Clearing an in-memory access token and revoking a refresh family stops new refreshes from that family. **It does not instantly invalidate an already-issued 15-minute stateless access JWT at all APIs.** Step 44 authoritative Express middleware with DB status/session policy closes protected-request checks; Step 40 may document this limitation, but must not silently add a global token denylist, RBAC rewrite, or claim impossible immediate global revocation. Test/document that logout response itself carries no new bearer token and client no longer attaches its old token.

### 2.6 Security/abuse case matrix

| Attack or failure | Required behavior |
|---|---|
| Logout CSRF/login CSRF and forged Origin | Existing exact allowlist/referer policy; no trust in CORS alone; unauthorized mutation denied |
| Stolen old cookie / rotated ancestor | Logout family identification only when token matches stored hash; no cross-family revoke |
| Forged random cookie | Clear harmlessly; no user/session enumeration; no unauthenticated global revoke |
| Concurrent refresh + logout | Safe family close, deterministic tests of both interleavings; never resurrect session |
| Repeated logout, no cookie | Idempotent, safe `204` if policy approved |
| Mongo outage/write concern failure | `503`, no misleading sign-out guarantee; client forgets local Bearer and explains limitation |
| Cookies not cleared due to wrong path/domain | Tests inspect exact `Set-Cookie` attributes; browser manual demonstration |
| Frontend refresh resolves after logout | Generation/epoch guard prevents stale async response restoring authenticated state |
| Two browser tabs | Active-tab logout clears own memory and safely signals other tabs to forget their in-memory access token **without persisting token**; verify no tab silently re-authenticates after family revoke |
| User back/forward cache, reload | No rehydration from stale local state; app boot refresh cannot win logout race |
| Logs/traces/error reporting | Redact JWT/cookie/hash/password; avoid unbounded user-agent/IP tracking |
| Other independent device | Still signed in; only this family revoked |

---

## 3. Backend implementation tasks (40-C) — implement only after G0/G1

**C1. Service:** Add a focused `logout/revokeCurrentRefreshFamily` capability to `apps/api/src/modules/identity/auth/` (either the current `refresh-session.service.ts` or small cohesive service). Reuse `hashRefreshToken`, `RefreshSession`, `authNow`, validated `familyId`, existing refresh/index assumptions. Return typed `revoked | absent | unavailable` outcomes without exposing identifiers in HTTP. Keep service functions testable with controlled clocks and isolated DB. For concurrency correctness, inspect and minimally amend refresh rotation where absolutely necessary, and document all changes.

**C2. Route:** Add `authRouter.post('/logout', ...)` within `auth.routes.ts`, use requestId, no-store/no-cache, `rejectDisallowedOrigin`, bounded content/empty-body handling, suitable existing `express-rate-limit` helper (new `logoutRateLimit` only if needed), fail-closed infrastructure errors, cookie clear on successful and safe no-session paths, `204` no body; appropriate `503` semantics on inability to confirm revocation.

**C3. Security:** Reject query-parameter credentials, client-requested logout scopes, external `next` redirects, untrusted role/agency values. Never return the cookie in JSON. Only accept Origin/Referer per existing allowlist, no `*`; audit event metadata `auth.logout` with requestId and safe result, never raw token/hash/familyId unless access-controlled audit policy requires sanitized references.

**C4. Database:** Prefer current `refresh_sessions`; no new collection or index unless a formally reviewed race-safety solution requires it. No production migration by default. Account deletion is neither required nor desired. No resurrection of revoked predecessor/successor through Step 39 rollback logic. Do not confuse TTL monitor cleanup with immediate logical invalidation.

**C5. Contract:** Preserve `ApiFailure`, HTTP status meanings and `meta.requestId` on errors. For `204`, undefined body. Preserve `/login` and `/refresh` as-is except minimal tested race-safety adaptation. Tests must prove previous Step 39 login/refresh behavior unchanged.

**C6. Failure handling:** Explicitly test malformed cookie, missing cookie, already-revoked session, expired session, unknown hash, malformed/unsupported media, disallowed origin, missing shared secrets, disconnected Mongo, DB write failure, repeated logout. Production should not expose user email, refresh hash, family identifiers, URI or stack trace.

---

## 4. Frontend/client implementation tasks (40-D)

**D1. Contract/type:** Extend `AuthTransport` in `apps/web/src/lib/auth/types.ts` with a typed logout method that returns an explicit outcome (`server-confirmed`, `already-signed-out`, `unconfirmed`/error). Do not fake success for preview/fixture modes. Avoid export cycles and avoid a new app-wide state framework without need.

**D2. HTTP transport:** Add `POST /api/v1/auth/logout` to `createLiveAuthTransport`, using the shared `apiClient`, `credentials:'include'` and no request body unless required. Treat `204` as success; use existing `ApiError` mapping. Never transmit `familyId`, `userId`, refresh token, role, or permission list. Ensure safe origin: a configured `NEXT_PUBLIC_API_BASE_URL`, not arbitrary user input.

**D3. Memory and in-flight protections:** Implement `logoutWithAuthClient` that **immediately removes** in-memory bearer/session and prevents pending boot refresh, normal refresh and login requests from later restoring it. Use monotonic session generation / logout epoch and a controlled cancellation or ignore-on-resolution policy. Do not store tokens in localStorage, sessionStorage or IndexedDB. Consider current `bootstrapAuthFromRefresh`/`refreshAuthSessionSingleFlight` and the automatic GET/HEAD retry in `apps/web/src/lib/api/client.ts`—no authenticated retry should revive state after logout. Tests should race logout vs boot refresh, vs manual refresh, vs login, and compare request orderings.

**D4. Multi-tab:** If appropriate, broadcast **only non-sensitive** sign-out notice with `BroadcastChannel` (or similarly safe ephemeral mechanism), not JWTs/cookies/PII. Fall back gracefully when unavailable. Prevent a tab silently reauthenticating after observing sign-out; avoid new persistent auth values. Scope notifications to the app and document compatibility/cross-site cookie behavior.

**D5. UX:** Offer logout affordance **only in an existing authenticated internal app context** if an appropriate shell is present and approved. The current Step 39 login redirects to public homepage because protected internal dashboard is a later step; **do not add a logout control to the public landing page or manufacture a public-facing private dashboard**. If no suitable authenticated shell exists, implement tested client action and a development-only demonstration harness / safe user guidance; mark the permanent menu button integration deferred to the later authenticated shell step. UI text and confirmation should be honest about `503` (local token cleared but revocation unconfirmed). Do not claim every browser/device logged out.

**D6. Premium internal UI standard:** Where UI is touched, adhere to `[data-infra-app]` scoped tokens; Sora headings, DM Sans UI, Noto Sinhala/Tamil; accessible restrained palette orange `#FF5B00`, yellow `#FEB600`, maroon `#8C1F28`, green `#279541` plus readable charcoal/light `#F6F8FB`; use design-system components; high contrast, focus states, 320/375/390/768/1280/1440 widths, keyboard semantics, aria-live error status, reduced motion, locale copy awaiting native review. Avoid unnecessary visual redesign. **Never edit the Connected Future public landing page.** Confirm whether the local design-system V1 is merged before importing classes/components.

**D7. Navigation:** On confirmed logout, navigate to a safe `/login` or locale-specific `/si/login` or `/ta/login`; guard `next`/return parameters with existing sanitizer, no open redirects. On already-signed-out call, remain signed out. On server-unconfirmed logout, still clear browser JS memory but display localized warning and safe retry/help guidance; never resubmit cookies invisibly with a fabricated success.

---

## 5. Environment variables and external service requirements

**No new external API key is required for Step 40.** No OpenRouter, Qdrant, FastAPI, Cloudflare R2, map provider or SMTP credentials; no new identity service. **Reuse Step 39 secrets and MongoDB**. Never change `.env.example` without a justified newly introduced canonical variable and explicit architecture approval.

### Backend (private): `apps/api/.env`

```dotenv
NODE_ENV=development
PORT=4000
FRONTEND_ORIGIN=http://localhost:3000
LOG_LEVEL=info
API_PREFIX=/api/v1
MONGODB_URI=<your existing approved development Atlas URI>
MONGODB_DB_NAME=infraos_dev
ACCESS_TOKEN_SECRET=<existing secret, not printed or changed without migration plan>
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_SECRET=<existing DIFFERENT secret>
REFRESH_TOKEN_TTL=7d
```

### Web (public): `apps/web/.env.local`

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_AUTH_LOGIN_ENABLED=1
```

The live flag is for **local non-production only**. Current `getAuthAvailability()` hard-disables live production mode; preserve it. `NEXT_PUBLIC_*` are exposed in browser bundles, so never put Mongo/JWT/refresh secrets there. If the local Mongo database still fails DNS/TLS, fix Windows time, Atlas access controls, URI/DNS and credentials safely; **do not disable certificate verification, TLS or cookie Secure**. Do not create/change a real user without approval. Generate keys only if not already configured: `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"` twice; do not rotate existing live keys without a plan, because rotation invalidates sessions.

**Non-secret setup evidence:** variables present/valid without printing values, `/health` 200, `/ready` 200 once Mongo connects, `npm run db:check`, `npm run db:indexes:check` read-only on approved non-prod. For offline tests, the existing `mongodb-memory-server` isolated fixture and test-only secrets are acceptable. No environment-dependent claim without actual proof.

---

## 6. Test plan and acceptance matrix (40-E)

All tests should use synthetic users, isolated MongoDB/transaction-capable test environment where needed, isolated cookie agents and clocks; do not use production or actual government records. Prefer Vitest/Supertest already installed. Add focused tests rather than wholesale test rewrite.

### 6.1 API tests — required

| ID | Test | Expected |
|---|---|---|
| API-01 | Login test user, POST logout with exact Origin/cookie | `204`, clear-cookie flags, current family revoked, no new JWT |
| API-02 | Refresh with prior cookie after logout | `401 SESSION_EXPIRED`, no new session |
| API-03 | Pre-rotated cookie used for logout | All live successors in same family revoked |
| API-04 | Independent second device family | Still refreshes successfully |
| API-05 | No cookie, unknown/invalid cookie, repeated logout | Harmless/idempotent response, clear cookie, no unrelated changes |
| API-06 | Forged/missing/disallowed Origin/Referer | `403`, no revocation and no cookie mutation on disallowed requests |
| API-07 | Cookie attributes on clearing | HttpOnly/Secure/SameSite None/Path exact; Domain absent; expiry/max-age cleared |
| API-08 | Race: logout vs refresh before predecessor claim | After acknowledged logout, no valid successor survives |
| API-09 | Race: logout after predecessor claim but before successor insert | No resurrected active family; deterministic barrier test |
| API-10 | Race: concurrent logout requests / multiple tabs | Correct and idempotent, no zombie session |
| API-11 | Mongo disconnected / update failure / missing secrets | `503`, no false revocation assertion, no server secrets leaked |
| API-12 | Expired and rotated/previously revoked DB rows | Server compares expiry; no reliance on TTL cleanup |
| API-13 | Wrong content type, huge body, malformed JSON | Correct `415`/`413`/`400` envelope, no leaks |
| API-14 | Login/refresh regression with Step 39 grace/replay | Still passes existing suite; don't widen 10s exception |
| API-15 | Audit/log redaction and response payload | No JWT, cookie, password, hash, full credentials in logs/DTO |

### 6.2 Frontend tests — required

| ID | Test | Expected |
|---|---|---|
| WEB-01 | Valid logout transport | `POST` with credentials, handles 204 |
| WEB-02 | JWT/session memory after logout | Token and user immediately cleared; no web storage persistence |
| WEB-03 | Logout vs pending silent boot refresh | No post-logout re-authentication |
| WEB-04 | Logout vs in-flight single-flight refresh | Late response ignored; no zombie token |
| WEB-05 | Logout vs ongoing login form success | Stale login outcome cannot rehydrate state |
| WEB-06 | Other browser tabs | Local session erased without sharing credentials; no silent rehydration |
| WEB-07 | API outage on logout | Clear local access token; truthful revocation-unconfirmed notification |
| WEB-08 | Preview/fixture mode | No fake remote success; production live mode remains off |
| WEB-09 | Locale and redirect | Safe EN/SI/TA message, sanitized return path |
| WEB-10 | Existing login, UI and landing regression | Public site unchanged; no unexpected unmounted UI or broken route |

### 6.3 Verification commands

Run from repository root after checking the actual script names:

```powershell
npm run test:api
npm run test:web
npm run type-check
npm run lint
npm run build
npm run db:check
npm run db:indexes:check
```

Focused auth tests already exist:

```powershell
npm run test -w @infraos/api -- tests/auth-jwt.test.ts tests/auth-rate-limit.test.ts tests/auth-session.test.ts
npm run test -w @infraos/web -- src/lib/auth/auth.test.ts
```

Add and run an isolated `auth-logout.test.ts` (or equivalent) and explicit web logout tests. Where using a Mongo transaction, verify replica-set/test fixture capability; don't silently switch to a production cluster. Record exact suite counts, runtime environment, SHA, actual PASS/FAIL/NOT RUN/BLOCKED; distinguish the pre-existing Step 37 intermittent email-race from Step 40 regression and investigate if it persists.

### 6.4 Owner-repeatable manual demonstration

**Backend-only demonstration if no authenticated app shell exists:** In an authorized development database, create a synthetic eligible identity only after the owner approves the write. Start API and web. Sign in at `http://localhost:3000/login`. In DevTools verify successful login and `infraos_refresh` flags without revealing values. Use a controlled test harness or approved dev-only client action to invoke logout and confirm `204` and cookie removal. Refresh should fail `401`; a distinct simulated device family should continue. If no dev account is approved/Atlas unavailable, demonstrate equivalent behavior using Supertest + isolated Mongo and mark browser proof `BLOCKED` (not PASS). Never insert logout UI into public landing to manufacture a demo.

**Manual UI if internal shell is available:** Check logout button/menu keyboard and mobile responsiveness, focus, loading state, double-click handling, EN/SI/TA rendering, re-login, error/retry, reload, two tabs, and sign-out redirect. No backend user/agency data in screenshots. Recheck existing public `/` to assert unchanged.

### 6.5 Verification evidence template

| Criterion | Source path/lines | Test + exact command | Actual result | Manual evidence | Reviewer |
|---|---|---|---|---|---|
| Current family revoked | ... | ... | PASS/FAIL/BLOCKED/NOT RUN | ... | ... |
| Logout/refresh race safe | ... | ... | ... | ... | ... |
| Cookie cleared | ... | ... | ... | ... | ... |
| In-memory token erased | ... | ... | ... | ... | ... |
| Other device remains active | ... | ... | ... | ... | ... |
| Public landing untouched | ... | ... | ... | ... | ... |

Do not use “working” as a claim without matching observed evidence.

---

## 7. Pre-implementation and independent post-review (40-F)

### 7.1 Pre-review questions (must be resolved or explicitly accepted)

1. Has Step 39 been accepted with Mongo/browser proof, not merely merged? If not, what's the owner-approved exception?
2. Does logout mean *current refresh family only*? Confirm no all-device mutation.
3. How is a **logout vs in-flight refresh** made correct with existing per-session documents? Is an additive family tombstone/migration required and authorized?
4. What precisely happens if logout can't reach Mongo—what can client truthfully guarantee?
5. Can frontend single-flight refresh, app-boot refresh or concurrent login restore memory after logout? Which generation guard prevents this?
6. Does an internal authenticated shell exist? If not, where will the manual logout action be demonstrated without changing the landing page?
7. What does Step 44 guarantee about still-live access JWTs? How will we avoid false claims now?
8. Are local `.env` and design-system worktrees preserved, and are only safe synthetic fixtures used?

### 7.2 Independent code/security review

Reviewer must be independent from first implementation pass where possible (separate Cursor review pass, another engineer, or Codex second pass). Review G0–G3 outputs, route/DB concurrency, request origin checks, timing and revocation semantics, response leaks, client race/retry, localization, A11y, migration/rollback, tests and changed-file scope. Severity tags `CRITICAL / HIGH / MEDIUM / LOW`; every CRITICAL/HIGH issue blocks acceptance unless owner explicitly accepts a documented residual risk with compensating controls. Rerun exact tests after fixes.

### 7.3 Deliverables

Place under `docs/reviews/step-40/`:

```text
PREREQUISITE-AND-PRE-IMPLEMENTATION-AUDIT.md
LOGOUT-DESIGN-DECISIONS.md
THREAT-MODEL-AND-CONCURRENCY.md
API-AND-FRONTEND-CONTRACTS.md
IMPLEMENTATION-AND-FILE-MANIFEST.md
SECURITY-TEST-MATRIX.md
BUG-AND-RESIDUAL-RISK-REGISTER.md
INDEPENDENT-POST-IMPLEMENTATION-REVIEW.md
END-OF-STEP-VERIFICATION.md
DEMO-AND-MANUAL-TEST-GUIDE.md
STEP-41-HANDOFF.md
```

Use concise real evidence, focused Mermaid sequence for login→logout→refresh failure, refresh/logout race interleavings, business/regression tests, expected HTTP statuses, privacy treatment, owner setup, screenshots *only if captured*, and exact SHA/working tree/PR info. Mark any deferred Step 43/44 behavior and distinguish policy scope from code behavior.

---

## 8. Acceptance criteria — every item checked before owner approval

- [ ] Exact roadmap Step 40 reconciled with original document if available.
- [ ] Step 39 gate independently evidenced or explicit authorized exception recorded; existing Atlas/cert issue not hidden.
- [ ] No unnecessary branch, old branch reuse, destructive Git action or accidentally mixed design-system/public-site changes.
- [ ] Logout POST added to existing `/api/v1/auth` router and follows exact Origin, rate limit and failure envelope policies.
- [ ] Only current refresh family revoked, including rotated predecessors and successors; other family survives.
- [ ] Atomicity/ordering under refresh/logout race is proven, with tests that force adverse interleavings; no zombie sessions.
- [ ] Logout response 204 after confirmed action, idempotent no-cookie behavior, proper 403/429/503 failures, no false server-revocation claim.
- [ ] `infraos_refresh` cookie removed with exact flags; raw refresh token never in body/logs/JS.
- [ ] Browser JS access JWT/user deleted immediately, and late refresh/login/bootstrap cannot restore them.
- [ ] Frontend API logout uses only `credentials:'include'` to approved API origin and correct preview/live transport logic.
- [ ] No public landing edits; internal UI changes scoped, premium, accessible, mobile-responsive and locale-aware where UI exists.
- [ ] Existing Step 39 login/refresh/JWT tests still pass; Step 37 regressions investigated and recorded.
- [ ] Full test, type-check, lint, build results recorded; db checks only on authorized environment.
- [ ] Real browser demonstration, including cookie clearing, is completed **or explicitly marked BLOCKED** with accurate reason.
- [ ] Independent security review performed; high/critical issues fixed or owner-approved with residual risk.
- [ ] No claim of immediate bearer-JWT invalidation on arbitrary APIs before Step 44; production live login remains preview-only.
- [ ] Documentation, safe owner manual, file manifest, risks and Step 41 handoff complete.
- [ ] Owner has separately approved any changeset commit, push, PR and `development` merge; `main` stays unchanged until approved stable release.

**Completion recommendation:** `APPROVE` only when mandatory evidence is real and no unaccepted blockers. Else `REVISE` or `BLOCKED` with exact next actions. **STOP after Step 40**, never auto-start Steps 41–42.

---

## 9. Git integration, safety and rollback (40-G)

1. Freeze Step 40 scope and inspect `git diff --check`, tracked/untracked/ignored changes, secret patterns, uncommitted teammate/design-system files. Confirm **feature-based** branch selection; no automatic per-number branch.
2. Present proposed **small conventional commits** for owner approval, e.g. `feat(auth): revoke refresh session family on logout`, `fix(web): prevent session restoration after logout`, `test(auth): cover logout refresh races`, `docs(auth): record Step 40 verification` (combine when changes are cohesive).
3. After **explicit commit approval** only, stage verified relevant files; never stage `.env` or synthetic data. Show resulting SHA.
4. After **separate push/PR approval** only, push the authorized branch and open a PR **into `development`**, description referencing G0–G4 evidence, test results, demo, migration policy, risks, Step 44 limitation, no landing changes. If code already lives on an approved integration branch, adapt without cherry-picking blindly.
5. Resolve review/CI defects, repeat tests. After **separate merge approval** only, merge via repo-prescribed strategy, then run post-merge smoke tests on updated `development` and report exact SHA.
6. **`development` → `main` is another separate release decision**, not automatic merely because Step 40 passed. No deployment or production auth enabling without separate release/security authorization.
7. Rollback plan: revert in-scope API/web changes when safe without dropping DB rows; if family-close marker/index added, use additive-first rollout and assessed backward compatibility, and obtain separate migration approval. Explain irreversible revoked sessions are expected and won't be restored by code revert.
8. If a tool can't push/create a PR due to permissions, provide actionable manual commands and clearly mark `NOT DONE`; never claim the integration happened.

---

## 10. Primary sources and step boundary

Local repository and approved decisions take precedence over illustrative recommendations: `docs/reviews/step-39/STEP-40-HANDOFF.md`, Step 39 actual backend/web source, Step 39 acceptance report, `docs/architecture/auth-flow.md`, `docs/architecture/security-decisions.md`, ADR-006, existing API/DTO contracts and env catalog. Review OWASP Session Management, Authentication and CSRF guidance as advisory, not a substitute for the project's accepted decisions. The original 190-step roadmap document, if present locally, controls exact Step 40 wording. Never invent owner approvals or completed checks.

**END — Step 40 design and verification prompt.**
