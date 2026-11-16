# InfraOS — Release Notes, Deployment Checklist & Demo Pack

> **Academic & Portfolio Project** · All demo data is synthetic. Not an official government system.

---

## 1. Release Summary (Phases 1–12)
- **Identity, Auth & Governance**: JWT access + rotating refresh cookie sessions, RBAC (`SUPER_ADMIN`, `GOV_ADMIN`, `AGENCY_OFFICER`, `PROJECT_MANAGER`, `CONTRACTOR`, `INSPECTOR`, `CITIZEN`), agency hierarchy scoping (`404` on out-of-scope resources), append-only `AuditLog`, `/admin/audit-logs`, `/admin/governance`.
- **ProjectTrace & RoadSync**: Project lifecycle, milestones, dependencies, spatial conflict detection, multi-agency coordination hub.
- **InfraMap**: MapLibre GL corridor/asset/hazard GIS viewer with bbox queries and agency-scoped layers.
- **Contractors, Finance, Inspections & Assets**: Contractor registry & certification watch, integer-cent LKR budgets/payments/expenses with verified-progress gates, mobile-ready inspection evidence (GridFS + EXIF stripping) & progress verification, asset handover & health scoring.
- **DocTrace, AI Pipeline, Risk Intelligence & Copilot**: Versioned document repository, FastAPI + Qdrant RAG pipeline, deterministic + LLM risk scoring, permission-bound Infrastructure Copilot with graceful degradation when LLM provider is unreachable.
- **Public Transparency Portal, Notifications, Search & Reports**: Anonymous citizen issue submission & secret-key tracking (`/portal`), staff `/issues` inbox & routing rules, unified `notify()` seam + Socket.IO realtime bell + 15-min `SystemAlert` evaluator (`/alerts`), global `/api/v1/search` & command palette, agency-scoped `/reports` KPI dashboard, CSV export (formula-escaped & audited), and print-ready PDF.

---

## 2. Deployment Readiness Checklist (Do Not Execute Without Owner Approval)

### Target Topology
| Component | Host | Build Command | Start Command | Health Endpoint |
|---|---|---|---|---|
| `apps/web` | Vercel | `npm run build:web` | Next.js managed | `/` |
| `apps/api` (+ Socket.IO) | Render Web Service | `npm ci && npm run build:api` | `npm run start:dist -w @infraos/api` | `/api/v1/health` |
| `apps/ai-service` | Render Web Service | `pip install -r requirements.txt` | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` | `/health` |
| MongoDB | MongoDB Atlas | — | Managed | `readyState === 1` |
| Vector Store | Qdrant Cloud | — | Managed | `/healthz` |

### Environment Variable Placement
- **Vercel (`apps/web`)**: `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_MAP_STYLE_URL`, `NEXT_PUBLIC_AUTH_LOGIN_ENABLED` (`true`), `NEXT_PUBLIC_AUTH_FIXTURE` (`false`).
- **Render (`apps/api`)**: `NODE_ENV=production`, `PORT`, `FRONTEND_ORIGIN` (exact Vercel origin, never `*`), `MONGODB_URI`, `MONGODB_DB_NAME`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `AI_BASE_URL` (Render AI URL), `AI_INTERNAL_SECRET`, `OPENROUTER_API_KEY`, `AI_CHAT_MODEL`, `AI_VISION_MODEL`, `STORAGE_PROVIDER=gridfs` (or `r2` + R2 keys), `SMTP_*`. Note: cross-origin Vercel → Render refresh cookies require HTTPS + `SameSite=None; Secure` (handled when `NODE_ENV=production`).
- **Render (`apps/ai-service`)**: `APP_ENV=production`, `LLM_PROVIDER=openrouter`, `OPENROUTER_API_KEY`, `AI_CHAT_MODEL`, `AI_VISION_MODEL`, `AI_EMBED_MODEL`, `QDRANT_URL`, `QDRANT_API_KEY`, `AI_INTERNAL_SECRET`.

### Ordered Rollout & Operations
1. **Owner Approval Gates**: Confirm production secrets, Atlas IP allowlist + least-privilege DB user, DNS records, and index creation (`npm run db:indexes:check` before applying any new index on Atlas).
2. **Database & Backups**: Enable Atlas continuous snapshots; verify restore drill on staging before launch.
3. **Deploy Backend Services (Render)**: Deploy `ai-service` → verify `/health`; deploy `api` → verify `/api/v1/health` & `/ready`.
4. **Deploy Frontend (Vercel)**: Set `NEXT_PUBLIC_API_BASE_URL` → deploy `apps/web` → verify CORS + login cookie refresh + Socket.IO handshake.
5. **Monitoring & Rollback**: Point uptime monitor (e.g., UptimeRobot) at `/api/v1/health`; review Render structured pino logs; rollback via Render/Vercel instant "Redeploy previous version".

---

## 3. UAT Checklist (10 Core Journeys)

| # | Role | Steps | Expected Result |
|---|---|---|---|
| 1 | Public Citizen | Open `/portal`, browse released projects & `/portal/map` | Only allowlisted public fields shown; coarsened coordinates; no internal IDs/finance/notes |
| 2 | Public Citizen | Submit issue at `/portal/report`, save reference & secret, track at `/portal/track` | Returns `ISS-*` + secret once; `/portal/track` shows live status timeline |
| 3 | Agency Officer | Sign in at `/auth/login`, open `/issues`, route & update status | Out-of-scope agency projects return 404; citizen timeline updates; staff bell notifies |
| 4 | Project Manager | Open `/projects`, inspect milestones & dependencies | Scope-filtered project list; milestone status & progress visible |
| 5 | Project Manager | Open `/roadsync/conflicts` | Shows spatial/temporal overlap candidates and conflict resolution workspace |
| 6 | Inspector | Open `/inspections`, upload site evidence & verify progress | Private GridFS storage; verified progress feeds Finance payment gate |
| 7 | Gov Admin | Open `/finance` & `/contractors` | Integer-cent LKR ledger; payment blocked when verified progress gate unmet |
| 8 | Project Manager | Open `/documents`, `/risk`, and Copilot panel | Document list/upload works; Risk shows deterministic factors; Copilot falls back gracefully if LLM offline |
| 9 | Super Admin | Press `Ctrl+K` / visit `/search?q=Colombo`, `/alerts`, `/notifications` | Cross-module search returns scoped hits; alerts list & acknowledge; mark-all-read/archive work |
| 10 | Super Admin | Visit `/reports`, export CSV, visit `/admin/audit-logs` & `/admin/governance` | KPIs + SVG chart render; CSV downloads (`report.export` logged in AuditLog); audit ledger shows real events |

---

## 4. Demo Script (8–10 Minutes)
1. **Intro & Public Transparency (1.5 min)**: Open `/portal` → highlight trilingual `en/si/ta` switcher and public project directory → open `/portal/map` → submit a quick pothole report at `/portal/report` and copy the one-time tracking secret.
2. **Staff Login & Executive Overview (1 min)**: Sign in as `SUPER_ADMIN` at `/auth/login` → show role dashboard KPIs and agency scope.
3. **Citizen Triage & Real-Time Bell (1 min)**: Open `/issues` → open the newly submitted `ISS-*` issue → update status to `UNDER_REVIEW` with a public message → switch back to `/portal/track` to show live timeline update; point out the notification bell.
4. **InfraMap & RoadSync Conflict (1.5 min)**: Open `/inframap` → show corridor & utility layers → open `/roadsync/conflicts` to demonstrate cross-agency overlap detection.
5. **Contractors, Inspections & Finance Gate (1.5 min)**: Open a showcase project → show contractor assignment, inspection verified-progress chip, and finance ledger in LKR integer cents.
6. **DocTrace, Risk Intelligence & Copilot (1.5 min)**: Open `/risk` (explainable risk tiers) and open the Copilot drawer (note deterministic fallback if external OpenRouter is offline).
7. **Reports, Export & Audit Governance (1 min)**: Open `/reports` → show SVG status chart → click **Export CSV** → open `/admin/audit-logs` to show the immutable `report.export` audit entry.

---

## 5. Pitch Outline (4–5 Minutes)
- **Problem (45s)**: Fragmented Sri Lankan infrastructure agencies (roads, water, electricity, drainage) dig up each other's corridors, lack unified budget-vs-verified-progress controls, and offer limited public visibility.
- **Solution (45s)**: InfraOS unifies geospatial coordination (RoadSync + InfraMap), evidence-gated finance, explainable risk intelligence, and a trilingual citizen portal in one RBAC-hardened platform.
- **Architecture (45s)**: Next.js 16 (Vercel) + Express 5 / Socket.IO (Render) + FastAPI AI/RAG service + MongoDB Atlas + Qdrant.
- **Innovation (45s)**: Deterministic-first risk engine + permission-bound Copilot + spatial conflict radar + zero-leak public transparency portal.
- **Demo & Limits (45s)**: Highlight live end-to-end portal-to-audit flow, note `si/ta` `unverified-draft` translations and offline LLM fallback, and outline R2 storage + mobile field app roadmap.

---

## 6. Fallback Matrix
| Failure | Fallback Action |
|---|---|
| OpenRouter / AI network unreachable | Deterministic risk scores & inspection quality checks still work; Copilot/AI panels display honest "provider unavailable" state without crashing. |
| Map tile style unreachable | MapLibre container renders fallback vector/grid background and list views remain fully functional. |
| WebSocket blocked on corporate Wi-Fi | `RealtimeProvider` automatically falls back to 60s REST polling for unread count. |

---

## 7. Known Limitations & Final Submission Checklist
- Live OpenRouter LLM/vision endpoints are **UNVERIFIED** in this environment due to local IPv6/TLS connectivity drop; unit tests use deterministic stubs and UI falls back gracefully.
- `si` and `ta` translations added in Phases 10–11 carry `unverified-draft` markers for native review.
- File storage uses MongoDB GridFS; Cloudflare R2 is deferred per ADR-010.
- **Submission Checklist**:
  - [x] `npm run type-check` passes across web and API
  - [x] `pytest -q apps/ai-service/tests` passes (96/96)
  - [x] `npm run db:seed:demo` & `npm run db:seed:verify` pass locally
  - [x] No secrets committed in tracked files
  - [ ] Merge stacked feature branches into `development` → `main` (owner action)
