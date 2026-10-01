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
**Step 05 complete:** Information Architecture & Complete Page/Route Map (documentation only).

No application pages have been scaffolded. Next: Step 6 (team development & Git strategy).

This is a university group project at **South Eastern University of Sri Lanka**.

## Documentation source of truth

**Product:** [docs/planning/README.md](./docs/planning/README.md)  
**Technology / ADRs:** [docs/architecture/README.md](./docs/architecture/README.md) · [docs/adr/README.md](./docs/adr/README.md)  
**Authorization:** [docs/security/README.md](./docs/security/README.md)  
**UX / routes:** [docs/ux/README.md](./docs/ux/README.md)

## Locked architecture (not implemented yet)

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

## Core P0 story

```text
Create Project → Map Project → Create Work Request
→ Detect Conflict → Coordinate Agency → Resolve Conflict
→ Track Progress → View on Map → Audit History
```

## Team

**INFRAOS Development Team**  
South Eastern University of Sri Lanka

## Prompts

Implementation prompts for later steps live in `/Prompts`.

## License / academic use

Use and extend as an academic and portfolio project. Do not present demo data as official government datasets.
