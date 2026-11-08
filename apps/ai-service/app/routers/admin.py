from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.concurrency import run_in_threadpool

from ..deps import get_dimension, get_embedder, get_store
from ..errors import ApiError
from ..schemas import CollectionInfo, ReindexPlanResponse
from ..security import require_signed_body

router = APIRouter(prefix="/v1/admin", dependencies=[Depends(require_signed_body)])


@router.post("/reindex-plan", response_model=ReindexPlanResponse)
async def reindex_plan(request: Request) -> ReindexPlanResponse:
    """Read-only: reports the configured model/dimension, the target collection and existing collections. Changes no data."""
    app = request.app
    store = get_store(app)
    try:
        model = get_embedder(app).model
    except ApiError:
        model = None
    dim = await get_dimension(app) if model else None
    target = store.collection_name(model, dim) if model and dim else None
    names = await run_in_threadpool(store.collections)
    infos = [CollectionInfo(**await run_in_threadpool(store.stats, n)) for n in names]
    return ReindexPlanResponse(configuredModel=model, dimension=dim, targetCollection=target, collections=infos,
                               targetExists=bool(target and target in names))
