from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.concurrency import run_in_threadpool

from ..security import require_signed_body
from ..vectorstore import qdrant_store

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, str]:
    """Unauthenticated liveness for Render. Reveals nothing else."""
    return {"status": "ok"}


@router.get("/ready", dependencies=[Depends(require_signed_body)])
async def ready(request: Request) -> dict[str, object]:
    s = request.app.state.settings
    qdrant_ok = await run_in_threadpool(qdrant_store.ping, s)
    embed_configured = bool(s.ai_embed_model and s.embed_key)
    return {
        "status": "ready" if (qdrant_ok and embed_configured) else "degraded",
        "checks": {
            "config": True,
            "qdrant": qdrant_ok,
            "embeddingProviderConfigured": embed_configured,
        },
        "embeddingModel": s.ai_embed_model or None,
        "collectionBase": s.qdrant_collection,
    }
