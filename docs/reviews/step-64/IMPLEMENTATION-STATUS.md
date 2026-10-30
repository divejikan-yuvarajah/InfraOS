# Step 64 implementation status

Branch: `feature/projecttrace-dashboard-notifications`  
Base: `origin/development` `2caa7062818719fa29ded9e4e8cd468250bf949a`  
Roadmap title: Step 64 — ProjectTrace Dashboard & KPIs. It matches `FR-PROJECT-013`, `FR-PROJECT-008`, and `FR-PROG-002` / `FR-PROG-003`.  
Same-agent result for this implementation: **APPROVE**. This is not owner acceptance, phase acceptance, or production readiness. Production remains **BLOCKED**. Step 65 was not started.

## Preserved

Dirty review documents and untracked `Prompts/` stayed unstaged. Ports 3000 (pid 18140) and 4010 (pid 42944) were still listening after the demo. Isolated listeners on 3019 and 4019 were stopped.

## Scope

Backend: `GET /api/v1/projects/dashboard` with `dashboard.policy.ts`, `dashboard.schema.ts`, and `dashboard.service.ts`.  
Frontend: authenticated `/dashboard` inside `StaffWorkspaceShell`, with KPI cards, a text status table, an SVG-free CSS bar, recent projects, milestone dates, conditional reviews and finance, and EN/SI/TA draft labels.  
Public `/`, `/si`, and `/ta` were not edited.

## Acceptance

| Check | Result | Evidence |
| --- | --- | --- |
| S64-01 authorized dashboard | PASS | Live `project.dashboard.read` and `project.read`; anonymous 401 |
| S64-02 accurate status counts | PASS | Officer total 4: active 1, on hold 1, delayed 1, submitted 1 |
| S64-03 scope isolation | PASS | Foreign officer total 1, only `INF-DASH-6499`; inspector assignment test |
| S64-04 conditional milestones, reviews, finance | PASS | Officer reviews `null`; reviewer pending 1; finance withheld after grant removal |
| S64-05 honest physical and financial status | PASS | `INF-DASH-6401` stays ACTIVE at 100%; stored PAID is provisional |
| S64-06 bounded read-only fail-closed API | PASS | Empty query only, no-store, 400/401/403/503, no project or audit writes |
| S64-07 responsive accessible draft | PASS | 320/768/1440/1920 had no horizontal overflow; EN/SI/TA draft marked pending native review |
| S64-08 browser proof | PASS | `http://localhost:3019/dashboard` against `http://localhost:4019` |

Native SI/TA review: **NOT RUN**.

## Focused commands

- `npm test -- tests/dashboard-policy.test.ts tests/projects-dashboard.test.ts` in `apps/api`: 7 passed, exit 0. An earlier run failed on a combined permission update and an invalid id; both were fixed and the rerun passed.
- `npm test -- src/lib/projects/dashboard-view.test.ts` in `apps/web`: 4 passed, exit 0.
- `npm run type-check` in `apps/api`: exit 0.
- `npm run type-check` in `apps/web`: exit 0 after the locale return type was widened, and again after the heading locale was lifted. Exit 0.
- Full API suite: **NOT RUN**.

## Demo

Disposable memory Mongo. No Atlas. Officer `step64-officer@example.com` saw total 4, active 1, on hold 1, delayed 1, reported-100 still open 1, completed by status 0, one overdue milestone, one due milestone, reviews withheld, and one stored PAID row of LKR 25.00. Government Admin pending count was 1 by HTTP. Foreign officer saw only `INF-DASH-6499`. Sign-out left the dashboard. Screenshots are in `docs/reviews/step-64/evidence/`. The Sinhala button accepted focus; the browser tool's Enter key did not activate it, and the language change was completed with a click. The Next.js hydration badge on login is the dev overlay.

Stopped listeners: pid 57140 on 3019 and pid 7548 on 4019.

## Gaps

Staff shell navigation labels stay English. Sinhala and Tamil dashboard copy is a draft. Milestone and finance figures are withheld above 500 readable projects. No risk score, prediction, national total, work request, inspection status, or contractor identity is shown.

## Git gates

G1 branch creation was authorized separately and completed. G2, G3, G4, G5, and G6: **NOT RUN**.
