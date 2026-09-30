# INFRAOS Dependency Rules

**Document:** `/docs/architecture/dependency-rules.md`  
**Step:** 02  
**Status:** Locked

These rules apply when applications are scaffolded (Step 7+). They exist now so teammates do not add a second stack.

---

## 1. Purpose test

A package may be added only if **all** are true:

1. It solves a problem the locked stack does not already solve.
2. It is maintained (recent releases, not abandoned).
3. It is not deprecated.
4. The team understands the security implications.
5. The choice is noted in an ADR or this file if it is major.

Trivial helpers (date format, UUID, HTTP status constants) should prefer **standard library** or already-locked libraries.

---

## 2. One tool per job

| Job | Allowed | Do not also add |
|-----|---------|-----------------|
| HTTP API (Node) | Express | Fastify, Nest, Hono for the main API |
| HTTP API (AI) | FastAPI | A second Python web framework |
| ODM | Mongoose | Prisma, TypeORM |
| Validation | Zod | Yup, Joi, class-validator |
| Unit tests (Node) | Vitest | Jest |
| E2E | Playwright | Cypress |
| Server cache/fetch | TanStack Query | SWR as a second default |
| Client chrome state | Zustand | Redux, Jotai, Recoil |
| CSS | Tailwind | a second utility framework |
| UI kit | shadcn/ui + Radix primitives it uses | MUI, Ant Design, Chakra as a parallel kit |
| Maps | MapLibre | Leaflet/Mapbox GL as a second default |
| Logs | Pino | Winston |
| HTTP client (browser) | `fetch` wrapper | axios **and** ky unless one is standardized — **pick fetch** |
| S3 | AWS SDK v3 S3 client | a second storage SDK for the same bucket |
| Vectors | Qdrant client | pgvector, Pinecone, Atlas Vector Search as a second store |
| Passwords | bcryptjs | extra hash libraries |

---

## 3. Security-sensitive libraries

Keep updated: `jsonwebtoken` (or `jose`), `bcryptjs`, Helmet, CORS, Express, Next, Mongoose.

Prefer `jose` over ancient `jsonwebtoken` if both work — **lock `jose` for JWT** (modern, Web Crypto) unless a blocker appears at scaffold time. If `jsonwebtoken` is used instead, document why in the identity step. **Step 2 preference: `jose`.**

Do not add `eval`, template-engine XSS, or `fs` path joins from user input without sanitization.

---

## 4. Size and native addons

Avoid native addons that fail on Windows unless they ship reliable prebuilds. That is why V1 hashing is **bcryptjs**, not Argon2 native.

Do not add TensorFlow.js in the browser for P0.

---

## 5. License

Prefer MIT/Apache-2.0. Review GPL before adding.

---

## 6. Process

1. Search existing package.json / these docs.
2. If major (new database, new UI kit, new queue): write or supersede an ADR **before** merging.
3. Never commit credentials inside packages or `.env`.
