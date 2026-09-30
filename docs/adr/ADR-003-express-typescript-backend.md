# ADR-003 — Express + TypeScript Backend

**Status:** Accepted  
**Step:** 02  
**Date:** 2026-09-30

## Context

Business rules, RBAC, GeoJSON writes, and audit must live in a server the team can test with Supertest.

## Decision

Use **Node.js 22 LTS + Express.js + TypeScript** as the system-of-record API.

Layering: Route → Middleware → Controller → Service → Repository (omit empty layers).

Validation: **Zod**. Logger: **Pino**. JWT helper preference: **jose**.

## Reasons

- Matches the course architecture and teammate skills
- Middleware model fits authz + Zod + rate limits
- TypeScript shared thinking with the frontend

## Alternatives considered

| Alternative | Why not |
|-------------|---------|
| NestJS | Ceremony for a 45–60 day modular monolith |
| Fastify | Fine technically; Express is the specified lock |
| FastAPI as the only API | Would mix CRUD with AI and weaken Node GIS/auth examples |

## Trade-offs

- Express is less “batteries included” than Nest — we add Helmet, CORS, rate-limit ourselves (desired control)

## Consequences

- All official state changes go through Express services
- FastAPI is a client of Express, not the reverse for permissions

## Future revisit conditions

- Unmaintainable Express sprawl — then consider Nest **only** with a new ADR
