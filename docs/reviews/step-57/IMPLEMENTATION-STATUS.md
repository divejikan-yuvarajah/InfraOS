# Step 57 implementation status

Same-agent evidence is not human signoff. The verification record is `END-OF-STEP-VERIFICATION.md`.

## Owner decisions used for this change

The project owner approved both items in chat on 27 Oct 2026 for isolated development only. No separate policy file was added to the repo.

**G1 — `REJECTED`.** Added to the project status list in shared types, the API project constants, and the web list query. `REJECT` is a real review action from `SUBMITTED` or `UNDER_REVIEW`.

**G2 — decision reason.** The existing audit snapshot has an optional `reason` (max 500, no `$`, no control characters). It is written only for reject and return. No collection and no index were added. Atlas was not contacted.

`RETURN_FOR_CHANGES` moves `UNDER_REVIEW` to `DRAFT` and stores the reason. After that, the existing draft edit path is available to roles that can already edit drafts.

**`REJECTED` → `DRAFT`.** Requirements call this resubmission after correction. It is the existing lifecycle action `REOPEN` on `POST /api/v1/projects/:id/transition`. Permission is the existing `project.update` grant, not a new privilege. The write scope is the existing project write filter. Gov Admin and Agency Officer in the project's agency tree can reopen. A Project Manager can reopen only a project they already manage. Contractor, Inspector, Citizen, and Super Admin cannot. The original `project.rejected` audit, including its reason, is left unchanged. The reopen writes `project.reopened` with old status `REJECTED` and new status `DRAFT` and no new reason.

## Requirement coverage

| Edge | Result |
| --- | --- |
| `SUBMITTED` → `UNDER_REVIEW` (`BEGIN_REVIEW`) | Works. Reason forbidden. |
| `UNDER_REVIEW` → `APPROVED` (`APPROVE`) | Works. Reason forbidden. Does not start the project. |
| `SUBMITTED` or `UNDER_REVIEW` → `REJECTED` (`REJECT`) | Works. Reason required, stored on the audit snapshot and returned on the project when status is `REJECTED`. |
| `UNDER_REVIEW` → `DRAFT` (`RETURN_FOR_CHANGES`) | Works. Reason required. A later submit is a new trusted cycle. |
| Direct `SUBMITTED` → `APPROVED` | Refused. 409. |
| `REJECTED` → `DRAFT` (`REOPEN`) | Works for an in-scope editor with `project.update`. Stale revision is 409. Foreign agency is 404. Citizen is 403. The rejection reason stays on the audit record. |

`POST /api/v1/projects/:id/transition` was not widened. `START` and `MARK_DELAYED` still return 403. `COMPLETE` and `CANCEL` still return 409.

## Backend contract

- `GET /api/v1/projects/review-queue` — Gov Admin + live `project.approve` + ministry descendants. Queue statuses stay `SUBMITTED` and `UNDER_REVIEW`. Counts ignore search. `Cache-Control: no-store`.
- `GET /api/v1/projects/:id/review` — same gate and scope. 404 outside scope with no project body. Returns the project, the trusted submission, and `decisions` (last 20 of `project.review_started`, `project.approved`, `project.rejected`, `project.returned`, `project.reopened`). Each decision has action, status, reason or null, userId, timestamp, and request id.
- `POST /api/v1/projects/:id/review` — strict `{ action, revision, reason? }`. Reason is required for `REJECT` and `RETURN_FOR_CHANGES` and rejected otherwise. Non-JSON is 415.

The trusted submitter is the latest `project.submitted` audit (DRAFT → SUBMITTED) after the latest `project.returned` or `project.reopened` that landed on DRAFT. Zero or more than one such event fails closed with 409. Separation of duties applies to approve, reject, and return. Begin review stays allowed for the submitter. A failed audit write rolls the status change back and returns 503.

`reviewDecision` on the project detail is `{ status, reason, at }` for `REJECTED` (latest `project.rejected`). On `DRAFT`, a reopen newer than the latest return shows that same rejection reason. Otherwise a draft shows the latest return reason. Reviewer identity stays on the review history endpoint, not the overview DTO.

## UI

Authorized reviewers see Reject and Return for correction only when `availableReviewActions` includes them. The dialog requires the project code in the browser and a reason for reject and return. Newlines are collapsed before the reason is sent. A `$` reason is refused in the dialog and is not posted. Success closes the dialog and reloads from the server. A 409 leaves the dialog, the code, and the reason. History lists status, time, and reason. The overview shows the rejected note and the stored reason.

An in-scope editor sees **Return to draft** only when `availableActions` includes `REOPEN`. It uses the existing transition mutation. Pending copy is “Saving status.” Success is “Status updated.” A 409 says to reload. Any other failure says the status change is not available. After success the existing Edit draft link and Submit for review action are available, and the rejection reason stays on the overview.

English is the working copy. Sinhala and Tamil strings for the new labels are drafts. Native review is still pending.

## Focused checks after G1 and G2

| Command | Exit |
| --- | --- |
| `tests/projects-review.test.ts` and `tests/projects-lifecycle.test.ts` | 0 — reopen, resubmit, begin review, stale revision 409, foreign Gov Admin 404, citizen 403, project manager without `managerId` 404, and separation of duties after the officer is later given Gov Admin |
| Web `review.test.ts` and `list-query.test.ts` | 0 |

Full suite numbers are in the verification report.
