# Presentation script — v4 (own voice, webcam on, no AI voiceover)

Speaker split is a DRAFT — team to confirm. If you did not write this part, say what you reviewed, tested or documented — don't claim authorship.

# Yuvarajah Divejikan (SEU/IS/22/ICT/067) — 5:35 · slides 1–5, 20–22, 26

## Slide 1 — InfraOS — cover · 0:35

Hello, I am Yuvarajah Divejikan, Registration Number SEU/IS/22/ICT/067. I will explain my contribution to the InfraOS project, particularly AI Risk; Finance, Contractor & Asset Management; DocTrace (shared). We are Group H, and this is InfraOS — one shared platform where agencies plan, coordinate and monitor infrastructure work. Our line is simple: every road, every agency, one shared map. Everything you will see runs on synthetic demo data; this is an academic prototype, not a government system.

## Slide 2 — Five members, five modules, one platform · 0:35

Here are the details we moved off the cover. We are five students from the Faculty of Technology at South Eastern University, taking SWT22022. Each of us owns one module: Nuha, projects; Thasneem, RoadSync; Janethri, InfraMap; Sanojan, the citizen portal; and I cover finance, assets, documents and risk. The source is public on GitHub, as you can see on the right, and the live build on Render answered our health check on the twenty-second of November.

_Be ready to answer:_ Is the live site connected to real government data? — No, synthetic demo data only. | Which branch is presented? — Shown on the Deployment slide.

## Slide 3 — Agenda & speaker plan · 0:20

This is our agenda. Every member presents shared material as well as their own module, so you will hear all five of us several times. Section D is the core: two slides per module, with real screens, routes and code.

## Slide 4 — Agencies plan alone — roads get dug twice · 0:45

The idea came from something we saw ourselves. Travelling to Colombo over about a year, around Thihariya and Nittambuwa, we watched roads opened for one service and reopened for another. Roads, water, power, drainage and telecom agencies keep separate schedules and budgets, so nobody sees the whole street. The result is repeated digging, disruption and delay, and citizens have no clear way to report problems. That was a team observation, not a study. The screen shows our answer, the coordination command center — shown with demo data and honest zero values.

_Be ready to answer:_ Do you have cost data? — No; team observation only, labelled as such.

## Slide 5 — Seven modules built, three partial · 0:35

Our objective was one shared platform where authorised users plan, monitor and coordinate infrastructure work. Green items are implemented and verifiable in the repository. Amber items are partial: the risk engine is rule-based rather than machine learning, document questions need an external language-model provider, and Sinhala and Tamil coverage isn't complete everywhere. Out of scope are real government data, legal permits and site surveys. Thasneem will now explain how it is built.

_Be ready to answer:_ Is the risk engine machine learning? — No, deterministic rules.

## Slide 20 — Finance, assets, documents: one trail · 0:50

Now my own modules. The hero is the finance dashboard: approved, committed, paid, pending and remaining, with spend against progress. It is a recording tool — it never moves money. The three tiles show the rest. Assets: completed projects become assets with condition and maintenance records. Payments: each payment references the project, the contractor and the contractor assignment, so every amount is tied to a contract. Documents: uploads go through a three-step ticket — request, upload content, commit — so a half-uploaded file never appears in the register. The spend-against-progress chart makes a project that spends faster than it progresses stand out for review.

_Be ready to answer:_ Why a three-step upload? — Type/size checked before commit; incomplete uploads never become documents. | Does InfraOS pay contractors? — No, it records and approves only.

## Slide 21 — Risk scores you can reproduce · 0:50

This is the risk engine entry point. Point one: evaluateRisk is a pure function of its inputs and the time. Point two: the inputs hash ties every score to exactly the data and engine version that produced it, so a result can be reproduced. Point three: if a project's status can't be assessed, like a draft, the engine returns NOT_ASSESSABLE with the reason instead of inventing a number. To be clear, this is a rule-based engine, not a trained model — we had no real labelled data, so we chose explainable rules. Document question answering needs an external provider and is off for testing, so it stays labelled partial.

_Be ready to answer:_ Is this AI? — Rule-based risk intelligence; the LLM part is optional and partial. | How would you add ML? — Labelled history + evaluation; future work.

## Slide 22 — Collaboration evidence · 0:50

Our workflow uses feature, fix, chore and docs branches, merged into development, and development into main for submission. On GitHub, main shows five hundred and ninety-eight commits and there are eighty-three branches. Two hundred and twenty-four pull requests are closed, none open, and the Actions tab shows one hundred and eighteen CI runs. The screenshot is the public merged pull-request list with its checks. How the work was divided between us is something the team confirms; the commit history alone doesn't show it. Merge commits name the source branch and the pull-request number, so any feature can be traced back to its pull request.

_Be ready to answer:_ How was work divided? — TEAM TO ANSWER before recording (see MISSING_INFO). | What does CI check? — type-check, lint, web tests, API build.

## Slide 26 — Who built what — team to confirm · 0:15

This matrix lists each member, registration number, module and deliverables. The percentages stay as TBC on purpose: they must be agreed by the whole team, and we will not derive them from commit counts.

_Be ready to answer:_ How were percentages decided? — TEAM TO CONFIRM before recording.

# M.H.M. Fathima Nuha (SEU/IS/22/ICT/038) — 4:40 · slides 9–13

## Slide 9 — 56 models across 14 modules · 0:50

Hello, I am M.H.M. Fathima Nuha, Registration Number SEU/IS/22/ICT/038. I will explain my contribution to the InfraOS project, particularly Project Intelligence & Monitoring. I'll start with the database, because my projects module depends on it. We have fifty-six Mongoose models in fourteen modules — the image is the real file count per module. RoadSync is the largest with nine, then identity and AI governance with seven each. Many schemas set strict to throw, so unknown fields are rejected instead of silently saved, and location data is GeoJSON with 2dsphere indexes on projects, assets, citizen issues, hazard zones and conflict hotspots.

_Be ready to answer:_ Why so many models? — Workflow state such as upload tickets and refresh families is stored explicitly. | What does strict: throw do? — Rejects unknown fields on save.

## Slide 10 — References, not foreign keys · 1:00

This diagram comes from the actual schema fields. MongoDB has no foreign keys, so these are ObjectId references that our services enforce. The small letters show cardinality: N on the referencing side, 1 on the referenced side. Agency is the centre of scoping: users, projects and work requests all carry an agencyId. A project has many milestones, work requests, payments and documents. A conflict references exactly two work requests, stored in normalised order — you can see those two fields in the schema image. Small value objects, like money and GeoJSON geometry, are embedded rather than referenced. The contractor link matters for my module too: a project can name its contractor, and payments point back to both the project and the contractor.

_Be ready to answer:_ How do you prevent orphan references without FKs? — Service-level checks; transactions where money moves. | Why normalise the conflict pair? — So A–B and B–A can't both be recorded.

## Slide 11 — Money and audit commit together · 0:45

Data integrity matters most where money moves. This helper is in the finance module, which Divejikan wrote; I reviewed it because my project budgets rely on it. Point one: it opens a MongoDB session. Point two: the work runs inside withTransaction, and the finance service writes the payment and its audit row with that same session, so both commit or neither does. Point three: the session is always closed in a finally block. Amounts are stored as positive integer minor units, and figures stay labelled provisional — InfraOS records payments but never moves money.

_Be ready to answer:_ Why integers for money? — No floating-point rounding (amountMinor). | What if the audit insert fails? — The transaction aborts; the payment is not saved.

## Slide 12 — Projects: one record every module shares · 1:00

My module is the project workspace — the single record that RoadSync, the map, finance and documents all link to. Callout one: search and filters for status, category and agency, all limited to the agencies the user may see. Callout two: status is written in words as well as colour, so it reads without colour vision. Callout three: Create project, which needs the project.create permission. The routes on the right each carry their own permission. Approving needs project.approve, which is separate from creating, so the same person can't normally draft and approve their own project. The status values you can read in the table — approved, completed, delayed, active, draft — come from the project lifecycle, so the list always matches the transition rules.

_Be ready to answer:_ How is the list scoped? — Service filters by agency scope; out-of-scope ids return not found. | Who can approve? — Only roles with project.approve.

## Slide 13 — Validate first, then scope, then save · 1:05

This is the real create route. After the authentication and permission middleware, point one parses the body with the projectCreateSchema zod schema; invalid data, such as an end date before the start date, returns 400 with a generic message. Point two calls createProject, which applies agency scope and saves; any business failure goes through one sendFailure helper, so error shapes stay consistent. Point three returns 201. In the data model, a project carries its agency, manager, contractor and GeoJSON geometry; milestones and progress reports reference it. One decision I care about: a contractor reporting one hundred percent does not make a project complete — verification is a separate record. Thasneem continues with RoadSync. The 415 check for non-JSON bodies sits just above these lines, which keeps form-encoded or empty requests out.

_Be ready to answer:_ Where are dates validated? — projectCreateSchema (zod) before the service. | Why is 100% not completion? — Progress and verification are separate records and permissions.

# A. Fathima Thasneem (SEU/IS/22/ICT/093) — 4:45 · slides 6, 14–15, 23

## Slide 6 — Every request crosses one trust boundary · 1:25

Hello, I am A. Fathima Thasneem, Registration Number SEU/IS/22/ICT/093. I will explain my contribution to the InfraOS project, particularly RoadSync – Infrastructure Coordination. I'll walk through the architecture, because RoadSync depends on every layer of it. Users work in a Next.js frontend that never talks to the database. It calls our Express API with a short-lived token held in memory, while the refresh token sits in an HTTP-only cookie. The orange line is the trust boundary. Behind it the server enforces everything: helmet and CORS, rate limits, token verification, a permission check that re-reads the role from MongoDB, zod validation, and agency scope in the services. The API stores data in MongoDB, files through a storage provider, and calls a separate Python FastAPI service with signed requests. The terminal image shows the real repository layout behind this picture. One more design point: the frontend cannot bypass the API, because it never receives database credentials — only the API reads the connection string from its own environment file. That is why every rule we show later lives behind this boundary.

_Be ready to answer:_ Why one Express API instead of Next.js API routes? — Single enforced place for auth and RBAC. | Where is the role checked, and how often? — requirePermission, every protected request.

## Slide 14 — RoadSync: find the clash before the dig · 1:05

Now my own module. RoadSync exists to stop two agencies digging the same street at the same time. An agency officer files a work request with a drawn location, the work type and a planned window. Callout one is the has-conflicts filter; callout two the planned window in Colombo time; callout three the status. On the right is the flow: submit, detect, review, resolve. Detection compares the request with other work requests, projects and assets that are near in space and close in time, and records candidates for people to review. RoadSync is our largest module, with eighty-six route handlers. The planned window is shown in Colombo time on purpose, because agencies coordinate in local working days. Requests start as drafts, and submitting one is what starts conflict detection, so drafts never create noise for other agencies.

_Be ready to answer:_ Is every nearby job a conflict? — No; it must also overlap or sequence-clash in time, then a person reviews it. | Who can submit? — roadsync.work_request.create only.

## Slide 15 — Space and time must both overlap · 1:15

This is the real detection code. Point one: collect builds a search polygon from the request's geometry plus a buffer and radius, and then loads work requests, projects and assets with MongoDB's geoIntersects on the 2dsphere index. If one source fails, it is recorded as unavailable instead of crashing the run. Point two: for each nearby item, analyzePair computes a spatial relation and a temporal relation. Point three: pairs with no spatial relation are skipped on the last line; the isCandidateOf check just below this excerpt only flags a candidate when both line up, or when there's a sequencing risk, such as resurfacing before trenching. We had duplicate pairs, so the Conflict model stores pairs in sorted order and rejects a request conflicting with itself. Each candidate also stores an inputs hash — a fingerprint of both geometries, both windows and the radius — so if nothing has changed, a re-run does not create a duplicate record.

_Be ready to answer:_ Why metres, not degrees? — Distances are computed in metres (model comment). | What if the asset source is down? — The run records it as unavailable.

## Slide 23 — Five gates guard every request · 1:00

Back to security. At login, bcrypt with cost twelve verifies the password. The API issues a short-lived access token signed with jose, and a refresh token in an HTTP-only cookie tracked as a session family, so reuse can be detected. On every protected request, the token is verified, then requirePermission reloads the role. Point one: if the role is inactive or changed, the answer is 401. Point two: the granted permissions are checked against what the route needs. Point three: a missing permission is logged and returns 403. Finally services apply agency scope. Hiding a button is never treated as authorisation. Our API tests cover these denials directly — wrong role, wrong agency, unauthenticated — plus the case where a user is disabled and their sessions must stop working.

_Be ready to answer:_ Why reload the role every request? — Revocation takes effect immediately. | Where is the refresh token? — HttpOnly cookie, tracked per family.

# W.A. Akashi Janethri (SEU/IS/22/ICT/039) — 4:40 · slides 8, 16–17, 24

## Slide 8 — One request, eight checkpoints · 1:20

Hello, I am W.A. Akashi Janethri, Registration Number SEU/IS/22/ICT/039. I will explain my contribution to the InfraOS project, particularly InfraMap & Infrastructure Intelligence. I'll follow one real request end to end: creating a project. One, the form validates with zod. Two, the browser sends POST to the projects endpoint with the bearer token. Three, helmet, CORS and the rate limiter run. Four, the token is verified with jose. Five, the permission check reloads the role and needs project.create. Six, non-JSON gets 415 and invalid input 400. Seven, the service applies agency scope and writes the record. Eight, the API returns 201 and the list refreshes. The terminal image is a real response from our deployed API: calling the projects endpoint without a token returns 401, AUTH_REQUIRED — step four failing safely. Notice that steps four and five both happen before any validation or database write, so nobody can even probe the shape of our schemas without a valid token and the right permission.

_Be ready to answer:_ What if a role changes mid-session? — Step 5 re-reads the role; the next request is denied. | Why a generic error message? — Avoids leaking internal details.

## Slide 16 — InfraMap: you see only layers you may read · 1:00

My module turns records into places. Callout one is the layer panel: projects, roadworks, conflicts, assets, utilities and risk, each with opacity and show-only-this-layer controls. Callout two is the MapLibre map of Sri Lanka. Callout three is the details panel for the selected feature. Every layer is its own endpoint, and the rule is in the table: each needs the internal map permission plus the permission for that data. So a user who can't read conflicts never receives the conflict layer at all. Search, nearby lookups and feature details follow the same rule. On the left you can also see the This view and Everywhere search toggle, and a note that street-address search is not included, so the map is honest about what it can find.

_Be ready to answer:_ What does a citizen see? — Only /public/map/features, a separate public-safe endpoint. | Where is agency scope applied? — In the data layer, not the UI.

## Slide 17 — Two permissions per layer, strict queries · 1:05

Here is the code. Point one: the MAP constant is the internal map permission that every route needs on top of the permission for its own data; the comment above it, not shown, says scope is applied in the data layer. Point two: the layers endpoint accepts no query parameters at all, so anything unexpected returns 400 instead of being silently ignored. Point three: responses are sent with no-store caching. Elsewhere in the same file, the data layers also send an ETag, so unchanged layers come back as a cheap 304. Our tests check these rules; for example, restricted utility geometry is never returned to a viewer without the restricted-layer permission, only a count. Another test checks that the nearby lens only accepts whitelisted radii, so a user cannot request the whole country in one call.

_Be ready to answer:_ Why ETag? — Large GeoJSON layers; 304 avoids resending unchanged data. | Unknown query parameter? — 400 VALIDATION_ERROR.

## Slide 24 — 1,008 API and 427 web tests pass · 1:15

I'll present testing. All numbers come from runs on the twenty-second of November on the presented commit, and the image is the real output. The API suite runs against an in-memory MongoDB, never Atlas: one thousand and eight tests passed and eight were skipped. The web suite: four hundred and twenty-seven passed. Type-check passed for web and API. Lint exited cleanly with zero errors and four warnings in the web app. The Python AI service has ninety-six passing tests. On GitHub, the CI run for our presented commit is green. Tests cover denials — wrong role, wrong agency, unauthenticated — not just happy paths. We did not execute a production web build or browser end-to-end tests for this deck: a build writes into the repository folder. Skipped tests are reported openly rather than hidden, and CI repeats type-check, lint and the web tests on every push, so these results are not a one-off.

_Be ready to answer:_ Do tests hit Atlas? — No; in-memory MongoDB (tests/helpers/mongo-memory.ts). | What are the 4 lint warnings? — Next.js font/img and compiler-skip warnings, no errors.

# Gnanachandran Sanojan (SEU/IS/21/ICT/064) — 4:20 · slides 7, 18–19, 25, 27

## Slide 7 — Stack chosen for maps, scope and safety · 1:00

Hello, I am Gnanachandran Sanojan, Registration Number SEU/IS/21/ICT/064. I will explain my contribution to the InfraOS project, particularly Citizen Infrastructure Portal. I'll cover the technology stack; my citizen portal uses most of it. The versions come straight from our package files — the image shows the real API dependencies. On the frontend, Next.js 16 and React 19 with TypeScript; TanStack Query caches server data, and react-hook-form with zod gives the same validation rules as the API. MapLibre draws maps without a paid token. The backend is Express 5 with Mongoose 8. We chose MongoDB because infrastructure records carry GeoJSON geometry, and its 2dsphere indexes give us spatial queries. Tokens use jose, passwords bcrypt, and GitHub Actions checks type-check, lint, web tests and the API build on every push.

_Be ready to answer:_ Why MongoDB instead of SQL? — GeoJSON + 2dsphere, flexible documents, transactions where money moves. | Why MapLibre? — Open-source, no paid token.

## Slide 18 — Citizen portal: report without an account · 0:55

Now my module, the public side of InfraOS. This is the live portal with demo data. Callout one: released-project counts come from the live API, marked Source: Live. Callout two: each card shows reported physical progress on our chainage ruler — reported, not officially completed. Callout three: every record is labelled synthetic prototype data. On the right is the five-step report form; no account is needed. The citizen receives a reference number and a one-time tracking secret, and can check status on the Track page. Staff with citizen-issue permissions route issues to an agency, change status and add notes. All three demo projects are in Colombo, and the directory can be filtered by category, status and district.

_Be ready to answer:_ Why a tracking secret, not just the reference? — References are guessable; the secret protects the report. | Can the public change a status? — No; staff routes need citizen_issue.update/close.

## Slide 19 — Abuse-resistant by default · 0:50

Here is the real submit route. Point one: a rate limiter sits on the route line above, and the body is validated with publicIssueBodySchema; invalid input gets 400. Point two is a honeypot — a hidden website field that real users never fill. If a bot fills it, we reject with the same generic message, so the bot learns nothing. Point three: createPublicIssue stores the issue; if storage is down we return 503, STORAGE_UNAVAILABLE, rather than pretending it worked, and success is 201. Our challenge was spam and privacy; the decision was limiter, honeypot and zod, plus separate public data shapes.

_Be ready to answer:_ What if storage fails? — 503 STORAGE_UNAVAILABLE; nothing reported as saved. | Why a generic honeypot message? — Bots get no signal.

## Slide 25 — Clone, configure, seed, run · 0:50

To run InfraOS locally: clone the repository, install once for all workspaces, and copy the example environment files — Windows and macOS or Linux commands are side by side, and only variable names are ever shown. Point the database variable at a development database, run the core and demo seeds, then start the API on port 4000 and the web app on 3000. In production both run on Render with MongoDB Atlas. We checked the live API health endpoint on the twenty-second of November and it answered 200. The seed scripts are for development databases only; we never run them against production data.

_Be ready to answer:_ Can examiners use demo seed accounts? — No; a real approved account is required. | Where do secrets live? — Per-app .env files, never committed.

## Slide 27 — What we solved, what's next · 0:45

To close for the team. Our hardest problems were detecting clashes in both space and time, enforcing permissions on every map layer, keeping money and audit consistent, and protecting public forms. The limits are real: risk uses rules not machine learning, language-model features need an external provider, all data is synthetic, and we haven't run load or browser end-to-end tests. Future work is planned, not built: approved government data, a trained and evaluated risk model, mobile field inspections and full Sinhala and Tamil coverage. Thank you — we're happy to take your questions.

_Be ready to answer:_ What would you do with more time? — Data agreements, evaluated ML risk, E2E tests.

