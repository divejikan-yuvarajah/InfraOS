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

Root `package.json` includes working `dev:web`, `build:web`, `lint:web`, and `type-check:web` scripts after Step 8. API scripts are added in Step 9.

## Runtimes

| Runtime | Locked |
|---------|--------|
| Node.js | **22 LTS** (`.nvmrc` / `.node-version`) |
| npm | **10+** (workspaces) |
| TypeScript | 5.x (installed with apps in Steps 8–9) |
| Python | **3.12** later, with FastAPI |

Local machines may run a newer Node 22+ for install; CI should use Node 22.

## What this step does not contain

- Express / Helmet / routes
- MongoDB / Mongoose
- Auth / RBAC middleware
- Feature modules
- GitHub Actions CI
- Real `.env` values
- A third env-name catalog (architecture vs this example: [INC-005](../planning/assumptions-risks.md#inc-005--environment-variable-names); Step 10 unifies)
