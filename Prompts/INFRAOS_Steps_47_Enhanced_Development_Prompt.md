# INFRAOS — Step 47 of 190: User Profile & Account Settings
## Enhanced Development Prompt · 25 October 2026

**Product:** INFRAOS — National Infrastructure Intelligence & Coordination Platform  
**Vision:** *The Operating System for National Infrastructure*  
**Lifecycle:** Plan → Coordinate → Approve → Build → Verify → Monitor → Complete → Maintain  
**Repository:** https://github.com/divejikan-yuvarajah/InfraOS  
**Only working folder:** `C:\Users\ASUS\Desktop\InfraOS\InfraOS`  
**Base:** latest clean `development` after approval and safe synchronization  
**Feature branch:** `feature/identity-self-service-profile` (one branch, no worktrees)  
**Release:** `main` only with separate owner authorization  
**Step:** 47 — User profile and account settings  
**Companion:** `INFRAOS_Steps_47_Cursor_Agent_Execution_Prompts.md`

> **Roadmap fidelity:** The available INFRAOS Steps 15–50 planning index calls Step 47 “User profile and account settings,” with safe self-service projections and protection against privilege escalation through PATCH payloads. The original `Steps.docx` is not available for direct comparison. If Cursor finds it locally, reconcile its exact requirements before implementation; record any discrepancy rather than guessing. The minimal executable scope below is a security-preserving interpretation, not a verbatim quotation from that unavailable file.

---

## 1. Read-only repository audit and dependency gate

### GitHub state confirmed when drafted

| Reference | SHA prefix | Evidence |
|---|---|---|
| `development` | `d8e62de8526943e8` | PR #77 merge: Steps 45–46 authorization foundation |
| `main` | `ea7377a1e74509a7` | PR #78 merge: development released to main |
| `feature/auth-authorization-foundation` | `e71839e196843369` | Steps 45–46 implementation line |

GitHub is not the user's Windows checkout. Cursor must check local status, untracked changes and current remote before branching or editing. Do not assume the SHAs above remain current.

### Existing code and decisions to reuse

- Next.js 16 / React 19 / TypeScript / Tailwind v4 / shadcn UI / React Hook Form / Zod / TanStack Query; Express/TypeScript modular monolith, MongoDB/Mongoose, shared types.
- `apps/api/src/modules/identity/auth/require-authenticated.ts`: Bearer JWT verification, current user/role/agency checks, `credentialEpoch` comparison, verified `req.actor`.
- `apps/api/src/modules/identity/authorization/require-permission.ts`: live `Role.permissions` loaded from Mongo; exact `resource.action`, no JWT/body/seed grants. It is not a substitute for ownership.
- `apps/api/src/modules/identity/authorization/resource-scope.ts`: Step 46 resource predicates, deny-by-default. Profile ownership is simpler and strictly `req.actor.userId`.
- User schema: `firstName`, `lastName`, read-only `email`, `passwordHash`, `roleId`, `agencyId`, `status`, `emailVerified`, `credentialEpoch`, `lastLoginAt`, created/updated metadata, displayName virtual.
- Locked catalog: `profile.read`, `profile.update`; database permissions remain authoritative; no wildcard bypass.
- Existing `GET /api/v1/auth/me` is a *session identity* endpoint; do not change its contract or duplicate token-signing logic.
- `apps/web/src/lib/auth/{route-access,state,confirm-identity,refresh-flight}.ts`, `apps/web/src/components/auth/route-access-guard.tsx`: client-side UX guard, boot refresh, confirmed `/auth/me`, in-memory access JWT. `/profile` and `/settings` are recognized as **private** paths.
- `apps/web/src/lib/api/client.ts` attaches Bearer for authenticated calls; can retry safe GET/HEAD once; **must not replay PATCH**.
- Existing `apps/web/src/components/auth/workspace-home.tsx` is a narrow workspace shell with sign-out; add only minimal links to profile/settings.
- Existing profile pages and profile REST endpoints were **not observed** on the pushed `development` snapshot.

### Prior-step caveats

The committed Steps 45–46 report lists 269 API and 128 web tests passing at its own review point; those are *historical*, not Step 47 results. Review was same-agent rather than a human independent audit. The Step 45/46 helpers were tested through isolated harnesses; they were not broadly mounted on product endpoints. Step 47 should be the first narrowly scoped product integration of profile permissions.

**Carry forward unaltered:** prior Step 40–42 Atlas index proposals remain unapproved; `autoIndex` outside production may create indexes, so do **not** start `dev:api` against Atlas. Live recovery email is unavailable. No trusted Contractor↔User ownership mapping exists. Project `submittedBy` is absent and project approval segregation is not implemented. Super Admin conflict *read-only* is allowed when its stored role still grants the permission, but operational approve/pay/verify/resolve is denied. Do not modify the public landing to fix previously recorded Sinhala/Tamil mobile header overflow.

**Entry gate:** check `git status --short --branch`, `git branch -vv`, `git worktree list --porcelain`, current commit, untracked files and upstream. Preserve any local work. If the checkout is dirty or divergent, do not reset, stash, force checkout or discard without explicit approval.

---

## 2. Step 47 outcome and scope lock

The user must be able to:

1. Open `/profile` and view only their own safe authenticated account details.
2. Edit and persist *their own* first and last name using a real backend API with server validation and optimistic concurrency protection.
3. Open `/settings` for a useful account/security overview, working navigation to the existing password recovery and sign-out flows, and truthful status/availability messages.
4. Understand read-only fields such as account email, verification status, role, assigned agency, account status and last successful login if available.
5. Use a responsive, accessible design with English, Sinhala and Tamil presentation copy, noting any pending native-speaker review.

**Writable fields now: `firstName` and `lastName` only.** These are existing schema fields and do not need a new Mongo collection or index.

**Read-only / prohibited updates:** `userId`, `email`, `roleId`, `roleKey`, `permissions`, `agencyId`, `status`, `emailVerified`, `passwordHash`, `credentialEpoch`, session identifiers, audit ownership and created/updated actor data. Never turn a display-only role into a grant.

**Out of Step 47:** change email, new password-change API, email provider, account deletion, user creation/invite/disable, role and permission administration, agency management, profile photo uploads or cloud storage, admin profile editing, staff self-registration, consent/notification DB setting schemas not in the roadmap, and unrelated operational modules. Step 48 is admin user management; Steps 49–50 own agencies/roles. Existing forgot/reset-password and logout are valid security actions to link to.

If original `Steps.docx` expressly requires additional sensitive actions (e.g. authenticated password change), identify the exact requirement and request a security design/owner decision; do not silently invent a weak flow or claim completion of an omitted mandate.

**Functional bar:** no static profile pretending to load from Mongo; `/profile` needs a real authorized GET and PATCH, tests, and truthful UI states. If isolated live API cannot run, mark browser E2E appropriately BLOCKED, not PASS.

---

## 3. Authorization architecture

```text
Next.js /profile or /settings (Step 43 private client route)
  -> in-memory access JWT + safe apiClient
  -> GET or PATCH /api/v1/profile/me
  -> requireAuthenticated (Step 44: signature, issuer, audience, type, ce,
       ACTIVE verified account, active role and agency)
  -> requirePermission("profile.read" / "profile.update")
       (Step 45: current Role.permissions from Mongo, not seed/JWT/body)
  -> own-user profile service using req.actor.userId (Step 47)
  -> validated projection / atomic narrow update
  -> existing success/failure envelope with requestId, no-store
```

**Client-side guarding is user experience only.** The Express route must enforce Bearer authentication, current database permission and self-only authorization. Do not accept an arbitrary user ID in the URL, query string or body, and do not serialize a User document wholesale.

The profile endpoint may use `req.authUser` for a trusted identity summary, but must fetch the current own-user record for name and concurrency revision. It must not return tokens, password hashes, refresh families, verification challenges, all permissions, `credentialEpoch`, `__v` or internal sensitive fields. Private API responses should be `Cache-Control: no-store`, no session cookies.

**Profile async race:** if the user logs out or another user signs in while a request is pending, a stale response cannot re-populate private caches or update the newer user's UI. Snapshot auth epoch and subject at request start; ignore stale results, abort where practical, and rely on existing logout query-cache clearing. Avoid using `setAuthenticated` with an old session as a profile refresh.

---

## 4. Backend contract and concrete tasks

### 4.1 New protected endpoints

Use an identity-owned profile router such as `apps/api/src/modules/identity/profile/profile.routes.ts`, mounted at `/profile` inside the current `/api/v1` router. The final path naming can follow an existing verified convention, but do not create multiple duplicate routes.

| Method | Path | Middleware | Response |
|---|---|---|---|
| GET | `/api/v1/profile/me` | `requireAuthenticated`, `requirePermission("profile.read")` | 200 `success({ profile }, requestId)` |
| PATCH | `/api/v1/profile/me` | `requireAuthenticated`, `requirePermission("profile.update")` | 200 `success({ profile }, requestId)` |

Use the established envelope `success`/`failure`. Keep `GET /auth/me` working and unchanged.

### 4.2 Safe profile response

Recommended safe DTO:

```ts
type SelfProfileDto = {
  id: string;                 // own user id, already part of auth identity DTO
  firstName: string;
  lastName: string;
  displayName: string;        // derived from stored canonical names
  email: string;              // read-only work email
  emailVerified: true;
  status: "ACTIVE";
  roleKey: string;            // informational only
  agencyId: string | null;    // informational only
  lastLoginAt: string | null; // optional safe own-account metadata
  revision: number;           // public concurrency revision, NOT a raw DB field name
};
```

Use field projection and an explicit mapper. The example values shown in tests/docs are synthetic; a user-facing profile must never display hardcoded names as live data. Include an agency label only after verifying that the source is safe and does not bypass any agency read rules.

### 4.3 PATCH request and validation

Recommended strict JSON body:

```json
{ "firstName": "Nimal", "lastName": "Perera", "revision": 2 }
```

- Names: trim leading/trailing whitespace, minimum 1 and maximum 80 characters, reject control characters and all-whitespace inputs, preserve valid Unicode Sinhala/Tamil scripts. Align with `apps/api/src/modules/identity/registration.schema.ts`. Avoid ASCII-only validation and accidental truncation.
- `revision`: nonnegative safe integer, derived from an internal version/revision. Use a strict Zod object; never spread arbitrary request input to Mongo.
- Reject extra keys: email, role, permissions, userId, agencyId, status, verified flags, `passwordHash`, `credentialEpoch`, `$set`, `__proto__`, `updatedBy` and nested operator objects. Do not silently ignore attempted privileged fields.
- Use atomic compare-and-set update, e.g. `User.findOneAndUpdate` filtered by `_id: req.actor.userId`, revision and still-valid account/role/agency/credential epoch where practical, `$set` **only** names, `$inc` internal version, run validators, return updated document. Only server may set `updatedBy` to actor.
- If two requests submit the same revision, **at most one may succeed**; the other gets 409 and must reload newer data. Handle legacy `__v` absent/zero explicitly, with tests, or implement another equivalently robust optimistic lock.
- No-op PATCH can return unchanged data without revision increment, but it must be deliberate and tested.
- Important: valid ownership and permission are checked independently; obtaining a JWT for User A can never mutate User B's profile.
- Never rotate access/refresh tokens, change password hash or increment `credentialEpoch` for a name-only edit.

### 4.4 Error and privacy contract

| Condition | HTTP | Error code / behavior |
|---|---:|---|
| Missing/malformed/expired Bearer, old credential epoch, ineligible account | 401 | Current auth middleware (`AUTH_REQUIRED`/`SESSION_EXPIRED`) |
| Live Role lacks `profile.read` or `profile.update` | 403 | `FORBIDDEN` |
| Invalid JSON body, unexpected privileged field, invalid name/revision | 400 | `VALIDATION_ERROR` |
| Parallel stale revision | 409 | `CONFLICT` |
| Wrong content type for PATCH | 415 | `UNSUPPORTED_MEDIA` |
| Existing rate limit reached | 429 | `RATE_LIMITED` |
| Database/role service unavailable | 503 | `SERVICE_UNAVAILABLE` |
| Unsupported method/path | 404 | Normal API not-found |

Keep errors generic but actionable. All private responses must avoid caching. No JWT in URL, no refresh cookie set, no body/headers logged, no private DB values included in exception telemetry. Bearer is required; cookie alone does not authorize profile writes. Reuse current frontend origin/CORS and JSON limits, do not relax them.

### 4.5 Suggested implementation files (adapt to actual structure)

- `apps/api/src/modules/identity/profile/profile.schema.ts`
- `apps/api/src/modules/identity/profile/profile.service.ts`
- `apps/api/src/modules/identity/profile/profile.routes.ts`
- `apps/api/src/routes/v1.ts` (minimal mount)
- `apps/api/tests/profile-self-service.test.ts` (or existing test layout)
- A client-side profile transport in `apps/web/src/lib/profile/` or compatible existing location

No new vendor, database, indexes or mail service is required by these core changes.

---

## 5. Frontend UX and integration

### 5.1 Pages and navigation

Create `/profile` and `/settings` within existing Next.js App Router, e.g. `apps/web/src/app/{profile,settings}/page.tsx`. Set `robots: { index: false, follow: false }`. Reuse the existing auth `RouteAccessGuard`, layout/providers and in-memory session bootstrap, not a new cookie proxy or SSR token parsing approach. Profile data is fetched only after identity confirmation; SSR HTML should contain at most a generic safe shell.

Add minimal Profile and Settings links to the existing internal workspace/home. Maintain existing sign-out and safe login redirect. Do not build an entire admin or operational sidebar prematurely.

**Do not create `/si/profile` or `/ta/profile` as private routes without changing and proving route classification:** currently paths under `/si`/`/ta` are treated as public by the private-path classifier. Prefer an in-page language presentation option on the protected `/profile` and `/settings` routes; verify protection remains in place.

### 5.2 Real profile screen

Premium account summary showing display name, current role and agency if safe; readonly email and verification status; first-name and last-name inputs; Save and Cancel; errors and success; current revision tracked invisibly; on 409 offer a safe Reload current profile action, do not overwrite unsaved changes without notice.

Use React Hook Form and Zod patterns already installed. Disable repeat submission while in flight; prevent false “Saved” toast when no request succeeded. On 503 show retry without clearing valid user input. On 401 use established session-expired experience; on 403 show a non-leaking access-denied state. GET may safely attempt refresh once; PATCH should not be automatically retried.

### 5.3 Real account settings screen

Provide a useful security/account overview (not a blank placeholder): read-only email and verified status, organization context if available, last sign-in indicator if safe, direct navigation to the existing password recovery and sign-out flows, plus a short university-demo/non-live-email notice where relevant. Do not add a pretend persisted preferences switch. If a locale display selector is built, label it explicitly as view-only unless actual approved persistence exists. No “Delete account”, unrestricted “Change role” or new password-change flow under this step.

### 5.4 Colors, typography, accessibility, localization

**Locked INFRAOS flag-inspired tokens:**

| Role | Color |
|---|---|
| Primary/CTA orange | `#FF5B00` |
| Focus/accent yellow | `#FEB600` |
| Institutional maroon | `#8C1F28` |
| Positive success green | `#279541` |

Use Sora display, DM Sans UI, Noto Sinhala and Noto Tamil; existing design tokens, shadcn UI and scoped private styling. Neutral/slate background, readable dark text, purposeful dividers/cards, visible 2px keyboard focus, correct color contrast; no false official government seals or excessive graphic effects. Ensure 320, 360, 390, 768, 1024 and 1440 viewport usability.

Required accessibility: semantic headings, `<label>` per input, focus/error summary, `aria-invalid` and descriptive errors, accessible status announcements and submitting state, large enough touch targets, keyboard-only operation, reduced motion. Translate all visible labels and error descriptions into English/Sinhala/Tamil draft strings without inventing native-speaker verification. Never modify marketing `/`, `/si`, `/ta` pages as a side effect.

---

## 6. Efficient one-run implementation plan

This is a **single Cursor implementation prompt**, not eight separate prompts:

1. Inventory branch, dirty/untracked files and previous-step report. Compare original `Steps.docx` if available. Record concise preflight.
2. Inspect all actual auth, Role, User, routing, frontend state and UI components needed. Confirm product code is on current branch.
3. Establish safe DTO, strict PATCH schema, optimistic-revision semantics and error envelope.
4. Add protected GET/PATCH routes with actor-only selection, current permission checks, projection and atomic name edit.
5. Add focused API tests including concurrent writes, denied grants, bad payloads and field invariants.
6. Build premium `/profile` + `/settings` pages, typed API client, safe private cache handling, English/Sinhala/Tamil copy and accessible states.
7. Add focused web and auth-race regression tests, fix actual implementation issues and rerun focused tests.
8. Write a concise preflight and verification report. Stop at **Step 47 implemented, pending final review**; the combined phase testing is a separate **single** prompt run.

**Branch operations:** create or reuse `feature/identity-self-service-profile` only from a safe verified development state. No new worktrees or physical step folders. Never overwrite dirty work merely to change branch.

---

## 7. Required test matrix

### API/security (isolated Mongo test DB)

| ID | Scenario | Acceptance |
|---|---|---|
| 47-A01 | GET absent, malformed or expired JWT / old `credentialEpoch` | 401; no private body |
| 47-A02 | Active, verified user with `profile.read` | 200; own safe DTO |
| 47-A03 | Remove live role `profile.read`, JWT unchanged | 403 on subsequent GET |
| 47-A04 | Has read but lacks update (and vice versa) | Correct permission checked on respective endpoint |
| 47-A05 | Valid self PATCH and GET again | Names persist, derived display name, revision increments |
| 47-A06 | Two concurrent PATCH with same revision | One success, one 409, no lost update |
| 47-A07 | Missing, invalid or stale revision | 400 or 409 as specified; no unsafe overwrite |
| 47-A08 | Body tries email/role/agency/status/permission/password/verified/epoch modification | 400; stored values untouched |
| 47-A09 | Query/body/path user-id spoof; Mongo operator pollution | No cross-user read/write |
| 47-A10 | Unicode Sinhala/Tamil names; leading/trailing spaces; empty/overlong/control chars | Valid text round-trips, invalid rejected |
| 47-A11 | User disabled/unverified, role/agency inactive | 401 and no write |
| 47-A12 | Role or DB query unavailable | 503, no internal error details |
| 47-A13 | Wrong PATCH content type / extra fields / wrong method | 415/400/404 as appropriate |
| 47-A14 | Response projection | No passwordHash, token, credentialEpoch, hidden metadata or permissions |
| 47-A15 | Previous login/refresh/logout/reset/Step45/Step46 tests | No regression |
| 47-A16 | Legacy absent/zero Mongoose version if relevant | Correct compare-and-set behavior |

### Web/client

- Signed out `/profile` and `/settings`: no private SSR data and correct login or retry pathway.
- Signed in: GET profile real data, edit valid name, save, reload persists; safe form no fake save.
- 400, 401, 403, 409, 429, 503: unique accessible states; conflict can reload without privilege bypass.
- Logout or account switch while GET/PATCH pending: old response ignored; previous account details cannot reappear using Back.
- Access token never goes to localStorage/sessionStorage; no identity fields in URLs or public HTML; no PATCH auto-replay.
- Mobile/desktop widths, keyboard/focus, reduced motion, contrast and EN/SI/TA text.
- Regression `/`, `/si`, `/ta`, `/about`, `/login`, `/dashboard`, `/forgot-password`, `/reset-password`.
- Browser responses created with network stubs are **FIXTURE evidence**, not a live API E2E pass.

### Final full-suite commands (run once in the final phase review)

```powershell
npm run test:api
npm run test:web
npm run type-check
npm run lint
npm run build
git diff --check
git status --short
```

Review **untracked files** separately: `git diff --check` does not cover them. Record exit codes, real counts and the preexisting lint warning accurately. Fix genuine Step 47 bugs and rerun affected suites; never skip tests to get a green result.

---

## 8. Security review, acceptance gate and owner demonstration

### 8.1 Critical security invariants

- Current-role `profile.read` / `profile.update` grants are checked on every request; no JWT/body/seed bypass.
- Profile GET/PATCH selects only authenticated `req.actor.userId`; no `/:id` admin route.
- Strict PATCH allowlist and atomic revision check protect against vertical escalation and silent concurrent overwrite.
- Identity state, verified email, role, agency, password, `credentialEpoch` and sessions remain untouched on name update.
- No-cache safe profile response and no PII/token leakage in logging/browser storage/SSR.
- Client guards are UX only; backend remains authoritative.
- Public landing and `Documents` are unchanged.
- No live Atlas test records, auto-created indexes or provider setup.

### 8.2 Manual owner demo — isolated environment only

1. Verify the API test target is a disposable isolated MongoDB environment, **not Atlas**. Do not start `dev:api` if its environment points to Atlas and indexes are unapproved.
2. Open `/profile` signed out; no identity data should render. Observe 401 redirect or 503 retry, as appropriate.
3. Sign in using a synthetic active staff fixture and approved local auth secrets. Open `/profile`; verify real own details.
4. Edit first/last name, Save; refresh to confirm persistence. Check read-only role, agency and work email.
5. Attempt direct PATCH with `{ roleKey: "SUPER_ADMIN", emailVerified: true }`, another `userId`, or `$set`; confirm 400 and unchanged database.
6. Remove `profile.update` from the synthetic Role and attempt Save; see 403. GET may still work if `profile.read` remains.
7. Trigger concurrent edits using same revision; one request must be 409. Confirm 401 expired session and 503 dependency failure handling.
8. Logout; Back must not reveal cached profile, and another user must not see the previous one.
9. Verify `/settings` actions, EN/SI/TA copy, mobile 320px and keyboard. Check the public landing still renders unchanged.

If live integration cannot be demonstrated safely, record BLOCKED/NOT RUN. Never call a fake fixture a live mail delivery or live staff login.

### 8.3 Acceptance checklist

| Criterion | Required |
|---|---|
| Real own-profile GET, safe projection and current DB permission | PASS |
| Real own-profile PATCH, whitelist and optimistic concurrency | PASS |
| All escalation, session expiry and cross-user tests | PASS |
| `/profile` and `/settings` function behind existing private guard | PASS |
| Responsive accessible UI, EN/SI/TA draft support | PASS |
| Existing authentication and RBAC regression | PASS |
| No unapproved Atlas/index/secrets/public changes | PASS |
| Overall phase report and separate Git approvals | PASS |

Report `APPROVE`, `REVISE` or `BLOCKED`, with every test/check marked `PASS`, `FAIL`, `BLOCKED` or `NOT RUN`. Same-agent review must explicitly say it is *not* independent human signoff.

---

## 9. Documentation, environment, Git governance and handoff

**Minimum documents:** `docs/reviews/step-47/PRE-IMPLEMENTATION-AUDIT.md` and `docs/reviews/step-47/END-OF-STEP-VERIFICATION.md`. Keep them concise and factual: baseline, files, risk decisions, API/UX contract, tests, actual browser proof, blockers, release gate and Step 48 handoff. Update an existing API endpoint catalog only if required. No unnecessary reports.

**Environment:** no new external service, email vendor, storage provider or API key is expected. Reuse the verified API URL, `FRONTEND_ORIGIN`, current secrets and Mongo test setup. Do not print or commit `.env`. No new Mongo index should be required for names.

**Only folder:** `C:\Users\ASUS\Desktop\InfraOS\InfraOS`. Never touch `Documents`. No new worktrees or `InfraOS-step47` folder.

**Approval-controlled Git flow:** inspect local branch/changes; create/reuse feature branch safely after explicit authorization to start; implement and run focused tests; run **one** final combined review; stop. Then propose, but do not execute without distinct owner approval, scoped staging and `git commit -m "feat(identity): add secure self-service profile and account settings"`, `git push -u origin feature/identity-self-service-profile`, a PR feature→`development`, its merge after review, and a **separate** approved promotion `development`→`main`. Never imply automated Git approval from passing tests. Exclude prompt files, `.env`, private screenshots and unrelated files from staged changes.

**Step 48 handoff:** administrator user management must use separate `user.*` permissions, tenant/resource scope and audit; Step 47 never grants self-service management of roles, agencies, status, other users or verification.

### Referenced source paths

- `docs/reviews/steps-45-46/END-OF-PHASE-VERIFICATION.md`
- `docs/security/{permission-catalog,route-access-policy,roles-and-permissions,resource-authorization}.md`
- `apps/api/src/{routes/v1.ts,modules/identity/auth/require-authenticated.ts,modules/identity/authorization/require-permission.ts,modules/identity/models/user.model.ts}`
- `apps/web/src/{lib/auth/route-access.ts,lib/auth/state.ts,lib/api/client.ts,components/auth/route-access-guard.tsx,components/auth/workspace-home.tsx}`
- `package.json` and `apps/web/package.json`
- Secondary planning index `INFRAOS_Cursor_Grok_Composer_Model_Plan_Steps_15_to_50.md`; original `Steps.docx` not inspected.

**End of Development Specification. No project code was implemented by generating this file.**
