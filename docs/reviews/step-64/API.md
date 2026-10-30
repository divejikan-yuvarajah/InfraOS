# Step 64 dashboard API

`GET /api/v1/projects/dashboard`

Registered before `GET /:id`. Authenticated. Live `project.dashboard.read` is required by middleware, and the service also requires live `project.read`, an active verified user, and the current credential epoch. Scope comes from `resolveResourceScope` and `projectReadFilter`. Inspectors who hold both grants are limited to inspection assignments. Contractor and Citizen are denied. Query parameters are rejected. The response uses the existing success envelope, `Cache-Control: no-store`, and does not write a project, progress report, or audit row.

`0` is a verified count. `null` means the widget is withheld or the source is unavailable. A reported physical progress of 100 does not change `status`. Milestone dates use the Asia/Colombo calendar day, stored and returned as UTC. A planned end is not a completion. Stored `PAID` amounts appear only when the role still has both `finance.budget.read` and `finance.payment.read`, and they are labelled provisional. Pending reviews appear only for a live Government Admin with `project.approve`.

Milestone and finance lists are withheld, rather than guessed, when the readable project set exceeds 500. No new index is created.
