# ADR-007 — RBAC + Resource-Level Authorization

**Status:** Accepted  
**Step:** 02  
**Date:** 2026-09-30

## Context

Seven roles (Step 1) share one API. Role alone is insufficient: a project manager must not edit another agency’s project.

## Decision

Enforce **RBAC** (can this role do this action type?) **and resource authorization** (can this user do it on **this** record?) **only on Express**.

Frontend route guards are UX.

Private resources that are out of scope return **404** (not a directory of 403s) unless a product rule says otherwise.

Permission catalog: **Step 4**.

## Reasons

- Matches [business-rules.md](../planning/business-rules.md) BR-AUTH and BR-SCOPE
- Prevents IDOR via known ObjectIds
- Super Admin is not an operational bypass

## Alternatives considered

| Alternative | Why not |
|-------------|---------|
| Frontend-only role checks | Trivial bypass |
| RBAC without resource checks | Cross-agency leakage |
| ABAC/ReBAC platform (Cedar, Zanzibar) | Overkill for V1 |

## Trade-offs

- Every list query must include a scope filter — more service code, correct security

## Consequences

- Testers must include 401/403/404 IDOR cases
- Citizens get public DTOs only

## Future revisit conditions

- Multi-ministry ABAC policies mandated by a real government deployment
