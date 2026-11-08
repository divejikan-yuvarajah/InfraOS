"""Pydantic v2 contracts. Mirrored as zod schemas in apps/api/src/modules/ai/ai.contracts.ts; shared JSON fixtures live in tests/fixtures."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

OBJECT_ID = r"^[a-f0-9]{24}$"
SHA256 = r"^[a-f0-9]{64}$"


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ExtractMetadata(Strict):
    documentId: str = Field(pattern=OBJECT_ID)
    versionNo: int = Field(ge=1, le=10_000)
    mimeType: str = Field(min_length=3, max_length=100)
    fileSha256: str = Field(pattern=SHA256)
    language: str | None = Field(default=None, max_length=8)


class PageInfo(Strict):
    page: int | None
    charCount: int


class ChunkOut(Strict):
    chunkId: str
    chunkIndex: int
    text: str
    pageStart: int | None
    pageEnd: int | None
    section: str | None
    contentHash: str
    charCount: int
    tokenEstimate: int


class ExtractStats(Strict):
    pages: int
    chars: int
    chunks: int
    duplicatesDropped: int
    truncated: bool
    scripts: dict[str, int]
    dominantScripts: list[str]


class ExtractChunkResponse(Strict):
    fileSha256: str
    pipelineVersion: str
    pageCount: int | None
    pages: list[PageInfo]
    chunks: list[ChunkOut]
    stats: ExtractStats
    warnings: list[str]
