# INFRAOS — Production-readiness remediation and release gates

**Scope:** changes prepared from the public `development` branch `9ee3ea341b258a0557bf6b43793bbe72b308dd6d`, October 28, 2026. This is an **unapplied proposed patch**; not a deployment or a completed production verification. Do not represent PASS without fresh execution.

## What this patch changes

- Production login stops being **unconditionally** preview-only. It remains **preview by default**; explicit `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=1` plus a public **HTTPS origin-only** `NEXT_PUBLIC_API_BASE_URL` is needed at Next build time to enable the existing live auth transport.
- Adds a no-secret GitHub Actions PR/push quality workflow invoking all existing tests, type checks, lint and builds. Passing a run does **not** imply Atlas or browser acceptance.
- Adds regression tests for the production gate and documents the flag in `apps/web/.env.example`.

### Enabling production login: DO NOT do this yet

- Obtain owner security approval for deployment; create distinct staging and production services and credentials.
- Configure real HTTPS `NEXT_PUBLIC_API_BASE_URL` at **build time** and `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=1` **only after** the API and cookie/origin checks pass. Rebuild Next after changing any public flag.
- On the API, `FRONTEND_ORIGIN` must equal the deployed web origin (scheme, host, port). Set `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` to two independently generated, strong private values. Never put those in Next variables or logs.
- Verify production refresh cookie attributes (`HttpOnly`, `Secure`, `SameSite=None`, path) and whether cross-site cookies are permitted by browsers and your deployment domain topology. Confirm refresh, logout, revocation, password reset, CSRF/origin enforcement, and cache isolation in a **real signed-in staging browser** before shipping. HTTPS alone does not establish end-to-end readiness.
- Confirm `/ready` succeeds in staging, secure network access, health alerts, backups, recovery tests, audit retention, and deployment secrets; no direct synthetic staff records in production.

## Separate unresolved P0 gates — DO NOT claim fixed

| Gate | Next authorized work | Acceptance evidence |
|---|---|---|
| Atlas indexes/schema | `npm run db:indexes:check` already exists and is read-only. With explicit DB **read** authorization and sanitized environment, review the report with the owner; plan any missing indexes and migrations separately, never auto-sync production indexes | Signed-off index diff/backup/rollback plan and approved change window; no writes merely to show a green result |
| Step 51 role/grant and agency hierarchy races | Build deterministic concurrent transaction tests for project writes vs role revocation and agency reparent/deactivation, using disposable MongoDB replica. Audit shared lock ordering and retry behavior; never assume one cached grant check is enough | Repeatable tests that prevent unauthorized commits under adversarial scheduling and use fail-closed errors |
| Email verification/invitation/recovery | Existing sender in production is deliberately unavailable and no provider has been approved. Choose and explicitly approve a transactional email service/provider, sender domain and DNS; then implement a server-only adapter with retries, delivery telemetry, suppressed logs and generic responses | Secure staged delivery of invite, verify, reset; provider failure/retry tests, no token in logs, no account enumeration |
| Null-agency Super Admin | Decide platform-only read/write policy and rework all affected auth/refresh/resource scope before enabling. `requireAuthenticated` currently requires a non-null agency; changing one function alone is unsafe | End-to-end null-agency admin login, platform IAM scope, no project approval or operational writes, role-change and null-agency regression suites |
| Sinhala/Tamil native copy | Qualified native-language reviewers sign off meaning, layout, keyboard flow and terminology; eliminate English fallback for release-critical actions | Owner-approved linguistic QA evidence on mobile and desktop |
| Release controls | Set required PR checks and branch protections in GitHub UI after CI runs are passing (admin action). Add staging smoke/E2E, alerting, backup drills, evidence and rollback | Reviewed deployment runbook, independent approval, and deployment owner signoff |

### Security notes

- This patch **does not** call GitHub write APIs, enable auth on an existing deployment, connect to Atlas, run migrations, or create branches/commits/PRs.
- `.github/workflows/quality.yml` uses no credentials; API tests must remain disposable. Never set production Atlas variables or backend signing keys as CI test secrets.
- Do **not** silently open production auth by setting the flag in an unreviewed deployment. Do not expose live user data merely to demonstrate UI.
- The existing demo script (`apps/api/src/scripts/step57-isolated-dev.ts`) embeds disposable credentials. It must never be deployed or published as a runnable public service; restrict the host/network and move fixture credentials to environment injection in a separately reviewed harness-hardening change.

## Suggested local application (owner must approve modifying local worktree)

```powershell
cd C:\Users\ASUS\Desktop\InfraOS\InfraOS
git status --short --branch
git fetch origin
# If your local branch does not match the patch base, ask Cursor to port the changes manually; DO NOT reset.
git apply --check C:\path\to\INFRAOS_Production_Readiness_Safe_Fixes.patch
git apply C:\path\to\INFRAOS_Production_Readiness_Safe_Fixes.patch
git diff --check
npm run test:web
npm run test:api
npm run type-check
npm run lint
npm run build
```

Do not stage, commit, push, open PR or merge without separate explicit approval. CI `workflow_dispatch` can be run only after the workflow is committed by an authorized maintainer. Production approval still blocked on the P0 items above.
