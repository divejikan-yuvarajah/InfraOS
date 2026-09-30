# ADR-012 — Deployment Strategy

**Status:** Accepted  
**Step:** 02  
**Date:** 2026-09-30

## Context

The team needs a realistic public demo: Next.js, Express, FastAPI, MongoDB, objects, vectors. Providers must stay few.

## Decision

| Piece | Provider |
|-------|----------|
| Frontend | **Vercel** |
| Express API | **Render** |
| FastAPI AI | **Render** (same account) |
| Database | **MongoDB Atlas** |
| Objects | **Cloudflare R2** |
| Vectors | **Qdrant Cloud** (prod/staging); Docker local |
| CI | **GitHub Actions** |
| Uptime | UptimeRobot (or equivalent) |
| Optional errors | Sentry |

Railway is the **fallback** host for API/AI if Render is unusable — document a superseding ADR rather than dual-running.

Environments: separate **dev** and **production** secrets and Atlas databases. Staging if time allows.

## Reasons

- Vercel is native for Next.js
- One PaaS (Render) for both long-running Node and Python
- Atlas already required for GeoJSON
- Matches academic cost and skill

## Alternatives considered

| Alternative | Why not default |
|-------------|-----------------|
| Railway as primary | Equivalent; Render chosen for one lock |
| Fly.io / AWS ECS | More ops |
| Kubernetes | Rejected |
| Hosting FastAPI on Vercel serverless | Timeouts for RAG |
| Single box VPS | Possible; worse DX for the course |

## Trade-offs

- Cross-site cookies (`SameSite=None`) until custom domains exist
- Free-tier spin-down on Render — first request may be slow; health pings help

## Consequences

- `FRONTEND_ORIGIN` exact allowlist
- Branch protection: no deploy of red CI
- Custom domain pairing is optional later (simpler cookies)

## Future revisit conditions

- Need always-on workers / queues for heavy PDF (still not Kafka — a Render worker + Mongo job collection first)
- Institutional Azure/AWS mandate
