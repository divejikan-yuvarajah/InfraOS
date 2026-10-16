# INFRAOS Deployment Decisions

**Document:** `/docs/architecture/deployment-decisions.md`  
**Step:** 02  
**Status:** Locked  
**Related:** [ADR-012](../adr/ADR-012-deployment-strategy.md)

---

## 1. Target topology

```text
Browser
  → Vercel (Next.js)
  → HTTPS REST
Render (Express API)
  ├── MongoDB Atlas
  ├── Cloudflare R2
  ├── OSM-compatible tile CDN
  └── Render (FastAPI AI)
        ├── OpenRouter (or configured provider)
        └── Qdrant Cloud
```

**Backend host lock: Render** (API and AI on the same vendor). Railway is the documented alternative if Render quotas fail the team — supersede ADR-012 rather than running both.

---

## 2. Environments

| Environment | Frontend | API / AI | Data | Secrets |
|-------------|----------|----------|------|---------|
| **Development** | `next dev` | `tsx watch` + `uvicorn` | Atlas **dev** DB or local Mongo | `.env` local, never committed |
| **Staging** (practical if time) | Vercel preview | Render staging services | Atlas staging DB | Staging env group |
| **Production** | Vercel production | Render production | Atlas prod DB + R2 prod bucket | Prod env group **only** |

Minimum: **dev + production** with **separate Atlas databases and secret sets**. Staging is recommended, not P0-blocking.

---

## 3. CORS and cookies

Production is **cross-origin** (`*.vercel.app` or custom domain → `*.onrender.com` or custom API domain).

- Set `FRONTEND_ORIGIN` exactly (no wildcard)
- Refresh cookie: `SameSite=None; Secure; HttpOnly` (see [security-decisions.md](./security-decisions.md))
- Prefer custom domains later (`app.example` + `api.example`) to allow `SameSite=Lax` and simpler CSRF — **future**, not required for V1 demo

Health checks: `GET /health` on API (no auth) and FastAPI `/health`.

---

## 4. Service-to-service

Express → FastAPI:

- `AI_BASE_URL`
- `AI_INTERNAL_SECRET` (header)
- Render private networking if available; otherwise HTTPS + secret + optional IP allowlist

Express → Qdrant: **not from the browser**. Prefer FastAPI → Qdrant. Express does not need a Qdrant admin key.

---

## 5. CI/CD

**GitHub Actions** on pull requests and `main`:

```text
install → lint → type-check → unit tests → integration if practical → build
```

Failed checks must not deploy.

- Frontend: Vercel Git integration (deploy **after** CI green if possible)
- Render: deploy on `main` only when checks pass (protect the branch)

Do not deploy from laptops with production secrets in chat logs.

---

## 6. Monitoring

| Need | Tool |
|------|------|
| API/frontend logs | Render + Vercel |
| Structured app logs | Pino (stdout) |
| Crashes | Sentry (optional production) |
| Uptime | UptimeRobot on `/` and `/health` |
| Database | Atlas metrics/alerts |
| AI cost | Provider dashboard + env caps |

No Datadog/New Relic in V1.

---

## 7. Local development (conceptual)

No Docker Compose required for P0 if Atlas + local Next/Express are enough.

When RAG starts: **Qdrant Docker** (`docker run` one container) **or** Qdrant Cloud dev collection.

When uploads start: **local disk** behind the same S3-shaped storage port, or MinIO. Production always R2.

Kubernetes is rejected.

---

## 8. Secrets inventory (names only)

Canonical catalog (Step 10): [environment.md](../setup/environment.md). Names: `MONGODB_URI`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `FRONTEND_ORIGIN`, `R2_*`, `AI_INTERNAL_SECRET`, `AI_BASE_URL`, `OPENROUTER_API_KEY`, `QDRANT_URL`, `QDRANT_API_KEY`.

Never commit values.
