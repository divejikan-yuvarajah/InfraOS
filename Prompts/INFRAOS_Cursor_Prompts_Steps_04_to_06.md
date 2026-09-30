# INFRAOS — Enhanced Cursor Prompts
## Steps 4–6: Roles & Permissions, Information Architecture, and Team/Git Strategy

**Project:** INFRAOS — National Infrastructure Intelligence & Coordination Platform  
**Vision:** The Operating System for National Infrastructure  
**Core Lifecycle:** Plan → Coordinate → Approve → Build → Verify → Monitor → Complete → Maintain  
**Development Window:** 45–60 days  
**Primary Development Assistant:** Cursor AI  

---

# HOW TO USE THIS FILE

Execute the steps in this exact order:

1. **Step 4 — User Roles & Permission Matrix**
2. **Step 5 — Information Architecture & Complete Page/Route Map**
3. **Step 6 — Team Development & Git Strategy**

For every step:

- Follow `CURSOR_STEP_EXECUTION_RULES.md` if it exists.
- Review the current repository and all previous documentation first.
- Perform a pre-step review.
- Execute only the requested step.
- Perform a post-step review.
- Fix inconsistencies directly related to the step.
- Update documentation.
- Stop before starting the next step.

These are still architecture/foundation steps.

**Do not start implementing ProjectTrace, RoadSync, authentication, database schemas, or landing page UI in these steps unless a tiny documentation-supporting change is strictly necessary.**

---

# LOCKED INFRAOS CONTEXT

INFRAOS is a Sri Lankan government/infrastructure-oriented platform designed to coordinate infrastructure projects across agencies.

The platform must support the lifecycle:

```text
Plan
↓
Coordinate
↓
Approve
↓
Build
↓
Verify
↓
Monitor
↓
Complete
↓
Maintain
```

The platform must eventually connect:

- projects
- ministries/agencies
- roadwork
- water infrastructure
- electricity infrastructure
- telecom infrastructure
- drainage
- contractors
- budgets
- schedules
- milestones
- inspections
- project documents
- AI risk intelligence
- infrastructure assets
- citizens

Core differentiators:

- ProjectTrace
- RoadSync
- InfraMap
- Infrastructure Conflict Simulator
- Smart Coordination Recommendations
- AI Project Risk Intelligence
- DocTrace + RAG
- Infrastructure Asset Lifecycle

---

# LOCKED TECHNOLOGY DIRECTION

Unless an accepted ADR says otherwise:

## Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Hook Form
- Zod
- TanStack Query
- Zustand only where appropriate
- MapLibre / OpenStreetMap-compatible maps

## Backend

- Node.js
- Express.js
- TypeScript
- REST API
- modular monolith

## Database

- MongoDB Atlas
- Mongoose
- GeoJSON
- `2dsphere` indexes where needed

## AI

- Python
- FastAPI
- provider abstraction
- RAG only where useful

## Architecture Principle

```text
Next.js
   ↓
Express API
   ↓
Business Modules
   ↓
MongoDB / Storage / GIS / FastAPI AI
```

Do not convert this into unnecessary microservices.

---

# LOCKED INFRAOS COLOR DIRECTION

INFRAOS uses a Sri Lankan national-flag-inspired visual identity.

## Brand Colors

```text
Primary Orange    #FF5B00
Primary Yellow    #FEB600
Primary Maroon    #8C1F28
Primary Green     #279541
```

## Recommended Neutral System

```text
Background        #F8FAFC
Surface           #FFFFFF
Primary Text      #111827
Secondary Text    #475569
Muted Text        #64748B
Border            #E2E8F0
Dark Surface      #111827
```

## Semantic Usage

```text
Orange  → primary actions, active navigation, highlighted infrastructure items
Yellow  → warning, pending, attention states
Maroon  → critical risk, severe conflict, rejected/blocked states
Green   → success, completed, approved, healthy/resolved states
```

Do not use all four colors heavily on every screen.

The application should remain:

**Professional + Government-oriented + Enterprise + GIS/Data focused**

---

# STEP 4 — USER ROLES & PERMISSION MATRIX

## CURSOR AGENT PROMPT

You are acting as a:

- Senior Software Architect
- Identity & Access Management Architect
- Backend Security Engineer
- Product Requirements Engineer
- Government Workflow Analyst
- QA / Security Reviewer

Perform:

# STEP 4 — USER ROLES & PERMISSION MATRIX

The goal of this step is to define a complete, secure, understandable authorization model for INFRAOS before authentication and RBAC are implemented.

Do not implement authentication or RBAC code yet.

Do not create database models yet.

Create the authorization specification that later implementation must follow.

---

# 1. PRE-STEP REVIEW

Before making changes, inspect:

```text
/docs/planning/
/docs/architecture/
/docs/adr/
```

Especially inspect:

- project scope
- requirements
- business rules
- user workflows
- system architecture
- authentication architecture
- authorization architecture
- module boundaries

Also inspect any existing code if present.

Return a short pre-step review:

```text
STEP 4 PRE-REVIEW

Existing Roles Found:
- ...

Existing Permission Assumptions:
- ...

Potential Conflicts:
- ...

Missing Authorization Decisions:
- ...

Documents To Update/Create:
- ...

Plan:
1.
2.
3.
...
```

Resolve documentation inconsistencies rather than silently duplicating conflicting role definitions.

---

# 2. LOCK THE MAIN USER ROLES

Use these primary roles unless previous approved documentation explicitly supersedes them:

## 1. Super Administrator

Platform-level administration.

Responsibilities may include:

- system configuration
- agencies
- users
- roles
- permissions
- platform governance
- audit access
- platform analytics

This role should be rare.

---

## 2. Government / Ministry Administrator

Organization/ministry oversight role.

Responsibilities:

- oversee projects under authorized organization scope
- approve permitted project/workflow actions
- view budget/progress summaries
- review high-risk projects
- review inter-agency coordination
- access authorized reports

Do not automatically give this role access to all ministries.

---

## 3. Agency Officer

Represents a specific operational agency.

Examples:

- road authority
- water authority
- electricity authority
- telecom authority/provider
- local authority
- drainage authority

Responsibilities:

- create/manage authorized infrastructure work
- participate in RoadSync coordination
- respond to conflicts
- access agency projects
- manage permitted agency-specific records

---

## 4. Project Manager

Manages specific assigned infrastructure projects.

Responsibilities:

- manage project data
- manage milestones
- update progress
- manage project documents
- coordinate work where permitted
- review project risk
- view project finance summary where authorized

Project Manager access should usually be assignment-based or agency-scoped.

---

## 5. Contractor

External/limited project participant.

Responsibilities may include:

- view assigned projects
- submit permitted progress updates
- upload evidence
- submit milestone information
- upload contractor reports

Critical rule:

**A contractor must never approve or independently verify its own work.**

---

## 6. Inspector

Independent verification role.

Responsibilities:

- access assigned inspections
- inspect project work
- upload evidence
- add comments
- verify/reject/request-review on progress claims
- view relevant project context

Inspector should not manage contractor payments unless separately authorized.

---

## 7. Citizen

Public/restricted user.

Responsibilities:

- view public project information
- view public map
- submit infrastructure issues
- upload permitted evidence
- track own reports

Citizen must never access:

- confidential contracts
- internal government comments
- restricted financial records
- audit logs
- internal AI analysis
- staff-only coordination records

---

# 3. DEFINE ROLE SCOPE MODEL

RBAC alone is not enough.

Define three levels of authorization:

```text
1. Role Permission
2. Organization / Agency Scope
3. Resource-Level Access
```

Example:

```text
Can PROJECT_MANAGER edit projects?
Yes.

Is Project Manager from the correct agency / assigned to project?
Must be checked.

Does the project state allow editing?
Must also be checked.
```

Document this rule clearly:

> Role permission says whether an action type is allowed.  
> Scope/resource authorization says whether this user may perform it on this specific resource.

---

# 4. DEFINE PERMISSION NAMING STANDARD

Create a future-proof permission naming convention.

Recommended format:

```text
resource.action
```

Examples:

```text
project.create
project.read
project.update
project.delete
project.submit
project.approve
project.complete

milestone.create
milestone.read
milestone.update
milestone.verify

roadsync.work_request.create
roadsync.conflict.read
roadsync.conflict.resolve
roadsync.coordination.respond

document.upload
document.read
document.delete

inspection.create
inspection.verify

finance.read
finance.payment.create
finance.payment.approve

asset.read
asset.update
maintenance.schedule

citizen_issue.create
citizen_issue.assign
citizen_issue.update

report.view
report.export

user.manage
agency.manage
role.manage
audit.read
```

Do not create unnecessary hyper-granular permissions.

Permission names should be:

- predictable
- reusable
- module-oriented
- readable
- stable

---

# 5. DEFINE PERMISSION CATEGORIES

Create permissions for these categories:

## Platform & Identity

- profile read/update
- user read/create/update/disable
- agency read/manage
- role read/manage
- permission read/manage
- system settings access
- audit log access

## ProjectTrace

- project create
- project read
- project update
- project archive/delete where appropriate
- project submit
- project approve
- project hold
- project cancel
- project complete
- project dashboard read
- project timeline read

## Milestones & Progress

- milestone create/read/update/delete
- progress submit
- progress update
- progress verify

## RoadSync

- work request create/read/update
- conflict read
- conflict initiate/recalculate if needed
- coordination request create
- coordination response
- conflict resolve
- conflict approve
- coordination history read

## InfraMap

- map view
- restricted layer view
- internal infrastructure data view
- public layer view

## AI Risk

- risk request
- risk read
- risk history read

AI results must respect project-level access.

## DocTrace

- upload
- read
- download
- delete
- process with AI
- ask RAG questions

## Contractor

- contractor read
- contractor manage
- contractor performance read

## Finance

- budget read
- payment create
- payment read
- payment approve
- payment reject
- finance report export

## Inspection

- inspection assign
- inspection read
- inspection submit
- inspection verify
- inspection reject/request review

## Assets

- asset read
- asset create from completed project
- asset update
- maintenance create/update
- health score read

## Citizen Issues

- citizen issue create
- own issue read
- agency issue read
- assign issue
- update issue status
- close issue

## Notifications

- own notification read
- own notification update
- notification preference update

## Reports

- report view
- report export

## Audit

- audit read
- audit export if later allowed

Audit modification permission should not exist for ordinary application users.

---

# 6. DEFINE ACTION TYPES

Where relevant, use:

```text
Create
Read
Update
Delete / Archive
Submit
Approve
Reject
Verify
Resolve
Assign
Export
Manage
```

Do not automatically give CRUD for every resource.

Example:

A contractor may:

```text
READ assigned project
SUBMIT progress
UPLOAD evidence
```

but should not:

```text
APPROVE project
VERIFY own work
EDIT approved government budget
RESOLVE government conflict
```

---

# 7. DEFINE DATA VISIBILITY SCOPES

Create explicit scope rules such as:

```text
PLATFORM
ORGANIZATION
AGENCY
ASSIGNED_PROJECT
ASSIGNED_INSPECTION
OWN_RECORD
PUBLIC
```

Example usage:

```text
Super Admin       → PLATFORM
Gov Admin         → ORGANIZATION
Agency Officer    → AGENCY
Project Manager   → ASSIGNED_PROJECT / AGENCY
Contractor        → ASSIGNED_PROJECT
Inspector         → ASSIGNED_INSPECTION
Citizen           → PUBLIC + OWN_RECORD
```

Do not assume these are universally exact.

Document exceptions where business workflows require them.

---

# 8. BUILD THE MASTER PERMISSION MATRIX

Create a clear permission matrix covering the seven roles.

At minimum include rows for:

- dashboard
- users
- agencies
- roles
- projects
- project approvals
- milestones
- physical progress
- budget visibility
- RoadSync
- work requests
- conflicts
- conflict resolution
- InfraMap
- contractor information
- payments
- project documents
- DocTrace AI
- AI Risk
- inspections
- assets
- maintenance
- citizen issues
- notifications
- reports
- exports
- audit logs
- system settings

Use readable values such as:

```text
Full
Organization
Agency
Assigned
Own
Public
View
Limited
None
```

Where action-level detail is needed, add a second detailed matrix.

---

# 9. BUILD A DETAILED ACTION MATRIX

For sensitive modules, create explicit action-level matrices.

Required:

## ProjectTrace Matrix

Columns:

- Super Admin
- Government Admin
- Agency Officer
- Project Manager
- Contractor
- Inspector
- Citizen

Rows:

- Create project
- Read project
- Edit project
- Submit project
- Approve project
- Put on hold
- Cancel project
- Complete project
- View internal project details
- View public project summary

---

## RoadSync Matrix

Rows:

- Create work request
- Edit work request
- Detect/recalculate conflict
- View conflict
- Send coordination request
- Respond to coordination
- Resolve conflict
- Approve resolution
- View coordination history

---

## Finance Matrix

Rows:

- View budget
- Add payment
- Edit pending payment
- Approve payment
- Reject payment
- Export financial report

Contractor must not approve its own payments.

---

## Inspection Matrix

Rows:

- Schedule inspection
- Assign inspector
- View inspection
- Submit inspection
- Verify progress
- Reject/request review

---

## Document Matrix

Rows:

- Upload
- View
- Download
- Delete
- AI process
- Ask RAG questions

Respect project/resource access.

---

# 10. DEFINE HIGH-RISK SEGREGATION OF DUTIES

Document important separation-of-duty rules.

At minimum:

- contractor cannot verify own progress
- contractor cannot approve own payment
- project creator should not automatically become final approver for every workflow
- inspector should remain independent from contractor
- permission changes must be restricted
- audit logs must not be editable
- citizen cannot access internal data
- AI cannot bypass approval rules
- RoadSync recommendations cannot automatically change official project schedule without authorized confirmation

If a strict dual-approval system is too complex for the academic MVP, mark it as future/optional rather than pretending it exists.

---

# 11. DEFINE STATUS-BASED AUTHORIZATION

Permissions may depend on resource state.

Examples:

## Project

```text
DRAFT
→ creator/authorized staff can edit

SUBMITTED
→ editing may be restricted

APPROVED
→ critical fields may require special workflow

ACTIVE
→ progress updates allowed

COMPLETED
→ normal editing should be highly restricted
```

## Conflict

```text
OPEN
COORDINATION_PENDING
UNDER_REVIEW
RESOLVED
CLOSED
```

Document which actions make sense in each state.

---

# 12. DEFINE BACKEND AUTHORIZATION RULE

Lock this architecture rule:

```text
Route
↓
Authentication
↓
Permission Check
↓
Scope / Resource Check
↓
Business-State Check
↓
Controller / Service
```

Frontend route protection is only UX.

Backend is authoritative.

Never accept from frontend:

- role
- permission list
- ownership
- agency access decision

Those are derived server-side from authenticated identity and stored relationships.

---

# 13. DEFINE FRONTEND ROLE-AWARE UX RULE

Frontend may use permission information to:

- hide unavailable navigation
- disable unavailable actions
- show appropriate dashboard
- avoid confusing users

But the UI must not be considered the security layer.

When a user reaches a forbidden route directly:

- backend denies data/action
- frontend displays a proper `403` state

---

# 14. DEFINE AUTHORIZATION ERROR STANDARD

Plan future error responses.

Examples:

```text
AUTH_REQUIRED
SESSION_EXPIRED
FORBIDDEN
INSUFFICIENT_PERMISSION
RESOURCE_SCOPE_DENIED
RESOURCE_NOT_ASSIGNED
INVALID_STATE_TRANSITION
```

Do not expose sensitive authorization logic in error details.

---

# 15. DEFINE AUDIT REQUIREMENTS FOR ACCESS-CONTROL ACTIONS

Audit events should later include:

- user role changed
- user disabled/enabled
- agency assignment changed
- permission changed
- project approval/rejection
- conflict resolution
- inspection verification
- payment approval
- privileged document deletion
- system setting change

Do not log passwords, access tokens, refresh tokens, or reset secrets.

---

# 16. DEFINE TEST SCENARIOS

Create a future RBAC test plan.

At minimum:

```text
Anonymous → protected project
Expected: denied

Citizen → internal document
Expected: denied

Contractor → unrelated project
Expected: denied

Contractor → own payment approval
Expected: denied

Inspector → assigned inspection
Expected: allowed

Project Manager → assigned project edit
Expected: allowed if state permits

Project Manager → unrelated restricted project
Expected: denied

Agency Officer → own agency work request
Expected: allowed

Agency Officer → other agency restricted edit
Expected: denied

Government Admin → authorized organization projects
Expected: allowed

Super Admin → platform administration
Expected: allowed
```

Add state-transition tests.

---

# 17. SECURITY REVIEW

Review permission design for:

- IDOR
- horizontal privilege escalation
- vertical privilege escalation
- broken role checks
- over-permission
- contractor self-approval
- tenant/agency data leakage
- citizen/internal data leakage
- audit-log exposure
- stale role/session risks

Document risks.

---

# 18. STEP 4 REQUIRED DELIVERABLES

Create/update:

```text
/docs/security/roles-and-permissions.md
/docs/security/permission-matrix.md
/docs/security/resource-authorization.md
/docs/security/segregation-of-duties.md
/docs/security/rbac-test-plan.md
/docs/architecture/authorization-flow.md
```

Optionally add:

```text
/docs/security/permission-catalog.md
```

Do not implement role middleware in this step.

---

# 19. POST-STEP REVIEW

After documentation is complete, review:

```text
STEP 4 POST-REVIEW

Role Coverage:
- ...

Permission Coverage:
- ...

Scope Rules:
- ...

Segregation of Duties:
- ...

Backend Enforcement Rules:
- ...

Frontend UX Rules:
- ...

Security Risks Found:
- ...

Conflicts With Previous Docs:
- ...

Issues Fixed:
- ...

Remaining Open Decisions:
- ...
```

Check that no previous architecture document still says “role-only authorization” if resource-level authorization is now required.

---

# 20. STEP 4 ACCEPTANCE CRITERIA

Step 4 is complete only if:

- all seven roles are clearly defined
- role scopes are defined
- permission naming standard exists
- module permission catalog exists
- master permission matrix exists
- sensitive module action matrices exist
- resource-level authorization rules exist
- status-based rules exist
- segregation-of-duty rules exist
- backend enforcement order exists
- frontend role-aware UX rules exist
- RBAC security test plan exists
- authorization documentation is internally consistent
- no RBAC feature code was prematurely implemented

Stop after Step 4.

---

---

# STEP 5 — INFORMATION ARCHITECTURE & COMPLETE PAGE / ROUTE MAP

## CURSOR AGENT PROMPT

You are acting as a:

- Senior Product Architect
- Information Architect
- UX Architect
- Next.js Application Architect
- Accessibility Specialist
- Government Enterprise UX Designer
- Security Reviewer

Perform:

# STEP 5 — INFORMATION ARCHITECTURE & COMPLETE PAGE / ROUTE MAP

The goal is to define how the entire INFRAOS application is organized from the user's point of view before page implementation begins.

Do not build the actual UI pages yet.

Create the full information architecture, navigation model, page inventory, route hierarchy, role-aware navigation behavior, breadcrumbs, route access rules, and page-purpose definitions.

---

# 1. PRE-STEP REVIEW

Inspect:

```text
/docs/planning/
/docs/architecture/
/docs/security/
/docs/adr/
```

Especially:

- modules
- user workflows
- roles
- permission matrix
- frontend architecture
- system architecture

Also inspect current `src/app` if it already exists.

Return:

```text
STEP 5 PRE-REVIEW

Existing Routes:
- ...

Existing Navigation:
- ...

Role Access Requirements:
- ...

Missing Pages:
- ...

Duplicate / Conflicting Routes:
- ...

Plan:
1.
2.
3.
...
```

Do not delete existing routes unless they directly contradict an approved architecture decision.

---

# 2. DEFINE THE INFORMATION ARCHITECTURE PRINCIPLES

INFRAOS should not look like a random set of pages.

Organize information around real workflows:

```text
Overview
Projects
Coordination
Map
Contractors
Documents
Inspections
Assets
Citizen Issues
Reports
Administration
```

Navigation should reflect the user's job.

Do not show every module to every user.

---

# 3. DEFINE TOP-LEVEL PRODUCT SURFACES

INFRAOS has four major product surfaces:

## A. Public Website

For:

- citizens
- visitors
- public transparency
- project discovery
- public map
- issue reporting
- product explanation

## B. Authentication

For:

- login
- registration if enabled
- verification
- password recovery

## C. Protected Operational Application

For:

- government users
- project managers
- contractors
- inspectors

## D. Administration

For:

- authorized platform/system administrators

Keep these surfaces visually related but functionally separated.

---

# 4. DEFINE PUBLIC ROUTES

Plan:

```text
/
 /about
 /features
 /how-it-works
 /public-projects
 /public-projects/[id]
 /public-map
 /report-issue
 /faq
 /contact
```

For each page define:

- purpose
- primary audience
- primary CTA
- key content
- data source
- whether authentication is required
- SEO relevance
- accessibility considerations
- mobile considerations

Do not build all public pages immediately if the MVP does not require them.

Mark each route:

```text
P0
P1
P2
P3
```

Landing + public project information + public map + issue reporting should be prioritized based on the approved MVP.

---

# 5. DEFINE AUTHENTICATION ROUTES

Plan:

```text
/login
/register
/verify-email
/forgot-password
/reset-password
```

Potential optional future:

```text
/mfa
/auth/callback
```

For each route define:

- form purpose
- authenticated-user behavior
- success destination
- error states
- security requirements
- mobile behavior

Do not expose role selection publicly unless business rules explicitly allow it.

Government/contractor/staff accounts may be admin-created depending on the final onboarding model.

Document this as a decision/open question if not locked.

---

# 6. DEFINE PROTECTED APPLICATION ROUTES

Plan the core operational app.

## Dashboard

```text
/dashboard
```

Dashboard content must be role-specific.

---

## ProjectTrace

```text
/projects
/projects/new
/projects/[id]
/projects/[id]/overview
/projects/[id]/timeline
/projects/[id]/milestones
/projects/[id]/documents
/projects/[id]/finance
/projects/[id]/inspections
/projects/[id]/risks
```

Consider whether `/projects/[id]` redirects to `/overview`.

Define route ownership.

---

## RoadSync

```text
/roadsync
/roadsync/new
/roadsync/work-requests
/roadsync/work-requests/[id]
/roadsync/conflicts
/roadsync/conflicts/[id]
/roadsync/coordination
```

Only include routes that provide real workflow value.

Avoid creating separate pages when a tab/detail panel is better.

---

## InfraMap

```text
/map
```

Potential map state should usually be query parameters rather than many duplicate routes.

Examples:

```text
/map?layer=projects
/map?layer=conflicts
/map?agency=...
/map?status=...
```

Do not put sensitive IDs or secrets into query parameters.

---

## Contractors

```text
/contractors
/contractors/[id]
```

Potential tabs:

- overview
- projects
- performance

Avoid route explosion unless needed.

---

## Assets

```text
/assets
/assets/[id]
```

Potential sections:

- overview
- maintenance
- inspections
- history

---

## Documents

```text
/documents
```

This can be a cross-project document workspace for authorized users.

Project-specific documents still exist under:

```text
/projects/[id]/documents
```

---

## Inspections

Consider:

```text
/inspections
/inspections/[id]
```

This is useful for Inspector users.

Add if supported by workflow requirements.

---

## Citizen Issues / Internal Issue Management

```text
/issues
/issues/[id]
```

Public submission remains:

```text
/report-issue
```

---

## Notifications

```text
/notifications
```

---

## Reports

```text
/reports
```

Possible report tabs rather than separate pages:

- projects
- agencies
- finance
- contractors

---

## Profile & Settings

```text
/profile
/settings
```

Settings should not mix personal profile with system administration.

---

# 7. DEFINE ADMINISTRATION ROUTES

Plan:

```text
/admin
/admin/users
/admin/agencies
/admin/roles
/admin/audit-logs
/admin/system
```

Potential future:

```text
/admin/feature-flags
```

Do not create unnecessary enterprise admin pages.

For each admin route define:

- required permission
- scope
- key actions
- audit requirements

---

# 8. DEFINE ERROR / SYSTEM ROUTES

Plan consistent states for:

```text
403 Forbidden
404 Not Found
500 Server Error
Maintenance / Service Unavailable
```

In Next.js, decide which are dedicated routes versus framework-level error boundaries.

Define:

- message style
- recovery CTA
- back/dashboard navigation
- accessibility behavior

Never expose internal stack traces.

---

# 9. CREATE PAGE INVENTORY

Create a table containing:

```text
Page
Route
Surface
Module
Audience
Required Permission
Scope
Priority
Primary Goal
Primary CTA
Main Data
Mobile Notes
```

Include every approved route.

This becomes the source of truth for later page implementation prompts.

---

# 10. DEFINE ROLE-BASED NAVIGATION

Create sidebar/navigation configurations conceptually for:

## Super Admin

Likely:

- Dashboard
- Projects
- RoadSync
- Map
- Contractors
- Assets
- Documents
- Reports
- Administration

## Government Admin

Likely:

- Dashboard
- Projects
- RoadSync
- Map
- Contractors
- Reports
- Notifications

## Agency Officer

Likely:

- Dashboard
- Projects
- RoadSync
- Map
- Issues
- Notifications

## Project Manager

Likely:

- Dashboard
- Projects
- RoadSync
- Documents
- Inspections
- Notifications

## Contractor

Keep restricted:

- Dashboard
- Assigned Projects
- Required Documents / Evidence
- Notifications
- Profile

## Inspector

Likely:

- Dashboard
- Assigned Inspections
- Projects (relevant view)
- Map if useful
- Notifications

## Citizen

Do not use the internal sidebar.

Use public website navigation and personal issue tracking where appropriate.

Do not hard-code security based only on nav visibility.

---

# 11. DEFINE NAVIGATION GROUPS

Recommended desktop sidebar hierarchy:

```text
OVERVIEW
- Dashboard

OPERATIONS
- Projects
- RoadSync
- Infrastructure Map

MANAGEMENT
- Contractors
- Inspections
- Assets
- Documents

PUBLIC / SERVICE
- Citizen Issues

INTELLIGENCE
- Reports

SYSTEM
- Notifications
- Administration
```

Do not show empty groups.

Adapt by role.

---

# 12. DEFINE MOBILE NAVIGATION

Do not simply shrink desktop sidebar.

Plan mobile behavior:

- top app bar
- hamburger / sheet menu
- page title
- essential quick action
- compact filters
- bottom action bar only if genuinely valuable

Map pages need special mobile treatment.

Document how:

- filters open in a sheet
- map detail appears in bottom sheet/drawer
- large data tables become card lists or horizontal scroll with care

---

# 13. DEFINE BREADCRUMB SYSTEM

Examples:

```text
Projects
Projects > INF-102
Projects > INF-102 > Milestones

RoadSync > Conflicts
RoadSync > Conflicts > CON-204

Assets > Road A12 > Maintenance
```

Breadcrumbs should:

- communicate hierarchy
- be accessible
- use human-readable labels
- not expose sensitive/internal IDs unnecessarily

---

# 14. DEFINE PAGE HEADER STANDARD

Every protected operational page should have a consistent page header.

Possible structure:

```text
Breadcrumbs

Title
Description

Status / metadata if relevant

Primary Action
Secondary Actions
```

Example:

```text
Projects

Infrastructure Projects
Manage planning, progress and delivery of authorized infrastructure projects.

[Create Project]
```

Do not overload page headers with too many buttons.

---

# 15. DEFINE PROJECT DETAIL INFORMATION ARCHITECTURE

Project detail is one of the most important areas.

Define:

```text
Project Header
├── Project Code
├── Title
├── Status
├── Agency
├── Manager
├── Contractor
└── Key Actions

Project Navigation
├── Overview
├── Timeline
├── Milestones
├── Documents
├── Finance
├── Inspections
└── Risks
```

Overview should summarize rather than duplicate every sub-page.

Plan reusable project context so each tab does not independently refetch unnecessary core metadata.

---

# 16. DEFINE ROADSYNC INFORMATION ARCHITECTURE

RoadSync should clearly communicate:

```text
Work Requests
Conflicts
Coordination
Resolution
History
```

Main RoadSync dashboard should show:

- open work requests
- active conflicts
- high-severity conflicts
- pending coordination responses
- recently resolved conflicts
- map preview

Do not make users search through generic project pages to find coordination tasks.

---

# 17. DEFINE MAP UX INFORMATION ARCHITECTURE

Map should include:

```text
Main Canvas
Layer Controls
Search
Filters
Legend
Selected Item Detail
Quick Navigation
```

Plan desktop:

```text
Map + Left/Top Controls + Detail Drawer
```

Plan mobile:

```text
Full Map + Compact Controls + Bottom Sheet
```

Map legend should use the locked semantic colors consistently.

---

# 18. DEFINE DASHBOARD INFORMATION ARCHITECTURE

Role-specific dashboards must be meaningful.

Create content architecture for each major role.

Examples:

## Government Admin

- projects summary
- delayed projects
- high-risk projects
- budget overview
- open conflicts
- pending approvals
- recent activity

## Agency Officer

- own agency active projects
- work requests
- RoadSync conflicts
- pending coordination
- citizen issues

## Project Manager

- assigned projects
- milestone deadlines
- progress
- project risks
- pending tasks

## Contractor

- assigned projects
- progress submissions
- requested evidence
- upcoming deadlines

## Inspector

- inspections due
- pending verifications
- recent inspection activity

Only include useful charts.

---

# 19. DEFINE GLOBAL SEARCH ARCHITECTURE

Plan global search for authorized users.

Potential entities:

- project
- project code
- contractor
- agency
- conflict
- asset

Do not expose records outside authorization scope.

Search result UI should group by entity.

Global search can be P1/P2 depending on project timeline.

---

# 20. DEFINE FILTER / URL STATE CONVENTIONS

Filters should use query parameters where useful.

Examples:

```text
/projects?status=ACTIVE&agency=...
/roadsync/conflicts?severity=HIGH
/assets?condition=WARNING
```

Benefits:

- shareable state
- browser navigation
- consistent UX

Do not put confidential values into URL parameters.

Define naming conventions.

---

# 21. DEFINE PAGE STATE STANDARDS

Every page should plan:

## Loading
## Empty
## Error
## Forbidden
## Success
## Partial Data

Examples:

```text
No projects found
No active conflicts
No inspections assigned
No documents uploaded
```

Provide useful CTAs where permitted.

---

# 22. DEFINE ACCESSIBILITY REQUIREMENTS

Navigation architecture must support:

- keyboard navigation
- skip-to-content
- clear landmarks
- accessible breadcrumbs
- focus management
- semantic headings
- labels
- accessible drawers/dialogs
- screen-reader status announcements

---

# 23. DEFINE COLOR USAGE IN NAVIGATION / STATUS ARCHITECTURE

Use the locked Sri Lankan flag-inspired INFRAOS palette carefully.

## Navigation

Primary active state:

```text
#FF5B00
```

Use neutral sidebar surfaces.

Avoid rainbow navigation.

## Pending / Attention

```text
#FEB600
```

## Critical / Conflict

```text
#8C1F28
```

## Completed / Healthy / Resolved

```text
#279541
```

Do not rely on color alone.

Always combine status colors with:

- icon
- text label
- badge
- pattern/shape where appropriate

---

# 24. DEFINE URL / ROUTE NAMING RULES

Rules:

- lowercase
- kebab-case where multiple words are needed
- plural resource names
- stable IDs for detail routes
- no verbs unless route is genuinely action-oriented
- avoid deeply nested URLs

Good:

```text
/projects/[id]/milestones
/roadsync/conflicts/[id]
```

Avoid:

```text
/project/manage/edit/details/[id]/milestone/list
```

---

# 25. DEFINE ROUTE ACCESS POLICY TABLE

Create:

```text
Route Pattern
Public / Protected
Required Permission
Scope
Allowed Roles
Fallback Behavior
```

Examples:

```text
/public-projects/* → Public
/projects/* → Protected
/admin/* → Protected + privileged
```

Do not use allowed-role lists as the only future backend authorization model; map them to permissions.

---

# 26. DEFINE NEXT.JS ROUTE GROUP STRATEGY

Plan route groups conceptually.

Example:

```text
app/
├── (public)/
├── (auth)/
├── (app)/
└── (admin)/
```

Potential:

```text
(app)/
├── dashboard/
├── projects/
├── roadsync/
├── map/
├── contractors/
├── inspections/
├── assets/
├── documents/
├── issues/
├── reports/
├── notifications/
├── profile/
└── settings/
```

Do not implement the full folder structure yet unless Step 5 specifically requires a tiny route-map stub for documentation.

Planning/documentation is enough.

---

# 27. DEFINE SEO / PUBLIC METADATA PLAN

Only public pages need meaningful SEO focus.

Plan:

- title
- description
- OpenGraph
- canonical URLs where appropriate
- public project metadata carefully

Protected application pages should not be indexed.

---

# 28. DEFINE ANALYTICS / PRIVACY BOUNDARIES

Do not plan analytics that expose:

- confidential project data
- document names
- citizen issue details
- sensitive search terms

If analytics is used later, limit it to safe product metrics.

---

# 29. STEP 5 REQUIRED DELIVERABLES

Create/update:

```text
/docs/ux/information-architecture.md
/docs/ux/page-inventory.md
/docs/ux/route-map.md
/docs/ux/navigation-by-role.md
/docs/ux/project-detail-architecture.md
/docs/ux/roadsync-information-architecture.md
/docs/ux/dashboard-information-architecture.md
/docs/ux/map-information-architecture.md
/docs/security/route-access-policy.md
```

Create Mermaid navigation/page hierarchy diagrams where useful.

---

# 30. POST-STEP REVIEW

Review:

```text
STEP 5 POST-REVIEW

Public Routes:
- ...

Auth Routes:
- ...

Protected Routes:
- ...

Admin Routes:
- ...

Role Navigation:
- ...

Route Permission Coverage:
- ...

Missing Workflow Pages:
- ...

Duplicate / Unnecessary Pages Removed:
- ...

Mobile Navigation Risks:
- ...

Accessibility Risks:
- ...

Route Inconsistencies Fixed:
- ...

Open Decisions:
- ...
```

Cross-check all routes against:

- module list
- user workflows
- permission matrix
- MVP priorities

---

# 31. STEP 5 ACCEPTANCE CRITERIA

Step 5 is complete only if:

- all product surfaces are defined
- complete page inventory exists
- routes are consistently named
- role-aware navigation exists
- route access policy exists
- project detail architecture exists
- RoadSync architecture exists
- map UX architecture exists
- dashboard IA exists
- mobile navigation behavior exists
- breadcrumbs exist
- page header standard exists
- loading/empty/error patterns are planned
- accessibility is considered
- route priorities are marked
- no unnecessary route explosion exists
- no production page implementation has prematurely started

Stop after Step 5.

---

---

# STEP 6 — TEAM DEVELOPMENT & GIT STRATEGY

## CURSOR AGENT PROMPT

You are acting as a:

- Senior Technical Lead
- Git/GitHub Workflow Architect
- Integration Engineer
- DevOps Engineer
- Code Review Lead
- Team Project Mentor
- Release Manager

Perform:

# STEP 6 — TEAM DEVELOPMENT & GIT STRATEGY

The goal is to create a safe development workflow for a multi-member university team working on one integrated codebase.

The workflow must:

- reduce merge conflicts
- preserve architecture
- make each member’s contribution visible
- keep `main` stable
- support review
- avoid teammates accidentally rewriting one another’s modules
- support team-leader integration ownership

Do not implement product features in this step.

---

# 1. PRE-STEP REVIEW

Inspect:

- current repository
- `git status`
- branches
- remotes
- `.gitignore`
- existing GitHub workflow files
- package/workspace structure
- architecture docs
- team integration docs

Return:

```text
STEP 6 PRE-REVIEW

Current Branch:
- ...

Existing Branches:
- ...

Remote:
- ...

Current Git Strategy:
- ...

Existing CI:
- ...

Potential Merge-Conflict Areas:
- ...

Architecture Shared Files:
- ...

Plan:
1.
2.
3.
...
```

Do not rewrite Git history.

Do not force-push.

Do not delete remote branches without explicit approval.

---

# 2. LOCK TEAM OWNERSHIP

Use this ownership model unless user provides final member names later.

## Team Leader — Core Platform Developer / Integrator

Primary ownership:

### ProjectTrace
- lifecycle
- project APIs
- milestones
- progress
- dependencies
- timeline
- dashboard integration

### RoadSync
- work request
- geographic conflict logic
- schedule overlap
- conflict engine
- coordination
- resolution
- integration

### Platform Integration
- architecture
- shared API rules
- database standards
- auth integration
- RBAC integration
- shared security
- shared types
- final merge/integration
- deployment integration

---

## Member 2

Primary ownership:

**InfraMap**

---

## Member 3

Primary ownership:

**AI Risk Intelligence**

---

## Member 4

Primary ownership:

**DocTrace + RAG**

---

## Member 5

Primary ownership:

**Finance + Contractor + Asset**

---

## Member 6

Primary ownership:

**Citizen Portal + Issue Management**

If the real team size differs, create a clearly editable ownership table.

---

# 3. DEFINE SHARED OWNERSHIP RULE

Some files are shared and require extra care.

Examples:

```text
package.json
workspace configuration
shared types
environment schema
API router registration
app navigation
design tokens
database connection
authentication core
authorization middleware
global layout
CI configuration
```

Rule:

> Team members should not casually modify shared/core files as part of feature work.

If a feature needs a shared-file change:

1. document why
2. make the smallest change
3. notify/review with team leader
4. include it clearly in PR description

---

# 4. LOCK BRANCH STRATEGY

Use:

```text
main
development
feature/*
fix/*
chore/*
docs/*
```

## `main`

Production/submission-ready branch.

Rules:

- stable
- reviewed
- no direct feature development
- merge from approved integration flow
- protect if GitHub settings allow

## `development`

Primary integration branch during development.

Rules:

- all tested feature work eventually integrates here
- should remain runnable
- should not intentionally contain broken experimental work

## Feature Branches

Examples:

```text
feature/authentication
feature/project-trace
feature/roadsync
feature/inframap
feature/ai-risk
feature/doctrace
feature/contractor-finance
feature/assets
feature/citizen-portal
feature/notifications
```

Do not create one branch per tiny UI button.

---

# 5. DEFINE MEMBER BRANCH RULE

A team member should work on:

```text
feature/<module-or-task>
```

starting from latest `development`.

Example:

```bash
git checkout development
git pull
git checkout -b feature/inframap
```

Do not encourage everyone to work directly on `development`.

---

# 6. DEFINE FEATURE BRANCH LIFECYCLE

Use:

```text
Update development
↓
Create feature branch
↓
Implement small coherent work
↓
Local review
↓
Lint / Type-check / Tests / Build
↓
Commit
↓
Push feature branch
↓
Pull Request → development
↓
Review
↓
Fix issues
↓
Merge
↓
Delete merged local/remote feature branch if appropriate
```

Do not merge broken feature branches.

---

# 7. DEFINE PULL REQUEST STANDARD

Every PR should include:

```text
Title
Summary
Related Step / Feature
Module Owner
Files / Areas Changed
Database Changes
API Changes
UI Changes
Security Changes
Testing Done
Screenshots if UI
Known Limitations
Review Notes
```

Create a PR template.

Suggested path:

```text
.github/pull_request_template.md
```

---

# 8. DEFINE COMMIT CONVENTION

Use Conventional Commit-style prefixes.

Examples:

```text
feat: add project lifecycle service
feat(roadsync): implement date overlap detection
fix(auth): reject disabled user sessions
refactor(projects): simplify project query service
test(roadsync): add conflict severity cases
docs: document route access rules
chore: update lint configuration
```

Commit rules:

- clear
- focused
- meaningful
- no “update”
- no “final”
- no “changes”
- no huge unrelated commit where avoidable

---

# 9. DEFINE COMMIT SIZE GUIDELINE

Prefer:

- one coherent behavior
- one bug fix
- one architecture/document change

Avoid:

```text
500 unrelated file changes
feature + unrelated redesign + dependency upgrade + refactor
```

Do not over-fragment trivial changes either.

---

# 10. DEFINE CODE REVIEW CHECKLIST

Create review checklist covering:

## Functionality

- requirement met
- edge cases
- correct workflow

## Architecture

- module boundary respected
- no duplicate service
- no circular dependency
- shared code justified

## Security

- backend authorization
- validation
- IDOR
- secrets
- file access
- AI access where applicable

## Database

- index impact
- relationship
- migration/seed implications
- GeoJSON correctness where relevant

## UI

- INFRAOS palette
- responsive
- accessible
- loading
- empty
- error
- success

## Testing

- relevant tests
- build
- lint
- type-check

## Documentation

- API/docs updated

---

# 11. DEFINE TEAM LEADER REVIEW RESPONSIBILITIES

Team leader should specifically review:

- shared architecture
- cross-module integration
- API consistency
- database naming
- auth/RBAC usage
- security-sensitive logic
- shared types
- main navigation
- CI
- deployment

Team leader should not unnecessarily rewrite each member’s module.

Review and guide rather than replacing contributions.

---

# 12. DEFINE CODE OWNERSHIP DOCUMENT

Create:

```text
/docs/team/module-ownership.md
```

Include:

```text
Module
Primary Owner
Secondary Reviewer
Shared Dependencies
Protected Shared Files
Integration Contact
```

If member names are unknown, use placeholders.

---

# 13. DEFINE MERGE CONFLICT STRATEGY

When conflicts occur:

1. do not accept “ours” or “theirs” blindly
2. understand both changes
3. preserve architecture
4. preserve intentional feature work
5. run checks after resolution
6. document important manual resolutions

For conflicts in core files:

- team leader or designated integrator should participate

---

# 14. DEFINE REBASE / MERGE POLICY

For a student team, keep it simple.

Recommended:

- feature branches may update from `development`
- use merge or rebase consistently
- do not rewrite shared public history casually
- avoid forced pushes on shared branches

Document chosen policy.

A safe default:

```text
feature branch
→ periodically merge latest development
→ PR squash merge into development
```

or:

```text
feature branch
→ rebase before PR only if team understands rebase safely
```

Choose one approach and document why.

Do not prescribe complex Git workflows the team cannot maintain.

---

# 15. DEFINE PROTECTED BRANCH RULES

If GitHub supports it, recommend:

## main

- pull request required
- no direct force-push
- required status checks
- at least one review if feasible

## development

- PR preferred
- CI checks
- no force-push

If protection cannot be configured due to plan/repository limits, document equivalent team rules.

---

# 16. DEFINE CI GATES

Plan GitHub Actions to eventually run:

```text
install
lint
type-check
tests
build
```

Later, separate web/API/AI jobs if useful.

Do not build complex CI before project setup step.

For this step, create CI strategy documentation only unless a simple placeholder workflow is explicitly appropriate.

---

# 17. DEFINE ENVIRONMENT FILE RULE

Never commit:

```text
.env
.env.local
.env.production
private keys
API secrets
database credentials
service credentials
```

Commit:

```text
.env.example
```

The example should contain variable names only, not real values.

---

# 18. DEFINE DEPENDENCY CHANGE RULE

When adding a package:

PR must explain:

```text
Package:
Why needed:
Alternative considered:
Security/maintenance concern:
Bundle/runtime impact:
```

Avoid duplicate libraries.

Examples:

Do not use:

- two date libraries
- two validation libraries
- multiple HTTP clients without reason
- multiple state libraries for same responsibility

---

# 19. DEFINE DATABASE CHANGE WORKFLOW

Before changing a shared model/schema:

1. identify dependent modules
2. document field change
3. update shared types
4. update validation
5. update API docs
6. update seed/demo data
7. run affected tests

Do not make breaking schema changes silently.

---

# 20. DEFINE API CHANGE WORKFLOW

Breaking API changes require:

- clear PR note
- updated docs
- updated frontend consumer
- updated tests
- compatibility consideration

Use `/api/v1`.

Do not invent inconsistent response formats per team member.

---

# 21. DEFINE UI DESIGN CONSISTENCY RULE

All contributors must use the same INFRAOS design system.

Locked brand colors:

```text
#FF5B00
#FEB600
#8C1F28
#279541
```

Use shared:

- typography
- spacing
- status badges
- buttons
- forms
- cards
- tables
- dialog patterns

Do not create module-specific random themes.

---

# 22. DEFINE SHARED COMPONENT RULE

Before adding a component:

Search existing:

```text
components/ui
components/common
feature components
```

Do not duplicate:

- button
- modal
- table
- form input
- status badge
- pagination
- empty state
- error state

Feature-specific components stay within feature modules unless truly reusable.

---

# 23. DEFINE SHARED TYPE RULE

Cross-module domain types should have clear ownership.

Examples:

- User
- Role
- Agency
- ProjectStatus
- Permission
- API response types

Avoid creating slightly different versions in every feature.

Do not create one giant `types.ts` containing the entire application.

---

# 24. DEFINE TASK HANDOFF STANDARD

When a member says a feature is complete, require a handoff note:

```text
Feature:
Branch:
Owner:

Implemented:
- ...

API:
- ...

Database:
- ...

UI:
- ...

Security:
- ...

Tests:
- ...

Known Issues:
- ...

Manual Test Steps:
1.
2.
3.

Integration Notes:
- ...
```

This helps the team leader integrate work safely.

---

# 25. DEFINE CURSOR / AI CODING RULE

Because multiple team members may use Cursor/AI:

AI agent must:

- inspect existing code first
- not rewrite unrelated files
- follow architecture docs
- use module ownership
- reuse components
- run checks
- review diff
- report changed files
- stop after requested task

Do not allow AI agents to perform giant “improve entire project” rewrites during normal feature development.

---

# 26. DEFINE PRE-MERGE REVIEW

Before PR merge:

```text
git status
git diff
lint
type-check
tests
build
```

Where available.

Also manually check:

- app starts
- key page loads
- feature works
- authorization is correct
- no secret in diff
- no debug logs
- no accidental generated files

---

# 27. DEFINE POST-MERGE INTEGRATION CHECK

After important merges into `development`:

- pull latest
- clean install if dependencies changed
- start frontend
- start backend
- verify DB connection
- verify key route
- verify authentication if available
- run integration tests
- check console/server errors

Do not wait until the final week for integration.

---

# 28. DEFINE RELEASE FLOW

Recommended:

```text
Feature Branches
      ↓
development
      ↓
Integration / QA
      ↓
main
      ↓
Production / Submission
```

Do not use `main` as day-to-day experimentation.

---

# 29. DEFINE RELEASE VERSIONING

For academic project, keep versioning simple.

Possible:

```text
v0.1.0 — foundation
v0.2.0 — authentication
v0.3.0 — ProjectTrace
v0.4.0 — RoadSync
v0.5.0 — InfraMap
v0.6.0 — supporting modules
v0.7.0 — AI
v0.9.0 — release candidate
v1.0.0 — final submission
```

Do not create meaningless releases for every commit.

---

# 30. DEFINE HOTFIX RULE

For critical bug on `main`:

```text
main
↓
fix/<issue>
↓
review/test
↓
merge to main
↓
also merge/backport to development
```

Use only for truly critical production/submission issues.

---

# 31. DEFINE GITIGNORE EXPECTATIONS

Verify later that `.gitignore` covers:

- dependencies
- build output
- environment secrets
- local logs
- OS files
- IDE local files where appropriate
- Python virtual environments
- Python cache
- test artifacts where appropriate

Do not ignore useful source/config files accidentally.

---

# 32. DEFINE DOCUMENTATION OWNERSHIP

Every major module owner must update related documentation.

Examples:

InfraMap owner:
- map API/docs
- GIS notes

AI Risk owner:
- model/input/output docs

DocTrace owner:
- document flow/RAG docs

Team leader:
- core architecture
- integration
- README
- deployment coordination

---

# 33. DEFINE TEAM COMMUNICATION CADENCE

Keep this lightweight.

Recommended:

- short progress check
- blockers
- integration changes
- upcoming shared-file edits
- PR status

Avoid creating unnecessary project-management overhead.

---

# 34. DEFINE DEVELOPMENT DEFINITION OF DONE

A feature is not “done” because code exists.

Definition of Done:

```text
Requirement implemented
↓
Architecture followed
↓
Validation handled
↓
Authorization handled
↓
Responsive UI handled
↓
Errors/loading/empty states handled
↓
Tests updated
↓
Lint/type-check/build pass
↓
Documentation updated
↓
PR reviewed
↓
Merged
↓
Integration verified
```

---

# 35. CREATE TEAM WORKFLOW DIAGRAM

Create Mermaid diagram:

```text
Task Assigned
↓
Feature Branch
↓
Implementation
↓
Self Review
↓
Tests
↓
PR
↓
Code Review
↓
Fixes
↓
Merge to Development
↓
Integration Test
↓
Release to Main
```

---

# 36. REQUIRED DELIVERABLES

Create/update:

```text
/docs/team/git-workflow.md
/docs/team/module-ownership.md
/docs/team/code-review-checklist.md
/docs/team/definition-of-done.md
/docs/team/feature-handoff-template.md
/docs/team/dependency-change-policy.md
/docs/team/shared-files-policy.md
/docs/team/release-process.md
```

Create/update:

```text
CONTRIBUTING.md
```

Create:

```text
.github/pull_request_template.md
```

Optionally create issue templates if genuinely helpful, but do not overcomplicate the repository.

---

# 37. POST-STEP REVIEW

Review:

```text
STEP 6 POST-REVIEW

Branch Strategy:
- ...

Module Ownership:
- ...

Shared File Rules:
- ...

PR Rules:
- ...

Code Review:
- ...

CI Gates:
- ...

Security / Secret Rules:
- ...

Database/API Change Rules:
- ...

Merge Conflict Strategy:
- ...

Release Flow:
- ...

Documentation Created:
- ...

Risks / Open Questions:
- ...

Existing Git Configuration Conflicts:
- ...

Issues Fixed:
- ...
```

Review actual Git status again.

Do not commit or push unless explicitly requested.

---

# 38. STEP 6 ACCEPTANCE CRITERIA

Step 6 is complete only if:

- branch strategy is documented
- `main` and `development` responsibilities are clear
- feature branch naming is defined
- team ownership is documented
- team leader integration responsibility is preserved
- shared-file policy exists
- PR template exists
- commit convention exists
- code-review checklist exists
- dependency change rules exist
- DB/API change rules exist
- merge-conflict strategy exists
- CI expectations exist
- secret/environment rules exist
- feature handoff template exists
- definition of done exists
- release flow exists
- CONTRIBUTING.md exists
- no product feature coding was introduced
- Git history was not rewritten
- no force-push was performed

Stop after Step 6.

---

# FINAL STEPS 4–6 CONSISTENCY REVIEW

After completing Steps 4, 5, and 6 individually, perform one final documentation-only consistency review.

Do not implement new features.

Verify alignment between:

```text
Step 1 — Requirements
Step 2 — Technology Decisions
Step 3 — Architecture
Step 4 — Permissions
Step 5 — Routes / Navigation
Step 6 — Team Workflow
```

Check:

## Authorization vs Routes

Every protected route should have:

- permission expectation
- scope expectation
- correct target role

## Route vs Module

Every important P0/P1 module should have a logical UI location.

## Module vs Ownership

Every major module should have a primary development owner.

## Ownership vs Shared Files

No member should be forced to frequently edit the same core files without coordination.

## Security

No route/navigation rule should imply frontend-only authorization.

## Color / Product Identity

The route and UX documentation should reference the locked INFRAOS Sri Lankan flag-inspired palette rather than the old navy/orange palette.

## Scope

No P3 future feature should accidentally become mandatory for MVP.

---

# FINAL REPORT FORMAT

Return:

```text
STEPS 4–6 FOUNDATION COMPLETE

STEP 4 — Roles & Permissions:
✅ / ⚠️

STEP 5 — Information Architecture:
✅ / ⚠️

STEP 6 — Team & Git Strategy:
✅ / ⚠️

DOCUMENTS CREATED:
- ...

DOCUMENTS UPDATED:
- ...

INCONSISTENCIES FOUND:
- ...

INCONSISTENCIES FIXED:
- ...

OPEN DECISIONS:
- ...

GIT CHANGES:
- ...

APPLICATION FEATURE CODE CREATED:
YES / NO

NEXT STEP:
Step 7 — Initialize Full Project Repository
```

The expected answer for application feature code should normally be:

```text
NO
```

Steps 4–6 exist to make the implementation safer and more consistent before repository/application setup begins.

---

# IMPORTANT FINAL RULE

Do not continue to Step 7 automatically.

Stop after the requested step or requested step range.

Wait for explicit instruction before beginning project initialization.
