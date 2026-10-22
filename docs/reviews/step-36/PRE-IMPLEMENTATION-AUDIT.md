# Step 36 — Pre-implementation audit

**Date:** 2026-10-22  
**Branch created from:** `origin/development` `448fd91`  
**Worktree:** `c:\Users\ASUS\Desktop\InfraOS\InfraOS-step36`  
**Steps.docx:** not in the repository. Scope follows the Step 36 section of `Prompts/INFRAOS_Steps_36_37_Enhanced_Development_Prompt_V2.md`.

## Prerequisites

| Check | Result |
| --- | --- |
| Step 35 on `origin/development` | **PASS** — `1a27743` via PR #50 (`4e7a153`), included in `448fd91` |
| Unique `tokenHash` index | Present in `refresh-session.model.ts`. Not modified in this step |
| Dirty design-system checkout | Left untouched on `feature/infraos-connected-future-ui` |
| Design system merged on `development` | **NOT PRESENT**. No registration UI was added |
| Auth routes | Only `/health` and `/ready` |

## Policy

| ID | Decision |
| --- | --- |
| Q-001 | Closed. Staff are admin-provisioned. No public `/register` |
| Q-005 | Open. Citizen signup is not mounted |
| Q-002 | Open. This step does not decide whether unverified staff may later log in |

## Planned files

- `registration.schema.ts`, `registration.service.ts`, `registration.types.ts`
- `tests/registration.service.test.ts`
- `bcryptjs` dependency (ADR-006). No HTTP route.
