# INFRAOS — PHASE 10 · BATCH 08 (STEPS 108–110)
## DocTrace: Secure File Management · Document Management · Categorization & Search
### Claude Code implementation prompt — copy everything below into Claude Code from the repository root

---

## 0. ROLE AND MISSION

You are a senior full-stack engineer (Next.js/React, Express/Mongoose/MongoDB), a document-management/security engineer and a premium-UI engineer working inside the existing **INFRAOS** monorepo. Implement **Batch 08 of Phase 10 — Steps 108–110**:

| Step | Deliverable |
|---|---|
| 108 | **Secure file management**: upload (single/multiple), validated storage, authenticated download and preview, versioning/replacement, archival/deletion, audit |
| 109 | **DocTrace document management**: dashboard, library (table + grid), details, upload wizard, edit, status, ownership, and links to agency / project / contractor / inspection / payment / asset, activity history |
| 110 | **Categorization & search**: category registry, tags, metadata filters, permission-safe full-text-style search with highlighting, pagination, saved views |

This batch is the **foundation for Phase 10 AI**. Batch 09 will add a FastAPI service that extracts text, chunks, embeds and indexes documents; Batch 10 adds RAG. **Batch 08 builds no AI**, but must leave clean, tested seams (§4.9) so Batch 09 plugs in without schema rework. Do not build AI, embeddings, extraction, OCR or a Python service here.

Deadline-driven university project: **working, secure functionality and a polished, modern look beat breadth.** Every button, filter, form, wizard step, dialog and menu must really work. No placeholder controls, no fake data presented as real.

---

## 1. HARD RULES (non-negotiable)

1. **Inspect before you write.** Never invent paths, models, permissions or helpers. §2 is recon at the time of writing — re-verify everything you depend on.
2. **Reuse, don't duplicate.** Extend the existing `Document` model and the existing `document.*` permissions. Reuse the **evidence-storage provider, magic-byte validator, size limits, two-step upload protocol and authenticated streaming that Batch 06 built** for inspections (GridFS behind an interface). Reuse Batch 06's upload-queue, lightbox/authed-image components, Batch 05 audit/atomic-counter helpers, shared UI/forms/data-table, i18n, tokens. **No second storage system, no second validator, no copy-pasted upload code** — if the Batch 06 code is inspection-specific, extract a small shared module with a clean, low-risk move (keep inspection behaviour and tests identical).
3. **Server-side authorization only**, agency-scoped, permission-checked. UI hiding is never security. Out-of-scope id → **404**.
4. **Files never live in ordinary MongoDB documents and storage locations are never exposed.** No storage URLs, keys, GridFS ids, presigned links or credentials in any API response, log, audit snapshot or URL. All bytes flow through authenticated API streaming.
5. **Never trust the client's file type.** Validate extension allowlist + declared MIME + **actual magic bytes** + size, server-side. Serve with safe headers (§4.3).
6. **History is never destroyed silently:** versions are immutable, deletions are archive-first, audit rows are written in the same transaction as each state change.
7. **No new dependencies unless unavoidable** (justify each in the PR). No AI, no Python, no OCR, no virus-scanner service. No heavy tests, no extra Markdown reports (≤ 12 lines appended to the existing database doc is fine).
8. **Never touch `main` or `development` directly; never force-push.** See §11.
9. Read `apps/web/CLAUDE.md` / `AGENTS.md` first — this Next.js version has breaking changes; read the relevant guides in `apps/web/node_modules/next/dist/docs/` before writing Next code.
10. Match conventions: Conventional Commits, `success()/failure()` envelopes, `noStore`, strict zod (reject unknown + repeated keys), `requireAuthenticated` + `requirePermission`, `AuditLog.create` with allowlisted snapshots (action regex `/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/`), `strict:"throw"` schemas, `useWorkspaceLocale()` + message dictionaries, `guard()/moved()` API client pattern.

---

## 2. RECON FINDINGS (re-verify against the code)

**Repo:** npm workspaces `apps/web` (Next 16, React 19, Tailwind 4, shadcn/radix, react-hook-form + zod, react-query), `apps/api` (Express 5, Mongoose 8, zod 4, vitest + mongodb-memory-server; `express.json({limit:"1mb"})`), `packages/shared-types`. Flow: feature branch → PR into `development` (squash).

**Documents today (`apps/api/src/modules/documents/`) — only constants + two models; no routes, services, pages:**
- `Document` (`documents`, `strict:"throw"`): `projectId` (**required** ref Project), `documentType` ∈ `CONTRACT, TENDER, BOQ, INVOICE, APPROVAL, PROGRESS_REPORT, INSPECTION_REPORT, DRAWING, OTHER` (Batch 06 added `SITE_EVIDENCE` — verify), `fileName` (≤255), `storageUrl`/`storageKey` (**select:false**, never serialized; `storageUrl` validator allows only unsigned https URLs), `uploadedBy`, `extractedTextStatus` ∈ `NOT_STARTED, QUEUED, PROCESSING, COMPLETED, FAILED, UNSUPPORTED` (default NOT_STARTED), `mimeType`, `sizeBytes`, `visibility` ∈ `INTERNAL, PROJECT_TEAM, PUBLIC` (default INTERNAL). Indexes `{projectId,documentType}`, `{projectId,createdAt:-1}`. **No agencyId, title, status, version, hash, or links to contractor/inspection/payment/asset.**
- `DocumentChunk` (`documentChunks`): `documentId`, `projectId`, `chunkIndex`, `content` (select:false, ≤20 000), `embeddingReference` (opaque id). **Untouched in this batch** (Batch 09 owns it).
- `AUDIT_RESOURCES` already includes `DOCUMENT` and `DOCUMENT_CHUNK`.
- **Permissions exist already** (`packages/shared-types/src/permissions.ts`): `document.upload|read|download|delete|process|ask`. Seed grants (**print & confirm**): SUPER_ADMIN/GOV_ADMIN/AGENCY_OFFICER/PROJECT_MANAGER hold upload/read/download/process/ask (delete: SUPER_ADMIN, GOV_ADMIN); CONTRACTOR has upload/read/download; INSPECTOR has upload/read/download/ask (verify exact lists in `identity/seed/system-role-permissions.ts`); CITIZEN has a limited set. **Scope reality:** `resolveResourceScope` gives CONTRACTOR/INSPECTOR/CITIZEN scope `none` (inspectors reach projects through `inspectorProjectIds`; there is **no contractor↔user link**). Do **not** invent a contractor portal — contractor users stay denied unless an existing scope rule already admits them.
- Existing web route-access segments already list `documents` (`apps/web/src/lib/auth/route-access.ts`); no pages exist.
- AI-related env already declared in `apps/api/src/config/env.ts`: `AI_BASE_URL`, `AI_INTERNAL_SECRET`, `OPENROUTER_API_KEY` (aliases `AI_SERVICE_URL`, `AI_SERVICE_SECRET`). **Don't use them in this batch.**
- Existing `riskAssessments` model (0–100 percentages, factors, `modelVersion`) belongs to Batch 11.

**Batch 04–07 seams to reuse (verify they are on your base):** GridFS `EvidenceStorage` + validators + upload queue (Batch 06), atomic counters + money/audit helpers (Batch 05), `contractors` (Batch 04), `inspections` (Batch 06), `projectPayments`/`projectExpenses` (Batch 05), `assets`/`assetConversions` (Batch 07). Scope helpers: `resolveResourceScope`, `projectReadFilter`, `projectWriteFilter`.

> **LATEST FINAL REPORT / HANDOFF NOTES (authoritative if present — else derive from the code):**
> `[PASTE BATCH 06 / BATCH 07 (PHASE 9) FINAL REPORT HERE]`

---

## 3. PREFLIGHT (≤ 15 lines, then continue unless blocked)

1. `git fetch origin`; `git status` clean; branch + `git log --oneline -5`.
2. **Required on `origin/development`:** Batch 06 storage (`evidence-storage` / GridFS provider, validators). If **missing → STOP and ask me**: (A) I merge Phase 9 first; (B) stack this branch on the latest unmerged Phase 9 feature branch; (C) build a minimal storage provider here behind the same interface (state exactly what). Don't guess. Also note whether Batches 04, 05, 07 are present — document links to contractors/payments/assets/inspections are **conditional** on those collections existing; skip a link type (and say so) if its model is absent.
3. `npm install` if needed; Node ≥ 22; baseline `npm run type-check` + documents/inspections/identity tests; list pre-existing failures (don't fix).
4. Print the role → `document.*` permission matrix and find every reader/writer of `Document`/`DocumentChunk` (seeds, reset-demo, dashboards, inspections evidence documents). **Batch 06 inspection evidence rows are also `Document` rows (type SITE_EVIDENCE)** — DocTrace listings must handle them deliberately (§4.1 `origin`).
5. Check the permission-propagation path used in earlier batches (sync script, seed-core, parity tests) before adding anything (§4.2).
6. Check the Atlas storage constraints: GridFS lives in the same cluster; free-tier clusters are small → note the limit in the PR and keep the default max file size modest (§4.3).

---

## 4. DATA, DOMAIN AND BACKEND

### 4.1 `Document` — additive extension (same collection, backward compatible)
Add (optional unless stated; `strict:"throw"`; keep all existing fields; never serialize storage fields):
- `docNo` (`DOC-YYYY-NNNNNN`, unique; atomic counter), `title` (≤ 200; backfill = fileName), `description?` (≤ 2000), `category` — **new category registry** (§4.4) value; keep `documentType` as the **legacy field** and keep it in sync via a single mapping (category ↔ documentType) so existing readers don't break.
- Ownership/scope: `agencyId` (**required for new docs; = owning agency**, derived from project/uploader, never from client input), `projectId` → **optional** (agency-level documents such as correspondence/policy are allowed; at least one of `agencyId`/`projectId` always present). `ownerId` (= uploader, `uploadedBy` stays), `uploadedByAgencyId`.
- Links (all optional, validated through scope on write): `contractorId?`, `inspectionId?`, `paymentId?`, `expenseId?`, `assetId?`, `milestoneId?`. Each link must belong to the **same project/agency** as the document; verify on write.
- State: `status` ∈ `DRAFT | ACTIVE | SUPERSEDED | ARCHIVED` (default ACTIVE; DRAFT only visible to owner/agency officers), `archivedAt?`, `archivedBy?`, `archiveReason?`.
- Content: `currentVersionNo` (int ≥ 1), `currentVersionId`, `fileName`, `mimeType`, `sizeBytes`, `contentHash` (sha256 of current version, for duplicate warning + integrity), `pageCount?` (nullable; filled by Batch 09), `language?` (`en|si|ta|mixed|unknown`, user-set).
- Classification: `visibility` (existing enum kept) + new `confidentiality` ∈ `STANDARD | SENSITIVE` (default STANDARD; SENSITIVE = shown only to the owning agency officers and project managers of that project, never `PUBLIC`; SENSITIVE ⇒ **`aiProcessingAllowed:false` by default**, changeable only by GOV_ADMIN with reason).
- `tags[]` (≤ 15, each ≤ 40, normalised lowercase/trimmed/unique), `documentDate?` (the date the document itself bears), `reference?` (external reference no., ≤ 100), `expiresAt?` (for approvals/permits; informational).
- **AI-readiness seam (no AI logic):** keep `extractedTextStatus` (existing); add `aiProcessingAllowed` (bool, default true except SENSITIVE), `aiEligibleType` (computed on write from the mime type: PDF/DOCX/TXT = true), `origin` ∈ `DOCTRACE | INSPECTION_EVIDENCE | SYSTEM` (default DOCTRACE; Batch 06 evidence rows are backfilled `INSPECTION_EVIDENCE` and **hidden from the DocTrace library by default** — exposed via an "Inspection evidence" filter that is read-only), `version` (optimistic concurrency).
- Indexes: `{agencyId:1,status:1,category:1,createdAt:-1}`, `{projectId:1,status:1,createdAt:-1}`, `{docNo:1}` unique, `{contractorId:1}`, `{inspectionId:1}`, `{assetId:1}` (sparse/partial where the field exists), `{contentHash:1,agencyId:1}`, `{tags:1}`, a **text index** on `title, description, fileName, reference, tags` (weights title 10, reference 6, tags 5, fileName 4, description 2). Add to `check-indexes.ts`; run `npm run db:indexes:check`.
- **Backfill** `scripts/backfill-documents-batch08.ts` (+ `db:backfill:documents`, dry-run default, `--commit`): `docNo`, `title`, `category` from `documentType`, `agencyId` from the project, `status`, `origin`, `confidentiality`, `currentVersionNo:1`; create the matching `documentVersions` row when a stored file exists. Legacy rows **without stored bytes** (seed rows with only metadata) become `fileAvailable:false` and show "File not available" — never a broken download.

### 4.2 Permissions (minimal, explicit)
Reuse `document.upload|read|download|delete`. **Add two permissions only if required** and flag in the report: `document.update` (edit metadata/status/links; GOV_ADMIN, AGENCY_OFFICER, PROJECT_MANAGER for their own scope; uploaders may edit only their own DRAFT/ACTIVE metadata within scope) and `document.restrict` (set SENSITIVE / AI exclusion; GOV_ADMIN, AGENCY_OFFICER). If `document.update` is avoidable by using `document.upload` + ownership rules, say which you chose and why. `document.delete` = **archive/permanent-delete authority** (GOV_ADMIN; SUPER_ADMIN only for records with an owning agency, same rule as `projectWriteFilter`). `document.process`/`document.ask` are **not used** in this batch.
Use the same idempotent propagation path as earlier batches (sync script/seed/parity tests); list the final role matrix in the report and the command to apply grants to existing databases.

**Visibility rules (single pure function `documentAccess(actor, doc, scope)` + a Mongo filter builder `documentReadFilter(actor, scope)` that must agree — test them against each other):**
- SUPER_ADMIN: read/download platform-wide, no write except where an owning agency exists (mirror existing rule); GOV_ADMIN: own agency + descendants; AGENCY_OFFICER: own agency; PROJECT_MANAGER: documents of projects they manage (`projectReadFilter`) **plus** agency-level docs only if explicitly `PROJECT_TEAM`-visible… (decide from the existing role semantics and print the decision table in the report); INSPECTOR: documents of inspector-assigned projects with `visibility ∈ {PROJECT_TEAM, PUBLIC}` and category in an inspector-relevant allowlist (inspection/site/drawing/plan/completion) — never contracts' financial terms, payment evidence or SENSITIVE; CONTRACTOR/CITIZEN: denied (404/403 per existing convention) unless an existing scope rule admits them.
- `DRAFT` visible only to owner + agency admins/officers. `SENSITIVE` per §4.1. `ARCHIVED` hidden by default, visible via an explicit filter to GOV_ADMIN/AGENCY_OFFICER/owner.
- `PUBLIC` visibility never means anonymous access: it only widens within authenticated, scope-allowed users (document this in a comment).

### 4.3 Secure file management (Step 108)
**Storage:** reuse the Batch 06 provider interface (GridFS bucket `documents`, distinct from `evidence` if that is how Batch 06 separated them; verify). Storage key = server-generated random id (`doc/{docId}/v{n}/{uuid}`), **never** derived from the user's file name. Original file name is stored as display metadata only, sanitised (strip path separators/control chars/RTL override characters, ≤ 255, normalise to NFC).

**Allowlist (constants table, one place):** PDF (`application/pdf`), DOCX, TXT (UTF-8 plain), CSV, XLSX, PNG, JPEG, WEBP (images allowed as `SITE_EVIDENCE`/`DRAWING`/`OTHER` only). Block: executables/scripts/archives/HTML/SVG/Office macro formats (`.docm`, `.xlsm`), and anything whose magic bytes disagree with extension/MIME. DOCX/XLSX verified as ZIP containers with the expected root entries (`[Content_Types].xml` + `word/`/`xl/`), **ZIP bomb guard** (max entries, max uncompressed size ratio) without extracting to disk. PDF: `%PDF-` header, reject encrypted/JS-flagged only if cheaply detectable (`/JavaScript`, `/Launch` token scan in the first/last 1 MB → mark `WARNING_ACTIVE_CONTENT` and allow download-only without inline preview, or reject — choose and document). TXT/CSV: valid UTF-8, no NUL bytes.
**Limits:** default max **25 MB** per file (env-overridable constant), ≤ 10 files per multi-upload batch, ≤ 100 MB per batch, filename ≤ 255; per-user/agency daily upload cap (generous, anti-abuse). Reject with specific, translatable error codes (`FILE_TOO_LARGE`, `FILE_TYPE_NOT_ALLOWED`, `FILE_SIGNATURE_MISMATCH`, `FILE_CORRUPT`, `FILE_EMPTY`, `FILE_DUPLICATE_WARNING`, `STORAGE_UNAVAILABLE`).
**Upload protocol:** reuse Batch 06's two-step **init → stream bytes → finalize/commit** (streamed, never fully buffered above the limit; body-size enforced while streaming; abort cleans partial GridFS data). Compute sha256 while streaming. **Duplicate detection:** same `contentHash` in the same agency → warn with link to the existing document and let the user choose "Upload anyway" / "Open existing" (server never silently dedups). Orphan cleanup: `scripts/cleanup-orphan-uploads.ts` (dry-run default) removes PENDING uploads older than 24 h and unreferenced stored blobs.
**Versioning/replacement (`documentVersions`, new collection, immutable):** `documentId`, `versionNo`, `storageRef` (select:false), `fileName`, `mimeType`, `sizeBytes`, `contentHash`, `uploadedBy`, `changeNote` (≥ 5 chars required for versions ≥ 2), `status` ∈ `CURRENT | SUPERSEDED | REMOVED`, `createdAt`. Unique `{documentId,versionNo}`. **Replace** = upload a new version in one transaction: previous → SUPERSEDED, document pointers/hash/size/mime updated, `extractedTextStatus` reset to `NOT_STARTED` and the **version-ready event** emitted (§4.9). Old versions remain downloadable for users with `document.download` (labelled "superseded"). Restore a prior version = create a **new** version copying the bytes reference (no history rewrite). Max 20 versions per document; permanent removal of an old version only by GOV_ADMIN with reason (bytes deleted, row kept as REMOVED).
**Download:** `GET /documents/:id/download` (+ optional `?version=n`) streams through the API after scope/permission check, `Content-Disposition: attachment; filename*=UTF-8''…` (sanitised), `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`, correct `Content-Length`, supports abort. **Preview:** `GET /documents/:id/preview` serves **inline only** for PDF/TXT/CSV(as text)/PNG/JPEG/WEBP with `Content-Security-Policy: sandbox; default-src 'none'`; DOCX/XLSX are download-only (no server conversion, no dependency) — the UI shows metadata + "Download to view". Never inline HTML/SVG. Each download is audited (`document.downloaded`, count only, no content).
**Archive/delete:** `POST /documents/:id/archive` (reason ≥ 12; status ARCHIVED, bytes retained, hidden from search/AI); `POST /documents/:id/restore`; **permanent delete** `DELETE /documents/:id` only for already-ARCHIVED docs, GOV_ADMIN (`document.delete`), reason ≥ 12, second-step confirm token (typed document number), transaction: delete bytes of every version, mark versions REMOVED, keep a **tombstone** (`docNo`, title, category, deletedAt, deletedBy, reason; no content) so history/audit links don't dangle; emit `document.deleted` event for Batch 09 vector cleanup. Documents referenced by a conversion/inspection/payment cannot be permanently deleted (409 with referencing records) — only archived.
**Malformed/suspicious files:** any validation failure leaves **no stored bytes**, returns a safe error, and writes a minimal audit row `document.upload_rejected` (reason code only; no file name/content).
**Rate limits:** upload init/commit and download endpoints behind existing rate-limit middleware with stricter limits for uploads.

### 4.4 Categorization (Step 110a) — one registry, easily extended
`document-categories.ts` (shared via `packages/shared-types` for web+API): array of `{ key, group, legacyDocumentType, allowedExtensions?, requiresProject, defaultVisibility, inspectorVisible, sensitiveByDefault, icon }`. Initial categories (keys, UPPER_SNAKE): `PROJECT_PROPOSAL`, `PROJECT_PLAN`, `ENGINEERING_DRAWING` (↔ DRAWING), `CONTRACT` (↔ CONTRACT; `sensitiveByDefault: false`, but finance-terms handled by role allowlist), `TENDER` (↔ TENDER), `BOQ` (↔ BOQ), `BUDGET_DOCUMENT`, `PAYMENT_EVIDENCE` (↔ INVOICE), `INSPECTION_REPORT` (↔ INSPECTION_REPORT), `SITE_EVIDENCE` (↔ SITE_EVIDENCE if present), `GOVERNMENT_CORRESPONDENCE` (`requiresProject:false`), `APPROVAL_DOCUMENT` (↔ APPROVAL), `PROGRESS_REPORT` (↔ PROGRESS_REPORT), `COMPLETION_REPORT`, `ASSET_HANDOVER_RECORD`, `MAINTENANCE_DOCUMENT`, `OTHER`. Groups for UI: Planning · Contract & Finance · Inspection & Evidence · Government · Completion & Assets. Adding a category = one registry entry + i18n keys (document this in a code comment). **Add `legacyDocumentType` values to `DOCUMENT_TYPES`** only where a category has no legacy equivalent, keeping existing values valid.
**Auto-suggest (not AI):** suggest category from the file extension/name keywords and from context (uploading from an inspection → INSPECTION_REPORT; from a payment → PAYMENT_EVIDENCE; from an asset → ASSET_HANDOVER_RECORD / MAINTENANCE_DOCUMENT). The user always confirms.
**Contextual link rules:** `inspectionId` only for inspection categories; `paymentId`/`expenseId` only for finance categories; `assetId` only for asset/maintenance/handover categories; `contractorId` for contract/tender/BOQ/payment categories. Enforce server-side with a rules table.

### 4.5 Documents API (Step 109) — mount `/api/v1/documents`
All: `requireAuthenticated` + permission, scope-checked (404 out of scope), strict zod, `noStore`, envelopes, audit on mutations, allowlisted responses (never storage fields).

| Method + path | Permission | Purpose |
|---|---|---|
| `GET /documents` | `document.read` | Library/search (§4.6) + facet counts |
| `GET /documents/summary` | `document.read` | Dashboard numbers (§5.3-A) |
| `GET /documents/categories` | `document.read` | Registry subset the caller may use |
| `POST /documents/uploads` | `document.upload` | **Init** (metadata: category, links, project/agency, filename, size, mime) → upload ticket id; validates scope/links/limits before any bytes |
| `PUT /documents/uploads/:ticket/content` | `document.upload` | Stream bytes (size + signature validated while streaming) |
| `POST /documents/uploads/:ticket/commit` | `document.upload` | Finalize: creates Document + version 1 (transaction), audit, event |
| `POST /documents/uploads/:ticket/abort` | `document.upload` | Abort/cleanup |
| `GET /documents/:id` | `document.read` | Details (+ current version, links resolved with per-link permission tiering, `fileAvailable`, permissions flags `canEdit/canReplace/canArchive/canDelete/canRestrict` computed server-side) |
| `PATCH /documents/:id` | `document.update`/rule §4.2 | Edit title, description, category (re-validated), tags, dates, reference, language, links, visibility, `version` precondition |
| `POST /documents/:id/status` | same | DRAFT↔ACTIVE; SUPERSEDED set automatically by a replacement **document** relation (optional `supersededById`) |
| `POST /documents/:id/versions` (init) · `…/versions/:ticket/content|commit` | `document.upload` + edit rights | Replace flow (reuses the upload protocol) |
| `GET /documents/:id/versions` | `document.read` | Version list |
| `POST /documents/:id/versions/:n/restore` | edit rights | New version from an old one |
| `GET /documents/:id/download` · `GET /documents/:id/preview` | `document.download` / `document.read` | §4.3 |
| `POST /documents/:id/archive` · `…/restore` · `DELETE /documents/:id` | `document.delete` (+ owner archive per §4.2 decision) | §4.3 |
| `POST /documents/:id/restrict` | `document.restrict` | confidentiality/AI exclusion with reason |
| `GET /documents/:id/activity` | `document.read` | Audit-backed activity (cursor-paginated; action label + actor + time; no content) |
| `GET /projects/:projectId/documents` | `document.read` | Project-linked panel (thin wrapper over the same service) |
| `GET /documents/export.csv` | `report.export` | Metadata-only register export (cap 5 000, CSV-injection-safe, audited count) |

Use **one** service layer (`document.service.ts`, `document-access.ts`, `document-validation.ts`, `document-upload.service.ts`, `document-versions.service.ts`, `document-search.ts`, `document-categories.ts`, `document.audit.ts`) — routers stay thin. Audit actions: `document.uploaded|updated|status_changed|version_added|version_restored|downloaded|archived|restored|deleted|restricted|upload_rejected|exported`. Snapshots only from the allowlist (`status`, `reason`, `agencyId`, … — add nothing unless unavoidable; never file names/content).
**Notices** (best-effort, after commit, existing notice helper): new document linked to a project → project manager (not the uploader); version replaced → previous uploader + project manager; archived/restored → owner. Dedupe like earlier batches.

### 4.6 Search (Step 110b) — metadata search, permission-safe
`GET /documents` query (strict zod, repeated keys rejected): `q` (≤ 200), `category` CSV, `group`, `projectId`, `agencyId`, `contractorId`, `assetId`, `inspectionId`, `fileType` CSV (`pdf|docx|xlsx|csv|txt|image`), `status` CSV (default ACTIVE), `confidentiality`, `visibility`, `tag` CSV (AND), `uploadedBy` (`me`|id), `from`/`to` (upload date, Asia/Colombo day bounds), `docDateFrom`/`docDateTo`, `hasFile`, `origin` (default DOCTRACE), `aiReady` (`extractedTextStatus === COMPLETED`; reserved, shows nothing meaningful until Batch 09 — implement the filter anyway), `sort` (`relevance|newest|oldest|title|size|updated`), `page`, `limit` ≤ 50.
- **Always** AND the `documentReadFilter(actor, scope)` — permission filter is applied in the query itself, never post-filtered. Total counts and facet counts are computed **under the same filter** (no leakage through counts).
- `q`: Mongo `$text` for relevance; for short/partial tokens (≤ 3 chars, or no text hits) fall back to an **escaped, anchored-prefix regex** on `title`/`docNo`/`reference` (escape all regex metacharacters; cap pattern length; never user-regex). `docNo` exact match always wins. State plainly in a code comment: this is **metadata search** — document **content** search arrives with Batch 09/10 semantic retrieval; **do not** claim content search in the UI (show an info hint "Searching titles, references, tags and descriptions").
- **Highlighting:** server returns `highlights` for `title/description/tags/reference` as safe segments `[{text, match:boolean}]` (not HTML), computed from the escaped query tokens; the UI renders `<mark>` from segments (no `dangerouslySetInnerHTML`).
- **Saved views:** `documentSavedViews` is **not** a new collection — store as a per-user small list in an existing user-preferences mechanism **only if one exists**; otherwise persist in `localStorage` (try/catch) as named presets (max 10) and say which in the report.
- Facets: counts by category, status, file type, project (top 10), agency (if the viewer has > 1 in scope).

### 4.7 Project/entity integration (Step 109)
- **Project page** gets a **Documents** panel (`GET /projects/:projectId/documents`; upload button for `document.upload` holders; counts by category; "Open in DocTrace" link with the project filter).
- **Other entity pages (only if those pages exist on your base):** contractor profile (contract/tender/BOQ docs for that contractor, with `contractor.read` + `document.read`), inspection report page (inspection reports/evidence-linked docs), payment/expense rows (payment-evidence docs), asset passport (handover/maintenance docs) — each a small reusable `<LinkedDocumentsPanel entity={{type,id}} />` using the same API filters. Don't change those modules' behaviour beyond adding the panel.
- Batch 06 evidence documents remain managed by the inspection module (read-only in DocTrace; link back to the inspection).
- Seed documents for the demo (§4.10).

### 4.8 Audit, activity and storage lifecycle
Activity tab = audit rows for the document (actions above) merged with version history, humanised. Storage lifecycle summary in the PR: PENDING (≤ 24 h) → CURRENT → SUPERSEDED (kept) → ARCHIVED (kept, hidden) → DELETED (bytes removed, tombstone kept).

### 4.9 Batch 09 seam (no AI code!)
- `document-events.ts`: tiny typed in-process emitter (`document.version_ready`, `document.archived`, `document.restored`, `document.deleted`, `document.restricted`) invoked **after commit**; in Batch 08 it has **no subscribers** (a debug-level log only). Batch 09 will subscribe to queue processing, remove vectors on delete/archive and honour `aiProcessingAllowed`.
- `GET /documents/:id/content-source` is **not** exposed. Instead provide an internal function `openDocumentStream(documentId, versionNo, {internal:true})` used later by the AI pipeline (service-to-service), guarded so it cannot be reached from a public route.
- UI shows an **"AI status"** chip that currently renders `Not processed` / `Not eligible (type)` / `Excluded` (from `aiProcessingAllowed`/`aiEligibleType`) — read-only, labelled honestly; no fake "processing".

### 4.10 Seeds (small, synthetic, idempotent; update `reset-demo` / `verify-demo`)
12–16 documents across 3 projects and 2 agencies covering most categories (incl. one with 3 versions, one DRAFT, one SENSITIVE contract, one ARCHIVED, one agency-level correspondence without a project, one linked to a contractor, one linked to a payment, one linked to an inspection, one linked to an asset if the module exists, one legacy row without bytes). Use **tiny generated real files** (a few real PDFs/TXT/PNG produced programmatically, a few KB each, stored via the real provider so preview/download work in the demo). All titles/descriptions end with "(Synthetic)". reset-demo must remove their GridFS blobs. Add count checks to `verify-demo`.

---

## 5. FRONTEND — PERFECT, MODERN UI/UX

### 5.1 Routes, navigation, files
`/documents` (DocTrace dashboard + library), `/documents/upload` (wizard; also opened as a modal from project/entity panels), `/documents/[id]` (details), and a **preview drawer** reachable from any list. Nav item **DocTrace** (FileText/Library icon) with `i18n` si/ta, gated by `document.read`; ensure `documents` is in `route-access.ts` with a test. Suggested files (adapt to conventions): `components/documents/{doctrace-dashboard,document-insight-strip,document-filters,document-table,document-grid,document-card,document-row-menu,category-chip,status-chip,confidentiality-chip,ai-status-chip,file-icon,document-preview-drawer,preview-pane,document-detail,metadata-panel,links-panel,version-history,version-upload-dialog,activity-timeline,upload-wizard,dropzone,upload-queue-list,duplicate-warning,category-picker,link-picker,tags-input,archive-dialog,delete-dialog,restrict-dialog,linked-documents-panel,empty-state}.tsx`; `lib/documents/{api,types,list-query,schemas,messages,view,upload}.ts` (+ small tests for pure helpers: list-query, schemas, size/mime helpers).

### 5.2 Design language (consistent with Batches 04–07)
Calm high-trust enterprise surfaces; tabular numerals; status never colour-only (icon + label); skeleton-first loading; ≤ 200 ms motion, reduced-motion respected; 44 px mobile targets; focus rings; aria-live for counts and upload progress. Document-specific visuals: **file-type icons with category colour accents**, **category chips** grouped by the five groups, **status chips** (Draft/Active/Superseded/Archived), **confidentiality shield** for Sensitive, **version badge** (v3), **AI-status chip** (neutral grey in this batch), file size + date in tabular numerals. Keep the existing InfraOS visual identity — this should feel like a premium document workspace, not a file-manager clone.

### 5.3 Screens (each with loading / empty / error / forbidden / offline states; every control functional)

**A. DocTrace dashboard + library (`/documents`)**
- Header: scope chip, **Upload documents** (primary), view toggle **Table | Grid**, Export (with `report.export`).
- **Insight strip** (click-to-filter, aria-live): Total active · Added this month · Drafts · Expiring in 30 d (`expiresAt`) · Sensitive · Awaiting files (legacy rows without bytes). Real numbers only, from `/documents/summary`.
- **Category rail/chips** by group with counts (facets) — click to filter; "All" and "Clear".
- **Charts (custom SVG, small):** documents by category (horizontal bars), uploads per month (last 6), storage used by category (sizes; labelled approximate).
- **Filter bar:** search (debounced, shows the "titles, references, tags and descriptions" hint, `/` focuses it, `Esc` clears), category, project (typeahead), agency (if multi), file type, status, upload date range, tags, "Mine", "Sensitive", "Archived" (permitted roles), "Inspection evidence". Applied-filter chips, URL state, **saved views** menu (§4.6), result count, sort menu.
- **Table:** select checkbox (bulk: Download as individual files is NOT provided; bulk **Archive**, bulk **Add tag**, bulk **Change category** — each with confirm and per-item result summary), icon, title (highlight) + docNo, category chip, project link, agency, version, size, uploaded by/date, status, AI status chip, row menu (Open · Preview · Download · Replace file · Edit details · Archive/Restore · Delete (archived only) · Copy link (in-app link only)). **Grid:** cards with a type-aware tile, title, chips, quick actions. Pagination controls (page size 10/25/50), keyboard navigable, mobile = card list with bottom-sheet filters and a FAB for upload.
- **Preview drawer** (right on desktop, full-screen sheet on mobile): header (title, chips, next/previous in list), preview pane (PDF/image/text via authenticated blob URL in a sandboxed `<iframe>`/`<img>`; text rendered as `<pre>`; DOCX/XLSX show a metadata card + Download; error and "File not available" states), metadata summary, Open details, Download, Replace.

**B. Upload wizard (`/documents/upload` + modal)**
Stepper: **1 Files** (drag-drop + picker + paste; multi-file ≤ 10; instant client checks for type/size mirroring the server constants; per-file thumbnails/icons; remove/reorder) → **2 Classify** (per-file or "apply to all": category picker with grouped list and **suggestion** badge, title, description, tags, document date, reference, language, confidentiality + visibility (with plain-language explanation of who can see it)) → **3 Link** (project typeahead (scope-limited), agency (auto/readonly), contractor/inspection/payment/asset pickers appear only when the category allows; invalid combinations explained) → **4 Review & upload** (summary table; duplicate warnings per file with "Upload anyway / Skip / Open existing"; start upload) → per-file **progress bars** (real XHR/fetch progress from the Batch 06 upload queue), pause-free retry, cancel, success/failed states with specific, localised error messages (`FILE_TOO_LARGE`, signature mismatch, etc.), final screen with links to each new document. Partial success is handled explicitly (some files uploaded, some failed → retry failed only). Navigating away during upload warns.

**C. Document details (`/documents/[id]`)**
- Hero: icon, title (inline edit with permission), docNo, chips (category, status, confidentiality, AI status, version), project/agency/contractor links, primary actions: Preview · Download · Replace file · Edit · Archive/Restore · more.
- Tabs: **Overview** (editable metadata form with react-hook-form + zod, `version` conflict handling "This document changed — reload"), **Preview** (large pane), **Versions** (timeline cards with changeNote, uploader, size, hash short form, per-version Download/Restore/Remove (GOV_ADMIN); **Replace file** dialog = upload protocol with required change note), **Links** (resolved links with per-link permission tiering; add/remove links via pickers with server validation), **Activity** (humanised audit list with filters; cursor "Load more"), **Access** (read-only explanation: visibility, confidentiality, who can see — computed from policy, **no** per-user sharing feature).
- Danger zone: Archive (reason), Restore, Permanent delete (archived only; typed docNo confirm; blocked reasons displayed with links to referencing records), Restrict (GOV_ADMIN/AGENCY_OFFICER with reason).
- Mobile: tabs as scrollable segmented control; sticky action bar.

**D. Project/entity panels**
`<LinkedDocumentsPanel>`: compact list, category filter, upload button (pre-fills links), preview drawer, "Open in DocTrace". Placed on the project page and on the other entity pages that exist.

### 5.4 i18n
Complete `en/si/ta` dictionaries for every string: nav, categories and groups, statuses, confidentiality, visibility explanations, wizard steps, error codes, empty/forbidden/offline states, table/grid labels, bulk actions, aria-labels, date/size formatting hints. Locale-aware dates/sizes/numbers via `Intl`. **Never translate stored data** (titles, file names, docNo, tags, notes). Reuse existing Sinhala/Tamil terminology; flag uncertain translations in the report. Check long strings in chips, stepper and table headers.

### 5.5 API client and state
`lib/documents/api.ts` with `guard()/moved()`; React Query keys include epoch/userId/roleKey; precise invalidation (list, summary, detail, versions, activity, project panels); abortable queries; blob URLs revoked on unmount; no tokens/storage details in URLs or logs; uploads via the shared Batch 06 queue.

---

## 6. AUTONOMOUS SELF-HEALING LOOP

At every ✔ checkpoint in §7 and before each push:
1. **Implement** the checkpoint.
2. **Run the essential checks** for what you touched: `npm run type-check`, `npm run lint` (touched workspaces), the relevant vitest files (`documents.*`, inspections evidence regression, identity/permission parity), `npm run db:indexes:check`, `npm run db:seed:demo` + `db:seed:verify` when seeds changed, finally `npm run build:web`.
3. **Identify failures** precisely (first error, file:line, root-cause hypothesis); re-run only the failing command to confirm.
4. **Fix the root cause.** Never delete/skip/weaken tests, add `eslint-disable`/`@ts-ignore`/`any`, loosen validation, authorization or scope rules, special-case test data or fabricate results to turn a check green. Pre-existing baseline failures: list and work around narrowly.
5. **Re-run.** **Max 3 repair iterations per distinct failure.** If still failing, stop that thread and record it under "Unresolved" (error text, hypotheses tried, what you need) — **never hide or downplay** unresolved errors or flaky behaviour; do not loop further.
6. When critical checks are green, self-review against §9 before committing.
7. Keep a ≤ 12-line check log (command → pass/fail → fix) for the report.

---

## 7. IMPLEMENTATION SEQUENCE (commit at each ✔; don't advance until its checks are green)

1. Preflight + branch (§3, §11).
2. **Shared types & permissions:** category registry (shared), enums, `document.update`/`document.restrict` decision + grants, parity tests, propagation path. ✔
3. **Models & indexes & backfill:** `Document` extension, `documentVersions`, text index, tombstone fields, `check-indexes`, backfill script, orphan-cleanup script. ✔
4. **Pure logic (+ small tests):** file validation (allowlist, magic bytes, ZIP guard, filename sanitiser), `documentAccess` ⇄ `documentReadFilter` agreement, link/category rules, search query builder + highlight segmenter (regex-escape tests). ✔
5. **Upload/storage services & routes:** init/stream/commit/abort, duplicate detection, versions (replace/restore), download/preview streaming with safe headers, events emitter (no subscribers). ✔
6. **Document CRUD/search/summary/activity/export routes**, archive/restore/delete + tombstones, restrict, audit + notices. ✔
7. **Project and entity endpoints**; Batch 06 evidence-origin handling; regression run of inspections evidence. ✔
8. **Seeds + reset/verify** (real tiny files, blobs removed on reset). ✔
9. **Frontend foundation:** routes, nav, API client, messages skeleton, chips/icons, dropzone, upload queue wiring. ✔
10. **Library + dashboard + preview drawer + filters/saved views + bulk actions.** ✔
11. **Upload wizard** (modal + page) with duplicate warnings and partial-failure retry. ✔
12. **Details page** (all tabs, replace/restore/archive/delete/restrict) + project/entity panels. ✔
13. i18n (si/ta) completion + responsive/a11y/visual polish (375/768/1280). ✔
14. Essential verification (§8), self-review (§9), cleanup, push, PR. ✔

---

## 8. ESSENTIAL VERIFICATION (keep it small, but do all of it)

**Automated (focused, fast):** (a) file validation table: valid PDF/DOCX/TXT/PNG pass; extension-spoofed `.pdf` containing an EXE header, HTML renamed to `.txt`, SVG, zero-byte, oversize, NUL-containing "text", ZIP bomb DOCX, path-traversal/RTL file names all rejected with the right code and **no stored bytes**; (b) `documentAccess` vs `documentReadFilter` produce identical allow/deny over a role × agency × visibility × confidentiality × status matrix; (c) two-agency isolation: other agency's document id → 404 on details/download/preview/versions/activity and absent from list, facets and counts; inspector sees only the allowlisted categories on assigned projects; contractor/citizen denied; (d) upload protocol: abort leaves no blob; commit is atomic (document + version + audit together); replacement keeps old version downloadable and resets `extractedTextStatus`; duplicate hash warns; archive hides from search; permanent delete removes bytes, keeps tombstone, blocked when referenced; (e) response bodies never contain `storageKey/storageUrl/gridfs` fields (assert on JSON of list/detail/version routes); (f) search: `q` with regex metacharacters is safe, highlights are segments, filters combine, pagination stable; (g) audit allowlist accepts all new actions and nothing leaks file names/content.
**Manual (short browser walkthrough, 375/768/1280):** upload 3 mixed files incl. one rejected; classify, link to a project; preview PDF/image/text; replace a file with a change note; filter + search + saved view; archive → restore → (archived) delete with typed confirm; bulk archive; switch to si/ta; keyboard-only pass through the wizard and drawer; log in as a second-agency user and as an inspector and confirm isolation.
**Regression:** inspections evidence upload/download unchanged; existing seeds and `reset-demo` clean; `npm run test:api` documents/inspections/identity subsets, `npm run build:web`, `npm run lint`, `npm run type-check` (separate pre-existing failures from new).

---

## 9. WHAT MUST NOT HAPPEN (self-check before pushing)
- A control that renders but does nothing; dead links; "coming soon" UI; fake counts or charts; a claim of content/semantic search or AI processing.
- Any storage key/URL/GridFS id/credential in a response, log, audit snapshot or URL; inline serving of HTML/SVG; downloads without authentication.
- Trusting the client MIME/extension; fully buffering large uploads in memory; partial blobs left after failures.
- Cross-agency leakage (incl. via counts, facets, highlights, notices, activity, links); `PUBLIC` treated as anonymous; contractors/citizens gaining access; inspectors seeing financial/sensitive categories.
- Rewriting version history; hard-deleting without archive-first, reason, confirm and tombstone; deleting referenced documents.
- Duplicated storage/validator/upload code; new dependencies without justification; AI/Python/embedding code.
- User regexes in Mongo queries; `dangerouslySetInnerHTML` for highlights; colour-only status; hover-only mobile affordances; tap targets < 44 px; horizontal scroll on phones.
- Weakened/skipped tests; hidden unresolved errors; unrelated refactors; secrets or real data committed.

---

## 10. (reserved)

---

## 11. GITHUB WORKFLOW

- **Base:** `development` (once Phase 9 batches are merged; else §3.2).
- **Branch:** `feature/doctrace-management` (adapt to repo convention).
- **Commits (Conventional Commits, one per ✔):**
  1. `feat(documents): document permissions, shared category registry and enums (Steps 108-110 foundation)`
  2. `feat(documents): extend document model, add versions, indexes, backfill and cleanup scripts`
  3. `feat(documents): file validation, access policy and search logic`
  4. `feat(documents): secure upload, versioning, download and preview services (Step 108)`
  5. `feat(documents): DocTrace management, search, archive and activity APIs (Steps 109-110)`
  6. `feat(documents): project and entity document endpoints`
  7. `chore(seed): synthetic DocTrace demo documents and verification`
  8. `feat(documents): DocTrace foundation, library, filters and preview drawer`
  9. `feat(documents): upload wizard with duplicate handling and progress`
  10. `feat(documents): document details, versions, links and linked-documents panels`
  11. `feat(documents): si/ta copy, responsive and accessibility polish`
  12. `test(documents): validation, access matrix, isolation and storage essentials`
- Before each commit: type-check + lint touched workspaces. Never commit `.env*`, secrets, real data or `node_modules`.
- **Push:** `git push -u origin feature/doctrace-management` (no force). **Do not merge.** Open a PR into `development` (squash): title `feat(documents): Phase 10 Batch 08 — DocTrace secure document management, categorization and search (Steps 108–110)`; body = shipped features per step, endpoints, collections/indexes, permission changes + the **command to apply grants to existing databases**, storage notes (provider, limits, Atlas size caveat), new env/config constants, backfill/cleanup instructions, verification results incl. the self-healing check log, known gaps, decisions needed. If you can't open the PR, give me the exact title/body.

---

## 12. COMPLETION CRITERIA (all must be true)

- [ ] **Step 108:** validated upload (single/multi, streamed, progress, duplicate warning), authenticated download/preview with safe headers, immutable versions with replace/restore, archive/restore/permanent delete with tombstones, audit, no storage exposure.
- [ ] **Step 109:** dashboard, library (table + grid), details, upload wizard, edit/status/ownership, links to agency/project/contractor/inspection/payment/asset (where those modules exist), activity history, project/entity panels.
- [ ] **Step 110:** category registry (extensible), suggestions, tags, full metadata filters, permission-safe search with segment highlighting, facets, pagination, saved views, honest "metadata search" labelling.
- [ ] Permissions applied via the documented idempotent path; role matrix reported; out-of-scope → 404; two-agency isolation verified.
- [ ] Batch 09 seam in place (events emitter, AI-readiness fields, internal stream function) with **no** AI logic; Batch 06 evidence regression green.
- [ ] UI premium and consistent with earlier batches, responsive (375/768/1280), accessible, en/si/ta complete; **every control functional**.
- [ ] Seeds idempotent with real tiny files; reset/verify updated; index check green.
- [ ] Self-healing loop executed; all critical checks green or explicitly **Unresolved**; branch pushed; PR text ready.

---

## 13. FINAL REPORT (short)

(1) Preflight findings and deviations from §2 (printed permission matrix, which Phase 9 pieces were present, which link types were skipped); (2) what shipped per step (108/109/110) incl. unique functions (duplicate warning, version restore, safe highlighting, saved views, linked-documents panels); (3) endpoints, collections, indexes, permissions and env/config constants; (4) decisions needing my approval (new permissions or the alternative chosen, PDF active-content policy, inspector category allowlist, SENSITIVE rules, file-size default, saved-views storage); (5) storage notes (provider, limits, Atlas size caveat); (6) verification results + self-healing check log + any **Unresolved**; (7) uncertain translations; (8) **Batch 09 handoff notes**: events emitter contract, `openDocumentStream` usage, fields/statuses Batch 09 will own (`extractedTextStatus`, `pageCount`, `documentChunks`), where `aiProcessingAllowed` is enforced, recommended Atlas Vector Search checks (cluster tier/index support) and the exact env vars still needed (`AI_BASE_URL`, `AI_INTERNAL_SECRET`, `OPENROUTER_API_KEY` status); (9) known gaps and sensible future work (R2/S3 provider, content search arrives in Batch 09/10, malware scanning).

Stop after the report. Do not start Batch 09.
