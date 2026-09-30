# INFRAOS Project Scope

**Document:** `/docs/planning/project-scope.md`  
**Step:** 01 — Final Project Requirement & Scope Lock  
**Status:** Locked for architecture (Steps 2–6)  
**Audience:** Team leader, module owners, academic supervisors, later Cursor implementation steps

---

## 1. Project name

**INFRAOS — National Infrastructure Intelligence & Coordination Platform**

INFRAOS is oriented to **Sri Lankan public infrastructure coordination**. The product language is national, but Version 1 is a realistic government-style platform for Sri Lanka, not a generic global ERP.

---

## 2. Vision

**The Operating System for National Infrastructure**

INFRAOS is the shared operational layer that lets ministries, agencies, contractors, inspectors, and citizens work from the same geographically aware picture of public infrastructure: what is planned, what is colliding, what is being built, what was verified, and what must be maintained after handover.

---

## 3. Core lifecycle

```text
Plan → Coordinate → Approve → Build → Verify → Monitor → Complete → Maintain
```

INFRAOS is not finished when a project is marked complete. Completion is a handover into the asset register so maintenance, inspections, and citizen issues continue against the physical infrastructure, not against a dead project record.

---

## 4. What INFRAOS is

INFRAOS is a centralized web platform that helps government agencies **plan, coordinate, approve, build, verify, monitor, complete, and maintain** public infrastructure work.

It connects and understands relationships between:

- infrastructure projects
- government agencies and ministries
- roads, water, electricity, telecom, and drainage work
- geographic locations (points, lines, polygons)
- project schedules and milestones
- contractors and budgets
- project documents
- inspections and verification evidence
- project risks
- completed infrastructure assets
- citizen-reported infrastructure issues

It is **not** a basic CRUD app, a generic project-management tool, or a national ERP.

---

## 5. The real-world problem

Public infrastructure is delivered by **separate agencies with separate plans**. Each agency can be locally competent and still create national waste:

- a road is resurfaced, then excavated weeks later for a water main
- electricity and telecom ducts are not sequenced with drainage work
- contractors report progress that nobody independently verifies
- budgets and physical progress drift apart
- documents live in email and shared drives
- risks are noticed after delay has already happened
- completed assets disappear from operational attention
- citizens cannot see what is happening on their road, or report issues into the same system that owns the asset

The central failure is **coordination**, not a lack of individual project trackers.

### Why coordination is the central problem

A road authority can schedule resurfacing correctly. A water authority can schedule a pipeline correctly. Both plans can be valid in isolation and still destroy public value when they occupy the **same geometry in overlapping time**.

INFRAOS exists to make that collision visible **before** approval and construction, then to force an auditable coordination decision.

### Why location and schedule awareness matter

Infrastructure work is physical. Conflict is not only “two projects exist.” Conflict is:

- they occupy related space (same road segment, nearby trench, intersecting corridor)
- they occupy overlapping or unsafe sequential time windows
- they affect other agencies’ assets or traffic

Without GeoJSON location + planned dates, INFRAOS would be another task list.

### How INFRAOS differs from normal project-management software

| Typical PM tool | INFRAOS |
|-----------------|--------|
| Tasks, boards, Gantt | Infrastructure lifecycle with spatial intelligence |
| Team-scoped projects | Agency-scoped public works with resource-level authorization |
| Optional attachments | Governed documents, audit, inspections |
| Status is a label | Status is a controlled state machine with approvals |
| No notion of nearby work | Nearby-work and schedule-overlap detection |
| Ends at “done” | Converts completed work into maintained assets |
| Internal only | Public transparency and citizen issue intake |

### Why the system continues after completion

A completed road is still a road. If INFRAOS forgets it, the next excavation conflict returns. Asset lifecycle, condition, maintenance, and citizen issues keep the national picture continuous.

---

## 6. Practical problem example

```text
A road authority plans resurfacing work on a urban corridor.
A water authority has a pipeline replacement on the same road.
The projects are planned in separate systems.
The road is resurfaced first.
The water authority later excavates the newly completed surface.
Public money is wasted. Traffic is disrupted twice. Trust falls.
```

INFRAOS should reduce this by:

1. Requiring mapped geometry and planned dates on the work request.
2. Detecting nearby / intersecting work and date overlap.
3. Identifying affected agencies.
4. Opening a coordination request instead of silent parallel approval.
5. Recording the resolution (reschedule, sequence underground work first, accept residual risk with authority).
6. Auditing who decided what, when.
7. After completion, retaining the corridor as an asset so the next plan still “sees” it.

INFRAOS does **not** automatically cancel another agency’s project. It provides detection, workflow, and decision support. Authorized humans resolve the conflict.

---

## 7. Target users

Detailed endpoint permissions belong to Step 4. This section locks **roles, goals, and high-level access boundaries**.

### 7.1 Super Administrator

| Aspect | Definition |
|--------|------------|
| Primary responsibility | Platform integrity: users, roles, agencies, system configuration, audit access |
| Main goals | Keep the platform operable, correctly scoped, and governable |
| Data needed | All platform administration data; audit logs; agency and role catalogues |
| Actions | Create/disable users, assign roles and agencies, inspect audit logs, manage system settings |
| Must not access as a substitute for operations | Super Admin is not a substitute project manager. They should not routinely approve construction, payments, or inspections as a convenience path |
| Relationship | Supports every role. Must not collapse RBAC by using super-admin for daily project work |

### 7.2 Ministry / Government Administrator

| Aspect | Definition |
|--------|------------|
| Primary responsibility | Oversight across agencies in their organizational scope |
| Main goals | See portfolio health, approve high-level items in scope, reduce cross-agency deadlock |
| Data needed | Projects, conflicts, budgets summaries, contractor performance, reports in their ministry/agency scope |
| Actions | Review/approve within policy, assign agency officers, consume reports, escalate unresolved conflicts |
| Must not access | Other ministries’ restricted projects, confidential documents outside scope, citizen private contact data beyond operational need |
| Relationship | Directs agency officers; does not replace inspectors or contractors |

### 7.3 Agency Officer

| Aspect | Definition |
|--------|------------|
| Primary responsibility | Represent one agency’s infrastructure work and respond to coordination |
| Main goals | Register work, respond to conflicts, keep agency projects accurate |
| Data needed | Own-agency projects and work requests; conflicts that affect the agency; assigned citizen issues |
| Actions | Create/edit agency projects and work requests; respond to coordination; update issue handling |
| Must not access | Other agencies’ confidential documents, unrelated project finances, platform-wide user administration |
| Relationship | Coordinates with other agencies through RoadSync; reports to government admin |

### 7.4 Project Manager

| Aspect | Definition |
|--------|------------|
| Primary responsibility | Deliver an assigned project through the lifecycle |
| Main goals | Plan, track milestones, progress, documents, and coordination for assigned projects |
| Data needed | Assigned project records, milestones, documents they are permitted to see, inspections, risks |
| Actions | Create/update assigned project data, submit for approval, update progress, request inspections, upload documents |
| Must not access | Unassigned projects by default; payment approval beyond assigned financial-entry rights; other agencies’ restricted records |
| Relationship | Works with contractor and inspector; cannot self-approve inspection of own reported progress where rules forbid it |

### 7.5 Contractor

| Aspect | Definition |
|--------|------------|
| Primary responsibility | Execute assigned construction/maintenance work and report progress |
| Main goals | Update assigned progress, upload site evidence they are allowed to submit, see schedule and instructions |
| Data needed | Assigned project subset: scope, milestones, their progress entries, relevant public/contract documents they are granted |
| Actions | Submit progress, respond to inspection findings on assigned work |
| Must not access | Other contractors’ commercial data, government-only documents, approval of own work, citizen reporter identities beyond need |
| Relationship | Reports to project manager; is verified by inspector |

### 7.6 Inspector

| Aspect | Definition |
|--------|------------|
| Primary responsibility | Independently verify reported physical progress and site conditions |
| Main goals | Inspect, evidence, approve/reject/request revision of progress claims |
| Data needed | Assigned inspection packages, project location, reported progress, previous inspection history |
| Actions | Schedule/complete inspections, upload evidence, record findings |
| Must not access | Contractor payment approval, unrelated projects, ability to silently edit original contractor progress as if it were inspection |
| Relationship | Independent of the contractor; findings feed ProjectTrace and audit |

### 7.7 Citizen

| Aspect | Definition |
|--------|------------|
| Primary responsibility | View public infrastructure information and report issues |
| Main goals | Understand nearby public works; report potholes, flooding, damaged assets; track their report |
| Data needed | Public project summaries, public map, own issue tickets |
| Actions | Browse public pages, submit issues with location/photo, track issue status |
| Must not access | Internal documents, budgets, contractor commercial data, non-public conflicts, other citizens’ personal data, staff accounts |
| Relationship | No operational authority. Issues are assigned to agencies |

### High-level access boundary (not the Step 4 matrix)

```text
Citizen     → public surface only
Contractor  → assigned project operational subset
Inspector   → assigned verification subset
Project Manager → assigned project operational set
Agency Officer → own agency set + conflicts affecting the agency
Gov Admin   → organizational scope
Super Admin → platform administration (not a daily bypass of operational approvals)
```

The **server** is the authority. Frontend role labels are UX only.

---

## 8. Stakeholders and value

| Stakeholder | Value INFRAOS provides |
|-------------|------------------------|
| Ministries | Cross-agency visibility, portfolio reporting, fewer politically visible coordination failures |
| Road authorities (e.g. RDA / provincial roads) | Conflict-aware scheduling; protection of newly completed surfaces |
| Water authorities (e.g. NWSDB) | Ability to sequence underground work before surfacing; shared map of planned trenches |
| Electricity providers (e.g. CEB / LECO) | Visibility of road openings and overlapping corridors |
| Telecom providers | Coordination of duct/cable work with civil works |
| Drainage / local authorities / municipal councils | Shared schedule for drainage and road programs; citizen issue intake |
| Other infrastructure departments | One coordination channel instead of informal phone/email |
| Contractors | Clear assigned scope, schedule, and progress submission path |
| Inspectors | Structured verification with evidence and history |
| Project managers | Single project record: map, milestones, documents, conflicts, inspections |
| Government administrators | Oversight, audit, and approval without spreadsheet archaeology |
| Citizens | Transparency and a tracked reporting path |

Version 1 will use **demo/prototype agency and geometry data**. It must not pretend to be the live national GIS of every utility.

---

## 9. Locked modules

Do not rename these modules without a documented architectural reason.

### 9.1 Platform & Identity

Authentication, session management, users, roles, permissions, agency assignment, account status.

### 9.2 ProjectTrace — Project Intelligence

Full infrastructure project lifecycle: create/edit/details, statuses, approvals, milestones, physical progress, financial progress summary, timeline, dependencies, activity history, dashboard, project permissions.

**Team leader ownership.**

### 9.3 RoadSync — Infrastructure Coordination

Work requests, map/location, GeoJSON, planned dates, nearby detection, geographic conflict, schedule overlap, affected-agency detection, classification, severity, coordination requests, agency response, resolution, approvals, history, visualization.

**Team leader ownership.** Core RoadSync must work **without AI**.

### 9.4 InfraMap

Interactive map; layers for active/planned/completed projects, roadwork, utilities where data exists, conflicts, risk, assets; markers; polygons/routes; search; filters; detail drawer; viewport queries.

### 9.5 AI Risk Intelligence

Project risk score, delay/budget/schedule risk, factors, explanations, recommendations, history. **Decision support only.** Never automatic official approval.

### 9.6 DocTrace

Secure upload, categorization, preview, search, text extraction, AI summary, information extraction, RAG Q&A with references.

### 9.7 Finance & Contractor Intelligence

Budget, expenses, payments, financial progress, contractor profile, project history, delay/performance indicators, contractor risk indicators.

### 9.8 Inspection & Verification

Assignment, scheduling, reports, site evidence, photos, comments, physical progress verification, approve/reject/request-review, history.

### 9.9 Asset Lifecycle

Convert completed project to asset; details, location, condition, inspection/maintenance history, schedule, infrastructure health score (health score is P2).

### 9.10 Citizen Infrastructure Portal

Public projects and map, public details, issue reporting (location, photo, category), assignment, status, citizen tracking.

### 9.11 Notifications

Conflict, risk, approval, milestone, inspection, coordination, citizen issue alerts; read/unread; notification center. Realtime only where it adds real value.

### 9.12 Reporting

Project, agency, budget, contractor, status reports; date filters; authorized CSV; useful PDF.

### 9.13 Audit & Governance

Login history; critical CRUD; approvals/rejections; permission changes; old/new values; user; timestamp; resource; resource ID. **Not editable by normal users.**

---

## 10. Winning / differentiating features

These are **not** ordinary CRUD. They are why INFRAOS is not Jira-for-government.

### A. Infrastructure Conflict Simulator — P1

Before approval, evaluate geographic overlap, nearby work, date overlap, affected utilities/agencies, possible road impact. Example:

```text
Conflict Risk: HIGH

Detected:
Water pipeline project — 210m away
Schedule overlap — 12 days

Recommendation:
Coordinate underground utility work before final road resurfacing.
```

Deterministic detection is P0. The richer “simulator” presentation and recommendation packaging is P1.

### B. Smart Coordination Recommendation — P1 (full quality) / P2 (advanced)

Recommend practical options: complete underground work first, reschedule one project, merge compatible windows, request confirmation. **Decision support, not automatic scheduling authority.**

### C. AI Project Risk Intelligence — P1

Score, factors, explanation, recommendation. Platform must remain usable if the model is down.

### D. DocTrace RAG — P1

Authorized questions such as contractual deadline, delay penalty, warranty period, with retrieved references.

### E. Infrastructure Health Score — P2

After completion: age, maintenance, inspections, issues, repairs → maintenance prioritization.

### F. AI Physical Progress Verification — P2

Compare reported vs AI-visible estimate. Recommend human inspector review. **Never auto-label fraud.**

### G. AI Infrastructure Copilot — P2/P3

Natural-language operations over stable search/RAG/data APIs. Build only after those APIs are stable.

---

## 11. Team-leader ownership (must be preserved)

The team leader is **Core Platform Developer and System Integrator**.

| Area | Ownership |
|------|-----------|
| ProjectTrace | Team leader |
| RoadSync | Team leader |
| Core platform integration | Team leader: architecture, DB/API/auth/RBAC/security standards, Git, deployment integration, module integration |

Other members may own InfraMap, AI Risk Intelligence, DocTrace/RAG, Finance/Contractor/Asset, and Citizen Portal. Architecture must support **parallel development without disconnected mini-projects**.

Shared rules:

- one API contract style
- one auth model
- one database
- no second authentication system
- no module-private redesign of project status

---

## 12. Geographic and data honesty

Version 1 is a **Sri Lankan government-style prototype**.

- Do not invent live national utility GIS datasets we do not have.
- Demo GeoJSON, seed agencies, and synthetic projects are acceptable and expected.
- Map tiles should be OpenStreetMap-compatible for the prototype.
- Product copy may use Sri Lankan agency **types** (roads, water, electricity, telecom, drainage, local authority) without claiming official data feeds.

---

## 13. Scope-creep protection

INFRAOS Version 1 **must not**:

- add unrelated government modules (HR, payroll, procurement ERP, tax, customs, health, education)
- become a generic project-management or ERP product
- split into microservices for appearance
- add Kafka, Kubernetes, service mesh, event sourcing, or CQRS for the academic timeline
- build advanced computer vision before core RoadSync works
- build a national digital twin in MVP
- make every notification realtime
- create AI features without a clear operational problem
- let P2/P3 delay P0
- require AI for Create → Conflict → Coordinate → Track → Map → Audit
- allow frontend-only security
- duplicate identity, validation, or API clients per module
- silently rename locked modules
- claim official government data integration that does not exist

---

## 14. Version 1 success definition

INFRAOS Version 1 is successful if an evaluator can:

1. Authenticate as distinct roles.
2. Create and map an infrastructure project.
3. Create a RoadSync work request with geometry and dates.
4. See a detected geographic/schedule conflict.
5. Coordinate another agency and resolve the conflict with an audit trail.
6. Track milestones and physical progress.
7. View the work on InfraMap.
8. Confirm that unauthorized users cannot see or mutate another agency’s restricted records.

AI, RAG, citizen portal, and finance deepen the portfolio but **do not define** whether the core platform exists.

---

## 15. Related documents

- [requirements.md](./requirements.md)
- [mvp-priorities.md](./mvp-priorities.md)
- [user-workflows.md](./user-workflows.md)
- [business-rules.md](./business-rules.md)
- [assumptions-risks.md](./assumptions-risks.md)
