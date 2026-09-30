# INFRAOS — Enhanced Cursor Prompts
## Steps 1–3: Scope Lock, Technology Decisions, and Complete System Architecture

**Project:** INFRAOS — National Infrastructure Intelligence & Coordination Platform  
**Vision:** The Operating System for National Infrastructure  
**Core Lifecycle:** Plan → Coordinate → Approve → Build → Verify → Monitor → Complete → Maintain  
**Development Window:** 45–60 days  
**Development Style:** Incremental, modular, secure, portfolio-worthy, academically strong  
**Primary Development Assistant:** Cursor AI  

---

# HOW TO USE THIS FILE

Use the prompts in this file **in order**.

1. Run **Step 1** first and review the planning output.
2. Only after Step 1 is consistent, run **Step 2**.
3. Then run **Step 3**.
4. Do **not** ask Cursor to start coding the product during these three steps.
5. These steps are intended to create the project’s source-of-truth documentation before implementation starts.
6. If a repository already exists, Cursor must inspect it first and avoid deleting or restructuring working files unless clearly necessary.
7. Store the architecture/planning outputs under `/docs` using the suggested paths in each step.

These first three steps are intentionally architecture-heavy. They establish the standards that every later INFRAOS feature must follow.

---

# GLOBAL PROJECT CONTEXT FOR ALL THREE STEPS

You are working on:

# INFRAOS
## National Infrastructure Intelligence & Coordination Platform

INFRAOS is a centralized platform designed to help government agencies plan, coordinate, monitor, verify, and maintain public infrastructure projects.

The platform should connect and understand relationships between:

- infrastructure projects
- government agencies
- roads
- utilities
- geographic locations
- project schedules
- contractors
- budgets
- milestones
- project documents
- inspections
- project risks
- completed infrastructure assets
- citizen-reported infrastructure issues

The project is not intended to be a basic CRUD system.

Its core value is to reduce problems such as:

- repeated road excavation
- poor coordination between agencies
- overlapping infrastructure work
- avoidable public spending
- project delays
- poor contractor visibility
- weak progress monitoring
- limited project transparency
- unstructured project documents
- poor maintenance planning after completion

A typical end-to-end INFRAOS workflow should eventually support:

```text
Create Infrastructure Project
        ↓
Map Project Location
        ↓
Detect Nearby Infrastructure / Planned Work
        ↓
Detect Geographic or Schedule Conflict
        ↓
Coordinate Relevant Agencies
        ↓
Approve / Reschedule / Resolve Conflict
        ↓
Start Project
        ↓
Track Milestones, Physical Progress, Financial Progress
        ↓
Analyze Risk
        ↓
Manage Documents
        ↓
Verify Progress Through Inspection
        ↓
Complete Project
        ↓
Convert Completed Project into Infrastructure Asset
        ↓
Monitor Condition and Maintenance
```

---

# TEAM LEADER CONTEXT

The team leader is the **Core Platform Developer and System Integrator**.

The team leader’s main technical ownership should remain:

## ProjectTrace
- project lifecycle
- project CRUD
- project statuses
- project milestones
- project progress
- project dependencies
- project timeline
- project dashboard
- project backend APIs

## RoadSync
- work requests
- geographic conflict detection
- schedule overlap detection
- nearby infrastructure detection
- coordination workflows
- conflict approval/resolution
- conflict visualization
- RoadSync business logic

## Core Platform Integration
- architecture
- database standards
- API standards
- authentication integration
- authorization / RBAC standards
- security standards
- Git integration
- deployment integration
- integration between all team modules

Other members may own InfraMap, AI Risk Intelligence, DocTrace/RAG, Finance/Contractor/Asset, and Citizen Portal modules.

The architecture must therefore support **parallel team development without creating disconnected mini-projects**.

---

# GLOBAL DEVELOPMENT PRINCIPLES

These principles are non-negotiable.

## Engineering

Prefer:

- clean code
- modular architecture
- feature-based organization
- clear responsibilities
- reusable components
- TypeScript where applicable
- server-side validation
- centralized errors
- centralized authorization
- proper environment variables
- clear API contracts
- testable business logic
- strong documentation

Avoid:

- premature coding
- huge files
- duplicate components
- hardcoded credentials
- frontend-only security
- unnecessary microservices
- unnecessary dependencies
- overengineering
- Kafka
- Kubernetes
- complex distributed systems
- multiple databases without a real need
- implementing AI just for visual impact

## Priority Order

Always prioritize:

```text
Working
    ↓
Secure
    ↓
Maintainable
    ↓
Professional
    ↓
Scalable
```

## Architecture Direction

Initial INFRAOS should be a:

**Modular monolith with one dedicated AI service**

Target architecture:

```text
Next.js Frontend
      ↓
Node.js / Express API
      ↓
Business Modules
      ↓
MongoDB + External Services
      ↓
FastAPI AI Service where AI is genuinely required
```

Do not convert the project into many independent microservices.

---

# STEP 1 — FINAL PROJECT REQUIREMENT & SCOPE LOCK

## Cursor Prompt

You are acting as a **Senior Software Architect, Product Analyst, Technical Lead, Requirements Engineer, Security Architect, and Academic Project Mentor**.

Your task is to perform **STEP 1: FINAL PROJECT REQUIREMENT & SCOPE LOCK** for INFRAOS.

Do not write application code in this step.

The goal is to create a stable, realistic, unambiguous project definition that will become the source of truth for all later architecture, UI, database, API, AI, security, testing, and development prompts.

---

## 1. FIRST INSPECT THE CURRENT PROJECT

Before creating the requirement document:

1. Inspect the repository if one exists.
2. Read:
   - README
   - `/docs`
   - existing planning files
   - existing package files
   - environment examples
   - current folder structure
3. Identify whether any architecture or implementation has already started.
4. Do not delete or rewrite unrelated existing files.
5. Do not generate production feature code.
6. If there are inconsistencies between existing files and this specification, document them clearly instead of silently choosing one.

If the project does not yet contain code, continue as a planning-only task.

---

# 2. DEFINE THE PROJECT IN SIMPLE ENGLISH

Create a concise but complete project definition covering:

## Project Name

**INFRAOS — National Infrastructure Intelligence & Coordination Platform**

## Vision

**The Operating System for National Infrastructure**

## Core Lifecycle

**Plan → Coordinate → Approve → Build → Verify → Monitor → Complete → Maintain**

Explain:

- what INFRAOS is
- what real-world problem it solves
- why coordination is the central problem
- why location and schedule awareness matter
- how the platform differs from normal project-management software
- why the system continues after project completion through asset management

---

# 3. DEFINE THE MAIN PROBLEM STATEMENT

Document the main real-world problems INFRAOS targets.

At minimum include:

- government infrastructure projects managed in separate systems
- weak coordination between agencies
- repeated excavation of recently completed roads
- overlapping road, water, electricity, telecom and drainage work
- project delays
- budget inefficiency
- limited contractor visibility
- difficulty comparing physical and financial progress
- fragmented documentation
- limited early risk identification
- weak maintenance continuity after project completion
- limited public transparency

Use a practical infrastructure example such as:

```text
A road authority plans resurfacing work.
A water authority has a pipeline project on the same road.
The projects are planned separately.
The road is resurfaced first.
The water authority later excavates the newly completed road.
```

Explain how INFRAOS should prevent or reduce this situation.

---

# 4. DEFINE TARGET USERS

Lock the main user groups:

1. Super Administrator
2. Ministry / Government Administrator
3. Agency Officer
4. Project Manager
5. Contractor
6. Inspector
7. Citizen

For each user define:

- primary responsibility
- main goals
- data they need
- actions they perform
- information they must not access
- relationship with other roles

Do not finalize detailed endpoint permissions yet; that belongs to the later RBAC implementation step.

However, identify the high-level access boundaries now.

---

# 5. DEFINE STAKEHOLDERS

Include stakeholders such as:

- ministries
- road authorities
- water authorities
- electricity providers
- telecom providers
- drainage/local authorities
- infrastructure departments
- contractors
- inspectors
- project managers
- government administrators
- citizens

Explain what value INFRAOS provides to each.

---

# 6. LOCK THE MAIN MODULES

INFRAOS should contain the following major modules.

Do not rename these without a strong architectural reason.

## 6.1 Platform & Identity

Includes:

- authentication
- session management
- users
- roles
- permissions
- agency assignment
- account status

---

## 6.2 ProjectTrace — Project Intelligence

Purpose:

Manage the full infrastructure project lifecycle.

Main features:

- project creation
- project editing
- project details
- project lifecycle
- project statuses
- project approvals
- milestones
- physical progress
- financial progress summary
- project timeline
- project dependencies
- project activity history
- project dashboard
- project permissions

---

## 6.3 RoadSync — Infrastructure Coordination

Purpose:

Detect and resolve infrastructure work conflicts before they create avoidable problems.

Main features:

- work requests
- map/location selection
- GeoJSON geometry
- planned dates
- nearby project detection
- geographic conflict detection
- schedule overlap detection
- affected-agency detection
- conflict classification
- severity
- coordination requests
- agency response
- resolution workflow
- approvals
- coordination history
- conflict visualization

---

## 6.4 InfraMap

Purpose:

Provide geographic intelligence for infrastructure projects.

Main features:

- interactive map
- active project layers
- planned project layers
- completed project layers
- roadwork layers
- utility/infrastructure layers where data is available
- conflict layers
- risk layers
- asset layers
- project markers
- polygons / route geometry
- search
- filters
- map detail drawer
- viewport-based data queries

---

## 6.5 AI Risk Intelligence

Purpose:

Provide decision support before or during project problems.

Main features:

- overall project risk score
- delay risk
- budget risk
- schedule risk
- risk factors
- explanations
- recommendations
- risk history

AI must never make final government decisions automatically.

---

## 6.6 DocTrace

Purpose:

Securely manage and understand project documents.

Main features:

- document upload
- document categorization
- document preview
- document search
- text extraction
- AI summary
- important information extraction
- RAG question answering
- answers with document references

---

## 6.7 Finance & Contractor Intelligence

Purpose:

Track project spending and contractor performance.

Main features:

- project budget
- expenses
- payments
- contractor payments
- financial progress
- contractor profile
- project history
- completed projects
- active projects
- delay/performance indicators
- contractor risk indicators

---

## 6.8 Inspection & Verification

Purpose:

Provide independent verification of reported project progress.

Main features:

- inspector assignment
- inspection scheduling
- inspection report
- site evidence
- photos
- comments
- physical progress verification
- approve/reject/request-review flow
- inspection history

---

## 6.9 Asset Lifecycle

Purpose:

Continue managing infrastructure after project completion.

Main features:

- convert completed project to asset
- asset details
- asset location
- condition
- inspection history
- maintenance history
- maintenance schedule
- infrastructure health score

---

## 6.10 Citizen Infrastructure Portal

Purpose:

Provide public transparency and infrastructure issue reporting.

Main features:

- public projects
- public map
- public project details
- report infrastructure issue
- location
- photo
- issue category
- assigned agency
- issue status
- citizen tracking

---

## 6.11 Notifications

Main features:

- conflict alert
- project-risk alert
- approval request
- milestone alert
- inspection alert
- coordination alert
- citizen issue alert
- read/unread
- notification center

Realtime notifications should only be used where they provide real value.

---

## 6.12 Reporting

Main features:

- project reports
- agency reports
- budget reports
- contractor reports
- status reports
- date filters
- authorized CSV exports
- useful PDF exports

---

## 6.13 Audit & Governance

Main features:

- login history
- critical CRUD actions
- approvals
- rejections
- permission changes
- old values
- new values
- user
- timestamp
- resource
- resource ID

Audit logs must not be editable by normal users.

---

# 7. LOCK THE WINNING / DIFFERENTIATING FEATURES

Document these separately from ordinary CRUD features.

## A. Infrastructure Conflict Simulator

Before approval, evaluate:

- geographic overlap
- nearby work
- date overlap
- affected utilities
- affected agencies
- possible road impact

Example output:

```text
Conflict Risk: HIGH

Detected:
Water pipeline project — 210m away
Schedule overlap — 12 days

Recommendation:
Coordinate underground utility work before final road resurfacing.
```

---

## B. Smart Coordination Recommendation

Do not only detect a conflict.

The system should eventually recommend practical coordination options such as:

- complete underground utility work first
- reschedule one project
- merge compatible work windows
- request confirmation from another agency

This is decision support, not automatic scheduling authority.

---

## C. AI Project Risk Intelligence

Use project data to identify potential:

- delays
- schedule risks
- budget inconsistencies
- milestone problems

Return:

- score
- factors
- explanation
- recommendation

---

## D. DocTrace RAG

Allow authorized users to ask project-document questions.

Example:

```text
What is the contractual completion deadline?
What penalty applies for delay?
What is the warranty period?
```

Answers should use retrieved document context and include references whenever technically possible.

---

## E. Infrastructure Health Score

After completion, use available information such as:

- asset age
- maintenance records
- inspections
- reported issues
- previous repairs

to support maintenance prioritization.

---

## F. AI Physical Progress Verification

This is an enhancement, not the first AI feature.

If implemented:

```text
Reported Progress: 75%
AI Visible Estimate: 63%
Difference: 12%

Action:
Recommend human inspector review.
```

Never label this automatically as fraud.

---

## G. AI Infrastructure Copilot

Potential later feature.

Examples:

```text
Which projects are high risk?
Which projects are more than 30 days delayed?
Which roadworks conflict with planned water projects?
Summarize the contract for project INF-102.
```

This should be built only after the underlying search/RAG/data APIs are stable.

---

# 8. PRIORITY CLASSIFICATION

Create a final priority matrix.

Use:

## P0 — Critical

Must work for INFRAOS to be considered functional.

Required P0:

- authentication
- secure sessions
- RBAC
- user/agency basics
- ProjectTrace
- milestones
- project progress
- RoadSync
- GeoJSON infrastructure work
- nearby-work detection
- schedule conflict detection
- coordination workflow
- conflict resolution
- InfraMap project/work/conflict layers
- audit logging of critical actions

---

## P1 — Important

Should be completed.

Expected:

- AI risk score
- DocTrace
- secure document upload
- RAG
- contractor management
- inspection
- finance overview
- notifications
- citizen issue reporting
- Infrastructure Conflict Simulator

---

## P2 — Enhancement

Implement after P0 and P1 are stable.

Potential:

- dark mode
- advanced reports
- AI image progress estimation
- infrastructure health score
- agency coordination score
- advanced contractor scoring
- email notifications
- advanced GIS heatmaps
- infrastructure copilot
- OAuth

---

## P3 — Future

Do not build during the initial 45–60 day implementation unless all higher priorities are stable.

Examples:

- IoT sensors
- drone analysis
- satellite analysis
- national digital twin
- predictive maintenance
- traffic simulation
- advanced procurement-fraud network analysis
- full tender intelligence
- native mobile apps

---

# 9. DEFINE THE MVP BOUNDARY

Create an explicit:

## IN MVP
## OUT OF MVP
## FUTURE

The MVP must center on this working story:

```text
Create Project
→ Map Project
→ Create Work Request
→ Detect Conflict
→ Coordinate Agency
→ Resolve Conflict
→ Track Project Progress
→ View Project on Map
→ Maintain Audit History
```

AI should strengthen this system but must not be required for the primary platform to operate.

---

# 10. FUNCTIONAL REQUIREMENTS

Create numbered functional requirements using IDs.

Example:

```text
FR-AUTH-001
FR-PROJECT-001
FR-ROADSYNC-001
FR-MAP-001
FR-DOC-001
```

Each requirement should include:

- ID
- description
- actor
- precondition
- expected behavior
- success condition
- priority
- related module

Cover all major modules.

Do not write hundreds of microscopic requirements.

Focus on implementation-relevant requirements.

---

# 11. NON-FUNCTIONAL REQUIREMENTS

Define realistic requirements for:

- security
- performance
- accessibility
- responsive design
- maintainability
- auditability
- usability
- scalability
- availability
- observability
- data privacy
- AI reliability
- file security
- map performance

Avoid fake enterprise requirements such as “support 100 million users” without evidence.

Use realistic academic/portfolio targets.

---

# 12. BUSINESS RULES

Define important cross-module rules.

Examples:

- contractor cannot approve own work
- citizen cannot view confidential documents
- project manager cannot automatically access every government project
- completed project can become infrastructure asset
- project cannot be marked completed if required completion validation fails
- conflict resolution must be auditable
- sensitive updates must record actor and timestamp
- AI recommendation never equals automatic official approval
- server determines authorization, never frontend role values

Identify other important rules.

---

# 13. PROJECT STATES

Define lifecycle states for:

## Projects
Example:

```text
DRAFT
SUBMITTED
UNDER_REVIEW
APPROVED
ACTIVE
ON_HOLD
DELAYED
COMPLETED
CANCELLED
```

## Work Requests

## Conflicts

## Coordination Requests

## Milestones

## Inspections

## Citizen Issues

## Payments

## Documents Processing

Do not over-create states.

For each state machine, describe valid transitions.

---

# 14. CORE USER WORKFLOWS

Document at least:

1. Government officer creates project
2. Project approval
3. Create RoadSync work request
4. Detect conflict
5. Coordinate agencies
6. Resolve conflict
7. Track milestones
8. Update physical progress
9. Inspector verifies progress
10. Upload project document
11. Ask DocTrace question
12. Run risk analysis
13. Complete project
14. Convert project to asset
15. Citizen reports infrastructure issue
16. Agency handles citizen issue

Use simple Mermaid diagrams where useful.

---

# 15. EDGE CASE INVENTORY

Document important edge cases.

At minimum consider:

- duplicate project code
- invalid coordinates
- start date after end date
- overlapping but unrelated map geometries
- project deleted while referenced
- cancelled project with active conflict
- unauthorized agency access
- expired session
- duplicate coordination request
- simultaneous updates
- file upload failure
- AI API unavailable
- map API unavailable
- database unavailable
- empty project list
- very large result set
- invalid ObjectId
- archived/deactivated user
- contractor removed from project
- completed project edited unexpectedly

---

# 16. ASSUMPTIONS AND OPEN QUESTIONS

Create:

```text
Confirmed Requirement
Assumption
Open Question
Decision Needed Later
```

Do not invent government datasets that we do not actually have.

If utility GIS data is unavailable, clearly document that prototype/demo data may be used.

---

# 17. SCOPE-CREEP PROTECTION

Explicitly document what must NOT happen.

Examples:

- do not add unrelated government modules
- do not turn INFRAOS into a generic ERP
- do not add microservices for appearance
- do not build advanced CV before core RoadSync works
- do not build national digital twin in MVP
- do not make every notification realtime
- do not create AI features without a clear problem
- do not let P2/P3 delay P0

---

# 18. STEP 1 REQUIRED DELIVERABLES

Create/update:

```text
/docs/planning/project-scope.md
/docs/planning/requirements.md
/docs/planning/mvp-priorities.md
/docs/planning/user-workflows.md
/docs/planning/business-rules.md
/docs/planning/assumptions-risks.md
```

If the folders do not exist, create only these documentation folders.

Do not scaffold application modules in this step.

---

# 19. REQUIRED OUTPUT SUMMARY IN TERMINAL/CHAT

At the end, return:

```text
STEP 1 COMPLETE

Created/Updated:
- ...

Locked Decisions:
- ...

P0 Modules:
- ...

P1 Modules:
- ...

Deferred Features:
- ...

Open Questions:
- ...

Risks:
- ...

No application feature code was created: YES/NO
```

If application feature code was accidentally changed, explain exactly why.

---

# 20. STEP 1 ACCEPTANCE CRITERIA

Step 1 is complete only if:

- the problem is clearly defined
- user roles are clear
- all major modules are defined
- main sub-features are identified
- winning features are separated from basic functionality
- P0/P1/P2/P3 priorities exist
- MVP boundary exists
- business rules exist
- key workflows exist
- important states exist
- edge cases are documented
- assumptions and open questions are visible
- scope-creep protections exist
- team-leader ownership is preserved
- no major implementation has started

Do not continue to Step 2 automatically.

Stop after Step 1 and wait for the next instruction.

---

---

# STEP 2 — FINAL TECHNOLOGY STACK & ARCHITECTURE DECISIONS

## Cursor Prompt

You are acting as a **Senior Software Architect, Full-Stack Architect, Database Architect, Security Architect, DevOps Engineer, and AI Systems Architect**.

Perform:

# STEP 2 — FINAL TECHNOLOGY STACK & ARCHITECTURE DECISIONS

Use the Step 1 planning documents as the source of truth.

Do not implement application features yet.

The goal is to decide exactly which technologies INFRAOS will use, why they are appropriate, what responsibilities they have, and which alternatives are intentionally rejected.

---

# 1. INSPECT STEP 1 OUTPUT

Before making technology decisions:

Read:

```text
/docs/planning/project-scope.md
/docs/planning/requirements.md
/docs/planning/mvp-priorities.md
/docs/planning/user-workflows.md
/docs/planning/business-rules.md
/docs/planning/assumptions-risks.md
```

Also inspect any existing:

- `package.json`
- lock files
- Docker files
- environment examples
- existing app configuration

Do not assume an empty repository.

If current implementation conflicts with the locked plan, document it.

---

# 2. LOCK THE ARCHITECTURAL STYLE

INFRAOS Version 1 should use:

# Modular Monolith + Dedicated AI Service

Main application:

```text
Next.js Frontend
        ↓
Node.js / Express API
        ↓
Feature Modules / Business Services
        ↓
MongoDB + Storage + Map Provider
```

AI:

```text
Node API
   ↓
Private/Internal AI Request
   ↓
FastAPI AI Service
   ↓
Risk / RAG / Embeddings / Optional Vision
```

Explain why this is preferred over microservices for a 45–60 day university/portfolio project.

Explicitly reject unnecessary use of:

- Kubernetes
- Kafka
- RabbitMQ
- service mesh
- many databases
- many independent backend services
- event sourcing
- CQRS unless a clear requirement appears later

---

# 3. FRONTEND TECHNOLOGY DECISIONS

Evaluate and lock:

## Framework

**Next.js + React + TypeScript**

Use modern stable Next.js patterns.

Prefer App Router unless existing project structure gives a strong reason not to.

Explain responsibilities:

- routing
- layouts
- loading/error boundaries
- page composition
- server/client component decisions
- optimized assets where useful

Do not place core authorization logic only in frontend components.

---

## Styling

**Tailwind CSS**

Use:

- centralized theme tokens
- responsive utilities
- consistent spacing
- reusable style patterns

Avoid random one-off colors.

---

## UI Components

**shadcn/ui**

Use as a foundation, not as an untouched default design.

Customize to INFRAOS brand.

Expected reusable primitives include:

- button
- input
- textarea
- select
- checkbox
- radio
- dialog
- alert dialog
- sheet
- dropdown
- tooltip
- popover
- tabs
- card
- table
- badge
- toast
- skeleton
- command palette where useful

---

## Forms

**React Hook Form + Zod**

Responsibilities:

- controlled validation strategy
- accessible form errors
- frontend validation
- shared schema patterns where practical

Server-side validation remains mandatory.

---

## Server State

**TanStack Query**

Use for:

- API requests
- mutations
- caching
- invalidation
- background refetching where useful
- loading/error handling

Do not use a global store to duplicate server data.

---

## Client State

**Zustand only where genuinely useful**

Suitable for:

- sidebar state
- user UI preferences
- temporary map UI filters
- cross-component view state

Do not store large server datasets unnecessarily.

---

## Mapping

Prefer:

**MapLibre GL + OpenStreetMap-compatible tiles**

Reasons:

- appropriate for prototype
- flexible GIS layers
- GeoJSON support
- reduced dependence on expensive proprietary services

Keep provider abstraction flexible enough to move to Mapbox later if required.

Document:

- project point/line/polygon support
- work request geometry
- conflict visualization
- asset visualization
- viewport queries
- map filters

---

## Animation

Use:

**GSAP only where it improves UX**

Primarily:

- landing page hero
- workflow
- statistics
- map preview
- selected transitions

Do not use GSAP for every dashboard element.

Respect:

```css
prefers-reduced-motion
```

---

# 4. BACKEND TECHNOLOGY DECISIONS

Lock:

**Node.js + Express.js + TypeScript**

Use a modular monolith.

Recommended request flow:

```text
Route
↓
Middleware
↓
Controller
↓
Service
↓
Repository
↓
Database
```

Responsibilities:

## Route
- endpoint registration
- middleware composition

## Controller
- HTTP concerns
- request/response handling
- no large business logic

## Service
- business rules
- orchestration
- transactions/workflows

## Repository
- data-access logic
- reusable database queries

## Middleware
- authentication
- authorization
- validation
- rate limits
- logging
- error processing

Document when a repository layer is useful and avoid ceremonial abstraction if a simple module does not need it.

---

# 5. DATABASE DECISION

Use:

# MongoDB Atlas

Reasons:

- Node ecosystem compatibility
- flexible infrastructure project structures
- GeoJSON
- `2dsphere` spatial indexing
- easy academic deployment
- suitable for current timeline

Use:

**Mongoose** unless an existing project already has a different well-justified MongoDB ODM.

Document:

- model conventions
- timestamps
- indexes
- unique constraints
- references
- GeoJSON
- soft deletion only where appropriate
- audit references
- pagination strategy

Important future note:

PostgreSQL + PostGIS may be better for a future large-scale government GIS platform.

Do not migrate Version 1 simply for theoretical future scale.

---

# 6. AUTHENTICATION DECISION

Use:

# Short-lived Access Token + Secure Refresh Session

Recommended approach:

- JWT access token
- refresh token in HTTP-only secure cookie
- refresh-token rotation
- password hashing
- session invalidation
- backend RBAC
- resource-level authorization

Do not store long-lived sensitive tokens in localStorage if avoidable.

Document:

- login
- refresh
- logout
- password reset
- email verification
- disabled users
- expired sessions

MFA and OAuth remain P2 unless required.

---

# 7. AUTHORIZATION DECISION

Use:

**RBAC + Resource-Level Authorization**

RBAC answers:

> Can this role perform this type of action?

Resource authorization answers:

> Can this specific user perform the action on this specific project/agency/document?

Example:

A project manager may have permission to edit projects but still must not edit an unrelated agency’s restricted project.

Backend is the security authority.

Frontend route guards are UX only.

---

# 8. AI ARCHITECTURE DECISION

Use:

# Python + FastAPI

AI service responsibilities may include:

- project risk analysis
- document text processing
- embeddings
- retrieval
- RAG
- optional later image-progress analysis

Do not put normal CRUD/business rules in FastAPI.

The Node backend remains the system-of-record application layer.

---

## AI Provider Abstraction

Do not hardcode business logic to one model vendor.

Create an architecture capable of supporting:

- OpenRouter
- Gemini
- OpenAI-compatible providers
- Qwen/open-source providers

Later implementation may start with one provider.

Provider switching should happen behind an AI provider interface/service.

---

# 9. RAG DECISION

DocTrace RAG should follow:

```text
Upload Document
↓
Secure Storage
↓
Text Extraction
↓
Cleaning
↓
Chunking
↓
Embedding
↓
Vector Storage
↓
Retrieve Relevant Chunks
↓
LLM
↓
Answer + References
```

Decide the simplest practical vector approach.

Options to evaluate:

- Qdrant
- Supabase pgvector
- another simple managed vector store
- provider-native embeddings with a compatible store

Choose only one for the initial implementation.

Explain:

- why
- operational complexity
- free/low-cost availability
- local development implications

Do not add multiple vector databases.

---

# 10. FILE STORAGE DECISION

Evaluate:

- Cloudinary
- Supabase Storage
- S3-compatible storage

Choose one primary option for Version 1.

Requirements:

- private project documents
- site evidence images
- citizen issue images
- controlled access
- file size validation
- MIME validation
- random storage names
- signed/authorized access where needed

Explain why the chosen service is appropriate.

---

# 11. REALTIME DECISION

Use **Socket.IO only for selected events**, for example:

- new conflict alert
- coordination request
- approval update
- major project alert

Do not make standard CRUD pages dependent on WebSocket.

Normal APIs remain REST.

---

# 12. API STYLE

Use:

# REST API

Base:

```text
/api/v1
```

Standards:

- nouns in route names
- consistent pagination
- filters through query parameters
- centralized validation
- consistent success/error structure
- correct HTTP methods
- correct status codes
- versioning
- idempotency awareness for sensitive actions
- authorization on every protected operation

Define the standard response format.

Example success shape:

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

Example error shape:

```json
{
  "success": false,
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "Project not found",
    "details": null
  }
}
```

Do not expose stack traces.

---

# 13. VALIDATION DECISION

Use Zod or a consistent TypeScript validation strategy on backend.

Requirements:

- validate params
- validate query strings
- validate request bodies
- validate IDs
- validate enums/statuses
- validate dates
- validate budgets
- validate coordinates
- validate file metadata

Frontend validation improves UX.

Backend validation provides security and integrity.

---

# 14. SECURITY TECHNOLOGY DECISIONS

Plan for:

- Argon2id or bcrypt for passwords
- Helmet
- CORS allowlist
- rate limiting
- request-size limits
- secure cookies
- HTTPS production
- backend RBAC
- resource authorization
- sanitized MongoDB query construction
- file validation
- audit logging
- centralized error handling
- secrets in environment variables

AI-specific security:

- prompt size limit
- token limit
- authorized AI endpoints
- cost controls
- sensitive data minimization
- prompt-injection awareness
- document instruction isolation
- model failure fallback

---

# 15. TESTING STACK DECISIONS

Select a practical stack.

Recommended direction:

Frontend/unit:
- Vitest where suitable

Backend/unit/integration:
- Vitest or Jest
- Supertest for API testing

E2E:
- Playwright

Document a consistent choice.

Testing categories:

- unit
- integration
- E2E
- RBAC
- security
- UAT

Do not build an overcomplicated test infrastructure.

---

# 16. DOCUMENTATION / API TOOLING

Choose appropriate tools for:

- OpenAPI/Swagger
- Markdown architecture documentation
- Mermaid diagrams
- environment documentation

API documentation should be capable of describing:

- route
- method
- auth
- permissions
- request
- response
- validation
- errors

---

# 17. LOGGING & MONITORING DECISIONS

Application logging:

Choose a lightweight Node logger such as Pino/Winston.

Error monitoring:

Evaluate Sentry.

Uptime:

Evaluate UptimeRobot or equivalent.

Database:

MongoDB Atlas monitoring.

Frontend:

Vercel logs/analytics as appropriate.

Do not implement expensive enterprise observability.

---

# 18. DEPLOYMENT DECISION

Initial deployment:

## Frontend
Vercel

## Backend
Render or Railway

Choose one primary backend target.

## AI Service
Render or Railway

Prefer the same provider where possible to reduce operational complexity.

## Database
MongoDB Atlas

## Storage
Chosen storage provider

Document:

- development
- staging if practical
- production

At minimum, production secrets must be separate.

---

# 19. CI/CD DECISION

GitHub Actions should eventually run:

```text
install
lint
type-check
unit tests
integration tests where practical
build
```

Do not deploy failed builds.

---

# 20. DEPENDENCY RULES

Create explicit dependency guidelines:

- no package without a clear purpose
- no duplicate library solving same problem
- prefer mature libraries
- do not introduce deprecated packages
- avoid large dependencies for trivial utilities
- document major package decisions
- security-sensitive libraries must be kept updated

---

# 21. CREATE ARCHITECTURE DECISION RECORDS

Create ADRs for at least:

```text
ADR-001 Modular Monolith
ADR-002 Next.js Frontend
ADR-003 Express + TypeScript Backend
ADR-004 MongoDB + GeoJSON
ADR-005 REST API
ADR-006 JWT Access + Refresh Session
ADR-007 RBAC + Resource Authorization
ADR-008 FastAPI AI Service
ADR-009 MapLibre GIS
ADR-010 File Storage Provider
ADR-011 RAG / Vector Store Choice
ADR-012 Deployment Strategy
```

Each ADR should contain:

```text
Context
Decision
Reasons
Alternatives Considered
Trade-offs
Consequences
Future Revisit Conditions
```

---

# 22. STEP 2 REQUIRED DELIVERABLES

Create/update:

```text
/docs/architecture/technology-stack.md
/docs/architecture/architecture-decisions.md
/docs/architecture/dependency-rules.md
/docs/architecture/security-decisions.md
/docs/architecture/ai-decisions.md
/docs/architecture/deployment-decisions.md
/docs/adr/ADR-001-modular-monolith.md
...
```

Create one ADR file per major decision if practical.

Do not initialize application code unless the repository already contains it and a tiny configuration inspection fix is absolutely necessary.

---

# 23. REQUIRED OUTPUT SUMMARY

Return:

```text
STEP 2 COMPLETE

Frontend:
Backend:
Database:
Mapping:
Authentication:
Authorization:
AI Service:
AI Provider Strategy:
Vector Store:
Storage:
Realtime:
Testing:
Deployment:
Monitoring:

Major ADRs Created:
- ...

Rejected Complexity:
- ...

Risks / Trade-offs:
- ...

Application feature code created: YES/NO
```

---

# 24. STEP 2 ACCEPTANCE CRITERIA

Step 2 is complete only if:

- every major technology has a clear purpose
- frontend stack is locked
- backend stack is locked
- database is locked
- map solution is locked
- auth approach is locked
- authorization approach is locked
- AI responsibilities are separated correctly
- vector strategy is selected
- storage is selected
- testing strategy exists
- deployment strategy exists
- security technologies are identified
- dependency rules exist
- architectural trade-offs are documented
- unnecessary complexity is rejected
- ADRs are created
- no major feature coding has started

Do not automatically continue to Step 3.

Stop and wait for the next instruction.

---

---

# STEP 3 — COMPLETE SYSTEM ARCHITECTURE

## Cursor Prompt

You are acting as a **Principal Software Architect, Backend Architect, Frontend Architect, Database Architect, Security Architect, Integration Architect, AI Architect, and DevOps Architect**.

Perform:

# STEP 3 — COMPLETE SYSTEM ARCHITECTURE

Use Step 1 and Step 2 documentation as the source of truth.

Do not implement product features in this step.

The goal is to create a complete architecture blueprint that all team members can follow without creating inconsistent modules.

---

# 1. INSPECT ALL PREVIOUS PLANNING DOCUMENTS

Read:

```text
/docs/planning/*
/docs/architecture/*
/docs/adr/*
```

Also inspect the repository if code already exists.

Identify contradictions before writing new architecture documentation.

Do not silently replace decisions from Step 2.

If an architecture change is required, create a new ADR or clearly mark the previous decision as superseded.

---

# 2. DEFINE THE SYSTEM CONTEXT

Create a high-level system-context diagram.

Actors:

- Super Admin
- Government Admin
- Agency Officer
- Project Manager
- Contractor
- Inspector
- Citizen

External systems/services:

- Map tiles / GIS provider
- MongoDB Atlas
- File storage
- AI model provider
- Vector storage
- email provider if later needed
- monitoring/error service

Show which users access public vs authenticated surfaces.

Use Mermaid.

---

# 3. DEFINE THE HIGH-LEVEL ARCHITECTURE

The intended architecture should remain conceptually:

```text
Users
  ↓
Next.js Web Application
  ↓
Node.js + Express REST API
  ↓
Authentication / Authorization / Validation
  ↓
Business Modules
  ├── Identity
  ├── Agencies
  ├── ProjectTrace
  ├── RoadSync
  ├── InfraMap API
  ├── Contractors
  ├── Finance
  ├── Documents
  ├── Inspections
  ├── Assets
  ├── Citizen Issues
  ├── Notifications
  ├── Reports
  └── Audit
  ↓
MongoDB / Storage / Map Services
  ↓
FastAPI AI Service for AI workloads
```

Create a clear Mermaid architecture diagram.

---

# 4. DEFINE APPLICATION BOUNDARIES

Create explicit boundaries between:

## Frontend
Responsible for:

- presentation
- user interactions
- forms
- route UX
- client validation
- API consumption
- caching
- map rendering
- accessibility
- responsive design

Frontend must not:

- determine real permissions
- trust user-supplied role
- expose secrets
- access MongoDB directly
- call private AI service directly unless architecture explicitly allows a safe endpoint

---

## Node Backend
Responsible for:

- API
- authentication
- authorization
- business rules
- database access
- workflow orchestration
- audit events
- file authorization
- AI request authorization
- notification orchestration

---

## MongoDB
Responsible for:

- source-of-record application data
- relationships/references
- GeoJSON
- indexes
- state persistence

---

## Storage
Responsible for:

- project documents
- inspection evidence
- citizen issue images

Store metadata/ownership in MongoDB.

---

## FastAPI AI Service
Responsible for:

- risk analysis
- document processing
- RAG
- embeddings orchestration
- optional future vision analysis

AI service must not independently decide user authorization.

Node backend validates authorization first.

---

# 5. DEFINE BACKEND MODULE ARCHITECTURE

Define the module pattern.

Suggested structure:

```text
module/
├── module.routes.ts
├── module.controller.ts
├── module.service.ts
├── module.repository.ts
├── module.model.ts
├── module.schema.ts
├── module.types.ts
├── module.constants.ts
├── module.errors.ts
└── __tests__/
```

Not every module needs every file.

Avoid empty ceremonial files.

Define responsibilities clearly.

---

# 6. DEFINE ALL BACKEND DOMAIN MODULES

Architecture must plan for:

1. auth
2. users
3. roles
4. permissions
5. agencies
6. projects
7. milestones
8. project progress
9. work requests
10. conflicts
11. coordination requests
12. map queries
13. contractors
14. finance/payments
15. documents
16. inspections
17. assets
18. maintenance
19. risk assessments
20. citizen issues
21. notifications
22. reports
23. audit logs

Explain module dependencies.

Avoid circular dependencies.

---

# 7. DEFINE FRONTEND ARCHITECTURE

Use feature-oriented organization.

Conceptually:

```text
src/
├── app/
├── components/
│   ├── ui/
│   ├── layout/
│   ├── common/
│   └── feedback/
├── features/
│   ├── auth/
│   ├── projects/
│   ├── roadsync/
│   ├── map/
│   ├── contractors/
│   ├── finance/
│   ├── documents/
│   ├── inspections/
│   ├── assets/
│   ├── citizen/
│   ├── notifications/
│   └── reports/
├── hooks/
├── lib/
├── services/
├── types/
└── styles/
```

Define:

- page composition
- feature components
- shared components
- API service layer
- query hooks
- form schemas
- layout boundaries
- role-aware navigation
- client/server component rules

Do not put all logic inside Next.js page files.

---

# 8. DEFINE REQUEST FLOW

Document this flow:

```text
User Action
↓
Frontend Form / Component
↓
Client Validation
↓
API Client
↓
Express Route
↓
Authentication Middleware
↓
Authorization Middleware
↓
Validation Middleware
↓
Controller
↓
Service
↓
Repository
↓
MongoDB
↓
Service Result
↓
Controller Response
↓
TanStack Query Cache Update
↓
UI Feedback
```

Include:

- loading
- success
- validation error
- authorization error
- server error
- retry behavior

---

# 9. DEFINE AUTHENTICATION FLOW

Create sequence diagrams for:

## Login

```text
Browser
→ API
→ Find User
→ Check Status
→ Verify Password
→ Create Access Token
→ Create Refresh Session
→ Set HTTP-only Cookie
→ Return Safe User + Access Token
```

## Refresh

## Logout

## Forgot Password

## Reset Password

## Email Verification

Document trust boundaries.

---

# 10. DEFINE AUTHORIZATION FLOW

Document:

```text
Authenticated?
↓
Role Permission?
↓
Resource Access?
↓
Business Rule Allowed?
↓
Perform Action
↓
Audit if Sensitive
```

Examples:

- project manager edits assigned project
- contractor updates only assigned progress data
- inspector verifies project but cannot approve contractor payment
- citizen accesses only public project information
- government admin access is organization-scoped
- super admin has platform-level administration

Do not rely only on frontend route guards.

---

# 11. DEFINE PROJECTTRACE ARCHITECTURE

Document boundaries for:

- projects
- milestones
- progress
- dependencies
- timeline/events
- approvals
- dashboard aggregations
- activity history

Define:

- which module owns project status
- how milestones relate to progress
- how financial progress is read
- how risk assessment references project
- how inspections reference project
- how documents reference project

Avoid duplicating project status logic across modules.

---

# 12. DEFINE ROADSYNC ARCHITECTURE

This is a core differentiator and needs detailed architecture.

Document:

## Work Request

Input:

- project
- agency
- work type
- geometry
- planned start
- planned end
- priority

## Nearby Detection

Use MongoDB GeoJSON + `2dsphere`.

Conceptually:

```text
New Work Geometry
↓
Spatial Query
↓
Nearby / Intersecting Work
↓
Filter Relevant Date Windows
↓
Create Conflict Candidates
```

## Conflict Engine

Evaluate:

- spatial relationship
- distance
- date overlap
- infrastructure category
- affected agencies
- severity rules

## Conflict Record

Must store:

- involved work requests/projects
- conflict type
- severity
- detected time
- status
- resolution
- actor
- audit history

## Coordination Workflow

```text
Conflict Detected
↓
Coordination Request
↓
Other Agency Responds
↓
Proposal / Reschedule / Accept
↓
Authorized Resolution
↓
Conflict Closed
↓
Audit Log
```

Separate deterministic conflict logic from AI recommendation logic.

Core RoadSync must work without AI.

---

# 13. DEFINE INFRAMAP ARCHITECTURE

Map data should not load the entire database.

Use viewport/bounding-box queries.

Architecture:

```text
Map View Changes
↓
Frontend Calculates Bounds
↓
GET Map Data with Bounds + Filters
↓
Backend Queries Spatial Indexes
↓
Returns Simplified GeoJSON
↓
Frontend Renders Layers
```

Plan layers:

- projects
- work requests
- conflicts
- assets
- risk visualization

Document clustering/simplification as later performance options.

---

# 14. DEFINE DOCUMENT / FILE ARCHITECTURE

Flow:

```text
Authorized User
↓
Request Upload
↓
Validate Metadata
↓
Validate MIME / Size
↓
Upload to Secure Storage
↓
Save Metadata in MongoDB
↓
Audit Upload
↓
Optionally Queue / Trigger AI Processing
```

Download/preview:

```text
Request File
↓
Authenticate
↓
Authorize Access to Related Project
↓
Generate / Return Controlled Access
```

Never expose confidential storage objects by default.

---

# 15. DEFINE DOCTRACE + RAG ARCHITECTURE

Flow:

```text
Document Uploaded
↓
Text Extraction
↓
Cleaning
↓
Chunking
↓
Embedding
↓
Vector Index
```

Query:

```text
Authorized User Question
↓
Node API Authorization
↓
FastAPI RAG Endpoint
↓
Embed Question
↓
Retrieve Relevant Chunks
↓
Construct Controlled Prompt
↓
LLM
↓
Structured Answer + References
↓
Node API
↓
User
```

Document:

- failure fallback
- unsupported document
- empty extraction
- no relevant chunks
- model unavailable
- rate limit
- hallucination warning
- source references

---

# 16. DEFINE AI RISK ARCHITECTURE

Core principle:

AI assists; application continues without it.

Flow:

```text
Authorized Risk Request
↓
Node Collects Approved Project Features
↓
Sanitize / Minimize Data
↓
FastAPI Risk Endpoint
↓
Risk Logic / Model
↓
Structured Result
↓
Validate Schema
↓
Persist Risk Assessment
↓
Display Score + Reasons + Recommendations
```

Never allow free-form model output to directly change official project status.

---

# 17. DEFINE NOTIFICATION ARCHITECTURE

Use event-like internal service calls without introducing message-broker complexity.

Example:

```text
Conflict Created
↓
Notification Service
↓
Create Notification Record
↓
Optional Socket.IO Push
```

Notification categories:

- conflict
- coordination
- risk
- milestone
- approval
- inspection
- citizen issue

Database notification remains source of truth.

Realtime delivery is enhancement.

---

# 18. DEFINE AUDIT ARCHITECTURE

Sensitive actions should produce immutable-style audit records.

Capture where appropriate:

- actor
- action
- resource
- resource ID
- timestamp
- old values
- new values
- request metadata

Examples:

- project approval
- project budget update
- role change
- conflict resolution
- contractor assignment
- inspection verification
- sensitive document deletion

Do not log passwords, tokens, or unnecessary sensitive payloads.

---

# 19. DEFINE ERROR ARCHITECTURE

Create standard application errors.

Categories:

- validation
- authentication
- authorization
- not found
- conflict
- business rule
- external service
- database
- AI service

Define:

- internal error code
- safe user message
- HTTP status
- log severity

Do not return:

- stack traces
- secrets
- raw MongoDB errors
- internal service credentials

---

# 20. DEFINE LOGGING ARCHITECTURE

Separate:

## Application Logs
Operational/debug/server events.

## Audit Logs
Business/governance actions.

Do not treat them as the same thing.

Use correlation/request IDs where practical.

---

# 21. DEFINE DATABASE ARCHITECTURE

Create a conceptual collection relationship diagram.

Plan collections:

```text
users
roles
agencies
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
refreshSessions
```

Do not finalize every field yet; detailed schemas come in later database steps.

However document:

- ownership
- key relationships
- expected indexes
- GeoJSON collections
- unique identifiers
- high-query collections

---

# 22. DEFINE TRANSACTION / CONSISTENCY BOUNDARIES

Identify operations that may require transactional or carefully coordinated writes.

Examples:

- resolving conflict + status history + audit
- completing project + creating asset
- approval + audit + notification
- password reset + session invalidation
- payment approval + audit

Do not use transactions for every CRUD action.

---

# 23. DEFINE API ARCHITECTURE

Plan major endpoint groups:

```text
/api/v1/auth
/api/v1/users
/api/v1/roles
/api/v1/agencies
/api/v1/projects
/api/v1/milestones
/api/v1/work-requests
/api/v1/conflicts
/api/v1/coordination
/api/v1/map
/api/v1/contractors
/api/v1/payments
/api/v1/documents
/api/v1/inspections
/api/v1/assets
/api/v1/issues
/api/v1/notifications
/api/v1/reports
/api/v1/audit
/api/v1/ai
```

Do not build them yet.

Document naming and conventions.

---

# 24. DEFINE FRONTEND PAGE ARCHITECTURE

Plan:

## Public

```text
/
/about
/features
/how-it-works
/public-projects
/public-projects/[id]
/public-map
/report-issue
/faq
/contact
```

## Auth

```text
/login
/register
/verify-email
/forgot-password
/reset-password
```

## Protected Application

```text
/dashboard

/projects
/projects/new
/projects/[id]
/projects/[id]/overview
/projects/[id]/timeline
/projects/[id]/milestones
/projects/[id]/documents
/projects/[id]/finance
/projects/[id]/inspections
/projects/[id]/risks

/roadsync
/roadsync/new
/roadsync/conflicts
/roadsync/conflicts/[id]

/map

/contractors
/contractors/[id]

/assets
/assets/[id]

/documents
/issues
/reports
/notifications
/profile
/settings
```

## Admin

```text
/admin
/admin/users
/admin/agencies
/admin/roles
/admin/audit-logs
/admin/system
```

## Errors

```text
403
404
500
maintenance
```

Document which roles need which navigation areas.

---

# 25. DEFINE DEPLOYMENT ARCHITECTURE

Create Mermaid deployment diagram.

Target:

```text
Browser
↓
Vercel — Next.js
↓ HTTPS
Render/Railway — Express API
├── MongoDB Atlas
├── Storage
├── Map Services
└── Render/Railway — FastAPI AI
        └── Model Provider / Vector Store
```

Document:

- CORS boundary
- secure cookie considerations
- production environment variables
- HTTPS
- service-to-service secret
- staging if practical

---

# 26. DEFINE SECURITY TRUST BOUNDARIES

Create a threat/trust-boundary diagram.

Trust boundaries:

- browser is untrusted
- public API input is untrusted
- uploaded files are untrusted
- model responses are untrusted
- document contents are untrusted
- frontend role values are untrusted
- Node backend is the main enforcement boundary
- database credentials are private
- AI service should accept only authorized internal requests

Document major threats:

- XSS
- CSRF depending on auth design
- brute force
- IDOR
- privilege escalation
- malicious file upload
- MongoDB injection/operator injection
- exposed secrets
- API abuse
- prompt injection
- data leakage
- model hallucination

---

# 27. DEFINE SCALABILITY PATH WITHOUT OVERENGINEERING

Document how Version 1 could scale later without building it now.

Possible future evolution:

- Redis cache if needed
- background job queue if document processing becomes heavy
- PostgreSQL/PostGIS evaluation for national GIS
- object storage/CDN refinement
- separate reporting service only if justified
- dedicated search index only if required
- horizontal API scaling

Clearly mark these as future options.

Do not implement them now.

---

# 28. DEFINE TEAM INTEGRATION BOUNDARIES

Because several team members will work in parallel, document ownership.

Suggested:

```text
Team Leader:
Core architecture
ProjectTrace
RoadSync
Integration
API/security standards
Deployment integration

Member 2:
InfraMap

Member 3:
AI Risk

Member 4:
DocTrace + RAG

Member 5:
Finance + Contractor + Asset

Member 6:
Citizen Portal + Issues
```

For each module define:

- public interfaces
- shared types
- database ownership
- API namespace
- dependencies
- what the module must not directly modify

Goal:

avoid teammates editing the same core files unnecessarily.

---

# 29. DEFINE ARCHITECTURE QUALITY RULES

Add explicit rules.

Examples:

- no cross-module database writes without service ownership
- no business logic in route files
- no database access from frontend
- no direct AI provider call from frontend
- no role trust from client input
- no hardcoded secrets
- no duplicate API clients
- no giant shared utility dumping ground
- no circular module dependency
- no unnecessary global state
- no silent error swallowing
- no external service dependency without fallback behavior

---

# 30. CREATE ARCHITECTURE DIAGRAMS

At minimum produce Mermaid diagrams for:

1. System Context
2. High-Level Architecture
3. Backend Request Flow
4. Authentication Flow
5. Authorization Flow
6. RoadSync Conflict Flow
7. InfraMap Data Flow
8. File Upload Flow
9. RAG Flow
10. AI Risk Flow
11. Notification Flow
12. Deployment Architecture
13. Conceptual Data Relationships

Ensure diagrams compile.

---

# 31. STEP 3 REQUIRED DELIVERABLES

Create/update:

```text
/docs/architecture/system-context.md
/docs/architecture/system-architecture.md
/docs/architecture/frontend-architecture.md
/docs/architecture/backend-architecture.md
/docs/architecture/module-boundaries.md
/docs/architecture/auth-flow.md
/docs/architecture/authorization-flow.md
/docs/architecture/roadsync-architecture.md
/docs/architecture/inframap-architecture.md
/docs/architecture/file-document-architecture.md
/docs/architecture/ai-rag-architecture.md
/docs/architecture/notification-audit-architecture.md
/docs/architecture/deployment-architecture.md
/docs/architecture/security-trust-boundaries.md
/docs/architecture/team-integration.md
```

Also create:

```text
/docs/architecture/README.md
```

This should act as the architecture index.

---

# 32. ARCHITECTURE CONSISTENCY CHECK

Before finishing:

Verify that all diagrams and documents agree on:

- Next.js frontend
- Express backend
- MongoDB
- MapLibre/GIS
- FastAPI AI service
- storage provider
- REST API
- auth model
- RBAC model
- project lifecycle
- RoadSync ownership
- team ownership
- deployment targets

Search documentation for contradictory technology names or abandoned decisions.

Fix documentation inconsistencies.

Do not change locked architecture without documenting why.

---

# 33. STEP 3 REQUIRED FINAL RESPONSE

Return:

```text
STEP 3 COMPLETE

Architecture Documents:
- ...

Architecture Style:
- Modular Monolith + Dedicated AI Service

Core Application Boundary:
- ...

Core Modules:
- ...

Main Trust Boundary:
- ...

RoadSync Flow:
- ...

AI Boundary:
- ...

Data Stores:
- ...

External Services:
- ...

Team Integration Rules:
- ...

Architecture Risks:
- ...

Inconsistencies Found and Fixed:
- ...

Application feature code created: YES/NO
```

---

# 34. STEP 3 ACCEPTANCE CRITERIA

Step 3 is complete only if:

- system context exists
- high-level architecture exists
- frontend/backend responsibilities are clear
- modules have ownership boundaries
- request flow exists
- authentication architecture exists
- authorization architecture exists
- ProjectTrace integration is clear
- RoadSync architecture is detailed
- GIS/map flow is clear
- file flow is clear
- RAG flow is clear
- AI risk flow is clear
- notification/audit flow is clear
- API namespaces are defined
- conceptual data architecture exists
- deployment architecture exists
- trust boundaries exist
- team integration rules exist
- scalability path is documented without implementing unnecessary complexity
- architecture documentation is internally consistent
- Mermaid diagrams compile
- no major product feature coding has started

Do not automatically initialize the full project after Step 3.

Stop and wait for the next development prompt.

---

# FINAL RULES FOR STEPS 1–3

Throughout all three steps:

1. Do not blindly generate application code.
2. Inspect before changing.
3. Do not delete unrelated work.
4. Do not introduce unnecessary dependencies.
5. Do not overengineer.
6. Keep INFRAOS realistic for 45–60 days.
7. Keep ProjectTrace + RoadSync as the core differentiators.
8. Keep the main backend a modular monolith.
9. Keep AI optional to the core operational workflow.
10. Maintain server-side security.
11. Preserve team-member module ownership.
12. Document trade-offs instead of hiding them.
13. Do not silently change previously locked decisions.
14. Keep P0 working before P2/P3 enhancements.
15. Every later implementation step must follow these architecture documents.

---

# EXPECTED RESULT AFTER THESE THREE STEPS

After completing Steps 1–3, INFRAOS should have a complete planning foundation but should **not yet contain major application feature implementation**.

You should know:

- exactly what is being built
- exactly what is not being built
- which features are P0/P1/P2/P3
- who the users are
- what each module owns
- what technology each layer uses
- how frontend/backend/AI/database communicate
- how authorization is enforced
- how RoadSync works architecturally
- how GIS works architecturally
- how documents/RAG work architecturally
- how the project will deploy
- how teammates can build modules without breaking each other

Only after this foundation is accepted should the project move to:

**Step 4 — User Roles & Permission Matrix**

and then the remaining implementation sequence.
