# Contributing to INFRAOS

INFRAOS is a university group project (South Eastern University of Sri Lanka). This file is the short entry point. The full workflow lives in `/docs/team`.

## Before you write code

1. Read [docs/planning/README.md](./docs/planning/README.md) (scope and P0).
2. Follow the locked stack in [docs/architecture/README.md](./docs/architecture/README.md).
3. Follow RBAC in [docs/security/README.md](./docs/security/README.md) — **never UI-only authorization**.
4. Follow routes in [docs/ux/README.md](./docs/ux/README.md).
5. Work only in your owned module ([docs/team/module-ownership.md](./docs/team/module-ownership.md)).

The npm workspace exists (Step 7). Do not add product features until the relevant later step. Next.js is **Step 8**. Express is **Step 9**. Install with `npm install` from the repository root (one lockfile). Do not add pnpm or Yarn.

## Workspace

```text
apps/web                 @infraos/web     (Step 8)
apps/api                 @infraos/api     (Step 9)
apps/ai-service          FastAPI docs     (not an npm workspace)
packages/shared-types    shared contracts only
```

## Git in one page

- Branch from latest **`development`** (create `development` from `main` once if it does not exist).
- Names: `feature/<task>`, `fix/<issue>`, `chore/<task>`, `docs/<topic>`.
- Conventional Commits (`feat:`, `fix:`, `docs:`, …).
- Open a PR into **`development`** using the GitHub template. **Squash merge**.
- Merge **`development` → `main`** only for integration-ready releases.
- **Never force-push `main` or `development`. Never rewrite shared history.**

Details: [docs/team/git-workflow.md](./docs/team/git-workflow.md).

## Definition of done

Requirement + architecture + validation + **server** authorization + UI states + tests + docs + reviewed PR + merge + integration check.

See [docs/team/definition-of-done.md](./docs/team/definition-of-done.md).

## Secrets

Never commit `.env`, keys, or credentials. Commit `.env.example` with names only.

## AI / Cursor

Inspect first, small diffs, reuse existing code, stop after the requested task. Do not “improve the entire repo” in a feature branch.

## Questions

Team leader is the integrator for shared files, auth, envelope, navigation, CI, and deploy.
