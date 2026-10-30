# Step 65 — ProjectTrace Notifications & Audit Integration

Same-agent status for the limited Step 65 implementation on `feature/projecttrace-dashboard-notifications` at parent `2caa7062818719fa29ded9e4e8cd468250bf949a`. No commit, push, pull request, merge, or deploy. Production readiness remains BLOCKED. Native Sinhala and Tamil review: NOT RUN.

## Event policy

A notice is inserted only after the audit row is created, inside the same Mongo transaction as the project or milestone write. A thrown notice error rolls the business action back. Aborted transitions and read-only GETs create no notice. The actor is skipped. There is no organization-wide broadcast, contractor mapping, or citizen notice.

| Committed action | Recipient |
| --- | --- |
| `project.submitted` | Live in-scope `GOV_ADMIN` with `project.approve`, project agency or an active ancestor (depth 8; a cycle yields none). Cap 50; above that the transaction rolls back. |
| `project.review_started`, `project.approved`, `project.rejected`, `project.returned`, `project.status_changed`, `project.reopened` | Assigned project manager only when still active, email-verified, same agency, role `PROJECT_MANAGER`, and still granted `project.read`, and not the actor. |
| `milestone.created`, `milestone.updated`, `milestone.status_changed` | Same assigned project manager rule. The stored resource is the project, not the milestone id. |
| `project.created`, `project.updated`, progress, dependencies | No notice. |

Stored `title` and `message` are the action code. The response exposes `titleKey`. `project` is attached only when the recipient can still read that project. `eventKey` and `sourceAuditId` are not returned. Audit `oldValue`, `newValue`, reasons, budgets, emails, IPs, and user agents are not copied into the notice.

## Transaction and dedupe

`eventKey` is `${auditId}:${userId}` with a sparse unique index declared on the model. A duplicate key inside the transaction throws and rolls back. Outside a transaction, a duplicate is a no-op. Disposable tests call `Notification.syncIndexes()`. The live Atlas index was not created. Operational dedupe on Atlas is BLOCKED until an owner approves that index. A pre-insert lookup is not treated as race-safe. There is no background replay worker. Replaying the same audit id is safe only where the unique index exists.

## API

`notificationRouter` is mounted at `/api/v1/notifications`. `GET /unread-count` is registered before `/:id`. List query is `state=all|read|unread`, `limit` 1–50, optional cursor. Mark read and unread require `notification.update`, filter by the signed-in user, and repeat safely. Another user's id is 404. No new permission was added. Responses use the existing envelope and `Cache-Control: no-store`.

## S65 items

| Item | Status |
| --- | --- |
| S65-01 genuine committed events | Pass. Submit creates one reviewer notice. The submitting manager's feed stays empty. |
| S65-02 unread ownership and count | Pass. Count is the recipient's own unread count. |
| S65-03 read and unread | Pass. Repeated mark is idempotent. Shell count updates with the list. |
| S65-04 no cross-scope leak | Pass. Foreign agency feed is empty and does not include the project title. A moved manager loses the title at read time in the API test. |
| S65-05 no phantom or duplicate | Pass in disposable Mongo. Atlas unique index not applied, so production dedupe is BLOCKED pending owner approval. |
| S65-06 Step 63 and audit | Pass. Activity still shows the submitted audit. GET does not append or edit audit rows. |
| S65-07 accessible multilingual responsive draft | Pass for the draft UI. EN/SI/TA chrome is present. Native review NOT RUN. |
| S65-08 no unauthorized services or indexes | Pass. No socket, SMTP, or live Atlas index. |
| S65-09 browser proof | Pass for the isolated demo below. |

## Tests

Commands and observed results. The full API suite was not run.

- `npm test -- tests/projects-notifications.test.ts tests/dashboard-policy.test.ts tests/projects-dashboard.test.ts tests/projects-activity.test.ts` in `apps/api`: 4 files, 10 tests passed.
- `npm test -- tests/projects-notifications.test.ts` after the agency lookup change: 1 file, 2 tests passed.
- `npm test -- src/lib/projects/notice-view.test.ts src/lib/projects/dashboard-view.test.ts` in `apps/web`: 2 files, 6 tests passed, exit 0.
- `npm test -- src/lib/projects/notice-view.test.ts` after message updates: 1 file, 2 tests passed, exit 0.
- `npm run type-check` in `apps/api`: exit 0 after the ancestor lookup was annotated.
- `npm run type-check` in `apps/web`: exit 0. Next typegen rewrote `apps/web/tsconfig.json`; that rewrite was restored with `git checkout -- apps/web/tsconfig.json`.

## Browser demonstration

Isolated disposable Mongo only. API `http://localhost:4020`. Web `http://localhost:3020`. Ports 3000 and 4010 were left running. `.env.local` was not changed. Atlas was not used.

Walkthrough on the final disposable database, project `INF-NOTE-6501` (`6ae4320990053e6d6187a24a`):

1. Authorized project manager `step65-manager@example.com` submitted the draft. HTTP 200, `Cache-Control: no-store`, status `SUBMITTED`. That actor's notice list stayed empty.
2. Reviewer `step65-reviewer@example.com` opened `http://localhost:3020/notifications`. One unread row, title "Project submitted for review", project code visible, nav count 1.
3. Mark read set the page and nav count to 0. The Unread filter then showed "No notices in this filter."
4. Dashboard at `http://localhost:3020/dashboard` stayed at 1 project in scope and 1 pending review.
5. Activity at `http://localhost:3020/projects/6ae4320990053e6d6187a24a/activity` showed "Project submitted" from the audit record.
6. Sign-out returned to the public home without leaving the notice list on screen. Foreign officer `step65-foreign@example.com` then saw an empty feed and unread 0, with no project title.
7. Document scroll width equalled client width at 320, 768, 1440, and 1920.

Screenshots in `docs/reviews/step-65/evidence/`: `notices-1440.png`, `notices-read-filter.png`, `notices-unread-empty-1440.png`, `notices-1920.png`, `notices-768.png`, `notices-320.png`, `notices-si-1440.png`, `dashboard-1440.png`, `activity-1440.png`, `notices-foreign-1440.png`. Earlier HTTP bodies are in `http-before-browser.json`.

A Next.js dev hydration overlay on `login-page-shell.tsx` appeared after a full navigation. It is the existing login shell, not a notice record. Staff-shell link clicks from the browser tool did not always start client navigation; DOM activation did, and the session stayed in memory.

## Git

G1 reused `feature/projecttrace-dashboard-notifications`. No second branch. G2–G6 were not authorized and were not run. Unrelated dirty files left untouched: `docs/operations/production-readiness-gates.md`, step 53/54/58 review docs, and untracked `Prompts/`.

## Recommendation

APPROVE for this limited Step 65 implementation only. Hand off to Prompt C for the phase-wide regression. Do not treat this as owner acceptance, production readiness, or permission to stage, commit, push, or merge. Apply the `eventKey` unique index to Atlas only after a separate owner approval.
