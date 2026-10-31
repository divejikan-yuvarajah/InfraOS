# INFRAOS — Production-readiness remediation and release gates

**Recorded:** 28 October 2026, on local branch `feature/projecttrace-edit-lifecycle` at `88c6b3800f5c5d83a3e0b42ffc8d1afe15175d07`.

This is a local implementation record. It is not a deployment, not a GitHub Actions run, and not production readiness.

The proposed patch was written against `origin/development` `9ee3ea341b258a0557bf6b43793bbe72b308dd6d`. Local `development` is still `35edec5`. The Downloads path `C:\Users\ASUS\Downloads\INFRAOS_Production_Readiness_Safe_Fixes.patch` was not present. `git apply --check` on `Prompts/INFRAOS_Production_Readiness_Safe_Fixes.patch` failed: `apps/web/src/lib/auth/auth.test.ts` and `apps/web/.env.example` no longer match that patch context. The same behavior was applied by hand. Nothing was reset.

## What changed

- Production login stays **preview unless both** `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=1` and a public HTTPS API origin are present at build time. HTTP, localhost, credentials, query strings, hashes, and a non-root path stay preview.
- `.github/workflows/quality.yml` runs the existing test, type, lint, and build scripts with login forced off. It exits if `MONGODB_URI`, `MONGODB_URL`, or `DATABASE_URL` is set. It does not receive Atlas credentials. API tests already start `mongodb-memory-server` and skip `apps/api/.env` when `NODE_ENV=test`.
- `.nvmrc` is `22`, because the workflow reads it and the repo had no Node version file. `package.json` already requires Node `>=22`.
- Regression tests cover the production gate. `apps/web/.env.example` documents `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=0`.
- `apps/web/.env.local` was not edited. It still has local login enabled against `http://localhost:4000`. A production build that reads that file still resolves to preview, because that URL is not an approved HTTPS origin.

Production login was not enabled on any deployment. No Atlas connection, schema change, or index change was made. The public landing page was not edited. Nothing was committed, pushed, or merged.

## Local gates

| Check | Result |
| --- | --- |
| `git apply --check` on the Downloads patch | FAIL. File not found. |
| `git apply --check` on the Prompts copy | FAIL. Auth test and `.env.example` context do not match this tree. Equivalent edits were applied without a reset. |
| `npm run test:web` with the CI flags `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=0`, `NEXT_PUBLIC_AUTH_FIXTURE=0`, `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000` | PASS. 38 files, 172 tests. |
| `npm run test:web` with no flag override | NOT RUN as a second full suite. A bare local run can still fail `auth.test.ts` “never returns success without live backend” because `.env.local` enables login. That file was left unchanged. CI sets the flag to `0`. |
| `npm run test:api` | PASS. 31 files, 306 tests. Disposable memory replica only. |
| `npm run type-check` | PASS. |
| `npm run lint` | PASS. 0 errors. Two existing web warnings in `data-table.tsx` and `project-create-form.tsx`. |
| `npm run build` | PASS. Next reported `Environments: .env.local`. Middleware deprecation warning only. Login stays preview for the local HTTP API origin. |
| `git diff --check` | PASS. |
| GitHub Actions `quality` workflow | NOT RUN. The workflow is local and uncommitted. |

## Enabling production login: do not do this yet

- Obtain owner security approval. Use separate staging and production services and credentials.
- Set a real HTTPS `NEXT_PUBLIC_API_BASE_URL` at build time and `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=1` only after the API and cookie/origin checks pass. Rebuild Next after any public flag change.
- `FRONTEND_ORIGIN` must equal the deployed web origin. `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` must be two independent private values. Never put them in Next variables or logs.
- Confirm refresh cookie attributes, cross-site cookie behavior, refresh, logout, revocation, password reset, origin enforcement, and cache isolation in a signed-in staging browser.
- Confirm `/ready`, network access, alerts, backups, recovery, and audit retention. Do not put synthetic staff records in production.

## Unresolved P0 gates

| Gate | Status | Why it is still open |
| --- | --- | --- |
| Atlas indexes and schema | NOT RUN | `db:indexes:check` was not run. No production read or write was authorized. |
| Step 51 role and agency races | BLOCKED | Not part of this change. Existing agency reparent tests remain; a full adversarial project-write versus revocation suite was not added. |
| Email invitation and recovery delivery | BLOCKED | No provider is approved. Production sender stays unavailable. |
| Null-agency Super Admin | BLOCKED | `requireAuthenticated` still requires an agency. No policy change was made. |
| Sinhala and Tamil native copy | BLOCKED | No native-language signoff. |
| Release controls | NOT RUN | Branch protection and required checks need a GitHub admin after this workflow is committed and has passed on the remote. Staging smoke, alerting, backup drills, and rollback were not executed. |
| Signed-in staging browser for production cookies | NOT RUN | Local disposable demos are not a production cookie/origin proof. |

## Security notes

- This change does not call GitHub write APIs, enable a deployed login, connect to Atlas, or migrate data.
- Do not add Atlas URIs or signing keys to the quality workflow.
- `apps/api/src/scripts/step57-isolated-dev.ts` still contains disposable fixture credentials. Do not deploy that script. Moving those credentials is a separate review.

Do not stage, commit, push, open a pull request, or merge without a separate approval. Production approval remains blocked on the P0 gates above.

## Post-merge addendum — 28 October 2026

The local record above is unchanged. It described the worktree before this change was committed. What follows was checked against GitHub after the merge.

[Pull request #100](https://github.com/divejikan-yuvarajah/InfraOS/pull/100) is merged. The base was `development` at `9ee3ea341b258a0557bf6b43793bbe72b308dd6d`. The head was `dabeede1845d019ff69f575c8961c1a318113115` on `feature/production-readiness-phase-1`. The merge commit on `development` is `596e50648de5e6fad212c5601ff53b6952fa7dad`, merged at 2026-10-27T19:56:12Z. GitHub `development` still points at that commit. The pull request changed the same five files, with 175 additions and 8 deletions. Production login was not enabled.

Three `INFRAOS quality gates` runs completed with conclusion **success**. Each job is “API, web, types, lint, build”. The database-refusal step, frontend tests, disposable API tests, TypeScript, ESLint, and the production build each succeeded. No database URI was configured.

| Event | Commit | Run | Result |
| --- | --- | --- | --- |
| `pull_request` | `dabeede1845d019ff69f575c8961c1a318113115` | [run 40573064407](https://github.com/divejikan-yuvarajah/InfraOS/actions/runs/40573064407) | PASS. Completed 2026-10-27T19:56:05Z. [Job](https://github.com/divejikan-yuvarajah/InfraOS/actions/runs/40573064407/job/122432120118). |
| `push` to `development` | `596e50648de5e6fad212c5601ff53b6952fa7dad` | [run 40573548659](https://github.com/divejikan-yuvarajah/InfraOS/actions/runs/40573548659) | PASS. Completed 2026-10-27T19:59:26Z. [Job](https://github.com/divejikan-yuvarajah/InfraOS/actions/runs/40573548659/job/122433819327). |
| `pull_request` on the merge commit | `596e50648de5e6fad212c5601ff53b6952fa7dad` | [run 40573611678](https://github.com/divejikan-yuvarajah/InfraOS/actions/runs/40573611678) | PASS. Completed 2026-10-27T19:59:56Z. [Job](https://github.com/divejikan-yuvarajah/InfraOS/actions/runs/40573611678/job/122434042691). |

These runs do not close the P0 gates. Atlas indexes, Step 51 races, email delivery, null-agency Super Admin, native Sinhala and Tamil copy, release controls, and a signed-in staging cookie check stay open. A green quality run is not production readiness and is not approval to set `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=1`.
