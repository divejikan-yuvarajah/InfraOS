# Step 38 pre-implementation audit

**Date:** 2026-10-23  
**Branch:** `feature/step-38-login-ui-client-flow`  
**Base SHA:** `e0945b0549cec57f1b50af170c7d56afd3e9dd79` (`origin/development`)  
**Worktree:** main project folder only (`C:\Users\ASUS\Desktop\InfraOS\InfraOS`)

## Dependencies

| Gate | Result |
|---|---|
| Step 35 on `development` | Present |
| Step 36 provisioning service | Present |
| Step 37 email verification | Present (`2f2fc20`, merged PR #57) |
| Q-002 | **Open** — login must not activate `PENDING` staff; client does not change status |
| Q-005 | Closed — no citizen signup UI |
| Step 39 login API | **Not implemented** — Step 38 is preview-only |
| Internal design system V1 | **Local WIP preserved** on this branch (not merged to `development` alone). Login uses scoped `[data-infra-app]` styles and local token CSS |

## `apiClient` audit

Previous default: `credentials: "include"` on every request.  
Step 38 change: default **`omit`**. Only auth transport passes `credentials: "include"` for future cookie routes. No other web feature calls `apiClient` today, so regression risk is low.

## Baseline tests (before Step 38 edits on this branch)

Recorded at branch creation: web **96** tests on clean `development`. After Step 38 + preserved DS WIP: web **109** tests.

API full suite on this machine after branch switch: **BLOCKED** until `npm ci` completes (`bcryptjs` missing while `next dev` holds native locks). Re-run after stopping dev servers.
