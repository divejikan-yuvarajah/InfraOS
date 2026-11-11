import time

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import Settings
from app.main import create_app

from .conftest import SECRET, signed_headers


def test_health_is_open_and_minimal(client: TestClient) -> None:
    r = client.get("/health")
    assert r.status_code == 200 and r.json() == {"status": "ok"}


def test_capabilities_with_valid_signature(client: TestClient) -> None:
    r = client.get("/v1/capabilities", headers=signed_headers("GET", "/v1/capabilities"))
    assert r.status_code == 200
    body = r.json()
    assert body["ocr"] is False and body["pipelineVersion"] == "p1"
    assert "XLSX" in body["unsupported"]


def test_missing_headers_rejected_with_generic_body(client: TestClient) -> None:
    r = client.get("/v1/capabilities")
    assert r.status_code == 401
    assert set(r.json()) == {"code", "message", "retryable", "requestId"}
    assert r.json()["code"] == "UNAUTHORIZED"


def test_bad_signature_rejected(client: TestClient) -> None:
    h = signed_headers("GET", "/v1/capabilities", secret="x" * 48)
    assert client.get("/v1/capabilities", headers=h).status_code == 401


def test_signature_bound_to_path_and_method(client: TestClient) -> None:
    h = signed_headers("GET", "/ready")
    assert client.get("/v1/capabilities", headers=h).status_code == 401


def test_stale_timestamp_rejected(client: TestClient) -> None:
    h = signed_headers("GET", "/v1/capabilities", ts_ms=int(time.time() * 1000) - 120_000)
    assert client.get("/v1/capabilities", headers=h).status_code == 401


def test_browser_origin_rejected(client: TestClient) -> None:
    h = signed_headers("GET", "/v1/capabilities")
    h["Origin"] = "https://evil.example"
    assert client.get("/v1/capabilities", headers=h).status_code == 403


def test_no_cors_headers(client: TestClient) -> None:
    r = client.options("/v1/capabilities", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in r.headers


def test_ready_requires_signature_and_reports_booleans_only(client: TestClient) -> None:
    assert client.get("/ready").status_code == 401
    r = client.get("/ready", headers=signed_headers("GET", "/ready"))
    assert r.status_code == 200
    text = r.text
    assert SECRET not in text and "127.0.0.1" not in text
    assert r.json()["checks"]["qdrant"] is False


def test_docs_disabled_outside_development(client: TestClient) -> None:
    for p in ("/docs", "/redoc", "/openapi.json"):
        assert client.get(p).status_code == 404


def test_docs_enabled_in_development() -> None:
    s = Settings(app_env="development")  # type: ignore[call-arg]
    assert TestClient(create_app(s)).get("/openapi.json").status_code == 200


def test_oversized_body_rejected(client: TestClient) -> None:
    r = client.post("/v1/anything", content=b"x", headers={"Content-Length": str(31 * 1024 * 1024)})
    assert r.status_code == 413


def test_weak_secret_fails_fast() -> None:
    with pytest.raises(ValidationError):
        Settings(ai_internal_secret="short")  # type: ignore[call-arg]


def test_secret_rotation_accepts_previous_secret() -> None:
    primary = "p" * 48
    previous = "o" * 48
    s = Settings(
        app_env="test",
        ai_internal_secret=primary,  # type: ignore[call-arg]
        ai_internal_secret_previous=previous,  # type: ignore[call-arg]
    )
    c = TestClient(create_app(s))

    # Request signed with primary secret succeeds
    h_primary = signed_headers("GET", "/v1/capabilities", secret=primary)
    assert c.get("/v1/capabilities", headers=h_primary).status_code == 200

    # Request signed with previous secret also succeeds (zero-downtime rotation)
    h_prev = signed_headers("GET", "/v1/capabilities", secret=previous)
    assert c.get("/v1/capabilities", headers=h_prev).status_code == 200

    # Request signed with unrelated secret fails
    h_bad = signed_headers("GET", "/v1/capabilities", secret="x" * 48)
    assert c.get("/v1/capabilities", headers=h_bad).status_code == 401

