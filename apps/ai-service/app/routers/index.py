from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.concurrency import run_in_threadpool

from ..deps import get_embedder, get_store
from ..embeddings.base import embed_all
from ..errors import ApiError
from ..logging import log_event
from ..schemas import DeleteRequest, DeleteResponse, IndexRequest, IndexResponse
from ..security import require_signed_body
from ..vectorstore.qdrant_store import point_id

router = APIRouter(prefix="/v1", dependencies=[Depends(require_signed_body)])


@router.post("/index", response_model=IndexResponse)
async def index(req: IndexRequest, request: Request) -> IndexResponse:
    """Embeds in batches and upserts; deletes other versions only after everything for this version succeeded."""
    app = request.app
    s = app.state.settings
    store = get_store(app)
    embedder = get_embedder(app)

    # Probe the live dimension first (one tiny request, cached) so the collection can be named and checked before any real spend.
    from ..deps import get_dimension

    dim = await get_dimension(app)
    if not dim:
        raise ApiError("EMBEDDING_PROVIDER_ERROR")
    name = store.collection_name(embedder.model, dim)
    await run_in_threadpool(store.ensure_collection, name, dim)

    ids = {c.chunkId: point_id(c.chunkId) for c in req.chunks}
    existing = await run_in_threadpool(store.existing_hashes, name, list(ids.values()))
    todo = [c for c in req.chunks if existing.get(ids[c.chunkId]) != c.contentHash]
    skipped = len(req.chunks) - len(todo)

    tokens, model = 0, embedder.model
    if todo:
        res = await embed_all(embedder, [c.text for c in todo], s.embed_batch_size, s.embed_batch_max_tokens)
        if res.dimension != dim:
            raise ApiError("DIMENSION_MISMATCH")
        tokens, model = res.tokens, res.model
        points = [
            (ids[c.chunkId], vec, {
                "documentId": req.documentId, "versionNo": req.versionNo, "projectId": req.projectId, "agencyId": req.agencyId,
                "chunkId": c.chunkId, "chunkIndex": c.chunkIndex, "pageStart": c.pageStart, "pageEnd": c.pageEnd,
                "category": req.category, "contentHash": c.contentHash,  # hash only; chunk text is never stored here
            })
            for c, vec in zip(todo, res.vectors, strict=True)
        ]
        await run_in_threadpool(store.upsert, name, points)
    await run_in_threadpool(store.swap_version, name, req.documentId, req.versionNo)
    log_event("index", document_id=req.documentId, version_no=req.versionNo, embedded=len(todo), skipped=skipped, tokens=tokens)
    return IndexResponse(embedded=len(todo), skipped=skipped, tokens=tokens, model=model, dimension=dim, collection=name)


@router.post("/delete", response_model=DeleteResponse)
async def delete(req: DeleteRequest, request: Request) -> DeleteResponse:
    store = get_store(request.app)
    removed = await run_in_threadpool(store.delete_document, req.documentId, req.keepVersionNo)
    log_event("delete", document_id=req.documentId, removed=removed)
    return DeleteResponse(removed=removed)
