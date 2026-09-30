# INFRAOS Business Rules

**Document:** `/docs/planning/business-rules.md`  
**Step:** 01 — Final Project Requirement & Scope Lock  
**Status:** Locked for architecture (Steps 2–6)

These rules are cross-module. Later APIs, services, and UI must obey them. Endpoint catalogues belong to later steps; **the server always decides**.

---

## 1. Authority and identity

| ID | Rule |
|----|------|
| BR-AUTH-001 | The backend is the security authority. Frontend route guards are UX only. |
| BR-AUTH-002 | Never trust client-supplied role, agencyId, or permission claims for authorization. |
| BR-AUTH-003 | A user with a valid token but `DISABLED` / deactivated status is denied all protected operations. |
| BR-AUTH-004 | Users cannot assign themselves elevated roles or extra agencies. |
| BR-AUTH-005 | Super Admin is for platform administration, not a convenience path to approve construction, inspections, or payments. |
| BR-AUTH-006 | Operational users (Agency Officer, Project Manager, Contractor, Inspector) require a valid agency or assignment context as defined for that role. |
| BR-AUTH-007 | Expired or rotated-away refresh sessions cannot mint new access tokens. |
| BR-AUTH-008 | Logout and password reset invalidate refresh sessions for that user. |

---

## 2. Tenancy and IDOR

| ID | Rule |
|----|------|
| BR-SCOPE-001 | A project manager cannot automatically access every government project. Access requires assignment or agency scope plus permission. |
| BR-SCOPE-002 | Agency officers see their agency’s projects/work and conflicts that **affect** their agency. They do not browse unrelated agencies’ confidential records. |
| BR-SCOPE-003 | Government administrators are organization-scoped (ministry / allowed agencies), not automatically global. |
| BR-SCOPE-004 | Contractors access only assigned project operational subsets. |
| BR-SCOPE-005 | Inspectors access only assigned inspection packages and the project data required to verify them. |
| BR-SCOPE-006 | Citizens access only public-safe project fields and their own issue tickets. |
| BR-SCOPE-007 | Knowing a valid ObjectId is not authorization. Every resource read/write checks actor + resource. |
| BR-SCOPE-008 | List endpoints must filter in the query, not fetch-all-then-hope the UI hides rows. |

---

## 3. Documents and sensitive data

| ID | Rule |
|----|------|
| BR-DOC-001 | Citizens cannot view confidential project documents. |
| BR-DOC-002 | Documents default to confidential unless an explicit public-release flag is set by an authorized role. |
| BR-DOC-003 | File bytes are served only after authentication (except explicitly public assets) and resource authorization. |
| BR-DOC-004 | Storage object keys must not be guessable sequential names. |
| BR-DOC-005 | RAG answers are scoped to documents the user is already allowed to read. Retrieval cannot be used to bypass document ACL. |
| BR-DOC-006 | Audit logs and application logs must not store passwords, tokens, or full document contents. |

---

## 4. Segregation of duties

| ID | Rule |
|----|------|
| BR-SOD-001 | A contractor cannot approve their own work as official verification. |
| BR-SOD-002 | A contractor cannot approve their own payments. |
| BR-SOD-003 | An inspector cannot approve contractor payments. |
| BR-SOD-004 | The user who submits a payment cannot be the sole approver of that payment. |
| BR-SOD-005 | Project managers cannot mark inspection findings as if they were the assigned inspector. |
| BR-SOD-006 | Conflict ACCEPTED_RISK and RESOLVED require an authorized resolver, not the contractor alone. |

---

## 5. ProjectTrace

| ID | Rule |
|----|------|
| BR-PRJ-001 | Project codes are unique. |
| BR-PRJ-002 | A project cannot move to SUBMITTED without required core fields, valid planned dates, and valid map geometry. |
| BR-PRJ-003 | Status transitions must follow the state machine in [requirements.md](./requirements.md). Arbitrary status strings are rejected. |
| BR-PRJ-004 | Physical progress 100% does not complete the project. |
| BR-PRJ-005 | A project cannot be marked COMPLETED if required completion validation fails (including unresolved blocking conflicts if policy marks them blocking, and required verification if an inspection policy is enabled for that project). |
| BR-PRJ-006 | COMPLETED projects are not casually edited. Material edits require a controlled correction path (admin) and audit. |
| BR-PRJ-007 | CANCELLED projects cannot start new work requests. Existing OPEN conflicts must be closed or invalidated as part of cancellation handling. |
| BR-PRJ-008 | Soft-deleted or cancelled projects that remain referenced must not break reads; UIs show a safe “unavailable / cancelled” state. |
| BR-PRJ-009 | Project ownership agency cannot be silently swapped to escape authorization; agency change is an audited admin action. |
| BR-PRJ-010 | Milestone completion does not by itself complete the parent project. |

---

## 6. RoadSync and coordination

| ID | Rule |
|----|------|
| BR-RS-001 | Work requests require valid GeoJSON and planned start ≤ planned end. |
| BR-RS-002 | Core conflict detection is deterministic (spatial + schedule + agency). It must not depend on an LLM. |
| BR-RS-003 | Geographic overlap of unrelated categories may still create a candidate; severity rules decide HIGH vs LOW. Do not auto-discard “unrelated” geometries without a rule. |
| BR-RS-004 | A detected HIGH conflict should block silent APPROVED of the work request until coordination runs or an authorized ACCEPTED_RISK is recorded. |
| BR-RS-005 | Duplicate coordination requests for the same conflict and target agency must be idempotent (reuse, do not spam). |
| BR-RS-006 | Conflict resolution is auditable: actor, timestamp, from-status, to-status, reason, involved records. |
| BR-RS-007 | AI coordination recommendations never execute reschedule automatically. |
| BR-RS-008 | An agency cannot resolve a conflict solely by ignoring it in the UI; a terminal status is required. |
| BR-RS-009 | Nearby detection uses server-side spatial queries, not client-declared “no conflicts.” |

---

## 7. AI

| ID | Rule |
|----|------|
| BR-AI-001 | An AI recommendation never equals automatic official approval. |
| BR-AI-002 | Model output must not directly mutate project, payment, or conflict official status. |
| BR-AI-003 | AI physical progress estimation (P2) must not label fraud. It may recommend human inspection. |
| BR-AI-004 | If AI is unavailable, P0 workflows continue. |
| BR-AI-005 | AI endpoints are authorized in Node first. The FastAPI service does not independently decide user permissions. |
| BR-AI-006 | Prompts include only minimized, authorized project features. |

---

## 8. Assets and completion

| ID | Rule |
|----|------|
| BR-AST-001 | A completed project **can** become an infrastructure asset; conversion is an explicit authorized action (may be prompted at completion). |
| BR-AST-002 | Asset records keep a reference to the source project. |
| BR-AST-003 | Deleting an asset must not erase audit history of the conversion. Prefer status flags over hard delete. |
| BR-AST-004 | Health scores (P2) are advisory and must surface confidence/missing-data, not fake precision. |

---

## 9. Inspections and progress integrity

| ID | Rule |
|----|------|
| BR-INSP-001 | Inspection outcomes are stored separately from contractor-reported progress. |
| BR-INSP-002 | Rejected or revision-requested inspections do not silently overwrite the contractor’s last submitted progress number without a recorded verification outcome. |
| BR-INSP-003 | Only the assigned inspector (or a documented reassignment) can submit that inspection. |

---

## 10. Finance

| ID | Rule |
|----|------|
| BR-FIN-001 | Budget and payment changes are sensitive updates: actor and timestamp required; audit required. |
| BR-FIN-002 | Payments follow the payment state machine; PAID is irreversible without a documented correction/refund process (out of casual UI). |
| BR-FIN-003 | Financial progress is calculated from authorized payment/budget data, not from a client-sent “financialProgress” authority field. |

---

## 11. Citizen issues

| ID | Rule |
|----|------|
| BR-CIT-001 | Public pages never expose internal risk memos, confidential documents, or non-public conflict negotiation notes. |
| BR-CIT-002 | Issue reporters can track **their** issue; they cannot enumerate other citizens’ personal data. |
| BR-CIT-003 | Assignment to an agency is a staff action; citizens cannot self-assign agencies beyond a suggested category mapping. |
| BR-CIT-004 | Public intake is rate-limited and validated (including coordinates). |

---

## 12. Notifications, reports, audit

| ID | Rule |
|----|------|
| BR-NOT-001 | Notification rows in the database are the source of truth. Realtime delivery is optional. |
| BR-NOT-002 | Users can only read their own notifications (Super Admin may have an operational exception for support, audited). |
| BR-RPT-001 | Reports and exports apply the same authorization scope as interactive lists. |
| BR-AUD-001 | Sensitive updates must record actor and timestamp. |
| BR-AUD-002 | Audit logs have no normal-user edit or delete API. |
| BR-AUD-003 | Permission changes are always audited. |

---

## 13. Concurrency, integrity, and failures

| ID | Rule |
|----|------|
| BR-INT-001 | Invalid ObjectIds are 400, not treated as 404-equivalent leaks of existence unless existence is public. Prefer 400 for malformed IDs, 404 for well-formed missing resources the user may know. |
| BR-INT-002 | Concurrent updates to the same conflict/project should not silently last-write-win on status without checking current state (reject stale transition). |
| BR-INT-003 | If the database is unavailable, APIs fail closed with a generic 503; no partial “success” UI. |
| BR-INT-004 | Map tile failure does not authorize bypassing spatial validation on write. Geometry is still validated server-side. |
| BR-INT-005 | Very large result sets are paginated; unbounded exports require extra permission. |

---

## 14. Related documents

- [requirements.md](./requirements.md) — state machines and FRs
- [project-scope.md](./project-scope.md) — roles and modules
- [assumptions-risks.md](./assumptions-risks.md) — items still open
