# INFRAOS Architecture Index

This folder holds:

- **Step 2** — which technologies and why (do not silently change ADRs)
- **Step 3** — how the system is structured (modules, flows, pages, trust, team)
- **Step 4** — authorization matrices live in [../security/](../security/README.md)
- **Step 5** — page/route IA lives in [../ux/](../ux/README.md); this file’s page list stays aligned
- **Step 6** — Git/team workflow lives in [../team/](../team/README.md)
- **Step 7** — workspace layout: [repository-structure.md](./repository-structure.md)
- **Step 8** — Next.js foundation: [../frontend/setup.md](../frontend/setup.md)
- **Step 9** — Express foundation: [../backend/setup.md](../backend/setup.md)
- **Step 10** — env catalog: [../setup/environment.md](../setup/environment.md)
- **Step 11** — MongoDB Atlas: [../setup/mongodb-atlas.md](../setup/mongodb-atlas.md), [../database/connection.md](../database/connection.md)
- **Step 12** — core models: [../database/core-models.md](../database/core-models.md)

Product scope remains in [../planning/](../planning/README.md).

## Step 2 — technology lock

| File | Purpose |
|------|---------|
| [technology-stack.md](./technology-stack.md) | Locked stack |
| [architecture-decisions.md](./architecture-decisions.md) | Style, envelope, validation, tests |
| [dependency-rules.md](./dependency-rules.md) | Package rules |
| [security-decisions.md](./security-decisions.md) | Authn cookies, hashing, HTTP hardening |
| [ai-decisions.md](./ai-decisions.md) | FastAPI / providers / Qdrant |
| [deployment-decisions.md](./deployment-decisions.md) | Vercel, Render, Atlas, R2 |

ADRs: [../adr/README.md](../adr/README.md).

## Step 3 — system blueprint

| File | Purpose |
|------|---------|
| [system-context.md](./system-context.md) | Actors and external systems |
| [system-architecture.md](./system-architecture.md) | High-level structure, data, errors, API groups |
| [frontend-architecture.md](./frontend-architecture.md) | Folders, pages, UI flow |
| [backend-architecture.md](./backend-architecture.md) | Module pattern, request flow |
| [projecttrace-architecture.md](./projecttrace-architecture.md) | Official project lifecycle |
| [module-boundaries.md](./module-boundaries.md) | Ownership rules and quality rules |
| [auth-flow.md](./auth-flow.md) | Login, refresh, logout, reset |
| [authorization-flow.md](./authorization-flow.md) | RBAC + resource pipeline |
| [roadsync-architecture.md](./roadsync-architecture.md) | Work, detect, coordinate, resolve |
| [inframap-architecture.md](./inframap-architecture.md) | Viewport map API |
| [file-document-architecture.md](./file-document-architecture.md) | R2 upload/download |
| [ai-rag-architecture.md](./ai-rag-architecture.md) | RAG and risk flows |
| [notification-audit-architecture.md](./notification-audit-architecture.md) | Notifications vs audit |
| [deployment-architecture.md](./deployment-architecture.md) | Runtime topology |
| [security-trust-boundaries.md](./security-trust-boundaries.md) | Threats and trust |
| [team-integration.md](./team-integration.md) | Who owns which module (product). Git process: [../team/](../team/README.md) |

## Step 7 — workspace

| File | Purpose |
|------|---------|
| [repository-structure.md](./repository-structure.md) | npm workspaces, apps, packages |

## Step 10 — environment

| File | Purpose |
|------|---------|
| [../setup/environment.md](../setup/environment.md) | Canonical env catalog, staged secrets, INC-005 |

## Step 11 — database connection

| File | Purpose |
|------|---------|
| [../setup/mongodb-atlas.md](../setup/mongodb-atlas.md) | Atlas project, user, network |
| [../database/connection.md](../database/connection.md) | Mongoose lifecycle |

## Consistency (Step 3 vs Step 2)

| Topic | Locked value |
|-------|----------------|
| Frontend | Next.js App Router |
| Backend | Express + TypeScript modular monolith |
| Database | MongoDB Atlas + Mongoose + GeoJSON |
| Maps | MapLibre + OSM-compatible tiles |
| AI | FastAPI; Express SoR |
| Storage | Cloudflare R2 |
| Vectors | Qdrant |
| API | REST `/api/v1` |
| Authn | JWT access + refresh cookie |
| Authz | RBAC + resource checks |
| Deploy | Vercel + Render + Atlas |
| RoadSync | Team leader; works without AI |
| Work requests | Always tied to a project (D-009) |

## Document control

| Field | Value |
|-------|--------|
| Steps | 02 lock + 03 blueprint + 07–12 workspace through core identity models |
| Application feature code | Temporary web home + API health/ready; identity schemas only; no auth APIs |
