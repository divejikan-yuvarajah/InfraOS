# InfraOS feature inventory (Stage A evidence)

Read-only inspection of branch `feature/infraos-full-audit-fix-enhance` @ `2753c19` (2026-11-19), done 2026-11-22. The repo was not modified.

## Stack (from package.json)
| Area | Evidence |
|---|---|
| Monorepo | npm workspaces: `apps/web`, `apps/api`, `apps/ai-service`, `packages/shared-types` |
| Web | Next.js 16.3.8, React 19.2.8, TanStack Query 5, react-hook-form 7, zod 4, MapLibre GL 6.16, socket.io-client 4. 123 `page.tsx` routes |
| API | Express 5.2, Mongoose 8.24, zod 4, jose 6.2.13, bcryptjs 3 (cost 12), helmet 8, express-rate-limit 8 (in 17 files), socket.io 4, pino 10 |
| AI service | Python FastAPI; routes `/health`, `/ready`, `/capabilities`, `/extract-chunk`, `/index`, `/delete`, admin; `require_signed_body` dependency |
| CI | `.github/workflows/ci.yml`: npm ci → type-check → lint → test:web → build:api (note: **test:api is not in CI**) |

## API route handlers per module (grep count, single-line declarations; risk counted separately)
roadsync 86 · ai 48 · assets 35 · finance 35 · documents 26 · identity 23 · inspections 23 · contractors 20 · projects 20 · inframap 13 · issues 9 · notifications 9 · reports 9 · risk 9 · public 7 · agencies 6 · audit 2 · health 2 · search 1 → **≈ 383** (deck rounds to "≈380"; grep-based, approximate).

## Database
56 Mongoose model files in 14 modules. `strict: "throw"` used on e.g. `conflicts`. 2dsphere indexes: project, asset, citizen-issue, hazard-zone, conflict-record hotspot. Transactions: `inTransaction()` in `finance/finance.common.ts:94-103`; `startSession`/`transaction` used in 31 places.

## Feature status matrix
| Module | Status | Evidence |
|---|---|---|
| Auth / RBAC / Admin | VERIFIED | `identity/authorization/require-permission.ts:56-95`, `identity/auth/jwt.ts`, `cookies.ts` (httpOnly), refresh session/family models |
| Projects (ProjectTrace) | VERIFIED | `projects/projects.routes.ts` (create, milestones, progress, review, transition, public-release) |
| RoadSync | VERIFIED | `roadsync/detection.service.ts`, `models/conflict.model.ts`, 86 handlers |
| InfraMap | VERIFIED | `inframap/inframap.routes.ts` (dual permission per layer, ETag) |
| Contractors | VERIFIED | `contractors/*` (20 handlers) |
| Finance | VERIFIED | `finance/*`, transaction + audit in same session |
| Inspections | VERIFIED | `inspections/*` (23 handlers) |
| Assets / Maintenance | VERIFIED | `assets/*` (35 handlers) |
| DocTrace | VERIFIED | `documents/document.routes.ts:53-75` ticket upload flow |
| Risk | VERIFIED (rule-based) | `risk/engine/index.ts` deterministic, versioned; **no trained ML model** |
| AI / RAG / Copilot | PARTIAL | code + tests exist; real answers need external LLM provider config (off for testing) |
| Citizen portal | VERIFIED | `public/public.routes.ts:105-140`, `issues/issue.routes.ts`; live `/portal/report`, `/portal/track` |
| `/portal/public` showcase page | NOT EVIDENCE | `components/portal/public-portal-client.tsx` hard-codes figures (LKR 4.82B, −38 %) |
| Notifications / realtime | VERIFIED (code) | `notifications/*`, socket.io deps |
| i18n EN/SI/TA | PARTIAL | `app/si`, `app/ta`, per-feature `messages.ts`; coverage not audited |
| Deployment | VERIFIED reachable | web + `/api/v1/health` returned HTTP 200 on 2026-11-22 |

## Corrections needed in the final report (PDF)
- Appendix B says citizen-issue endpoints "not implemented" — they exist (`POST /public/issues`, `/issues/*`).
- Appendix B says "Dedicated AI risk API not implemented" — `/risk/*` and `/projects/:projectId/risk` exist.
- §5.1 lists Mapbox/Leaflet and Vercel; the code uses MapLibre GL and Render.
- §6.x "Implementation status: not verified" rows and §7.1 "no executed test log" contradict the Pass statuses and the tests that exist.
- Appendix C marks "All five members have attributable code" Verified, but git authorship shows only one human author (see contribution-matrix.md).
