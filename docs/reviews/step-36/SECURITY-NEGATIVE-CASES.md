# Step 36 — Negative cases

| Case | Observed |
| --- | --- |
| Body contains `roleKey: SUPER_ADMIN` and `emailVerified: true` passed to the anonymous function | `RegistrationInputError`. User count stays 0. |
| Actor `{ source: "http" }` | `RegistrationDeniedError`. No write. |
| `requestCitizenRegistration` | `RegistrationPolicyBlockedError`. |
| Input includes `status: "ACTIVE"` | Zod strict object rejects it. |
| Inactive agency code | `RegistrationInputError`. |
| Two concurrent creates with `dup@example.com` | One success, one `RegistrationConflictError`, one document. |
| `User.create` throws a message containing a URI and the word plaintext | Caller receives `registration could not be stored` only. |
| Password `é` × 40 | Rejected before bcrypt. |
| `compare(password, NON_LOGIN_PASSWORD_HASH)` | false |
