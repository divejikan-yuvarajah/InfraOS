# INFRAOS Permission Catalog

**Document:** `/docs/security/permission-catalog.md`  
**Step:** 04  
**Status:** Locked  
**Format:** `resource.action` — predictable, module-oriented, not hyper-granular

Implementation stores these strings on **roles** (not invented per request). Unknown permission names are rejected.

---

## 1. Naming rules

- Lowercase, dotted: `project.approve`
- Actions: `create` `read` `update` `delete` `submit` `approve` `reject` `verify` `resolve` `assign` `export` `manage` `cancel` `hold` `complete` `recalculate` `process` `ask` `respond`
- `manage` = catalog admin (create/update agency or role), not “do everything in the product”
- No `*.*` wildcard in V1 except Super Admin IAM via explicit list

---

## 2. Catalog

### Platform and identity

| Permission | Meaning |
|------------|---------|
| `profile.read` | Read own profile |
| `profile.update` | Update own safe profile fields (not role) |
| `user.read` | List/get users in scope |
| `user.create` | Provision staff user |
| `user.update` | Change name/agency/status (not self-elevate) |
| `user.disable` | Disable/enable account |
| `agency.read` | Read agency catalog in scope |
| `agency.manage` | Create/update agencies |
| `role.read` | Read role/permission catalog |
| `role.manage` | Change role definitions / assignments |
| `permission.read` | Read permission catalog |
| `permission.manage` | Mutate permission catalog (Super Admin only) |
| `system.read` | Read system settings |
| `system.manage` | Change system settings |
| `audit.read` | Read audit logs in scope |
| `audit.export` | Export audit (P1; Super Admin / Gov Admin org) |

There is **no** `audit.update` / `audit.delete`.

### ProjectTrace

| Permission | Meaning |
|------------|---------|
| `project.create` | Create DRAFT |
| `project.read` | Read project (still scoped) |
| `project.update` | Edit allowed fields |
| `project.delete` | Archive/delete where policy allows (rare) |
| `project.submit` | DRAFT → SUBMITTED |
| `project.approve` | Approve / reject at review |
| `project.hold` | ACTIVE → ON_HOLD / resume |
| `project.cancel` | Cancel |
| `project.complete` | ACTIVE → COMPLETED |
| `project.dashboard.read` | Dashboard aggregates |
| `project.timeline.read` | Timeline/activity |

### Milestones and progress

| Permission | Meaning |
|------------|---------|
| `milestone.create` | Add milestone |
| `milestone.read` | Read milestones |
| `milestone.update` | Edit/transition milestone |
| `milestone.delete` | Remove unused planned milestone |
| `progress.read` | Read reported progress |
| `progress.submit` | Submit/update reported physical progress |

Verification of progress is `inspection.verify`, not `progress.verify`, so contractors cannot share a verify permission.

### RoadSync

| Permission | Meaning |
|------------|---------|
| `roadsync.work_request.create` | Create work request |
| `roadsync.work_request.read` | Read work requests |
| `roadsync.work_request.update` | Edit in editable states |
| `roadsync.work_request.cancel` | Cancel work request |
| `roadsync.conflict.read` | Read conflicts |
| `roadsync.conflict.recalculate` | Re-run detection |
| `roadsync.coordination.create` | Open/send coordination |
| `roadsync.coordination.respond` | Respond as affected agency |
| `roadsync.coordination.read` | History |
| `roadsync.conflict.resolve` | Terminal resolve / accepted risk / invalid |

### InfraMap

| Permission | Meaning |
|------------|---------|
| `map.view.public` | Public layers |
| `map.view.internal` | Staff project/work/conflict layers |
| `map.layer.restricted` | Non-public utility/demo layers, risk overlay |

### AI risk

| Permission | Meaning |
|------------|---------|
| `risk.request` | Run analysis |
| `risk.read` | Read stored assessments |

Must still pass `project.read` on that project.

### DocTrace

| Permission | Meaning |
|------------|---------|
| `document.upload` | Upload metadata + file |
| `document.read` | List/preview metadata |
| `document.download` | Bytes / presign |
| `document.delete` | Privileged delete |
| `document.process` | Trigger extract/index |
| `document.ask` | RAG (ACL = readable docs only) |

### Contractor

| Permission | Meaning |
|------------|---------|
| `contractor.read` | Profile/assignment view |
| `contractor.manage` | Create/update contractor, assign to project |
| `contractor.performance.read` | Indicators |

### Finance

| Permission | Meaning |
|------------|---------|
| `finance.budget.read` | Budget figures |
| `finance.budget.update` | Change budget (audited) |
| `finance.payment.create` | Draft/submit payment |
| `finance.payment.read` | Read payments |
| `finance.payment.update` | Edit pending |
| `finance.payment.approve` | Approve |
| `finance.payment.reject` | Reject |
| `finance.report.export` | CSV/PDF finance |

### Inspection

| Permission | Meaning |
|------------|---------|
| `inspection.assign` | Assign/schedule inspector |
| `inspection.read` | Read inspections |
| `inspection.submit` | Submit report/evidence |
| `inspection.verify` | Approve verification outcome |
| `inspection.reject` | Reject or request revision |

### Assets

| Permission | Meaning |
|------------|---------|
| `asset.read` | Asset register |
| `asset.create` | Convert completed project |
| `asset.update` | Condition/details |
| `maintenance.create` | Maintenance record/schedule |
| `maintenance.update` | Update maintenance |
| `asset.health.read` | Health score (P2) |

### Citizen issues

| Permission | Meaning |
|------------|---------|
| `citizen_issue.create` | Report issue (also anonymous public) |
| `citizen_issue.read` | Read in scope / own |
| `citizen_issue.assign` | Assign agency |
| `citizen_issue.update` | Status/notes |
| `citizen_issue.close` | Resolve/reject/duplicate |

### Notifications

| Permission | Meaning |
|------------|---------|
| `notification.read` | Own inbox |
| `notification.update` | Read/unread |
| `notification.preference.update` | Preferences |

### Reports

| Permission | Meaning |
|------------|---------|
| `report.view` | In-app reports |
| `report.export` | CSV/PDF |

---

## 3. Role → permission sets (logical)

Exact cells are in [permission-matrix.md](./permission-matrix.md). Catalog membership is **not** “all permissions for Super Admin on operations.”
