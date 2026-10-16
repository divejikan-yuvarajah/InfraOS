# INFRAOS MongoDB connection

**Step:** 11  
**Module:** `apps/api/src/config/database.ts`  
**ODM:** Mongoose 8 (no separate `mongodb` package)

Application schemas (users, roles, agencies, refresh sessions) are in [core-models.md](./core-models.md). This file is the connection lifecycle.

Atlas account steps: [../setup/mongodb-atlas.md](../setup/mongodb-atlas.md).

---

## One connection per process

```text
Load / validate env
        ↓
Connect Mongoose once (if MONGODB_URI is set)
        ↓
Listen HTTP
```

Do **not** connect and disconnect on every request. Repositories in later steps use the default Mongoose connection after `connectDatabase()`.

---

## Environment separation

| `NODE_ENV` | Typical `MONGODB_DB_NAME` | Notes |
|------------|---------------------------|--------|
| `development` | `infraos_dev` | HTTP can start without URI; `/ready` is 503 until connected |
| `test` | `infraos_test` | Unit tests do not open Atlas. Name must end with `_test` |
| `production` | `infraos_prod` | `MONGODB_URI` + name required; process exits if connect fails |

Non-production processes **cannot** use a database name ending in `_prod`.

---

## Timeouts and pool

| Option | Value | Why |
|--------|-------|-----|
| `serverSelectionTimeoutMS` | 8000 | Fail in seconds instead of hanging on a bad URI/IP allowlist |
| `connectTimeoutMS` | 8000 | Same bound for the initial TCP/TLS handshake |
| `maxPoolSize` | 10 | Modest pool for one API process (local or one Render instance) |
| `minPoolSize` | 0 | Do not hold idle Atlas sockets on student laptops |

These are not national-scale production tuning. Revisit when Render instance count or load is known.

Startup retries: **3 attempts**, **1.5s** apart (1 attempt in `NODE_ENV=test`). No infinite reconnect loop in application code. Do not set `tlsInsecure` or `tlsAllowInvalidCertificates`.

`autoIndex` is **on** in development and test, **off** in production. Production
indexes must be applied as a reviewed operational change, never with
`dropDatabase`. Step 14's `npm run db:indexes:check` override keeps automatic
creation off in every environment and only reports declared/installed metadata;
see [indexes.md](./indexes.md).

---

## Liveness vs readiness

| Probe | Path | Meaning |
|-------|------|---------|
| Liveness | `GET /health` and `GET /api/v1/health` | Node process is up. Does not prove MongoDB. |
| Readiness | `GET /ready` and `GET /api/v1/ready` | Mongoose `readyState === connected`. **200** `{ status: "ready", database: "connected" }` or **503** `NOT_READY`. |

Responses never include URI, host, replica set, username, or raw driver errors.

---

## Shutdown

On `SIGINT` / `SIGTERM`:

```text
Stop accepting HTTP
        ↓
Close the HTTP server
        ↓
mongoose.disconnect()
        ↓
Exit (forced after 10s)
```

---

## Diagnostics

```powershell
npm run db:check
```

Loads `apps/api/.env`, validates URI + db name, connects, `ping`, disconnects. Prints only:

```text
INFRAOS MongoDB check: PASS
Database environment: development
```

There is **no** public `/api/debug-db` route.

---

## Errors

`sanitizeMongoError()` strips `mongodb://` / `mongodb+srv://` URIs and password-like `user:pass@` fragments before logging. Pino also redacts `MONGODB_URI`.
