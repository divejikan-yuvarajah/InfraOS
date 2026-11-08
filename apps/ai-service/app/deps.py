"""Lazy singletons stored on app.state (tests may pre-populate `embedder` / `qdrant`)."""
from __future__ import annotations

from fastapi import FastAPI

from .embeddings.base import Embedder
from .embeddings.fake import FakeEmbedder
from .embeddings.openai_compatible import OpenAICompatibleEmbedder
from .errors import ApiError
from .vectorstore.qdrant_store import QdrantStore, make_client


def get_embedder(app: FastAPI) -> Embedder:
    emb = getattr(app.state, "embedder", None)
    if emb is not None:
        return emb
    s = app.state.settings
    if s.is_test:  # the fake embedder exists only for automated tests (APP_ENV=test)
        emb = FakeEmbedder()
    else:
        if not (s.ai_embed_model and s.embed_key):
            raise ApiError("NOT_CONFIGURED")
        emb = OpenAICompatibleEmbedder(s)
    app.state.embedder = emb
    return emb


def get_store(app: FastAPI) -> QdrantStore:
    s = app.state.settings
    client = getattr(app.state, "qdrant", None)
    if client is None:
        if not s.qdrant_url:
            raise ApiError("NOT_CONFIGURED")
        client = make_client(s)
        app.state.qdrant = client
    return QdrantStore(client, s)


async def get_dimension(app: FastAPI) -> int | None:
    """Embedding dimension from a live one-token probe (cached). None when the provider is unavailable."""
    dim = getattr(app.state, "embed_dim", None)
    if dim:
        return dim
    try:
        res = await get_embedder(app).embed(["dimension probe"])
    except ApiError:
        return None
    app.state.embed_dim = res.dimension
    return res.dimension
