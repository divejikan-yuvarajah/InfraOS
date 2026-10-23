# Step 39 post-implementation review

`POST /api/v1/auth/login` and `POST /api/v1/auth/refresh` are mounted beside the existing email-verification routes. The web client can call them when live mode is enabled outside production. Access tokens stay in the module in `apps/web/src/lib/auth/state.ts`.

The public landing markup is unchanged. `AppProviders` starts one silent refresh on boot, and that call returns immediately unless live mode is on.

No commit or push was made from this worktree.
