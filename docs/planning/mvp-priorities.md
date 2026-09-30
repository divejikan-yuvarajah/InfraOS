# INFRAOS MVP and Priority Matrix

**Document:** `/docs/planning/mvp-priorities.md`  
**Step:** 01 — Final Project Requirement & Scope Lock  
**Status:** Locked for architecture (Steps 2–6)

AI strengthens INFRAOS but **must not** be required for the primary platform to operate.

---

## 1. Priority legend

| Priority | Meaning | Rule |
|----------|---------|------|
| **P0 — Critical** | Without this, INFRAOS is not a real product | Must work before P1 polish |
| **P1 — Important** | Expected in the 45–60 day window after P0 is stable | Should be completed |
| **P2 — Enhancement** | After P0 and P1 are stable | Must not delay P0 |
| **P3 — Future** | Out of the initial implementation unless everything higher is done | Do not start early |

---

## 2. P0 — Critical

INFRAOS is considered **functionally real** only when these work together:

| Area | Must include |
|------|----------------|
| Authentication | Login, logout, refresh session, disabled-user rejection |
| Secure sessions | Short-lived access + HTTP-only refresh cookie pattern (locked in Step 2) |
| RBAC | Role permissions enforced on the server |
| Resource authorization | Agency/project scoped access; IDOR protection |
| Users / agencies | Provision users, assign agency, agency types |
| ProjectTrace | CRUD, unique codes, location, lifecycle statuses, approvals |
| Milestones | Create and track |
| Project progress | Physical progress updates with authorization |
| RoadSync | Work requests with GeoJSON and planned dates |
| Nearby-work detection | Spatial query |
| Schedule conflict detection | Date overlap against nearby work |
| Coordination workflow | Request, respond, history |
| Conflict resolution | Authorized close with reason |
| InfraMap | Project, work, and conflict layers; viewport queries |
| Audit | Critical actions, approvals, resolutions; logs not user-editable |

### P0 acceptance story (must be demonstrable)

```text
Create Project
→ Map Project
→ Create Work Request
→ Detect Conflict
→ Coordinate Agency
→ Resolve Conflict
→ Track Project Progress
→ View Project on Map
→ Maintain Audit History
```

Team leader owns **ProjectTrace + RoadSync + platform integration** for this story.

---

## 3. P1 — Important

Complete after P0 is stable. These make the portfolio academically and professionally strong.

| Area | Includes |
|------|----------|
| Infrastructure Conflict Simulator | Packaged severity summary and recommendation presentation before approval |
| Smart coordination recommendations | Practical options as advice |
| AI project risk score | Score, factors, explanation, recommendation, history, fallback |
| DocTrace | Secure upload, categorize, preview, search |
| RAG | Authorized Q&A with references when possible |
| Contractor management | Profiles, assignment, basic performance indicators |
| Inspection | Assign, schedule, report, evidence, verify progress |
| Finance overview | Budget, expenses, payments, financial vs physical summary |
| Notifications | In-app notification center, read/unread |
| Citizen issue reporting | Public projects subset, public map subset, issue intake and tracking |
| Asset conversion | Completed project → asset + basic maintenance records |
| Reporting | Scoped reports and authorized CSV |
| Password reset / email verification | If policy requires them for the demo |

---

## 4. P2 — Enhancement

Implement only after P0 and P1 are stable.

- Dark mode
- Advanced reports and richer PDF packs
- AI image-based physical progress estimation (never auto-fraud)
- Infrastructure health score
- Agency coordination score
- Advanced contractor scoring
- Email notifications
- Advanced GIS heatmaps, clustering, simplification
- Socket.IO realtime alerts for selected events
- AI infrastructure copilot
- OAuth / MFA
- File antivirus scanning
- Sinhala/Tamil UI (if chosen later)
- Advanced dependency/critical-path scheduling

---

## 5. P3 — Future

Do **not** build in the initial 45–60 days unless all higher priorities are done and spare time remains.

- IoT sensors
- Drone analysis
- Satellite analysis
- National digital twin
- Predictive maintenance
- Traffic simulation
- Advanced procurement-fraud network analysis
- Full tender intelligence
- Native mobile apps
- Live official utility GIS integrations
- Multi-country deployments
- Kubernetes / Kafka / service mesh

---

## 6. Explicit MVP boundary

### 6.1 IN MVP (Version 1 core)

Must ship:

- Modular monolith web app (Next.js + Express + MongoDB) as later locked in Step 2
- Identity: users, roles, agencies, sessions, RBAC, resource checks
- ProjectTrace P0 feature set
- RoadSync P0 feature set
- InfraMap P0 layers
- Audit P0
- Professional UI for the core story (loading/empty/error/success)
- Demo/seed data sufficient to show a road vs water conflict in Sri Lanka-style geography
- Documentation that matches implementation as steps proceed

Should ship if timeline allows after P0 (still Version 1, labeled P1):

- Conflict simulator UX
- AI risk (optional runtime)
- DocTrace + RAG
- Inspection
- Finance overview + contractors
- Citizen portal issues
- In-app notifications
- Asset conversion
- Basic reports/CSV

### 6.2 OUT OF MVP

- Automatic government decision making by AI
- Automatic fraud accusations from photos
- Live national datasets we do not possess
- Unrelated government domains (HR, payroll, tax, health, education)
- Generic ERP / accounting suite
- Microservices split
- Realtime on every CRUD page
- Pixel-perfect replica of an official government portal
- Native iOS/Android
- Dark mode as a P0 requirement
- Multi-language as a P0 requirement

### 6.3 FUTURE

Everything in P2 not reached and all of P3.

---

## 7. What “AI optional” means in practice

| If this is down | User can still |
|-----------------|----------------|
| FastAPI / model provider | Create projects, detect conflicts deterministically, coordinate, track progress, use the map, read audit |
| RAG / embeddings | Download/preview documents they are allowed to see; Q&A shows fallback |
| Socket.IO | Use notification center via REST/polling |
| Map tiles | See list/table workflows; map shows error + retry |

Official status changes never require a model response.

---

## 8. Sequencing rule for later implementation steps

```text
Identity + Agencies
    ↓
ProjectTrace (including map geometry on the project)
    ↓
RoadSync detection + coordination
    ↓
InfraMap layers
    ↓
Audit completeness pass
    ↓
P1 modules in parallel by team ownership
    ↓
P2 only if P0+P1 are stable
```

Do not start computer vision, copilots, or digital twins before RoadSync P0 is demonstrable.

---

## 9. Module priority snapshot

| Module | First meaningful slice | Priority of first slice |
|--------|------------------------|-------------------------|
| Platform & Identity | Auth + RBAC + agencies | P0 |
| ProjectTrace | Lifecycle + milestones + progress | P0 |
| RoadSync | Work + detect + coordinate + resolve | P0 |
| InfraMap | Viewport layers for project/work/conflict | P0 |
| Audit | Critical actions | P0 |
| AI Risk | Score + fallback | P1 |
| DocTrace | Upload + RAG | P1 |
| Finance & Contractors | Budget + assignment | P1 |
| Inspection | Verify progress | P1 |
| Assets | Convert on complete | P1 |
| Citizen Portal | Public + issues | P1 |
| Notifications | In-app | P1 |
| Reporting | Scoped tables + CSV | P1 |

---

## 10. Related documents

- [project-scope.md](./project-scope.md)
- [requirements.md](./requirements.md)
- [user-workflows.md](./user-workflows.md)
