# ADR-006 — JWT Access + Refresh Session

**Status:** Accepted  
**Step:** 02  
**Date:** 2026-09-30

## Context

The SPA on Vercel and API on Render are **different sites**. Sessions must be secure against XSS and usable across CORS.

## Decision

- **Access:** short-lived JWT (≈15 min) in the `Authorization` header, held in **memory**
- **Refresh:** rotating token in an **HTTP-only Secure cookie** (`SameSite=None` in this topology), stored hashed in MongoDB, path `/api/v1/auth`
- Passwords: **bcryptjs** (cost 12)
- CORS allowlist + Origin check on cookie routes

Details: [security-decisions.md](../architecture/security-decisions.md).

## Reasons

- Access JWT is not stolen via `localStorage` XSS
- Refresh theft is mitigated by rotation and family revoke
- Cross-site demo deployment is realistic for Vercel + Render

## Alternatives considered

| Alternative | Why not |
|-------------|---------|
| Access token in localStorage | XSS steals a live credential |
| Server sessions only, no JWT | Fine, but JWT access is specified and works with sockets |
| Cookie for every API call | Broader CSRF surface |
| NextAuth as the only IdP | Would hide Express as SoR; OAuth is P2 |

## Trade-offs

- `SameSite=None` needs CSRF/origin discipline
- Memory access token is lost on full page reload — silent refresh on boot is required

## Consequences

- Disabled users must fail even with unexpired JWT (DB status check)
- MFA/OAuth remain P2

## Future revisit conditions

- First-party custom domains (`app` + `api` on one parent) → consider `SameSite=Lax`
- Argon2id when Windows native builds are reliable
