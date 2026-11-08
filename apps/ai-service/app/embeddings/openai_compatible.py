"""OpenAI-compatible `/embeddings` client (OpenRouter by default). The model id comes only from env AI_EMBED_MODEL."""
from __future__ import annotations

import asyncio
import random

import httpx

from ..config import Settings
from ..errors import ApiError
from ..logging import log_event
from .base import EmbedResult


class OpenAICompatibleEmbedder:
    def __init__(self, s: Settings, client: httpx.AsyncClient | None = None, sleep=asyncio.sleep) -> None:  # noqa: ANN001
        self.model = s.ai_embed_model
        self._base = s.embed_base_url.rstrip("/")
        self._key = s.embed_key
        self._retries = s.embed_max_retries
        self._client = client or httpx.AsyncClient(timeout=s.embed_timeout_s)
        self._sleep = sleep

    async def embed(self, texts: list[str]) -> EmbedResult:
        if not self.model or not self._key:
            raise ApiError("NOT_CONFIGURED")
        last = "EMBEDDING_PROVIDER_ERROR"
        for attempt in range(self._retries + 1):
            try:
                r = await self._client.post(
                    f"{self._base}/embeddings",
                    headers={"Authorization": f"Bearer {self._key}", "Content-Type": "application/json"},
                    json={"model": self.model, "input": texts},
                )
            except (httpx.TimeoutException, httpx.TransportError):
                last = "EMBEDDING_PROVIDER_ERROR"
                r = None
            if r is not None:
                if r.status_code == 200:
                    return self._parse(r, len(texts))
                if r.status_code == 429:
                    last = "EMBEDDING_RATE_LIMITED"
                elif r.status_code >= 500:
                    last = "EMBEDDING_PROVIDER_ERROR"
                else:  # 4xx other than 429: caller/config error, retrying cannot help
                    log_event("embed_rejected", status=r.status_code)
                    raise ApiError("EMBEDDING_PROVIDER_ERROR")
            if attempt < self._retries:
                await self._sleep(min(8.0, 0.5 * (2 ** attempt)) + random.uniform(0, 0.25))
        log_event("embed_failed", code=last)
        raise ApiError(last)

    def _parse(self, r: httpx.Response, n: int) -> EmbedResult:
        try:
            body = r.json()
            rows = sorted(body["data"], key=lambda d: d.get("index", 0))
            vectors = [[float(x) for x in d["embedding"]] for d in rows]
            usage = body.get("usage") or {}
            tokens = int(usage.get("prompt_tokens") or usage.get("total_tokens") or 0)
            model = str(body.get("model") or self.model)
        except (ValueError, KeyError, TypeError):
            raise ApiError("EMBEDDING_PROVIDER_ERROR") from None
        if len(vectors) != n or not vectors or not vectors[0] or len({len(v) for v in vectors}) != 1:
            raise ApiError("EMBEDDING_PROVIDER_ERROR")
        return EmbedResult(vectors, model, len(vectors[0]), tokens)

    async def aclose(self) -> None:
        await self._client.aclose()
