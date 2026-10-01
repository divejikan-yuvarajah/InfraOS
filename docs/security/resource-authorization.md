# INFRAOS Resource-Level Authorization

**Document:** `/docs/security/resource-authorization.md`  
**Step:** 04  
**Status:** Locked  
**Companion:** [roles-and-permissions.md](./roles-and-permissions.md)

RBAC is necessary and **not sufficient**. Every `/:id` and every list query applies scope.

---

## 1. Identity attributes (server-side only)

Loaded from Mongo after JWT `sub` is verified:

- `role`
- `status` (`ACTIVE` / `DISABLED`)
- `organizationId` (Gov Admin)
- `agencyId` (officers, often PMs)
- `projectAssignments[]`
- `inspectionAssignments[]`
- `contractorId` (contractors)

Never taken from the request body.

---

## 2. Resource checks by type

| Resource | Allow if |
|----------|----------|
| User | SA platform; GA same org; else self for profile |
| Agency | SA; GA org contains agency; AO/PM own agency |
| Project | Public DTO if flagged; else SA read; GA org; AO agency; PM assigned or agency **read**; CO assigned; IN project of assigned inspection |
| Work request | Same as parent project write/read rules; AO also if **affected** by conflict |
| Conflict | Party agencies, GA org, SA read, PM if related assigned project |
| Coordination | Target/origin agency officers; GA org |
| Document | `document.read` **and** project scope **and** classification (confidential vs public) |
| Payment | Finance permissions **and** project scope |
| Inspection | Assigned inspector or project-scoped staff with `inspection.read` |
| Asset | Agency/org/SA; public summary if released |
| Citizen issue | Staff agency/org/SA; reporter `OWN_RECORD` / tracking secret; public list never includes PII |
| Notification | Recipient user id = actor (SA support exception **audited**) |
| Audit | `audit.read` + org/platform scope; never other-org |

Lists: **filter in MongoDB** (`agencyId: { $in: scopeAgencyIds }`, `projectId: { $in: assigned }`, `isPublic: true`).

---

## 3. IDOR

| Input | Result |
|-------|--------|
| Malformed ObjectId | 400 |
| Well-formed id, no access, private | **404** `RESOURCE_SCOPE_DENIED` or `RESOURCE_NOT_ASSIGNED` |
| Well-formed id, public | 200 public DTO |
| `/admin` without `system`/`user` admin perms | **403** `FORBIDDEN` |

Knowing an id is not access ([BR-SCOPE-007](../planning/business-rules.md)).

---

## 4. Status-based authorization

### Project

| State | Edit core fields | Submit | Approve | Progress | Complete |
|-------|------------------|--------|---------|----------|----------|
| DRAFT | Creator / AO / PM in scope | Yes | No | No | No |
| SUBMITTED / UNDER_REVIEW | Restricted (return-to-DRAFT by GA) | No | GA | No | No |
| REJECTED | Back to DRAFT then edit | After correction | No | No | No |
| APPROVED | Limited (dates/geometry may need workflow) | — | — | No until ACTIVE | No |
| ACTIVE | Limited; progress **yes** | — | — | Yes (assigned) | If rules pass |
| ON_HOLD / DELAYED | Limited | — | — | Restricted | No typical |
| COMPLETED | No casual edit (audited correction only) | — | — | No | — |
| CANCELLED | No new work requests | — | — | No | — |

### Work request

Editable in DRAFT / REJECTED. UNDER_COORDINATION: dates may change only via resolution workflow. CANCELLED/COMPLETED: no casual edit.

### Conflict

| State | Recalculate | Coordinate | Resolve |
|-------|-------------|------------|---------|
| DETECTED / OPEN | Yes | Yes | After coordination or policy |
| UNDER_COORDINATION | Limited | Respond | Authorized resolver |
| RESOLVED / ACCEPTED_RISK / CLOSED_INVALID | No (except SA/GA audited reopen — **not V1**) | No | — |

Prompt aliases `COORDINATION_PENDING` / `UNDER_REVIEW` map to our locked states `UNDER_COORDINATION` / review via coordination responses — do **not** fork a second conflict state machine.

### Milestone

PLANNED/IN_PROGRESS editable by PM. COMPLETED not silently reopened without `milestone.update` + reason.

### Inspection

Only **assigned** inspector submits. SCHEDULED → others cannot `inspection.submit`.

### Payment

DRAFT/SUBMITTED: creator may edit. UNDER_REVIEW: approver only. PAID: no casual edit.

### Document processing

Delete of INDEXED confidential files requires `document.delete` + audit.

---

## 5. Horizontal vs vertical escalation

| Attack | Block |
|--------|--------|
| Contractor A opens contractor B project id | Assignment check |
| Officer edits other agency DRAFT | Agency id check |
| PM sets `role: SUPER_ADMIN` in PATCH | Ignore body; `role.manage` only SA |
| Citizen sets `isPublic` on document | No `document.update` classification |
| Disabled user with old JWT | Status check after authn |

---

## 6. Map layers

`map.view.public` for anonymous/citizen. `map.view.internal` for staff. `map.layer.restricted` for risk/non-public utilities — still scoped by bbox **and** agency/org so a GA does not pull another ministry’s restricted layer.
