# INFRAOS — Step 63 Enhanced Development Prompt
## Project Activity History | Phase 6 — ProjectTrace

> **Role:** Act as Principal Full-Stack Engineer, GovTech Domain Architect, AppSec/RBAC Specialist, Database Concurrency Engineer, UI/UX Design Lead, and Test Lead. Produce a working, demonstrable Step 63 implementation **only when this prompt is run in the authorized local repository**. This file is a development specification, not evidence that Step 63 has been implemented.

**Project:** INFRAOS — National Infrastructure Intelligence & Coordination Platform  
**Vision:** *The Operating System for National Infrastructure*  
**Repository:** https://github.com/divejikan-yuvarajah/InfraOS  
**Mandatory working directory:** `C:\Users\ASUS\Desktop\InfraOS\InfraOS`  
**Roadmap:** Step **63 — Project Activity History**  
**Last repository inspection for this specification:** 2026-10-30 (refresh all refs during execution)

---

## 1. Source of truth: exact roadmap requirement

The roadmap `Prompts/Steps.docx` names **Step 63 — Project Activity History**. `docs/planning/requirements.md` defines:

- **FR-PROJECT-015 — Project activity history**; actor: **authorized user**; precondition: **project access**; behavior: **chronological activity for significant events**; success criterion: **users can reconstruct what happened**; priority **P0**; module **ProjectTrace**.
- Related requirements: **FR-PROJECT-004** (audit of sensitive project edits), **FR-PROJECT-006** (audited approval/rejection), **FR-AUDIT-002–005** (critical changes are auditable, normal users cannot mutate audit logs, secrets never enter audit), and **BR-PRJ-004/010** (100% reported progress or milestone completion does not complete the project).
- Existing architecture: `docs/architecture/notification-audit-architecture.md` requires append-only `auditLogs` with actor, action, resource, resource ID and timestamp; Pino application logs are **not** audit records.

**Boundaries of what is verified:** The roadmap supplies the title and high-level requirement, **not** an exact event taxonomy, pagination contract, UI location, or source-join algorithm. The technical decisions below are the Step 63 implementation design, subject to confirmation against the local code and owner policy; do not misrepresent them as verbatim roadmap rules.

### Definition of done

An appropriately authorized user opens an authenticated project-specific **Activity History** view and sees trustworthy, chronologically ordered, sanitized **recorded activities** across supported ProjectTrace domains. Each item identifies what occurred, when the stored record says it occurred, its source and any safe context the viewer may access. A user can differentiate a genuine audit action from a planned timeline date or a reported-but-unverified progress entry. No unauthorized audit snapshots or cross-agency data leak. History cannot be edited or deleted from this feature.

---

## 2. Verified upstream state and branch safety

### Repository state checked on GitHub

| Ref or artifact | Observed fact | Execution instruction |
|---|---|---|
| `origin/development` | `6a5e9b3a5b16987cae8702020c0834630fdf74dc` | Refresh; **Step 63 is not on this snapshot**. |
| `origin/main` | `ce0f768baab408ce2618744f14131665053eed4e` | Stable branch is **not** a Step 63 integration target. |
| PR #109 | `https://github.com/divejikan-yuvarajah/InfraOS/pull/109`, **open, draft, unmerged** | Do not pretend Steps 61–62 are integrated. Confirm its live state before any checkout or branch operation. |
| PR #109 head | `feature/projecttrace-timeline-dependencies` at `1e84eaa7451a2af11b35944f80d1dc6256c6b0d7` | This branch **contains** Steps 61–62 and their verification docs, but those changes are not in `development` until PR #109 merges. |
| PR #109 CI | `API, web, types, lint, build` completed **successfully** on the head as checked | CI does not mean owner approval, G6 clearance, or production readiness. |
| PR #106 | Steps 59–60 previously merged into `development` | Physical/financial limitations remain. |

**Critical preflight gate:** Avoid polluting PR #109 with Step 63. Prefer to **wait for owner-approved PR #109 G6 and confirmed integration into `development`** before committing or pushing Step 63. If PR #109 remains open, conduct only safe read-only analysis and planning; do **not** switch branches across a dirty tree or push Step 63 onto its remote branch. If the owner explicitly authorizes a different stacked-PR strategy, document the exact base/compare behavior and Git approvals before proceeding. No interpretation of the prior G1–G5 approval for Steps 61–62 can authorize Step 63 Git writes.

**Local state is not remotely verifiable.** At last user-reported handoff, older production-readiness/review docs and untracked `Prompts/` files remained dirty. The local current branch, HEAD, index and `.env.local` must be inspected independently at execution. Never overwrite, move, stage or delete unrelated work. A local branch rename may be possible after the feature commit is an ancestor of refreshed `origin/development`; verify before acting and obtain explicit approval for Git checkpoint G1.

### Mandatory upstream references to inspect locally

- `Prompts/Steps.docx`; `docs/planning/requirements.md`, `business-rules.md`, `user-workflows.md`, `project-scope.md`; `docs/security/permission-matrix.md`.
- `docs/architecture/notification-audit-architecture.md`; `docs/architecture/dependency-rules.md`; `docs/reviews/steps-59-60/END-OF-PHASE-VERIFICATION.md` and `docs/reviews/steps-61-62/END-OF-PHASE-VERIFICATION.md` from the source branch or integrated `development`.
- `apps/api/src/modules/audit/models/audit-log.model.ts`, `audit.constants.ts`; `apps/api/src/modules/projects/projects.routes.ts`, `projects.service.ts`, `milestones.service.ts`, `progress.service.ts`, `dependency.service.ts`, `timeline.service.ts`.
- `apps/api/src/modules/projects/models/{project,milestone,progress-report,project-dependency}.model.ts` where present; `apps/api/src/modules/identity/authorization/resource-scope.ts`, `require-permission.ts`; `apps/api/src/modules/identity/seed/system-role-permissions.ts`; `packages/shared-types/src/permissions.ts`.
- `apps/web/src/app/projects/[id]/timeline/page.tsx`, `apps/web/src/components/projects/project-overview-client.tsx`, `project-timeline-client.tsx`, existing locale and auth/data fetching patterns; root/package scripts.

### Confirmed technical handoff

- **Step 58:** Milestone model has `projectId`, planned/actual dates, status, progress; milestone change actions have audited paths. Milestone state must never change parent project lifecycle by itself.
- **Step 59:** Assigned **Project Manager** may submit append-only `ProgressReport` entries; 100% does not complete project. Contractor-to-user authenticated identity mapping is **BLOCKED**, so contractor submissions remain unsupported. Report notes are private and require appropriate permission.
- **Step 60:** Financial summary derives from **stored** `ProjectPayment.status === 'PAID'` minor-unit LKR rows; **not** independently verified bank settlement. Step 63 must not infer or display disbursement events.
- **Step 61:** `/api/v1/projects/:id/timeline` is a **read-only planning and recorded-date view** (project creation/schedule, milestone dates, progress reports), with `project.read` + `project.timeline.read`, source caps, stable ordering and permission-gated notes. **Timeline ≠ activity audit history.**
- **Step 62:** Same-agency informational `PREREQUISITE` links, direction dependent → prerequisite, soft removal, per-graph revision, 200-edge safety cap and transaction lock. Link/unlink actions generate audit actions on the dependent **PROJECT**. No lifecycle transition, schedule change, or cross-agency prerequisite policy. The partial unique dependency index still requires production migration approval.
- **Audit model:** `AuditLog` has `timestamp`, `userId`, `action`, `resourceType`, `resourceId`, `agencyId`, request correlation, and **select:false** `oldValue`/`newValue`/network metadata. Existing compound index `{resourceType,resourceId,timestamp}`. It is append-only with model middleware; direct DB operations can bypass ODM guards. Do not expand a general-user audit API.

---

## 3. Precise feature scope

### In scope

1. Project-specific event-history page at **`/projects/[id]/activity`**, linked from authorized project overview and optionally the timeline page without replacing its current layout.
2. Authenticated, scoped read API at **`GET /api/v1/projects/:id/activity`** (proposed route; maintain REST conventions); deterministic newest-first chronological event list, bounded pagination, optional safe category filters and explicit source/provenance indicators.
3. Supported actual events **only when durable source data exists**: selected project creation/edit/review/lifecycle audit actions; milestone create/update/transition audit actions; recorded progress submissions; same-agency dependency links/removals. Use exact existing persisted action strings discovered from local code — do not invent them. Preserve event time and order. The category set may narrow to proven events.
4. A safe and readable event card with icon, action label, exact occurrence time in `Asia/Colombo`, safe contextual detail, source classification (audit / recorded source), and actor display policy. Empty, truncated, redacted, unavailable and access-denied states.
5. ProjectTrace permission integration, reusable API client, EN/SI/TA **draft** UI strings, responsive and accessible premium dashboard, tests, user documentation, real browser demonstration and evidence.

### Explicitly out of scope

- **Step 64** dashboards/KPIs, **Step 65** notifications/audit integration beyond necessary reads, RoadSync coordination features, analytics or AI summaries, notifications, real-time streaming, email, attachments and export of full audit records.
- Auth policy redesign, broad `audit.read` grants, backfilling fictitious historical actions, altering old audit entries, unverified contractor identity, actual bank settlement, new payment ingestion, cross-agency dependency policy, approval of START/COMPLETE gates, production deployment.
- Public Connected Future landing page, Atlas index creation, data migration or live data seeding without separate approval.

---

## 4. Data provenance and activity taxonomy

**Core rule:** an activity item means **a persisted event**, not a scheduled date. A planned milestone or project end date is a Step 61 *timeline date*, not proof that an action occurred on that date. Current status is not an historical status-change event unless a corresponding audit exists.

### Evidence mapping (verify exact action literals locally)

| Source | Candidate event class | Safe mapping rule | Sensitive constraints |
|---|---|---|---|
| `AuditLog` `resourceType=PROJECT`, `resourceId=projectId` | Project created, draft updated, submitted, reviewed, rejected, approved, held, resumed, reopened, other actual persisted project actions | Explicit allowlist only; timestamp from audit; action-to-label/role mapping; **unknown actions are omitted or an intentionally generic safe entry only if policy allows** | No raw reason, old/new payload, IP, UA, request body, tokens, agency IDs or finance fields without a separate field-level policy |
| `AuditLog` `resourceType=MILESTONE`, `resourceId ∈ verified milestone IDs under project` | Milestone created, updated, status changed | Resolve project ownership using `Milestone.projectId` before audit join; cache safely; summarize only proven state from whitelisted snapshots | Do not use arbitrary audit `resourceId` to query outside project; don't expose unrelated names |
| `AuditLog` `action=progress.reported`, `resourceType=PROJECT` | Recorded physical progress | Correlate to `ProgressReport` only if a reliable ID/sequence exists; avoid duplicate display from both sources | `reported` is **not** inspected/verified; notes only if `progress.read`; 100% does **not** mean completed |
| `ProgressReport` | Source-backed report when audit correlation is absent or intentionally not possible | Label explicitly `recorded progress report`, not `audit-verified event`; time `reportedAt`; scope project and actor | No speculative acceptance, no fake actor identity; avoid displaying same action twice |
| `AuditLog` `project.dependency_linked` / `project.dependency_removed` | Prerequisite added/removed | Historical links remain visible even when soft-deleted; text says **informational**; readable project scope must be rechecked before showing other project's title/code | No lifecycle/date inference, no cross-agency target leakage; audit snapshots include IDs but are `select:false` |
| `Project.createdAt` | Optional fallback **record metadata** | If no audit create event is available, explicitly mark as `record timestamp (not an audit event)`; never silently treat as audit | No fabricated creation actor/action |

**Audit integrity caveats:** audit actions might not cover every change or legacy record. Record `coverage` (for example `audited_events_only` or `partial_source_coverage`) and make source unavailability visible. Never claim a complete history of every action when not supported. Stale source labels in previous review markdown must not become application truths.

### Event response contract (design target, adjust to existing envelopes)

```json
{
  "data": {
    "projectId": "<authorized-project-id>",
    "activities": [
      {
        "id": "audit:<event-id>",
        "kind": "PROJECT_CREATED",
        "category": "project",
        "occurredAt": "2026-10-29T11:00:00.000Z",
        "source": "audit",
        "titleKey": "activity.projectCreated",
        "detail": null,
        "actor": { "label": "Authorized staff", "identityVisible": false },
        "verified": "recorded_event"
      }
    ],
    "pageSize": 20,
    "nextCursor": null,
    "hasMore": false,
    "coverage": "supported_events_only",
    "sourceAvailability": { "audit": "available", "progress": "available" }
  },
  "requestId": "<existing-server-generated-id>"
}
```

This is a **proposed DTO**, not a claim that this exact endpoint or shape exists today. Reuse the repository's established `success()` wrapper rather than hardcoding envelope fields. Do not emit an arbitrary `verified:true` indicator: explain the record's source, not independently verified real-world completion.

### API semantics and errors

- `GET /api/v1/projects/:id/activity?limit=20&cursor=...&category=all` (sample). Default 20; maximum **50** (unless existing policy has a stricter cap); strict Zod schema, reject unknown query keys, invalid IDs, malformed cursor, excessive parameter lengths and invalid category with **400**.
- **401** anonymous/stale credential; **403** missing action permission; **404** inaccessible/foreign/nonexistent project without disclosing identity; **503** source unavailable rather than fabricating empty history; honor existing error envelope and `Cache-Control: no-store`.
- Use **keyset pagination**, ordering by `(timestamp DESC, _id DESC)` for audit records. Validate/normalize cursor as a bounded opaque continuation tuple and verify its project and filters; do not let callers pass Mongo operators. If combining sources, define a stable source-rank / synthetic ID tiebreaker and ensure no repeats/omissions. Alternatively use one audit-backed ordered source if other sources would make cursor semantics unsafe — document the coverage limitation.
- For multiple domains, query each trusted source with bounded limits, merge with stable deterministic comparison, and compute continuation correctly. **Never load an unbounded full audit collection or silently truncate the earliest part of history while claiming complete pagination.** If source coverage is capped, return explicit `partial`/`hasMore` semantics and a safe user-facing note.
- Avoid N+1 queries. Index awareness: existing audit compound index targets resourceType/resourceId/time; `Milestone.projectId` and `ProgressReport.projectId` existing index patterns need inspection. Do not create any Atlas index. New indexes require owner-reviewed migration and independent testing. Query timeout or disconnection should produce a controlled unavailable result.
- Do not allow any request to write, erase, amend or export raw audit logs via this feature.

---

## 5. Authorization and privacy model

### Minimum access decision

- Require current live authenticated session and revalidate current role, active user, verified email/credential epoch, and agency membership using the established service patterns.
- Require **`project.read` plus `project.timeline.read`** for this initial, **sanitized ProjectTrace activity** view, matching the established timeline audience (Super Admin, Gov Admin, Agency Officer, Project Manager as existing assignments permit). Do **not** use or grant global `audit.read` for the project activity page. Do not treat `project.read` alone as permission to see private audit actions.
- Follow established `resolveResourceScope`/`projectReadFilter`, role restrictions and nonexistence masking. Do not accept `agencyId`, `actorId`, `resourceId`, `role`, target project or raw Mongo filters from the UI as scope authority.
- Note: the security matrix limits **raw audit-log viewing** to platform/organization admin roles; the Step 63 product-facing list is a **strictly minimized, permission-scoped derivative**, **not** the raw audit log. If the local permission model requires a dedicated `project.activity.read` scope or legal/policy approval, stop and document that decision instead of silently expanding grants.
- Inspector, Contractor and Citizen must **not** receive this endpoint based on `progress.read`, `milestone.read`, or `progress.submit` alone. Inspectors lack current `project.timeline.read`; do not enlarge it implicitly. Contractor identity remains unresolved.

### Field-level and actor privacy

- Project title may be shown only after authorized project lookup. Milestone labels only after ownership verification; record link targets only after same tenant/read scope validation. Statuses shown in activity must be historical (from authorized field-level audit snapshot), not current status incorrectly represented as the state then.
- **Do not select or serialize** `oldValue`, `newValue`, `ipAddress`, `userAgent` by default, or `email`, password hashes, tokens, network metadata, raw approval reasons, free-text notes, budget/payment amounts, financial ratios, embedded documents or arbitrary metadata. If an individual safe snapshot field is genuinely required, select deliberately, validate against a **strict allowlist**, document permissions and test that no extra fields escape. Never return an entire Mongoose audit document.
- Actor display defaults to a safe generic label (`Authorized staff` / `System event`). If showing a real name, do so only after field-level identity policy validation, scoped lookup, consent considerations, inactive/deleted-user handling, and test coverage. No email addresses as actor identifiers by default.
- Where a source contains a missing/deleted reference, display `Unavailable record` rather than revealing an inaccessible entity. Preserve chronological evidence without disclosing foreign resources.
- Return **no secret** in errors, logs, fixtures, screenshots or documents. Use structured logging with `requestId` but never log raw audit payloads.

---

## 6. Backend implementation blueprint

1. **Inventory real audit actions and relationships.** Search for all persisted `AuditLog.create`, transactional action strings and snapshot schemas in project, milestone, progress, review and dependency services. Map actual action names, resourceTypes and IDs. Do not assume that every project mutation emits audit or that milestone action's `resourceId` equals project ID. Confirm `Milestone.projectId` ownership and available timestamps; identify duplicate `progress.reported` event sources.
2. **Choose minimal files** consistent with repo conventions, e.g. `apps/api/src/modules/projects/activity.policy.ts`, `activity.schema.ts`, `activity.service.ts`; integrate route in `projects.routes.ts`. Put display-safe projection and event taxonomy in a pure, unit-testable normalization module. Names are suggestions, not pre-existing paths.
3. **Build permission-scoped query**: validate actor and grants, load project using read scope, collect authorized milestone IDs under that project, then query audit records by **known** resource type and verified IDs with explicit action allowlist. Enforce project/agency equality even on platform-level access where appropriate; do not allow OR clauses to escape scope. In-memory review uses replica Mongo; no unapproved live Atlas use.
4. **Map to safe DTO**: allowlisted `kind`, translation key, timestamp, opaque event ID, category, safe scalar detail and source; never spread unknown DB fields. Preserve original event time and deterministic order. Filter source categories server-side. Allow `ProgressReport` notes only with `progress.read`; prefer not including notes unless required and covered by tests. Treat absent audit rows as coverage limitation, not no activity.
5. **Implement pagination** with stable opaque cursor, strict query bounds, one-item lookahead and deterministic tie handling. Use only known allowed fields, no raw cursor-to-query interpolation.
6. **Error and resilience path**: handle dangling milestone IDs, optional absent progress reports, audit errors, unavailable Mongo, deleted/inaccessible targets, unknown events, agency revocation, concurrent new audit insertions and ambiguous legacy history without leaking or fabricating content. Return safe, precise status.
7. **No new writes** in activity read path: do not create activity rows just for the page, change audit immutability, or modify existing status transitions. If a critical event is missing from audit because its source write never records it, distinguish it as a *source gap*. Propose a separately approved transactional audit fix only if Step 63 cannot meet P0 acceptance otherwise; do not rewrite old histories or mutate sensitive flows silently.
8. **Do not alter identity permission catalog blindly.** Reuse the verified current permissions or block pending review if governance requires a new grant.

### Critical correctness invariants

- An activity record is not a scheduled milestone date. Step 61 timeline continues to show dates, separate from activity.
- `ProgressReport.reportedPercent=100` must not change project status; activity says **reported**.
- Milestone completion never auto-completes parent project.
- A dependency link is **informational**, and a removal is still a historical activity. No cross-agency target name leak.
- Stored `PAID` rows never imply verified bank settlement; prefer omit finance actions from Step 63 unless a fully proven, permission-gated audit story exists.
- Audit action failure in existing mutation must not be relaxed; no hidden write during GET.
- Existing `audit.read` remains limited to permitted administrative roles.

---

## 7. Frontend implementation blueprint

### Routing and integration

- Add an authenticated page at **`apps/web/src/app/projects/[id]/activity/page.tsx`**, consistent with the existing timeline/progress page architecture.
- Introduce a `ProjectActivityClient` (or established naming convention) plus typed API helper and localized messages; add an **Activity History** navigation entry to the authorized project overview. Optionally link to it from `/projects/[id]/timeline`, clearly distinguish from timeline's planned/recorded schedule.
- Use current session/API base, `no-store` and exact error handling established by existing project clients. Do not expose inaccessible page data through server rendering, cached responses, snapshots, console logs, or browser state persistence.

### User experience

- Premium **Sri Lankan flag-inspired** restrained visual identity: orange `#FF5B00`, deep maroon `#8C1F28`, gold `#FEB600`, green `#279541`, charcoal `#111827`. Favor hierarchy, white space, fine line connectors, refined status icons and existing typography/components over heavy gradients or flag graphics. Clear, credible GovTech—not a consumer social feed.
- Suggested layout: compact project breadcrumb and title; short description that this is **recorded activity**; source/provenance explanatory copy; accessible filter chips (`All`, `Project`, `Milestone`, `Progress`, `Dependencies`) when supported by API; vertical chronological activity feed, date separators, safe actor/source, action label and timestamp, optional concise detail; **Load more** if continuation exists.
- Draw from existing CSS/Tailwind/shadcn patterns and `lucide-react` rather than introducing a dependency. No unrelated design-system overhaul.
- Responsive across widths **320, 375, 390, 768, 1024, 1440 and 1920 px**; long titles and event IDs must wrap, no horizontal page overflow, touch targets >=44px where possible.
- A11y: semantic heading and ordered/list structure, distinguish dates textually not solely by color, keyboard-accessible filters and load-more, visible focus ring with adequate contrast, screen-reader announced loading/results/errors, correct button states, no dynamic feed scroll hijack. Respect reduced motion.
- EN/SI/TA *draft* display strings via existing locale strategy, including singular/plural, empty/error/provenance labels and human-readable action verbs. Native-language content validation remains **NOT RUN** without actual sign-off. Localized timestamps should use `Asia/Colombo` and have a machine-readable original ISO value via `<time dateTime=...>` (or equivalent accessible method). Avoid brittle date-only conversion.
- Display empty history honestly: `No recorded activity available for this project` differs from `Activity source unavailable` and `Some history may be missing`. Never show a “100% project complete” label solely due to a progress report.
- Safe failure: 401 sign-in flow, 403 restricted access without audit hints, 404 generic project unavailable, 503 retry with no ghost data, malformed cursor reset via explicit user action.

---

## 8. Database, indexes, integrations and environment

- Use existing **MongoDB/Mongoose** `AuditLog`, `Project`, `Milestone`, `ProgressReport` and optionally `ProjectDependency` as proven. No new event table is mandatory; prefer projections over duplication. Existing audit indexes may be adequate for bounded per-project queries but assess performance and cursor ordering before final acceptance.
- New/changed indexes, especially on Atlas: **NO production migration or automatic live index creation** without explicit owner approval. Development/in-memory tests may create fixture indexes. Document the exact required migration, expected query plans and backout approach if needed.
- No new API key or third-party service is required. Reuse existing session, JWT/cookie authentication and API origin conventions. Do not demand AWS, OpenRouter or external AI. Do not invent an email, bank or queue provider.
- Use existing **process-only** env flags for a local signed-in disposable browser demo: port binding, `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=1`, and isolated `INFRAOS_NEXT_DIST_DIR`. Follow scripts' documented behavior; never write `.env.local` or commit fixtures. Test data must use **isolated replica-set/in-memory MongoDB**, not live Atlas.
- Respect existing listeners, specifically ports **3000** and **4010** unless their actual owning process is authorized. Choose distinct free demo ports; terminate **only** listeners started for Step 63. Restore Next-generated config changes only if definitively generated and verified, without discarding user edits.
- Keep any dev-only demo script excluded from API production compilation, store disposable token strings and fixture passwords only, never actual secrets.

---

## 9. Implementation sequence and checkpoints

### Pre-implementation audit

1. Refresh remote `development`, `main`, PR #109 and feature refs; inspect local HEAD/current branch/upstream, index, dirty/untracked file inventory and process bindings. Preserve hashes for any shared files.
2. **If PR #109 is not yet merged, stop before implementation that could contaminate it**, unless owner expressly approves a distinct stacked approach. Review read-only context and report blocker.
3. Verify Step 63 requirements, source action inventory, audit schema and existing endpoint conventions. Identify which actions can be safely reconstructed and which cannot. Do not invent event coverage or broad audit access.
4. Choose minimal feature files and DTO, categories, ordering, pagination and safe actor copy. Record sensitive field policy before touching source.

### Implementation and focused quality

5. Add pure normalization/unit policy functions and focused tests.
6. Add scoped repository/service read, strict validation, bounded cursor pagination, projection and error envelope; add integration tests against isolated Mongo.
7. Add route and typed client; confirm session, permissions, cross-agency handling and non-leak tests.
8. Build polished Activity History page, navigation, EN/SI/TA draft messages, accessibility and responsive states.
9. Run **focused API and web tests**, TypeScript checks of touched packages, targeted lint, source diff hygiene. Fix real Step 63 defects. Do not run a full phase review twice.
10. **Demonstrate this step in a real browser**, record actual URLs, HTTP responses, screenshots and result. Verify a supported source action appears after refresh; show foreign/denied, no-activity, and mobile. Never claim a demo based only on tests or screenshots without opening the real page.
11. Produce `docs/reviews/step-63/IMPLEMENTATION-STATUS.md`, screenshots under `docs/reviews/step-63/evidence/` and an actionable handoff for **one final comprehensive review**.

### Combined final phase review (Step 63 only)

12. Run root `npm run test:api`, `npm run test:web`, `npm run type-check`, `npm run lint`, `npm run build`, `git diff --check` and targeted review. Preserve process-only auth flags that disable login in CI when appropriate; never edit env files to make tests pass.
13. Review Step 63 against Steps 57–62 regressions and branch isolation, provenance, privacy, concurrency, source coverage, browser E2E and accessible locales. Fix **genuine in-scope defects** and rerun affected/all needed checks. Record intermittent failures in first and final runs without concealing them.
14. Save `docs/reviews/step-63/END-OF-PHASE-VERIFICATION.md` with per-test PASS / FAIL / BLOCKED / NOT RUN and overall APPROVE / REVISE / BLOCKED recommendation, plus actual URLs, screenshot paths and owner demo instructions. Same-agent reviewer is **not independent owner sign-off**.
15. Only after owner approval and successful gates, initiate the consolidated G1–G5 Git workflow; separate G6 approval for merge. Keep the full workflow in the Cursor prompt instead of separate prompts.

---

## 10. Concrete testing and security matrix

| Area | Required cases | Expected evidence |
|---|---|---|
| Source taxonomy | Real `project.created` and supported actual lifecycle/review/edit action; milestone create/transition; `progress.reported`; linked/removed dependency | Exactly one correctly labeled item per event; no assumed event for planned milestone date |
| Time | timestamp in UTC, browser Asia/Colombo; same-millisecond ties, page boundary | Stable deterministic newest-first order and no duplication across pages |
| Provenance | Audit source vs record-derived progress; unverified completion and recorded-PAID disclaimer | No fake bank/inspection/completion claim; source displayed |
| Authorization | anonymous, unverified, disabled, stale epoch, role grant removed, out-of-scope project, inspector/contractor/citizen, platform/agency PM as configured | 401/403/404 as policy; no cross-tenant title, notes, amounts, actor identity or snapshots |
| Field privacy | malicious audit payload, nested old/new values, budget, PII, request body, IP/user agent, unknown action | **Never** serialized in response or HTML; DTO allowlist tests |
| Source ownership | milestone belonging to foreign project; orphan milestone; removed dependency; inaccessible prerequisite | No unrelated milestone info or target title leak; safe placeholder or skip per policy |
| Query | invalid ID, cursor tamper, wrong-project cursor, invalid category, unknown query keys, huge limit, deep pagination | 400 or safe rejection, no DB operator injection |
| Resilience | missing audit log, partial historical coverage, DB error, absent actor, optional progress read failure | Distinct unavailable/partial/empty states; no phantom events |
| Concurrency | new audited event inserted while paging; competing readers; same timestamp; existing write transaction rollback | No read-side write, no duplicate item; committed audit only; no phantom after rollback |
| Regression | project status after progress 100; milestone status changes; B→A dependency cycle; finance denied; timeline unchanged | Existing Step 57–62 assertions remain valid; no scope expansion |
| UI | EN/SI/TA label switches; keyboard; focus; loading; filters; mobile/tablet/widescreen | Real browser screenshots and URL/HTTP evidence; no overflow; native review noted NOT RUN |
| Build/CI | full test runs, tsc, eslint, build, diff check | Exact commands, exit codes, test counts, first failures and final reruns |

**Do not assert absolute concurrency correctness solely from a unit test**; preserve failure-mode and deterministic pagination limits in the report. If the audit model cannot reliably reconstruct a required class of event, mark that class **BLOCKED/partial** rather than manufacturing it.

---

## 11. Actual project output and demonstration — mandatory

After Step 63 implementation, operate an authorized isolated local API and Next frontend in a real browser; do not merely render a static mockup. Minimum owner walkthrough:

1. Open the authenticated project overview; show the **Activity History** navigation and click it.
2. Show event sequence: actual project creation, a milestone action and a progress report, plus a Step 62 link and removal where actual fixtures include those audited actions. Inspect displayed occurrence dates and explicitly compare one event to the Step 61 **planned** timeline date.
3. Filter categories, paginate/load more, reload and confirm entries persist; explain actor visibility and how unavailable sources are labeled.
4. Sign in with an out-of-scope agency account and show **404**, with no project title, actor or note; show missing permission **403** and anonymous **401**.
5. Confirm the parent project remains `ACTIVE` after a reported 100% and that a dependency event did not change lifecycle or schedule. If financial progress is shown on a separate page, it must say stored PAID is not bank confirmation.
6. Capture desktop and mobile screenshots, test widths 320–1920, keyboard focus and locale switch; record actual page URLs, backend port, HTTP statuses and demo fixture labels. Stop only own demo processes.

**Evidence required:** `docs/reviews/step-63/evidence/` with descriptive image filenames, redacted/test-only accounts, route and response descriptions, test logs or command summaries, actual browser tool used and any NOT RUN aspect. Add a short manual owner reproduction recipe that does not require live Atlas or real identity credentials. No screenshot or test is a substitute for a real run.

---

## 12. Acceptance criteria, report and next-step handoff

| ID | Acceptance condition | Status at prompt creation |
|---|---|---|
| S63-01 | Authorized project viewer sees real recorded significant activities with truthful source classification | NOT RUN |
| S63-02 | Project, milestone, progress and dependency actions shown only when matching persisted evidence exists | NOT RUN |
| S63-03 | Chronological ordering/pagination stable, bounded and works across filters | NOT RUN |
| S63-04 | Server-enforced project and field-level RBAC; 401/403/404 and no PII/audit snapshots | NOT RUN |
| S63-05 | Planned dates, inferred lifecycle completion, bank payment and inspection claims never fabricated | NOT RUN |
| S63-06 | Distinct empty/partial/unavailable states; unknown audit types handled safely | NOT RUN |
| S63-07 | Premium responsive, keyboard accessible EN/SI/TA draft UI; no Connected Future changes | NOT RUN |
| S63-08 | Focused and full tests pass; Step 57–62 regressions preserved | NOT RUN |
| S63-09 | Real isolated browser demo with saved screenshots, URLs, HTTP evidence and owner instructions | NOT RUN |
| S63-10 | Accurate reports, preserved unrelated files, no unauthorized Git/Atlas/deployment actions | NOT RUN |

**Expected code deliverables:** minimal server policy/schema/service/routes, frontend page/client/API/localization, source-specific tests, isolated demo script if needed and correctly excluded from builds; two short review reports and actual evidence images. Avoid unneeded components and libraries.

**Recommended verdict:** APPROVE only if every P0 safety and material event-coverage criterion passes; REVISE for genuine fixable defects or incomplete coverage accepted by owner as partial; BLOCKED for unresolved access, provenance, audit integrity, upstream PR or database risks. Report **PASS / FAIL / BLOCKED / NOT RUN** for each item. Production readiness is a separate **BLOCKED** release gate regardless of feature approval.

### Risks that must remain explicit

- PR #109 (Steps 61–62) not yet merged at last verification; do not contaminate its feature branch or assume its CI proves integration.
- Production index verification and dependency graph partial unique index still pending Atlas migration review.
- Contractor authenticated user linkage and bank settlement provenance remain incomplete.
- Step 51 role-grant and agency-hierarchy concurrency races, null-agency Super Admin, real email service, staging cookie/origin verification, native Sinhala/Tamil copy sign-off, backup/monitoring and branch protection remain production blockers.
- Existing append-only audit logs are not necessarily comprehensive historical records; legacy and coverage gaps need truthful user-facing copy.
- Audit row `userId`, snapshots and sensitive reasons are not by themselves a safe project-facing activity response.

**Next roadmap:** **Step 64 — ProjectTrace Dashboard & KPIs**. Handoff should identify only **verified** Step 63 event types, the API contract, permission scope, pagination and available aggregate-safe data; do not implement Step 64 dashboard/KPIs or Step 65 notification/audit integration in this task.

---

## 13. Required Git checkpoint contract (development-team planning only)

G1—verify branches/untracked/dirty files and safely prepare one Step 63 feature branch; G2—stage exact owner-approved feature paths; G3—commit only with scoped owner authorization; G4—push only explicit feature destination with approval; G5—create a draft PR against `development` only with approval; G6—merge only with **separate owner approval**, all required checks passing, approved scope and clean integration. A single **explicit, scoped** owner approval may cover G1–G5, but never G6, production deployment, `main`, or unrelated changes. Full commands/checks appear in the accompanying Cursor Agent prompts. If local HEAD is an ancestor of `origin/development` after PR #109 merge, an approved in-place branch rename may avoid a risky dirty checkout; **verify this first**. Never `git reset`, `git clean`, `git stash`, force-push, rebase over dirty files, create worktrees, or touch `Documents`.
