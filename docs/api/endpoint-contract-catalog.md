# Endpoint contract catalog

Base path: `/api/v1`.

**Implemented today:** `GET /api/v1/health`, `GET /api/v1/ready` (also mounted at `/health` and `/ready`).

Every other route below is **PLANNED**. None of these handlers exist in Step 16.

| Method | Path | State | Priority | Auth | Permission (catalog) |
|---|---|---|---|---|---|
| GET | `/api/v1/projects` | PLANNED | P0 | authenticated | `project.read` |
| POST | `/api/v1/projects` | PLANNED | P0 | authenticated | `project.create` |
| GET | `/api/v1/projects/:id` | PLANNED | P0 | authenticated | `project.read` |
| PATCH | `/api/v1/projects/:id` | PLANNED | P0 | authenticated | `project.update` |
| POST | `/api/v1/projects/:id/submit` | PLANNED | P0 | authenticated | `project.submit` |
| POST | `/api/v1/projects/:id/approve` | PLANNED | P0 | authenticated | `project.approve` |
| GET/POST | `/api/v1/projects/:projectId/milestones` | PLANNED | P0 | authenticated | `milestone.read` / `milestone.create` |
| POST | `/api/v1/work-requests` | PLANNED | P0 | authenticated | `roadsync.work_request.create` |
| GET | `/api/v1/work-requests/:id/candidates` | PLANNED | P0 | authenticated | `roadsync.conflict.read` |
| GET | `/api/v1/conflicts` | PLANNED | P0 | authenticated | `roadsync.conflict.read` |
| POST | `/api/v1/conflicts/:id/resolve` | PLANNED | P0 | authenticated | `roadsync.conflict.resolve` |
| GET | `/api/v1/map/features` | PLANNED | P0 | mixed | `map.view.public` or `map.view.internal` |
| GET | `/api/v1/auth/me` | PLANNED | P0 | authenticated | session |
| GET | `/api/v1/agencies` | PLANNED | P1 | authenticated | `agency.read` |
| GET/POST | `/api/v1/payments` | PLANNED | P1 | authenticated | `finance.payment.read` |
| GET | `/api/v1/documents` | PLANNED | P1 | authenticated | `document.read` |
| POST | `/api/v1/inspections` | PLANNED | P1 | authenticated | `inspection.read` |
| GET | `/api/v1/assets` | PLANNED | P1 | authenticated | `asset.read` |
| POST | `/api/v1/issues` | PLANNED | P1 | citizen | own record |
| GET | `/api/v1/notifications` | PLANNED | P1 | authenticated | `notification.read` |
| GET | `/api/v1/audit` | PLANNED | P1 | authenticated | `audit.read` |
| POST | `/api/v1/ai/risk` | PLANNED | P2 | internal | `risk.request` |

P0 bodies use `CreateProjectRequest`, `UpdateProjectRequest`, `ProjectApprovalCommand`, `CreateWorkRequestRequest`, `ResolveConflictRequest`, and `MapViewportQuery`. Success payloads use the matching DTO inside `ApiSuccess`.

Candidate search returns `SpatialConflictCandidateDto` with `label: "CANDIDATE_ONLY"`. It is not a detected conflict.
