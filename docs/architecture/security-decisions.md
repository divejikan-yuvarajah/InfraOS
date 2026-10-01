# INFRAOS Security Decisions

**Document:** `/docs/architecture/security-decisions.md`  
**Step:** 02  
**Status:** Locked  
**Related:** [ADR-006](../adr/ADR-006-jwt-access-refresh-session.md), [ADR-007](../adr/ADR-007-rbac-resource-authorization.md)

The Node.js API is the **enforcement boundary**. The browser is untrusted. Model output is untrusted. Uploaded files and document text are untrusted.

---

## 1. Authentication

### Access token

- Algorithm: **HS256** JWT signed with `ACCESS_TOKEN_SECRET` (or RS256 later if needed; HS256 is enough for V1 one-API)
- Lifetime: **15 minutes**
- Transport: `Authorization: Bearer` from **memory** (React state). Not `localStorage`.
- Claims (minimum): `sub` (user id), `typ: access`, `jti`, `iat`, `exp`. **Do not** put permissions arrays that the client can edit and that the server trusts blindly — server loads role/status from DB on sensitive operations or embeds a revision (`permVer`) that is checked against the user record.

### Refresh session

- Opaque or rotating JWT stored **hashed** in `refreshSessions`
- Transport: **HTTP-only, Secure, Path scoped to `/api/v1/auth`**, not readable by JS
- Lifetime: **7 days** (absolute) with rotation on each refresh
- Reuse of a rotated token: revoke the **family** (theft detection)

### Cookie flags (production, Vercel ↔ Render cross-site)

| Flag | Value | Reason |
|------|-------|--------|
| `HttpOnly` | true | XSS cannot steal refresh |
| `Secure` | true | HTTPS only |
| `SameSite` | `None` | Cross-site SPA → API |
| `Path` | `/api/v1/auth` | Limit blast radius |
| `Domain` | **unset** (API host only) | Cannot share with `*.vercel.app` |

Frontend uses `credentials: 'include'` only against the API origin.

### CSRF on cookie endpoints

`SameSite=None` cookies are sent on cross-site requests. Mitigations for `/login` refresh and `/logout`:

1. **CORS allowlist** of exact frontend origins (no `*`)
2. Require `Origin` (or `Referer`) to match the allowlist on cookie-mutating routes
3. POST-only for refresh/logout
4. Optional later: refresh CSRF token

Bearer access tokens in `Authorization` are not sent automatically by foreign sites.

### Flows (implementation later)

| Flow | Rule |
|------|------|
| Login | Verify hash; reject DISABLED/unverified-if-required; issue access + set refresh cookie; audit |
| Refresh | Rotate; new access JSON; no password |
| Logout | Clear cookie; revoke session family |
| Password reset (P1) | Time-limited hashed token; invalidate sessions on success |
| Email verification (P1 mechanism) | Token in DB; **whether login is blocked** remains Q-002 / Step 4 policy |
| Expired access | 401; client tries refresh once |
| Disabled user | All protected routes fail even with a still-valid JWT (status check) |

MFA and OAuth: **P2**.

---

## 2. Password hashing

**V1: bcryptjs** (pure JS, reliable on Windows teammate machines).

- Cost factor: **12** (tune if demo hardware struggles; document the env)
- Never log plaintext or hashes in audit `newValue`

**Revisit Argon2id** when native builds are reliable for all developers ([D-010 closed](../planning/assumptions-risks.md) with this V1 choice).

---

## 3. Authorization

Two gates, always on the server:

```text
Authenticated? → Role has permission? → Resource in scope? → Business rule? → Act → Audit if sensitive
```

Frontend guards are UX.

IDOR: every `/:id` load must verify agency/assignment/public flag. List queries **filter in MongoDB**, not in the UI.

Super Admin is not a daily approval bypass ([BR-AUTH-005](../planning/business-rules.md)).

Permission matrix: [../security/README.md](../security/README.md) (Step 4).

---

## 4. HTTP hardening

| Control | Choice |
|---------|--------|
| Headers | Helmet |
| CORS | Allowlist of frontend URLs; `credentials: true` |
| Body size | Small JSON limit (e.g. 1mb); larger only on upload routes |
| Rate limit | `express-rate-limit`: stricter on `/auth/login`, public issues, `/ai` |
| HTTPS | Required in production (Vercel/Render terminate TLS) |
| Secrets | Environment variables only; never commit `.env` |

---

## 5. Data and MongoDB

- No user-supplied objects spread into query operators (`$gt`, `$where`). Parse with Zod, then query known fields.
- Invalid ObjectId → **400**
- Missing resource the caller is allowed to know about → **404**; never leak existence of another agency’s private id if that would be sensitive — default 404 for both missing and out-of-scope is acceptable for private resources (prefer **404 over 403** for IDOR on confidential records so attackers cannot map ids). **Document the chosen pattern in implementation: private resources return 404 when unauthorized.**
- Pagination max 100

---

## 6. Files

- MIME allowlists per use case (PDF/DOCX for DocTrace; JPEG/PNG/WebP for evidence)
- Size caps
- Random object keys
- Private R2 bucket; download via short-lived presigned URL **after** Express authz
- Never trust `Content-Type` alone; check magic bytes where practical
- Antivirus: P2

---

## 7. AI security

- Only Express calls FastAPI (shared `AI_INTERNAL_SECRET`)
- Minimize PII and contract text
- Prompt size and output token caps
- Rate limit per user
- Treat retrieved document text as **data**, not instructions (delimiter + system policy)
- Schema-validate model JSON
- On failure: fallback, do not change official status
- Cost: env max tokens/day (implementation detail later)

---

## 8. XSS / injection

- React default escaping
- No `dangerouslySetInnerHTML` for user or model text
- Markdown rendering (if any) with a sanitizer
- Map popups: text nodes, not raw HTML from the API

---

## 9. Audit

Append-only. Actor, action, resource, resourceId, timestamp, old/new (redacted). No tokens, passwords, or file bytes.

---

## 10. Related NFRs

See NFR-SEC in [../planning/requirements.md](../planning/requirements.md).
