# INFRAOS — Enhanced Cursor Prompts
## Steps 7–9: Repository Initialization, Next.js Frontend Foundation, Express Backend Foundation

**Project:** INFRAOS — National Infrastructure Intelligence & Coordination Platform  
**Vision:** The Operating System for National Infrastructure  
**Core Lifecycle:** Plan → Coordinate → Approve → Build → Verify → Monitor → Complete → Maintain  
**Development Window:** 45–60 days  
**Primary Development Assistant:** Cursor AI  

---

# HOW TO USE THIS FILE

Execute in order:

1. **Step 7 — Initialize Full Project Repository**
2. **Step 8 — Configure Next.js Frontend Foundation**
3. **Step 9 — Configure Express Backend Foundation**

For every step:

- Follow `CURSOR_STEP_EXECUTION_RULES.md` if present.
- Inspect the repository and previous Steps 1–6 documentation first.
- Perform a PRE-STEP REVIEW.
- Implement only the requested step.
- Run relevant lint/type-check/test/build checks.
- Perform a POST-IMPLEMENTATION REVIEW.
- Fix issues introduced by the step.
- Re-run checks.
- Update documentation.
- Review `git status` and `git diff`.
- Stop before the next step.

## Scope Boundary

Steps 7–9 establish only:

```text
Repository / Workspace
+
Next.js Frontend Foundation
+
Express Backend Foundation
```

Do **NOT** prematurely implement:

- MongoDB connection or Mongoose models
- authentication or RBAC
- ProjectTrace
- RoadSync
- InfraMap business features
- DocTrace / RAG
- AI Risk
- storage
- Socket.IO
- deployment
- complete design system

---

# LOCKED ARCHITECTURE

```text
Next.js + TypeScript
        ↓
Node.js + Express + TypeScript
        ↓
Business Modules
        ↓
MongoDB / Storage / GIS / FastAPI AI
```

Initial architecture is a **modular monolith with one dedicated AI service**.

Avoid unnecessary microservices, Kafka, Kubernetes, multiple application databases, or event architecture.

---

# LOCKED INFRAOS BRAND FOUNDATION

Sri Lankan national-flag-inspired colors:

```text
Primary Orange    #FF5B00
Primary Yellow    #FEB600
Primary Maroon    #8C1F28
Primary Green     #279541

Background        #F8FAFC
Surface           #FFFFFF
Primary Text      #111827
Secondary Text    #475569
Muted Text        #64748B
Border            #E2E8F0
Dark Surface      #111827
```

Semantic intent:

```text
Orange  → primary action / active state
Yellow  → warning / pending / attention
Maroon  → critical / conflict / rejected / high risk
Green   → success / completed / resolved / healthy
```

Use mostly neutral surfaces. Do not create a rainbow dashboard.

---

# STEP 7 — INITIALIZE FULL PROJECT REPOSITORY

## CURSOR AGENT PROMPT

Act as a Senior Software Architect, Monorepo Engineer, DevOps Engineer, Technical Lead, Repository Maintainer, and Code Quality Engineer.

Perform **Step 7 — Initialize Full Project Repository**.

The goal is to build a clean, professional, team-friendly repository foundation without prematurely implementing application features.

## 1. PRE-STEP REVIEW

Inspect:

```text
/
package.json
lockfiles
.gitignore
.editorconfig
README.md
CONTRIBUTING.md
.github/
docs/
apps/
packages/
src/
```

Run:

```bash
git status
git branch --show-current
git branch
git remote -v
```

Read:

```text
/docs/planning/
/docs/architecture/
/docs/security/
/docs/ux/
/docs/team/
/docs/adr/
```

Return:

```text
STEP 7 PRE-REVIEW

Current Repository State:
Current Branch:
Existing Package Manager:
Existing Applications:
Existing Workspace Structure:
Existing Docs:
Existing Git Configuration:
Potential Conflicts:
Files/Folders That Must Be Preserved:

Implementation Plan:
1.
2.
3.
...
```

Do not assume the repository is empty.

## 2. PACKAGE MANAGER

Use the package manager already established.

Decision order:

1. Existing valid lockfile → preserve that package manager.
2. No package manager established → use **npm workspaces**.
3. Never create multiple lockfiles.

Do not switch to pnpm/Yarn simply by preference.

## 3. ROOT STRUCTURE

Normalize toward:

```text
infraos/
├── apps/
│   ├── web/
│   ├── api/
│   └── ai-service/
├── packages/
│   └── shared-types/
├── docs/
│   ├── planning/
│   ├── architecture/
│   ├── security/
│   ├── ux/
│   ├── team/
│   ├── api/
│   ├── database/
│   ├── testing/
│   └── adr/
├── .github/
├── .gitignore
├── .editorconfig
├── .env.example
├── CONTRIBUTING.md
├── README.md
└── package.json
```

Rules:

- Preserve approved documentation.
- Do not create empty future feature folders.
- `apps/web` is configured in Step 8.
- `apps/api` is configured in Step 9.
- `apps/ai-service` remains documentation-only for now.
- Do not create business modules.

## 4. ROOT WORKSPACE

If npm workspaces are used, configure root package metadata intentionally:

```json
{
  "name": "infraos",
  "private": true,
  "workspaces": [
    "apps/web",
    "apps/api",
    "packages/*"
  ]
}
```

Do not include the Python AI service as an npm workspace.

Do not create root scripts pointing to nonexistent child scripts.

## 5. VERSION POLICY

Use a stable LTS Node version compatible with the chosen Next.js and Express toolchain.

If already pinned, preserve it unless incompatible.

Document chosen:

```text
Node:
npm:
Python: later
```

Do not configure Python dependencies yet.

## 6. `.gitignore`

Ensure coverage for:

```text
node_modules/
.next/
dist/
build/
coverage/

.env
.env.local
.env.*.local

*.log

.DS_Store
Thumbs.db

.idea/
.vscode/*
!.vscode/extensions.json
!.vscode/settings.json

__pycache__/
*.py[cod]
.venv/
venv/
.pytest_cache/
.mypy_cache/

playwright-report/
test-results/
```

Do not ignore:

```text
.env.example
docs/
source code
package-lock.json
```

## 7. `.editorconfig`

Use a lightweight cross-team policy:

- UTF-8
- LF
- final newline
- trim trailing whitespace
- 2 spaces for JS/TS/JSON/Markdown as appropriate
- Python can use 4 spaces later

Do not conflict with formatter behavior.

## 8. SAFE `.env.example`

Create only placeholders:

```text
NODE_ENV=
NEXT_PUBLIC_API_BASE_URL=
PORT=
CLIENT_URL=
MONGODB_URI=
JWT_SECRET=
REFRESH_SECRET=
AI_SERVICE_URL=
AI_SERVICE_SECRET=
NEXT_PUBLIC_MAP_STYLE_URL=
STORAGE_PROVIDER=
```

No real values. No real keys.

Never expose secrets using `NEXT_PUBLIC_*`.

Full env validation belongs to Step 10.

## 9. README / DOC INDEX

Update root README with:

- project name
- short purpose
- lifecycle
- architecture summary
- repository structure
- current development status
- prerequisites
- documentation link
- branch strategy summary

Create/update:

```text
/docs/README.md
```

Index planning, architecture, security, UX, team, API, database, testing, and ADR docs.

## 10. CONTRIBUTING / GITHUB

Preserve Step 6 `CONTRIBUTING.md`.

Preserve/create:

```text
.github/pull_request_template.md
```

Do not replace project-specific rules with generic boilerplate.

Do not implement full CI yet.

## 11. `packages/shared-types`

Create only a minimal foundation if needed:

```text
packages/shared-types/
├── README.md
└── package.json / src/index.ts only if required by workspace tooling
```

README rule:

> Only genuinely shared cross-app TypeScript contracts belong here. Do not dump every type into this package.

Do not define User/Project/Conflict schemas yet.

## 12. `apps/ai-service`

At most create:

```text
apps/ai-service/README.md
```

Describe future scope:

- risk analysis
- document processing
- embeddings
- RAG
- optional vision

Do not install FastAPI or AI SDKs yet.

## 13. SECURITY / SECRET REVIEW

Search for likely secrets without printing their values.

Look for:

```text
API_KEY
SECRET
PASSWORD
TOKEN
PRIVATE_KEY
MONGODB_URI
```

If real secrets appear:

- identify file only
- do not expose value
- recommend rotation
- migrate toward env vars

## 14. REPOSITORY QUALITY REVIEW

Check for:

- duplicate lockfiles
- nested `.git`
- duplicate root configs
- abandoned app folders
- misplaced docs
- committed build output
- temporary debug files

Do not delete uncertain files without understanding them.

## 15. VALIDATION

Run appropriate checks:

```bash
node --version
npm --version
```

If safe:

```bash
npm install
```

Validate workspace syntax, README links, `.gitignore`, and Git status.

Do not claim frontend/backend build success before Steps 8/9.

## 16. POST-STEP REVIEW

Report and fix issues:

```text
STEP 7 POST-REVIEW

Repository Structure:
Package Manager:
Workspace Validity:
Documentation Preserved:
Git Rules Preserved:
Secret Scan:
Duplicate Configs:
Broken Scripts:
Unnecessary Files:
Issues Found:
Issues Fixed:
Known Limitations:
```

## 17. FINAL DIFF REVIEW

Run:

```bash
git status
git diff
```

Confirm:

- no secrets
- no unrelated deletion
- no feature code
- no second lockfile
- no broken script
- no rewritten Git history

## 18. FINAL REPORT

```text
STEP 7 COMPLETE
Initialize Full Project Repository

STATUS:
PACKAGE MANAGER:
FILES CREATED:
FILES MODIFIED:
WORKSPACE STRUCTURE:
SECURITY / SECRET REVIEW:
VALIDATION:
DOCUMENTATION:
GIT STATUS:
KNOWN LIMITATIONS:
NEXT:
Step 8 — Configure Next.js Frontend Foundation
```

## 19. ACCEPTANCE CRITERIA

Step 7 is complete only if:

- repository structure is clean
- approved docs remain
- one package manager is used
- root workspace is valid
- `.gitignore` is safe
- `.env.example` has no secret
- docs index exists
- CONTRIBUTING/PR rules remain
- no frontend/backend feature implementation was introduced
- no Git history rewrite / force push / unrequested merge occurred

Stop after Step 7.

---

# STEP 8 — CONFIGURE NEXT.JS FRONTEND FOUNDATION

## CURSOR AGENT PROMPT

Act as a Senior Next.js Engineer, React Architect, TypeScript Engineer, Frontend Platform Engineer, UI Systems Engineer, Accessibility Engineer, Frontend Security Reviewer, and QA Engineer.

Perform **Step 8 — Configure Next.js Frontend Foundation**.

Do not build final landing pages, dashboards, authentication screens, or feature pages yet.

## 1. PRE-STEP REVIEW

Inspect:

```text
/apps/web
root package.json
lockfile
tsconfig files
eslint config
formatter config
tailwind/postcss config
/docs/architecture/frontend-architecture.md
/docs/ux/
/docs/security/
/docs/team/
```

Return:

```text
STEP 8 PRE-REVIEW

Existing Frontend:
Next.js Version:
React Version:
TypeScript:
Styling:
Existing Routes:
Existing Components:
Existing Dependencies:
Potential Conflicts:

Implementation Plan:
1.
2.
3.
...
```

Do not recreate a working frontend.

## 2. INITIALIZE / NORMALIZE NEXT.JS

If missing, initialize `apps/web` with:

- Next.js
- React
- TypeScript
- App Router
- ESLint
- Tailwind CSS / supported styling setup
- `src/`
- import alias

Use a stable supported release.

Avoid experimental flags unless required.

If app exists, normalize safely.

## 3. DIRECTORY FOUNDATION

Target:

```text
apps/web/
├── public/
├── src/
│   ├── app/
│   ├── components/
│   │   ├── ui/
│   │   ├── common/
│   │   ├── feedback/
│   │   └── layout/
│   ├── features/
│   ├── hooks/
│   ├── lib/
│   ├── services/
│   ├── types/
│   ├── styles/
│   └── config/
├── package.json
├── tsconfig.json
└── next.config.*
```

Do not create every future feature folder empty.

## 4. APP ROUTER BASE

Create only the useful foundation:

```text
src/app/
├── layout.tsx
├── page.tsx
├── globals.css
├── loading.tsx      if useful
└── not-found.tsx    if useful
```

Do not create every planned route yet.

## 5. ROOT LAYOUT

Responsibilities:

- `<html>` and language
- metadata
- global styles
- optimized font
- provider composition
- accessible body structure

Metadata:

```text
Title: INFRAOS
Description: National Infrastructure Intelligence & Coordination Platform
```

Do not add protected sidebar or role logic yet.

## 6. TYPOGRAPHY FOUNDATION

Use Inter or Geist according to approved architecture.

Use Next font optimization if appropriate.

Create token-ready CSS variables.

Do not implement the complete Step 18 typography system yet.

## 7. BRAND TOKEN FOUNDATION

Add:

```text
--infra-orange: #FF5B00;
--infra-yellow: #FEB600;
--infra-maroon: #8C1F28;
--infra-green: #279541;

--background: #F8FAFC;
--surface: #FFFFFF;
--text-primary: #111827;
--text-secondary: #475569;
--text-muted: #64748B;
--border: #E2E8F0;
```

Use neutrals for most surfaces.

Step 17 will expand the full design system.

## 8. DARK MODE

Dark mode is P2.

Do not spend significant time on it.

If default variables exist, keep them sane but defer polish.

## 9. SHADCN/UI FOUNDATION

Configure shadcn/ui if approved and compatible.

Set:

- aliases
- CSS variable integration
- component path

Install only a small useful base set if necessary, e.g.:

```text
Button
Input
Card
Badge
```

Do not install the entire component catalog.

## 10. UTILITY FUNCTION

If required by shadcn, create one `cn()` utility.

Do not duplicate class utilities.

## 11. TANSTACK QUERY FOUNDATION

If locked in architecture:

- install/configure TanStack Query
- create a client provider
- compose it cleanly for App Router
- use sensible defaults
- do not fetch feature data yet

Potential:

```text
components/providers/query-provider.tsx
components/providers/app-providers.tsx
```

## 12. ZUSTAND

Do not create fake global state.

Install/use only if the current architecture requires it at this foundation stage.

Document intended future use:

- sidebar
- map UI state
- local preferences

Never duplicate server state.

## 13. FORM FOUNDATION

Prepare:

- React Hook Form
- Zod
- resolver package if needed

Do not create auth/project forms yet.

Do not create fake example schemas.

## 14. API CLIENT FOUNDATION

Create a minimal typed API access layer.

Requirements:

- API base URL from env
- no scattered hardcoded localhost URLs
- normalized errors
- future credentials/cookie compatibility
- no auth-refresh implementation yet
- no feature clients yet

Potential location:

```text
src/lib/api/
```

or:

```text
src/services/api/
```

Choose one convention and document it.

## 15. FRONTEND ENV RULE

Allowed public config:

```text
NEXT_PUBLIC_API_BASE_URL
```

Never expose:

```text
JWT_SECRET
REFRESH_SECRET
MONGODB_URI
AI_SERVICE_SECRET
STORAGE_SECRET
```

Full env management comes in Step 10.

## 16. PROVIDER ARCHITECTURE

Only include providers required now.

Do not create empty wrappers for future auth/theme/toast providers.

## 17. MINIMAL TEMPORARY HOME

Build a simple foundation page proving frontend health:

```text
INFRAOS
National Infrastructure Intelligence & Coordination Platform

Foundation initialized successfully.
```

Optionally show lifecycle:

```text
Plan → Coordinate → Approve → Build → Verify → Monitor → Complete → Maintain
```

Use restrained flag-inspired accents.

Do not build final landing page.

## 18. ACCESSIBILITY FOUNDATION

Verify:

- semantic headings
- keyboard use
- focus visibility
- contrast
- meaningful metadata
- reduced-motion readiness
- no fake clickable divs

## 19. SECURITY FOUNDATION

Check:

- no secret in browser bundle
- no dangerous HTML use
- no hardcoded auth role assumptions
- no client-only security claims
- safe external links

## 20. TYPESCRIPT

Prefer strict TypeScript.

Do not disable strict mode to make compilation easier.

Avoid `any` unless genuinely necessary.

## 21. LINT / FORMAT

Normalize ESLint and existing formatter.

Do not blanket-disable rules.

Avoid ESLint/Prettier conflicts.

## 22. SCRIPTS

`apps/web/package.json` must provide working:

```text
dev
build
start
lint
type-check
```

Only add test script when a test framework actually exists.

At root, add working helpers such as:

```text
dev:web
build:web
lint:web
type-check:web
```

## 23. FRONTEND DOCUMENTATION

Create/update concise docs such as:

```text
/docs/frontend/setup.md
/docs/frontend/conventions.md
```

or equivalent existing architecture paths.

Document:

- run commands
- folder responsibilities
- server/client component rules
- API client convention
- style tokens
- env rules
- component rules

## 24. RUN CHECKS

Run appropriate commands:

```bash
npm install
npm run lint
npm run type-check
npm run build
```

Verify dev server can start.

## 25. POST-IMPLEMENTATION REVIEW

```text
STEP 8 POST-REVIEW

Next.js:
TypeScript:
Tailwind/Styling:
Brand Token Foundation:
shadcn:
Query Provider:
Forms/Validation:
API Client Foundation:
Accessibility:
Security:
Responsive Foundation:
Lint:
Type Check:
Build:
Issues Found:
Issues Fixed:
Known Limitations:
```

Fix issues caused by this step and re-run checks.

## 26. GIT REVIEW

Run:

```bash
git status
git diff
```

Confirm:

- no secrets
- no final feature pages
- no auth
- no DB
- no giant dependency set
- no unrelated rewrites

## 27. FINAL REPORT

```text
STEP 8 COMPLETE
Configure Next.js Frontend Foundation

STATUS:
FRONTEND STACK:
FILES CREATED:
FILES MODIFIED:
DEPENDENCIES ADDED:
BRAND FOUNDATION:
ENV VARIABLES:
CHECKS:
  Lint:
  Type Check:
  Build:
  Manual Start:
SECURITY REVIEW:
ACCESSIBILITY REVIEW:
KNOWN LIMITATIONS:
NEXT:
Step 9 — Configure Express Backend Foundation
```

## 28. ACCEPTANCE CRITERIA

Complete only if:

- Next.js runs
- TypeScript strict works
- styling works
- brand token foundation exists
- root layout is clean
- temporary page works
- API base URL is not hardcoded throughout code
- no browser secrets exist
- shadcn setup is minimal/sane if used
- TanStack Query foundation exists if selected
- lint passes
- type-check passes
- build passes
- no business feature is implemented

Stop after Step 8.

---

# STEP 9 — CONFIGURE EXPRESS BACKEND FOUNDATION

## CURSOR AGENT PROMPT

Act as a Senior Node.js Engineer, Express Architect, TypeScript Backend Engineer, API Architect, Security Engineer, Observability Engineer, QA Engineer, and Technical Lead.

Perform **Step 9 — Configure Express Backend Foundation**.

Do not connect MongoDB yet.

Do not implement authentication, RBAC, ProjectTrace, RoadSync, or AI endpoints yet.

Build the backend platform plus a minimal health endpoint.

## 1. PRE-STEP REVIEW

Inspect:

```text
/apps/api
root package.json
workspace config
tsconfig
existing server files
/docs/architecture/backend-architecture.md
/docs/architecture/system-architecture.md
/docs/security/
/docs/api/
/docs/team/
```

Return:

```text
STEP 9 PRE-REVIEW

Existing Backend:
Express:
TypeScript:
Existing Routes:
Existing Middleware:
Existing Error Handling:
Existing Logging:
Potential Conflicts:

Implementation Plan:
1.
2.
3.
...
```

## 2. INITIALIZE / NORMALIZE API

Use:

- Node.js
- Express
- TypeScript

Choose ESM/CommonJS consistently.

Do not mix module systems unpredictably.

## 3. DIRECTORY FOUNDATION

Target:

```text
apps/api/
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── config/
│   ├── middleware/
│   ├── modules/
│   ├── routes/
│   ├── shared/
│   ├── types/
│   └── utils/
├── tests/
├── package.json
└── tsconfig.json
```

Do not create every future module empty.

Only a health module is appropriate now.

## 4. `app.ts` / `server.ts` SEPARATION

`app.ts`:

- create Express app
- register middleware
- register API routes
- register 404 handler
- register error handler

`server.ts`:

- load config
- start HTTP server
- startup logging
- graceful shutdown hooks

This makes testing easier.

## 5. API BASE

Use:

```text
/api/v1
```

Health:

```text
GET /api/v1/health
```

Optionally expose `/health` for infrastructure monitoring only if documented.

No feature routes yet.

## 6. HEALTH ENDPOINT

Safe example:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "infraos-api",
    "timestamp": "ISO_TIMESTAMP"
  }
}
```

Do not include env values, secrets, paths, memory dumps, or DB status before DB exists.

## 7. STANDARD API RESPONSE

Success:

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Safe message",
    "details": null
  }
}
```

`meta` may be omitted when irrelevant.

## 8. APP ERROR FOUNDATION

Create a small typed `AppError` abstraction with useful fields such as:

```text
statusCode
code
message
details
isOperational
```

Avoid deep error-class hierarchies.

## 9. CENTRAL ERROR HANDLER

Requirements:

- known errors → safe structured response
- unknown errors → internal log
- proper status
- no production stack trace
- no secrets
- no raw DB details
- no internal paths

## 10. API 404

Unknown API route returns structured JSON, e.g.:

```text
ROUTE_NOT_FOUND
```

Never return an HTML error page for API routes.

## 11. REQUEST / CORRELATION ID

Use a lightweight request ID if practical.

Include in structured logs.

Avoid heavy distributed tracing.

## 12. LOGGING

Use the logger selected in architecture (e.g. Pino if not otherwise locked).

Log useful fields:

```text
method
path
status
duration
requestId
```

Do not globally log:

- passwords
- tokens
- Authorization header
- cookies
- full request bodies

Avoid uncontrolled `console.log`.

## 13. BASIC SECURITY MIDDLEWARE

Configure baseline protection:

- Helmet
- safe CORS
- body size limits
- `x-powered-by` disabled

Do not treat Step 9 as the final security hardening step.

## 14. CORS

Use config-driven client origin.

Expected later:

```text
CLIENT_URL
```

Design for future credentialed cookies:

```text
credentials: true
```

Never use wildcard origin together with credentials in production.

## 15. REQUEST SIZE

Set a reasonable JSON body limit.

File uploads will later use dedicated handling.

## 16. CONFIG FOUNDATION

Centralize:

```text
NODE_ENV
PORT
CLIENT_URL
LOG_LEVEL
API_PREFIX
```

Do not scatter `process.env` through code.

Do not consume DB/JWT/AI secrets before their steps.

Step 10 will implement full env validation.

## 17. VALIDATION FOUNDATION

Use architecture-approved validation (likely Zod).

Create reusable middleware capable of validating:

```text
body
params
query
```

Do not create future Project/Auth schemas yet.

## 18. ASYNC ERROR BEHAVIOR

Use the chosen Express version correctly.

If async errors are natively supported, do not add unnecessary error packages.

Document the approach.

## 19. ROUTER ORGANIZATION

Create central router mounting:

```text
/api/v1
```

Mount health only.

Do not create placeholder future endpoints.

## 20. HEALTH MODULE

Keep health implementation appropriately simple.

Do not create empty repository/service layers just for ceremony.

Architecture rule:

> Use layers when they add responsibility, not because a diagram contains them.

## 21. TYPESCRIPT

Use strict TypeScript.

Avoid `any`.

Use aliases only if they improve clarity.

## 22. BUILD / DEV STRATEGY

Keep backend simple.

Recommended:

```text
tsx watch → development
tsc → production build
node dist/... → production start
```

Avoid unnecessary bundlers.

## 23. SCRIPTS

`apps/api/package.json` should provide working:

```text
dev
build
start
lint
type-check
test
```

## 24. TEST FOUNDATION

Use the testing stack approved in architecture.

Potential:

- Vitest or Jest
- Supertest

At minimum test:

```text
GET /api/v1/health
→ 200
→ structured safe response
```

and:

```text
unknown route
→ 404
→ structured error response
```

## 25. GRACEFUL SHUTDOWN

Handle:

```text
SIGINT
SIGTERM
```

Close HTTP server cleanly.

DB cleanup comes later.

## 26. RATE LIMITING

Only add a simple baseline limiter now if already approved.

Authentication-specific limits come later.

If deferred, document it.

Do not make local development unusable.

## 27. OPENAPI

Do not create full Swagger docs yet unless Step 2 explicitly locked a foundation.

Document future API docs approach.

## 28. DATABASE BOUNDARY

Do **NOT**:

- connect MongoDB
- create Mongoose models
- implement repositories requiring DB
- create fake DB service

MongoDB setup is Step 11.

## 29. AUTH BOUNDARY

Do **NOT**:

- implement login
- issue JWTs
- set refresh cookies
- create auth/RBAC middleware
- create user roles

Those come later.

## 30. AI BOUNDARY

Do **NOT**:

- call FastAPI
- install AI SDKs
- add provider keys
- create RAG endpoints

## 31. ROOT WORKSPACE INTEGRATION

Add working helpers such as:

```text
dev:api
build:api
lint:api
type-check:api
test:api
```

Now that web + api exist, optionally add working combined:

```text
dev
build
lint
type-check
test
```

If parallel development requires `concurrently`, explain why before adding it.

## 32. CROSS-APP LOCAL DEVELOPMENT

Document:

```text
Web URL:
API URL:
Health URL:
```

Ensure ports do not conflict.

Ensure frontend API base can point to backend.

## 33. BACKEND DOCUMENTATION

Create/update concise setup/convention docs.

Document:

- commands
- app/server separation
- request flow
- route conventions
- response shape
- errors
- logging
- security middleware
- testing

## 34. SECURITY REVIEW

Verify:

- safe CORS
- body limit
- Helmet
- no secret logging
- no production stack trace
- no global body logging
- no hardcoded credentials

## 35. RUN CHECKS

Run:

```bash
npm install
npm run lint
npm run type-check
npm run test
npm run build
```

Start API and verify:

```text
GET /api/v1/health
```

Test unknown route.

## 36. POST-IMPLEMENTATION REVIEW

```text
STEP 9 POST-REVIEW

Express:
TypeScript:
App/Server Separation:
Routing:
Health Endpoint:
Error Handling:
Logging:
Security Middleware:
CORS:
Request Limits:
Validation Foundation:
Tests:
Lint:
Type Check:
Build:
Issues Found:
Issues Fixed:
Known Limitations:
```

Fix Step 9 issues and re-run checks.

## 37. FRONTEND INTEGRATION REVIEW

Confirm:

- frontend base URL can target backend
- CORS permits intended local frontend
- health route is reachable
- no auth assumption
- ports do not conflict
- root scripts work

## 38. GIT REVIEW

Run:

```bash
git status
git diff
```

Confirm:

- no secret
- no `.env`
- no DB model
- no auth code
- no ProjectTrace/RoadSync
- no unrelated rewrite
- no debug junk

## 39. FINAL REPORT

```text
STEP 9 COMPLETE
Configure Express Backend Foundation

STATUS:
BACKEND STACK:
FILES CREATED:
FILES MODIFIED:
DEPENDENCIES ADDED:
API BASE:
HEALTH ENDPOINT:
SECURITY FOUNDATION:
LOGGING:
TESTS:
CHECKS:
  Lint:
  Type Check:
  Tests:
  Build:
  Manual Health Check:
FRONTEND INTEGRATION:
KNOWN LIMITATIONS:
NEXT:
Step 10 — Environment Variables & Secret Management
```

## 40. ACCEPTANCE CRITERIA

Complete only if:

- Express starts
- strict TypeScript build works
- app/server are separated
- `/api/v1` exists
- health endpoint works
- response/error shape is consistent
- centralized error handling exists
- JSON 404 exists
- structured logging exists
- baseline security middleware exists
- CORS is safe
- body limits exist
- test foundation works
- health and 404 tests pass
- lint passes
- type-check passes
- build passes
- frontend/backend can run together
- MongoDB is NOT implemented
- auth/RBAC is NOT implemented
- business feature logic is NOT implemented

Stop after Step 9.

---

# FINAL STEPS 7–9 CONSISTENCY REVIEW

After all three steps, perform a final review without starting Step 10.

Verify:

## Repository
- one package manager
- clean workspace
- no duplicate lockfiles
- docs preserved
- team Git rules preserved

## Frontend
- Next.js + TypeScript
- App Router
- styling works
- INFRAOS flag-inspired tokens
- no exposed secrets
- lint/type-check/build pass

## Backend
- Express + TypeScript
- `/api/v1`
- health endpoint
- structured errors
- structured logging
- baseline security
- tests/build pass

## Explicit Boundary Check

These should still be **NO**:

```text
MongoDB connection? NO
Mongoose models? NO
Authentication? NO
RBAC? NO
ProjectTrace? NO
RoadSync? NO
AI? NO
File storage? NO
Socket.IO? NO
```

## Security
Search for accidentally committed `.env`, real keys, hardcoded secrets, unsafe CORS, or client-exposed secrets.

## Brand
Confirm temporary UI uses the new Sri Lankan flag-inspired INFRAOS palette and not the abandoned previous navy/orange palette.

---

# FINAL REPORT FORMAT

```text
STEPS 7–9 FOUNDATION REVIEW COMPLETE

STEP 7 — Repository:
✅ / ⚠️

STEP 8 — Frontend Foundation:
✅ / ⚠️

STEP 9 — Backend Foundation:
✅ / ⚠️

ROOT COMMANDS:
- ...

WEB COMMANDS:
- ...

API COMMANDS:
- ...

LOCAL URLS:
Web:
API:
Health:

CHECK RESULTS:
Web Lint:
Web Type Check:
Web Build:

API Lint:
API Type Check:
API Tests:
API Build:

SECURITY REVIEW:
- ...

BOUNDARY CHECK:
MongoDB implemented? NO
Authentication implemented? NO
ProjectTrace implemented? NO
RoadSync implemented? NO

INCONSISTENCIES FOUND:
- ...

INCONSISTENCIES FIXED:
- ...

KNOWN LIMITATIONS:
- ...

GIT STATUS:
- ...

NEXT STEP:
Step 10 — Environment Variables & Secret Management
```

# FINAL RULE

Do not continue to Step 10 automatically.

Wait for explicit instruction.
