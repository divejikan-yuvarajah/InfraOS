# Step 63 end-of-phase verification

Date: 2026-10-30 (local). Reviewer: same agent that implemented Step 63. This is not an independent owner sign-off.

## Executive verdict

| Item | Result |
| --- | --- |
| Step 63 — Project Activity History | **APPROVE** for privacy-safe, scoped activity history |
| Production readiness | **BLOCKED** |
| G1–G6 | **NOT RUN** |

Same-agent **APPROVE** does not authorize staging, commit, push, merge, or deployment. G6 would need a separate approval after any later G1–G5.

## Requirements

`FR-PROJECT-015` asks for chronological activity so an authorized user can reconstruct significant recorded events. The Step 61 timeline is a different page and was not reused as activity history.

Chosen behavior:

- Audience is the existing timeline audience: live `project.read` and `project.timeline.read`.
- Only persisted allowlisted actions are shown. Unknown actions are dropped.
- Private fields and actor identity stay off the response.
- Empty, partial, and unavailable states are distinct. A reported 100 percent does not complete the project.

## Acceptance

| ID | Result | Evidence |
| --- | --- | --- |
| S63-01 authorized recorded events | PASS | API test and browser list: created, update, progress, milestone, link, remove |
| S63-02 persisted evidence only | PASS | Unknown action omitted; progress note not returned; report deduped against the audit |
| S63-03 stable pagination and filters | PASS | API cursor page does not repeat an id; browser Load more and category buttons |
| S63-04 RBAC and no private fields | PASS | 401, 403, 404 without title; no email, note, reason, budget, IP, or user agent |
| S63-05 no fabricated claims | PASS | 100 percent stays ACTIVE; dependency copy says informational; payments omitted |
| S63-06 empty, partial, unavailable, unknown | PASS | Unknown omitted; partial coverage flag when a source exceeds 200; unavailable maps to 503 |
| S63-07 responsive draft copy | PASS with limitation | Widths 320–1920 had no page overflow. SI/TA chrome is draft. Native review **NOT RUN** |
| S63-08 regressions 57–62 | PASS | Full API 337/337 and web 182/182 include those suites |
| S63-09 focused tests | PASS | `activity-policy`, `projects-activity`, `activity-view` |
| S63-10 real browser | PASS | Isolated `http://localhost:3007` against `http://localhost:4017`. Screenshots in `evidence/` |

## Gates

| Command | Result |
| --- | --- |
| `npm run test:api` | 40 files, 337 tests, exit 0 |
| `npm run test:web` | First: 181 pass / 1 fail (`preview transport` expected `NOT_LIVE`, received `NETWORK`) because the shell still had `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=1` from the demo. Rerun after removing that env: 44 files, 182 tests, exit 0. Product code was not changed for this. |
| `npm run type-check` | First web failure: `activityQueryKey` returned a string. Changed to a query-key array. Rerun exit 0 for web and API. |
| `npm run lint` | Exit 0. Existing warnings only: `data-table.tsx` `useReactTable`, `project-create-form.tsx` `form.watch`. |
| `npm run build` | Exit 0 |
| `git diff --check` | Exit 0 |

## Security notes

- The route uses the same live grant checks as timeline reads. Pulling `project.timeline.read` returns 403. A credential epoch change returns 401. A thrown read hook returns 503.
- Milestone audits are joined only when the milestone belongs to the requested project.
- Dependency titles use one scoped project query. A hidden target has no title.
- GET does not insert or update audit or project records. The API test checks the audit count and that the project stays ACTIVE at 100.
- Demo secrets stay in the excluded `step63-isolated-dev.ts` script. The fixture password is not printed.

## Git observation

Branch `feature/projecttrace-activity-history` was created from `origin/development` at `c0ff470`. Step 63 is uncommitted. Unrelated dirty production-readiness and earlier review documents, plus untracked `Prompts/`, were left unstaged. Ports 3000 and 4010 were not stopped.

## Still blocked

Contractor user-to-contractor linkage, Step 51 grant races, Atlas index migration, email delivery, null-agency Super Admin, staging cookies, backups, monitoring, and cross-agency dependency policy. Stored PAID is not bank settlement. Native Sinhala and Tamil review is **NOT RUN**.
