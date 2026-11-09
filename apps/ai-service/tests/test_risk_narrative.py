import json
import time
import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.config import Settings
from app.llm.openai_compatible import LlmClient
from app.main import create_app
from app.security import sha256_hex, sign
from .conftest import SECRET


def llm_settings(settings: Settings, **kw) -> Settings:
    return settings.model_copy(
        update={
            "openrouter_api_key": SecretStr("k" * 10),
            "ai_chat_model": "test/chat",
            "ai_chat_model_strong": "test/strong",
            **kw,
        }
    )


def reply(content: object, usage=(15, 25)):
    body = {
        "model": "test/chat",
        "choices": [
            {
                "message": {
                    "content": content if isinstance(content, str) else json.dumps(content)
                }
            }
        ],
        "usage": {"prompt_tokens": usage[0], "completion_tokens": usage[1]},
    }
    return httpx.Response(200, json=body)


def make_app(settings: Settings, handler, **kw) -> TestClient:
    s = llm_settings(settings, **kw)
    app = create_app(s)

    async def nosleep(_d: float) -> None:
        return None

    app.state.llm = LlmClient(
        s,
        client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        sleep=nosleep,
    )
    return TestClient(app, raise_server_exceptions=False)


def post(client: TestClient, path: str, payload: dict):
    body = json.dumps(payload).encode()
    ts = str(int(time.time() * 1000))
    h = {
        "X-Infraos-Timestamp": ts,
        "X-Infraos-Request-Id": "r1",
        "Content-Type": "application/json",
        "X-Infraos-Signature": sign(SECRET, "POST", path, ts, sha256_hex(body)),
    }
    return client.post(path, content=body, headers=h)


def test_risk_narrative_generates_verified_explanation(settings: Settings):
    mock_narrative = {
        "summary": "Project INF-RDA-001 is evaluated at HIGH overall risk driven by delayed milestones and budget variance.",
        "categories": [
            {
                "category": "DELAY",
                "text": "Milestone M1 is 45 days overdue, and stagnant progress of 12% has been observed across 35 days.",
            },
            {
                "category": "BUDGET",
                "text": "Financial progress exceeds physical progress by 25 percentage points.",
            },
        ],
        "questionsToAsk": [
            "What is the contractor recovery plan for milestone M1?",
            "Has the pending variation order been submitted for review?",
        ],
    }

    client = make_app(settings, lambda _req: reply(mock_narrative))

    req_payload = {
        "language": "en",
        "projectCode": "INF-RDA-001",
        "overallLevel": "HIGH",
        "overallIndex": 65,
        "categories": [
            {"category": "DELAY", "level": "HIGH", "index": 45},
            {"category": "BUDGET", "level": "MODERATE", "index": 20},
        ],
        "indicators": [
            {
                "code": "DL1",
                "category": "DELAY",
                "severity": "HIGH",
                "points": 25,
                "evidence": [{"kind": "milestone", "ref": {"id": "m1"}, "value": 45}],
            }
        ],
        "maxOutputTokens": 800,
    }

    r = post(client, "/v1/llm/risk-narrative", req_payload)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["promptVersion"] == "risk-narr.v1"
    assert data["output"]["summary"] == mock_narrative["summary"]
    assert len(data["output"]["categories"]) == 2
    assert len(data["output"]["questionsToAsk"]) == 2
