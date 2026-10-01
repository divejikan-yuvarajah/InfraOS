# INFRAOS Roles and Permissions

**Document:** `/docs/security/roles-and-permissions.md`  
**Step:** 04 — User Roles & Permission Matrix  
**Status:** Locked for identity implementation  
**Does not implement:** auth middleware, Mongoose role models, or UI guards

This specification is the authorization source of truth. Product roles in [project-scope.md](../planning/project-scope.md) stay; this file adds **codes, scopes, and enforcement**.

---

## 1. Locked roles

Exactly **seven** staff/public roles. Do not add ERP-style extra roles in V1.

| Code | Display name | Typical count | Default scope |
|------|--------------|---------------|---------------|
| `SUPER_ADMIN` | Super Administrator | Very few | `PLATFORM` (identity/governance) |
| `GOV_ADMIN` | Government / Ministry Administrator | Few per ministry | `ORGANIZATION` |
| `AGENCY_OFFICER` | Agency Officer | Operational staff | `AGENCY` |
| `PROJECT_MANAGER` | Project Manager | Per assigned projects | `ASSIGNED_PROJECT` (+ agency **read**) |
| `CONTRACTOR` | Contractor | External | `ASSIGNED_PROJECT` (narrow fields) |
| `INSPECTOR` | Inspector | Independent | `ASSIGNED_INSPECTION` |
| `CITIZEN` | Citizen | Public | `PUBLIC` + `OWN_RECORD` |

**Anonymous** is not a stored role. Unauthenticated callers get only public routes and rate-limited issue intake.

A user has **one primary role** in V1. Multi-role accounts are out of scope (avoid privilege soup).

---

## 2. Provisioning (closes Q-001)

**Staff accounts are admin-provisioned.** There is no public self-registration for `SUPER_ADMIN` … `INSPECTOR`.

- Super Admin (or an existing Super Admin bootstrap) creates staff users, role, agency/org, and status.
- `/register` for staff is **not** a V1 product path (frontend-architecture listed it as conditional; this step removes it for staff).
- Citizen accounts remain **Q-005** (anonymous tracking vs login). Issue create does not require a staff role.

**Email verification (Q-002):** mechanism is P1. **P0 demo seeded staff may log in without verified email.** Production should require verification before creating new staff if email is the recovery channel. Verification never grants extra permissions.

**Impersonation (Q-011):** **forbidden.** Super Admin cannot “act as” another user.

---

## 3. Three-level authorization

```text
1. Role permission     — does this role have resource.action?
2. Organization/agency/assignment scope — on this tenant?
3. Resource + business state        — this record, this status, this SoD rule?
```

> Role permission says whether an **action type** is allowed.  
> Scope/resource authorization says whether **this user** may perform it on **this resource**.  
> Business-state checks say whether the **lifecycle** allows it now.

Frontend `role` / `permissions[]` / `agencyId` in JSON bodies are **ignored** for authorization.

---

## 4. Scope vocabulary

| Scope | Meaning |
|-------|---------|
| `PLATFORM` | Entire deployment (users, roles, all-agency **reads** where granted) |
| `ORGANIZATION` | One ministry / org unit and its child agencies |
| `AGENCY` | One operational agency |
| `ASSIGNED_PROJECT` | Projects in `projectAssignments` (or equivalent) for this user |
| `ASSIGNED_INSPECTION` | Inspections assigned to this inspector |
| `OWN_RECORD` | Rows this principal created (e.g. own issue, own notifications) |
| `PUBLIC` | Public-safe DTOs only |

### Role → default scope

| Role | Default | Exceptions |
|------|---------|------------|
| Super Admin | PLATFORM for IAM, audit, settings | **No** operational approve/verify/pay/resolve (see SoD) |
| Gov Admin | ORGANIZATION | Not other ministries |
| Agency Officer | AGENCY | Conflicts that **affect** the agency (read/respond) even if origin is another agency |
| Project Manager | ASSIGNED_PROJECT | Agency-level **read** of own-agency projects for coordination context; **write** only assigned |
| Contractor | ASSIGNED_PROJECT | Field subset; no other contractors’ commercial data |
| Inspector | ASSIGNED_INSPECTION | Plus **read** of the linked project’s operational context needed to verify |
| Citizen | PUBLIC + OWN_RECORD | Never internal docs, budgets, audit, staff coordination notes |

---

## 5. Super Admin is rare

Allowed: users, agencies, roles, permissions catalog, system settings, audit **read**, platform health.

**Not** a daily Project Manager. Must **not** use Super Admin to approve roads, verify inspections, or pay contractors ([BR-AUTH-005](../planning/business-rules.md)).

Support **read** of operational records at PLATFORM is allowed so incidents can be diagnosed. Writes that change official delivery status require the correct operational role.

---

## 6. Backend enforcement order

```text
Route
  → Authentication (JWT; then user status DISABLED check)
  → Permission check (role → permission catalog)
  → Scope / resource check (org, agency, assignment, public)
  → Business-state + SoD check
  → Controller / service
  → Audit if sensitive
```

This matches [authorization-flow.md](../architecture/authorization-flow.md). Backend is authoritative.

---

## 7. Frontend role-aware UX

Frontend **may**: hide nav, disable buttons, choose dashboard widgets, using permissions from the **server session payload**.

Frontend **must not** be the security layer.

| Situation | UI |
|-----------|-----|
| Unauthenticated → protected app | Redirect `/login` |
| Authenticated, no capability for `/admin` | **403** page |
| Authenticated, unknown/out-of-scope `project/:id` | **404** (no existence leak) |
| Action denied by state machine | Inline error + 409 from API |

---

## 8. Authorization error codes

Returned inside the standard error envelope. Do not explain which check failed in a way that maps another agency’s private ids.

| Code | HTTP | When |
|------|------|------|
| `AUTH_REQUIRED` | 401 | No/invalid access token |
| `SESSION_EXPIRED` | 401 | Access expired; refresh failed |
| `FORBIDDEN` | 403 | Known capability the role never has (e.g. admin console) |
| `INSUFFICIENT_PERMISSION` | 403 | Role lacks `resource.action` |
| `RESOURCE_SCOPE_DENIED` | 404 | Private resource, wrong tenant/assignment (preferred vs 403) |
| `RESOURCE_NOT_ASSIGNED` | 404 | Contractor/inspector/PM missing assignment |
| `INVALID_STATE_TRANSITION` | 409 | State machine or SoD |

`details` may include field errors for validation only — not “you almost had access to agency X.”

---

## 9. Stale session

Role, agency, and `DISABLED` are re-read from Mongo on **sensitive** mutations and on a configurable interval for reads. Changing a user’s role **audits** and should revoke refresh **family** (force re-login).

---

## 10. IAM audit events

Always audit: role changed, user disabled/enabled, agency assignment changed, permission catalog changed, project approval/rejection, conflict resolution, inspection verification, payment approval, privileged document deletion, system setting change.

Never audit: passwords, access/refresh tokens, reset secrets, raw file bytes.
