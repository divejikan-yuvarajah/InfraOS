# MongoDB Atlas setup (INFRAOS)

**Step:** 11  
**Status:** Runbook — fill `apps/api/.env` locally; never commit credentials

INFRAOS uses **MongoDB Atlas + Mongoose** only ([ADR-004](../adr/ADR-004-mongodb-geojson.md)). Do not add a second database, Redis, or an embedded DB.

Connection architecture: [../database/connection.md](../database/connection.md). Env names: [environment.md](./environment.md).

---

## A. Create or select an Atlas project

1. Sign in at [https://cloud.mongodb.com](https://cloud.mongodb.com).
2. Create a project named **INFRAOS** (or select the team project).
3. The Atlas **website login** is not the application database user. You will create a separate DB user below.

---

## B. Create a development cluster

1. Create a cluster suitable for development (the Atlas UI lists current free/shared/paid options).
2. Do not assume a specific dollar amount or “M0 forever” limit — Atlas changes product names.
3. One development cluster is enough for the university project. Production should be a **separate** cluster or at least a separate database name.

---

## C. Region

Pick a region with reasonable latency for Sri Lanka / the team’s Render region when the UI offers it. Do not force a paid region.

---

## D. Database user (application)

1. Atlas → **Database Access** → add a user for the API (for example `infraos_api_dev`).
2. Generate a **long random password**. Do not reuse personal passwords.
3. Privilege: **read/write on the INFRAOS database only** (`infraos_dev` for local/dev). Do not grant Atlas admin to the app user.
4. Store the password only in `apps/api/.env` as part of `MONGODB_URI`. Never Git, README, screenshots, or chat logs.

---

## E. Network access

1. Atlas → **Network Access**.
2. Allow the **current developer IP** (and later the Render outbound IPs).
3. **Do not** use `0.0.0.0/0` as the production setting. That opens the cluster to the internet.
4. Temporary `0.0.0.0/0` for a classroom demo is a **known risk**: anyone with the URI can connect. Remove it after the demo and restrict to known IPs.

---

## F. Connection string

1. Atlas → Connect → Drivers → copy the **Node.js / Mongoose** URI.
2. Put it only in `apps/api/.env`:

```text
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@HOST/
MONGODB_DB_NAME=infraos_dev
```

3. The API also passes `dbName` in code. Keep `MONGODB_DB_NAME` set even if the URI includes a path.
4. Do not put `MONGODB_URI` in `apps/web/.env.local` or any `NEXT_PUBLIC_*` variable.

---

## Database names

| Environment | `MONGODB_DB_NAME` |
|-------------|-------------------|
| Local / Atlas dev | `infraos_dev` |
| Automated tests | `infraos_test` |
| Production | `infraos_prod` |

The API refuses `_prod` names unless `NODE_ENV=production`, and test connects must end with `_test`.

---

## Verify

From the repository root, after `apps/api/.env` is filled:

```powershell
npm run db:check
```

Safe success:

```text
INFRAOS MongoDB check: PASS
Database environment: development
```

If this machine has no Atlas credentials, skip `db:check`. Unit tests do **not** require Atlas.

Then:

```powershell
npm run dev:api
```

- `GET http://localhost:4000/api/v1/health` — process alive
- `GET http://localhost:4000/api/v1/ready` — `database: connected` only after a successful connect

---

## Troubleshooting (no secrets)

| Symptom | What to check |
|---------|----------------|
| `MONGODB_URI is required` | `apps/api/.env` missing or empty |
| `must start with mongodb:// or mongodb+srv://` | Wrong scheme (not a Postgres URL) |
| `must end with _test` | `NODE_ENV=test` with `infraos_dev` |
| `must not end with _prod` | Dev/test pointing at production DB name |
| `INFRAOS MongoDB check: FAIL` | User, password, IP allowlist, or cluster paused — do not paste the URI into issues |
| `/ready` is 503 | API started without a successful connect (missing env or Atlas unreachable) |
| Handshake / TLS errors | Do **not** disable TLS (`tlsInsecure`). Fix the URI, CA, or network. |
