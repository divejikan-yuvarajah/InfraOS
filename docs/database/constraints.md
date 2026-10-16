# Database constraints and service obligations

Step 14 reviews schema-level integrity separately from service-level business
rules. Mongoose validation applies to validated document operations. Future
services must enable validators for update queries or load, change, validate,
and save the document.

## Enforced by schemas and indexes

- Progress, risk, factor, and health scores are in `0..100`.
- Project budget, payment amount, and maintenance cost use nonnegative safe
  integer LKR minor units.
- Conflict distance is finite and nonnegative.
- Project planned/actual end is not before its start when both values exist.
- Milestone planned and actual ends are not before their respective starts.
- Work-request planned end is not before planned start.
- Maintenance completion is not before its scheduled date.
- Project codes, normalized user emails, role keys, agency codes, and required
  contractor registration numbers are unique.
- A document chunk index is unique within its document.
- An active normalized work-request pair has at most one active conflict while
  resolved/closed history remains allowed.
- Payment submitter and approver cannot be the same stored user.
- A conflict cannot reference the same work request twice.
- Notification resource type and resource id are supplied together.
- Audit records are append-only through supported Mongoose mutation paths.

Strings have model-specific maximum lengths. High-volume arrays are also
bounded: role/audit permissions, risk factors and recommendations, inspection
evidence, and citizen photos. Geometry position/ring counts are bounded. The
model reference in [data-model.md](./data-model.md) lists the exact limits.

## Schedule overlap

For two inclusive intervals A and B, overlap is:

```text
A.start <= B.end
AND
A.end >= B.start
```

Indexes narrow the candidate set. They cannot prove a conflict or replace this
service rule. Boundary-touching intervals count as overlapping under the
approved rule.

## References are not foreign keys

MongoDB ObjectId fields validate shape and Mongoose population metadata only.
They do not prove that the target exists or that the actor may use it. Before a
sensitive write, the owning service must verify referenced agency, project,
user, contractor, work request, document, and asset records as applicable. It
must also verify agency/resource scope, current status, and segregation of duty.

Unique indexes can fail when legacy duplicates exist. Production rollout must
report and review duplicates; it must never delete or rewrite records
automatically to make an index build succeed.

## Deliberate non-constraints

- `Asset.sourceProjectId` is not unique because one project can hand over more
  than one asset.
- Notifications have no TTL because no automatic retention policy is approved.
- Resolved conflict pairs are not unique because historical occurrences matter.
- ObjectId references have no claimed relational cascade or foreign-key rule.
- Spatial indexes do not establish coordinate accuracy or topology.
