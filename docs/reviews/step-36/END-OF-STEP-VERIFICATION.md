# Step 36 — End-of-step verification

**Verified:** 2026-10-22 from `c:\Users\ASUS\Desktop\InfraOS\InfraOS-step36`  
**Branch:** `feature/step-36-secure-registration`  
**Base:** `origin/development` `448fd91` (includes Step 35 `1a27743` via PR #50)  
**HEAD:** still `448fd91`. Step 36 edits are uncommitted.  
**Verdict:** **APPROVE RECOMMENDED** for the service-only foundation. This is not owner approval and not a login system.

## What was built

`provisionStaff` creates a `PENDING`, `emailVerified: false` user for a trusted in-process actor. The password is bcryptjs cost 12. The safe DTO has no email, password, or hash. No refresh session is created.

**NO EXPOSED REGISTRATION ENDPOINT — SERVICE-ONLY BY DESIGN.**

Citizen signup throws `RegistrationPolicyBlockedError` (Q-005). Anonymous bodies with privileged keys are rejected and write nothing.

## Acceptance

| Requirement | Result |
| --- | --- |
| Step 35 present on `development` | **PASS** |
| Q-001, no public staff register | **PASS** |
| Q-005 not implemented | **PASS** — blocked |
| Existing User/Role/Agency models | **PASS** — not replaced |
| Allowlist and strict object | **PASS** |
| bcrypt cost 12 and 72-byte limit | **PASS** |
| No JWT, cookie, or RefreshSession | **PASS** |
| UI | **NOT IN SCOPE** — design system is not on this branch |
| Q-002 | **OPEN** — not a defect |
| Audit persistence | In-memory event only |

## Tests this pass

| Command | Result |
| --- | --- |
| `npm run test:api` | **PASS** — 199/199 (14 files), including 7 registration tests |
| `npm run type-check:api` | **PASS** |
| `npm run lint:api` | **PASS** after removing a control-character regex |
| `npm run build:api` | **PASS** |
| `npm run test:web` | **PASS** — 96/96 |
| `npm run type-check:web` | **PASS** |
| `npm run lint:web` | **PASS** — existing data-table warning only |
| `npm run build:web` | **PASS** — 24 routes |
| `git diff --check` | **PASS** on the tracked diff |

Registration test command:

```powershell
cd c:\Users\ASUS\Desktop\InfraOS\InfraOS-step36
npm run test -w @infraos/api -- tests/registration.service.test.ts
```

Observed: **7 passed**.

## Git

Do not commit from `c:\Users\ASUS\Desktop\InfraOS\InfraOS`. That checkout still holds the design-system edits.

This branch currently tracks `origin/development`. A later push must use:

```text
git push -u origin HEAD:feature/step-36-secure-registration
```

Suggested commit, not created:

```text
feat(auth): establish secure controlled user provisioning
```

Step 37 was not started.
