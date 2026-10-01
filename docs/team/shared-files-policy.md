# INFRAOS Shared Files Policy

**Document:** `/docs/team/shared-files-policy.md`  
**Step:** 06  
**Status:** Locked

> Team members should not casually modify shared/core files as part of feature work.

If a feature needs a shared-file change: document why, make the smallest change, notify the team leader, and call it out in the PR.

---

## 1. Protected shared files (after Step 7 scaffold)

Exact paths will match the monorepo layout. Treat these **categories** as protected from first commit of application code:

| Area | Examples |
|------|----------|
| Workspace / packages | Root and app `package.json`, lockfiles, `pnpm-workspace.yaml` / npm workspaces |
| Env | `.env.example`, env schema / Zod env parse |
| API platform | Router registration, API envelope, error classes, version prefix `/api/v1` |
| Authz | `middleware/auth*`, RBAC, session/cookie helpers |
| Data platform | Mongo connection, shared Mongoose plugins |
| Frontend shell | Root `layout.tsx`, nav config, design tokens, `apiClient` |
| CI / deploy | `.github/workflows/*`, Render/Vercel config |
| Types | Shared domain types (User, Role, Agency, ProjectStatus, Permission, envelope) |

Folder collision list from architecture (still valid):

- Leader: `middleware/auth*`, `lib/envelope`, `lib/errors`
- Member 2: `features/map`, `modules/map`
- Member 3: `modules/risk`, risk UI
- Member 4: `modules/documents`, FastAPI RAG
- Member 5: finance / contractor / asset modules
- Member 6: `features/citizen`, `modules/issues`, `app/(public)`

---

## 2. Design tokens and layout

Nav active state and status badges use the locked Sri Lankan flag-inspired palette (`#FF5B00`, `#FEB600`, `#8C1F28`, `#279541`) plus neutrals — [../ux/information-architecture.md](../ux/information-architecture.md). Do not introduce a second status system (wrapper navy/orange). Remaining chrome tokens: Step 8.

Conflict on `layout.tsx` / tokens: coordinate with the team leader. Do not ship a module-specific theme.

---

## 3. Shared components and types

Before adding a component, search `components/ui`, `components/common`, and feature folders. Do not duplicate button, modal, table, form input, status badge, pagination, empty state, or error state.

Cross-module types have owners (platform: User, Role, Agency, Permission, envelope; ProjectTrace: ProjectStatus). Do not create slightly different copies per feature. Do not dump the entire app into one `types.ts`.

---

## 4. How to request a shared-file change

1. Mention it in the daily/check-in note before coding if the change is large.
2. Smallest possible diff.
3. Team leader reviews the PR (required).
4. Update docs if the public contract changes.
