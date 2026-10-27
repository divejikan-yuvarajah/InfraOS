# Step 56 — Project Lifecycle & Status Workflow

**SAME-AGENT IMPLEMENTATION — NOT INDEPENDENT HUMAN SIGNOFF.**

University GovTech demonstration. Not a live government service. Step 57 was not started.

## Baseline

Work stayed on dirty `development` @ `35edec5` (`origin/development`). `feature/projecttrace-edit-lifecycle` does not exist. No checkout, stash, or commit.

Statuses in code remain: `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `ACTIVE`, `ON_HOLD`, `DELAYED`, `COMPLETED`, `CANCELLED`. **`REJECTED` was not added.**

`Project.submittedBy` does not exist. Submitter identity is the audit row `action: "project.submitted"` (`userId`, old/new `status`, `requestId`). The locked audit snapshot has no reason field, so hold/resume reasons are validated and then not stored.

## Permission map

| Action | Result |
|---|---|
| SUBMIT `DRAFT → SUBMITTED` | **Implemented.** `project.submit`. AO own-agency or assigned PM via `projectWriteFilter`. Requires title, code, type, budget, planned dates, geometry, and a place. |
| HOLD / RESUME | **Implemented.** `project.hold`. Reason required (1–500, no `$` or control characters). |
| START, MARK_DELAYED | **Blocked 403.** No `project.start` / `project.delay`. `project.update` was not reused. |
| COMPLETE, CANCEL | **Blocked 409.** No inspection-verification adapter. Conflicts are not linked to projects, so cancellation cannot close them safely. Status is not changed. |
| Review / approve / reject | **Reserved for Step 57.** No endpoint. `SUBMITTED` and `UNDER_REVIEW` render as waiting, not as an approval screen. |

Physical progress 100% does not complete a project (`lifecycle.policy.ts`).

## API

`POST /api/v1/projects/:id/transition` with `{ action, revision, reason? }`. `Cache-Control: no-store`. Live permission inside the transaction. Compare-and-set on status and `__v`. Detail DTO adds `availableActions` and `submissionGaps` (hints only).

## UI

Overview lifecycle section: gaps, **Submit for review**, hold/resume with a reason prompt, cache update only when epoch and token still match. Edit stays behind `canEditDraft` (false after submit). EN copy plus SI/TA drafts via the existing dictionary spread. Native review still pending.

## Focused checks (26 Oct 2026)

| Command | Exit | Result |
|---|---|---|
| `npm run test -w @infraos/api -- tests/projects-lifecycle.test.ts tests/projects-foundation.test.ts` | 0 | 13 passed (5 policy + 8 foundation, including submit, forged body 400, 415, audit user, stale 409, other ministry 404, super admin 403, COMPLETE/CANCEL 409 with status left ACTIVE, START 403) |
| First foundation run | 1 | `submissionGaps` still listed `location` because a Mongoose subdocument was enumerated. Fixed in `submitGaps`. Rerun passed. |
| `npm run type-check:api` | 0 | After narrowing `availableActions` and excluding the isolated demo script from `tsconfig.json` (it imports the test Mongo helper). |
| `npm run type-check:web` | 0 | |

## Browser

**NOT RUN** for the new Submit control. The isolated API process from Step 55 does not include this route. Default `dev:api` still points at Atlas and must not be used. Step 55 browser acceptance stays partial, not a Step 56 pass.

## Step 57 handoff

- Add `REJECTED` only with an explicit policy decision.
- Approver must not be the audit `project.submitted` user (SOD-05). Do not trust a client `submittedBy`.
- Decide whether audit snapshots may store a reason.
- Completion and cancellation stay blocked until a real inspection rule and a project-linked conflict close exist.

**STOP. Step 57 was not implemented.**
