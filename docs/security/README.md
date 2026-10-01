# INFRAOS Security Documentation

**Step 04** locks the authorization model. Express remains the enforcement boundary ([ADR-007](../adr/ADR-007-rbac-resource-authorization.md)). No RBAC middleware is implemented in this step.

| File | Purpose |
|------|---------|
| [roles-and-permissions.md](./roles-and-permissions.md) | Roles, scopes, pipeline, UX, errors, audit of IAM actions |
| [permission-catalog.md](./permission-catalog.md) | Stable `resource.action` names |
| [permission-matrix.md](./permission-matrix.md) | Master visibility + action matrices |
| [resource-authorization.md](./resource-authorization.md) | Scope, IDOR, status-based rules |
| [segregation-of-duties.md](./segregation-of-duties.md) | SoD and over-permission guards |
| [rbac-test-plan.md](./rbac-test-plan.md) | Future API/E2E authorization tests |

Related: [../architecture/authorization-flow.md](../architecture/authorization-flow.md)
