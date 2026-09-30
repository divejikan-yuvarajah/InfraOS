# INFRAOS Requirements

**Document:** `/docs/planning/requirements.md`  
**Step:** 01 — Final Project Requirement & Scope Lock  
**Status:** Locked for architecture (Steps 2–6)

This document contains implementation-relevant requirements. It is not a microscopic specification of every field. Endpoint permission matrices belong to Step 4. Database fields belong to later schema steps.

Each functional requirement uses:

```text
ID | Description | Actor | Precondition | Expected behavior | Success | Priority | Module
```

Priority values: **P0 / P1 / P2 / P3** as defined in [mvp-priorities.md](./mvp-priorities.md).

---

## 1. Functional requirements

### 1.1 Platform and identity

| ID | Description | Actor | Precondition | Expected behavior | Success | Priority | Module |
|----|-------------|-------|--------------|-------------------|---------|----------|--------|
| FR-AUTH-001 | Register or provision an account according to the approved signup policy | Unauthenticated user or Super Admin | Signup/provisioning is enabled | System creates a user in a non-privileged default state until verified/approved as designed | Account exists with safe status; no role self-elevation | P0 | Identity |
| FR-AUTH-002 | Log in with valid credentials | Registered user | Account is active | System authenticates, creates a short-lived access token and refresh session | User receives a session; password is never returned | P0 | Identity |
| FR-AUTH-003 | Reject login for disabled, unverified (if required), or unknown accounts | Anyone | Invalid or blocked identity | System denies access with a generic safe message | No session created; event is auditable | P0 | Identity |
| FR-AUTH-004 | Refresh an authenticated session | Authenticated user | Valid refresh session | System rotates refresh credentials as designed and issues a new access token | User stays signed in without storing long-lived tokens in localStorage | P0 | Identity |
| FR-AUTH-005 | Log out | Authenticated user | Active session | System invalidates the refresh session and clears the cookie | Subsequent refresh fails | P0 | Identity |
| FR-AUTH-006 | Expire idle or absolute sessions | Any user | Session lifetime exceeded | Protected APIs reject the access token; refresh may fail | User must log in again | P0 | Identity |
| FR-AUTH-007 | Request password reset | Registered user | Valid account email | System issues a time-limited reset path without revealing whether other emails exist beyond agreed UX | Password can be reset; old sessions invalidated on success | P1 | Identity |
| FR-AUTH-008 | Verify email | Registered user | Verification required by policy | User confirms email before full access if policy requires it | Status becomes verified | P1 | Identity |
| FR-USER-001 | Super Admin manages users | Super Admin | Authenticated as Super Admin | Create, update, disable users; assign role and agency | Changes persist; permission change is audited | P0 | Identity |
| FR-USER-002 | Users cannot change their own role | Any user | Authenticated | Role and permission updates are rejected unless an authorized admin API is used | No privilege escalation | P0 | Identity |
| FR-USER-003 | Agency assignment is required for operational staff | Admin | Creating Agency Officer / PM / related roles | User is bound to one primary agency unless a documented multi-agency exception exists | Queries can scope by agency | P0 | Identity |
| FR-USER-004 | Deactivated users cannot use the API | Deactivated user | Account status disabled | All protected endpoints return unauthorized/forbidden | Sessions are unusable | P0 | Identity |
| FR-PERM-001 | Backend enforces RBAC | Any authenticated user | Request to a protected route | Missing permission yields 403 | Frontend hiding a button is not sufficient | P0 | Identity |
| FR-PERM-002 | Backend enforces resource-level authorization | Authenticated user | User has the role permission but not the resource | Access to another agency/project is denied | IDOR attempts fail | P0 | Identity |

### 1.2 Agencies

| ID | Description | Actor | Precondition | Expected behavior | Success | Priority | Module |
|----|-------------|-------|--------------|-------------------|---------|----------|--------|
| FR-AGENCY-001 | Maintain agency catalogue | Super Admin / Gov Admin as allowed | Authenticated with permission | Create/update agencies (roads, water, electricity, telecom, drainage, local authority, etc.) | Agency records exist for assignment | P0 | Identity / Agencies |
| FR-AGENCY-002 | Agency type is explicit | Admin | Creating an agency | Agency has a type used later by conflict/affected-agency logic | Type is stored and queryable | P0 | Agencies |

### 1.3 ProjectTrace

| ID | Description | Actor | Precondition | Expected behavior | Success | Priority | Module |
|----|-------------|-------|--------------|-------------------|---------|----------|--------|
| FR-PROJECT-001 | Create infrastructure project | Agency Officer / Project Manager | Authenticated; agency scope valid | System creates a DRAFT project with owner agency, unique project code, and required core fields | Project is retrievable by authorized users | P0 | ProjectTrace |
| FR-PROJECT-002 | Reject duplicate project codes | Same actors | Code already exists | Create/update fails with a clear validation error | No duplicate code | P0 | ProjectTrace |
| FR-PROJECT-003 | Map project location | Same actors | Project exists; user authorized | User attaches GeoJSON point, line, and/or polygon; invalid coordinates rejected | Geometry stored; map can render it | P0 | ProjectTrace |
| FR-PROJECT-004 | Edit project while in editable states | Same actors | State allows edit | Updates persist; illegal state edits are rejected | History/audit for sensitive fields | P0 | ProjectTrace |
| FR-PROJECT-005 | Submit project for review | Project Manager / Agency Officer | DRAFT with required fields including location and dates | Status becomes SUBMITTED | Reviewers can see it | P0 | ProjectTrace |
| FR-PROJECT-006 | Review and approve or reject project | Gov Admin / authorized reviewer | SUBMITTED or UNDER_REVIEW | Approved projects become APPROVED; rejection returns a reason | Transition is audited | P0 | ProjectTrace |
| FR-PROJECT-007 | Start project (ACTIVE) | Authorized role | APPROVED | Status becomes ACTIVE | Work tracking is enabled | P0 | ProjectTrace |
| FR-PROJECT-008 | Place project ON_HOLD or DELAYED | Authorized role | ACTIVE | Status changes with reason | Dashboard reflects status | P0 | ProjectTrace |
| FR-PROJECT-009 | Complete project only when completion rules pass | Authorized role | ACTIVE and validation rules satisfied | Status becomes COMPLETED | Incomplete required verification blocks completion | P0 | ProjectTrace |
| FR-PROJECT-010 | Cancel project | Authorized role | Not already COMPLETED in a way that forbids cancel | Status becomes CANCELLED; related open conflicts must be handled per BR rules | Cancellation is audited | P0 | ProjectTrace |
| FR-PROJECT-011 | View project details | Authorized user | Resource access granted | User sees allowed fields for their role | Unauthorized fields omitted | P0 | ProjectTrace |
| FR-PROJECT-012 | List/filter projects | Authorized user | Authenticated | List is scoped by authorization; supports status, agency, date filters; paginated | No cross-tenant leakage | P0 | ProjectTrace |
| FR-PROJECT-013 | Project dashboard | Authorized user | Authenticated | Aggregates counts and recent items in scope | Empty and error states are handled | P0 | ProjectTrace |
| FR-PROJECT-014 | Record project dependencies | Project Manager | Projects exist | Dependency links are stored; circular dependency rejected if detected | Timeline can show dependency | P1 | ProjectTrace |
| FR-PROJECT-015 | Project activity history | Authorized user | Project access | Chronological activity for significant events | Users can reconstruct what happened | P0 | ProjectTrace |

### 1.4 Milestones and progress

| ID | Description | Actor | Precondition | Expected behavior | Success | Priority | Module |
|----|-------------|-------|--------------|-------------------|---------|----------|--------|
| FR-MS-001 | Create milestones | Project Manager | Project exists and is editable | Milestone has name, planned dates, optional weight | Milestone list is complete | P0 | ProjectTrace |
| FR-MS-002 | Track milestone state | Project Manager | Milestone exists | Valid transitions only | Illegal jumps rejected | P0 | ProjectTrace |
| FR-PROG-001 | Update physical progress | Contractor / Project Manager as allowed | Assigned to project | Progress percentage and note stored; bounds 0–100 | Latest progress visible | P0 | ProjectTrace |
| FR-PROG-002 | Show physical vs financial progress summary | Authorized user | Project has budget/progress data | Dashboard shows both without implying they must match | Users can compare them | P1 | ProjectTrace / Finance |
| FR-PROG-003 | Progress updates do not auto-complete the project | Contractor | Progress = 100% | Project remains in current official status until authorized completion | No self-completion | P0 | ProjectTrace |

### 1.5 RoadSync

| ID | Description | Actor | Precondition | Expected behavior | Success | Priority | Module |
|----|-------------|-------|--------------|-------------------|---------|----------|--------|
| FR-ROADSYNC-001 | Create work request | Agency Officer / Project Manager | Authenticated; linked project or agency work context | Work request stores work type, GeoJSON geometry, planned start/end, priority, agency | Record exists in DRAFT/SUBMITTED as designed | P0 | RoadSync |
| FR-ROADSYNC-002 | Reject invalid geometry and dates | Same | Start after end, empty geometry, out-of-range coordinates | Validation error; no persist | User can correct | P0 | RoadSync |
| FR-ROADSYNC-003 | Detect nearby / intersecting work | System + authorized user | Work request has geometry | Spatial query against other work/projects using GeoJSON indexes | Candidate list returned | P0 | RoadSync |
| FR-ROADSYNC-004 | Detect schedule overlap | System | Nearby candidates exist | Date windows compared; overlap computed | Overlap duration/flag stored | P0 | RoadSync |
| FR-ROADSYNC-005 | Detect affected agencies | System | Conflict candidates exist | Agencies owning nearby/overlapping work are listed | Coordination targets are known | P0 | RoadSync |
| FR-ROADSYNC-006 | Classify conflict and severity | System | Detection complete | Conflict record with type and severity (e.g. LOW/MEDIUM/HIGH) | Persist DETECTED/OPEN conflict | P0 | RoadSync |
| FR-ROADSYNC-007 | Create coordination request | System / authorized user | OPEN conflict | Affected agencies receive a coordination request | Request visible to target agency | P0 | RoadSync |
| FR-ROADSYNC-008 | Agency responds to coordination | Agency Officer of affected agency | PENDING coordination | Acknowledge, accept, counter-propose, or reject with reason | Response stored | P0 | RoadSync |
| FR-ROADSYNC-009 | Resolve conflict | Authorized resolver | Coordination complete or policy allows | Status becomes RESOLVED (or ACCEPTED_RISK / CLOSED_INVALID); resolution notes required | Audit log written | P0 | RoadSync |
| FR-ROADSYNC-010 | Conflict visualization | Authorized user | Conflict exists | Map and list views show involved geometries | User understands where/when | P0 | RoadSync / InfraMap |
| FR-ROADSYNC-011 | Coordination history | Authorized user | Conflict access | Full response history visible | Reconstructable process | P0 | RoadSync |
| FR-ROADSYNC-012 | Conflict simulator summary | Authorized user | Before or during approval | Packaged risk summary and recommendation options | Decision support shown; no auto-approval | P1 | RoadSync |
| FR-ROADSYNC-013 | Smart coordination recommendations | System | Conflict exists | Suggest sequence/reschedule/merge/confirm options | Suggestions stored as advice, not orders | P1 | RoadSync |
| FR-ROADSYNC-014 | RoadSync operates without AI | Any | AI service down | Detection and workflow still function | Core path green | P0 | RoadSync |

### 1.6 InfraMap

| ID | Description | Actor | Precondition | Expected behavior | Success | Priority | Module |
|----|-------------|-------|--------------|-------------------|---------|----------|--------|
| FR-MAP-001 | Render interactive map | Authenticated user (and public subset) | Map tiles available | MapLibre-style map loads with INFRAOS layers | User can pan/zoom | P0 | InfraMap |
| FR-MAP-002 | Viewport queries | Client | Bounds provided | Backend returns only in-bounds GeoJSON, not the full database | Response is bounded | P0 | InfraMap |
| FR-MAP-003 | Project/work/conflict layers | Authorized user | Data exists | Toggle layers for planned/active/completed, work, conflicts | Layers filter correctly | P0 | InfraMap |
| FR-MAP-004 | Map detail drawer | User | Feature selected | Drawer shows allowed summary and link to record | Empty/error handled | P0 | InfraMap |
| FR-MAP-005 | Search and filters | User | Authenticated or public as allowed | Filter by status, agency, work type, date | Results match filters | P0 | InfraMap |
| FR-MAP-006 | Public map subset | Citizen | Public page | Only public-safe layers and fields | No internal documents/budgets | P1 | InfraMap / Citizen |
| FR-MAP-007 | Asset and risk layers | Authorized user | P1/P2 data exists | Optional layers; missing data shows empty layer, not crash | Degrades gracefully | P1 | InfraMap |
| FR-MAP-008 | Map tile failure fallback | Any | Tile server unavailable | User sees an understandable error and retry | App remains otherwise usable | P0 | InfraMap |

### 1.7 AI Risk Intelligence

| ID | Description | Actor | Precondition | Expected behavior | Success | Priority | Module |
|----|-------------|-------|--------------|-------------------|---------|----------|--------|
| FR-RISK-001 | Request project risk analysis | Authorized user | Project exists | Node authorizes, sends minimized features to AI service, stores structured result | Score, factors, explanation, recommendation returned | P1 | AI Risk |
| FR-RISK-002 | Risk history | Authorized user | Previous runs exist | Historical scores listed | Trend visible | P1 | AI Risk |
| FR-RISK-003 | AI unavailable fallback | Authorized user | AI service error | User sees fallback message; project workflow continues | No blocked P0 path | P1 | AI Risk |
| FR-RISK-004 | AI cannot change official status | System | Model returns advice | Status/approval APIs ignore model output as authority | Only humans change official state | P0 | AI Risk |
| FR-RISK-005 | Prompt/cost controls | System | AI request | Size, rate, and authorization limits applied | Abuse is limited | P1 | AI Risk |

### 1.8 DocTrace

| ID | Description | Actor | Precondition | Expected behavior | Success | Priority | Module |
|----|-------------|-------|--------------|-------------------|---------|----------|--------|
| FR-DOC-001 | Upload project document | Authorized user | Project access; valid MIME/size | File stored privately; metadata in DB; random storage key | Document listed | P1 | DocTrace |
| FR-DOC-002 | Categorize and preview | Authorized user | Document exists | Category stored; preview for allowed types | Unauthorized users cannot fetch bytes | P1 | DocTrace |
| FR-DOC-003 | Search documents metadata | Authorized user | Project access | Filter/search titles/categories | Results scoped | P1 | DocTrace |
| FR-DOC-004 | Extract text and index | System | Supported file | Processing state machine runs | INDEXED or FAILED/UNSUPPORTED | P1 | DocTrace |
| FR-DOC-005 | AI summary / extraction | Authorized user | INDEXED document | Summary stored as assistance | Failure does not delete file | P1 | DocTrace |
| FR-DOC-006 | RAG question answering | Authorized user | Indexed chunks exist | Answer includes references when possible; hallucination warning when weak match | No answer if unauthorized | P1 | DocTrace |
| FR-DOC-007 | Reject malicious or invalid files | Any | Bad MIME, extension mismatch, oversize | Upload rejected | Storage not polluted | P1 | DocTrace |
| FR-DOC-008 | Citizens cannot read confidential documents | Citizen | Public site | Confidential files never served | 403/omit | P0 | DocTrace |

### 1.9 Finance and contractors

| ID | Description | Actor | Precondition | Expected behavior | Success | Priority | Module |
|----|-------------|-------|--------------|-------------------|---------|----------|--------|
| FR-FIN-001 | Record project budget | Authorized finance/PM role | Project exists | Budget stored; changes audited | Budget visible to allowed roles | P1 | Finance |
| FR-FIN-002 | Record expenses/payments | Authorized role | Budget exists as required | Payment follows payment state machine | Totals update | P1 | Finance |
| FR-FIN-003 | Contractor cannot approve own payment | Contractor | Payment submitted | Approval API forbidden | Segregation of duties | P0 | Finance |
| FR-CON-001 | Contractor profile and assignment | Admin / PM as allowed | Contractor exists | Assign contractor to project | Contractor sees only assigned work | P1 | Contractors |
| FR-CON-002 | Contractor performance indicators | Authorized user | History exists | Delay/active/completed indicators | Advisory only in V1 | P1 | Contractors |

### 1.10 Inspection and verification

| ID | Description | Actor | Precondition | Expected behavior | Success | Priority | Module |
|----|-------------|-------|--------------|-------------------|---------|----------|--------|
| FR-INSP-001 | Assign and schedule inspection | PM / Gov Admin as allowed | Project active or as policy | Inspector assigned; inspection SCHEDULED | Inspector sees assignment | P1 | Inspection |
| FR-INSP-002 | Submit inspection report with evidence | Inspector | Assigned inspection | Photos/comments/findings stored | Evidence access is authorized | P1 | Inspection |
| FR-INSP-003 | Approve, reject, or request revision of reported progress | Inspector | Submitted inspection | Official verification outcome stored; does not silently rewrite contractor entries | Verified vs reported is visible | P1 | Inspection |
| FR-INSP-004 | Inspector cannot approve contractor payments | Inspector | Payment endpoint | 403 | Duties remain split | P0 | Inspection |
| FR-INSP-005 | Inspection history | Authorized user | Project access | Chronological inspections | Traceable verification | P1 | Inspection |

### 1.11 Asset lifecycle

| ID | Description | Actor | Precondition | Expected behavior | Success | Priority | Module |
|----|-------------|-------|--------------|-------------------|---------|----------|--------|
| FR-ASSET-001 | Convert completed project to asset | Authorized role | Project COMPLETED; conversion rules pass | Asset created with location and source project reference | Asset appears in register and map layer | P1 | Assets |
| FR-ASSET-002 | Maintain asset details and condition | Authorized role | Asset exists | Condition and notes update; history retained | No silent delete of history | P1 | Assets |
| FR-ASSET-003 | Maintenance records and schedule | Authorized role | Asset exists | Schedule and history stored | Supports later health score | P1 | Assets |
| FR-ASSET-004 | Infrastructure health score | System | Sufficient records | Score is advisory | Missing data → low-confidence, not fake precision | P2 | Assets |

### 1.12 Citizen portal

| ID | Description | Actor | Precondition | Expected behavior | Success | Priority | Module |
|----|-------------|-------|--------------|-------------------|---------|----------|--------|
| FR-CITIZEN-001 | Browse public projects | Citizen | Public project flagged public | List/detail without confidential fields | Works unauthenticated | P1 | Citizen |
| FR-CITIZEN-002 | Report infrastructure issue | Citizen | Valid location, category, optional photo | Issue SUBMITTED with tracking id | Citizen can track own issue | P1 | Citizen |
| FR-CITIZEN-003 | Assign issue to agency | Agency Officer / Admin | Issue submitted | Agency and status updated | Citizen sees public-safe status | P1 | Citizen |
| FR-CITIZEN-004 | Rate-limit public issue submission | Anyone | Abuse pattern | Throttle and validation | Reduced spam | P1 | Citizen |

### 1.13 Notifications

| ID | Description | Actor | Precondition | Expected behavior | Success | Priority | Module |
|----|-------------|-------|--------------|-------------------|---------|----------|--------|
| FR-NOTIF-001 | Create in-app notification for critical events | System | Conflict, coordination, approval, inspection, issue events | Notification row created; unread by default | User sees it in center | P1 | Notifications |
| FR-NOTIF-002 | Mark read/unread | Recipient | Notification exists | State updates | Counts update | P1 | Notifications |
| FR-NOTIF-003 | Optional realtime push | Authenticated user | Socket connected | Selected events pushed | Pages still work via REST if socket down | P2 | Notifications |
| FR-NOTIF-004 | Email notifications | System | P2 enabled | Email for selected events | Failure does not roll back business action | P2 | Notifications |

### 1.14 Reporting

| ID | Description | Actor | Precondition | Expected behavior | Success | Priority | Module |
|----|-------------|-------|--------------|-------------------|---------|----------|--------|
| FR-RPT-001 | Authorized project/agency/status reports | Authorized user | Date filters | Scoped query results | No extra-scope rows | P1 | Reporting |
| FR-RPT-002 | CSV export | Authorized user | Export permission | File generated from scoped data | Audit export if sensitive | P1 | Reporting |
| FR-RPT-003 | PDF export for useful summaries | Authorized user | Export permission | Generated document | Not a full BI suite | P2 | Reporting |

### 1.15 Audit and governance

| ID | Description | Actor | Precondition | Expected behavior | Success | Priority | Module |
|----|-------------|-------|--------------|-------------------|---------|----------|--------|
| FR-AUDIT-001 | Audit login success/failure | System | Auth attempt | Record without storing passwords | Admins can review | P0 | Audit |
| FR-AUDIT-002 | Audit critical mutations | System | Create/update/delete on sensitive resources | Actor, action, resource, old/new, timestamp | Tamper-evident operationally (no user edit API) | P0 | Audit |
| FR-AUDIT-003 | Audit approvals, rejections, permission changes, conflict resolution | System | Those actions occur | Dedicated action types | Reconstructable governance | P0 | Audit |
| FR-AUDIT-004 | Normal users cannot edit audit logs | Any non-platform-break-glass role | Audit collection | No update/delete API | Read-only for authorized admins | P0 | Audit |
| FR-AUDIT-005 | Do not audit secrets | System | Auth/token operations | No passwords, tokens, or raw files in audit payloads | Safe logs | P0 | Audit |

---

## 2. Non-functional requirements

These are realistic for a 45–60 day university / portfolio / production-style system, not a fictional national-scale SLA.

### NFR-SEC — Security

- HTTPS in production.
- Passwords hashed (**bcryptjs**, cost 12, V1). Argon2id is a documented future revisit.
- Short-lived access tokens; refresh in HTTP-only Secure cookies.
- CORS allowlist.
- Helmet and request size limits.
- Rate limits on auth, public issue intake, and AI endpoints.
- Backend RBAC + resource authorization on every protected operation.
- MongoDB queries parameterized; no operator injection from user objects.
- Uploaded files validated (size, MIME, extension); stored with random keys; not executed.
- Secrets only in environment variables; never committed.
- AI inputs minimized; prompt-injection awareness; model output untrusted.

### NFR-PERF — Performance

- Interactive list pages target p95 < 2s on typical academic hosting under demo data volumes.
- Map viewport queries must not download the full collection.
- Paginate all lists (default page size documented later; suggested 20).
- Conflict detection must complete for demo city-scale GeoJSON in a few seconds, not minutes.

### NFR-A11Y — Accessibility

- Semantic HTML, labels, keyboard access, visible focus.
- Contrast aligned with the locked design system (Step 5+).
- Form errors associated with fields.
- Respect `prefers-reduced-motion`.

### NFR-RESP — Responsive design

- Usable layouts for mobile, tablet, laptop, desktop, large desktop.
- Do not merely shrink desktop tables; provide stacked/card alternatives on small screens.
- Map remains usable on mobile with a drawer, not only hover.

### NFR-MAINT — Maintainability

- TypeScript throughout application layers.
- Feature modules with clear ownership.
- Shared API client and error format.
- Documented ADRs from Step 2 onward.

### NFR-AUDIT — Auditability

- Critical actions reconstructable from audit logs.
- Correlation/request IDs in application logs where practical.

### NFR-UX — Usability

- Loading, empty, error, and success states on important screens.
- Language: professional English for V1 unless a later step adds Sinhala/Tamil (open question).

### NFR-SCALE — Scalability

- Modular monolith that can add Redis, a job queue, or PostGIS later.
- Version 1 is **not** required to support millions of users.

### NFR-AVAIL — Availability

- Core P0 path must work if AI, email, or optional sockets fail.
- Map tile failure must not crash the SPA; show retry.

### NFR-OBS — Observability

- Structured application logs (Pino/Winston to be locked in Step 2).
- Optional Sentry in later deployment steps.
- MongoDB Atlas monitoring.

### NFR-PRIV — Data privacy

- Citizens’ personal data minimized.
- Public APIs expose public-safe fields only.
- Documents default confidential.

### NFR-AI — AI reliability

- Schema-validate model output.
- Persist structured results, not free-form authority.
- Explicit fallbacks and user-visible “assistance only” labeling.

### NFR-FILE — File security

- Private buckets/containers.
- Authorized download/preview only.
- Virus scanning is P2/future, not MVP-blocking; MIME/size checks are MVP.

### NFR-MAP — Map performance

- Viewport + filter queries.
- Simplification/clustering are later options if demo data grows.

---

## 3. Lifecycle states and valid transitions

Do not over-create states. Unknown client-supplied statuses must be rejected.

### 3.1 Projects

```text
DRAFT
SUBMITTED
UNDER_REVIEW
APPROVED
ACTIVE
ON_HOLD
DELAYED
COMPLETED
CANCELLED
REJECTED
```

| From | To | Notes |
|------|----|-------|
| DRAFT | SUBMITTED | Required fields including geometry and planned dates |
| SUBMITTED | UNDER_REVIEW, REJECTED | Reviewer starts or rejects |
| UNDER_REVIEW | APPROVED, REJECTED, DRAFT | DRAFT only if sent back for correction |
| APPROVED | ACTIVE, CANCELLED | Start or abandon before build |
| ACTIVE | ON_HOLD, DELAYED, COMPLETED, CANCELLED | Completion requires BR completion rules |
| ON_HOLD | ACTIVE, CANCELLED | Resume or cancel |
| DELAYED | ACTIVE, ON_HOLD, COMPLETED, CANCELLED | DELAYED is still an in-delivery state |
| REJECTED | DRAFT | Resubmission after correction |
| COMPLETED | — | No return to ACTIVE without a documented admin correction process (out of casual UI) |
| CANCELLED | — | Terminal for V1 |

### 3.2 Work requests

```text
DRAFT → SUBMITTED → UNDER_COORDINATION → APPROVED → ACTIVE → COMPLETED
DRAFT / SUBMITTED / UNDER_COORDINATION / APPROVED → CANCELLED
SUBMITTED / UNDER_COORDINATION → REJECTED
REJECTED → DRAFT (correction)
```

UNDER_COORDINATION is used when an OPEN conflict blocks silent approval.

### 3.3 Conflicts

```text
DETECTED → OPEN → UNDER_COORDINATION → RESOLVED
OPEN / UNDER_COORDINATION → ACCEPTED_RISK
OPEN / UNDER_COORDINATION / DETECTED → CLOSED_INVALID
```

ACCEPTED_RISK still requires an authorized actor and reason. It is not a silent ignore.

### 3.4 Coordination requests

```text
PENDING → ACKNOWLEDGED → ACCEPTED
PENDING → ACKNOWLEDGED → COUNTER_PROPOSED → ACCEPTED | REJECTED | ESCALATED
PENDING → REJECTED
Any non-terminal → CLOSED (when parent conflict closes)
ESCALATED → ACCEPTED | REJECTED | CLOSED
```

### 3.5 Milestones

```text
PLANNED → IN_PROGRESS → COMPLETED
PLANNED / IN_PROGRESS → DELAYED | BLOCKED
DELAYED / BLOCKED → IN_PROGRESS | CANCELLED
IN_PROGRESS → CANCELLED
```

Completion of a milestone is not automatic project completion.

### 3.6 Inspections

```text
SCHEDULED → IN_PROGRESS → SUBMITTED → APPROVED
SUBMITTED → REJECTED | REVISION_REQUESTED
REVISION_REQUESTED → IN_PROGRESS
SCHEDULED → CANCELLED
```

### 3.7 Citizen issues

```text
SUBMITTED → ACKNOWLEDGED → ASSIGNED → IN_PROGRESS → RESOLVED
SUBMITTED / ACKNOWLEDGED / ASSIGNED → REJECTED | DUPLICATE
IN_PROGRESS → RESOLVED | REJECTED
```

Citizens see public-safe labels only.

### 3.8 Payments

```text
DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → PAID
SUBMITTED / UNDER_REVIEW → REJECTED
Any pre-PAID → CANCELLED
```

Payer/approver cannot be the submitting contractor.

### 3.9 Document processing

```text
UPLOADED → QUEUED → EXTRACTING → INDEXED
UPLOADED / QUEUED / EXTRACTING → FAILED | UNSUPPORTED
```

Original file remains if processing fails.

---

## 4. Requirement coverage map

| Module | FR prefix | MVP expectation |
|--------|-----------|-----------------|
| Identity | FR-AUTH, FR-USER, FR-PERM, FR-AGENCY | P0 complete |
| ProjectTrace | FR-PROJECT, FR-MS, FR-PROG | P0 complete |
| RoadSync | FR-ROADSYNC | P0 complete; simulator P1 |
| InfraMap | FR-MAP | P0 project/work/conflict layers |
| AI Risk | FR-RISK | P1; must not block P0 |
| DocTrace | FR-DOC | P1 |
| Finance / Contractors | FR-FIN, FR-CON | P1 |
| Inspection | FR-INSP | P1 |
| Assets | FR-ASSET | P1 conversion; health P2 |
| Citizen | FR-CITIZEN | P1 |
| Notifications | FR-NOTIF | P1 in-app; realtime P2 |
| Reporting | FR-RPT | P1 basic; PDF P2 |
| Audit | FR-AUDIT | P0 critical actions |

---

## 5. Related documents

- [project-scope.md](./project-scope.md)
- [mvp-priorities.md](./mvp-priorities.md)
- [business-rules.md](./business-rules.md)
- [user-workflows.md](./user-workflows.md)
