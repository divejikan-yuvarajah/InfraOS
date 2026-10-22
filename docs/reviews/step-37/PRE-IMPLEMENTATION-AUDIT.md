# Step 37 pre-implementation audit

**Date:** 2026-10-22  
**Base:** `origin/development` `b315b0f`  
**Branch:** `feature/step-37-email-verification` (worktree `InfraOS-step37`)  
**Primary checkout:** left untouched on `feature/infraos-connected-future-ui` with the uncommitted internal design system.

## Prerequisites

| Check | Result |
|---|---|
| Step 35 on `origin/development` | Present. PR #50, commit `1a27743`. Unique `refresh_sessions.tokenHash`, hash redaction. |
| Step 36 on `origin/development` | Present. PR #54, commit `3b71579`, included through PR #55 at `b315b0f`. `provisionStaff` only. |
| Q-001 | Closed. Staff accounts are provisioned by a trusted server actor. No public registration route. |
| Q-002 | **Open.** Verification must not set `status` to `ACTIVE`. |
| Q-005 | Closed. `requestCitizenRegistration` stays blocked. |
| Mail provider | Not configured. Project delivery is deferred to P2. Production issuance fails closed. |
| Steps.docx | Not in the repository. |
| Design system | Sora / DM Sans internal shell is not on this branch. No verification page is added. |

## Threats accepted before code

- Raw verification tokens must not be stored, returned, or logged.
- TTL deletion is not authorization.
- Two POSTs of the same token must produce one success.
- A failed user update must not leave a burned token that the client treats as success.
- Resend must invalidate the previous challenge.
- Public request responses must not reveal whether the email exists.
- `Host`, `Origin`, and `returnTo` must not choose the link base.
- Verification must not create a `RefreshSession` or change role, agency, or status.

## Out of scope

Login UI, JWT, refresh cookies, logout, password reset, route authorization, admin user UI, citizen signup, and a real mail provider.
