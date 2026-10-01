# INFRAOS Planning Documents

This folder is the **Step 1 source of truth** for INFRAOS product scope, requirements, priorities, workflows, business rules, and risks.

Technology choices are locked in [../architecture/](../architecture/README.md) and [../adr/](../adr/README.md) (Step 2). Authorization is locked in [../security/](../security/README.md) (Step 4). Do not silently change P0–P3 or module names to match a new library.

Do not start application feature implementation until the relevant later step. The npm workspace exists (Step 7). Next.js is Step 8. Express is Step 9. Env catalog: [../setup/environment.md](../setup/environment.md) (Step 10). MongoDB Atlas connection: [../setup/mongodb-atlas.md](../setup/mongodb-atlas.md) (Step 11).

## Documents

| File | Purpose |
|------|---------|
| [project-scope.md](./project-scope.md) | Project definition, problem, users, stakeholders, modules, winning features, ownership, scope-creep protection |
| [requirements.md](./requirements.md) | Functional requirements, non-functional requirements, lifecycle states and transitions |
| [mvp-priorities.md](./mvp-priorities.md) | P0–P3 matrix, MVP in/out/future boundary |
| [user-workflows.md](./user-workflows.md) | Core user journeys and workflow diagrams |
| [business-rules.md](./business-rules.md) | Cross-module rules that later APIs and UI must obey |
| [assumptions-risks.md](./assumptions-risks.md) | Confirmed items, assumptions, open questions, risks, documented inconsistencies |

## How later steps must use this folder

- Step 2+ must not silently change locked scope.
- If a later step needs a change, update these files and record the reason.
- P0 (ProjectTrace + RoadSync + identity + map layers + audit) outranks P1–P3.
- AI is decision support. Core workflows must work if AI is unavailable.

## Document control

| Field | Value |
|-------|--------|
| Project | INFRAOS — National Infrastructure Intelligence & Coordination Platform |
| Step | 01 — Final Project Requirement & Scope Lock |
| Status | Locked for architecture (Steps 2–6) |
| Geographic orientation | Sri Lanka (government / public infrastructure), documented in scope |
| Application code created in this step | None |
