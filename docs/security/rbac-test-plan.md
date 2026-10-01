# INFRAOS RBAC Test Plan

**Document:** `/docs/security/rbac-test-plan.md`  
**Step:** 04  
**Status:** Locked for later Vitest/Supertest/Playwright  
**No tests executed in this step** (no API yet)

Use fixtures: two agencies (Road, Water), one org, distinct users per role, one assigned project, one unassigned project, one confidential document, one public project.

Private denials: expect **401** unauthenticated, **404** for private IDOR, **403** for capability routes, **409** for illegal state/SoD.

---

## 1. Identity and anonymous

| ID | Setup | Action | Expected |
|----|-------|--------|----------|
| T-ANON-01 | No token | GET `/api/v1/projects/:internalId` | 401 `AUTH_REQUIRED` |
| T-ANON-02 | No token | GET public projects | 200 public DTOs only |
| T-ANON-03 | No token | POST issue (valid body) | 201 or 200; rate limit applies |
| T-DIS-01 | DISABLED user valid password | Login | 401 |
| T-DIS-02 | Was ACTIVE, token still valid, now DISABLED | GET protected | 401/403 not 200 |

---

## 2. Citizen and documents

| ID | Setup | Action | Expected |
|----|-------|--------|----------|
| T-CI-01 | Citizen/anon | GET confidential document | 404 |
| T-CI-02 | Citizen | GET audit | 401/403 |
| T-CI-03 | Citizen | GET own issue by tracking | 200 without other PII |
| T-CI-04 | Citizen | GET other citizen issue id | 404 |

---

## 3. Contractor

| ID | Setup | Action | Expected |
|----|-------|--------|----------|
| T-CO-01 | Assigned project | GET project | 200 limited DTO |
| T-CO-02 | Other project id | GET/PATCH | 404 |
| T-CO-03 | Assigned | POST progress | 200/201 |
| T-CO-04 | Assigned | POST payment approve | 403 |
| T-CO-05 | Assigned | POST inspection verify | 403 |
| T-CO-06 | Assigned | POST conflict resolve | 403 |

---

## 4. Inspector

| ID | Setup | Action | Expected |
|----|-------|--------|----------|
| T-IN-01 | Assigned inspection | GET + submit report | 200 |
| T-IN-02 | Other inspection | GET | 404 |
| T-IN-03 | Assigned | POST payment approve | 403 |
| T-IN-04 | Assigned | PATCH contractor progress as if origin | 403 (outcome is separate) |

---

## 5. Project manager

| ID | Setup | Action | Expected |
|----|-------|--------|----------|
| T-PM-01 | Assigned, DRAFT | PATCH project | 200 |
| T-PM-02 | Unrelated restricted | GET/PATCH | 404 |
| T-PM-03 | Assigned SUBMITTED | PATCH core fields | 409 or 403 |
| T-PM-04 | Assigned | POST submit | 200 |
| T-PM-05 | Same user | POST approve own submission | 409 SoD |
| T-PM-06 | Assigned | POST inspection as inspector | 403 |

---

## 6. Agency officer

| ID | Setup | Action | Expected |
|----|-------|--------|----------|
| T-AO-01 | Own agency | POST work request on agency project | 200 |
| T-AO-02 | Other agency project edit | PATCH | 404 |
| T-AO-03 | Conflict affecting agency | POST coordination respond | 200 |
| T-AO-04 | Other agency confidential doc | GET | 404 |

---

## 7. Government admin

| ID | Setup | Action | Expected |
|----|-------|--------|----------|
| T-GA-01 | Org project | POST approve (not self-submitted) | 200 |
| T-GA-02 | Other ministry project | GET | 404 |
| T-GA-03 | Org | POST payment approve (not self-submitted) | 200 |
| T-GA-04 | Org | GET reports | 200 scoped |

---

## 8. Super admin

| ID | Setup | Action | Expected |
|----|-------|--------|----------|
| T-SA-01 | Platform | POST user disable | 200 + audit |
| T-SA-02 | | POST project.approve | 403 |
| T-SA-03 | | POST payment.approve | 403 |
| T-SA-04 | | GET audit | 200 |
| T-SA-05 | | PATCH audit log | 404/403 no such API |
| T-SA-06 | | Impersonate header | ignored / 400 |

---

## 9. State transitions

| ID | Expect |
|----|--------|
| T-ST-01 | COMPLETED casual PATCH → 409 |
| T-ST-02 | Progress 100% does not COMPLETE | 409 if complete called without permission/rules |
| T-ST-03 | CANCELLED new work request → 409 |
| T-ST-04 | OPEN HIGH work APPROVED without resolve → 409 if Q-003 blocking |

---

## 10. Privilege escalation

| ID | Expect |
|----|--------|
| T-PE-01 | PATCH `/users/me` `{ role: SUPER_ADMIN }` → role unchanged |
| T-PE-02 | Body `agencyId` of another agency on create project → ignored; server agency used |
| T-PE-03 | RAG question with another project’s documentId → 404 |

---

## 11. Frontend (when UI exists)

Playwright: contractor URL `/admin` → 403 UI; PM deep-link other project → 404; login DISABLED → error, no dashboard.
