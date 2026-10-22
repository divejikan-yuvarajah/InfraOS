# Step 36 — Registration policy

| Actor | Decision |
| --- | --- |
| Anonymous staff signup | **Denied.** `rejectAnonymousStaffRegistration` writes nothing. No route is mounted. |
| Trusted server actor | `source: "server-internal"` and `capability: "identity.provision"` only. HTTP code must not construct this value until Steps 44–46 enforce permissions. |
| Citizen | `requestCitizenRegistration` always throws `RegistrationPolicyBlockedError` (`Q-005`). |
| New staff user | `PENDING`, `emailVerified: false`. `nextAction: "VERIFY_EMAIL"` does **not** mean an email was sent. |
| Password | bcryptjs cost 12, 8–72 UTF-8 bytes. Not emailed. Not logged. Demo sentinel hash is not a bcrypt hash and does not verify. |
| `createdBy` | Stored as null in this step. The actor id is only on the in-memory audit object. Persistence of that audit record waits for the audit write path. |

Step 37 may add a verification challenge. It must not treat this step as proof the mailbox was checked.
