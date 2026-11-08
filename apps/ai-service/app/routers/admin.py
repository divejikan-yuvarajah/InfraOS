from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.concurrency import run_in_threadpool

from ..deps import get_dimension, get_embedder, get_store
from ..errors import ApiError
from ..schemas import CollectionInfo, DropCollectionRequest, DropCollectionResponse, ReindexPlanResponse
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


@router.post("/drop-collection", response_model=DropCollectionResponse)
async def drop_collection(req: DropCollectionRequest, request: Request) -> DropCollectionResponse:
    """Final step of a reindex. Refuses anything that is not one of this service's collections or that is the active target collection."""
    app = request.app
    store = get_store(app)
    model = get_embedder(app).model
    dim = await get_dimension(app)
    if not dim:
        raise ApiError("EMBEDDING_PROVIDER_ERROR")
    names = await run_in_threadpool(store.collections)
    if req.name not in names or req.name == store.collection_name(model, dim):
        raise ApiError("VALIDATION_ERROR")
    await run_in_threadpool(store.drop_collection, req.name)
    return DropCollectionResponse(dropped=True)
