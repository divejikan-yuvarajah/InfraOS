"""Qdrant access (the only datastore of this service). Extended with index/delete/search in a later commit."""
from __future__ import annotations

from qdrant_client import QdrantClient

from ..config import Settings


def make_client(s: Settings) -> QdrantClient:
    return QdrantClient(
        url=s.qdrant_url,
        api_key=s.qdrant_api_key.get_secret_value() or None,
        timeout=int(s.qdrant_timeout_s),
    )


def ping(s: Settings) -> bool:
    """True when Qdrant answers. Never raises, never exposes the URL."""
    if not s.qdrant_url:
        return False
    try:
        make_client(s).get_collections()
        return True
    except Exception:  # noqa: BLE001 - readiness probe must not leak provider errors
        return False
