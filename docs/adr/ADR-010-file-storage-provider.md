# ADR-010 — File Storage Provider (Cloudflare R2)

**Status:** Accepted  
**Step:** 02  
**Date:** 2026-09-30

## Context

DocTrace, inspections, and citizen issues need **private** files with random keys, MIME/size checks, and authorized download. Options were Cloudinary, Supabase Storage, or S3-compatible storage.

## Decision

**Primary production store: Cloudflare R2** (S3-compatible). Access via **AWS SDK v3 S3 client**.

**Development:** same interface backed by **local disk** or **MinIO**.

Express owns authz; clients receive **short-lived presigned URLs** (or streamed download through Express if simpler for small files). Metadata lives in MongoDB.

## Reasons

- Private-by-default object storage fits confidential PDFs better than a media CDN
- S3 API is portable (MinIO, AWS S3 later)
- R2 free/low egress is friendly to a university demo
- Does not add Supabase PostgreSQL

## Alternatives considered

| Alternative | Why not as V1 primary |
|-------------|----------------------|
| Cloudinary | Excellent for public images; awkward default for private government PDFs |
| Supabase Storage | Extra vendor; we are not using Supabase DB |
| AWS S3 | Fine; R2 is cheaper-egress for a demo; S3 remains compatible |
| Git LFS / Mongo GridFS | Poor CDN and size story |

## Trade-offs

- Team must create an R2 bucket and keys (Step 10)
- Presigned URL clock skew

## Consequences

- One storage port in code (`upload`, `presignGet`, `delete`)
- No public buckets for project documents

## Future revisit conditions

- Institutional AWS credits → switch endpoint, keep the S3 client
- Antivirus scanning (P2) as a processing step before INDEXED
