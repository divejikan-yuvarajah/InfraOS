# INFRAOS — Enhanced Development Specification
## Steps 41–42 of the 190-step roadmap: Forgot Password Request & Secure Password Reset

**Platform:** INFRAOS — National Infrastructure Intelligence & Coordination Platform  
**Vision:** The Operating System for National Infrastructure  
**Stage:** Security-critical Identity / Account Recovery feature group  
**Workspace (single checkout only):** `C:\Users\ASUS\Desktop\InfraOS\InfraOS`  
**Integration:** `development` → separate approved promotion to `main`  
**Feature branch:** `feature/auth-password-recovery` (one branch for both steps *if* existing local branches do not already serve this feature; create in `InfraOS`, not another folder)  
**Pairing:** `INFRAOS_Steps_41_42_Cursor_Agent_Execution_Prompts.md`  
**Prepared:** 2026-10-24, against connected GitHub `development` = `4e97f425e5aa…`, `main` = `e60c6a3eadc6…`; verify anew in Cursor before changing code.

> **Roadmap-fidelity note:** Project architecture and historical step handoffs identify Step 41 as **password-reset request / forgot-password flow** and Step 42 as **password-reset consumption / secure password update**. The original user-owned `Steps.docx` was not available to inspect here. Before coding, Cursor must compare these labels against the actual 190-step roadmap if the original is present locally, record the exact wording, and stop for owner review if it materially differs. Do not silently renumber or absorb Steps 43–46.

---

## 0. Mission, constraints, and realistic outcome

Build a **real, secure, intentionally limited staff password-recovery workflow** integrated with the existing Step 36–40 identity foundation, without inventing production email infrastructure or claiming complete protected-route security. The backend is authoritative for identity and password state; the browser is untrusted. Academic/demo status must remain transparent. Staff identities are provisioned by administrators; this feature **must not introduce public staff registration, activation, citizen sign-up, impersonation, or a backdoor**.

**Deliverables:**

1. Step 40 acceptance/prerequisite audit and fully specified recovery threat model.
2. One reviewed architectural decision for reset token storage, email dispatch, expiry, rate limits, atomic consumption, and session invalidation.
3. **Step 41**: anti-enumeration password-reset request endpoint; separate hashed recovery challenge model/indexes if justified; safe sender abstraction; clear accessible request UI; realistic delivery status and complete tests.
4. A standalone Step 41 end-of-step evidence pack and **owner approval** before Step 42.
5. **Step 42**: one-time reset token consumption, bcrypt cost 12 password replacement, all-user-refresh-family invalidation integrated with Step 40's `RefreshFamily` barriers, frontend reset UI, replay/expiry/race defenses, negative tests, audit evidence.
6. Separate Step 42 independent review, security test matrix, manual demonstration, final acceptance and Git integration recommendation.
7. One feature branch inside **the sole `InfraOS` folder**, not a new Git worktree or adjacent `InfraOS-step41`, `InfraOS-step42`, or backup folder.

**Absolutely forbidden:** modifying, moving, inspecting without need, or deleting `Documents`; changing public Connected Future landing page routes/layout/theme; publishing secrets; auto-enabling production sign-in; adding OpenRouter/Qdrant/R2; silent DB indexes; creating ad-hoc admin endpoints; unapproved production data writes; premature Step 43/44/45/46 implementation; fake PASS results; commit/push/PR/merge without separate explicit owner consent.

### Boundaries

| In scope | Explicitly out of scope |
|---|---|
| Forgot-password request and its safe feedback | Public registration or self-activation |
| Password-reset challenge storage and approved delivery integration | Inventing an email provider or silently sending email |
| One-time recovery token, password update, all refresh-session revocation | JWT denylist or retroactive invalidation of stateless access JWT at ordinary routes |
| Auth/login link integration and new recovery pages | Broad dashboard redesign or landing-page modification |
| Privacy, abuse prevention, localization, test evidence | MFA, OAuth, administrative password management, protected routes/RBAC Steps 43–46 |

## 1. Current verified repository facts (must be re-audited)

- **Step 40 implemented** in GitHub: `/api/v1/auth/logout`, `RefreshFamily` authority document, and auth client epoch to prevent late login/refresh reauth. Relevant files include `apps/api/src/modules/identity/auth/auth.routes.ts`, `refresh-session.service.ts`, `apps/api/src/modules/identity/models/refresh-family.model.ts`, `apps/api/tests/auth-logout.test.ts`, `apps/web/src/lib/auth/state.ts`, `client.ts`, `refresh-flight.ts`.
- **Step 40 handoff** exists at `docs/reviews/step-40/STEP-41-HANDOFF.md` and says Step 41 is password-reset request. Its *recorded* `END-OF-STEP-VERIFICATION.md` has 238 API and 110 web tests passing in isolated tests, but **Atlas `refresh_families` indexes and live browser logout were NOT RUN/approved in that snapshot**. Integration into GitHub != final owner sign-off. Do not skip this gate.
- Existing `User` has `passwordHash` with `select: false`, `status`, `emailVerified`, `roleId`, `agencyId`, and timestamps. Existing registration policy uses **bcryptjs cost 12**, **8-character minimum**, **72 UTF-8 byte maximum**. Confirm and reuse shared validation; preserve intentional whitespace and Unicode bytes.
- Existing email verification: `EmailVerificationChallenge` purpose `VERIFY_EMAIL`, digest-only token and TTL, `createVerificationSender` in `verification-mail.ts` is **memory in non-production**, **unavailable in production**. No real SMTP/transactional-email sender has been approved or configured. Existing email-verification tests and concurrency history must not regress.
- The API uses `ApiSuccess`/`ApiFailure` and `/api/v1`; existing login/refresh/logout uses exact-origin checks and authentication rate limit; `apiClient` defaults to `credentials: "omit"` and only cookie routes use `include`.
- Access JWT HS256 max 15 minutes, *in-memory only*; opaque refresh cookie `infraos_refresh`, `HttpOnly`, `Secure`, `SameSite=None`, `Path=/api/v1/auth`, no Domain. Step 40 family authority/`closedAt` prevents a logged-out family from being revived.
- `apps/web/src/app/login`, `/si/login`, `/ta/login` render a locally scoped internal auth style, not the public landing. `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=1` is development-only; production remains preview until later security steps.
- **Q-002** open: only `ACTIVE` and `emailVerified: true`, active role and agency may sign in. Resetting a password **must never activate, verify, or unlock** an account by side effect. **Q-005** citizen self-registration remains unresolved.

**Before any implementation:** inspect Git status, worktree listing, tracked/untracked changes, current branch, `origin/development`, latest issue/PR context, and the exact local roadmap wording. Do not assume local checkout or GitHub SHA remains current.

## 2. One branch, two independent step gates

| Gate | Deliverable | May proceed when |
|---|---|---|
| **G0** | Step 40 final owner acceptance, Atlas index/migration status, verified logout, local workspace clean/safe | APPROVED; otherwise document blocker and work only on independent analysis/tests |
| **G1** | Step 41 architecture/recipient privacy/email-provider choice and DB index design | Owner signs off on changes requiring privileged access or secret/provider decisions |
| **G2** | Step 41 request API + sender abstraction + request UI + tests | Independent review, real isolated checks and approved `docs/reviews/step-41/END-OF-STEP-VERIFICATION.md` |
| **G3** | Explicit owner **Step 41 approval** | Only then start Step 42 business logic (can reuse same feature branch) |
| **G4** | Step 42 atomic reset/session invalidation design | Threat/concurrency analysis accepted; DB/index changes separately approved |
| **G5** | Step 42 backend+UI+tests+live demo+independent review | Step 42 APPROVE |
| **G6** | Local commit(s), push and PR to `development` | Separate explicit permission **for each Git action**, reviewed diffs and non-destructive merge |
| **G7** | Later promotion `development` → `main` | Another owner-approved stable release; no automatic sync/merge |

**Git single-folder policy**: Keep all coding in `C:\Users\ASUS\Desktop\InfraOS\InfraOS`. Reuse a suitable safe existing branch or, upon approval, create `feature/auth-password-recovery` **in that directory** from freshly verified `origin/development`. Never use `git worktree add`, `git clone` to adjacent folders, `git reset --hard`, `git clean -fd`, force push, destructive checkout or delete old worktrees. Old extra worktrees are read-only and their cleanup is a **separate** owner task. `Documents` is untouchable.

---

# STEP 41 — FORGOT PASSWORD / RESET REQUEST

## 3. Functional contract and UX

A user selects **Forgot password?** on the existing INFRAOS login page; the app presents a public, unauthenticated, professionally styled recovery form. User enters their email address; the API validates it and responds with the **same generic result whether or not the address matches an account**. The browser says something equivalent to: **“If an eligible account exists and email delivery is available, you'll receive password-reset instructions.”** It must not promise a message was actually sent if delivery is unconfigured.

**Proposed routes (confirm with source architecture / roadmap):**

- UI `/forgot-password`, `/si/forgot-password`, `/ta/forgot-password` and an approved navigation link from login. Do not add public landing nav or registration paths.
- API `POST /api/v1/auth/forgot-password` with `{ "email": "officer@example.com" }` exactly; no IDs, role, agency, returnTo, redirect URL or privileged fields.
- Response `200 ApiSuccess<{status:"ACCEPTED"}>` with generic wording and `Cache-Control: no-store`; same safe response for absent/unknown/ineligible email, when successful handling is possible. `400` for invalid form (schema-only), `403` invalid origin, `429` rate limit, `503` for unavailable critical infrastructure per reviewed global-vs-account-specific policy. Never reveal account existence via error/body, timing or delivery-mode differences.
- If production delivery is not approved, endpoint **must not pretend delivery succeeded**. Owner must decide whether to **disable production request feature safely** with one generic, honest availability response (prefer fail-closed/unavailable) or authorize a real approved provider. No unapproved emails, stdout token dumps or accessible development token endpoints.

### Step 41 API acceptance examples (illustrative, not evidence)

```http
POST /api/v1/auth/forgot-password
Origin: http://localhost:3000
Content-Type: application/json

{"email":"officer@example.com"}
```

```json
{"success":true,"data":{"status":"ACCEPTED"},"meta":{"requestId":"<generated>"}}
```

Exact envelope shape must match the **existing** shared envelope helpers; treat this JSON as an example, not a new API standard.

### Step 41 account eligibility

- Unknown email, disabled/suspended, unverified, pending, missing/inactive role/agency: **same external result**, no information leak. Do not alter status; evaluate whether recovery may be requested for an inactive account as a **documented owner policy**, not an implementation guess.
- No send if account is ineligible under approved policy; no role enumeration or agency leakage.
- Rate-limit both by IP and privacy-preserving account/e-mail key; defend shared office/NAT labs. Decide per-identity cooldown and max outstanding token window based on tests; do not expose the exact eligibility or cooldown difference to callers.
- Never accept a caller-supplied recipient other than normalized email; never send to an arbitrary address or redirect host.

## 4. Recovery challenge model — separate from verification and refresh sessions

Propose a dedicated `PasswordResetChallenge` model, e.g. `apps/api/src/modules/identity/models/password-reset-challenge.model.ts`, collection `password_reset_challenges`, with scoped fields:

| Field | Intent |
|---|---|
| `userId` | Account being recovered; indexed |
| `purpose: 'RESET_PASSWORD'` | Fixed discriminator; no verification-purpose collision |
| `email` | Normalized email snapshot; bind reset to correct address |
| `tokenHash` | Hash of high-entropy token, **never raw token**; `select:false`; unique index |
| `issuedAt`, `expiresAt` | Server-generated issuance and short TTL (proposal: 15–30 minutes, owner decision) |
| `consumedAt` | Server-side one-time consumption |
| `revokedAt` | Supersession, reset, invalidation |
| `createdAt` | Auditable chronology without sensitive payload |

Other fields only when justified. `toJSON`/`toObject` redact token hashes; audit `.lean()` and aggregation projection risks. Use **crypto.randomBytes(32)** or equivalent; token shape validation and digest via Node crypto; do not store token plaintext, in URL query parameters, browser storage, API success bodies, logs, session cookies or error traces.

**Indexes (proposed, not approved for Atlas):** unique digest lookup `{tokenHash:1}`; supporting `{userId:1, issuedAt:-1}`; TTL `{expiresAt:1}, expireAfterSeconds:0`; one-live-token partial unique strategy **only after precise predicate, uniqueness and migration review**. Remember Mongo TTL cleanup is delayed: service rejects expired `expiresAt` even while row exists; a partial index using `revokedAt:null, consumedAt:null` would continue matching expired rows until service explicitly revokes/supersedes them. Prove cooldown and concurrent issuance with deterministic tests. Do not call `syncIndexes()` against Atlas or apply indexes without consent; `autoIndex` in development may cause changes on server startup, so inspect before connecting.

### Delivery design: real, safe, honest

- Reuse conceptual shape of `VerificationEmailSender` but keep **separate reset purpose**; do not alter email verification token semantics accidentally.
- Provide test-only in-process memory capture and deterministic injection for automated tests. That is **not user email delivery**.
- Production and real-user manual demo need a **separately approved mail provider** and associated secret env vars. Do not choose a vendor unilaterally, invent SMTP credentials, claim messages were sent or output reset URLs into ordinary console logs.
- Model provider failures with no raw token leakage; keep failure generic externally, revoke unsent challenge where possible, and record bounded/audited non-PII event. Avoid invalidating a previous live challenge until new delivery is confirmed unless atomic replay/uniqueness rules require another documented design. Inspect race windows and partial index mechanics.
- Link built from server-side **allowlisted trusted `FRONTEND_ORIGIN` only**, HTTPS outside localhost, path `/reset-password`, token in `#token=<encoded>` fragment to avoid server request lines/referrers. Validate the fallback and URL encoded characters. Only allow the correct origin; no `returnTo`/`next` supplied by requester. Use `Referrer-Policy: no-referrer` on reset pages and `robots: noindex,nofollow`.
- Token should never be rendered into SSR HTML, searchParams, analytics, errors or screenshots. Upon client read from `location.hash`, clear fragment promptly via history replacement; hold token temporarily in component memory only until reset completes/cancels; do not place in local/sessionStorage. Handle page reload after fragment removal gracefully.

## 5. Step 41 implementation tasks, in order

1. **41-A | Preflight:** inspect Step 40 acceptance, current model indexes, email verification sender, auth routes, shared error response, login page styling, i18n pattern; write `docs/reviews/step-41/PRE-IMPLEMENTATION-AUDIT.md`.
2. **41-B | Decision record:** owner review of recovery eligibility, TTL, cooldown, issuance concurrency, whether delivery is test-only or real provider; document exact API contract, failure policy and index proposal. No privileged write until approved.
3. **41-C | Core model:** implement minimal digest-only reset challenge, schema redaction, safe indexes declared but not deployed to Atlas; tests for serialization, token shape, expiry and collisions.
4. **41-D | Request service:** normalize email, generic response, constant-ish compute path as appropriate, rate limiting, no enumeration, eligible account validation, single-live challenge rules, sender injection; ensure no token leak when dependency fails.
5. **41-E | Route:** mount only approved `POST /api/v1/auth/forgot-password`, exact Origin discipline and CORS, strict Zod, JSON content, bounded size, no-store, generic envelope; map 400/403/429/503 appropriately.
6. **41-F | Frontend:** reuse login shell/design tokens; implement request page and link, request loading/success/failure states, keyboard navigation, accessible messages, offline/retry; English + Sinhala + Tamil review-ready copy; legal notice that INFRAOS is an academic demo, not a government login.
7. **41-G | Tests:** sender available/unavailable; eligible/noneligible parity; generic response; IP/account throttle; race of two requests, resend cooldown, expiration; invalid email/origin/body/returnTo/oversized request; no logs/tokens/PII; no regressions to Step 37 email verification or Steps 38–40.
8. **41-H | Independent reviewer:** have a separate fresh-context reviewer critique non-enumeration, timing, repeated issuance, partial indexes, memory adapter, token leakage, UI privacy, origin, test validity. Fix issues, rerun tests.
9. **41-I | End-of-step evidence:** update `docs/reviews/step-41/END-OF-STEP-VERIFICATION.md` and `DEMO-AND-MANUAL-TEST-GUIDE.md`; show actual API/browser/output and conditions where email delivery is NOT LIVE. Report PASS/FAIL/BLOCKED/NOT RUN for every line.
10. **41-J | Gate:** Ask owner **APPROVE / REVISE / BLOCKED**. **Do not start Step 42 unless Step 41 is explicitly approved**, even if both share the same Git feature branch.

### Step 41 end-of-step demonstration

- Open `http://localhost:3000/forgot-password` (and `/si/…`, `/ta/…`), verify consistent premium internal UI and login link/back navigation.
- Submitting a syntactically valid email gives the same generic user-facing content for known and unknown accounts; compare response envelope/status **without revealing test account**.
- In isolated test fixture, inspect injected test sender (not production inbox) for exactly one recovery link and ensure only hashed token persisted; verify cooldown, replay/expiry behavior of challenge issuance.
- If real approved provider exists, perform only owner-authorized send to a synthetic owned inbox, then verify delivered link; if not, explicitly mark **LIVE EMAIL DELIVERY BLOCKED/NOT IMPLEMENTED**, never PASS.
- Verify no localStorage/sessionStorage token, no public landing changes, and no accidental privilege/activation.

---

# STEP 42 — ONE-TIME PASSWORD RESET & GLOBAL REFRESH-SESSION INVALIDATION

## 6. Strict entry condition

**Only begin if Step 41 is reviewed and owner-approved** with a validated reset-request/challenge API. Step 42 consumes its artifacts; it must not alter Step 41's anti-enumeration response or delivery policy without another review.

## 7. Reset API and state transition

**Proposed endpoint:** `POST /api/v1/auth/reset-password` (confirm existing routing convention). JSON payload proposed:

```json
{"token":"<opaque-reset-token>","newPassword":"<user-chosen-password>","confirmPassword":"<matching-password>"}
```

The API must validate password/confirmation server-side, not trust UI. Prefer confirmation in UI only unless documented why both are required on wire; the exact contract is part of G4 review. Reject unknown fields, JSON with role/status/agency/userId, malformed token, wrong purpose, expired/superseded/already used token, inactive/removed account per reviewed policy. **No role/agency/status/email verification side effects.**

**Success**: standard `ApiSuccess` envelope with neutral reset-complete status and instructions to sign in again. **Failure**: generic invalid/expired reset response (avoid disclosing user existence or token semantics); schema `400`, forbidden Origin `403`, rate limiting `429`, infrastructure error `503`. Decide status codes at design gate and test consistently. No auto-login or access token creation following password reset. **Do not include raw token or passwords anywhere in response/log/audit.**

## 8. Password handling and account semantics

- Reuse validated password policy from `registration.schema.ts`: minimum **8 characters**, **72 UTF-8 bytes maximum** due to bcrypt constraints; use **bcryptjs cost 12**, preserving user's original password bytes and meaningful Unicode without trimming.
- Do not leak the old hash or allow recovery to bypass `PENDING`, `DISABLED`, `SUSPENDED`, unverified, inactive role or inactive agency rules. A reset may change password only under **explicit eligibility policy**; no account activation.
- Check common passwords / breached password lists if an approved offline privacy-safe rule is available; do not send raw candidate passwords to public APIs or introduce dependencies unilaterally.
- Use one-time consumption via a conditional atomic update (`consumedAt:null`, `revokedAt:null`, `expiresAt > now`, correct purpose), but this **alone is not sufficient** to guarantee password update + session revocation consistency. Make database and concurrency design explicit.
- All unconsumed reset challenges for same user should be invalidated after successful reset so old email links cannot subsequently reset the password. Do not affect verification challenges or other users.
- Prevent partial states: **never report reset success while old credential works or active refresh families remain usable**. Choose a MongoDB transaction / serialized per-user barrier / carefully proven strategy appropriate for Atlas replica-set semantics. If transactions are unavailable in a test environment, label that test BLOCKED and run a compatible replica-set fixture. Never mask rollback failures.

## 9. Global logout and race requirements (critical)

Step 40 introduced **`refresh_families`** with `familyId`, `userId`, `activeTokenHash`, `closedAt`, `expiresAt`; its `closedAt` is the authoritative session barrier. Reset success must invalidate **all currently active refresh families belonging to the reset user**, not only the browser's current cookie, while not touching another user's families.

**Proposed secure design (must be reviewed, not assumed):**

1. Establish an atomic per-user credential revision/generation or equivalent authority that login, refresh, and reset all check, so a login started with the *old password* cannot mint an effective refresh family after a reset commits.
2. Treat reset as a single logical commit: validate+claim one-time token, update bcrypt password, increase credential revision, revoke/close every refresh family and invalidate other reset tokens, using transactions or a demonstrably equivalent scheme. Ensure no gap lets a new family become usable after reset.
3. Refresh-family `closedAt` checks must remain authoritative; never reopen a closed family in rollback/compensation. If adding `credentialVersion`, ensure old families are denied even when creation races reset, without prematurely claiming all access JWTs are checked on ordinary routes.
4. A stale refresh in progress must not issue a valid new cookie after successful reset; race barriers must be deterministic for each interleaving (before claim, after claim, after authority swap, before successor insert, after reset commit).
5. On failure partway through the transaction/logic, return 503 or other reviewed error without claiming success; preserve a deterministic, secure state. Protect against repeated submissions and transient MongoDB transaction retries.
6. Clearing the requester's refresh cookie after successful reset is appropriate if set; **cookie clear alone does not revoke other devices**. If browser has in-memory session, invalidate client state using Step 40 epoch mechanism to prevent late successful refresh/login rehydration. Avoid client auth calls that undo revocation.
7. **Explicit limitation:** Stateless access JWTs issued before reset may remain cryptographically valid for up to ~15 min and are not denied by an unimplemented Step 44 middleware. Do not claim immediate all-access-token invalidation or add a global JWT denylist in Step 42 without owner-approved architecture change.

### Step 42 concurrency matrix — mandatory deterministic barriers

| Interleaving | Must prove |
|---|---|
| Reset A and reset B use same token | Exactly one logical password reset success; no dual consumptions |
| Reset A / reset B use separate live challenges | All superseded challenges become unusable; no reverting password |
| Old password login compares hash; reset commits; login issues family | Old password cannot leave a usable post-reset session |
| Existing refresh claimed; reset commits; refresh tries hash swap | Refresh denied; no surviving active authority |
| Refresh swaps authority; reset commits; successor insert happens | No usable successor after reset |
| Reset closes many families and another-device refresh races | All old family authority closed, other unrelated users intact |
| MongoDB fails during hash update or bulk family close | No false success/partially committed security state |
| Old password vs new password after reset | Old rejected, new works for eligible ACTIVE verified account |
| Previously issued access token | Limitations documented; future Step 44 enforcement not falsely claimed |

Use explicit test hooks/gates (or transaction synchronization) instead of sleeping and hoping the race occurs. Tests must run on an isolated disposable replica-set MongoDB or approved `infraos_test`, never production. Only owner-approved synthetic users can be written to `infraos_dev`.

## 10. Step 42 frontend and interaction design

- Pages `/reset-password`, `/si/reset-password`, `/ta/reset-password`, consistent with the existing login auth layout and sanitized link flow. Accessible strong-password/confirm fields, show/hide toggles, inline validations, screen-reader feedback, paste/autofill support, visible progress/error/success states, keyboard and reduced-motion behavior.
- The browser reads the reset token from the fragment only in a client component; validate shape client-side for UX; promptly erase fragment in address bar; do not SSR token, transmit it to third parties, store it in web storage or log it. On refresh after fragment removal, show a safe expired/missing link state with a path to request a new link.
- After success, clear in-memory auth state with the existing logout epoch; show **“Password updated. Sign in again.”** and a safe link to the existing locale-specific login. **Never automatically open an unprotected dashboard or imply newly granted access.**
- For a reset token that expired or was already used, offer return to forgot-password, not an account detail leak. Avoid cross-origin redirects and `next=` passthrough.
- Preserve Sinhala and Tamil routes using Noto fallback; translational copy is draft pending native review. Mark the academic demo and privacy disclaimer. Avoid deceptive “email sent” or “all access immediately invalidated” claims.
- Use existing shadcn/Radix/Tailwind theme and scoped `data-infra-app` UI only. Favor Sora display/DM Sans UI **only where actually included/approved**; current login page falls back to public Manrope/Geist via scoped tokens, so do not modify root fonts or public landing to force a change. Warm brand orange `#FF5B00` for actions; yellow `#FEB600`, maroon `#8C1F28`, green `#279541` for semantic accents, not decorative full-screen saturation; light canvas `#F6F8FB`, dark ink corridor. Mobile widths 320/375/390; tablet 768; desktop 1280/1440; WCAG contrast, focus, 44px touch targets, no horizontal overflow.
- A tasteful **Forgot password?** link belongs in the existing login form, not the Connected Future landing navigation. No new shared `/` content.

## 11. Step 42 implementation tasks, in order

1. **42-A | Gate:** confirm Step 41 approval evidence and exact challenge contract; inspect all merged Step 40 family/epoch behavior and base API/web clients; document `docs/reviews/step-42/PRE-IMPLEMENTATION-AUDIT.md`.
2. **42-B | Atomic security ADR:** choose and prove per-user credential-revision + multi-family close transaction mechanism; migration compatibility, fail-closed state, concurrent login/refresh impact; owner gate for schema/index writes.
3. **42-C | Service:** validate token and password, atomically consume, bcrypt new hash, revoke other challenges, close all families, avoid old-password login races, enforce status policy and errors.
4. **42-D | API:** route & schema, no-store/no-referrer, origin, rate limiting, JSON envelope, no credentials required, no extra keys, consistent status codes. Retain established route names unless explicitly approved otherwise.
5. **42-E | UI integration:** reset form and localized routes; client-only fragment extraction; in-memory token; memory auth clear, safe navigation; mobile/accessibility review; no landing edits.
6. **42-F | Security tests:** full matrix in §9, replay, expired token even if TTL row persists, malformed/wrong purpose, inactive user, multiple families and users, bcrypt boundaries, password whitespace/Unicode, missing DB/secret, no logs, independent unrelated login/refresh behavior.
7. **42-G | Independent review:** challenge atomicity and race windows, timing/enum, logging, family authority, transactions, index semantics, migrations, CSRF, link fragments; fix findings and rerun.
8. **42-H | Live synthetic demonstration:** request and consume recovery with approved test sender/provider, verify new login and old denial, test multi-device refresh invalidation. Do not claim real email delivery unless an actual provider/inbox was verified.
9. **42-I | Evidence:** write `docs/reviews/step-42/END-OF-STEP-VERIFICATION.md`, `DEMO-AND-MANUAL-TEST-GUIDE.md`, `INDEPENDENT-REVIEW.md`, `THREAT-MODEL.md`, `IMPLEMENTATION-MANIFEST.md`, `STEP-43-HANDOFF.md`, issue register.
10. **42-J | STOP:** request owner acceptance. No step 43 protected routes, no automatic commits, push, PR or merge.

---

## 12. Environment variables, API keys and external-service requirements

**Always tell the owner exactly what is needed before implementation; never ask them to paste private values into chat.**

### Existing required, already canonical

| Location | Variable | Step | Notes |
|---|---|---|---|
| `apps/api/.env` | `NODE_ENV`, `PORT`, `API_PREFIX`, `FRONTEND_ORIGIN` | 41–42 | Development defaults per `apps/api/.env.example`; exact allowlisted frontend origin |
| `apps/api/.env` | `MONGODB_URI`, `MONGODB_DB_NAME` | 41–42 | Atlas dev for owner-approved live test; isolated `infraos_test` for automated tests |
| `apps/api/.env` | `ACCESS_TOKEN_SECRET`, `ACCESS_TOKEN_TTL=15m` | 42 regression | Reuse existing secret; **do not rotate** merely for reset |
| `apps/api/.env` | `REFRESH_TOKEN_SECRET`, `REFRESH_TOKEN_TTL=7d` | 42 regression | Reuse existing distinct secret; needed for Step 40 family/session regression |
| `apps/web/.env.local` | `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000` | 41–42 | Public origin only; no `/api/v1` suffix |
| `apps/web/.env.local` | `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=1` | Local tests | Only in non-production, preserving current production preview gate |

**New service requirement:** To actually deliver recovery emails, the team must select/approve **one real email provider** and configure private provider credentials. **None are in INFRAOS's canonical env catalog yet.** If approved, propose canonical names and corresponding typed validation, e.g. `MAIL_PROVIDER`, `MAIL_FROM`, `MAIL_API_KEY` *only as design proposals*, never assume they currently exist or copy into public `.env.local`. Update `.env.example`, `docs/setup/environment.md`, secret redaction and deployment services only after approval. A sender implemented purely for memory tests cannot support live password recovery; **mark live delivery BLOCKED if no real provider**. Do not enable production reset flow until approved sender, indexes, compliance/security checks, and later auth enforcement are ready.

**Not required:** OpenRouter API key, Qdrant, Cloudflare R2, maps, AI_BASE_URL, AI_INTERNAL_SECRET, payments, OAuth, MFA. No new JWT signing secret is needed just for password reset; reset tokens are cryptographic random bytes with digest persistence.

**Security:** `.env` and `.env.local` ignored, no secret to frontend or Git; never log Atlas URI; do not use alternate rejected names `JWT_SECRET`, `REFRESH_SECRET`, `CLIENT_URL`, `MONGO_URI`; `FRONTEND_ORIGIN` exact, no wildcard. Review current TLS/DNS status and Atlas indexes; do not weaken certificate validation or production cookie rules to make tests pass.

## 13. Architecture review: critical choices & trade-offs

Before coding, document concrete choices in a short ADR or `RECOVERY-SECURITY-DECISIONS.md`:

1. Recovery token TTL and resend cooldown (bounded, privacy-safe, implementable without user enumeration).
2. Whether one live challenge per user; conditional uniqueness and how expired-but-uncollected rows are superseded.
3. Hash-only storage and the exact secret/index strategy (SHA-256 safe for 256-bit random tokens; HMAC also acceptable if key rotation is planned).
4. Test-only memory sender versus approved live provider; no fake delivery guarantees.
5. Reset policy for PENDING/unverified/SUSPENDED/DISABLED; Q-002/Q-005 must remain intact.
6. Generic acceptance and timing-risk response design; bounded abuse and NAT resilience.
7. MongoDB transaction/credential epoch design; session-family close under concurrency; precise commit point.
8. Existing sessions lacking `RefreshFamily` guard, if any, and migration/revocation logic; do not ignore them during global reset.
9. Password hash change and all-family close failure handling, including retries and idempotency.
10. Index deployment: model declaration does **not** imply Atlas index exists; `autoIndex` may mutate Atlas at startup; mandatory owner approval.
11. Browser fragment handling, link origin, Referrer-Policy, noindex, and no SSR leak.
12. Existing JWT validity limitation until Step 44; documented user wording.

## 14. Threat model and minimum required countermeasures

| Threat | Required control/evidence |
|---|---|
| Account/email enumeration | Same request response for eligible, nonexistent and ineligible account; timing review; no differences in email mode disclosures |
| Token guessing | 256-bit CSPRNG, strict format, hash-only DB, short TTL, brute-force throttle |
| Token leakage in URLs | Fragment-only page URL; scrub fragment; no analytics, referrers, raw logs or screenshots |
| Replay/reuse | Single-use atomic consumption and post-reset invalidation of all prior challenges |
| Parallel issuance | One-live challenge scheme with deterministic barriers/index constraints |
| Concurrent resets | One winning commit; no password rollback or another token restoring prior password |
| Concurrent old-password login | Per-user credential generation barrier; no usable post-reset old-credential session |
| Concurrent refresh | Step 40 family authority honored; no live successor after global reset |
| Partial DB failure | Transactional/fail-closed semantics and clearly reported blocked state |
| Unapproved email delivery | Memory sender tests only; production disabled/unavailable until provider is approved |
| XSS / role elevation | No raw HTML injection, no role changes, no unsafe redirect, no client-auth claims |
| Lax CORS/CSRF | Exact Origin on sensitive POST routes, SameSite policies unchanged, no ambient authorization via reset cookie |
| DOS / flooding | Global and per-identity throttling, bounded message size, cooldown and test evidence |
| Password truncation | Reuse 72-byte UTF-8 bcrypt maximum; no silent trim/change of password |
| Access JWT after reset | Honest documented limitation before Step 44 middleware and account recheck |

## 15. Testing and evidence standard

### Focused automated suites (filenames illustrative; adapt after inspection)

- `apps/api/tests/password-reset-request.test.ts`: Step 41 request, sender, anti-enum, malformed payload, cooldown, concurrency, origin, rate limits, expiration, DB failure, redaction.
- `apps/api/tests/password-reset-consume.test.ts`: Step 42 single use, expiry, password hash, replay, multi-family/session close, per-user epoch, races, transactions, disabled users, other users unaffected.
- `apps/web/src/lib/auth/password-recovery.test.ts(x)`: request/consume transport and form behavior, fragment scrub, no web storage, errors, localized copy, UI epoch.
- Existing `auth-logout`, `auth-session`, `auth-jwt`, `auth-rate-limit`, `email-verification`, and login UI tests must remain passing.

### Mandatory verification commands from the **single repo root**

```powershell
npm run test:api
npm run test:web
npm run type-check
npm run lint
npm run build
```

Additional database checks after approved `infraos_dev` access: `npm run db:check`; `npm run db:indexes:check` is read-only inspection if the script is truly read-only—verify implementation; do **not** run destructive sync. Focused vitest command should use actual scripts/test filenames, e.g. `npm run test -w @infraos/api -- tests/password-reset-request.test.ts tests/password-reset-consume.test.ts`. Never report a command PASS unless it was run successfully in this pass. Label blockers with exact cause, e.g. missing provider, Atlas index approval, browser security limitation.

### Browser manual demo

1. Start API and web in separate local terminals; `/health`, `/ready`, Mongo dev readiness (when authorized).
2. Visit `/login`, `/si/login`, `/ta/login`; verify **Forgot password?** entry, no public landing changes.
3. Visit `/forgot-password` and submit a synthetic eligible email; compare generic UI with unknown email, validate cooldown and status without exposing account presence.
4. If sender is memory-only, use an **isolated test harness** to verify recovery token capture and link flow. Do not claim a real inbox received it. If a provider is approved, check a synthetic owned inbox.
5. Follow approved recovery link and inspect fragment handling; complete `/reset-password` with strong new password, confirm no token exposure and no auto-login.
6. Old password fails; new password succeeds when account eligible; all earlier refresh cookies fail, including on second device; separate user's session still works.
7. Test expired/used token, invalid Origin, malformed input, rate limiting, dependency failures; verify no sensitive data in devtools screenshots/logs.
8. Inspect at 320/375/390/768/1280/1440 widths, keyboard Tab, errors/focus, Sinhala/Tamil links and native-language review notes.

### Deliverable files

```text
docs/reviews/step-41/
  PRE-IMPLEMENTATION-AUDIT.md
  RECOVERY-REQUEST-CONTRACT.md
  TOKEN-AND-DELIVERY-DECISIONS.md
  INDEX-MIGRATION-PROPOSAL.md
  SECURITY-TEST-MATRIX.md
  INDEPENDENT-REVIEW.md
  END-OF-STEP-VERIFICATION.md
  DEMO-AND-MANUAL-TEST-GUIDE.md
  STEP-42-HANDOFF.md

docs/reviews/step-42/
  PRE-IMPLEMENTATION-AUDIT.md
  CREDENTIAL-REVOCATION-ARCHITECTURE.md
  SECURITY-THREAT-MODEL.md
  CONCURRENCY-AND-TRANSACTION-TEST-MATRIX.md
  IMPLEMENTATION-MANIFEST.md
  INDEPENDENT-REVIEW.md
  END-OF-STEP-VERIFICATION.md
  DEMO-AND-MANUAL-TEST-GUIDE.md
  STEP-43-HANDOFF.md
```

These are **directories inside `InfraOS`**, not extra checkouts beside `InfraOS`. Do not overwrite prior review evidence; add dated addenda when updating old records. Mark tests `PASS`, `FAIL`, `BLOCKED`, `NOT RUN`; distinguish author-reviewed versus independent second reviewer. The agent must not fake independence by relabeling its own check.

## 16. Formal per-step acceptance rubrics

### Step 41 — approve only when

- [ ] G0 Step 40 release/acceptance dependency verified and reviewed.
- [ ] Recovery request is mounted and uses strict Zod/body/origin/anti-enumeration rules.
- [ ] New challenge digest is never exposed; Mongo model/index specification and TTL are reviewed.
- [ ] Concurrent request and cooldown proof is deterministic; only one intended live challenge.
- [ ] Sender strategy is honest; production live delivery either approved and proven or explicitly unavailable and blocked for real demo.
- [ ] English/Sinhala/Tamil request UI is premium, accessible and mobile responsive; login link present; landing unchanged.
- [ ] Focused and full suites, type-check, lint, build pass or unresolved failures explicitly block approval.
- [ ] Independent review and repeatable manual guide exist, with actual test evidence.
- [ ] Owner explicitly says **Step 41 APPROVED**; only then begin Step 42.

### Step 42 — approve only when

- [ ] Step 41 already approved and no provider/token delivery assumptions were hidden.
- [ ] Reset token can be used exactly once; used/expired/revoked tokens rejected.
- [ ] bcrypt 12 and existing password byte policy verified; old password rejected, new works (eligible account).
- [ ] Password mutation and closing all refresh families are a proven logical/atomic commit with race barriers.
- [ ] Old-password login/refresh/reset concurrency cannot leave usable post-reset sessions; unrelated users remain unaffected.
- [ ] Browser handles token fragment safely, does not auto-login, clears local in-memory auth on success, with honest access-JWT limitation.
- [ ] Separate security review, API/web tests, type/lint/build, manual proof and risk register completed.
- [ ] Atlas indexes/migrations, provider setup, any privileged test user creation are owner-approved and documented.
- [ ] Clear Step 43 handoff; no protected-route middleware implemented prematurely.
- [ ] Owner explicitly says **Step 42 APPROVED** before feature Git integration or next roadmap step.

## 17. Git integration / release controls

**No automatic side-effect actions.** Each phase needs explicit user instruction before performing it:

1. **Branch:** after G0 and repo audit, ask to create/reuse one `feature/auth-password-recovery` branch **inside `InfraOS`**. Use freshly inspected remote `development`; do not disturb uncommitted changes.
2. **Local commit:** after Step 41 approval, propose scoped conventional commit(s) (e.g. `feat(auth): implement forgot-password request`); seek explicit commit permission. If owner prefers defer, keep changes uncommitted safely and continue on same branch only when G3 approved.
3. **Step 42 local commit:** after acceptance propose `feat(auth): implement secure password reset and session revocation` and accompanying tests/docs, with separate approval.
4. **Push:** request separate approval before `git push`.
5. **PR:** request permission to open PR feature→`development`; present tests, screenshots, security risks, migration plan, Step 41/42 evidence. Avoid auto-merge.
6. **Merge into `development`:** request explicit owner decision; ensure reviews and required CI checks passed.
7. **Promote to `main`:** request another approval and run release acceptance including secret/provider policy and index deployment. Never automatically enable production password recovery if real email not configured or authorization incomplete.

**Done means proven and approved, not merely code appearing on `main`.** Keep the single-folder policy and preserve `Documents` indefinitely.

## 18. Handoff message to downstream Cursor Agent

Execute the companion execution playbook exactly in sequence. Start with read-only preflight. Show concrete repository evidence and Step 40 approval state before coding. Do the full safe scope for each step; never claim inability to proceed because an external mail key is missing when isolated tests/design work are possible. Conversely, never fake live mail or production readiness. Once Step 41 passes, request separate approval before starting Step 42. Maintain full security/regression evidence. Stop before unapproved Git operations, database index creation, and future roadmap steps.
