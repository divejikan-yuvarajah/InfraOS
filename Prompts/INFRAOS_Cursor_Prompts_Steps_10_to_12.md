# INFRAOS — Enhanced Cursor Prompts
## Steps 10–12: Environment & Secrets, MongoDB Atlas Foundation, Core Identity/Agency Schemas

**Project:** INFRAOS — National Infrastructure Intelligence & Coordination Platform  
**Vision:** The Operating System for National Infrastructure  
**Core Lifecycle:** Plan → Coordinate → Approve → Build → Verify → Monitor → Complete → Maintain  
**Development Window:** 45–60 days  
**Primary Development Assistant:** Cursor AI  

---

# HOW TO USE THIS FILE

Execute these steps in order:

1. **Step 10 — Environment Variables & Secret Management**
2. **Step 11 — MongoDB Atlas Complete Setup**
3. **Step 12 — Core MongoDB Schema Foundation**

For every step:

- Follow `CURSOR_STEP_EXECUTION_RULES.md` if it exists.
- Read the approved INFRAOS source-of-truth documents first.
- Inspect the repository before modifying anything.
- Perform a **PRE-STEP REVIEW**.
- Implement only the requested step.
- Run relevant checks.
- Perform a **POST-IMPLEMENTATION REVIEW**.
- Fix issues caused by the step.
- Re-run checks.
- Update documentation.
- Review `git status` and `git diff`.
- Stop before the next step.

---

# REVALIDATED INFRAOS SOURCE OF TRUTH

INFRAOS is not a generic CRUD or ERP application.

Its central workflow remains:

```text
Create Infrastructure Project
        ↓
Map Project Location
        ↓
Detect Nearby / Planned Work
        ↓
Detect Geographic / Schedule Conflict
        ↓
Identify Affected Agencies
        ↓
Coordinate Agencies
        ↓
Resolve / Reschedule / Approve
        ↓
Track Project Delivery
        ↓
Analyze Risk
        ↓
Verify Progress
        ↓
Complete Project
        ↓
Convert to Infrastructure Asset
        ↓
Maintain Asset
```

Core P0 areas:

- Authentication / secure sessions
- RBAC + resource-level authorization
- Users / Agencies
- ProjectTrace
- Milestones / Progress
- RoadSync
- GeoJSON / nearby-work detection
- Schedule conflict detection
- Coordination workflow
- Conflict resolution
- InfraMap project/work/conflict layers
- Critical audit logging

Steps 10–12 are foundation work for those later modules.

---

# LOCKED ARCHITECTURE

## Frontend

```text
Next.js
React
TypeScript
Tailwind CSS
shadcn/ui
React Hook Form
Zod
TanStack Query
Zustand only when genuinely needed
MapLibre / OpenStreetMap-compatible maps
```

## Backend

```text
Node.js
Express.js
TypeScript
REST API
Modular monolith
```

## Database

```text
MongoDB Atlas
Mongoose
GeoJSON
2dsphere indexes later where required
```

## AI

```text
Python
FastAPI
Provider abstraction
RAG / embeddings / ML only where useful
```

## Request Boundary

```text
Browser
↓
Next.js
↓
Express API
↓
Authentication / Authorization / Validation
↓
Business Services
↓
MongoDB / External Services
```

The browser must never receive database credentials, JWT signing secrets, refresh secrets, AI service secrets, or storage credentials.

---

# LOCKED SECURITY PRINCIPLES

Future protected request flow:

```text
Authenticated?
↓
Role Permission?
↓
Organization / Agency Scope?
↓
Specific Resource Access?
↓
Business-State Rule?
↓
Perform Action
↓
Audit Sensitive Action
```

Backend remains the real enforcement layer.

Never trust user-supplied:

- role
- permissions
- agency ownership
- project assignment
- approval authority

---

# LOCKED MAIN ROLES

1. Super Administrator
2. Government / Ministry Administrator
3. Agency Officer
4. Project Manager
5. Contractor
6. Inspector
7. Citizen

Do not implement full RBAC in Steps 10–12.

Step 12 prepares durable Role/User/Agency data structures only.

---

# IMPORTANT SCOPE BOUNDARY FOR STEPS 10–12

Do **NOT** implement yet:

- login endpoint
- registration workflow
- JWT issuance
- refresh endpoint
- RBAC middleware
- ProjectTrace schemas
- RoadSync schemas
- project/milestone/conflict collections
- contractor/finance collections
- documents/RAG
- inspections/assets
- citizen issues
- AI endpoints
- map features
- production deployment

These come in later steps.

---

# STEP 10 — ENVIRONMENT VARIABLES & SECRET MANAGEMENT

## CURSOR AGENT PROMPT

Act as a:

- Senior Security Engineer
- Node.js Configuration Architect
- Next.js Platform Engineer
- DevOps Engineer
- Secret Management Reviewer
- QA Engineer
- Technical Lead

Perform:

# STEP 10 — ENVIRONMENT VARIABLES & SECRET MANAGEMENT

The goal is to create one clear, secure, typed configuration strategy for the INFRAOS monorepo before MongoDB, authentication, AI, storage, maps, and deployment are configured.

Do not connect to MongoDB in this step.

Do not implement auth.

---

## 1. PRE-STEP REVIEW

Inspect:

```text
/.env*
/apps/web/.env*
/apps/api/.env*
/apps/ai-service/.env*
/.env.example
.gitignore
package.json
/apps/web/package.json
/apps/api/package.json
/apps/web/src/
/apps/api/src/config/
/docs/architecture/
/docs/security/
/docs/team/
```

Search the repository for:

```text
process.env
NEXT_PUBLIC_
MONGODB_URI
JWT_SECRET
REFRESH_SECRET
AI_SERVICE
API_KEY
TOKEN
PASSWORD
PRIVATE_KEY
CLIENT_URL
PORT
```

Do not print actual secret values.

Return:

```text
STEP 10 PRE-REVIEW

Existing Environment Files:
- ...

Current Env Access Locations:
- ...

Potential Secret Exposure:
- ...

Frontend Public Env Variables:
- ...

Backend Private Env Variables:
- ...

Duplicate / Conflicting Variable Names:
- ...

Missing Config:
- ...

Files To Modify:
- ...

Implementation Plan:
1.
2.
3.
...
```

---

## 2. DEFINE ENVIRONMENT CATEGORIES

Use explicit categories.

### Public Frontend Configuration

Values safe to expose to browser bundles.

Examples:

```text
NEXT_PUBLIC_API_BASE_URL
NEXT_PUBLIC_MAP_STYLE_URL
```

Only use `NEXT_PUBLIC_*` when the value is intentionally public.

---

### Backend Private Configuration

Examples:

```text
NODE_ENV
PORT
CLIENT_URL
LOG_LEVEL
API_PREFIX

MONGODB_URI
MONGODB_DB_NAME

JWT_SECRET
JWT_ACCESS_TTL
REFRESH_SECRET
REFRESH_TTL

AI_SERVICE_URL
AI_SERVICE_SECRET

STORAGE_PROVIDER
STORAGE_SECRET
```

Secrets stay backend-only.

---

### AI Service Private Configuration — Later

Examples:

```text
AI_SERVICE_SECRET
LLM_PROVIDER
LLM_API_KEY
EMBEDDING_MODEL
VECTOR_STORE_URL
VECTOR_STORE_API_KEY
```

Do not configure real AI secrets now.

---

## 3. DEFINE ENVIRONMENT FILE POLICY

Recommended local structure:

```text
apps/web/.env.local
apps/api/.env
apps/ai-service/.env
```

These files must be ignored.

Commit only examples such as:

```text
apps/web/.env.example
apps/api/.env.example
apps/ai-service/.env.example
```

A root `.env.example` may act as a documentation index, but avoid maintaining conflicting duplicate values.

Choose one clear strategy and document it.

---

## 4. DO NOT DUPLICATE SECRET CONFIG

Avoid having the same secret copied into:

```text
root .env
apps/api/.env
apps/web/.env.local
```

unless there is a documented need.

Frontend must never require backend secrets.

---

## 5. BACKEND TYPED ENV VALIDATION

Use the approved validation library, preferably Zod if already selected.

Create a centralized server configuration layer such as:

```text
apps/api/src/config/env.ts
```

or equivalent.

Do not scatter:

```ts
process.env.SOMETHING
```

through controllers/services.

The config layer should:

- parse raw env values
- validate format
- convert numeric values
- provide typed output
- fail with safe, clear errors
- never print secret contents

---

## 6. REQUIRED NOW VS REQUIRED LATER

This is important.

Do not force the API to require future secrets before their feature exists.

### Required Now

Examples:

```text
NODE_ENV
PORT
CLIENT_URL
API_PREFIX
LOG_LEVEL
```

### Required From Step 11

```text
MONGODB_URI
MONGODB_DB_NAME
```

### Required When Authentication Is Implemented

```text
JWT_SECRET
REFRESH_SECRET
JWT_ACCESS_TTL
REFRESH_TTL
```

### Required When AI Is Implemented

```text
AI_SERVICE_URL
AI_SERVICE_SECRET
LLM_API_KEY
```

### Required When Storage Is Implemented

Storage-specific credentials.

Document this staged requirement model.

Do not use insecure fallback secrets.

---

## 7. SECRET VALIDATION RULE

Never use fallback values such as:

```text
JWT_SECRET=secret
REFRESH_SECRET=123456
```

for production code.

For secrets used later:

- validate presence when feature activates
- validate reasonable minimum strength/length
- do not log value
- do not include in API errors

Do not invent real secret strings inside `.env.example`.

---

## 8. PORT VALIDATION

Validate `PORT` as a valid integer.

Example allowed range:

```text
1–65535
```

Use a sensible local default only if architecture explicitly allows it.

A local default like `4000` is acceptable for non-secret development config.

---

## 9. URL VALIDATION

Validate:

```text
CLIENT_URL
NEXT_PUBLIC_API_BASE_URL
AI_SERVICE_URL later
```

as valid URLs.

Do not silently accept malformed URLs.

---

## 10. NODE_ENV

Accept only known values such as:

```text
development
test
production
```

Avoid arbitrary environment strings unless required.

---

## 11. LOG_LEVEL

Define supported levels based on the selected logger.

Example:

```text
fatal
error
warn
info
debug
trace
silent
```

Use a sensible development/production default if allowed.

Do not log secrets at debug level.

---

## 12. FRONTEND ENV ACCESS

Centralize public frontend config if useful, e.g.:

```text
apps/web/src/config/env.ts
```

Do not put backend secrets here.

Only expose values prefixed with `NEXT_PUBLIC_`.

Avoid server-only env accidentally imported into Client Components.

---

## 13. FRONTEND BUILD SAFETY

The web build should not fail because backend-only secrets are unavailable.

Examples:

```text
MONGODB_URI
JWT_SECRET
AI_SERVICE_SECRET
```

must not be required by frontend build-time code.

---

## 14. SECRET REDACTION

If configuration errors/logging include variable diagnostics:

Allowed:

```text
MONGODB_URI is missing
```

Not allowed:

```text
MONGODB_URI=mongodb+srv://user:password@...
```

Create redaction helpers only if needed.

Do not overbuild.

---

## 15. `.gitignore` REVIEW

Verify all private environment files are ignored.

Examples:

```text
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

apps/web/.env.local
apps/api/.env
apps/ai-service/.env
```

Do not ignore `.env.example`.

---

## 16. GIT HISTORY / CURRENT TRACKED SECRET REVIEW

Check:

```bash
git status
git ls-files | grep -E '(^|/)\.env'
```

Use platform-appropriate alternatives on Windows if needed.

If a private env file is already tracked:

- do not expose its contents
- remove it from Git tracking safely if authorized
- preserve local file if needed
- recommend secret rotation if real credentials may have entered Git history

Do not rewrite Git history automatically.

---

## 17. ENV EXAMPLES

Create clear examples.

### `apps/web/.env.example`

Example:

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_MAP_STYLE_URL=
```

### `apps/api/.env.example`

Example:

```text
NODE_ENV=development
PORT=4000
CLIENT_URL=http://localhost:3000
API_PREFIX=/api/v1
LOG_LEVEL=debug

MONGODB_URI=
MONGODB_DB_NAME=infraos_dev

JWT_SECRET=
JWT_ACCESS_TTL=
REFRESH_SECRET=
REFRESH_TTL=

AI_SERVICE_URL=
AI_SERVICE_SECRET=

STORAGE_PROVIDER=
```

Do not fill secrets.

---

## 18. ENV NAMING CONVENTION

Use:

```text
UPPER_SNAKE_CASE
```

Be consistent.

Avoid duplicate names like:

```text
DATABASE_URL
MONGO_URI
MONGODB_URL
MONGODB_URI
```

Choose one.

Recommended:

```text
MONGODB_URI
MONGODB_DB_NAME
```

---

## 19. ENV DOCUMENTATION

Create/update:

```text
/docs/setup/environment.md
```

Document:

- file locations
- required-now variables
- future variables
- public vs private
- local setup
- development/test/production separation
- how to generate secrets later
- how to avoid committing secrets
- troubleshooting missing env values

Do not put actual secrets in documentation.

---

## 20. DEVELOPMENT / TEST / PRODUCTION SEPARATION

Plan:

```text
infraos_dev
infraos_test
infraos_prod
```

or another explicit naming strategy.

Do not use the production database for automated tests.

Do not share production credentials with local development.

---

## 21. CONFIG ACCESS RULE

Backend modules should import typed config:

```text
config.env.PORT
config.env.CLIENT_URL
```

or equivalent.

Do not allow random direct `process.env` reads throughout business modules.

---

## 22. TEST CONFIG SAFETY

Future test environment must not accidentally connect to production.

Plan a guard requiring test DB names to clearly identify test usage.

Example concept:

```text
NODE_ENV=test
+
DB name contains / ends with _test
```

Do not implement destructive database-reset scripts yet.

---

## 23. SECURITY REVIEW

Review for:

- browser-exposed secrets
- hardcoded keys
- committed env files
- insecure fallback secrets
- secret values in logs
- production credentials in test config
- duplicate env sources
- malformed URL acceptance

---

## 24. TESTING

Add focused tests for environment parsing where practical.

Test examples:

```text
Valid required base env → passes
Invalid PORT → fails
Invalid CLIENT_URL → fails
Invalid NODE_ENV → fails
Missing current-required variable → fails safely
Future-unused secret missing → does not unnecessarily block current step
Secret value is not printed in validation error
```

Do not test with real credentials.

---

## 25. RUN CHECKS

Run:

```bash
npm run lint
npm run type-check
npm run test
npm run build
```

as available.

Ensure:

- web build does not need backend secrets
- API starts with current-required non-secret config
- missing future variables do not break unrelated functionality

---

## 26. POST-IMPLEMENTATION REVIEW

Return and fix:

```text
STEP 10 POST-REVIEW

Env Strategy:
- ...

Frontend Public Variables:
- ...

Backend Private Variables:
- ...

Current Required Variables:
- ...

Future Required Variables:
- ...

Typed Validation:
- ...

Secret Redaction:
- ...

Git Ignore:
- ...

Tracked Secret Risk:
- ...

Development/Test/Production Separation:
- ...

Tests:
- ...

Lint:
- ...

Type Check:
- ...

Build:
- ...

Issues Found:
- ...

Issues Fixed:
- ...

Known Limitations:
- ...
```

---

## 27. GIT REVIEW

Run:

```bash
git status
git diff
git diff --check
```

Confirm:

- no `.env` secret file is added
- `.env.example` contains no secret
- no unrelated feature code
- no DB connection yet
- no auth code yet

---

## 28. STEP 10 FINAL REPORT

```text
STEP 10 COMPLETE
Environment Variables & Secret Management

STATUS:
✅ Complete / ⚠️ Complete with known limitations

ENV STRATEGY:
- ...

FILES CREATED:
- ...

FILES MODIFIED:
- ...

PUBLIC ENV:
- ...

PRIVATE ENV:
- ...

VALIDATION:
- ...

SECRET REVIEW:
- ...

CHECKS:
Lint:
Type Check:
Tests:
Build:

KNOWN LIMITATIONS:
- ...

NEXT:
Step 11 — MongoDB Atlas Complete Setup
```

---

## 29. STEP 10 ACCEPTANCE CRITERIA

Step 10 is complete only if:

- env strategy is documented
- frontend/public and backend/private env are separated
- typed backend config exists
- no secret is exposed to browser
- no real secret is committed
- staged required-now / required-later model exists
- `.gitignore` protects private env files
- dev/test/prod strategy exists
- tests cover env parsing
- lint/type-check/build pass
- MongoDB connection has not been implemented yet
- auth has not been implemented

Stop after Step 10.

---

---

# STEP 11 — MONGODB ATLAS COMPLETE SETUP

## CURSOR AGENT PROMPT

Act as a:

- Senior MongoDB Engineer
- Mongoose Architect
- Backend Infrastructure Engineer
- Database Security Engineer
- DevOps Engineer
- Reliability Engineer
- QA Engineer

Perform:

# STEP 11 — MONGODB ATLAS COMPLETE SETUP

The goal is to establish a secure, reusable MongoDB Atlas connection foundation for INFRAOS and prove connectivity safely.

Do not create application feature schemas except any absolutely minimal technical support required for connection testing.

Core Users/Roles/Agencies schemas belong to Step 12.

---

## 1. PRE-STEP REVIEW

Inspect:

```text
/apps/api/src/config/
/apps/api/src/
/apps/api/package.json
/apps/api/.env.example
/docs/setup/environment.md
/docs/architecture/
/docs/security/
/docs/database/
```

Search for existing:

```text
mongoose
mongodb
MongoClient
connectDB
MONGODB_URI
MONGODB_DB_NAME
```

Return:

```text
STEP 11 PRE-REVIEW

Existing MongoDB Dependencies:
- ...

Existing DB Code:
- ...

Env Readiness:
- ...

Current Health Endpoint:
- ...

Existing Database Docs:
- ...

Potential Duplicate Connections:
- ...

Security Risks:
- ...

Implementation Plan:
1.
2.
3.
...
```

---

## 2. USE MONGODB ATLAS + MONGOOSE

Version 1 uses:

```text
MongoDB Atlas
+
Mongoose
```

Do not add a second ODM/ORM.

Do not add PostgreSQL.

Do not add Redis.

Do not add an embedded local DB abstraction.

---

## 3. MONGODB ATLAS USER SETUP RUNBOOK

Create:

```text
/docs/setup/mongodb-atlas.md
```

Document user actions clearly.

Include:

### A. Create / Select Atlas Project

Use a dedicated INFRAOS Atlas project if possible.

### B. Create Development Deployment

Choose an available development-appropriate Atlas deployment/tier.

Do not claim pricing/limits unless verified by the user.

### C. Select Region

Prefer a region with reasonable latency for the intended deployment/users where available.

Do not force a paid region/tier.

### D. Create Database User

Explain:

- Atlas website account ≠ application database user
- create an application-specific database user
- use a strong generated password
- apply least privilege

Do not put the password in Git.

### E. Network Access

Restrict network access.

Do not casually recommend:

```text
0.0.0.0/0
```

as the final production configuration.

For development, clearly document temporary access options and security implications.

### F. Obtain Connection String

Store only in private:

```text
apps/api/.env
```

using:

```text
MONGODB_URI
MONGODB_DB_NAME
```

---

## 4. DATABASE NAME STRATEGY

Use separate DBs:

```text
infraos_dev
infraos_test
infraos_prod
```

Do not run automated tests against production.

Do not allow development scripts to silently target production.

---

## 5. MONGOOSE DEPENDENCY

Install a supported Mongoose version compatible with current Node/TypeScript.

Preserve lockfile.

Do not install both:

```text
mongoose
mongodb
```

directly unless the native driver is genuinely needed separately.

Mongoose already depends on MongoDB driver.

---

## 6. DATABASE CONFIG

Extend typed backend env validation so DB-specific operations require:

```text
MONGODB_URI
MONGODB_DB_NAME
```

Validate:

- non-empty URI
- expected MongoDB URI scheme
- non-empty database name
- no secret logging

Do not print URI on failure.

---

## 7. CONNECTION MODULE

Create a reusable module such as:

```text
apps/api/src/config/database.ts
```

or:

```text
apps/api/src/database/mongoose.ts
```

Choose one architecture and document it.

Responsibilities:

- connect once per process
- reuse connection
- handle connection states
- return typed/reliable connection status
- disconnect gracefully
- sanitize errors
- never expose URI

---

## 8. AVOID PER-REQUEST CONNECTIONS

Do **not**:

```text
connect
query
disconnect
```

on every request.

Establish/reuse one application connection pool per API process.

---

## 9. CONNECTION TIMEOUTS

Configure reasonable connection/server selection behavior.

Avoid infinite startup hangs.

Do not blindly copy arbitrary extreme timeout values.

Document chosen values and why.

---

## 10. STARTUP STRATEGY

For the dedicated Express API, use a clear startup flow.

Recommended concept:

```text
Load / validate config
↓
Connect MongoDB
↓
Start HTTP server
```

If DB connection is required for the application, startup should not claim full readiness when DB is unavailable.

However:

- liveness and readiness should remain conceptually separate
- do not create public debug endpoints with DB secrets

---

## 11. LIVENESS VS READINESS

Keep existing liveness:

```text
GET /api/v1/health
```

This may report that the API process is alive.

Add a readiness mechanism if appropriate:

```text
GET /api/v1/ready
```

It may safely report:

```json
{
  "success": true,
  "data": {
    "status": "ready",
    "database": "connected"
  }
}
```

Do not return:

- URI
- hostnames
- replica set details
- username
- raw driver errors

If project architecture prefers no public readiness route yet, implement a private startup diagnostic instead and document the choice.

---

## 12. DB CONNECTION EVENTS

Log safe lifecycle events such as:

```text
MongoDB connected
MongoDB disconnected
MongoDB connection error
```

Never log connection strings/passwords.

Avoid noisy event spam.

---

## 13. GRACEFUL SHUTDOWN

Extend Step 9 shutdown logic.

On:

```text
SIGINT
SIGTERM
```

perform:

```text
Stop accepting new HTTP work
↓
Close HTTP server
↓
Disconnect Mongoose
↓
Exit
```

Avoid immediate `process.exit()` before cleanup unless forced after timeout.

---

## 14. RETRY POLICY

Do not create infinite reconnect loops.

Mongoose/driver handles many transient connection conditions.

If adding startup retry:

- bound attempts
- use sensible delay
- log sanitized reason
- fail clearly after limit

Avoid making development hang silently.

---

## 15. DATABASE CHECK SCRIPT

Create a safe developer diagnostic:

```text
npm run db:check
```

or equivalent.

It should:

1. load env
2. validate DB config
3. connect
4. execute a minimal ping / connection confirmation
5. disconnect
6. print only safe success/failure

Example safe output:

```text
INFRAOS MongoDB check: PASS
Database environment: development
```

Do not print:

- URI
- password
- Atlas hostname details unnecessarily

Do not create a public `/api/debug-db` endpoint.

---

## 16. TEST DATABASE SAFETY GUARD

For automated tests:

Require an explicit test DB.

Concept:

```text
NODE_ENV=test
MONGODB_DB_NAME=infraos_test
```

Add guardrails to stop destructive test utilities if DB appears production-like.

Do not implement destructive reset logic now.

---

## 17. DATABASE HEALTH ABSTRACTION

Create a narrow reusable function for later monitoring.

Example responsibilities:

- connection state
- safe readiness boolean

Do not expose raw Mongoose connection object across every module unless needed.

Repositories/models can use Mongoose normally through the initialized connection.

---

## 18. SECURITY SETTINGS

Do not disable TLS verification.

Do not add:

```text
tlsAllowInvalidCertificates
tlsInsecure
```

to solve connection problems.

Do not hardcode credentials.

Use least privilege.

---

## 19. CONNECTION POOL

Use sensible defaults or a modest explicitly documented pool.

Do not over-tune prematurely.

Remember each API process may own its own pool.

Document future production tuning rather than pretending current values are final national-scale settings.

---

## 20. LOCAL DEVELOPMENT WITHOUT ATLAS ACCESS

If real Atlas credentials are unavailable:

Still complete:

- connection architecture
- env validation
- `.env.example`
- Atlas setup runbook
- tests that do not require real Atlas
- `db:check` script

Report:

```text
Real Atlas connectivity: NOT RUN
Reason: credentials/setup not available
```

Do not fabricate passing connectivity.

---

## 21. MONGOOSE CONFIG QUALITY

Do not use outdated/deprecated options copied from old tutorials.

Use supported modern Mongoose connection configuration.

Avoid:

```text
useNewUrlParser
useUnifiedTopology
```

if current Mongoose no longer needs them.

Inspect actual installed version.

---

## 22. DATABASE DOCUMENTATION

Create/update:

```text
/docs/database/connection.md
/docs/setup/mongodb-atlas.md
```

Include:

- environment separation
- connection lifecycle
- startup behavior
- shutdown behavior
- safe diagnostic
- network/access assumptions
- database names
- troubleshooting without exposing secrets

---

## 23. TESTING

Create tests where practical for:

- missing DB config
- invalid MongoDB URI format
- DB config not logging secret
- connection module reuse
- graceful failure
- readiness status behavior

Real Atlas connectivity test should only run when explicit dev/test credentials are available.

Do not make normal unit test suite depend on internet Atlas connectivity.

---

## 24. RUN CHECKS

Run:

```bash
npm run lint
npm run type-check
npm run test
npm run build
```

If authorized credentials exist:

```bash
npm run db:check
```

Start API and verify intended health/readiness behavior.

---

## 25. POST-IMPLEMENTATION REVIEW

```text
STEP 11 POST-REVIEW

MongoDB Technology:
- MongoDB Atlas + Mongoose

Atlas Runbook:
- ...

Environment Separation:
- ...

Connection Reuse:
- ...

Startup Strategy:
- ...

Health / Readiness:
- ...

Graceful Shutdown:
- ...

TLS / Security:
- ...

Pool / Timeout Decisions:
- ...

db:check:
- ...

Real Atlas Connectivity:
PASS / FAIL / NOT RUN

Secret Exposure:
- ...

Tests:
- ...

Lint:
- ...

Type Check:
- ...

Build:
- ...

Issues Found:
- ...

Issues Fixed:
- ...

Known Limitations:
- ...
```

Fix problems caused by Step 11.

---

## 26. GIT REVIEW

Run:

```bash
git status
git diff
git diff --check
```

Confirm:

- no real DB credentials committed
- no Project/User schemas yet unless Step 12
- no auth endpoint
- no project feature implementation
- no public debug DB endpoint

---

## 27. STEP 11 FINAL REPORT

```text
STEP 11 COMPLETE
MongoDB Atlas Complete Setup

STATUS:
✅ Complete / ⚠️ Complete with known limitations

DATABASE:
MongoDB Atlas + Mongoose

FILES CREATED:
- ...

FILES MODIFIED:
- ...

ENV CHANGES:
- ...

CONNECTION STRATEGY:
- ...

ATLAS SETUP:
- ...

DB CHECK:
- ...

CHECKS:
Lint:
Type Check:
Tests:
Build:
Atlas Connectivity:

SECURITY REVIEW:
- ...

KNOWN LIMITATIONS:
- ...

NEXT:
Step 12 — Core MongoDB Schema Foundation
```

---

## 28. STEP 11 ACCEPTANCE CRITERIA

Step 11 is complete only if:

- MongoDB Atlas runbook exists
- Mongoose is configured
- DB env is validated
- app uses one reusable connection per process
- no per-request connect/disconnect pattern
- graceful shutdown includes DB
- DB errors are sanitized
- secrets are not logged
- development/test/production DB names are separated
- safe `db:check` exists
- real connectivity is verified or honestly marked NOT RUN
- normal unit tests do not require Atlas
- lint/type-check/test/build pass
- core application schemas are not prematurely created

Stop after Step 11.

---

---

# STEP 12 — CORE MONGODB SCHEMA FOUNDATION

## CURSOR AGENT PROMPT

Act as a:

- Senior MongoDB Data Architect
- Mongoose Engineer
- Identity Data Architect
- Authorization Data Architect
- Backend Security Engineer
- API/Data Integrity Reviewer
- QA Engineer

Perform:

# STEP 12 — CORE MONGODB SCHEMA FOUNDATION

The goal is to establish durable, secure core data models required by later authentication, RBAC, and organization-scoped access.

Implement only the foundational identity/organization schemas.

Do **NOT** implement all INFRAOS project schemas yet.

---

## 1. PRE-STEP REVIEW

Inspect:

```text
/docs/security/roles-and-permissions.md
/docs/security/permission-matrix.md
/docs/security/resource-authorization.md
/docs/architecture/authorization-flow.md
/docs/architecture/module-boundaries.md
/docs/database/
/apps/api/src/
```

Inspect existing model conventions.

Return:

```text
STEP 12 PRE-REVIEW

Existing Models:
- ...

Role Requirements:
- ...

Permission Naming:
- ...

Agency Scope Requirements:
- ...

Authentication Future Requirements:
- ...

Existing Index Conventions:
- ...

Potential Conflicts:
- ...

Implementation Plan:
1.
2.
3.
...
```

---

## 2. STEP 12 MODEL SCOPE

Implement:

```text
users
roles
agencies
refreshSessions (foundation if appropriate)
```

Optionally implement a dedicated `permissions` collection **only if Step 4 architecture explicitly chose database-managed permission definitions**.

Otherwise store permission keys inside roles.

Do not create a permissions collection just because it sounds enterprise.

---

## 3. DO NOT IMPLEMENT YET

Do not create:

```text
projects
milestones
workRequests
conflicts
coordinationRequests
contractors
projectPayments
documents
documentChunks
inspections
assets
maintenanceRecords
citizenIssues
notifications
riskAssessments
auditLogs
```

Those are handled in later schema steps.

---

# USERS SCHEMA

## 4. USER PURPOSE

`users` represents authenticated/managed platform identities.

Planned roles include:

- Super Administrator
- Government Administrator
- Agency Officer
- Project Manager
- Contractor
- Inspector
- Citizen

The model should support later authentication without implementing auth workflows now.

---

## 5. USER FIELDS

Design a robust but realistic schema.

Recommended fields:

```text
_id
firstName
lastName
displayName (optional/derived strategy)
email
passwordHash
roleId
agencyId
status
emailVerified
lastLoginAt
createdBy
updatedBy
createdAt
updatedAt
```

Potential optional fields:

```text
phone
avatarUrl
jobTitle
```

Only include them if supported by scope.

Do not store unnecessary personal data.

---

## 6. USER EMAIL

Requirements:

- normalized
- trimmed
- lowercase
- unique index
- validation
- never store duplicate emails differing only by case if architecture can prevent it

Be aware MongoDB unique indexes and application normalization serve different purposes.

---

## 7. PASSWORD FIELD

Store only:

```text
passwordHash
```

Never store:

```text
password
plainPassword
temporaryPassword plaintext
```

Password hashing itself is implemented in later auth step.

Do not add a fake pre-save hashing hook unless authentication implementation is ready.

Prefer explicit auth service hashing later.

---

## 8. USER STATUS

Use a controlled enum.

Recommended concept:

```text
PENDING
ACTIVE
SUSPENDED
DISABLED
```

Avoid too many states.

Define semantic meaning.

Do not implement status transition endpoints yet.

---

## 9. USER ROLE REFERENCE

Use:

```text
roleId → roles._id
```

Do not trust a role string directly from frontend later.

Decide whether `roleId` is required for every internal user.

For Citizen, use an actual Citizen role rather than a magic null role if citizens authenticate.

---

## 10. USER AGENCY REFERENCE

Use:

```text
agencyId → agencies._id
```

but it may be nullable for roles that do not belong to one agency, such as platform Super Admin or possibly Citizen.

Do not assume every user has an agency.

Future Contractor users may reference contractor entities separately when Contractor module is built; do not overload `agencyId` to mean contractor.

---

## 11. CREATED / UPDATED BY

For auditability, consider:

```text
createdBy
updatedBy
```

as optional references because bootstrap/seeding may occur before a real actor exists.

Do not create circular required references.

---

## 12. USER INDEXES

At minimum consider:

```text
email unique
roleId
agencyId
status
```

Do not index every field.

Document query justification.

---

# ROLES SCHEMA

## 13. ROLE PURPOSE

`roles` defines high-level authorization categories.

Do not hardcode all access behavior only inside frontend.

Expected role records:

```text
SUPER_ADMIN
GOVERNMENT_ADMIN
AGENCY_OFFICER
PROJECT_MANAGER
CONTRACTOR
INSPECTOR
CITIZEN
```

Use stable role keys.

---

## 14. ROLE FIELDS

Recommended:

```text
_id
key
name
description
permissions[]
scopeType
isSystem
isActive
createdAt
updatedAt
```

Potential:

```text
createdBy
updatedBy
```

Do not create unnecessary metadata.

---

## 15. ROLE KEY

Use immutable/stable machine-friendly keys:

```text
SUPER_ADMIN
GOVERNMENT_ADMIN
AGENCY_OFFICER
PROJECT_MANAGER
CONTRACTOR
INSPECTOR
CITIZEN
```

Unique index.

Human display name can change without changing key.

---

## 16. ROLE PERMISSIONS

Use permission strings from Step 4.

Examples:

```text
project.create
project.read
project.update
project.approve

roadsync.work_request.create
roadsync.conflict.read
roadsync.coordination.respond

document.upload
inspection.verify
report.view
audit.read
```

Validate format.

Prevent duplicate permission values inside one role.

Do not implement authorization middleware yet.

---

## 17. ROLE SCOPE TYPE

Possible values aligned with Step 4:

```text
PLATFORM
ORGANIZATION
AGENCY
ASSIGNED_PROJECT
ASSIGNED_INSPECTION
OWN_RECORD
PUBLIC
```

A role may have a default scope type, but later authorization must still evaluate actual resource relationships.

Do not assume role scope alone proves access.

---

## 18. SYSTEM ROLES

Use:

```text
isSystem: true
```

for core roles if useful.

Later UI should not casually delete system roles.

Do not implement deletion APIs now.

---

# AGENCIES SCHEMA

## 19. AGENCY PURPOSE

`agencies` represents government/public infrastructure organizations participating in planning and coordination.

Examples:

- Road authority
- Water authority
- Electricity authority
- Telecom/public utility organization
- Local authority
- Drainage authority
- Ministry/department

Do not hardcode specific real agencies as required production data unless verified.

Seed data may use clearly identified prototype/demo organizations.

---

## 20. AGENCY FIELDS

Recommended:

```text
_id
code
name
shortName
type
description
contactEmail
contactPhone
address
status
parentAgencyId
createdAt
updatedAt
```

Potential geographic/admin fields only if needed later:

```text
district
province
```

Do not over-model now.

---

## 21. AGENCY CODE

Use a unique stable code.

Example demo style:

```text
RDA
WATER
ELEC
TELECOM
LOCAL
```

Do not assume these correspond to official organization codes unless verified.

Document demo vs official identifiers.

---

## 22. AGENCY TYPE ENUM

Use controlled categories.

Possible:

```text
MINISTRY
DEPARTMENT
ROAD
WATER
ELECTRICITY
TELECOM
LOCAL_AUTHORITY
DRAINAGE
OTHER
```

Keep extensibility without arbitrary free-text chaos.

---

## 23. PARENT AGENCY

Support optional hierarchy:

```text
parentAgencyId
```

Example:

```text
Ministry
  ↓
Department / Authority
```

Do not require hierarchy.

Prevent obvious self-reference.

Advanced cycle detection can be handled at service level later if needed.

---

## 24. AGENCY STATUS

Suggested:

```text
ACTIVE
INACTIVE
```

Do not physically delete agencies that historical records may reference without careful future strategy.

---

## 25. AGENCY INDEXES

Consider:

```text
code unique
name
type
status
parentAgencyId
```

Do not index address/contact fields without query need.

---

# REFRESH SESSION FOUNDATION

## 26. REFRESH SESSION DECISION

Authentication architecture selected secure refresh sessions.

If architecturally useful, create `refreshSessions` now as a foundation.

Recommended fields:

```text
_id
userId
tokenHash
familyId / sessionFamilyId
expiresAt
revokedAt
replacedBySessionId
createdAt
lastUsedAt
userAgentSummary
ipHash or limited request metadata only if privacy/security design supports it
```

Do not store plaintext refresh tokens.

Do not implement token generation yet.

If Step 12 should stay strictly Users/Roles/Agencies, document the refresh session schema and defer actual model to auth step.

Choose based on existing approved architecture and avoid unnecessary premature code.

---

## 27. TTL INDEX

If refreshSessions are implemented:

Use a TTL index on:

```text
expiresAt
```

Understand TTL cleanup is asynchronous and is not an authorization check.

Auth logic must still reject expired sessions explicitly later.

---

# COMMON MODEL CONVENTIONS

## 28. TIMESTAMPS

Use Mongoose timestamps:

```text
createdAt
updatedAt
```

consistently.

Store actual dates as BSON dates, not formatted strings.

---

## 29. JSON SERIALIZATION

Do not expose Mongoose internals unnecessarily.

Plan safe DTO/serialization boundaries later.

Avoid leaking:

```text
passwordHash
tokenHash
internal metadata
```

into API responses.

Add schema-level `select: false` for highly sensitive fields where appropriate, while still using explicit safe projections later.

---

## 30. STRICT SCHEMA SETTINGS

Use reasonable Mongoose strictness.

Do not silently accept arbitrary unknown fields from requests.

Remember application validation is still required later; Mongoose schema validation is not a replacement for request validation.

---

## 31. ENUM CENTRALIZATION

Store enum constants in clear domain files rather than repeating raw strings everywhere.

Examples:

```text
UserStatus
AgencyStatus
AgencyType
SystemRoleKey
ScopeType
```

Avoid one giant global constants file.

---

## 32. MODEL NAMING

Use consistent:

```text
User
Role
Agency
RefreshSession
```

Collections should follow a predictable plural naming strategy.

Do not manually force unusual collection names without reason.

---

## 33. MODEL OWNERSHIP

Identity module owns:

```text
User
Role
RefreshSession
```

Agency module owns:

```text
Agency
```

Do not let unrelated modules directly mutate identity data later without using owning services.

---

## 34. VALIDATION BOUNDARIES

At this step, define model-level validation.

Later API request schemas will validate user input separately.

Do not bind HTTP request schemas directly to Mongoose models in a way that exposes internal fields.

---

## 35. DELETE / ARCHIVE STRATEGY

Do not add generic `deletedAt` to every schema automatically.

For:

### User

Prefer status-based disabling over hard delete.

### Role

System roles should not be hard deleted casually.

### Agency

Prefer inactive/archive approach due to historical references.

Document this.

---

## 36. SEED FOUNDATION

Create a safe seed script for foundational roles and optional demo agencies.

Example:

```text
npm run db:seed:core
```

Requirements:

- idempotent
- does not duplicate roles
- upserts by stable role key
- safe environment guard
- does not run automatically on server startup
- refuses production unless explicitly designed/authorized later

Seed core roles:

```text
SUPER_ADMIN
GOVERNMENT_ADMIN
AGENCY_OFFICER
PROJECT_MANAGER
CONTRACTOR
INSPECTOR
CITIZEN
```

Populate permissions according to Step 4 source-of-truth.

Do not invent permissions that conflict with the permission catalog.

---

## 37. SUPER ADMIN BOOTSTRAP

Do not create a hardcoded default admin password.

Do not seed:

```text
admin@example.com
password123
```

If a bootstrap-admin process is needed later:

- use explicit CLI/setup flow
- require provided email
- require secure password input or invitation flow
- hash password
- prevent accidental repeat creation

This belongs to authentication/admin setup step, not now.

---

## 38. DEMO AGENCY SEEDS

If useful for development, use clearly synthetic/demo agency records.

Do not claim fake data is official Sri Lankan government data.

Document:

```text
Development/demo only
```

Do not overfill seed database.

---

## 39. INDEX SYNCHRONIZATION STRATEGY

Do not rely blindly on production auto-index behavior.

For development:

- Mongoose auto-index may be acceptable if intentionally configured

For production:

- plan controlled index management

Document future strategy.

Do not create destructive index migration scripts yet.

---

## 40. DUPLICATE KEY HANDLING

Prepare error mapping strategy for MongoDB duplicate key (`E11000`) later.

Examples:

```text
email duplicate
role key duplicate
agency code duplicate
```

Do not expose raw MongoDB errors to clients.

No API endpoint is needed yet.

---

## 41. REFERENCES VS EMBEDDING

For these foundation models use references where ownership is independent:

```text
User → Role
User → Agency
Agency → Parent Agency
RefreshSession → User
```

Do not embed full Role/Agency objects inside User.

This avoids stale duplicated authorization data.

---

## 42. DATA PRIVACY

Store only necessary user profile information.

Do not add:

- national ID
- home address
- date of birth
- unnecessary personal details

unless a future explicit requirement justifies it.

---

## 43. TESTS

Add model tests using an isolated/disposable test database strategy.

Test:

### User

- email required
- email normalization
- unique email behavior
- valid status only
- role reference field shape
- sensitive passwordHash excluded from default query if configured

### Role

- unique role key
- valid scope type
- duplicate permissions rejected/normalized
- required fields

### Agency

- unique code
- valid type
- valid status
- optional parent
- self-parent prevention if implemented at model/service helper level

### RefreshSession if implemented

- tokenHash required
- expiration required
- TTL index exists
- user reference

Do not run tests against development or production DB.

---

## 44. TEST DATABASE CLEANUP

Use only clearly disposable test data.

Do not:

```text
drop production database
drop development database
delete all collections blindly outside test environment
```

Test cleanup must verify environment first.

---

## 45. DATABASE MODEL DOCUMENTATION

Create:

```text
/docs/database/core-models.md
```

Include:

- purpose
- fields
- required/optional
- enums
- references
- indexes
- deletion strategy
- security considerations
- future module relationships

Create Mermaid conceptual diagram:

```text
Role 1 ← many Users
Agency 1 ← many Users
Agency parent ← child Agencies
User 1 ← many RefreshSessions
```

---

## 46. FUTURE RELATIONSHIPS DOCUMENT

Document, but do not implement:

```text
Agency → Projects
User(Project Manager) → Projects
Contractor user → Contractor entity
Inspector → Inspections
Citizen → Citizen Issues
```

This prevents Step 12 from overreaching.

---

## 47. MONGODB INDEX REVIEW

Run/inspect model indexes safely in test/dev.

Verify:

```text
users.email unique
roles.key unique
agencies.code unique
refreshSessions.expiresAt TTL if implemented
```

Do not create unrelated `2dsphere` indexes yet; those belong to project/work/asset schemas.

---

## 48. RUN CHECKS

Run:

```bash
npm run lint
npm run type-check
npm run test
npm run build
```

Run model-focused tests.

If development Atlas access exists, optionally verify models against development DB using clearly synthetic records.

Do not leave test records unintentionally.

---

## 49. SECURITY REVIEW

Check:

- passwordHash never returned casually
- no plaintext password field
- no plaintext refresh token
- no frontend role trust
- no user permission duplication that can become stale
- agency linkage is explicit
- system roles protected conceptually
- seed script safe
- no production destructive behavior

---

## 50. POST-IMPLEMENTATION REVIEW

```text
STEP 12 POST-REVIEW

Models Created:
- User
- Role
- Agency
- RefreshSession? YES/NO

Collections:
- ...

Indexes:
- ...

Enums:
- ...

References:
- ...

Sensitive Fields:
- ...

Seed Strategy:
- ...

Role Permission Alignment:
- ...

Agency Scope Alignment:
- ...

Delete/Disable Strategy:
- ...

Test DB Safety:
- ...

Tests:
- ...

Lint:
- ...

Type Check:
- ...

Build:
- ...

Issues Found:
- ...

Issues Fixed:
- ...

Deferred to Step 13+:
- ...
```

Fix Step 12 issues and re-run checks.

---

## 51. GIT REVIEW

Run:

```bash
git status
git diff
git diff --check
```

Confirm:

- no ProjectTrace/RoadSync schemas
- no auth endpoints
- no JWT code
- no plaintext credentials
- no destructive DB scripts
- no unrelated UI changes

---

## 52. STEP 12 FINAL REPORT

```text
STEP 12 COMPLETE
Core MongoDB Schema Foundation

STATUS:
✅ Complete / ⚠️ Complete with known limitations

MODELS:
- User
- Role
- Agency
- RefreshSession (if implemented)

FILES CREATED:
- ...

FILES MODIFIED:
- ...

INDEXES:
- ...

ENUMS:
- ...

SEED:
- ...

TESTS:
- ...

CHECKS:
Lint:
Type Check:
Tests:
Build:

SECURITY REVIEW:
- ...

KNOWN LIMITATIONS:
- ...

NEXT:
Step 13 — Complete INFRAOS Database Models
```

---

## 53. STEP 12 ACCEPTANCE CRITERIA

Step 12 is complete only if:

- User model exists
- Role model exists
- Agency model exists
- refresh-session decision is documented/implemented consistently
- email uniqueness/normalization is handled
- role keys are stable
- permissions align with Step 4
- agency scope foundation is valid
- sensitive fields are protected
- no plaintext password/token field exists
- indexes are justified
- seed process is idempotent and safe
- test environment is isolated
- model tests pass
- lint/type-check/build pass
- ProjectTrace/RoadSync models are not prematurely implemented
- authentication endpoints are not implemented

Stop after Step 12.

---

# FINAL STEPS 10–12 CONSISTENCY REVIEW

After all three steps complete, perform one final cross-step review.

Do not begin Step 13.

---

## A. CONFIGURATION CONSISTENCY

Verify:

```text
Web public env
≠
API private env
```

Confirm no backend secrets exist in browser bundles.

---

## B. DATABASE CONFIG CONSISTENCY

Verify:

```text
MONGODB_URI
MONGODB_DB_NAME
```

are sourced through typed config.

No duplicate environment names.

---

## C. CONNECTION CONSISTENCY

Verify:

- one reusable Mongoose connection per process
- graceful shutdown
- safe readiness
- no public DB debug endpoint
- no URI logging

---

## D. MODEL CONSISTENCY

Verify:

```text
User → Role
User → Agency
Agency → Parent Agency
RefreshSession → User
```

if refresh sessions are implemented.

---

## E. RBAC CONSISTENCY

Roles and permission seeds must align with Step 4.

No permission should appear in code/seed that contradicts:

```text
/docs/security/permission-catalog.md
/docs/security/permission-matrix.md
```

---

## F. SCOPE CONSISTENCY

Step 12 must not accidentally create:

```text
projects
milestones
workRequests
conflicts
coordinationRequests
contractors
payments
documents
inspections
assets
issues
notifications
riskAssessments
auditLogs
```

Those belong to later steps.

---

## G. SECURITY CONSISTENCY

Verify:

- no plaintext password
- no plaintext refresh token
- no real secret in Git
- no production DB used for test
- no wildcard production CORS introduced
- no TLS bypass
- no Mongo URI in logs
- no hardcoded Super Admin credentials

---

## H. TESTING CONSISTENCY

Check:

```text
Step 10 env tests
Step 11 DB foundation tests
Step 12 model tests
```

All must use safe configuration.

---

# FINAL REVIEW REPORT

Return:

```text
STEPS 10–12 FOUNDATION REVIEW COMPLETE

STEP 10 — Environment & Secrets:
✅ / ⚠️

STEP 11 — MongoDB Atlas:
✅ / ⚠️

STEP 12 — Core Models:
✅ / ⚠️

ENVIRONMENT:
- ...

DATABASE:
- ...

CONNECTION:
- ...

CORE MODELS:
- ...

INDEXES:
- ...

ROLE/PERMISSION ALIGNMENT:
- ...

SECURITY:
- ...

TEST ISOLATION:
- ...

CHECK RESULTS:
Lint:
Type Check:
Tests:
Build:
DB Check:

SCOPE BOUNDARY:
Project models created? NO
RoadSync models created? NO
Auth endpoints created? NO
JWT issuance created? NO

INCONSISTENCIES FOUND:
- ...

INCONSISTENCIES FIXED:
- ...

KNOWN LIMITATIONS:
- ...

GIT STATUS:
- ...

NEXT STEP:
Step 13 — Complete INFRAOS Database Models
```

---

# FINAL STOP RULE

Do not continue to Step 13 automatically.

Wait for explicit instruction.
