# INFRAOS Authentication Flow

**Document:** `/docs/architecture/auth-flow.md`  
**Step:** 03  
**Status:** Locked  
**Policy:** [security-decisions.md](./security-decisions.md), [ADR-006](../adr/ADR-006-jwt-access-refresh-session.md)

Trust: browser untrusted; Express verifies password, status, and tokens.

---

## 1. Login

```mermaid
sequenceDiagram
  actor B as Browser
  participant API as Express
  participant DB as Atlas
  B->>API: POST /api/v1/auth/login
  API->>API: Zod + rate limit
  API->>DB: Find user by email
  alt missing / bad password / DISABLED / unverified-if-required
    API-->>B: 401 generic
    API->>DB: Audit login failure (no password)
  else ok
    API->>API: bcryptjs verify
    API->>DB: Create hashed refresh session
    API->>API: Sign access JWT ~15m
    API-->>B: Set-Cookie refresh HttpOnly Secure SameSite=None
    API-->>B: JSON user DTO + access token
  end
```

Never return password hash. User DTO has no permission to self-elevate.

---

## 2. Refresh

```mermaid
sequenceDiagram
  actor B as Browser
  participant API as Express
  participant DB as Atlas
  B->>API: POST /api/v1/auth/refresh (cookie)
  API->>API: Origin allowlist
  API->>DB: Lookup session hash
  alt missing / reused rotated / user DISABLED
    API->>DB: Revoke family if reuse
    API-->>B: 401 clear cookie
  else ok
    API->>DB: Rotate refresh
    API-->>B: New access JWT + new cookie
  end
```

---

## 3. Logout

```mermaid
sequenceDiagram
  actor B as Browser
  participant API as Express
  participant DB as Atlas
  B->>API: POST /api/v1/auth/logout
  API->>DB: Revoke session family
  API-->>B: Clear cookie + 204/200
```

---

## 4. Forgot / reset password (P1)

```mermaid
sequenceDiagram
  actor B as Browser
  participant API as Express
  participant DB as Atlas
  B->>API: POST /auth/forgot-password
  API->>DB: If user exists, store hashed reset token + expiry
  API-->>B: Generic success (no email enumeration)
  B->>API: POST /auth/reset-password
  API->>DB: Consume token, bcryptjs new password
  API->>DB: Revoke all refresh families
```

Email send is P2; for demo, token may be logged in **non-production** only if the team agrees (never production logs).

---

## 5. Email verification (P1 mechanism)

Policy of blocking login remains **Q-002**. Flow: hashed verify token → `emailVerifiedAt`.

---

## 6. App boot (silent session)

1. No access token in memory.
2. `POST /refresh` with credentials.
3. On success, hydrate user query; on 401, stay logged out.

---

## 7. Trust boundary

| Item | Trusted? |
|------|----------|
| Password in JSON over HTTPS | Transport only; hashed at rest |
| Access JWT signature + exp | Yes, then load `DISABLED` from DB on sensitive routes |
| Client `role` field | **No** |
| Refresh cookie | Yes only after Origin check + hashed lookup |
