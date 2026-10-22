# Step 36 — Threat model

| Threat | Defense |
| --- | --- |
| Public `SUPER_ADMIN` signup | No route. Anonymous function rejects privileged keys and creates zero users. |
| Mass assignment of `status` / `emailVerified` / `roleId` | Zod `.strict()` on the trusted input. Unknown keys fail before write. |
| Citizen signup while Q-005 is open | Dedicated function throws and is not mounted. |
| Password in logs or DTO | DTO omits email, password, and hash. Audit object omits the password. Dependency errors use a fixed message. |
| bcrypt 72-byte truncation | Rejected before `hash()` when UTF-8 length is over 72. |
| Duplicate email race | Unique index. `E11000` becomes `RegistrationConflictError` with a generic message. |
| Session issued at signup | No `RefreshSession` write. Test counts sessions for the new user. |
| Database error leaking URI | Lookup and create errors that are not input/policy errors become `RegistrationDependencyError`. |

SoD for who may call the trusted actor is **BLOCKED** until Steps 44–46. The capability string is not an HTTP header.
