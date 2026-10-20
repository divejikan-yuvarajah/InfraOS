# INFRAOS

**National Infrastructure Intelligence & Coordination Platform**  
Vision: *The Operating System for National Infrastructure*

INFRAOS helps government agencies **plan, coordinate, approve, build, verify, monitor, complete, and maintain** public infrastructure work — with geographic and schedule awareness so agencies do not silently excavate each other’s newly completed roads.

Version 1 is a **Sri Lankan public-infrastructure oriented** university / portfolio / production-style platform. It uses **demo and seed data**. It is not a live national government system-of-record.

> Connect Infrastructure. Coordinate Agencies. Build Smarter.

## Current status

**Step 01 complete:** Final Project Requirement & Scope Lock.  
**Step 02 complete:** Final Technology Stack & Architecture Decisions.  
**Step 03 complete:** Complete System Architecture.  
**Step 04 complete:** User Roles & Permission Matrix.  
**Step 05 complete:** Information Architecture & Complete Page/Route Map.  
**Step 06 complete:** Team Development & Git Strategy.  
**Step 07 complete:** Initialize Full Project Repository (npm workspaces).  
**Step 08 complete:** Configure Next.js Frontend Foundation.  
**Step 09 complete:** Configure Express Backend Foundation.  
**Step 10 complete:** Environment Variables & Secret Management.  
**Step 11 complete:** MongoDB Atlas Complete Setup.  
**Step 12 complete:** Core MongoDB Schema Foundation.
**Step 13 complete:** Complete INFRAOS Database Models.
**Step 14 complete:** Database Indexes, GeoJSON & Constraints.
**Step 15 complete:** Seed & Demo Data Architecture.

**Step 16 complete:** Shared Types, Constants & API Contracts.

Design: [design-tokens.md](docs/design/design-tokens.md), [component-library.md](docs/design/component-library.md), [forms-and-validation.md](docs/design/forms-and-validation.md). Next: **Step 21** after Step 20 is merged.

This is a university group project at **South Eastern University of Sri Lanka**.

## Architecture

```text
Next.js (Vercel)
        ↓
Express + TypeScript (Render)
        ↓
Business modules
        ↓
MongoDB Atlas + Cloudflare R2 + OSM tiles
        ↓
FastAPI AI (Render) → LLM adapter + Qdrant
```

Maps: **MapLibre GL** (not Mapbox/Leaflet as the V1 default).  
Auth: short-lived JWT in memory + HTTP-only refresh cookie.  
AI is optional for the P0 coordination path.

## Repository structure

```text
apps/web              Next.js frontend (Step 8)
apps/api              Express API (Step 9)
apps/ai-service       FastAPI (docs only for now)
packages/shared-types Shared TypeScript contracts
docs/                 Planning, architecture, security, UX, team
```

Details: [docs/architecture/repository-structure.md](./docs/architecture/repository-structure.md).

## Core P0 story

```text
Create Project → Map Project → Create Work Request
→ Detect Conflict → Coordinate Agency → Resolve Conflict
→ Track Progress → View on Map → Audit History
```

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | **22 LTS** (`.nvmrc`) |
| npm | **10+** (workspaces; do not add Yarn/pnpm lockfiles) |
| Git | 2.x |
| Python | 3.12 later (AI service) |

## Setup

```powershell
git clone https://github.com/divejikan-yuvarajah/InfraOS.git
cd InfraOS
npm install
```

Copy per-app examples — not a root `.env` with secrets:

```powershell
Copy-Item apps\web\.env.example apps\web\.env.local
Copy-Item apps\api\.env.example apps\api\.env
```

Catalog: [docs/setup/environment.md](./docs/setup/environment.md). **Never commit secrets.** Do not use `JWT_SECRET` / `CLIENT_URL`.

Frontend (terminal 1):

```powershell
npm run dev:web
```

API (terminal 2):

```powershell
npm run dev:api
```

Web: http://localhost:3000 · API health: http://localhost:4000/api/v1/health

## Documentation

**Product:** [docs/planning/README.md](./docs/planning/README.md)  
**Technology / ADRs:** [docs/architecture/README.md](./docs/architecture/README.md) · [docs/adr/README.md](./docs/adr/README.md)  
**Authorization:** [docs/security/README.md](./docs/security/README.md)  
**UX / routes:** [docs/ux/README.md](./docs/ux/README.md)  
**Environment:** [docs/setup/environment.md](./docs/setup/environment.md)  
**MongoDB Atlas:** [docs/setup/mongodb-atlas.md](./docs/setup/mongodb-atlas.md) · [docs/database/connection.md](./docs/database/connection.md)  
**Frontend:** [docs/frontend/setup.md](./docs/frontend/setup.md) · [docs/frontend/conventions.md](./docs/frontend/conventions.md)  
**Backend:** [docs/backend/setup.md](./docs/backend/setup.md) · [docs/backend/conventions.md](./docs/backend/conventions.md)  
**Team / Git:** [CONTRIBUTING.md](./CONTRIBUTING.md) · [docs/team/README.md](./docs/team/README.md)  
**Docs index:** [docs/README.md](./docs/README.md)

## Branch strategy

- `main` — submission-ready  
- `development` — daily integration (create from `main` before the first feature branch)  
- `feature/*` `fix/*` `chore/*` `docs/*` — work branches; squash-merge into `development`  
- Never force-push `main` or `development`

See [docs/team/git-workflow.md](./docs/team/git-workflow.md).

## Team

**INFRAOS Development Team**  
South Eastern University of Sri Lanka

## Prompts

Implementation prompts for later steps live in `/Prompts`.

## License / academic use

Use and extend as an academic and portfolio project. Do not present demo data as official government datasets.
