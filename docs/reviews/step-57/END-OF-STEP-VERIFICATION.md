# Step 57 end-of-step verification

Same-agent record only. This is not independent human signoff and it is not production readiness.

Implementation record: [IMPLEMENTATION-STATUS.md](./IMPLEMENTATION-STATUS.md). Reject and return screenshots are `g1-*.png` and `g2-*.png` in [evidence/](./evidence/). The reopen chain is `reopen-*.png`. Older `01`–`08` and `review-*` images are from the earlier begin/approve demo and the review that blocked on G1/G2.

Project ids below existed only in one disposable Mongo process. The next seed will differ.

## Verdict

**Feature recommendation: APPROVE.**

Reject, return for correction, stored reasons, scope, and separation of duties remain in place. `REJECTED` → `DRAFT` is now the existing `REOPEN` lifecycle transition for an in-scope editor who already has `project.update`. The disposable browser walked Submit → Reject with a stored reason → Return to draft → Edit → Resubmit → Begin review. The original rejection reason stayed on the review record.

This does not approve Atlas, invitation email, Step 51 races, null-agency Super Admin, or native Sinhala/Tamil copy. It is not independent human signoff.

## What passed

| Check | Result |
| --- | --- |
| `BEGIN_REVIEW` `SUBMITTED` → `UNDER_REVIEW` | PASS. Reason forbidden. |
| `APPROVE` `UNDER_REVIEW` → `APPROVED` | PASS. Different in-scope Gov Admin. Does not start the project. |
| `REJECT` to `REJECTED` with a stored reason | PASS. Browser and API. |
| `RETURN_FOR_CHANGES` `UNDER_REVIEW` → `DRAFT` with a stored reason | PASS. Officer can open the existing draft editor afterward. |
| Submitter cannot reject, return, or approve | PASS. API 409. Browser: `step57-sod@example.com` on `INF-ROAD-5791` had no decision buttons. |
| Missing reason and a `$` reason | PASS. API 400. Browser kept the `$` reason in the dialog and did not record a decision. |
| Stale revision / one audit | PASS in `projects-review.test.ts` (second decision 409). Browser two-tab 409 with a typed reason was **NOT RUN** in this pass. The earlier begin-review 409 screenshot is not this dialog. |
| Review history | PASS after a fix. The first browser reject stored the reason, but the history list dropped the snapshot. The read now selects `+newValue`. Reload showed the reason. |
| Foreign review and unauthorized roles | PASS in the API suite (404 / 403). Not repeated in the browser this pass. |
| `REJECTED` → `DRAFT` (`REOPEN`) | PASS. In-scope Agency Officer. API also covers stale revision 409, foreign Gov Admin 404, citizen 403, and a Project Manager with no `managerId` (404). Browser two-tab 409 while reopening was **NOT RUN**. |
| Step 56 `START` / `MARK_DELAYED` 403 and `COMPLETE` / `CANCEL` 409 | PASS in the existing lifecycle tests. Not re-clicked in the browser. |

## Gates

| Command | When | Exit | Result |
| --- | --- | --- | --- |
| `npm run test:web` with `apps/web/.env.local` login flag | 2026-10-27T16:59:55Z | 1 | 169 passed, 1 failed: `auth.test.ts` expected `NOT_LIVE`, received `NETWORK` |
| `npm run test:web` with `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=0` | 2026-10-27T17:05:15Z | 0 | 38 files, 170 tests. The failing test is the live-login environment, not a G1/G2 assertion. Auth code was not changed. |
| `npm run test:api` | 2026-10-27T17:29:07Z, after the history-read fix | 0 | 31 files, 305 tests. An earlier run the same evening, before that fix, was also 305 and exit 0. |
| `npm run test -w @infraos/api -- tests/projects-review.test.ts` | 2026-10-27T17:15:53Z | 0 | 5 tests, including stored reason, history, and return |
| `npm run type-check` | 2026-10-27T17:26:10Z, after the history-read fix | 0 | Web and API |
| `npm run lint` | 2026-10-27T17:01:04Z | 1 | API `no-control-regex` on the first reason pattern |
| `npm run lint -w @infraos/api` | 2026-10-27T17:27:41Z, after the validator and the history-read fix | 0 | |
| Web lint in the full lint | 2026-10-27T17:01:04Z | 0 errors | 2 existing warnings: `useReactTable` in `data-table.tsx`, `form.watch` in `project-create-form.tsx` |
| `npm run build` | 2026-10-27T17:06:54Z | 0 | Web and API, before the history-read fix. Middleware deprecation warning only. |
| `npm run build -w @infraos/api` | 2026-10-27T17:29:35Z, after the history-read fix | 0 | The web app was not changed by that fix. |
| `npm run test:web` with `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=0` | 2026-10-27T18:38:04Z, after `REOPEN` | 0 | 38 files, 170 tests |
| `npm run type-check` | 2026-10-27T18:38:29Z, after `REOPEN` | 0 | Web and API |
| `npm run lint` | 2026-10-27T18:39:09Z, after `REOPEN` | 0 | 0 errors. Same 2 existing web warnings |
| `npm run test:api` | 2026-10-27T18:40:28Z, after `REOPEN` | 0 | 31 files, 306 tests |
| `npm run build` | After the reopen browser walk | 0 | Web and API. Middleware deprecation warning only. |

## Browser

Disposable API `http://localhost:4011`. Web `http://localhost:3001` (webpack, `INFRAOS_NEXT_DIST_DIR=.next-step57`). The login bundle contained `localhost:4011` only. Use `localhost`, not `127.0.0.1`.

Accounts, no password in this report. The fixture password is `DEMO_PASSWORD` in `apps/api/src/scripts/step57-isolated-dev.ts`.

| Actor | What was shown |
| --- | --- |
| `step57-gov@example.com` | Queue at `/projects/reviews` (Submitted 12, Under review 1). Rejected `INF-ROAD-5711` at `/projects/6ae0dc6c33b26f5e522dc307/review`. POST review **200**. Reload still showed `REJECTED` and the reason. Began review on `INF-ROAD-5790`, then returned it to draft. POST **200**. History showed `DRAFT` with the reason and the earlier `UNDER_REVIEW`. |
| `step57-officer@example.com` | `/projects/6ae0dc6c33b26f5e522dc307/overview` showed the rejected note and the reason, and no Edit draft link. `/projects/6ae0dc6c33b26f5e522dc30b/edit` opened the draft form for the returned project. |
| `step57-sod@example.com` | `/projects/6ae0dc6c33b26f5e522dc30f/review` (`INF-ROAD-5791`, under review, this account is the trusted submitter). No begin, approve, reject, or return button. |

A `$` reason on the reject dialog produced “Enter a specific reason the server can store.” The recorded-decisions line stayed empty until a valid reason was confirmed.

Screenshots:

- `evidence/g1-invalid-reason.png`
- `evidence/g1-rejected-history.png`
- `evidence/g1-officer-rejected-overview.png`
- `evidence/g1-sod-no-decision-buttons.png`
- `evidence/g2-return-history.png`
- `evidence/g2-officer-edit-fields.png`

## Reopen walk

A new disposable process for this revision. Project `INF-ROAD-5700`, id `6ae0ef972f4918a6455a8b65`. Use `http://localhost:3001`, not `127.0.0.1`. The browser did not try to have the resubmitting officer approve that submission. The API test does: after reopen and resubmit, changing that officer to Gov Admin still returns 409 on approve and leaves the project `UNDER_REVIEW`.

| Step | Actor | Result |
| --- | --- | --- |
| Submit | `step57-officer@example.com` | Overview `POST .../transition` **200**. Status `SUBMITTED`. |
| Reject | `step57-gov@example.com` | Review `POST .../review` **200**. Status `REJECTED`. Reason: “The drain crossing is not shown.” |
| Reopen | officer | `POST .../transition` **200**. Button “Return to draft”, then “Saving status.”, then “Status updated.” Status `DRAFT`. Reason still shown. |
| Edit | officer | `PATCH .../projects/:id` **200**. Title became “Live submission road — drain crossing added”. |
| Resubmit | officer | `POST .../transition` **200**. Status `SUBMITTED`. |
| Begin review | gov | `POST .../review` **200**. Status `UNDER_REVIEW`. History still lists the rejection reason. |

No tokens or passwords are in this report. The API log lines above are status codes only.

Screenshots: `evidence/reopen-01-submitted.png`, `reopen-02-rejected-status.png`, `reopen-02-rejected-reason.png`, `reopen-04-draft.png`, `reopen-04-draft-reason.png`, `reopen-06-saved.png`, `reopen-07-resubmitted.png`, `reopen-08-under-review.png`, `reopen-08-history.png`.

To repeat it, stop nothing on ports 3000, 4000, or 4010. From `apps/api`, set `PORT=4011` and `FRONTEND_ORIGIN=http://localhost:3001`, then run `npx tsx src/scripts/step57-isolated-dev.ts`. From `apps/web`, set `NEXT_PUBLIC_API_BASE_URL=http://localhost:4011`, `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=1`, and `INFRAOS_NEXT_DIST_DIR=.next-step57`, then run `npx next dev --webpack -p 3001`. Sign in as the officer and gov accounts printed by the seed. The fixture password is `DEMO_PASSWORD` in that script. The printed project id changes every seed. Do not change `apps/web/.env.local`.

After this walk, listeners on 3001 and 4011 were stopped. Listeners remained on 3000, 4000, and 4010. `apps/web/.env.local` was not edited and still points at `http://localhost:4000`. Next had added `.next-step57` type includes to `apps/web/tsconfig.json`; that file was restored with `git checkout -- apps/web/tsconfig.json` only. `apps/web/.next-step57` was deleted.

Dev-only Next overlay: one hydration issue from `src/app/layout.tsx`. Treated as dev chrome, not a Step 57 product defect.

## Still unresolved, and not part of this change

- Production Atlas schemas and indexes were not modified and were not verified.
- Invitation email delivery is not solved.
- Step 51 race coverage was not changed.
- Null-agency Super Admin remains out of scope.
- Sinhala and Tamil review copy is still a draft. Native acceptance was not claimed.
- Public landing routes and the public focus token were not changed.

## Git

No branch, stage, commit, push, pull request, or merge.

Suggested later, each only after its own approval:

```text
git switch -c feature/projecttrace-approval-workflow
git add -- <explicit Step 57 paths>
git commit -m "feat(projecttrace): add scoped project approval workflow"
git push -u origin feature/projecttrace-approval-workflow
```

A pull request into `development`, a merge, and a `development` to `main` release each need a separate approval.

## Step 58

Not started. A later milestone step can rely on a real `APPROVED` project, its revision, and the audit actions already written. Reopening a rejected project is an editor transition back to `DRAFT`. It does not approve the project and it does not start Step 58.
