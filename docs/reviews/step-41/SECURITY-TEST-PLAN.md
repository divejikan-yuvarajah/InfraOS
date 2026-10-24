# Step 41 — security and acceptance test plan

**Status:** Design  
**Scope:** Password reset **request** only  
**When:** 2026-10-24

---

## 1. Test files (proposed)

| File | Layer |
|------|--------|
| `apps/api/tests/password-reset-request.service.test.ts` | Service: issuance, cooldown, supersession, hooks |
| `apps/api/tests/password-reset-request.routes.test.ts` | HTTP: origin, rate limit, envelope, 503 |
| `apps/web/src/lib/auth/password-reset-request.test.ts` | Client + form validation (if extracted) |

Reuse: `mongo-memory` helper, `provisionStaff`, `createMemoryVerificationSender` pattern → **`createMemoryPasswordResetSender`**.

---

## 2. Service matrix

| # | Case | Expected |
|---|------|----------|
| S1 | Unknown email | ACCEPTED, no row, no send |
| S2 | Eligible user (per owner rule A/B/C) | Row + memory send, link shape |
| S3 | Ineligible user (DISABLED/SUSPENDED) | ACCEPTED, no row |
| S4 | Cooldown within 60s | ACCEPTED, no second row |
| S5 | Supersede live challenge | Prior `revokedAt` set, new row |
| S6 | Expired live row not yet TTL-deleted | Revoke then insert succeeds |
| S7 | Concurrent double issue | Partial unique → one winner, both ACCEPTED |
| S8 | Hook: afterRevokeLive / beforeInsert barrier | Deterministic race |
| S9 | Sender unavailable | ACCEPTED, no DB row (or policy: no send path) |
| S10 | Send throws | Row revoked, ACCEPTED |
| S11 | Mongo create fails | 503, no false “sent” |
| S12 | Token never in audit array / logs | Inspect audit API only |
| S13 | Digest in DB ≠ raw token | consume prep for Step 42 |

---

## 3. HTTP route matrix

| # | Case | HTTP | Code |
|---|------|------|------|
| H1 | Valid body, allowed Origin | 200 | ACCEPTED |
| H2 | Valid body, allowed Referer, no Origin | 200 | ACCEPTED |
| H3 | Wrong origin | 403 | FORBIDDEN |
| H4 | Extra JSON field | 400 | VALIDATION_ERROR |
| H5 | Invalid email | 400 | VALIDATION_ERROR |
| H6 | Non-JSON | 415 | UNSUPPORTED_MEDIA |
| H7 | Rate limit exceeded | 429 | RATE_LIMITED |
| H8 | Unknown vs known email same status/body shape | 200 both | ACCEPTED |
| H9 | `Cache-Control: no-store` present | headers | — |

---

## 4. Privacy / enumeration

| # | Case | Method |
|---|------|--------|
| P1 | Response body bitwise same for unknown vs eligible | assert deep equal `data.status` |
| P2 | No user id/email in error messages | grep responses |
| P3 | Production sender unavailable still 200 | `NODE_ENV=production` app test |

Timing tests: document **NOT RUN** unless owner requires constant-time harness (hard in Node integration tests).

---

## 5. Web UI (Step 41)

| # | Case |
|---|------|
| W1 | `/forgot-password`, `/si/forgot-password`, `/ta/forgot-password` render |
| W2 | Submit shows generic success copy |
| W3 | Link to localized login |
| W4 | No landing CSS/route regression (smoke: existing landing tests unchanged) |
| W5 | a11y: labels, focus order (match login form patterns) |

---

## 6. Regression

| Suite | Expect |
|-------|--------|
| `auth-logout.test.ts` | PASS unchanged |
| `auth-session.test.ts` | PASS |
| `email-verification*.test.ts` | PASS |
| Full `test:api` / `test:web` | PASS before Step 41 sign-off |

---

## 7. Acceptance gate (Step 41 owner approval)

Step 41 **APPROVE** only when:

- [ ] All S*, H* cases PASS in CI
- [ ] Owner eligibility rule A/B/C implemented as chosen
- [ ] INDEX-MIGRATION-PROPOSAL approved or waived for test-only memory DB
- [ ] No token/link in logs (manual grep / log test)
- [ ] `END-OF-STEP-VERIFICATION.md` filled with real SHAs and counts
- [ ] Step 42 **not** started

---

## 8. Explicitly NOT RUN in Step 41

- Live SMTP / provider delivery  
- Browser E2E with real inbox  
- Atlas index apply (unless owner runs approved migration)  
- Reset token consumption  
