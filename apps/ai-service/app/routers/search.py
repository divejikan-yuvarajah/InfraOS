from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.concurrency import run_in_threadpool

from ..deps import get_embedder, get_store
from ..embeddings.base import embed_all
from ..logging import log_event
from ..schemas import SearchHit, SearchRequest, SearchResponse
from ..security import require_signed_body

router = APIRouter(prefix="/v1", dependencies=[Depends(require_signed_body)])


@router.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest, request: Request) -> SearchResponse:
    """Vector search restricted to the allow-list Express supplies (pydantic rejects a missing or empty list). Returns no chunk text."""
    app = request.app
    s = app.state.settings
    store = get_store(app)
    embedder = get_embedder(app)
    res = await embed_all(embedder, [req.query], s.embed_batch_size, s.embed_batch_max_tokens)
    name = store.collection_name(embedder.model, res.dimension)
    f = req.filters
    rows = await run_in_threadpool(
        store.search, name, res.vectors[0], req.allowedDocumentIds, req.topK,
        f.category if f else None, f.projectId if f else None, req.scoreThreshold,
    )
    hits = [
        SearchHit(chunkId=str(r["chunkId"]), documentId=str(r["documentId"]), versionNo=int(r["versionNo"]), score=float(r["score"]),
                  pageStart=r.get("pageStart"), pageEnd=r.get("pageEnd"))
        for r in rows
    ]
    log_event("search", hits=len(hits), allowed=len(req.allowedDocumentIds), tokens=res.tokens)
    return SearchResponse(hits=hits, model=res.model, dimension=res.dimension, tokens=res.tokens)
