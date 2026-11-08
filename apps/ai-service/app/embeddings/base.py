"""Embedding provider adapter interface. Batching, token budgeting and dimension discovery live here, not in providers."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from ..chunking.chunker import estimate_tokens


@dataclass
class EmbedResult:
    vectors: list[list[float]]
    model: str
    dimension: int
    tokens: int


class Embedder(Protocol):
    model: str

    async def embed(self, texts: list[str]) -> EmbedResult:  # one provider request; caller keeps it within batch limits
        ...


def plan_batches(texts: list[str], max_items: int, max_tokens: int) -> list[list[int]]:
    """Index groups with <= max_items inputs and <= ~max_tokens estimated tokens each (an oversized single text gets its own batch)."""
    batches: list[list[int]] = []
    cur: list[int] = []
    cur_tokens = 0
    for i, t in enumerate(texts):
        est = estimate_tokens(t)
        if cur and (len(cur) >= max_items or cur_tokens + est > max_tokens):
            batches.append(cur)
            cur, cur_tokens = [], 0
        cur.append(i)
        cur_tokens += est
    if cur:
        batches.append(cur)
    return batches


async def embed_all(embedder: Embedder, texts: list[str], max_items: int, max_tokens: int) -> EmbedResult:
    if not texts:
        return EmbedResult([], embedder.model, 0, 0)
    out: list[list[float] | None] = [None] * len(texts)
    total_tokens = 0
    dim = 0
    model = embedder.model
    for group in plan_batches(texts, max_items, max_tokens):
        res = await embedder.embed([texts[i] for i in group])
        if dim and res.dimension != dim:
            from ..errors import ApiError

            raise ApiError("DIMENSION_MISMATCH")
        dim, model = res.dimension, res.model or model
        total_tokens += res.tokens
        for i, v in zip(group, res.vectors, strict=True):
            out[i] = v
    return EmbedResult([v for v in out if v is not None], model, dim, total_tokens)
