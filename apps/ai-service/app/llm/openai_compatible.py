"""Provider adapter: complete(messages, schema, out_model) -> parsed output + usage. OpenAI-compatible chat completions (OpenRouter by default).
Model ids come only from env. One repair retry feeds back validation error PATHS (never document text); retries 429/5xx with backoff."""
from __future__ import annotations

import asyncio
import json
import random
from dataclasses import dataclass
from typing import Any, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from ..config import Settings
from ..errors import ApiError
from ..logging import log_event

T = TypeVar("T", bound=BaseModel)


@dataclass
class Completion:
    parsed: Any
    input_tokens: int
    output_tokens: int
    model: str
    mode: str


class LlmClient:
    def __init__(self, s: Settings, client: httpx.AsyncClient | None = None, sleep=asyncio.sleep) -> None:  # noqa: ANN001
        self.s = s
        self._client = client or httpx.AsyncClient(timeout=60)
        self._sleep = sleep
        self._sem = asyncio.Semaphore(s.llm_concurrency)

    def model_for(self, strong: bool) -> str:
        m = (self.s.ai_chat_model_strong if strong and self.s.ai_chat_model_strong else self.s.ai_chat_model)
        if not m or not self.s.chat_key:
            raise ApiError("NOT_CONFIGURED")
        return m

    async def _post(self, body: dict[str, Any], timeout: float) -> dict[str, Any]:
        last = "LLM_UNAVAILABLE"
        for attempt in range(self.s.llm_max_retries + 1):
            try:
                r = await self._client.post(f"{self.s.chat_url}/chat/completions", json=body, timeout=timeout,
                                            headers={"Authorization": f"Bearer {self.s.chat_key}", "Content-Type": "application/json"})
            except httpx.TimeoutException:
                last, r = "LLM_TIMEOUT", None
            except httpx.TransportError:
                last, r = "LLM_UNAVAILABLE", None
            if r is not None:
                if r.status_code == 200:
                    try:
                        return r.json()
                    except ValueError:
                        raise ApiError("LLM_INVALID_OUTPUT") from None
                if r.status_code == 429:
                    last = "LLM_RATE_LIMITED"
                elif r.status_code >= 500:
                    last = "LLM_UNAVAILABLE"
                else:  # 4xx: retrying cannot help
                    text = r.text.lower()
                    log_event("llm_rejected", status=r.status_code)
                    raise ApiError("LLM_CONTEXT_TOO_LONG" if ("context" in text and ("length" in text or "maximum" in text)) else "LLM_UNAVAILABLE")
            if last == "LLM_TIMEOUT":
                break  # a timed-out generation is not retried; the caller falls back
            if attempt < self.s.llm_max_retries:
                await self._sleep(min(6.0, 0.7 * (2 ** attempt)) + random.uniform(0, 0.3))
        log_event("llm_failed", code=last)
        raise ApiError(last)

    async def complete(self, messages: list[dict[str, str]], schema: dict[str, Any], out_model: type[T], *, max_tokens: int, timeout: float, strong: bool = False) -> Completion:
        model = self.model_for(strong)
        mode = self.s.llm_structured_mode if self.s.llm_structured_mode in ("json_schema", "json_object") else "json_schema"
        response_format = {"type": "json_schema", "json_schema": schema} if mode == "json_schema" else {"type": "json_object"}
        msgs = list(messages)
        tin = tout = 0
        async with self._sem:
            for attempt in range(2):  # original + one repair
                data = await self._post({"model": model, "messages": msgs, "temperature": 0.1, "max_tokens": max_tokens, "response_format": response_format}, timeout)
                usage = data.get("usage") or {}
                tin += int(usage.get("prompt_tokens") or 0)
                tout += int(usage.get("completion_tokens") or 0)
                try:
                    content = data["choices"][0]["message"]["content"]
                except (KeyError, IndexError, TypeError):
                    raise ApiError("LLM_INVALID_OUTPUT") from None
                try:
                    parsed = out_model.model_validate(json.loads(content))
                    return Completion(parsed, tin, tout, str(data.get("model") or model), mode)
                except (ValueError, ValidationError) as exc:
                    if attempt == 1:
                        break
                    paths = sorted({".".join(str(x) for x in e.get("loc", ())) + ":" + str(e.get("type")) for e in exc.errors()}) if isinstance(exc, ValidationError) else ["not_json"]
                    msgs = msgs + [{"role": "assistant", "content": (content or "")[:4000]}, {"role": "user", "content": f"Your previous reply failed validation ({'; '.join(paths)[:400]}). Reply again with ONE valid JSON object matching the schema, nothing else."}]
        log_event("llm_invalid_output")
        raise ApiError("LLM_INVALID_OUTPUT")
