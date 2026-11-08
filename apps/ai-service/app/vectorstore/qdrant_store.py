"""Qdrant access: the only datastore of this service. No chunk text is ever stored in payloads.

Collection: {QDRANT_COLLECTION}__{modelSlug}__{dim}, cosine. Points use deterministic UUIDv5 ids derived from chunkId so retries are idempotent.
A version swap deletes points of other versions only after the new version is fully upserted, so search never sees a half-indexed document.
"""
from __future__ import annotations

import re
import uuid
from typing import Any

from qdrant_client import QdrantClient
from qdrant_client import models as qm

from ..config import Settings
from ..errors import ApiError
from ..logging import log_event

NAMESPACE = uuid.UUID("6f1b6b0e-6a43-5c64-9a0e-3f1c2d9a7b11")
UPSERT_BATCH = 100
KEYWORD_FIELDS = ("documentId", "projectId", "agencyId", "category")


def make_client(s: Settings) -> QdrantClient:
    return QdrantClient(url=s.qdrant_url, api_key=s.qdrant_api_key.get_secret_value() or None, timeout=int(s.qdrant_timeout_s))


def ping(s: Settings) -> bool:
    """True when Qdrant answers. Never raises, never exposes the URL."""
    if not s.qdrant_url:
        return False
    try:
        make_client(s).get_collections()
        return True
    except Exception:  # noqa: BLE001 - readiness probe must not leak provider errors
        return False


def model_slug(model: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", model.lower()).strip("-")[:48] or "model"


def point_id(chunk_id: str) -> str:
    return str(uuid.uuid5(NAMESPACE, chunk_id))


class QdrantStore:
    def __init__(self, client: QdrantClient, s: Settings) -> None:
        self.client = client
        self.base = s.qdrant_collection

    def collection_name(self, model: str, dim: int) -> str:
        return f"{self.base}__{model_slug(model)}__{dim}"

    def _guard(self, fn):  # noqa: ANN001, ANN202
        try:
            return fn()
        except ApiError:
            raise
        except Exception:  # noqa: BLE001
            log_event("qdrant_error")
            raise ApiError("VECTOR_STORE_ERROR") from None

    def ensure_collection(self, name: str, dim: int) -> None:
        def run() -> None:
            if self.client.collection_exists(name):
                info = self.client.get_collection(name)
                vectors = info.config.params.vectors
                size = vectors.size if hasattr(vectors, "size") else None  # type: ignore[union-attr]
                if size is not None and size != dim:
                    raise ApiError("DIMENSION_MISMATCH")
                return
            self.client.create_collection(name, vectors_config=qm.VectorParams(size=dim, distance=qm.Distance.COSINE))
            for f in KEYWORD_FIELDS:
                self.client.create_payload_index(name, f, qm.PayloadSchemaType.KEYWORD)
            self.client.create_payload_index(name, "versionNo", qm.PayloadSchemaType.INTEGER)

        self._guard(run)

    def existing_hashes(self, name: str, ids: list[str]) -> dict[str, str]:
        """point id -> contentHash for points that already exist (lets retries skip re-embedding)."""
        found: dict[str, str] = {}

        def run() -> None:
            for i in range(0, len(ids), 200):
                for rec in self.client.retrieve(name, ids[i:i + 200], with_payload=["contentHash"], with_vectors=False):
                    found[str(rec.id)] = str((rec.payload or {}).get("contentHash", ""))

        self._guard(run)
        return found

    def upsert(self, name: str, points: list[tuple[str, list[float], dict[str, Any]]]) -> None:
        def run() -> None:
            for i in range(0, len(points), UPSERT_BATCH):
                batch = points[i:i + UPSERT_BATCH]
                self.client.upsert(name, points=[qm.PointStruct(id=pid, vector=vec, payload=payload) for pid, vec, payload in batch], wait=True)

        self._guard(run)

    def swap_version(self, name: str, document_id: str, keep_version: int) -> None:
        flt = qm.Filter(must=[qm.FieldCondition(key="documentId", match=qm.MatchValue(value=document_id))],
                        must_not=[qm.FieldCondition(key="versionNo", match=qm.MatchValue(value=keep_version))])
        self._guard(lambda: self.client.delete(name, points_selector=qm.FilterSelector(filter=flt), wait=True))

    def collections(self) -> list[str]:
        prefix = f"{self.base}__"
        return self._guard(lambda: sorted(c.name for c in self.client.get_collections().collections if c.name.startswith(prefix)))

    def delete_document(self, document_id: str, keep_version: int | None) -> int:
        """Idempotent. Removes points from every collection of this service (covers pre-reindex collections)."""
        must = [qm.FieldCondition(key="documentId", match=qm.MatchValue(value=document_id))]
        must_not = [qm.FieldCondition(key="versionNo", match=qm.MatchValue(value=keep_version))] if keep_version is not None else None
        flt = qm.Filter(must=must, must_not=must_not)
        removed = 0
        for name in self.collections():
            removed += self._guard(lambda n=name: self.client.count(n, count_filter=flt, exact=True).count)
            self._guard(lambda n=name: self.client.delete(n, points_selector=qm.FilterSelector(filter=flt), wait=True))
        return removed

    def search(self, name: str, vector: list[float], allowed: list[str], top_k: int, category: str | None, project_id: str | None,
               threshold: float | None) -> list[dict[str, Any]]:
        must: list[qm.Condition] = [qm.FieldCondition(key="documentId", match=qm.MatchAny(any=allowed))]
        if category:
            must.append(qm.FieldCondition(key="category", match=qm.MatchValue(value=category)))
        if project_id:
            must.append(qm.FieldCondition(key="projectId", match=qm.MatchValue(value=project_id)))

        def run() -> list[dict[str, Any]]:
            if not self.client.collection_exists(name):
                return []
            res = self.client.query_points(name, query=vector, query_filter=qm.Filter(must=must), limit=top_k, with_payload=True,
                                           score_threshold=threshold)
            return [{"score": float(p.score), **(p.payload or {})} for p in res.points]

        return self._guard(run)

    def drop_collection(self, name: str) -> None:
        self._guard(lambda: self.client.delete_collection(name))

    def stats(self, name: str) -> dict[str, Any]:
        def run() -> dict[str, Any]:
            return {"name": name, "points": self.client.count(name, exact=True).count}

        return self._guard(run)
