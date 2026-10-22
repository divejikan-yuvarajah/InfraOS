# Step 36 — Post-implementation review

## Independent pass

- Staff provisioning is a service. `apps/api/src/routes/v1.ts` was not given a registration route.
- A database error during role lookup is now mapped to `RegistrationDependencyError` instead of leaking the driver message.
- `createdBy` stays null. That is intentional until a verified actor user exists.
- `nextAction` does not send mail.
- Step 35 `tokenHash` unique index was not edited.
- Public landing files were not edited.

## Residual

| Item | Severity |
| --- | --- |
| Any in-process caller can pass the trusted actor object | Accepted until Steps 44–46. Do not read it from headers. |
| Q-005 citizen signup | **BLOCKED BY POLICY** |
| Q-002 login-before-verify | Unresolved. Not a Step 36 defect. |
| Audit row is not written to `auditLogs` | In-memory event only |

No P0 remains in the service tests.
