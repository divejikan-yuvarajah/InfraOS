# Step 41 / 42 — pre-implementation audit (prerequisite review)

**Role:** Principal Engineer / Security Auditor / Git Integrator / Independent QA (read-only pass)  
**When:** 2026-10-24 22:45 +05:30  
**Workspace:** `C:\Users\ASUS\Desktop\InfraOS\InfraOS` only (single registered worktree)  
**Fetch / pull:** not performed (no explicit permission this session)  
**Git writes:** none (documentation only)

---

## 1. Repository evidence

| Item | Value |
|------|--------|
| **HEAD / branch** | `main` @ `e60c6a3eadc691fae7f0da30577b27c0744d13fa` |
| **Tracking** | `main...origin/main` (aligned; no behind/ahead in local snapshot) |
| **Local `development`** | `4e97f425e5aae39fd84a34b70f5aa83cf2704b20` — matches recorded `origin/development` tip without fetch |
| **Remote** | `origin` → `https://github.com/divejikan-yuvarajah/InfraOS.git` |
| **Worktrees** | One: `C:/Users/ASUS/Desktop/InfraOS/InfraOS` on `refs/heads/main` |
| **Working tree** | Clean tracked files; **untracked:** `Prompts/INFRAOS_Steps_41_42_Enhanced_Development_Prompt.md` |
| **`git diff --check`** | No conflicts / whitespace errors on tracked diff |
| **Step 40 implementation commit** | `a71d3d6` `feat(auth): Step 40 logout and refresh family lifecycle` — **ancestor of `HEAD`** |
| **Recent history (15)** | PR #73 merge to `main`; PR #72 `feature/auth-session-lifecycle`; Step 40 feat + docs commits |

**Stashes (informational, not Step 40 evidence):**

- `stash@{0}` — archived dirty Step 39 worktree rollback (2026-10-24)
- `stash@{1}` — `temp-review` on `main`

**Do not infer owner approval from merge commits or feature branch existence.**

---

## 2. Step 40 — disposition for Steps 41–42 gate (G0)

**Verdict: BLOCKED** (not owner-approved for closure; not REVISE-only)

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Code merged on `main` | **PASS** | `POST /logout` in `apps/api/src/modules/identity/auth/auth.routes.ts`; `RefreshFamily` model; `logoutRefreshFamily` in `refresh-session.service.ts`; `apps/api/tests/auth-logout.test.ts`; web `logoutWithAuthClient` / `beginLogoutEpoch` in `apps/web/src/lib/auth/` |
| Isolated API logout + race tests | **PASS** | Re-run 2026-10-24 22:43 +05:30: **10/10** in `auth-logout.test.ts` at `e60c6a3` |
| Recorded full API / web suites (committed docs) | **PASS** (documented) | `docs/reviews/step-40/END-OF-STEP-VERIFICATION.md`: 238 API, 110 web at implementation time |
| **Owner explicit “Step 40 APPROVED”** | **FAIL** | No committed owner sign-off. `INDEPENDENT-POST-IMPLEMENTATION-REVIEW.md` disposition: **BLOCKED** until index proposal + browser pass. `END-OF-STEP-VERIFICATION.md` still describes uncommitted worktree state and **NOT RUN** browser/Atlas items |
| Atlas `refresh_families` indexes | **NOT RUN** (live) | `INDEX-MIGRATION-PROPOSAL.md`: apply only after owner approval. Model declares indexes; `autoIndex` is **on in non-production** if `dev:api` starts — **do not** start API against Atlas before approval |
| Read-only index check this session | **BLOCKED** | `npm run db:indexes:check` uses `autoIndex: false` but **connection failed** (SRV/TLS/IP whitelist). No live confirmation of family indexes on `infraos_dev` |
| Browser logout on localhost | **NOT RUN** | Recorded in Step 40 verification and independent review; no new browser evidence this session |
| Logout UI in product | **NOT RUN / N/A** | By design: client helper only; public landing unchanged |
| Pre-Step-40 sessions without family doc | **PASS** (documented behavior) | Logout returns **503**, cookie not cleared — handoff + index proposal |
| Access JWT after logout | **PASS** (honest limitation) | Still valid until expiry; Step 44 not implemented |

**Exact blockers before Step 41 implementation:**

1. **Owner acceptance** of Step 40 (explicit APPROVE / REVISE / BLOCKED response), separate from Git merge.
2. **Atlas `refresh_families` index migration** approved and applied (or documented owner exception with risk acceptance).
3. **Live browser logout** demonstration (or owner-approved waiver with written risk).
4. **Optional but recommended:** successful read-only `db:indexes:check` including `RefreshFamily` once Atlas is reachable from this machine.

**Concurrent refresh vs logout:** covered in isolated tests (barriers A/B, hash swap, concurrent logout) — **PASS** in test DB, not re-proven on Atlas this session.

---

## 3. Roadmap — Steps 41 and 42 (in-repo authority)

The original **190-step `Steps.docx`** was **not** found in the authorized project tree. The closest canonical table is:

`Prompts/INFRAOS_Cursor_Grok_Composer_Model_Plan_Steps_15_to_50.md`:

| Step | Name (exact in repo) |
|------|----------------------|
| **40** | Logout & session revocation |
| **41** | Forgot-password request flow |
| **42** | Password reset & one-time token workflow |

Aligned handoffs:

- `docs/reviews/step-40/STEP-41-HANDOFF.md` — Step 41 = password reset **request**; not started.
- `Prompts/INFRAOS_Steps_41_42_Enhanced_Development_Prompt.md` — Step 42 = token consumption, bcrypt cost 12, **all refresh families** for user invalidated via Step 40 barriers.

**Scope change:** none proposed. If `Steps.docx` appears later with different wording, stop for owner review.

**Dependencies:** Step 39 login/refresh; Step 37 email verification patterns; Step 40 family close + web epoch; Step 44 (access JWT on protected routes) **not** in scope for 41–42.

---

## 4. Single-folder branch recommendation

| Action | Recommendation |
|--------|----------------|
| Workspace | Stay in `C:\Users\ASUS\Desktop\InfraOS\InfraOS` only |
| Base branch | `development` @ `4e97f42…` (after explicit `git pull` when permitted) |
| Feature branch | One feature-based branch, e.g. `feature/auth-password-recovery`, branched from updated `development` — **do not create until G0 cleared and owner approves starting Step 41** |
| Avoid | New worktrees, per-step folders, reusing stale `feature/step-39-jwt-rotating-refresh` tip |

No branch created in this audit.

---

## 5. Environment and provider prerequisites (Step 41–42)

From `docs/setup/environment.md` and existing auth (no new secrets invented):

| Prerequisite | Step 41 | Step 42 | Notes |
|--------------|---------|---------|--------|
| `MONGODB_URI`, `MONGODB_DB_NAME=infraos_dev` | Required for live dev tests | Required | Config present locally; **Atlas unreachable** this session |
| `ACCESS_TOKEN_*`, `REFRESH_TOKEN_*` | Regression | Regression + family invalidation | Already required for auth |
| `FRONTEND_ORIGIN`, CORS | Origin checks on new routes | Same | Match Step 39/40 pattern |
| Email / SMTP catalog | **Not in locked env catalog** | Delivery of reset link | Step 37 verification uses an internal sender abstraction — **owner must choose provider** before G1 (Step 41 prompt G1) |
| `NEXT_PUBLIC_AUTH_LOGIN_ENABLED` | Request UI likely preview-only | Reset UI | Do not auto-enable production sign-in |
| Atlas index writes | New challenge collection indexes (41) + any reset-token indexes (42) | **Separate approval** | Do not run `syncIndexes` / `dev:api` against Atlas unapproved |

---

## 6. Unchanged-source boundary (mandatory)

Do **not** modify during Step 41–42 unless a step explicitly requires it:

- Connected Future **public landing** routes, layout, theme, and marketing components
- `Documents` (any path under owner `Documents` tree — out of repo scope; never touch)
- Step 44 middleware, RBAC (45–46), global JWT denylist
- `.env` committed secrets or production database names

Step 41–42 **may** touch: identity auth modules, new models/tests, non-landing auth UI (forgot/reset), review docs under `docs/reviews/step-41/` / `step-42/`.

---

## 7. Acceptance matrix (preflight)

| Item | Result |
|------|--------|
| Single worktree `InfraOS` | **PASS** |
| Step 40 source on `main` | **PASS** |
| Step 40 owner approval on record | **BLOCKED** |
| Step 40 Atlas family indexes verified | **NOT RUN** (connection failed) |
| Step 40 browser logout | **NOT RUN** |
| Logout/refresh race (isolated tests) | **PASS** (current HEAD) |
| Step 41/42 code present | **FAIL** (none — expected) |
| Step 39 owner gate (historical) | **PASS** — `END-OF-STEP-VERIFICATION.md` final gate **APPROVE** Step 39; Step 40 may begin (prerequisite only, not Step 40 closure) |
| Roadmap 41/42 names located | **PASS** (in-repo plan table; not Steps.docx) |
| `infraos_dev` configured | **PASS** (names only; no secret values recorded) |
| Production DB use | **PASS** (not used) |
| Fetch/pull this session | **NOT RUN** (by policy) |
| Commit / push / PR | **NOT RUN** (by policy) |

---

## 8. Step 41 / 42 — recommended next actions (after G0)

1. Owner states **Step 40: APPROVE**, **REVISE**, or **BLOCKED** with any waivers for browser/Atlas.
2. If APPROVE (or waivers documented): approve `INDEX-MIGRATION-PROPOSAL.md`, apply indexes on `infraos_dev`, re-run read-only `db:indexes:check`.
3. Run manual browser logout per `docs/reviews/step-40/DEMO-AND-MANUAL-TEST-GUIDE.md`.
4. Owner approves Step 41 G1 (email provider, challenge model/index design).
5. Create `feature/auth-password-recovery` from `development` in **InfraOS only**; implement Step 41; **stop before Step 42** until Step 41 owner approval (G3).

**STOP:** Step 41 code must not start until Step 40 owner acceptance (G0) is explicit.

---

## 9. Owner request (required)

Please reply with one of:

- **Step 40 APPROVED** — (optional: waivers for browser logout and/or Atlas indexes), then permission to begin Step 41 planning/implementation; or  
- **Step 40 REVISE** — list required fixes; or  
- **Step 40 BLOCKED** — remain on documentation and G0 remediation only.

No Step 41 implementation, branch creation, commit, push, PR, merge, or Atlas mutation has been performed.
