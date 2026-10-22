# Step 38 handoff

Step 37 marks `emailVerified` and does not authenticate the user.

## Still open

- Q-002: whether a verified `PENDING` staff account may sign in or must be activated by a separate decision.
- Login page and credential check (Step 38).
- Access JWT and refresh cookie issuance (Step 39).
- Logout, password reset, and route authorization (Steps 40–46).
- Durable verification audit and an approved mail provider. Production delivery is **BLOCKED**.
- A `/verify-email` page that POSTs only after an explicit confirmation, then strips the fragment. The internal design system is not on `development`, so that page was not added here.

## Do not assume

A user with `emailVerified: true` and `status: "PENDING"` is not logged in, has no refresh session, and has the same role and agency assigned at provisioning.
