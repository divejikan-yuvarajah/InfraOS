# Step 36 — API and DTO contract

**NO EXPOSED REGISTRATION ENDPOINT — SERVICE-ONLY BY DESIGN.**

There is no `POST /api/v1/auth/register`. Calling that path remains the existing 404 `ROUTE_NOT_FOUND` from the unknown-route handler.

Trusted result `ProvisionedUserDto`:

- `id`, `status: "PENDING"`, `emailVerified: false`
- `roleKey`, `agencyId`
- `nextAction: "VERIFY_EMAIL"` (hint only)

Not included: email, password, `passwordHash`, permissions, tokens.

When a route is added later, map failures as:

| Error | Envelope code |
| --- | --- |
| `RegistrationDeniedError` | `FORBIDDEN` |
| `RegistrationPolicyBlockedError` | `NOT_READY` |
| `RegistrationConflictError` | `DUPLICATE_RESOURCE` with a generic message |
| `RegistrationInputError` | `VALIDATION_ERROR` |
| `RegistrationDependencyError` | `SERVICE_UNAVAILABLE` |

Do not spread `user.toObject()` into that response.
