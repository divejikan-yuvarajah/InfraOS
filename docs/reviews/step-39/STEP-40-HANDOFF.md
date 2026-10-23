# Step 40 handoff

Step 39 issues access JWTs and rotating refresh sessions. It does not log anyone out.

## Step 40 should add

- `POST /api/v1/auth/logout` that clears the same cookie flags and revokes the current family.
- No claim that existing access JWTs die on other routes until Step 44 checks account status on each protected request.

## Limits to keep visible

- Production web login is still forced to preview.
- Q-002 is still an open product question. The blocking rule is: only verified `ACTIVE` users with an active role and an active agency may sign in. There is no seeded-staff exception.
- Benign refresh races inside 10 seconds do not revoke the family. Reuse after that window does.
- Accounts with no agency cannot sign in.
