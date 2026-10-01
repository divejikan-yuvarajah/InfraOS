# INFRAOS Module Ownership

**Document:** `/docs/team/module-ownership.md`  
**Step:** 06  
**Status:** Locked (names are placeholders until the team fills GitHub identities)

Product integration rules: [../architecture/team-integration.md](../architecture/team-integration.md).  
Module contracts: [../architecture/module-boundaries.md](../architecture/module-boundaries.md).

Replace placeholder names in the table below when the group assigns people. Do not invent a second ownership model.

---

## 1. Ownership table

| Module | Primary owner | Secondary reviewer | Shared dependencies | Protected shared files (do not casual-edit) | Integration contact |
|--------|---------------|--------------------|---------------------|---------------------------------------------|---------------------|
| Platform / architecture / identity / RBAC / API envelope | Team Leader | Member 2 | Zod envelope, auth middleware, env schema | `middleware/auth*`, `lib/envelope`, `lib/errors`, env schema, CI, deploy config | Team Leader |
| **ProjectTrace** | Team Leader | Member 5 | projects, milestones, status machine | project status fields, `/projects` router registration | Team Leader |
| **RoadSync** | Team Leader | Member 2 | workRequests, conflicts, GeoJSON | conflict status writes, `/work-requests` `/conflicts` `/coordination` | Team Leader |
| **InfraMap** | Member 2 | Team Leader | map DTO helpers, viewport APIs | global layout, design tokens, `/map` registration | Team Leader |
| **AI Risk Intelligence** | Member 3 | Team Leader | riskAssessments, FastAPI client | official project/conflict status, `/ai/risk` | Team Leader |
| **DocTrace + RAG** | Member 4 | Team Leader | documents, R2, Qdrant (server-side) | ACL skip, browser Qdrant, `/documents` `/ai/rag` | Team Leader |
| **Finance + Contractor + Asset** | Member 5 | Team Leader | contractors, projectPayments, assets | payment approval (Gov Admin only), inspection payment approval | Team Leader |
| **Citizen portal + issues** | Member 6 | Team Leader | citizenIssues, public DTOs | confidential document APIs, staff `/register` | Team Leader |
| Notifications / audit / reports / agencies / roles | Team Leader (defines) | All members consume | audit + notification helpers | audit immutability, role catalog | Team Leader |
| Inspections (verify path) | Team Leader | Member 5 | inspections vs payments SoD | contractor must not verify or pay | Team Leader |

**Team size:** six contributors is the planning assumption (A-008). If the real group is smaller, keep the **same modules**; combine rows in this table rather than splitting architecture.

---

## 2. Role of the team leader

The team leader is the **core platform developer and integrator**, not a rewrite bot.

Owns:

- ProjectTrace and RoadSync
- Architecture, shared API rules, database standards
- Auth and RBAC integration
- Shared types and security
- Final merge/integration and deployment coordination
- README and core architecture docs

Reviews specifically: shared architecture, cross-module integration, API consistency, database naming, auth/RBAC, security-sensitive logic, shared types, main navigation, CI, deployment.

Does **not** unnecessarily rewrite another member’s module. Review and guide.

---

## 3. What members must not do in someone else’s module

| Owner | Must not |
|-------|----------|
| Anyone except leader | Fork the API envelope, add a second auth stack, change official project/conflict status from a satellite module |
| Member 2 (map) | Write project or conflict status |
| Member 3 (risk) | Write official status; treat AI as authority |
| Member 4 (docs/RAG) | Call Qdrant from the browser; skip Express ACL |
| Member 5 (finance) | Approve inspections or pay as contractor; skip SoD |
| Member 6 (citizen) | Expose confidential documents on public APIs |

Consume other modules via **service methods or HTTP + shared types**, not foreign Mongoose models.

---

## 4. Documentation ownership

Every major module owner updates related docs in the same PR.

| Owner | Docs they keep current |
|-------|------------------------|
| Team Leader | Core architecture, integration, README, deployment, identity/RBAC, ProjectTrace, RoadSync |
| Member 2 | Map API / GIS notes, InfraMap IA |
| Member 3 | Risk model input/output, AI fallback behavior |
| Member 4 | Document flow, RAG, R2 upload/download |
| Member 5 | Contractor, payment, asset docs |
| Member 6 | Public/citizen pages and issue APIs |

---

## 5. Editable name register

Fill when known. Do not commit personal emails or tokens.

| Placeholder | Real name | GitHub username |
|-------------|-----------|-----------------|
| Team Leader | | |
| Member 2 | | |
| Member 3 | | |
| Member 4 | | |
| Member 5 | | |
| Member 6 | | |
