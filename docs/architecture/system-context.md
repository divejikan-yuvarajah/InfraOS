# INFRAOS System Context

**Document:** `/docs/architecture/system-context.md`  
**Step:** 03 — Complete System Architecture  
**Status:** Locked  
**Stack:** [technology-stack.md](./technology-stack.md) (Step 2 — do not silently change)

---

## 1. Purpose

This diagram shows **who** uses INFRAOS and **which external systems** the platform talks to. It is not a module list.

Two surfaces:

| Surface | Who | Auth |
|---------|-----|------|
| **Public** | Citizens (and anyone browsing public pages) | Unauthenticated, or optional later citizen account (Q-005) |
| **Authenticated app** | Super Admin, Gov Admin, Agency Officer, Project Manager, Contractor, Inspector | JWT access + refresh cookie |

The **browser is untrusted**. Only **Express** is the enforcement boundary. FastAPI, R2, Qdrant, and MongoDB are not exposed to the browser.

---

## 2. System context

```mermaid
flowchart TB
  subgraph public["Public surface"]
    Citizen
  end

  subgraph staff["Authenticated surface"]
    SuperAdmin[Super Admin]
    GovAdmin[Gov Admin]
    Officer[Agency Officer]
    PM[Project Manager]
    Contractor
    Inspector
  end

  INFRAOS[INFRAOS web + API]

  Citizen --> INFRAOS
  SuperAdmin --> INFRAOS
  GovAdmin --> INFRAOS
  Officer --> INFRAOS
  PM --> INFRAOS
  Contractor --> INFRAOS
  Inspector --> INFRAOS

  INFRAOS --> Tiles[OSM-compatible tiles]
  INFRAOS --> Atlas[MongoDB Atlas]
  INFRAOS --> R2[Cloudflare R2]
  INFRAOS --> Qdrant[Qdrant]
  INFRAOS --> LLM[LLM provider via adapter]
  INFRAOS --> Mon[Sentry / UptimeRobot optional]
  INFRAOS --> Mail[Email P2]
```

---

## 3. Trust summary

| Actor | May reach |
|-------|-----------|
| Citizen | Public Next.js routes + public REST (`/public-projects`, `/issues` intake, `/public-map` data) |
| Staff | Authenticated Next.js app + `/api/v1/*` with Bearer access token |
| Nobody in the browser | MongoDB, R2 admin, Qdrant, FastAPI, provider API keys |

Email is **not** required for P0. Monitoring is operational, not a product actor.
