# INFRAOS Authorization Flow

**Document:** `/docs/architecture/authorization-flow.md`  
**Step:** 03  
**Status:** Locked  
**ADR:** [ADR-007](../adr/ADR-007-rbac-resource-authorization.md)  
**Matrix:** Step 4 (not duplicated here)

---

## 1. Server pipeline

```mermaid
flowchart TD
  A[Authenticated?] -->|no| U[401]
  A -->|yes| B[User DISABLED?]
  B -->|yes| U
  B -->|no| C[Role has permission?]
  C -->|no| F[403 or 404]
  C -->|yes| D[Resource in scope?]
  D -->|no| N[404 private / 403 if explicit duty]
  D -->|yes| E[Business rule allowed?]
  E -->|no| X[409 or 403]
  E -->|yes| G[Perform action]
  G --> H[Audit if sensitive]
```

Frontend nav hiding is **not** this pipeline.

---

## 2. Examples

| Case | RBAC | Resource | Result |
|------|------|----------|--------|
| PM edits assigned project | `project.update` | `project.agency` + assignment | Allow |
| PM edits other agency project | maybe permission | fail scope | 404 |
| Contractor updates own progress | `progress.update` | assigned project | Allow |
| Contractor approves inspection | no | — | 403 |
| Inspector verifies, cannot PAID payment | inspect vs finance | — | 403 |
| Citizen GET confidential document | no | — | 404 |
| Gov Admin list | `project.list` | ministry/agency scope in query | Scoped list |
| Super Admin user disable | `user.admin` | platform | Allow; not used to APPROVE roads |

---

## 3. List endpoints

MongoDB filter **includes** `agencyId` / assignment / public flag. Never fetch all then hide.

---

## 4. IDOR

Knowing an ObjectId is not access. Private miss and private forbidden → **404** by default.

Malformed id → **400**.
