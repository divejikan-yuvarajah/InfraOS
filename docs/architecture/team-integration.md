# INFRAOS Team Integration

**Document:** `/docs/architecture/team-integration.md`  
**Step:** 03  
**Status:** Locked  
**Goal:** parallel work without mini-projects or a second auth stack

---

## 1. Ownership

| Who | Owns | API | Database | Must not |
|-----|------|-----|----------|----------|
| **Team leader** | Core architecture, **ProjectTrace**, **RoadSync**, identity integration, API/security standards, Git/deploy integration | `/projects` `/milestones` `/work-requests` `/conflicts` `/coordination` `/auth` standards | projects, milestones, workRequests, conflicts, coordinationRequests, users/sessions **standards** | Let modules fork envelopes |
| **Member 2** | **InfraMap** | `/map` + map UI | none exclusive (reads others) | Write project/conflict status |
| **Member 3** | **AI Risk** | `/ai/risk` + risk UI | riskAssessments | Official status writes |
| **Member 4** | **DocTrace + RAG** | `/documents` `/ai/rag` | documents, documentChunks | Qdrant from browser; skip Express ACL |
| **Member 5** | **Finance + Contractor + Asset** | `/contractors` `/payments` `/assets` | contractors, projectPayments, assets, maintenanceRecords | Inspection payment approval |
| **Member 6** | **Citizen portal + issues** | public pages + `/issues` | citizenIssues | Confidential documents |

**Shared with leader:** notifications, audit, reports, agencies/roles (leader defines; others consume).

---

## 2. Integration rules

1. Consume another module via **service methods or HTTP**, not foreign Mongoose models.
2. Shared types from platform package / Zod — one envelope.
3. Feature flags: AI may 503; UI fallback is mandatory.
4. Do not open PRs that add Nest/Prisma/Jest/axios-as-second-client.
5. Map layer properties must go through public/staff DTO helpers.

---

## 3. Suggested sequence (still Step 7+ to code)

Identity → Agencies → ProjectTrace → RoadSync → InfraMap layers → Audit pass → then P1 modules in parallel.

---

## 4. File collision avoidance

- Leader owns `middleware/auth*`, `lib/envelope`, `lib/errors`
- Member 2 owns `features/map`, `modules/map`
- Member 3 owns `modules/risk`, `features/.../risks`
- Member 4 owns `modules/documents`, FastAPI RAG routes
- Member 5 owns finance/contractor/asset modules
- Member 6 owns `features/citizen`, `modules/issues`, public routes under `app/(public)`

Conflict on `layout.tsx` / design tokens: wait for Step 5/8; until then do not invent a third palette (INC-001).
