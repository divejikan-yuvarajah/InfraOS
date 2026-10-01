# INFRAOS Segregation of Duties

**Document:** `/docs/security/segregation-of-duties.md`  
**Step:** 04  
**Status:** Locked  
**Also:** [business-rules.md](../planning/business-rules.md) BR-SOD-*

If a control is **too heavy for the academic MVP**, it is marked **Future**, not pretended.

---

## 1. Hard rules (V1 must enforce)

| ID | Rule |
|----|------|
| SOD-01 | Contractor cannot `inspection.verify` or otherwise officially verify own progress |
| SOD-02 | Contractor cannot `finance.payment.approve` |
| SOD-03 | Inspector cannot `finance.payment.approve` |
| SOD-04 | Payment submitter ≠ payment approver (same user id) |
| SOD-05 | Project **submitter** ≠ project **approver** (same user id) |
| SOD-06 | Project manager cannot submit an inspection as the assigned inspector |
| SOD-07 | Contractor cannot `roadsync.conflict.resolve` |
| SOD-08 | Citizens have no `audit.*`, no confidential `document.*`, no finance |
| SOD-09 | AI / RAG / risk cannot change official status (no permission implies it) |
| SOD-10 | RoadSync recommendations cannot reschedule without a human with `roadsync.work_request.update` or `roadsync.conflict.resolve` |
| SOD-11 | No `audit.update` / `audit.delete` for any application role |
| SOD-12 | Users cannot assign themselves roles or extra agencies (`role.manage` / `user.update` restrictions) |
| SOD-13 | Super Admin does not hold `project.approve`, `inspection.verify`, `finance.payment.approve`, `roadsync.conflict.resolve` |
| SOD-14 | Permission catalog changes: `permission.manage` Super Admin only; always audited |
| SOD-15 | HIGH `ACCEPTED_RISK` requires `roadsync.conflict.resolve` **and** a written reason |

---

## 2. Soft / Future (do not fake in V1)

| Item | V1 | Future |
|------|----|--------|
| Two-person rule on every ministry approval | SOD-05 (submit ≠ approve) only | Dual GA approval |
| Four-eyes on budget above threshold | Single GA approve | Threshold dual approve |
| Inspector rotating assignment | Manual assign | Forced rotation |
| Super Admin break-glass operational approve | Not allowed | Time-limited ticketed break-glass |

---

## 3. Over-permission checklist

Do **not** grant:

- `*.manage` as a substitute for operational permissions
- Contractor `project.approve`
- Inspector `contractor.manage`
- Citizen `map.layer.restricted`
- Any role `audit.delete`

Gov Admin is powerful **inside one organization** — that is intended. It is **not** PLATFORM.

---

## 4. AI cannot bypass

`risk.request` and `document.ask` require existing `project.read` / `document.read`. Model JSON is never mapped to `projects.status` or `conflicts.status`.
