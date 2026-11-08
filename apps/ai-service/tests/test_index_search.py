import json
import time

import httpx
import pytest
from pydantic import SecretStr
from fastapi.testclient import TestClient
from qdrant_client import QdrantClient

from app.config import Settings
from app.embeddings.base import plan_batches
from app.embeddings.openai_compatible import OpenAICompatibleEmbedder
from app.errors import ApiError
from app.main import create_app
from app.security import sha256_hex, sign

from .conftest import SECRET

DOC_A = "a" * 24
DOC_B = "b" * 24
AGENCY = "c" * 24


def call(client: TestClient, path: str, payload: dict | None = None):
    body = json.dumps(payload).encode() if payload is not None else b""
    ts = str(int(time.time() * 1000))
    h = {"X-Infraos-Timestamp": ts, "X-Infraos-Request-Id": "r1", "Content-Type": "application/json",
         "X-Infraos-Signature": sign(SECRET, "POST", path, ts, sha256_hex(body))}
    return client.post(path, content=body, headers=h)


@pytest.fixture()
def api(settings: Settings) -> TestClient:
    app = create_app(settings)
    app.state.qdrant = QdrantClient(":memory:")  # in-process Qdrant, test only
    return TestClient(app, raise_server_exceptions=False)


def chunks(doc: str, version: int, texts: list[str]) -> list[dict]:
    import hashlib

    return [{"chunkId": f"{doc}:{version}:{i}", "chunkIndex": i, "text": t, "pageStart": 1, "pageEnd": 1, "section": None,
             "contentHash": hashlib.sha256(t.encode()).hexdigest()} for i, t in enumerate(texts)]


def index(api: TestClient, doc: str, version: int, texts: list[str]):
    return call(api, "/v1/index", {"documentId": doc, "versionNo": version, "projectId": None, "agencyId": AGENCY,
                                    "category": "CONTRACT", "chunks": chunks(doc, version, texts)})


def search(api: TestClient, query: str, allowed: list[str]):
    return call(api, "/v1/search", {"query": query, "allowedDocumentIds": allowed, "topK": 5})


def test_index_then_search_is_filtered_by_allow_list(api: TestClient) -> None:
    assert index(api, DOC_A, 1, ["asphalt road resurfacing contract", "drainage culvert inspection report"]).status_code == 200
    assert index(api, DOC_B, 1, ["asphalt road resurfacing tender"]).status_code == 200
    r = search(api, "asphalt road resurfacing", [DOC_A])
    assert r.status_code == 200
    docs = {h["documentId"] for h in r.json()["hits"]}
    assert docs == {DOC_A}  # DOC_B scores well but is not in the allow-list
    assert all("text" not in h for h in r.json()["hits"])


def test_search_requires_allow_list(api: TestClient) -> None:
    assert call(api, "/v1/search", {"query": "x"}).status_code == 422
    assert call(api, "/v1/search", {"query": "x", "allowedDocumentIds": []}).status_code == 422
    assert call(api, "/v1/search", {"query": "x", "allowedDocumentIds": ["not-an-id"]}).status_code == 422


def test_payload_never_contains_text(api: TestClient) -> None:
    index(api, DOC_A, 1, ["secret clause text must not be stored in the payload"])
    client: QdrantClient = api.app.state.qdrant  # type: ignore[attr-defined]
    name = client.get_collections().collections[0].name
    pts, _ = client.scroll(name, with_payload=True, limit=10)
    assert pts and all("text" not in p.payload and "secret" not in json.dumps(p.payload) for p in pts)


def test_version_swap_removes_old_points_and_retry_skips_embedding(api: TestClient) -> None:
    index(api, DOC_A, 1, ["old content about bridges"])
    r2 = index(api, DOC_A, 2, ["new content about culverts"])
    assert r2.json()["embedded"] == 1
    hits = search(api, "bridges", [DOC_A]).json()["hits"]
    assert {h["versionNo"] for h in hits} == {2}
    again = index(api, DOC_A, 2, ["new content about culverts"])  # idempotent retry
    assert again.json()["embedded"] == 0 and again.json()["skipped"] == 1


def test_delete_is_idempotent(api: TestClient) -> None:
    index(api, DOC_A, 1, ["to be purged"])
    first = call(api, "/v1/delete", {"documentId": DOC_A})
    second = call(api, "/v1/delete", {"documentId": DOC_A})
    assert first.status_code == 200 and first.json()["removed"] == 1
    assert second.status_code == 200 and second.json()["removed"] == 0
    assert search(api, "purged", [DOC_A]).json()["hits"] == []


def test_dimension_mismatch_with_existing_collection(api: TestClient) -> None:
    from qdrant_client import models as qm

    index(api, DOC_A, 1, ["seed the collection"])
    client: QdrantClient = api.app.state.qdrant  # type: ignore[attr-defined]
    name = client.get_collections().collections[0].name
    client.delete_collection(name)
    client.create_collection(name, vectors_config=qm.VectorParams(size=8, distance=qm.Distance.COSINE))
    r = index(api, DOC_A, 1, ["now the dimension differs"])
    assert r.status_code == 409 and r.json()["code"] == "DIMENSION_MISMATCH"


def test_reindex_plan_is_read_only(api: TestClient) -> None:
    index(api, DOC_A, 1, ["one"])
    r = call(api, "/v1/admin/reindex-plan")
    assert r.status_code == 200 and r.json()["targetExists"] is True and r.json()["collections"][0]["points"] == 1


def test_unsigned_index_rejected(api: TestClient) -> None:
    assert api.post("/v1/index", json={}).status_code == 401


# ---- embeddings adapter -------------------------------------------------------------------------------------------

def make_adapter(handler, s: Settings) -> tuple[OpenAICompatibleEmbedder, list[float]]:
    sleeps: list[float] = []

    async def fake_sleep(d: float) -> None:
        sleeps.append(d)

    s2 = s.model_copy(update={"openrouter_api_key": SecretStr("k" * 10), "ai_embed_model": "x/y"})
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler), timeout=5)
    return OpenAICompatibleEmbedder(s2, client=client, sleep=fake_sleep), sleeps


def ok_body(n: int, dim: int = 4) -> dict:
    return {"model": "x/y", "data": [{"index": i, "embedding": [0.1] * dim} for i in range(n)], "usage": {"prompt_tokens": 7 * n}}


@pytest.mark.asyncio
async def test_adapter_retries_429_then_succeeds(settings: Settings) -> None:
    calls = {"n": 0}

    def handler(req: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(429) if calls["n"] < 3 else httpx.Response(200, json=ok_body(2))

    emb, sleeps = make_adapter(handler, settings)
    res = await emb.embed(["a", "b"])
    assert calls["n"] == 3 and len(sleeps) == 2 and res.dimension == 4 and res.tokens == 14


@pytest.mark.asyncio
async def test_adapter_does_not_retry_400(settings: Settings) -> None:
    calls = {"n": 0}

    def handler(req: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(400, json={"error": "bad"})

    emb, _ = make_adapter(handler, settings)
    with pytest.raises(ApiError) as e:
        await emb.embed(["a"])
    assert calls["n"] == 1 and e.value.code == "EMBEDDING_PROVIDER_ERROR"


@pytest.mark.asyncio
async def test_adapter_rate_limit_exhaustion_is_classified(settings: Settings) -> None:
    emb, _ = make_adapter(lambda r: httpx.Response(429), settings)
    with pytest.raises(ApiError) as e:
        await emb.embed(["a"])
    assert e.value.code == "EMBEDDING_RATE_LIMITED"


@pytest.mark.asyncio
async def test_adapter_rejects_wrong_vector_count(settings: Settings) -> None:
    emb, _ = make_adapter(lambda r: httpx.Response(200, json=ok_body(1)), settings)
    with pytest.raises(ApiError):
        await emb.embed(["a", "b"])


def test_batch_planning_respects_limits() -> None:
    texts = ["x" * 400] * 10  # ~100 tokens each
    groups = plan_batches(texts, max_items=4, max_tokens=250)
    assert all(len(g) <= 2 for g in groups) and sum(len(g) for g in groups) == 10
    assert plan_batches(["x" * 400 * 100], 64, 8000) == [[0]]  # oversized single text still gets a batch
