from __future__ import annotations

import json
import time
from typing import Any, Callable

import httpx
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.config import Settings
from app.llm import prompts
from app.llm.openai_compatible import LlmClient
from app.main import create_app
from app.security import sha256_hex, sign

from .conftest import SECRET


def _llm_settings(settings: Settings, **kw: Any) -> Settings:
    return settings.model_copy(
        update={
            "openrouter_api_key": SecretStr("k" * 16),
            "ai_chat_model": "test/chat",
            "ai_chat_model_strong": "test/strong",
            "ai_vision_model": "test/vision",
            **kw,
        }
    )


def _reply(content: object, usage: tuple[int, int] = (20, 12), model: str = "test/chat") -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "model": model,
            "choices": [
                {
                    "message": {
                        "content": content if isinstance(content, str) else json.dumps(content),
                    }
                }
            ],
            "usage": {"prompt_tokens": usage[0], "completion_tokens": usage[1]},
        },
    )


def _make_app(settings: Settings, handler: Callable[[httpx.Request], httpx.Response], **kw: Any) -> TestClient:
    s = _llm_settings(settings, **kw)
    app = create_app(s)

    async def _nosleep(_delay: float) -> None:
        return None

    app.state.llm = LlmClient(
        s,
        client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        sleep=_nosleep,
    )
    return TestClient(app, raise_server_exceptions=False)


def _post(client: TestClient, path: str, payload: dict[str, Any]) -> Any:
    body = json.dumps(payload).encode()
    ts = str(int(time.time() * 1000))
    headers = {
        "X-Infraos-Timestamp": ts,
        "X-Infraos-Request-Id": "batch12-test-req",
        "Content-Type": "application/json",
        "X-Infraos-Signature": sign(SECRET, "POST", path, ts, sha256_hex(body)),
    }
    return client.post(path, content=body, headers=headers)


VISION_REQ: dict[str, Any] = {
    "images": [
        {"n": 1, "dataUrl": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD="},
    ],
    "context": {
        "projectType": "ROAD",
        "inspectionType": "PROGRESS_VERIFICATION",
        "milestones": [
            {
                "title": "Sub-base Compaction",
                "plannedStart": "2026-10-01T00:00:00Z",
                "plannedEnd": "2026-11-15T00:00:00Z",
                "reportedProgress": 45,
            }
        ],
        "claimedProgress": 45,
        "previousVerifiedProgress": {"percent": 20, "asOf": "2026-10-15T00:00:00Z"},
        "inspectionDate": "2026-11-10T09:00:00Z",
    },
    "maxOutputTokens": 1200,
}

VISION_GOOD: dict[str, Any] = {
    "images": [
        {
            "n": 1,
            "activityDescription": "Compacted aggregate sub-base visible along carriageway edge.",
            "visibleWorkIndicators": [
                {"label": "Aggregate layer placed", "certainty": "CLEAR"},
            ],
            "qualityIssues": ["NO_SCALE_REFERENCE"],
            "notes": None,
        }
    ],
    "overall": {
        "consistencyWithReportedStage": "PARTIALLY_CONSISTENT",
        "rationale": "Image 1 shows aggregate layer preparation matching the sub-base stage.",
    },
    "potentialDiscrepancies": [],
    "cannotBeDetermined": ["Subgrade compaction density cannot be verified visually."],
    "questionsForInspector": ["Verify layer thickness across full chainage."],
}

COPILOT_REQ: dict[str, Any] = {
    "language": "en",
    "conversation": [
        {"role": "user", "content": "What is the current risk index and progress for INF-ROAD-100?"},
    ],
    "pageContext": {
        "type": "PROJECT",
        "recordId": "507f1f77bcf86cd799439011",
        "route": "/projects/507f1f77bcf86cd799439011",
    },
    "toolCatalog": [
        {
            "name": "get_project_summary",
            "description": "Read-only summary for a project",
            "argsSchema": {"projectId": "string"},
        }
    ],
    "toolResults": [],
    "round": 1,
    "maxOutputTokens": 1200,
}


def test_vision_analyze_requires_signature_and_fails_closed_when_unset(settings: Settings) -> None:
    c_unauth = _make_app(settings, lambda _r: _reply(VISION_GOOD))
    assert c_unauth.post("/v1/llm/vision-analyze", json=VISION_REQ).status_code == 401

    c_unset = _make_app(settings, lambda _r: _reply(VISION_GOOD), ai_vision_model="", ai_chat_model="")
    r = _post(c_unset, "/v1/llm/vision-analyze", VISION_REQ)
    assert r.status_code == 503
    assert r.json()["code"] == "NOT_CONFIGURED"


def test_vision_analyze_uses_vision_model_enforces_rules_and_repairs_once(settings: Settings) -> None:
    seen: list[dict[str, Any]] = []
    calls = {"n": 0}

    def h(req: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        seen.append(json.loads(req.content))
        if calls["n"] == 1:
            return _reply({"overall": {"consistencyWithReportedStage": "APPROVED"}}, usage=(12, 5), model="test/vision")
        return _reply(VISION_GOOD, usage=(18, 10), model="test/vision")

    client = _make_app(settings, h)
    r = _post(client, "/v1/llm/vision-analyze", VISION_REQ)
    assert r.status_code == 200
    assert calls["n"] == 2

    body = r.json()
    assert body["model"] == "test/vision"
    assert body["promptVersion"] == prompts.PROMPT_VERSIONS["vision"]
    assert body["usage"] == {"inputTokens": 30, "outputTokens": 15}
    assert body["output"]["overall"]["consistencyWithReportedStage"] == "PARTIALLY_CONSISTENT"

    first_msgs = seen[0]["messages"]
    assert first_msgs[0]["role"] == "system"
    assert "NEVER estimate, calculate, or state completion percentages" in first_msgs[0]["content"]
    assert "image/jpeg;base64" not in first_msgs[0]["content"]
    user_parts = first_msgs[1]["content"]
    assert any(p.get("type") == "image_url" for p in user_parts)

    repair_msg = seen[1]["messages"][-1]["content"]
    assert "failed validation" in repair_msg
    assert "Sub-base Compaction" not in repair_msg


def test_vision_analyze_classifies_rate_limit_and_timeout(settings: Settings) -> None:
    r_429 = _post(_make_app(settings, lambda _req: httpx.Response(429)), "/v1/llm/vision-analyze", VISION_REQ)
    assert r_429.status_code == 503
    assert r_429.json()["code"] == "LLM_RATE_LIMITED"
    assert r_429.json()["retryable"] is True

    def _timeout(_req: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("vision timeout")

    r_to = _post(_make_app(settings, _timeout), "/v1/llm/vision-analyze", VISION_REQ)
    assert r_to.status_code == 504
    assert r_to.json()["code"] == "LLM_TIMEOUT"


def test_copilot_step_requires_signature_and_fails_closed_when_unset(settings: Settings) -> None:
    c_unauth = _make_app(settings, lambda _r: _reply({}))
    assert c_unauth.post("/v1/llm/copilot-step", json=COPILOT_REQ).status_code == 401

    c_unset = _make_app(settings, lambda _r: _reply({}), ai_chat_model="")
    r = _post(c_unset, "/v1/llm/copilot-step", COPILOT_REQ)
    assert r.status_code == 503
    assert r.json()["code"] == "NOT_CONFIGURED"


def test_copilot_step_tool_calls_final_routing_and_prompt_isolation(settings: Settings) -> None:
    seen_bodies: list[dict[str, Any]] = []

    def h(req: httpx.Request) -> httpx.Response:
        payload = json.loads(req.content)
        seen_bodies.append(payload)
        state = json.loads(payload["messages"][1]["content"].split("Copilot State:\n", 1)[1])
        if state["round"] < 4:
            return _reply(
                {
                    "type": "tool_calls",
                    "calls": [
                        {
                            "id": "call_1",
                            "tool": "get_project_summary",
                            "args": {"projectId": "507f1f77bcf86cd799439011"},
                        }
                    ],
                    "answer": None,
                    "claims": [],
                    "missingInfo": [],
                },
                model=payload["model"],
            )
        return _reply(
            {
                "type": "final",
                "calls": [],
                "answer": "Project INF-ROAD-100 shows 45% reported progress [1].",
                "claims": [
                    {"text": "Project INF-ROAD-100 shows 45% reported progress.", "sourceRefs": [1]},
                ],
                "missingInfo": [],
            },
            model=payload["model"],
        )

    client = _make_app(settings, h)

    r1 = _post(client, "/v1/llm/copilot-step", {**COPILOT_REQ, "round": 1})
    assert r1.status_code == 200
    assert r1.json()["model"] == "test/chat"
    assert r1.json()["promptVersion"] == prompts.PROMPT_VERSIONS["copilot"]
    assert r1.json()["output"]["type"] == "tool_calls"
    assert r1.json()["output"]["calls"][0]["tool"] == "get_project_summary"

    # Untrusted conversation stays strictly in user message, never system message
    sys_msg = seen_bodies[0]["messages"][0]["content"]
    assert "Tools are strictly read-only" in sys_msg
    assert "INF-ROAD-100" not in sys_msg

    # Round 4 escalates to strong model when configured
    r4 = _post(
        client,
        "/v1/llm/copilot-step",
        {
            **COPILOT_REQ,
            "round": 4,
            "toolResults": [
                {
                    "callId": "call_1",
                    "tool": "get_project_summary",
                    "facts": [{"id": "T1.f1", "label": "reported_progress", "value": 45, "unit": "%", "basis": "REPORTED"}],
                    "status": "OK",
                }
            ],
        },
    )
    assert r4.status_code == 200
    assert r4.json()["model"] == "test/strong"
    assert r4.json()["output"]["type"] == "final"
    assert r4.json()["output"]["claims"][0]["sourceRefs"] == [1]


def test_copilot_step_invalid_output_never_leaks_model_text(settings: Settings) -> None:
    r = _post(
        _make_app(settings, lambda _req: _reply("SECRET_RAW_MODEL_LEAK not valid json")),
        "/v1/llm/copilot-step",
        COPILOT_REQ,
    )
    assert r.status_code == 502
    assert r.json()["code"] == "LLM_INVALID_OUTPUT"
    assert "SECRET_RAW_MODEL_LEAK" not in r.text

