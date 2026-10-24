# Step 41 — password recovery request contract

**Status:** Design (not implemented)  
**Scope:** `POST /api/v1/auth/forgot-password` only — token **issuance** and delivery orchestration. Step 42 consumes tokens.  
**When:** 2026-10-24  
**Base ref:** `main` @ `e60c6a3eadc691fae7f0da30577b27c0744d13fa`

---

## 1. Password policy (existing — reuse, do not redefine)

| Rule | Source |
|------|--------|
| Hashing | **bcryptjs**, cost **12** (`BCRYPT_COST` in `registration.service.ts`) |
| Minimum length | **8** characters (`PASSWORD_MIN_LENGTH` in `registration.schema.ts`) |
| Maximum | **72 UTF-8 bytes** (`BCRYPT_MAX_UTF8_BYTES`) |
| Trimming | Names/emails trimmed in Zod; **password superRefine does not trim** — preserve intentional whitespace and Unicode bytes |
| Storage | `User.passwordHash`, **`select: false`**, stripped from JSON transforms |

Step 41 does **not** change passwords; Step 42 must reuse the same Zod password rules.

---

## 2. HTTP endpoint

| Item | Value |
|------|--------|
| Method / path | `POST /api/v1/auth/forgot-password` |
| Router mount | `authRouter` in `apps/api/src/routes/v1.ts` (same prefix as login/logout) |
| Content-Type | `application/json` only (415 if missing/wrong — match login) |
| Body | Strict Zod: `{ "email": string }` — trim, email(), max 254, lowercase transform |
| Rejected body keys | Any extra key → **400** `VALIDATION_ERROR` (strict object) |
| Origin | **`rejectDisallowedOrigin`** from `auth.security.ts` (Origin or Referer must equal `FRONTEND_ORIGIN`; stricter than email-verification’s optional Origin) |
| Rate limit | New **`forgotPasswordRateLimit`** — propose **10 / 15 min / IP** prod, **40** in `NODE_ENV=test` (align with login) |
| Cache | `Cache-Control: no-store`, `Pragma: no-cache` on all responses |
| Referrer | `Referrer-Policy: no-referrer` on success (match verification routes) |

---

## 3. Success envelope (anti-enumeration)

**Always** return the same success shape when the handler completes without infrastructure failure:

```json
{
  "success": true,
  "data": { "status": "ACCEPTED" },
  "meta": { "requestId": "<uuid>" }
}
```

| HTTP | When |
|------|------|
| **200** | Parsed body OK, origin OK, rate limit OK — **regardless of** unknown email, ineligible account, cooldown, or “silent” no-op |
| **400** | Zod failure, malformed JSON (via global handler where applicable) |
| **403** | Origin / Referer not allowed |
| **415** | Non-JSON content type |
| **429** | IP rate limit (`RATE_LIMITED`, `Too many requests`) |
| **503** | Mongo write failure after a revocable partial write path exhausted (`SERVICE_UNAVAILABLE`) — **must not** reveal whether email existed |

**Forbidden in responses:** “user not found”, “not verified”, “suspended”, role/agency names, timing differences detectable by status code for unknown vs known email.

---

## 4. Internal issuance logic (privacy-safe)

Pseudocode aligned with `requestEmailVerification` (`email-verification.service.ts`) and login eligibility (`accountCanSignIn` in `refresh-session.service.ts`):

1. Normalize email (trim, lowercase).
2. If sender `mode === "unavailable"` (production default today): **return ACCEPTED** without DB read for delivery (optional: still apply rate limit only — **recommend** skip DB work entirely in unavailable mode to reduce timing signal; owner may prefer constant-time path — see test plan).
3. Load user by email (**no** `passwordHash`).
4. If no user → **return ACCEPTED** (no write).
5. If user fails **internal eligibility** (see §5) → **return ACCEPTED** (no write).
6. Enforce **per-account cooldown** (`RESEND_COOLDOWN_MS`-style, propose **60s** from last `issuedAt` for `RESET_PASSWORD` purpose).
7. **Supersede** prior live challenge: find `{ userId, purpose: RESET_PASSWORD, consumedAt: null, revokedAt: null }`, `findOneAndUpdate` set `revokedAt: now` (same race pattern as verification).
8. Generate **256-bit** token: `randomBytes(32).toBase64url()` → **43** chars, shape `/^[A-Za-z0-9_-]{43}$/`.
9. Store **SHA-256 hex digest only** (`tokenHash`), never store raw token.
10. Insert `password_reset_challenges` row; on duplicate key → **return ACCEPTED** (concurrent issuer lost race).
11. Build link: `{FRONTEND_ORIGIN}/reset-password#token={encodeURIComponent(token)}` with same HTTPS/localhost rules as `verificationLink`.
12. Call sender `send({ to, token, link })` — memory capture in non-prod tests only.
13. On send failure → revoke row by `tokenHash`, audit, **return ACCEPTED** (do not 503 unless DB cannot revoke and policy says otherwise — mirror verification: revoke then accept).

**Logging:** Audit categories only (`reset.requested`, `reset.issued`, `reset.delivery_unavailable`, `reset.rejected`). **Never** log raw token, digest, or reset link in application logs.

---

## 5. Account eligibility — **owner decision required**

Q-002 governs **sign-in**, not recovery. It does **not** auto-activate or verify accounts. Step 41 must **not** set `status`, `emailVerified`, or role/agency fields.

| Option | Internal rule | Rationale |
|--------|---------------|-----------|
| **A (recommended default)** | Issue only if user would pass **`accountCanSignIn`** today (`ACTIVE`, `emailVerified`, active role, active agency) | Reset only for accounts that can use the product; reduces noise to dormant/pending inboxes |
| **B** | Issue for `ACTIVE` or `PENDING` with active role + active agency; **ignore** `emailVerified` | Supports “forgot password before verify” while Q-002 still blocks login until verified |
| **C** | Issue for any existing user except `DISABLED` / `SUSPENDED` | Maximizes recovery; higher abuse surface on pending accounts |

**Do not implement until owner picks A, B, or C.** All options keep **identical** HTTP 200 envelope for ineligible and unknown emails.

---

## 6. Token and timing parameters (proposal)

| Parameter | Proposed | Notes |
|-----------|----------|--------|
| Token entropy | 256 bits | Same as email verification |
| TTL | **30 minutes** | Match `VERIFICATION_TTL_MS` unless owner wants shorter |
| Account cooldown | **60 seconds** | Match `RESEND_COOLDOWN_MS` |
| Purpose constant | `RESET_PASSWORD` | Separate collection from email verification |

---

## 7. Frontend (Step 41 UI only)

| Route | Locale |
|-------|--------|
| `/forgot-password` | `en` |
| `/si/forgot-password` | Sinhala (draft copy pattern as login) |
| `/ta/forgot-password` | Tamil (draft copy pattern as login) |

- Reuse **`auth-login.css`** and **`LoginPageShell`** layout patterns (new shell component or shared `AuthPageShell` — **do not** change landing routes, fonts on public site, or `landing-*` components).
- Form: email only; submit calls API with credentials + JSON.
- Copy: generic success (“If an account matches, instructions were sent”) — **no** promise of delivery in production when sender unavailable.
- Link back to localized login via `loginPathForLocale`.
- **Do not** add `/reset-password` consume UI in Step 41 (Step 42).

---

## 8. Exception pathways summary

| Condition | HTTP | Body |
|-----------|------|------|
| Bad origin | 403 | `FORBIDDEN` |
| Bad JSON / Zod | 400 | `VALIDATION_ERROR` |
| Wrong content type | 415 | `UNSUPPORTED_MEDIA` |
| Rate limit | 429 | `RATE_LIMITED` |
| Mongo unavailable on critical write | 503 | `SERVICE_UNAVAILABLE` |
| Unknown / ineligible / cooldown / duplicate race / send fail (handled) | 200 | `{ status: "ACCEPTED" }` |

---

## 9. Out of scope (Step 41)

- `POST /reset-password` consumption (Step 42)
- Session / refresh family revocation (Step 42)
- New mail provider credentials or production send
- Public landing changes
- Activating or verifying accounts
