"""TEST-ONLY deterministic embedder. Reachable solely when APP_ENV=test; never used in development or production."""
from __future__ import annotations

import hashlib
import math

from ..chunking.chunker import estimate_tokens
from .base import EmbedResult

DIM = 32


class FakeEmbedder:
    model = "fake/test-embedder"

    async def embed(self, texts: list[str]) -> EmbedResult:
        vecs: list[list[float]] = []
        for t in texts:
            v = [0.0] * DIM
            for word in t.lower().split():
                h = hashlib.sha256(word.encode()).digest()
                v[h[0] % DIM] += 1.0
            n = math.sqrt(sum(x * x for x in v)) or 1.0
            vecs.append([x / n for x in v])
        return EmbedResult(vecs, self.model, DIM, sum(estimate_tokens(t) for t in texts))
