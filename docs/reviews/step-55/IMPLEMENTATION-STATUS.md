# Step 55 — Edit Project & Validation

**SAME-AGENT IMPLEMENTATION / QA — NOT INDEPENDENT HUMAN SIGNOFF.**

Sri Lankan university GovTech demonstration. Not an official live government service.

## Roadmap scope

**Step 55 — Edit Project & Validation** (from `Prompts/Steps.docx` and local `Prompts/INFRAOS_Steps_55_56_Enhanced_Development_Prompt.md`).

Step 56/57 were not started.

## Pre-implementation baseline (26 Oct 2026)

| Item | Value |
|---|---|
| Branch | `development` @ `35edec5` (matches `origin/development`) |
| Dirty before Step 55 | Step 53–54 review docs + API 401 assertions (preserved) |
| Backend PATCH | Already existed (`updateProjectDraft`, `projectPatchSchema`) |
| Frontend | No `/projects/[id]/edit` route; overview had no Edit control |
| Blockers carried forward | Atlas `/ready` on default `dev:api`; production preview auth; native SI/TA review |

## Step 54 visibility root cause (unchanged)

Production `next start` sets `NODE_ENV=production`, so `getAuthAvailability()` returns **preview** and private pages show the sign-in gate only. That is intentional. Dev with `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=1` shows the real login form. Default `apps/api/.env` targets Atlas; `/ready` is **503** until the API uses disposable/local Mongo. Step 55 browser demo therefore requires the isolated harness (below), not Atlas.

## What was implemented

### Backend

- **`canEditDraft`** on `ProjectDetailDto`: scope-checked, live `project.update`, active agency, DRAFT status, and `projectWriteFilter` (PM assignment). PATCH remains authoritative.
- No schema widening; existing `PATCH /api/v1/projects/:id` unchanged except detail DTO flag.

### Frontend

- **`/projects/[id]/edit`**: private, `noindex`, staff shell, breadcrumbs, RHF + Zod, discard confirmation, single-flight PATCH (`retry: false`), 409 conflict messaging with reload, cache update via `projectCoreQueryKey` + list invalidation.
- **Overview**: **Edit draft** link only when `canEditDraft` is true; preserves `list` return query.
- **Edit semantics**: prefill from GET detail; diff-based PATCH body; **LineString/Polygon preserved** unless explicit remove; Point editor only for Point/none; server-owned fields read-only in UI.

### Local demo harness (not production)

- `apps/api/src/scripts/step55-isolated-dev.ts` — disposable MongoMemoryReplSet, seeded roles/agency/officer, one DRAFT project, listens on **`PORT` env (use `4010`)**. Does not connect to Atlas.

## Changed / new files (Step 55)

**API:** `projects.service.ts`, `projects.types.ts`, `projects-foundation.test.ts`, `step55-isolated-dev.ts`

**Web:** `app/projects/[id]/edit/page.tsx`, `project-edit-form.tsx`, `project-edit-page-client.tsx`, `edit-transform.ts`, `edit-schema.ts`, `edit-outcome.ts`, `edit-transform.test.ts`, `api.ts`, `api.test.ts`, `project-overview-client.tsx`, `messages.ts`, `types.ts`, `create-transform.ts` (exports shared field helpers)

## Focused verification (this session)

| Command | Exit | Result |
|---|---|---|
| `npm run test -w @infraos/web -- src/lib/projects/edit-transform.test.ts …` (5 project files) | 0 | 24 tests passed |
| `npm run test -w @infraos/api -- tests/projects-foundation.test.ts` | 0 | 7 tests passed (includes `canEditDraft`, LineString preservation PATCH) |
| `npm run type-check:web` | 0 | after form defaultValues fix |
| `eslint` on Step 55 web files | 0 | after invalid-handler tweak |
| `npm run lint:api` | 0 | 2 warnings in harness script only (none after logger change) |

Full monorepo `test:api` / `test:web` / `build` were **not** re-run in this Step 55 pass (per focused gate). Run before merge.

## Real browser demonstration

**Partial PASS** with isolated stack; not against Atlas.

| Step | Result |
|---|---|
| `$env:PORT='4010'; npx tsx apps/api/src/scripts/step55-isolated-dev.ts` | PASS — `/ready` 200 on port **4010** |
| Temporarily point `apps/web/.env.local` `NEXT_PUBLIC_API_BASE_URL` to `http://localhost:4010`, restart `npm run dev:web` (kill stale PID on 3000) | Required so client bundle calls isolated API |
| Sign in as synthetic `step55-officer@example.com` (password = same API test fixture as Vitest; not stored in repo) | PASS |
| `/projects/6adf36d8932b463c0c73b588/overview` | PASS — **Edit draft** visible, DRAFT content, budget gated |
| `/projects/…/edit` | PASS — prefilled form, read-only code/type context |
| Save through UI automation | **LIMITED** — programmatic fill did not always sync RHF state; manual typing expected. API PATCH verified separately: title → `Step 55 Browser Saved Title`, revision **1** |
| List at `/projects` during demo | Showed **0 rows** while detail worked (investigate before release; likely client/API base mismatch during first attempt) |

Browser evidence: Cursor browser snapshots on **26 Oct 2026** (~16:50 local). Screenshot files under `docs/reviews/step-55/evidence/` were requested from the browser tool but **did not land in the repo**; rely on session snapshots and re-run harness for owner screenshots.

**Mandatory acceptance note:** Default owner workflow (`dev:api` + Atlas, `dev:web` + port 4000) remains **BLOCKED** for signed-in demo until disposable Mongo or approved local DB is configured.

## Honest limitations

- Native Sinhala/Tamil: draft strings only.
- No Step 56 lifecycle controls.
- Step 51 lock races, invitation email, null-agency Super Admin: unchanged blockers.
- `.env.local` was pointed at **4010** only for demo, then restored to **4000**.

## Step 55 verdict

| Gate | Status |
|---|---|
| Implementation (code + focused tests) | **PASS** for Step 56 handoff |
| Mandatory browser (default Atlas dev:api) | **BLOCKED** |
| Browser (isolated harness + dev:web restart) | **PARTIAL PASS** |

## How to test locally (owner)

1. Terminal A: `Set-Location C:\Users\ASUS\Desktop\InfraOS\InfraOS\apps\api`; `$env:PORT='4010'; npx tsx src/scripts/step55-isolated-dev.ts` — wait for log `step55 isolated dev ready`.
2. Set `apps/web/.env.local` → `NEXT_PUBLIC_API_BASE_URL=http://localhost:4010`. Restart **`npm run dev:web`** from repo root (ensure port 3000 is not a stale server).
3. Open `http://localhost:3000/login`, sign in with the seeded officer email from the harness log and the API test password fixture.
4. Open overview URL from harness data or list; click **Edit draft**; change title; **Save changes**; confirm overview updates and revision increments.
5. Restore `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000` when finished.

## Git (proposals only — not executed)

Inspect dirty tree (includes prior Step 53–54 review files). Suggested branch: **`feature/projecttrace-edit-lifecycle`** from clean `development` when the owner approves checkout.

Stage **Step 55 paths only** (adjust if combining with review docs):

```text
git add -- apps/api/src/modules/projects/projects.service.ts apps/api/src/modules/projects/projects.types.ts apps/api/tests/projects-foundation.test.ts apps/api/src/scripts/step55-isolated-dev.ts apps/web/src/app/projects/[id]/edit/page.tsx apps/web/src/components/projects/project-edit-form.tsx apps/web/src/components/projects/project-edit-page-client.tsx apps/web/src/components/projects/project-overview-client.tsx apps/web/src/lib/projects/edit-transform.ts apps/web/src/lib/projects/edit-schema.ts apps/web/src/lib/projects/edit-outcome.ts apps/web/src/lib/projects/edit-transform.test.ts apps/web/src/lib/projects/api.ts apps/web/src/lib/projects/api.test.ts apps/web/src/lib/projects/create-transform.ts apps/web/src/lib/projects/messages.ts apps/web/src/lib/projects/types.ts docs/reviews/step-55/IMPLEMENTATION-STATUS.md
git diff --cached --check
git commit -m "feat(projecttrace): add secure draft project editing"
git push -u origin feature/projecttrace-edit-lifecycle
```

PR: `feature/projecttrace-edit-lifecycle` → `development` only with separate approval. Do not commit `.env.local`, `Prompts/`, or credential artifacts.

**STOP — Step 56 not started.**
