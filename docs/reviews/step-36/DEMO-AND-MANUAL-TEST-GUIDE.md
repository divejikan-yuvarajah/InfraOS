# Step 36 — How to test it

**NO EXPOSED REGISTRATION ENDPOINT — SERVICE-ONLY BY DESIGN.**

Do not open a browser and do not call `/api/v1/auth/register`. That path is not implemented. If the API is running, that URL is still a 404 `ROUTE_NOT_FOUND`.

## Checkout

```powershell
cd c:\Users\ASUS\Desktop\InfraOS\InfraOS-step36
git status -sb
node -v
```

Branch: `feature/step-36-secure-registration`. Base commit `448fd91`. Node 22 or newer. Dependencies are already installed in this worktree, including `bcryptjs`.

The other folder, `c:\Users\ASUS\Desktop\InfraOS\InfraOS`, is a different branch. Do not run this demo there.

## Repeat the proof

```powershell
npm run test -w @infraos/api -- tests/registration.service.test.ts
```

Expected: **7 passed**. The database is mongodb-memory-server. No Atlas URI is used.

The fixture password is `correct-horse-battery`. It exists only inside the test. Do not reuse it as a real account password.

## What success looks like

The first test provisions `Nimal Silva` at `nimal@example.com` (the input is mixed-case and padded). After the call:

- status is `PENDING`
- `emailVerified` is false
- role is `AGENCY_OFFICER`
- agency id matches the active `DEMO_RDA` fixture
- stored `passwordHash` starts with `$2` and contains `$12$`
- `bcrypt.compare` succeeds for the fixture password and fails for `wrong-password`
- `RefreshSession` count for that user is 0
- the returned DTO has no `email`, `password`, or `passwordHash`
- `nextAction` is `VERIFY_EMAIL`, and no email is sent

## Error cases in the same file

| Case | Result |
| --- | --- |
| Password `é` repeated 40 times | `RegistrationInputError` before hashing |
| 72 ASCII characters | accepted and verifiable |
| Anonymous body with `roleKey: SUPER_ADMIN` and `emailVerified: true` | `RegistrationInputError`, zero users |
| Actor `source: "http"` | `RegistrationDeniedError`, zero users |
| `requestCitizenRegistration` | `RegistrationPolicyBlockedError` |
| Extra `status: "ACTIVE"` | `RegistrationInputError` |
| Inactive agency | `RegistrationInputError` |
| Two parallel creates of `dup@example.com` | one success, one `RegistrationConflictError`, one row |
| `User.create` throws a message that contains a URI | error message is exactly `registration could not be stored` |
| Demo sentinel hash | `bcrypt.compare` returns false |

## What you should not expect

- A registration page, screenshot, or cookie.
- A 200 from login or register.
- An email verification message. That is Step 37, which has not been started.

## Still incomplete

- Production index check: **NOT RUN**.
- Who may construct the trusted actor: Steps 44–46.
- Commit and pull request into `development`: waiting for your approval.
