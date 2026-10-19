# INFRAOS — Enhanced Cursor Prompts
## Steps 13–15: Complete Database Models, GeoJSON/Indexes/Constraints, Seed & Demo Data Architecture

**Project:** INFRAOS — National Infrastructure Intelligence & Coordination Platform  
**Vision:** The Operating System for National Infrastructure  
**Core Lifecycle:** Plan → Coordinate → Approve → Build → Verify → Monitor → Complete → Maintain  
**Development Window:** 45–60 days  
**Primary Development Assistant:** Cursor AI

---

# HOW TO USE THIS FILE

Execute in order:

1. **Step 13 — Complete INFRAOS Database Models**
2. **Step 14 — Database Indexes, GeoJSON & Constraints**
3. **Step 15 — Seed & Demo Data Architecture**

For every step:

- Follow `CURSOR_STEP_EXECUTION_RULES.md` if present.
- Read the approved INFRAOS planning, architecture, security, database, UX, and team docs first.
- Inspect the repository before changing anything.
- Perform a **PRE-STEP REVIEW**.
- Work only on the current step.
- Use a dedicated Git branch for the step.
- Run lint, type-check, tests, and build where applicable.
- Perform a **POST-IMPLEMENTATION REVIEW**.
- Fix issues caused by the step.
- Re-run checks.
- Update documentation.
- Review `git status`, `git diff`, and `git diff --check`.
- Stop before the next step.

---

# MANDATORY GIT / BRANCH WORKFLOW

INFRAOS uses a separate branch for each development phase or major feature.

Normal flow:

```text
feature/<step-or-feature>
        ↓
development
        ↓
full integration/regression review
        ↓
main
```

`main` must remain stable/submission-ready. `development` is the integration branch.

Use these branches:

```text
Step 13 → feature/step-13-database-models
Step 14 → feature/step-14-database-indexes-geojson
Step 15 → feature/step-15-seed-demo-data
```

Before each step:

```bash
git checkout development
git pull
git status
git checkout -b feature/<step-name>
```

Before merge/review:

```bash
git status
git diff
git diff --check
npm run lint
npm run type-check
npm run test
npm run build
```

Normal merge target:

```text
feature/* → development
```

After a feature branch is integrated into `development`, run the affected regression checks again.

After **all Steps 13–15** are stable, reviewed, and integrated, the team may merge:

```text
development → main
```

only after explicit user/team approval.

Do **not** automatically push, merge, delete remote branches, force-push, or rewrite Git history.

---

# REVALIDATED DATABASE SCOPE

INFRAOS Version 1 uses:

```text
MongoDB Atlas
Mongoose
GeoJSON
2dsphere indexes where required
```

The planned collections are:

```text
users
roles
agencies
refreshSessions

projects
milestones
workRequests
conflicts
coordinationRequests
contractors
projectPayments
documents
documentChunks
inspections
assets
maintenanceRecords
citizenIssues
notifications
riskAssessments
auditLogs
```

Steps 10–12 already established environment configuration, MongoDB connection, and the core identity/organization models (`User`, `Role`, `Agency`, and refresh-session foundation where applicable).

Steps 13–15 must complete the domain data layer without prematurely implementing business APIs or UI.

---

# CORE DATABASE PRINCIPLES

1. Keep MongoDB + Mongoose as the Version 1 source of truth.
2. Do not add PostgreSQL, Firebase, MySQL, Redis, or another application database.
3. Use references for entities with independent lifecycles.
4. Do not embed full duplicated User/Agency/Contractor objects in every record.
5. Use BSON dates, not formatted date strings.
6. Use standard GeoJSON with `[longitude, latitude]` ordering.
7. Add indexes only for real query patterns.
8. Do not rely on Mongoose validation as the only API-input validation layer.
9. Do not expose raw MongoDB/Mongoose errors to clients.
10. Automated tests must never use the production database.
11. Do not weaken schemas just to make demo seeding easier.
12. Demo records must be clearly synthetic/prototype data.
13. Do not store plaintext passwords or refresh tokens.
14. Do not store secrets in audit logs.
15. AI data must never directly become official approval/status without human workflow.
16. RoadSync's core conflict detection must remain deterministic and explainable.

---

# STEP 13 — COMPLETE INFRAOS DATABASE MODELS

## CURSOR AGENT PROMPT

Act as a **Senior MongoDB Data Architect, Mongoose Engineer, Domain Model Architect, Backend Architect, Security Engineer, GIS-Aware Data Engineer, and QA Engineer**.

Perform **Step 13 — Complete INFRAOS Database Models**.

The goal is to implement all remaining approved INFRAOS domain models while preserving the models created in Step 12.

Do **not** build feature APIs, UI, authentication workflows, ProjectTrace services, RoadSync business logic, or AI endpoints in this step.

---

## 1. PRE-STEP REVIEW

Inspect:

```text
/docs/planning/
/docs/architecture/
/docs/security/
/docs/database/
/docs/team/
/apps/api/src/
```

Read especially:

```text
project scope
business rules
module boundaries
RoadSync architecture
InfraMap architecture
file/document architecture
AI/RAG architecture
notification/audit architecture
roles/permissions
resource authorization
core models from Step 12
```

Inspect existing:

```text
User
Role
Agency
RefreshSession
Mongoose conventions
enum/constants conventions
test DB strategy
```

Return:

```text
STEP 13 PRE-REVIEW

Current Branch:
Existing Core Models:
Existing Database Conventions:
Existing Enums:
Existing Indexes:
Models Required In Step 13:
Potential Model Conflicts:
Cross-Module Dependencies:
Security Concerns:
Files Expected To Change:

Implementation Plan:
1.
2.
3.
...
```

Do not code before completing this review.

---

## 2. BRANCH PREPARATION

Use:

```bash
git checkout development
git pull
git status
git checkout -b feature/step-13-database-models
```

If the branch already exists, inspect it instead of recreating it blindly.

Record the starting commit.

---

## 3. IMPLEMENT THESE MODELS

Create/complete:

```text
Project
Milestone
WorkRequest
Conflict
CoordinationRequest
Contractor
ProjectPayment
Document
DocumentChunk
Inspection
Asset
MaintenanceRecord
CitizenIssue
Notification
RiskAssessment
AuditLog
```

Reuse existing `User`, `Role`, `Agency`, and `RefreshSession` models.

---

# PROJECTTRACE MODELS

## 4. PROJECT MODEL

Preserve the approved project fields:

```text
_id
projectCode
title
description
projectType
agencyId
managerId
contractorId
location
geometry
startDate
plannedEndDate
actualEndDate
budget
physicalProgress
financialProgress
status
riskScore
createdBy
createdAt
updatedAt
```

Only add fields when clearly justified, for example:

```text
actualStartDate
approvedAt
approvedBy
completedAt
updatedBy
priority
publicVisibility
```

Do not silently add large sets of speculative fields.

### Project code

`projectCode` must be stable, human-readable, unique, and indexed later.

Example style:

```text
INF-ROAD-0001
INF-WATER-0002
```

The service layer should later generate codes safely. Do not create fragile race-prone counters inside the schema unless architecture explicitly supports it.

### Project type

Use controlled values such as:

```text
ROAD
WATER
ELECTRICITY
TELECOM
DRAINAGE
BRIDGE
BUILDING
PUBLIC_FACILITY
MULTI_INFRASTRUCTURE
OTHER
```

### Project status

Use the approved lifecycle:

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
```

Schema restricts allowed values; future ProjectTrace service controls valid transitions.

### References

Use references:

```text
agencyId → Agency
managerId → User
contractorId → Contractor
```

`agencyId` should normally be required. `managerId` and `contractorId` may be optional in early lifecycle states.

### Geometry

Use standard GeoJSON capable of the approved use cases:

```text
Point
LineString
Polygon
```

Coordinates are always:

```text
[longitude, latitude]
```

Do not duplicate incompatible coordinate formats.

### Location

If `location` remains separate from `geometry`, give it a clear human-readable role such as:

```text
district
province
locality
roadName
description
```

Do not make both fields competing geometry sources.

### Dates

Use BSON dates.

Important future rule:

```text
plannedEndDate >= startDate
```

Cross-field business rules should also be enforced later in request/service validation.

### Budget / money

Choose one consistent money representation across Project, Payment, and Maintenance.

Prefer a strategy the team can implement reliably, such as:

```text
integer smallest unit + currency
```

or a documented Decimal128 approach.

Do not mix different money representations between models.

### Progress

Bound:

```text
physicalProgress: 0–100
financialProgress: 0–100
```

Clarify whether financial progress is stored/cached or derived from payments. Avoid two uncontrolled sources of truth.

### Risk score

If `riskScore` is stored on Project, treat it as the latest summary only. Full history belongs in `RiskAssessment`.

---

## 5. MILESTONE MODEL

Preserve:

```text
_id
projectId
title
description
plannedStart
plannedEnd
actualStart
actualEnd
progress
status
```

Useful additions only if required:

```text
sequence
weight
createdBy
updatedBy
```

Use status values such as:

```text
NOT_STARTED
IN_PROGRESS
COMPLETED
DELAYED
BLOCKED
CANCELLED
```

Bound progress to `0–100`.

---

# ROADSYNC MODELS

## 6. WORK REQUEST MODEL

Preserve:

```text
_id
projectId
agencyId
geometry
workType
plannedStart
plannedEnd
status
priority
```

Possible justified additions:

```text
title
description
submittedBy
affectedInfrastructure[]
createdAt
updatedAt
```

Use stable work types such as:

```text
ROAD_RESURFACING
ROAD_EXCAVATION
PIPELINE_INSTALLATION
ELECTRIC_CABLE_WORK
TELECOM_CABLE_WORK
DRAINAGE_WORK
UTILITY_REPAIR
BRIDGE_WORK
OTHER
```

Recommended statuses:

```text
DRAFT
SUBMITTED
PLANNED
APPROVED
ACTIVE
COMPLETED
CANCELLED
```

Priority:

```text
LOW
NORMAL
HIGH
CRITICAL
```

Use GeoJSON geometry. Road work will often use `LineString`.

---

## 7. CONFLICT MODEL

Preserve:

```text
_id
workRequestA
workRequestB
conflictType
distance
scheduleOverlap
severity
status
resolution
resolvedBy
resolvedAt
```

Optional justified additions:

```text
detectedAt
resolutionNotes
```

Use references:

```text
workRequestA → WorkRequest
workRequestB → WorkRequest
```

Prevent a work request conflicting with itself.

Conflict types may include:

```text
GEOGRAPHIC_OVERLAP
NEARBY_WORK
SCHEDULE_OVERLAP
UTILITY_INTERFERENCE
ACCESS_CONFLICT
MULTI_FACTOR
```

Severity:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

Status:

```text
OPEN
COORDINATION_PENDING
UNDER_REVIEW
RESOLVED
CLOSED
DISMISSED
```

Define `scheduleOverlap` clearly, for example:

```text
boolean + optional overlapDays
```

Do not make conflict type/severity an unvalidated free-form AI field.

---

## 8. COORDINATION REQUEST MODEL

Preserve:

```text
_id
conflictId
fromAgency
toAgency
message
status
response
createdAt
```

Possible additions if the workflow needs them:

```text
respondedBy
respondedAt
proposedStartDate
proposedEndDate
updatedAt
```

Recommended statuses:

```text
PENDING
ACCEPTED
COUNTER_PROPOSED
REJECTED
CANCELLED
```

---

# CONTRACTOR / FINANCE MODELS

## 9. CONTRACTOR

Preserve:

```text
_id
name
registrationNumber
contact
rating
activeProjects
completedProjects
riskLevel
```

Review whether project counts should be derived rather than stored to avoid stale values.

Useful normalized fields may include:

```text
contactEmail
contactPhone
address
status
```

Risk level may use:

```text
LOW
MEDIUM
HIGH
```

Never present risk as proof of wrongdoing.

---

## 10. PROJECT PAYMENT

Preserve:

```text
_id
projectId
contractorId
amount
paymentType
status
approvedBy
date
```

Possible additions:

```text
referenceNumber
description
createdBy
createdAt
updatedAt
```

Use the same money representation selected for Project budget.

Status may include:

```text
PENDING
APPROVED
REJECTED
PAID
CANCELLED
```

Do not encode contractor self-approval as valid behavior.

---

# DOCTRACE MODELS

## 11. DOCUMENT

Preserve:

```text
_id
projectId
documentType
fileName
storageUrl
uploadedBy
extractedTextStatus
createdAt
```

Useful additions only when needed:

```text
originalFileName
mimeType
sizeBytes
storageKey
checksum
visibility
processingErrorCode
updatedAt
```

Do not store large binaries in MongoDB.

Do not place extracted document text inside the Project collection.

Document types may include:

```text
CONTRACT
TENDER
BOQ
INVOICE
APPROVAL
PROGRESS_REPORT
INSPECTION_REPORT
DRAWING
OTHER
```

Processing status:

```text
NOT_STARTED
QUEUED
PROCESSING
COMPLETED
FAILED
UNSUPPORTED
```

Optional visibility:

```text
INTERNAL
PROJECT_TEAM
PUBLIC
```

---

## 12. DOCUMENT CHUNK

Preserve:

```text
_id
documentId
projectId
chunkIndex
content
embeddingReference
```

Possible metadata:

```text
pageNumber
section
tokenCount
createdAt
```

Do not require embeddings for normal document storage.

Do not store provider secrets.

---

# INSPECTION MODEL

## 13. INSPECTION

Preserve:

```text
_id
projectId
inspectorId
inspectionDate
physicalProgress
status
notes
evidence[]
```

Possible justified fields:

```text
scheduledBy
submittedAt
verifiedAt
createdAt
updatedAt
```

Status:

```text
SCHEDULED
IN_PROGRESS
SUBMITTED
VERIFIED
REQUIRES_REVIEW
REJECTED
CANCELLED
```

`physicalProgress` must remain `0–100`.

Evidence should store metadata/references, not binary files.

---

# ASSET LIFECYCLE MODELS

## 14. ASSET

Preserve:

```text
_id
sourceProjectId
assetType
name
location
condition
healthScore
commissionedAt
lastInspectionAt
nextMaintenanceAt
```

Add `geometry`, `agencyId`, or `status` only if justified by InfraMap/ownership needs.

Condition values:

```text
EXCELLENT
GOOD
FAIR
POOR
CRITICAL
UNKNOWN
```

Health score: `0–100`.

Health score is decision support, not an automatic maintenance decision.

---

## 15. MAINTENANCE RECORD

Preserve:

```text
_id
assetId
maintenanceType
scheduledDate
completedDate
cost
status
```

Possible additions:

```text
description
assignedAgency
notes
createdAt
updatedAt
```

Status:

```text
PLANNED
SCHEDULED
IN_PROGRESS
COMPLETED
OVERDUE
CANCELLED
```

Use the same money representation as project/finance data.

---

# CITIZEN ISSUE MODEL

## 16. CITIZEN ISSUE

Preserve:

```text
_id
citizenId
category
description
location
photos[]
assignedAgency
status
priority
createdAt
```

Possible additions:

```text
geometry
referenceCode
updatedAt
resolvedAt
```

Categories may include:

```text
POTHOLE
ROAD_DAMAGE
WATER_LEAK
DRAINAGE
STREET_LIGHT
UTILITY_DAMAGE
PUBLIC_ASSET_DAMAGE
OTHER
```

Status:

```text
SUBMITTED
ASSIGNED
IN_REVIEW
IN_PROGRESS
RESOLVED
CLOSED
REJECTED
```

Do not store unnecessary citizen personal data.

---

# NOTIFICATION MODEL

## 17. NOTIFICATION

Preserve:

```text
_id
userId
type
title
message
resourceType
resourceId
isRead
createdAt
```

Possible:

```text
readAt
priority
```

Types may include:

```text
CONFLICT
COORDINATION
RISK
APPROVAL
MILESTONE
INSPECTION
CITIZEN_ISSUE
SYSTEM
```

`resourceType/resourceId` is application-managed polymorphic linking. Never let user input decide arbitrary Mongoose model names for population.

---

# RISK ASSESSMENT MODEL

## 18. RISK ASSESSMENT

Preserve:

```text
_id
projectId
overallRisk
delayRisk
budgetRisk
scheduleRisk
factors[]
recommendations[]
modelVersion
createdAt
```

Choose one consistent score scale, preferably `0–100`, with optional derived category:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

Store structured validated AI/ML results, not uncontrolled free-form output as official state.

Historical assessments must remain queryable.

---

# AUDIT MODEL

## 19. AUDIT LOG

Preserve:

```text
_id
userId
action
resourceType
resourceId
oldValue
newValue
ipAddress
userAgent
timestamp
```

Possible additions:

```text
requestId
agencyId
metadata
```

Never audit-log:

```text
password
passwordHash
access token
refresh token
reset token
API secret
full confidential document body
```

Application architecture must treat AuditLog as append-only.

---

# COMMON MODEL RULES

## 20. TIMESTAMPS

Use Mongoose timestamps consistently where appropriate.

Business timestamps such as `resolvedAt`, `inspectionDate`, and `commissionedAt` remain separate.

## 21. REFERENCES

Use ObjectId references where entities have independent lifecycles.

Do not duplicate full agency/user/contractor objects.

## 22. ENUMS

Keep module-specific enums near owning modules.

Do not create one giant constants file.

## 23. VALIDATION

Use schema-level validation for:

- required fields
- enums
- numeric bounds
- basic string bounds
- basic date types
- array limits where useful

Future HTTP APIs must still use request validation (e.g. Zod).

## 24. DELETE / ARCHIVE STRATEGY

Prefer historical preservation:

```text
User → DISABLED
Agency → INACTIVE
Contractor → INACTIVE
Project → CANCELLED / archived workflow
```

Do not hard-delete referenced government/project history casually.

## 25. MODEL OWNERSHIP

Document:

```text
ProjectTrace → Project, Milestone
RoadSync → WorkRequest, Conflict, CoordinationRequest
Contractor/Finance → Contractor, ProjectPayment
DocTrace → Document, DocumentChunk
Inspection → Inspection
Asset → Asset, MaintenanceRecord
Citizen → CitizenIssue
Notifications → Notification
AI Risk → RiskAssessment
Governance → AuditLog
```

This is important for team parallel development.

---

## 26. RELATIONSHIP DOCUMENTATION

Create/update:

```text
/docs/database/data-model.md
```

Include a Mermaid conceptual diagram for:

```text
Role ← Users
Agency ← Users
Agency ← Projects
User(Project Manager) ← Projects
Contractor ← Projects
Project ← Milestones
Project ← WorkRequests
WorkRequests ↔ Conflicts
Conflict ← CoordinationRequests
Project ← Payments
Project ← Documents
Document ← DocumentChunks
Project ← Inspections
Project ← RiskAssessments
Project → Asset
Asset ← MaintenanceRecords
User ← CitizenIssues
User ← Notifications
User ← AuditLogs
```

Do not imply MongoDB provides relational foreign-key enforcement.

---

## 27. MODEL TESTS

Use isolated/disposable test DB only.

At minimum test:

```text
Project:
- valid record
- invalid type/status rejected
- progress bounds

Milestone:
- progress bounds
- valid status

WorkRequest:
- valid work type/status
- basic GeoJSON structure

Conflict:
- severity/status
- work references

CoordinationRequest:
- status
- agency refs

Contractor:
- identifier/risk rules

ProjectPayment:
- non-negative amount
- status

Document:
- processing status

DocumentChunk:
- document/project refs

Inspection:
- progress bounds
- status

Asset:
- condition
- health score bounds

MaintenanceRecord:
- status
- non-negative cost

CitizenIssue:
- category/status/priority

Notification:
- type/read state

RiskAssessment:
- score bounds

AuditLog:
- required action/resource
```

Do not run against development or production DB.

---

## 28. NO BUSINESS API YET

Do not create feature endpoints/services just to test models.

Step 13 is data modeling only.

---

## 29. RUN CHECKS

Run:

```bash
npm run lint
npm run type-check
npm run test
npm run build
```

Run focused model tests.

---

## 30. POST-IMPLEMENTATION REVIEW

```text
STEP 13 POST-REVIEW

Branch:
- feature/step-13-database-models

Models Added:
Existing Models Preserved:
Enums:
Relationships:
Money Representation:
GeoJSON Fields:
Status Models:
Security / Sensitive Data:
Delete / Archive Strategy:
Model Ownership:
Tests:
Lint:
Type Check:
Build:
Issues Found:
Issues Fixed:
Deferred to Step 14:
Deferred to Feature Steps:
```

Fix all Step 13 issues, then rerun checks.

---

## 31. PRE-MERGE GIT REVIEW

Run:

```bash
git status
git diff
git diff --check
git diff --stat
git diff --name-only
```

Confirm:

- no auth/API implementation
- no frontend feature work
- no seed dataset yet
- no real secrets
- no production-destructive tools
- no unrelated rewrites

Suggested commit:

```text
feat(database): add INFRAOS domain models
```

Merge flow after approval:

```text
feature/step-13-database-models → development
```

After integration rerun model tests/lint/type-check/build.

Do not merge to `main` automatically.

---

## 32. STEP 13 FINAL REPORT

```text
STEP 13 COMPLETE
Complete INFRAOS Database Models

STATUS:
BRANCH:
STARTING COMMIT:
MODELS CREATED:
FILES CREATED:
FILES MODIFIED:
ENUMS:
RELATIONSHIPS:
TESTS:
CHECKS:
  Lint:
  Type Check:
  Tests:
  Build:
SECURITY REVIEW:
GIT REVIEW:
SUGGESTED COMMIT:
feat(database): add INFRAOS domain models
MERGE TARGET:
development
KNOWN LIMITATIONS:
NEXT:
Step 14 — Database Indexes, GeoJSON & Constraints
```

### STEP 13 ACCEPTANCE CRITERIA

Step 13 is complete only if all planned domain models exist, Step 12 models remain compatible, fields preserve the approved project design, references/statuses/bounds are clear, model tests pass, and no business API/UI/auth work was prematurely added.

Stop after Step 13.

---

# STEP 14 — DATABASE INDEXES, GEOJSON & CONSTRAINTS

## CURSOR AGENT PROMPT

Act as a **Senior MongoDB Performance Engineer, GIS Database Engineer, Mongoose Architect, RoadSync Data Engineer, Data Integrity Engineer, Query Optimization Engineer, Security Reviewer, and QA Engineer**.

Perform **Step 14 — Database Indexes, GeoJSON & Constraints**.

This step hardens the data models for the actual queries INFRAOS will later run.

Do not implement RoadSync service logic or UI yet.

---

## 1. BRANCH + PRE-STEP REVIEW

```bash
git checkout development
git pull
git status
git checkout -b feature/step-14-database-indexes-geojson
```

Inspect all Step 12–13 models and expected query patterns:

```text
project list/filter
agency-scoped project lists
status/date project queries
map viewport queries
nearby work queries
work date-overlap candidate queries
conflict status/severity lists
coordination pending by agency
project documents
inspector assignments
notifications by read state
citizen issues by agency/status
assets/maintenance
risk history
audit history
```

Return:

```text
STEP 14 PRE-REVIEW

Current Branch:
Existing Indexes:
Unique Constraints:
GeoJSON Fields:
Expected High-Frequency Queries:
Potential Missing Indexes:
Potential Over-Indexing:
Potential Spatial Risks:
Potential Integrity Risks:

Implementation Plan:
1.
2.
3.
...
```

---

## 2. INDEX POLICY

Every index needs a real query/use-case justification.

Document for each:

```text
Collection
Index definition
Query supported
Unique? / partial? / sparse?
Why needed
Write/storage trade-off
```

Do not index every field.

---

## 3. REQUIRED UNIQUE INDEXES

Verify/define:

```text
users.email UNIQUE
roles.key UNIQUE
agencies.code UNIQUE
projects.projectCode UNIQUE
```

For contractors, use `registrationNumber UNIQUE` only if the data contract guarantees it. If optional, consider a safe partial unique index rather than blocking records without a registration number.

For document chunks, consider:

```text
{ documentId: 1, chunkIndex: 1 } UNIQUE
```

if chunk index is unique within each document.

---

# PROJECTTRACE INDEXES

## 4. PROJECTS

Support actual filters such as:

```text
agencyId + status
status + plannedEndDate
managerId + status
contractorId + status
projectType + status
```

Choose the smallest useful set. A likely useful compound index is:

```text
{ agencyId: 1, status: 1, plannedEndDate: 1 }
```

only if it matches the planned project-list query.

Avoid redundant overlapping indexes.

## 5. MILESTONES

Typical query:

```text
project milestones ordered by planned date or sequence
```

Use a suitable compound index such as:

```text
{ projectId: 1, plannedEnd: 1 }
```

or `projectId + sequence`, depending on the final schema.

---

# GEOJSON / ROADSYNC

## 6. GEOJSON STANDARD

All GeoJSON coordinates use:

```text
[longitude, latitude]
```

Supported initial geometry:

```text
Point
LineString
Polygon
```

Do not add MultiPolygon/GeometryCollection unless a real requirement exists.

Validate:

- supported type
- numeric coordinates
- non-empty geometry
- Point longitude range `-180..180`
- Point latitude range `-90..90`
- Polygon closure where implemented

Do not install a huge geometry library unless needed and justified.

---

## 7. `2dsphere` INDEXES

Create where spatial queries are needed:

```text
projects.geometry → 2dsphere
workRequests.geometry → 2dsphere
assets.geometry → 2dsphere if Asset uses geometry
citizenIssues.geometry → 2dsphere if routing/map uses geometry
```

Do not add spatial indexes to collections that do not perform spatial queries.

---

## 8. ROADSYNC CANDIDATE QUERY READINESS

The future RoadSync flow is:

```text
New work geometry
↓
spatial query finds nearby/intersecting work
↓
date/status filters narrow candidates
↓
service evaluates exact schedule overlap
↓
conflict classification/severity
```

Step 14 must make the first two database stages efficient, but must not implement final conflict logic.

---

## 9. WORK REQUEST INDEXES

Likely filters:

```text
agencyId
status
plannedStart
plannedEnd
```

Choose a practical compound index based on the actual query design, for example:

```text
{ status: 1, plannedStart: 1, plannedEnd: 1 }
```

or an agency-scoped variant.

Do not create every possible combination.

---

## 10. DATE-OVERLAP RULE

Document the actual overlap condition:

```text
A.start <= B.end
AND
A.end >= B.start
```

Indexes can narrow candidates; service logic must evaluate the actual rule.

Do not pretend an index itself solves conflict detection.

---

# CONFLICT / COORDINATION INDEXES

## 11. CONFLICTS

Likely dashboard/list query:

```text
status + severity + detectedAt
```

Potential:

```text
{ status: 1, severity: 1, detectedAt: -1 }
```

Prevent duplicate active conflicts for the same work-request pair through a deterministic pair strategy.

Preferred future service approach:

```text
normalize pair ordering
```

or create a deterministic `pairKey` if justified.

Do not block legitimate historical resolved-conflict records accidentally.

## 12. COORDINATION REQUESTS

Support:

```text
toAgency + status + createdAt
conflictId + createdAt
fromAgency + createdAt
```

Select only needed indexes.

---

# SUPPORTING MODULE INDEXES

## 13. DOCUMENTS / CHUNKS

Useful:

```text
documents: projectId + documentType
documents: projectId + createdAt
documentChunks: documentId + chunkIndex
```

Do not use MongoDB text index as a fake replacement for RAG/vector search.

## 14. PAYMENTS

Likely:

```text
projectId + date
contractorId + date
status + date
```

Do not index `amount` unless a real filter requires it.

## 15. INSPECTIONS

Useful:

```text
projectId + inspectionDate
inspectorId + status + inspectionDate
```

## 16. ASSETS / MAINTENANCE

Potential:

```text
assets: agencyId + condition
assets: nextMaintenanceAt
maintenanceRecords: assetId + scheduledDate
maintenanceRecords: status + scheduledDate
```

Make `sourceProjectId UNIQUE` only if MVP truly guarantees one asset per project. Otherwise do not enforce that assumption.

## 17. CITIZEN ISSUES

Useful:

```text
assignedAgency + status + createdAt
citizenId + createdAt
status + priority
```

Add `2dsphere` only if issue spatial queries are planned.

## 18. NOTIFICATIONS

High-value:

```text
{ userId: 1, isRead: 1, createdAt: -1 }
```

Do not use TTL unless notification-retention requirements explicitly call for automatic deletion.

## 19. RISK ASSESSMENTS

Use:

```text
{ projectId: 1, createdAt: -1 }
```

because risk history is required.

## 20. AUDIT LOGS

Useful:

```text
{ resourceType: 1, resourceId: 1, timestamp: -1 }
{ userId: 1, timestamp: -1 }
```

Do not index giant `oldValue/newValue` objects.

---

# DATA CONSTRAINTS

## 21. NUMERIC BOUNDS

Verify:

```text
physicalProgress: 0–100
financialProgress: 0–100
risk scores: 0–100
healthScore: 0–100
payment amount >= 0
budget >= 0
maintenance cost >= 0
distance >= 0
```

## 22. DATE RULES

Document/enforce simple constraints where appropriate:

```text
project plannedEnd >= start
milestone plannedEnd >= plannedStart
work plannedEnd >= plannedStart
actualEnd >= actualStart when both exist
maintenance completedDate >= scheduledDate where applicable
```

Future service/request validation must also enforce business rules.

## 23. STRING / ARRAY BOUNDS

Set reasonable maxima for:

```text
title
description
notes
message
response
permissions[]
factors[]
recommendations[]
evidence[]
photos[]
affectedInfrastructure[]
```

Avoid both unbounded payloads and unrealistically tiny limits.

## 24. REFERENTIAL INTEGRITY

MongoDB ObjectId types do not guarantee referenced records exist.

Document that future services must verify referenced:

```text
agency
project
user
contractor
work request
asset
```

before sensitive writes.

Do not claim relational foreign-key guarantees.

---

# INDEX MANAGEMENT

## 25. AUTO-INDEX POLICY

Decide/document whether `autoIndex` is allowed for development/test.

For production, do not silently build expensive indexes during normal app startup.

## 26. SAFE INDEX CHECK TOOL

Create a read-only command such as:

```text
npm run db:indexes:check
```

It should report:

```text
expected
existing
missing
mismatch
```

without exposing credentials.

## 27. INDEX SYNC TOOL

If implemented:

- development/test by default
- production requires explicit authorization
- never automatically drop unexpected production indexes
- never delete duplicate data to force a unique index

If duplicates block an index, report them.

---

# GEOSPATIAL TESTS

## 28. GEOJSON FIXTURES

Test small synthetic fixtures:

```text
valid Point
valid LineString
valid Polygon if supported
invalid type
invalid Point longitude
invalid Point latitude
empty coordinates
```

## 29. SPATIAL QUERY TEST

Using an isolated test DB, verify a chosen MongoDB spatial query can:

- return nearby work
- exclude far work
- use expected geometry
- require correct coordinate order

## 30. ROADSYNC DATA-READINESS TEST

Use a synthetic example:

```text
Road resurfacing:
Jan 10 – Apr 20
LineString A

Water pipeline:
Mar 01 – May 01
same/nearby LineString
```

Prove the database can retrieve them as candidates.

Do **not** implement severity or coordination logic here.

---

## 31. DOCUMENTATION

Create/update:

```text
/docs/database/indexes.md
/docs/database/geospatial.md
/docs/database/constraints.md
```

Include every index, its query purpose, coordinate order, supported geometry, production index strategy, and important constraints.

---

## 32. RUN CHECKS

Run:

```bash
npm run lint
npm run type-check
npm run test
npm run build
```

Run GeoJSON, index, and spatial integration tests where available.

If Atlas/test DB is unavailable, report blocked checks instead of inventing a pass.

---

## 33. POST-IMPLEMENTATION REVIEW

```text
STEP 14 POST-REVIEW

Branch:
- feature/step-14-database-indexes-geojson

Indexes Added:
Unique Constraints:
Compound Indexes:
Spatial Indexes:
Supported GeoJSON:
Coordinate Validation:
RoadSync Query Readiness:
Over-Indexing Review:
Production Index Strategy:
Constraint Validation:
Tests:
Lint:
Type Check:
Build:
Issues Found:
Issues Fixed:
Known Limitations:
```

Fix Step 14 issues and rerun checks.

---

## 34. GIT / MERGE REVIEW

Run:

```bash
git status
git diff
git diff --check
git diff --stat
```

Confirm no unrelated APIs/UI/seeding, no secret, no destructive production index script.

Suggested commit:

```text
feat(database): add spatial indexes and constraints
```

Merge after approval:

```text
feature/step-14-database-indexes-geojson → development
```

Rerun integration checks after merge.

Do not merge to `main` automatically.

---

## 35. STEP 14 FINAL REPORT

```text
STEP 14 COMPLETE
Database Indexes, GeoJSON & Constraints

STATUS:
BRANCH:
INDEXES:
SPATIAL INDEXES:
UNIQUE CONSTRAINTS:
GEOJSON:
ROADSYNC DATA READINESS:
INDEX TOOLING:
TESTS:
CHECKS:
  Lint:
  Type Check:
  Tests:
  Build:
  Spatial Integration:
  Index Check:
SECURITY / SAFETY REVIEW:
SUGGESTED COMMIT:
feat(database): add spatial indexes and constraints
MERGE TARGET:
development
KNOWN LIMITATIONS:
NEXT:
Step 15 — Seed & Demo Data Architecture
```

### STEP 14 ACCEPTANCE CRITERIA

Complete only if the important unique/compound/spatial indexes are justified, GeoJSON rules are explicit, RoadSync candidate-query readiness is tested, index tooling is non-destructive, constraints are documented, and all available checks pass.

Stop after Step 14.

---

# STEP 15 — SEED & DEMO DATA ARCHITECTURE

## CURSOR AGENT PROMPT

Act as a **Senior Data Engineer, Demo Environment Architect, MongoDB Engineer, QA Engineer, Product Demo Designer, Security Reviewer, and Technical Lead**.

Perform **Step 15 — Seed & Demo Data Architecture**.

The goal is to build safe, deterministic, clearly synthetic demo data that supports the entire INFRAOS development and final presentation without pretending to be official government data.

---

## 1. BRANCH + PRE-STEP REVIEW

```bash
git checkout development
git pull
git status
git checkout -b feature/step-15-seed-demo-data
```

Inspect:

```text
all models
Step 12 role/agency seed
indexes
GeoJSON rules
project lifecycle
RoadSync architecture
final demo scenario
test DB safety
```

Return:

```text
STEP 15 PRE-REVIEW

Current Branch:
Existing Seeds:
Existing Demo Data:
Existing Role/Agency Seeds:
Models Available:
Required Demo Relationships:
Security Risks:
Production Safety:

Implementation Plan:
1.
2.
3.
...
```

---

## 2. SEED SAFETY PRINCIPLES

Seeds must be:

- deterministic
- idempotent
- development/test only
- safe to rerun
- clearly synthetic
- small enough to understand
- rich enough to demonstrate the platform

Do not seed thousands of meaningless rows.

---

## 3. PRODUCTION GUARD

Seed scripts must refuse production by default.

Allow only clearly approved environments such as:

```text
NODE_ENV=development
NODE_ENV=test
```

and verify DB name resembles:

```text
infraos_dev
infraos_test
```

If production-like:

```text
ABORT
```

Do not provide an easy `--force-production` bypass.

---

## 4. MANUAL COMMANDS ONLY

Seeds must never run automatically on server startup.

Use explicit commands such as:

```text
npm run db:seed:core
npm run db:seed:demo
npm run db:seed:verify
```

Optional safe reset:

```text
npm run db:seed:reset-demo
```

only if it removes records known to belong to the demo dataset.

Never use `dropDatabase()` for a shared dev DB.

---

## 5. SYNTHETIC DATA DISCLAIMER

Add prominently to seed docs:

> **All demo projects, agencies, contractors, budgets, schedules, conflicts, inspections, risks, and citizen reports are synthetic prototype data created for development and academic demonstration. They are not official government records.**

---

## 6. CORE ROLES

Reuse the existing system roles exactly:

```text
SUPER_ADMIN
GOVERNMENT_ADMIN
AGENCY_OFFICER
PROJECT_MANAGER
CONTRACTOR
INSPECTOR
CITIZEN
```

Do not create duplicate or renamed role records.

---

## 7. SYNTHETIC AGENCIES

Create realistic prototype organizations representing:

```text
ROAD
WATER
ELECTRICITY
TELECOM
DRAINAGE
LOCAL_AUTHORITY
MINISTRY/DEPARTMENT if needed
```

Use clearly synthetic names, for example:

```text
National Road Infrastructure Agency
Provincial Water Services Agency
Regional Electricity Infrastructure Agency
Public Telecom Coordination Agency
Municipal Drainage & Local Works Authority
National Infrastructure Planning Office
```

Do not represent these as real agencies.

---

## 8. USER SEED SAFETY

Authentication/password hashing may not yet be implemented.

Do not create plaintext or weak demo passwords.

If secure auth hashing is not available yet:

```text
Demo interactive user accounts: DEFERRED
```

Do not weaken the User model just for seed convenience.

Do not add auth bypasses.

---

# PROJECT / ROADSYNC DEMO DATA

## 9. SEED MULTIPLE PROJECT STATES

Create a small meaningful set of synthetic projects, for example:

```text
Road resurfacing — APPROVED/ACTIVE
Water pipeline — APPROVED/PLANNED
Telecom cable — PLANNED
Drainage upgrade — ACTIVE
Delayed public facility/road project — DELAYED
Completed bridge/road project — COMPLETED
Draft project — DRAFT
```

Use realistic but synthetic dates and budgets.

---

## 10. PRIMARY ROADSYNC WINNING SCENARIO

Seed one intentional conflict-candidate pair.

Example:

```text
Project A:
Central Corridor Road Resurfacing
Type: ROAD
Geometry: LineString
Schedule: January → April
Agency: Road

Project B:
Central Corridor Water Main Upgrade
Type: WATER
Geometry: overlapping/nearby LineString
Schedule: March → May
Agency: Water
```

The future expected system story is:

```text
geographic overlap / nearby work
+
schedule overlap
=
conflict candidate
```

This dataset should later support the recommendation:

> Complete underground water work before final road resurfacing.

Do not implement the recommendation engine in Step 15.

---

## 11. NON-CONFLICT CONTROL

Seed at least one case that should **not** conflict because:

- location is far enough away, or
- same/nearby location but schedules do not overlap

This prevents future RoadSync logic from simply flagging everything.

---

## 12. NEARBY-NOT-OVERLAPPING CONTROL

Seed a work request that is within a future nearby threshold but does not geometrically intersect.

This later differentiates:

```text
NEARBY_WORK
```

from direct overlap.

---

## 13. MILESTONE DEMO

For the main road project create milestones such as:

```text
Drainage Preparation — completed
Road Base Preparation — in progress
Asphalt Work — not started
Road Marking — not started
```

Use realistic planned dates/progress.

---

## 14. RISK SCENARIO

Create one synthetic project with characteristics that later produce a clear risk demo, e.g.:

```text
70% of planned time elapsed
45% physical progress
67% financial progress
multiple delayed milestones
```

Do not claim an AI model already evaluated it unless a clearly marked synthetic RiskAssessment fixture is intentionally seeded.

---

# CONTRACTOR / FINANCE DEMO

## 15. CONTRACTORS

Create a few synthetic contractors:

```text
Contractor Alpha
Contractor Beta
Contractor Gamma
```

Use synthetic registration numbers and clearly synthetic performance/risk indicators.

Do not present this as real contractor history.

## 16. PAYMENTS

Create several payments supporting:

- financial progress UI
- budget vs physical progress demo
- reports

Use the same money strategy as Step 13.

Do not create impossible totals unless intentionally testing a warning and documented as such.

---

# DOCUMENT / INSPECTION DEMO

## 17. DOCUMENT METADATA

Seed safe metadata for:

```text
Contract Agreement
BOQ
Progress Report
Approval Letter
Inspection Report
```

If storage is not implemented, do not create fake working URLs. Mark storage integration as deferred.

Do not seed fake embeddings/vector results.

## 18. INSPECTIONS

Create:

- one scheduled inspection
- one submitted/verified inspection
- optionally one progress discrepancy scenario

Example:

```text
reported progress: 75%
inspector verified: 68%
```

Do not label the difference fraud.

---

# ASSET / MAINTENANCE DEMO

## 19. COMPLETED PROJECT → ASSET

Seed at least one Asset linked to a completed Project.

Include:

```text
condition
commissionedAt
nextMaintenanceAt
location/geometry if supported
```

This demonstrates:

```text
Project → Asset → Maintenance
```

## 20. MAINTENANCE

Seed:

- one completed maintenance record
- one scheduled/upcoming maintenance record

---

# CITIZEN ISSUE DEMO

## 21. CITIZEN ISSUES

Seed a small set such as:

```text
Pothole
Water leak
Blocked drainage
Streetlight/utility damage
```

Use synthetic coordinates and agency routing.

Do not include unnecessary citizen personal data.

---

# NOTIFICATIONS / RISK / AUDIT FIXTURES

## 22. NOTIFICATIONS

If demo users are not safely available yet, do not seed orphan notifications. Defer until auth/user seed exists.

## 23. RISK ASSESSMENTS

Optional synthetic fixture may use a clearly non-production model version such as:

```text
DEMO-RULES-v1
```

Do not present it as a production AI prediction.

## 24. AUDIT LOGS

Prefer real future actions creating audit logs naturally. If UI testing needs fixtures, clearly mark them synthetic and never include secrets.

---

# GEOGRAPHIC DATA

## 25. SRI LANKA CONTEXT

The platform is Sri Lankan government/infrastructure inspired, so demo data may use:

```text
LKR
Sri Lankan province/district/locality names
public geographic references
```

but all project schedules, budgets, contractors, conflicts, inspections, and issue reports remain synthetic.

Public geography may be real; the claimed infrastructure activity must not be represented as official.

---

## 26. DETERMINISTIC DATES

Choose one strategy and document it:

### Fixed demo timeline
Best for repeatable screenshots/presentation.

or

### Relative dates
Best for always-current dashboards.

Do not mix randomly.

---

## 27. DETERMINISTIC IDENTIFIERS

Use stable seed keys such as:

```text
AGENCY_DEMO_ROAD
PROJECT_DEMO_ROAD_001
WORK_DEMO_ROAD_001
```

Use upserts/lookups by stable identifiers.

Do not depend on insertion order.

---

## 28. IDEMPOTENCY

Running:

```text
npm run db:seed:demo
```

multiple times must not duplicate data.

Use deterministic keys/upserts.

---

## 29. SAFE RESET

If `db:seed:reset-demo` is implemented, it must delete only known demo-owned records.

Never use:

```text
dropDatabase()
deleteMany({})
```

against a shared development DB.

Do not delete core role records accidentally.

---

## 30. FAILURE RECOVERY

If a seed run fails halfway, rerunning should safely complete/upsert rather than duplicate data.

Report the failing entity.

---

## 31. SEED ORGANIZATION

Use a clean structure such as:

```text
apps/api/src/database/seeds/
├── core/
├── demo/
├── helpers/
└── index.ts
```

Do not put everything into one giant seed file.

---

## 32. DATA VOLUME

Keep it understandable. A useful guideline is roughly:

```text
6–10 agencies
8–15 projects
10–20 milestones
6–12 work requests
3–6 contractors
5–15 payments
5–10 document metadata records
3–6 inspections
3–6 assets
5–10 maintenance records
5–10 citizen issues
```

Quality > quantity.

---

## 33. VERIFICATION COMMAND

Create a read-only command such as:

```text
npm run db:seed:verify
```

It should verify:

```text
expected agencies exist
expected projects exist
relationships resolve
work geometry exists
RoadSync candidate pair exists
non-conflict control exists
milestones exist
completed project links to asset
no duplicate demo records
```

Safe output example:

```text
INFRAOS demo seed verification
Agencies: PASS
Projects: PASS
Work requests: PASS
RoadSync candidate scenario: PASS
Non-conflict control: PASS
Milestones: PASS
Assets: PASS
Citizen issues: PASS
```

Do not print credentials.

---

## 34. SPATIAL SEED VERIFICATION

Against authorized dev/test DB, verify the conflict-candidate pair is actually nearby/overlapping using a MongoDB spatial query and the control record is excluded.

Do not claim the RoadSync conflict engine itself is implemented yet.

---

## 35. DOCUMENTATION

Create:

```text
/docs/database/demo-data.md
/docs/demo/infraos-demo-scenario.md
```

Document:

- synthetic-data disclaimer
- agencies
- projects
- intended conflict pair
- non-conflict pair
- contractor/payment fixtures
- milestones
- inspections
- assets/maintenance
- citizen issues
- deferred auth-dependent data
- seed commands
- reset safety
- verification process

The demo flow should explain:

```text
Road project
→ water project conflict candidate
→ future RoadSync coordination
→ project progress/risk
→ inspection
→ completion
→ asset
→ maintenance
→ citizen issue
```

---

## 36. TESTS

Test:

```text
production guard
idempotency
stable relationships
no duplicate projects/agencies
reset removes only demo data
core roles preserved
invalid environment refuses seed
verification detects missing relation
spatial scenario correctness
```

Use disposable test DB.

---

## 37. NO AUTH OR BUSINESS SHORTCUTS

Do not add:

```text
hardcoded admin login
fake JWT
auth bypass
dev backdoor
```

Do not pre-create a Conflict and later pretend RoadSync generated it unless it is explicitly labeled fixture-only.

Preferred final demo seed:

```text
seed WorkRequests
→ RoadSync later detects/creates Conflict
```

---

## 38. RUN CHECKS

Run:

```bash
npm run lint
npm run type-check
npm run test
npm run build
```

Against authorized dev/test DB:

```bash
npm run db:seed:demo
npm run db:seed:verify
npm run db:seed:demo
```

The second seed proves idempotency.

If safe reset exists:

```bash
npm run db:seed:reset-demo
npm run db:seed:demo
npm run db:seed:verify
```

Never run reset against production.

---

## 39. POST-IMPLEMENTATION REVIEW

```text
STEP 15 POST-REVIEW

Branch:
- feature/step-15-seed-demo-data

Seed Architecture:
Production Guard:
Synthetic Data Labeling:
Agencies:
Projects:
RoadSync Candidate Scenario:
Non-Conflict Scenario:
Milestones:
Contractors:
Finance:
Documents:
Inspections:
Assets/Maintenance:
Citizen Issues:
Users: SEEDED / DEFERRED
Notifications: SEEDED / DEFERRED
Idempotency: PASS / FAIL / NOT RUN
Reset Safety: PASS / FAIL / NOT IMPLEMENTED
Verification: PASS / FAIL / NOT RUN
Spatial Verification: PASS / FAIL / NOT RUN
Lint:
Type Check:
Tests:
Build:
Issues Found:
Issues Fixed:
Known Limitations:
```

Fix Step 15 issues and rerun checks.

---

## 40. GIT / MERGE REVIEW

Run:

```bash
git status
git diff
git diff --check
git diff --stat
git diff --name-only
```

Confirm:

- no real private data
- no real credentials
- no weak passwords
- no auth bypass
- no production reset
- no `dropDatabase()`
- no unrelated UI changes
- no claim that AI/RoadSync is already implemented

Suggested commit:

```text
feat(database): add safe demo seed architecture
```

Merge after approval:

```text
feature/step-15-seed-demo-data → development
```

Then run the full Steps 13–15 database phase review.

If all checks pass, `development → main` may be performed only after explicit approval.

---

## 41. STEP 15 FINAL REPORT

```text
STEP 15 COMPLETE
Seed & Demo Data Architecture

STATUS:
BRANCH:
SEED COMMANDS:
DEMO RECORDS:
CORE ROADSYNC DEMO:
NON-CONFLICT CONTROL:
SAFETY GUARDS:
SYNTHETIC DATA DISCLAIMER:
VERIFICATION:
TESTS:
CHECKS:
  Lint:
  Type Check:
  Tests:
  Build:
  Seed:
  Seed Verify:
  Idempotency:
  Reset:
GIT REVIEW:
SUGGESTED COMMIT:
feat(database): add safe demo seed architecture
MERGE TARGET:
development
PHASE MAIN MERGE:
READY / NOT READY
KNOWN LIMITATIONS:
NEXT:
Step 16 — Shared Types, Constants & API Contracts
```

### STEP 15 ACCEPTANCE CRITERIA

Step 15 is complete only if demo data is synthetic, deterministic, idempotent, production-guarded, safe to reset, includes a RoadSync candidate scenario and a non-conflict control, supports the wider INFRAOS demo story, contains no weak passwords/backdoors, and verification/tests pass.

Stop after Step 15.

---

# FINAL STEPS 13–15 DATABASE PHASE REVIEW

After all three feature branches are individually reviewed and integrated into `development`, run this full phase review before starting Step 16.

## A. MODEL COMPLETENESS

Confirm these collections are represented:

```text
users
roles
agencies
refreshSessions
projects
milestones
workRequests
conflicts
coordinationRequests
contractors
projectPayments
documents
documentChunks
inspections
assets
maintenanceRecords
citizenIssues
notifications
riskAssessments
auditLogs
```

## B. RELATIONSHIPS

Verify:

```text
User → Role
User → Agency
Agency → Parent Agency
Agency → Projects
Manager(User) → Projects
Contractor → Projects
Project → Milestones
Project → WorkRequests
WorkRequests ↔ Conflicts
Conflict → CoordinationRequests
Project → Payments
Project → Documents
Document → DocumentChunks
Project → Inspections
Project → RiskAssessments
Completed Project → Asset
Asset → MaintenanceRecords
Citizen(User) → CitizenIssues
User → Notifications
User → AuditLogs
```

## C. PROJECTTRACE DATABASE READINESS

Confirm database can represent:

- lifecycle
- agency
- manager
- contractor
- dates
- budget
- physical/financial progress
- milestones
- risk history
- project-to-asset conversion

Do not claim ProjectTrace feature implementation yet.

## D. ROADSYNC DATABASE READINESS

Confirm:

- WorkRequest has valid GeoJSON
- `2dsphere` exists
- date range exists
- agency/project references exist
- Conflict represents two work requests
- severity/status exists
- CoordinationRequest supports from/to agency
- spatial candidate test works
- schedule-overlap candidate can be represented
- non-conflict control exists

Do not claim the full conflict engine is implemented.

## E. INFRAMAP READINESS

Spatial data should be structurally available for:

```text
Projects
WorkRequests
Assets
CitizenIssues if enabled
```

## F. FINANCE CONSISTENCY

- same money representation for budgets/payments/maintenance
- no negative amounts
- contractor refs consistent

## G. DOCUMENT/RAG READINESS

- file metadata separate from large extracted text
- chunks separate
- no fake embeddings
- visibility can be represented

## H. AI RISK READINESS

- historical assessments supported
- latest project risk summary strategy documented
- scores consistent
- AI cannot directly set official project status

## I. AUDIT SAFETY

- append-only application design
- no passwords/tokens
- resource/user/time indexes
- redaction documented

## J. INDEX QUALITY

- no redundant major indexes
- common query paths covered
- spatial indexes valid
- unique constraints justified
- index tools non-destructive

## K. TEST DATABASE SAFETY

Confirm all DB tests use an explicit disposable/test database and never production.

## L. DEMO DATA SAFETY

Confirm:

- synthetic disclaimer
- no real private data
- no weak passwords
- no auth bypass
- deterministic seed keys
- reset deletes only demo records

## M. BRANCH / GIT REVIEW

Expected sequence:

```text
feature/step-13-database-models → development
feature/step-14-database-indexes-geojson → development
feature/step-15-seed-demo-data → development
```

Then:

```text
development
→ database phase regression review
→ main after explicit approval
```

Review:

```bash
git status
git log --oneline --decorate -n 20
git diff main...development --stat
```

Do not rewrite history.

---

# DATABASE PHASE FINAL REPORT

```text
STEPS 13–15 DATABASE PHASE COMPLETE

STEP 13 — Complete Database Models:
✅ / ⚠️

STEP 14 — Indexes / GeoJSON / Constraints:
✅ / ⚠️

STEP 15 — Seed / Demo Data:
✅ / ⚠️

COLLECTIONS:
PROJECTTRACE DB READINESS:
ROADSYNC DB READINESS:
INFRAMAP DB READINESS:
FINANCE DB READINESS:
DOCUMENT/RAG DB READINESS:
AI RISK DB READINESS:
AUDIT DB READINESS:
INDEXES:
GEOJSON:
DEMO DATA:
SYNTHETIC DATA DISCLAIMER:
TEST SAFETY:

CHECKS:
Lint:
Type Check:
Tests:
Build:
DB Check:
Index Check:
Seed:
Seed Verify:
Spatial Test:

FEATURE BRANCHES:
- feature/step-13-database-models
- feature/step-14-database-indexes-geojson
- feature/step-15-seed-demo-data

INTEGRATION BRANCH:
development

MAIN MERGE STATUS:
READY / NOT READY

INCONSISTENCIES FOUND:
INCONSISTENCIES FIXED:
KNOWN LIMITATIONS:

SUGGESTED DATABASE PHASE MERGE:
development → main

NEXT STEP:
Step 16 — Shared Types, Constants & API Contracts
```

---

# FINAL STOP RULE

Do not continue to Step 16 automatically.

Do not push, merge to `main`, delete branches, force-push, or rewrite history without explicit user/team authorization.

Wait for the next instruction.
