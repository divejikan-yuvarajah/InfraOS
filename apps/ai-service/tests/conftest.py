import os
import time

import pytest
from fastapi.testclient import TestClient

SECRET = "t" * 48
os.environ.update({
    "APP_ENV": "test",
    "AI_INTERNAL_SECRET": SECRET,
    "AI_EMBED_MODEL": "test/model",
    "QDRANT_URL": "http://127.0.0.1:1",  # unreachable on purpose; unit tests never use a live Qdrant
    "OPENROUTER_API_KEY": "",
})

from app.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402
from app.security import sha256_hex, sign  # noqa: E402


def signed_headers(method: str, path: str, body: bytes = b"", *, ts_ms: int | None = None, secret: str = SECRET, rid: str = "req-1") -> dict[str, str]:
    ts = str(ts_ms if ts_ms is not None else int(time.time() * 1000))
    return {
        "X-Infraos-Timestamp": ts,
        "X-Infraos-Request-Id": rid,
        "X-Infraos-Signature": sign(secret, method, path, ts, sha256_hex(body)),
    }


@pytest.fixture()
def settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


@pytest.fixture()
def client(settings: Settings) -> TestClient:
    return TestClient(create_app(settings), raise_server_exceptions=False)
