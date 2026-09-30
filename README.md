# INFRAOS

**National Infrastructure Intelligence & Coordination Platform**  
Vision: *The Operating System for National Infrastructure*

INFRAOS helps government agencies **plan, coordinate, approve, build, verify, monitor, complete, and maintain** public infrastructure work — with geographic and schedule awareness so agencies do not silently excavate each other’s newly completed roads.

Version 1 is a **Sri Lankan public-infrastructure oriented** university / portfolio / production-style platform. It uses **demo and seed data**. It is not a live national government system-of-record.

> Connect Infrastructure. Coordinate Agencies. Build Smarter.

## Current status

**Step 01 complete:** Final Project Requirement & Scope Lock (documentation only).

No application has been scaffolded yet. Technology ADRs start in Step 2.

This is a university group project at **South Eastern University of Sri Lanka**.

## Planning source of truth

Start here:

- [docs/planning/README.md](./docs/planning/README.md)
- [docs/planning/project-scope.md](./docs/planning/project-scope.md)
- [docs/planning/requirements.md](./docs/planning/requirements.md)
- [docs/planning/mvp-priorities.md](./docs/planning/mvp-priorities.md)
- [docs/planning/user-workflows.md](./docs/planning/user-workflows.md)
- [docs/planning/business-rules.md](./docs/planning/business-rules.md)
- [docs/planning/assumptions-risks.md](./docs/planning/assumptions-risks.md)

## Intended architecture (not implemented in this step)

```text
Next.js + TypeScript
        ↓
Node.js + Express + TypeScript
        ↓
Business Modules
        ↓
MongoDB Atlas
```

AI (when required): Express authorizes requests, then a FastAPI service performs risk / RAG / related workloads. Core coordination must work if AI is down.

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
