# INFRAOS repository structure

**Document:** `/docs/architecture/repository-structure.md`  
**Step:** 07  
**Status:** Locked  
**Application feature code in this step:** None

This is the workspace layout. Next.js is Step 8. Express is Step 9. FastAPI remains documentation-only.

---

## Layout

```text
infraos/
├── apps/
│   ├── web/              # @infraos/web — Next.js (Step 8)
│   ├── api/              # @infraos/api — Express (Step 9)
│   └── ai-service/       # FastAPI — README only (not an npm workspace)
├── packages/
│   └── shared-types/     # @infraos/shared-types — shared contracts only
├── docs/
├── Prompts/
├── .github/
├── .gitignore
├── .editorconfig
├── .env.example
├── .nvmrc                # Node 22 LTS
├── CONTRIBUTING.md
├── README.md
├── package.json          # npm workspaces
└── package-lock.json
```

## Package manager

**npm workspaces** (one lockfile: `package-lock.json`). Do not add pnpm or Yarn lockfiles.

Root workspaces:

```text
apps/web
apps/api
packages/*
```

`apps/ai-service` is Python and is **not** listed in `workspaces`.

Root `package.json` includes working web and API scripts (`dev:web`, `dev:api`, `lint`, `type-check`, `test`, `build`).

## Runtimes

| Runtime | Locked |
|---------|--------|
| Node.js | **22 LTS** (`.nvmrc` / `.node-version`) |
| npm | **10+** (workspaces) |
| TypeScript | 5.x (installed with apps in Steps 8–9) |
| Python | **3.12** later, with FastAPI |

Local machines may run a newer Node 22+ for install; CI should use Node 22.

## What this step does not contain

- MongoDB / Mongoose
- Auth / RBAC middleware
- Feature modules (ProjectTrace, RoadSync, …)
- GitHub Actions CI
- Real secret values
- A third env-name catalog — **closed Step 10:** [environment.md](../setup/environment.md), [INC-005](../planning/assumptions-risks.md#inc-005--environment-variable-names)
