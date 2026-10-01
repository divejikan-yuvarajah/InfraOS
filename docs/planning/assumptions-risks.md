# INFRAOS Assumptions, Open Questions, and Risks

**Document:** `/docs/planning/assumptions-risks.md`  
**Step:** 01 — Final Project Requirement & Scope Lock  
**Status:** Living register — update when decisions land in later steps

This file separates **locked product intent** from **things we must not pretend we already know**.

---

## 1. Confirmed requirements

These are locked by Step 1 and the provided INFRAOS prompts:

| ID | Confirmed |
|----|-----------|
| C-001 | Product name, vision, and lifecycle Plan → Coordinate → Approve → Build → Verify → Monitor → Complete → Maintain |
| C-002 | INFRAOS is a coordination-first infrastructure platform, not generic CRUD/ERP |
| C-003 | Target architecture direction: Next.js → Express → modules → MongoDB; FastAPI only for genuine AI |
| C-004 | Modular monolith + one AI service; no Kafka/Kubernetes/microservices for V1 |
| C-005 | Modules and names in [project-scope.md](./project-scope.md) are locked |
| C-006 | Roles: Super Admin, Ministry/Gov Admin, Agency Officer, Project Manager, Contractor, Inspector, Citizen |
| C-007 | Team leader owns ProjectTrace, RoadSync, and core platform integration |
| C-008 | P0 spine: create/map project, work request, detect conflict, coordinate, resolve, track progress, map, audit |
| C-009 | AI is decision support; core path works without it |
| C-010 | Server-side RBAC + resource authorization; no frontend-only security |
| C-011 | GeoJSON + spatial awareness is mandatory for RoadSync/InfraMap |
| C-012 | Audit logs are not editable by normal users |
| C-013 | Version 1 is a 45–60 day university/portfolio/production-style delivery, not a live national system-of-record |
| C-014 | Later prompts lock a **Sri Lankan** government/infrastructure orientation |
| C-015 | No application feature code in Steps 1–3 |
| C-016 | Step 2 technology lock: Next.js App Router, Express+TS, MongoDB Atlas+Mongoose, MapLibre, JWT+refresh cookie, FastAPI AI, Qdrant, Cloudflare R2, Vercel+Render (see `/docs/architecture` and `/docs/adr`) |
| C-017 | Step 3 system architecture blueprint locked: module boundaries, page map, RoadSync/ProjectTrace/InfraMap/RAG/authz flows, team ownership |
| C-018 | Step 4 RBAC: seven roles, `resource.action` catalog, org/agency/assignment scopes, SoD (submit≠approve; contractor never verifies/pays), admin-provisioned staff, no impersonation |

---

## 2. Assumptions

Used so architecture can proceed. Challenge them in later steps if evidence appears.

| ID | Assumption | Why it is safe enough |
|----|------------|------------------------|
| A-001 | Official live utility GIS feeds will **not** be available for V1 | We will use demo GeoJSON and seed agencies |
| A-002 | English UI is acceptable for V1 | Academic/portfolio audience; languages are P2/open |
| A-003 | One MongoDB cluster is the system of record | Matches locked stack; PostGIS is a future revisit |
| A-004 | Demo users and passwords in a seed script are acceptable for evaluation, not production | Must never commit production secrets |
| A-005 | OpenStreetMap-compatible tiles are acceptable for maps | Locked MapLibre + OSM in ADR-009 |
| A-006 | Email delivery may be delayed to P1/P2; in-app status is enough for P0 | Core story does not need SMTP |
| A-007 | “National” means Sri Lanka-style public works, not multi-country | Aligns with Steps 4–12 locked context |
| A-008 | Six team members can own modules in parallel if API/auth/DB standards are shared | Stated in prompts |
| A-009 | Citizens can report issues with a tracking id; a full citizen identity provider is not P0 | P1 portal |
| A-010 | Conflict severity rules will be a documented deterministic table in a later RoadSync step | Step 1 only requires that rules exist and are server-side |
| A-011 | ~~Storage vendor in Step 2~~ **Closed:** Cloudflare R2 (S3 API); local disk/MinIO in dev ([ADR-010](../adr/ADR-010-file-storage-provider.md)) | — |
| A-012 | ~~Vector store in Step 2~~ **Closed:** Qdrant only ([ADR-011](../adr/ADR-011-rag-vector-store.md)) | — |
| A-013 | ~~Cookie/CORS design in Step 2/3~~ **Closed for V1 topology:** Vercel + Render are cross-site; refresh cookie `SameSite=None; Secure; HttpOnly` + CORS/Origin allowlist ([security-decisions.md](../architecture/security-decisions.md)). Custom domains remain a future simplification. | — |

---

## 3. Open questions

These need answers in later steps or from the team leader. They do **not** block Step 1 documentation.

| ID | Question | Suggested owner | Target step |
|----|----------|-----------------|-------------|
| Q-001 | ~~Staff signup?~~ **Closed:** staff are **admin-provisioned**; no public staff `/register`. | — | Done Step 4 |
| Q-002 | Is email verification mandatory before any staff login? (Mechanism is P1; **P0 demo seeded staff may log in unverified**.) | Team leader | Identity implementation |
| Q-003 | Which conflicts are **blocking** vs informational? | Team leader + RoadSync | RoadSync rules step |
| Q-004 | Are inspections mandatory before COMPLETED for all projects or only flagged projects? | Team leader | Inspection + ProjectTrace |
| Q-005 | Citizen auth: anonymous + tracking secret vs mandatory account? | Citizen module owner | Citizen implementation |
| Q-006 | ~~Cookie SameSite strategy?~~ **Closed (V1):** cross-origin Vercel→Render, `SameSite=None` + Origin allowlist. Custom first-party domains still optional later. | — | Done Step 2 |
| Q-007 | Official agency names in seed data vs generic “Road Authority A”? | Whole team | Seed/demo step |
| Q-008 | Will supervisors require Sinhala/Tamil in V1? | Team leader | P2 unless mandated |
| Q-009 | Budget currency display (LKR) and decimal rules? | Finance owner | Finance schema |
| Q-010 | How many demo cities/corridors? | Team leader | Seed data |
| Q-011 | ~~Super Admin impersonation?~~ **Closed:** **No.** | — | Done Step 4 |

---

## 4. Decisions needed later (explicitly not made in Step 1)

| ID | Decision | Why not now |
|----|----------|-------------|
| D-001 | ~~Vendors/versions~~ **Closed:** majors in [technology-stack.md](../architecture/technology-stack.md); patch versions at scaffold (Step 7+) | — |
| D-002 | ~~RBAC matrix~~ **Closed:** [../security/README.md](../security/README.md) | — |
| D-003 | Full page/route map and navigation IA | Initial routes locked in [frontend-architecture.md](../architecture/frontend-architecture.md). **Step 5** still refines IA, nav copy, and any path adjustments. |
| D-004 | Git branching and team workflow | Step 6 |
| D-005 | Mongoose schemas and indexes | Later database steps |
| D-006 | OpenAPI path list | Later API steps |
| D-007 | Visual design tokens (see inconsistency INC-001) | Design system / Step 5–8 |
| D-008 | Precise conflict distance thresholds (meters) and work-type severity matrix | RoadSync implementation step |
| D-009 | ~~Work request without project?~~ **Closed:** every work request **requires** `projectId` in V1 ([roadsync-architecture.md](../architecture/roadsync-architecture.md)). | — |
| D-010 | ~~Argon2id vs bcrypt~~ **Closed for V1:** bcryptjs cost 12 (Windows-portable). Revisit Argon2id per ADR-006. | — |

---

## 5. Documented inconsistencies (do not silently pick)

Step 1 instruction: if existing files disagree, **document** rather than hide a choice.

### INC-001 — Color tokens

| Source | Colors |
|--------|--------|
| Step execution wrapper (UI quality section) | Deep Navy `#0F172A`, Orange `#F97316`, Secondary Blue `#2563EB`, plus semantic green/amber/red/cyan |
| Prompts Steps 4–9 locked brand | Sri Lankan flag-inspired `#FF5B00`, `#FEB600`, `#8C1F28`, `#279541` with neutrals |

**Step 1 decision:** Do **not** lock a design-token system in product scope. Brand intent is **professional, government, GIS, Sri Lanka-oriented**. Token resolution belongs to the information-architecture / frontend foundation steps. Until then, implementers must not invent a third palette.

### INC-002 — Geographic naming

| Source | Language |
|--------|----------|
| Step 1 original prompt | “National” platform, no country name |
| Prompts Steps 4–12 | Explicitly Sri Lankan government/infrastructure-oriented |

**Step 1 decision:** Lock **Sri Lankan public-infrastructure orientation** for Version 1, while keeping the product title unchanged. Do not claim a live Government of Sri Lanka deployment.

### INC-003 — Repository state vs architecture intent

| Source | State |
|--------|--------|
| Intended architecture | Next.js, Express, MongoDB, etc. |
| After Step 1 | Planning docs + Prompts; no `package.json` |
| After user push | GitHub remote `main` exists; still no application scaffold |

**Step 1 decision (updated Step 2):** Still **no application feature code** until later steps. Git exists; full workspace init remains Step 7. Do not treat missing `package.json` as a conflict with the locked stack.

### INC-004 — Wrapper vs Step 1 “no application code”

The user execution wrapper asks for pages, APIs, and tests “where applicable.” The Step 1 prompt **forbids application feature code**.

**Step 1 decision:** Follow the Step 1 prompt. Deliverables are documentation only. Lint/type-check/build/tests are **not available** because no app exists.

---

## 6. Edge-case inventory (planning)

These must be handled in later implementation. They are logged now so they are not forgotten.

| Edge case | Expected direction |
|-----------|-------------------|
| Duplicate project code | Reject with validation error |
| Invalid coordinates / empty geometry | Reject on write |
| Start date after end date | Reject |
| Overlapping but weakly related geometries | Still candidate; severity rules apply |
| Project deleted/cancelled while referenced | Safe read; block new work; close or invalidate conflicts |
| Unauthorized agency access / IDOR | 403 |
| Expired session | 401; re-login |
| Duplicate coordination request | Idempotent reuse |
| Simultaneous status updates | Reject stale transition |
| File upload failure | No orphan “success” metadata without object, or compensating delete |
| AI API unavailable | Fallback; P0 continues |
| Map tiles unavailable | Error + retry; writes still validated |
| Database unavailable | Fail closed 503 |
| Empty lists | Empty state copy + action |
| Very large result set | Pagination / query bounds |
| Invalid ObjectId | 400 |
| Archived/deactivated user | No API access |
| Contractor removed from project | Immediate 403 on project APIs |
| Unexpected edit of COMPLETED project | Block casual edit; audit any admin correction |
| Malicious file upload | MIME/size/extension reject |
| Prompt injection via document RAG | Isolation + untrusted document content; no tool authority |

---

## 7. Risks

| ID | Risk | Impact | Mitigation |
|----|------|--------|------------|
| R-001 | Team builds P1 AI/RAG before RoadSync P0 | Core differentiator missing | Priority gate in [mvp-priorities.md](./mvp-priorities.md) |
| R-002 | Modules become mini-apps with separate auth | Integration failure | Team leader owns identity/API standards |
| R-003 | No real GIS data looks “fake” | Academic credibility | Honest demo data + clear README disclaimer |
| R-004 | Cookie auth across two hosts is misconfigured | Broken login in production | Locked: `SameSite=None` + CORS/Origin allowlist; verify in identity implementation |
| R-005 | Spatial queries slow or wrong | Conflict engine untrusted | 2dsphere indexes, viewport limits, tests with fixtures |
| R-006 | AI treated as authority | Unsafe/unethical decisions | BR-AI-* rules |
| R-007 | Scope creep (ERP, IoT, digital twin) | Missed deadline | Scope-creep section in project-scope |
| R-008 | Color/brand conflict causes UI churn | Rework | Resolve INC-001 in design step, once |
| R-009 | Full monorepo not scaffolded yet | Easy to start coding in the wrong layout | Wait for Step 7; stack is documented only |
| R-010 | Over-detailed FRs too early | Docs diverge from code | Keep FRs implementation-relevant; refine in later steps |
| R-011 | Citizen PII in public APIs | Privacy incident | Public DTO allowlists |
| R-012 | File storage keys leaked | Confidential document exposure | Authz on every download |
| R-013 | Render free-tier cold starts | Slow first API/AI request in demos | Uptime pings; explain in demo script |

---

## 8. Out-of-scope claims we will not make

- We have live RDA/NWSDB/CEB system integration.
- We can detect all real-world conflicts nationwide.
- The model is legally liable for approvals.
- Photo AI proves fraud.
- Version 1 is production-hardened for millions of citizens.

---

## 9. Related documents

- [project-scope.md](./project-scope.md)
- [requirements.md](./requirements.md)
- [mvp-priorities.md](./mvp-priorities.md)
- [business-rules.md](./business-rules.md)
- [user-workflows.md](./user-workflows.md)
- [../architecture/README.md](../architecture/README.md)
- [../adr/README.md](../adr/README.md)
