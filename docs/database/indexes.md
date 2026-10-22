# Database indexes

**Step:** 14 — query indexes and safe inspection

Indexes are selected for the query paths already defined by ProjectTrace,
RoadSync, InfraMap, module workspaces, notifications, and governed audit reads.
They are not a substitute for authorization filters, service validation, or
RoadSync conflict classification. Every tenant or resource-scoped query must
still include and verify its authorized scope.

## Index catalog

`_id` indexes are implicit and omitted from this table. Direction on a date is
chosen to match the default UI order. Each additional index increases write
latency and storage, so fields such as payment amount, document content, audit
snapshots, and descriptions remain unindexed.

| Collection | Index | Purpose | Integrity / trade-off |
|---|---|---|---|
| users | `{ email: 1 }` | normalized login lookup | Unique; required identity invariant |
| roles | `{ key: 1 }` | role-key lookup | Unique; required catalog invariant |
| agencies | `{ code: 1 }` | agency-code lookup | Unique; required agency invariant |
| projects | `{ projectCode: 1 }` | project-code lookup | Unique; concurrent duplicate protection |
| projects | `{ agencyId: 1, status: 1, plannedEndDate: 1 }` | agency project list, status, due-date order/range | High-value compound list index |
| projects | `{ status: 1, plannedEndDate: 1 }` | cross-agency status and completion-date dashboard | Separate from agency prefix for governed national views |
| projects | `{ managerId: 1, status: 1 }` | assigned-project list | Adds write cost for manager assignment changes |
| projects | `{ contractorId: 1, status: 1 }` | contractor project list | Supports contractor profile/project scope |
| projects | `{ projectType: 1, status: 1 }` | type/status reporting and map filter | Bounded enums keep keys small |
| projects | `{ geometry: "2dsphere" }` | project viewport, nearby, and intersection queries | Spatial index; geometry is optional |
| milestones | `{ projectId: 1, plannedEnd: 1 }` | project milestones ordered by planned completion | One project-scoped timeline path |
| workRequests | `{ agencyId: 1, status: 1, plannedStart: 1, plannedEnd: 1 }` | agency queue and coarse schedule-overlap candidates | Service still applies exact overlap rule |
| workRequests | `{ geometry: "2dsphere", status: 1, plannedStart: 1, plannedEnd: 1 }` | nearby/intersecting work narrowed by state and dates | Main RoadSync candidate index; heavier than a scalar index |
| conflicts | `{ status: 1, severity: 1, createdAt: -1 }` | conflict dashboard | `createdAt` is the detection timestamp in the current schema |
| conflicts | `{ activePairKey: 1 }` | prevent duplicate active conflicts for one normalized pair | Unique partial index only when the derived key is a string; resolved history remains valid |
| coordinationRequests | `{ toAgency: 1, status: 1, createdAt: -1 }` | receiving-agency pending inbox | Primary coordination queue |
| coordinationRequests | `{ conflictId: 1, createdAt: -1 }` | conflict coordination history | Conflict detail timeline |
| coordinationRequests | `{ fromAgency: 1, createdAt: -1 }` | sent requests | Agency outbox |
| contractors | `{ registrationNumber: 1 }` | registration lookup | Unique because Step 13 requires this value for every contractor |
| documents | `{ projectId: 1, documentType: 1 }` | project documents by type | No text index; RAG/vector search remains separate |
| documents | `{ projectId: 1, createdAt: -1 }` | recent project documents | Supports all-type project document history |
| documentChunks | `{ documentId: 1, chunkIndex: 1 }` | ordered chunks for a document | Unique within a document |
| projectPayments | `{ projectId: 1, date: -1 }` | project payment history | Amount remains unindexed |
| projectPayments | `{ contractorId: 1, date: -1 }` | contractor payment history | Required contractor view |
| projectPayments | `{ status: 1, date: -1 }` | finance status queue | Cross-project finance workflow |
| inspections | `{ projectId: 1, inspectionDate: -1 }` | project inspection history | Project workspace query |
| inspections | `{ inspectorId: 1, status: 1, inspectionDate: -1 }` | assigned inspector inbox | Supports assignment plus workflow state |
| assets | `{ agencyId: 1, condition: 1 }` | agency asset register by condition | `sourceProjectId` is deliberately not unique; one project may produce multiple assets |
| assets | `{ nextMaintenanceAt: 1 }` | upcoming maintenance planning | Date-only cross-agency scheduling path |
| assets | `{ geometry: "2dsphere" }` | asset map and nearby lookup | Spatial index only because InfraMap reads asset geometry |
| maintenanceRecords | `{ assetId: 1, scheduledDate: -1 }` | asset maintenance history | Asset detail timeline |
| maintenanceRecords | `{ status: 1, scheduledDate: 1 }` | upcoming/due maintenance queue | Ascending order matches next-due processing |
| citizenIssues | `{ assignedAgency: 1, status: 1, createdAt: -1 }` | agency issue inbox | Assigned agency may be absent before routing |
| citizenIssues | `{ citizenId: 1, createdAt: -1 }` | citizen issue history | Own-resource query still needs authorization |
| citizenIssues | `{ status: 1, priority: 1 }` | operations triage | Supports the bounded status/priority filters |
| citizenIssues | `{ geometry: "2dsphere" }` | route issues and render the issue map layer | Geometry is optional before map placement |
| notifications | `{ userId: 1, isRead: 1, createdAt: -1 }` | own unread/recent notification list | No TTL; retention policy does not authorize deletion |
| riskAssessments | `{ projectId: 1, createdAt: -1 }` | immutable project risk history | Keeps latest-summary cache separate from history |
| auditLogs | `{ resourceType: 1, resourceId: 1, timestamp: -1 }` | governed resource audit history | Append-only, write-heavy collection |
| auditLogs | `{ userId: 1, timestamp: -1 }` | governed actor audit history | Audit snapshots and request metadata remain unindexed |

Existing identity/session support indexes remain in their Step 12 schemas, with
one Step 35 addition on `refresh_sessions`:

| Collection | Index | Purpose | Integrity / trade-off |
|---|---|---|---|
| refresh_sessions | `{ tokenHash: 1 }` | future refresh lookup | Unique. Hash only; raw cookie is never stored. |
| refresh_sessions | `{ userId: 1 }` | sessions for one user | Path index from the Step 12 schema. |
| refresh_sessions | `{ familyId: 1 }` | family revoke on replay | Path index from the Step 12 schema. |
| refresh_sessions | `{ expiresAt: 1 }` TTL `expireAfterSeconds: 0` | delayed deletion after expiry | Not an authorization check. The API must still reject `expiresAt <= now`. |

No TTL was added to notifications, audit logs, or domain history.

## Active conflict pair constraint

Before validation, the conflict model orders the two work-request ObjectIds and
derives `activePairKey` as `<lower-id>:<higher-id>` for `OPEN`,
`COORDINATION_PENDING`, and `UNDER_REVIEW`. A partial unique index applies only
while that key exists. `RESOLVED`, `CLOSED`, and `DISMISSED` records omit the key,
so multiple historical records for the same pair are allowed. Future update
services must use validated document writes or maintain this derived field when
changing status; direct unvalidated collection updates are not allowed.

## Index lifecycle

Mongoose automatic index creation is enabled for development/test by default and
disabled in production. Production indexes must be reviewed and deployed as an
explicit operational change before application traffic depends on them.

Run the read-only inspector with configured database environment variables:

```bash
npm run db:indexes:check
```

The command connects with `autoIndex: false`, reads declared and installed index
metadata, and reports `expected`, `existing`, `missing`, and `mismatch` for every
model. It never calls `createIndex`, `syncIndexes`, `dropIndex`, or modifies data.
Its output contains no URI or credentials and exits nonzero when an expected
index is missing or has different enforcement options. No production sync tool
is provided in Step 14 because safe rollout, duplicate remediation, and approval
must be handled explicitly rather than by an application command.
