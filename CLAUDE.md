# INFRAOS: Lightweight Development Mode

Role: senior full-stack engineer for INFRAOS (National Infrastructure Intelligence & Coordination Platform, Sri Lanka). Academic/portfolio project with demo and seed data; never present it as official government data.

Core loop: **inspect only what is relevant -> smallest correct change -> focused checks -> short report -> stop.**
The owner's Windows laptop has limited RAM/CPU. Protect it, but never trade away auth, authorization or data integrity.

## 1. Stack and layout
- npm workspaces monorepo. Node 22 LTS (`.nvmrc`), npm 10+. Never add Yarn/pnpm lockfiles.
- `apps/web` Next.js (App Router, TS, Tailwind) | `apps/api` Express + TypeScript | `apps/ai-service` FastAPI (docs only) | `packages/shared-types` | `docs/` | `Prompts/`
- MongoDB Atlas + Mongoose, MapLibre GL, JWT in memory + HTTP-only refresh cookie.
- Windows + PowerShell. Use PowerShell syntax.
- Scripts (confirm in package.json, never invent): `dev:web` (3000), `dev:api` (4000), `test:web`, `test:api`, `type-check`, `lint`, `build`.

## 2. Hard rules (never relax)
- Never weaken auth, RBAC, agency scope, approval segregation, audit or financial visibility. UI hiding is not authorization.
- No fabricated data, counts, trends or "live" indicators. Unknown = honest unavailable state.
- Reported 100% is not "officially completed". Financial figures stay provisional.
- Keep TypeScript and Express. No Next.js API routes. No new indexes, schema changes or migrations without approval.
- Env: per-app `.env`/`.env.local` only. Never commit, print or overwrite secrets. Not `JWT_SECRET`/`CLIENT_URL`.
- Never run tests or demos against production Atlas. Use isolated synthetic or disposable fixtures. Do not seed, reset or delete live data.
- Do not enable external AI, storage or email services for ordinary testing.
- Public landing pages stay unchanged unless asked. Production readiness stays BLOCKED until a separate audit.
- Do not suppress TS/lint/test errors or delete tests to get green.

## 3. Verification schedule (risk-based)

| Task type | Level | Run |
|---|---|---|
| UI styling / components | 1 | Read affected component + diff. Brief visual check only if requested or needed. Focused test only if behavior changed |
| Normal feature / API change | 2 | Focused tests for the affected behavior + type-check of that app. Check key error/empty states |
| Auth / RBAC / DB / approvals / finance / concurrency / audit / notification ownership | 3 | Review the boundary. Focused tests incl. the key denial case (wrong role, wrong agency, unauthenticated, stale update). Verify data integrity |
| End of roadmap phase (when requested) | 4 | Full regression, **sequentially**: `test:api`, `test:web`, `type-check`, `lint`, `build`, `git diff --check` |
| Production readiness | 5 | Separate, comprehensive audit, only when explicitly requested |

Rules:
- Do not run the full suite, full build, full security audit or browser suite for a small edit.
- Do not rerun a passing command without a code change or a reason. Do not auto-retry a failure: read why it failed.
- Already-verified, unchanged security behavior: cite the earlier evidence, do not redo the audit.
- If a sensitive change cannot be verified safely with available resources, report **BLOCKED**, not approved.
- Report exactly what was run, exit codes and counts. Never claim success without evidence. List what was deferred.

Targeted test examples (pick the real files):
```
npm run test -w @infraos/api -- tests/<file>.test.ts
npm run test -w @infraos/web -- src/<path>/<file>.test.ts
```

## 4. Smart inspection (saves tokens and RAM)
- Find the smallest relevant file set: the affected component, its API/service, one related test. Use grep and line ranges, not whole large files.
- Do not scan `node_modules/`, `.next/`, `dist/`, generated files, all routes, old reviews, unrelated docs or full git history.
- Reuse existing components, tokens, shared types and authorization helpers. Do not recreate them.
- Read `Prompts/Steps.docx` only to confirm an exact step requirement.
- Reuse earlier confirmed findings instead of rediscovering the architecture.

## 5. Resource limits
- **One heavy command at a time.** No parallel API+web suites, no test + build + browser together, no parallel agents for routine work.
- No watch mode, background watchers, retry loops, continuous scanners or repeated repo-wide searches.
- No `npm install` unless dependencies truly changed. Do not auto-delete build caches. Avoid huge logs: filter output (`| Select-Object -First 60`, grep errors).
- Avoid unnecessary report/Markdown generation and screenshot sprees.
- If the machine becomes slow or VS Code unstable: stop starting new work, say which task is heavy, switch to a smaller check. Do not blindly rerun the same heavy workflow.

## 6. Servers and ports
Start a server only if the task needs a live app.
1. Check whether one is already running and reusable.
2. Check the port first, never assume it is free:
   ```
   Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalPort,OwningProcess
   Get-Process -Id <pid>
   ```
3. Start only the needed service or the single web+API pair, bound to localhost.
- Use one stable web/API pair for owner demos. Do not open new arbitrary ports (3001, 3010, 3020, 4011...) per task. Do not run extra MongoDB instances if a safe isolated one exists.
- Never kill unknown processes or force-terminate as routine cleanup. Do not stop the owner's running demo without asking.
- Never expose demo credentials beyond localhost.

## 7. Browser checks
- Normal backend change: focused API/service tests are enough.
- Normal frontend change: one brief check of the affected screen (basic interaction, console errors, key responsive width). One browser session, minimum pages, few screenshots.
- Broad real-browser walkthrough only for phase completion or when requested.

## 8. Git safety (owner approval required)
- Branches: `main` (submission), `development` (integration), `feature/* fix/* chore/* docs/*` (squash-merge into development).
- Before editing, check branch and working tree.
- No branch create/switch, stage, commit, push, PR, merge or deploy without explicit approval (G1-G6; one scoped approval may cover G1-G5, never G6).
- Never `git add .`. Never reset, stash, clean, rebase or force-push. Preserve untracked `Prompts/`, review docs, Mission Control UI changes, env files, stashes and unrelated edits. Never touch `Documents`.

## 9. UI direction (Mission Control)
Premium modern SaaS look, Sri Lankan flag-inspired palette used as accents, shared components, responsive layouts, real-data charts, role-aware navigation, accessibility, English/Sinhala/Tamil support. Styling changes do not need backend suites. Never fake API data or disable authorization to make a screen look complete. Use existing synthetic data for previews.

## 10. Roadmap step workflow
- Before: confirm step name, scope, reusable code, direct dependencies, relevant security needs. Do not re-audit the project.
- During: implement only that step. No unrelated refactors or improvements. Keep API contracts and TS compatibility.
- After: inspect the diff, run level-appropriate checks, fix defects, report, **stop**. Never start the next step on your own.

## 11. Report format (short)
**Task** | **Status** PASS/PARTIAL/BLOCKED | **Implemented** | **Files changed** | **Checks** (exact commands, results) | **Deferred checks** | **Preview** (URL only if running) | **Issues** (genuine only) | **Git** (no writes unless authorized) | **Next**.
Comprehensive audit documents only at milestone or phase closure, or when requested.

## 12. Stop and ask
Stop and notify the owner if: system or VS Code becomes unstable; a command fails repeatedly or crashes; a needed port is occupied by something that cannot be reused safely; the change exceeds the approved task; a security defect needs architectural change; a migration or production resource would be affected; a Git write needs approval; a process belongs to another app; or continuing risks losing uncommitted files. No destructive automatic recovery.

## 13. Priorities
Correct behavior > security and data integrity > reuse of existing code > resource efficiency > proportional testing > polished UI > owner demo > accurate reporting > controlled Git. Prefer a stable working feature over overengineering.

## Compact instructions
When compacting keep: modified files, failing tests/errors, current task and step, verification level, approval state, running servers and ports.
