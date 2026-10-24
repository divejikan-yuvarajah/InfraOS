# Step 41 — token and delivery decisions

**Status:** Awaiting owner approval before implementation  
**When:** 2026-10-24

---

## 1. Token format (locked for design)

| Aspect | Decision |
|--------|----------|
| Generation | `crypto.randomBytes(32)` → base64url |
| Raw length | 43 characters, charset `[A-Za-z0-9_-]` |
| Storage | SHA-256 hex digest (64 chars), `select: false` on challenge model |
| Purpose | Field `purpose: "RESET_PASSWORD"` (separate from `VERIFY_EMAIL`) |
| Transport to user | HTTPS link fragment only: `{FRONTEND_ORIGIN}/reset-password#token=...` |
| Fragment rationale | Token not sent to server on page load (Referer); client reads hash in Step 42 |

Reuse digest helper pattern from `email-verification.service.ts` (`digest`, `tokenShape`).

---

## 2. Delivery abstraction (mirror verification)

Extend or parallel `verification-mail.ts`:

| Mode | When | Behavior |
|------|------|----------|
| **`memory`** | `NODE_ENV !== "production"` (tests, local dev with owner awareness) | Append `{ to, token, link }` to in-process array; **`captured()`** for tests |
| **`unavailable`** | `NODE_ENV === "production"` today | No send; service returns ACCEPTED without pretending delivery (same as verification) |

Factory: `createPasswordResetSender(nodeEnv)` — structurally identical to `createVerificationSender`.

**Hard rules:**

- Do **not** log reset tokens to console, Pino, or audit payloads.
- Do **not** claim “email sent” in API JSON.
- Do **not** expose memory-captured tokens via any HTTP endpoint.
- Tests use **injected sender** only (unit/service tests), not production code paths.

---

## 3. Real provider — **not decided** (owner must choose)

No approved vendor exists in `docs/setup/environment.md`. Before live delivery:

| Decision | Owner input needed |
|----------|-------------------|
| Provider | e.g. SendGrid, Resend, AWS SES, SMTP relay — **not selected** |
| Env vars | New canonical names must extend INC-005 via architecture approval (e.g. `EMAIL_PROVIDER`, `EMAIL_FROM`, API key names) |
| From address | Verified domain / DMARC / SPF |
| Template | EN + SI + TA content for reset email (Step 41 may stub EN-only in code with i18n hook) |
| Production cutover | Separate gate after isolated tests pass with memory sender |

**Step 41 implementation recommendation:** ship **memory + unavailable** only; add provider adapter in a follow-up commit after G1 sign-off.

---

## 4. Link construction

Function: `passwordResetLink(allowlistedOrigin: string, token: string): string`

Rules (copy `verificationLink`):

- Parse `FRONTEND_ORIGIN` as URL base.
- Require **https** except `localhost` / `127.0.0.1`.
- Path: `/reset-password` (no query string token).
- Hash: `token=${encodeURIComponent(token)}`.

Trusted origin only — never reflect user-supplied `returnTo` or host.

---

## 5. Memory sender vs “user received email”

| Environment | What demo operators can do |
|-------------|----------------------------|
| Automated tests | Assert on `sender.captured()[0].link` and digest in DB |
| Local manual demo | Read captured message from test hook or documented dev-only script — **not** shipped as API |
| Production | **No delivery** until provider gate; UI still shows generic ACCEPTED message |

This satisfies “do not pretend memory-captured mail reached the user” in production.

---

## 6. Rate limiting and abuse

| Layer | Policy |
|-------|--------|
| IP | `forgotPasswordRateLimit` (proposed 10/15m prod) |
| Account | 60s cooldown between issuances per `userId` + purpose |
| User enumeration | Identical 200 envelope |
| Timing | Avoid early-return skips that differ measurably on unknown email vs known — prefer fixed work order or document residual risk |

Optional later: CAPTCHA (out of Step 41 scope).

---

## 7. Test hooks (deterministic races)

Mirror `refreshRotationHooks` in `refresh-session.service.ts`:

```typescript
export const passwordResetIssuanceHooks: {
  afterRevokeLive: () => Promise<void>;
  beforeInsert: () => Promise<void>;
} = { ... no-ops ... };
```

Tests set hooks to interleave concurrent `requestPasswordReset` calls and assert one live challenge per user (partial unique index + revoke pattern).

Export `passwordResetAuditEvents()` parallel to `verificationAuditEvents()` for assertions without log scraping.

---

## 8. Approvals required

- [ ] Owner selects account eligibility **A / B / C** (see RECOVERY-REQUEST-CONTRACT.md §5)
- [ ] Owner accepts memory/unavailable-only delivery for Step 41 merge
- [ ] Owner defers or selects real email provider (separate from Step 41 code merge)
